import { useEffect, useRef, useCallback } from 'react';
import { ref, set, update, onValue, off, get, push, runTransaction } from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase/config';
import { useGameStore } from '../store/useGameStore';
import { getPlayerById } from '../data/players';
import { buildPooledQueue, getPoolForIndex, isLastInPool } from '../utils/poolBuilder';
import { IPL_TEAMS, getTeamById } from '../data/teams';
import { computeAIBid } from '../utils/aiPlayer';
import { SoldEntry, RoomData, SQUAD_RULES, AuctionData, TeamState, PoolMeta, BidHistoryEntry, ChatMessage } from '../types';
import { playHammer, playBidPlaced, playCrowdCheer, playTimerTick, playUnsold, playNewPlayer } from '../utils/sounds';
import {
  speak, speakChain,
  announcePool, announcePlayer, announceSold, announceUnsold,
  announceBreak, announceRapid, announceGoingOnce, announceGoingTwice,
} from '../utils/speech';
import { getNextBid } from '../utils/squadRules';

const TIMER_NORMAL  = 28_000;
const TIMER_RAPID   = 14_000;
const TIMER_EXTEND  = 9_000;
const BREAK_DURATION = 60_000;
const POST_RESULT_GAP = 1_500;

function genCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
function fmtL(l: number) { return l >= 100 ? `₹${(l / 100).toFixed(2)} Cr` : `₹${l}L`; }
function sp<T>(s: string, fb: T): T { try { return JSON.parse(s) as T; } catch { return fb; } }

export function useGameRoom() {
  const store = useGameStore();

  const mainTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiTickRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const processing      = useRef(false);
  const breakProcessing = useRef(false);
  const safetyTimer     = useRef<ReturnType<typeof setTimeout>|null>(null);
  const speakingRoom  = useRef<string | null>(null);
  const prevSeq       = useRef(-1);
  const prevBidCnt    = useRef(-1);
  const prevQIdx      = useRef(-1);
  const prevPhase     = useRef('');
  const goingOnce     = useRef(false);
  const goingTwice    = useRef(false);

  // ── Auth ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return onAuthStateChanged(auth, u => {
      if (u) store.setUid(u.uid);
      else signInAnonymously(auth).catch(console.error);
    });
  }, []);

  // ── Room subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const { roomId } = store;
    if (!roomId || !isFirebaseConfigured()) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const handler = onValue(roomRef, snap => {
      const data = snap.val() as RoomData | null;
      if (!data) return;
      store.setRoomData(data);
      const { auction } = data;

      // Screen routing
      if      (auction.phase === 'break')                      store.setScreen('break' as any);
      else if (['auction','rapid'].includes(auction.phase))    store.setScreen('auction');
      else if  (auction.phase === 'finished')                  store.setScreen('scoreboard');

      // TTS non-host
      if (!store.isHost && store.soundEnabled && auction.speechSeq !== prevSeq.current) {
        prevSeq.current = auction.speechSeq;
        if (auction.speechText) speakChain(auction.speechText.split(' … '), { rate: 0.88 });
      }

      // SFX all clients
      if (store.soundEnabled) {
        if (auction.bidCount !== prevBidCnt.current && prevBidCnt.current >= 0) playBidPlaced();
        if (auction.queueIndex !== prevQIdx.current && prevQIdx.current >= 0) {
          if (auction.hammerTeamId) { playHammer(); setTimeout(playCrowdCheer, 380); }
          else if (auction.phase !== 'break') playNewPlayer();
        }
        if (auction.phase === 'rapid' && prevPhase.current !== 'rapid') playNewPlayer();
      }

      prevBidCnt.current = auction.bidCount;
      prevQIdx.current   = auction.queueIndex;
      prevPhase.current  = auction.phase;
    });
    return () => off(roomRef, 'value', handler as any);
  }, [store.roomId]);

  // ── Speak, then open bidding (host only) ──────────────────────────────
  const speakAndOpen = useCallback(async (phrases: string[], roomId: string, dur: number) => {
    // Write biddingStartAt BEFORE speaking — game is never blocked by TTS
    const announceMs = phrases.filter(Boolean).join(' ').split(' ').length * 450; // ~450ms/word
    const safeDelay  = Math.max(8_000, Math.min(18_000, announceMs));
    const now        = Date.now();
    const biddingAt  = now + safeDelay;
    await update(ref(db, `rooms/${roomId}/auction`), {
      biddingStartAt: biddingAt,
      timerEnd:       biddingAt + dur,
    });
    // Then speak (fire-and-forget — failure won't freeze game)
    if (store.soundEnabled) {
      speakChain(phrases.filter(Boolean), { rate: 0.88 }).catch(() => {});
    }
  }, [store.soundEnabled]);

  // ── HOST main timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;
    if (mainTimerRef.current) clearInterval(mainTimerRef.current);

    mainTimerRef.current = setInterval(() => {
      const data = useGameStore.getState().roomData;
      if (!data) return;
      const { auction } = data;
      if (!['auction', 'rapid'].includes(auction.phase)) return;
      // biddingStartAt === 0 means not yet started (waiting for speech)
      if (auction.biddingStartAt === 0 || auction.timerEnd === 0) return;
      // Still in announce window — show countdown but don't expire
      if (Date.now() < auction.biddingStartAt) return;

      const left = Math.ceil((auction.timerEnd - Date.now()) / 1000);

      if (left <= 8 && left > 4 && !goingOnce.current && auction.bidCount > 0 && store.soundEnabled) {
        goingOnce.current = true;
        speak(announceGoingOnce(auction.currentBid), { cancel: false });
      }
      if (left <= 4 && left > 1 && !goingTwice.current && auction.bidCount > 0 && store.soundEnabled) {
        goingTwice.current = true;
        speak(announceGoingTwice(auction.currentBid), { cancel: false });
      }
      if (left <= 5 && left > 0 && store.soundEnabled) playTimerTick(left <= 2);

      if (Date.now() >= auction.timerEnd && !processing.current) {
        processing.current = true;
        goingOnce.current  = false;
        goingTwice.current = false;
        handleTimerExpired(data).finally(() => setTimeout(() => { processing.current = false; }, 600));
      }
    }, 400);

    return () => { if (mainTimerRef.current) clearInterval(mainTimerRef.current); };
  }, [store.isHost, store.roomId]);

  // ── HOST break countdown ──────────────────────────────────────────────
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);

    breakTimerRef.current = setInterval(() => {
      const data = useGameStore.getState().roomData;
      if (!data || data.auction.phase !== 'break') return;
      if (data.auction.poolBreakEnd === 0) return;
      // Only trigger when break time has actually elapsed
      if (Date.now() < data.auction.poolBreakEnd) return;
      // Use separate lock from main timer to avoid conflicts
      if (breakProcessing.current) return;
      breakProcessing.current = true;
      // Always get freshest data before starting next pool
      const bRoomId = useGameStore.getState().roomId;
      if (!bRoomId) { breakProcessing.current = false; return; }
      get(ref(db, `rooms/${bRoomId}`)).then(snap => {
        const fresh = snap.val() as RoomData | null;
        if (!fresh || fresh.auction.phase !== 'break') {
          breakProcessing.current = false;
          return;
        }
        startNextPool(fresh).finally(() => {
          setTimeout(() => { breakProcessing.current = false; }, 1000);
        });
      }).catch(() => { breakProcessing.current = false; });
    }, 400);

    return () => { if (breakTimerRef.current) clearInterval(breakTimerRef.current); };
  }, [store.isHost, store.roomId]);

  // ── HOST AI tick ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;
    if (aiTickRef.current) clearInterval(aiTickRef.current);

    aiTickRef.current = setInterval(() => {
      const data = useGameStore.getState().roomData;
      if (!data) return;
      const { auction, teams } = data;
      if (!['auction', 'rapid'].includes(auction.phase)) return;
      if (auction.biddingStartAt === 0 || auction.timerEnd === 0) return;
      if (Date.now() < auction.biddingStartAt) return; // still announcing

      const timeLeft = auction.timerEnd - Date.now();
      if (timeLeft < 1200) return; // never bid in last 1.2s

      const queue  = sp<string[]>(auction.queue, []);
      const player = getPlayerById(queue[auction.queueIndex]);
      if (!player) return;

      const aiTeams = Object.entries(teams)
        .filter(([id, t]) => t.isAI && id !== auction.currentBidderTeamId)
        .sort(() => Math.random() - 0.5);

      for (const [teamId, team] of aiTeams) {
        const dec = computeAIBid(team, player, auction.currentBid, team.aiStrategy);
        if (dec.shouldBid) {
          const ti     = getTeamById(teamId);
          const newEnd = Math.max(auction.timerEnd, Date.now() + TIMER_EXTEND);
          const hist   = sp<BidHistoryEntry[]>(auction.bidHistory, []);
          update(ref(db, `rooms/${store.roomId!}/auction`), {
            currentBid:          dec.amount,
            currentBidderTeamId: teamId,
            bidCount:            auction.bidCount + 1,
            timerEnd:            newEnd,
            announcement:        `🤖 ${ti.shortName} bids ${fmtL(dec.amount)}!`,
            speechText:          `${ti.shortName} bids ${fmtL(dec.amount)}!`,
            speechSeq:           auction.speechSeq + 1,
            bidHistory:          JSON.stringify([...hist, { teamId, amount: dec.amount, ts: Date.now() }]),
          });
          break;
        }
      }
    }, 2000);

    return () => { if (aiTickRef.current) clearInterval(aiTickRef.current); };
  }, [store.isHost, store.roomId]);

  // ── Timer expired ─────────────────────────────────────────────────────
  const handleTimerExpired = async (data: RoomData): Promise<void> => {
    const { roomId } = useGameStore.getState();
    if (!roomId) return;

    const { auction, teams } = data;
    const queue     = sp<string[]>(auction.queue, []);
    const pools     = sp<PoolMeta[]>(auction.pools, []);
    const unsoldIds = sp<string[]>(auction.unsoldIds, []);
    const soldLog   = sp<SoldEntry[]>(auction.soldLog, []);
    const isRapid   = auction.phase === 'rapid';

    const playerId = queue[auction.queueIndex];
    if (!playerId) return;
    const player = getPlayerById(playerId);
    if (!player) return;

    let newUnsold  = [...unsoldIds];
    let newSoldLog = [...soldLog];
    let hammerTeamId: string | null = null;
    const teamUpdates: Record<string, TeamState> = {};
    let resultPhrases: string[] = [];
    let lastSoldEntry = 'null';

    if (auction.currentBidderTeamId && auction.currentBid >= player.basePrice) {
      const winner = teams[auction.currentBidderTeamId];
      const wi     = getTeamById(auction.currentBidderTeamId);
      const prev   = sp<SoldEntry[]>(winner?.soldPlayers ?? '[]', []);
      const entry: SoldEntry = { playerId, teamId: auction.currentBidderTeamId, price: auction.currentBid };
      newSoldLog.push(entry);
      hammerTeamId = auction.currentBidderTeamId;
      lastSoldEntry = JSON.stringify(entry);
      teamUpdates[auction.currentBidderTeamId] = {
        ...winner,
        purse: winner.purse - auction.currentBid,
        soldPlayers: JSON.stringify([...prev, entry]),
      };
      resultPhrases = [announceSold(player, wi, auction.currentBid)];
      if (store.soundEnabled) { playHammer(); setTimeout(playCrowdCheer, 380); }
    } else {
      newUnsold.push(playerId);
      resultPhrases = [announceUnsold(player)];
      if (store.soundEnabled) playUnsold();
    }

    const nextIdx    = auction.queueIndex + 1;
    const endOfQueue = nextIdx >= queue.length;
    const endOfPool  = !isRapid && isLastInPool(pools, auction.queueIndex);

    let nextPhase: AuctionData['phase'] = auction.phase;
    let newQueueIdx  = nextIdx;
    let newPoolIdx   = auction.currentPoolIdx;
    let poolBreakEnd = 0;
    let newQueue     = queue;
    let nextPhrases: string[] = [];
    let dur          = isRapid ? TIMER_RAPID : TIMER_NORMAL;

    if (endOfQueue) {
      if (!isRapid && newUnsold.length > 0) {
        nextPhase   = 'rapid';
        newQueue    = [...newUnsold];
        newUnsold   = [];
        newQueueIdx = 0;
        dur         = TIMER_RAPID;
        const fp    = getPlayerById(newQueue[0]);
        nextPhrases = [announceRapid(), fp ? announcePlayer(fp) : ''];
      } else {
        nextPhase   = 'finished';
        nextPhrases = ['The IPL Auction 2025 is now complete! Thank you!'];
      }
    } else if (endOfPool) {
      nextPhase    = 'break';
      poolBreakEnd = Date.now() + BREAK_DURATION;
      newPoolIdx   = auction.currentPoolIdx + 1;
      const np     = pools[newPoolIdx];
      nextPhrases  = [np ? announceBreak(np.label) : 'Pool complete! Short break.'];
    } else {
      const np    = getPlayerById(queue[nextIdx]);
      const curP  = getPoolForIndex(pools, auction.queueIndex);
      const nxtP  = getPoolForIndex(pools, nextIdx);
      nextPhrases = (nxtP && curP && nxtP.name !== curP.name)
        ? [announcePool(nxtP.label), np ? announcePlayer(np) : '']
        : [np ? announcePlayer(np) : ''];
    }

    const nextPId      = newQueueIdx < newQueue.length ? newQueue[newQueueIdx] : null;
    const nextBase     = nextPId ? (getPlayerById(nextPId)?.basePrice ?? 0) : 0;

    const aP: Partial<AuctionData> = {
      phase:               nextPhase,
      queue:               JSON.stringify(newQueue),
      queueIndex:          newQueueIdx,
      currentPoolIdx:      newPoolIdx,
      unsoldIds:           JSON.stringify(newUnsold),
      soldLog:             JSON.stringify(newSoldLog),
      currentBid:          nextBase,
      currentBidderTeamId: null,
      biddingStartAt:      0,
      timerEnd:            0,
      poolBreakEnd,
      hammerTeamId,
      bidCount:            0,
      bidHistory:          '[]',
      lastSoldEntry,
      announcement: hammerTeamId
        ? `🔨 SOLD! ${player.name} → ${getTeamById(hammerTeamId).shortName} for ${fmtL(auction.currentBid)}`
        : nextPhase === 'finished' ? '🏆 Auction Complete!'
        : nextPhase === 'break'   ? '⏸️ 1-min break before next pool…'
        : `❌ UNSOLD — ${player.name}`,
      speechText:  [...resultPhrases, ...nextPhrases].filter(Boolean).join(' … '),
      speechSeq:   auction.speechSeq + 1,
    };

    const batch: Record<string, unknown> = {};
    batch[`rooms/${roomId}/auction`] = { ...auction, ...aP };
    for (const [tid, ts] of Object.entries(teamUpdates)) {
      batch[`rooms/${roomId}/teams/${tid}`] = ts;
    }
    await update(ref(db), batch);

    if (nextPhase === 'auction' || nextPhase === 'rapid') {
      await new Promise(r => setTimeout(r, POST_RESULT_GAP));
      await speakAndOpen([...resultPhrases, ...nextPhrases].filter(Boolean), roomId, dur);
    } else if (store.soundEnabled) {
      // Speak result (sold/unsold) — fire and forget
      speakChain(resultPhrases, { rate: 0.88 }).catch(() => {});
    }
  };

  // ── Start next pool after break ───────────────────────────────────────
  const startNextPool = async (data: RoomData): Promise<void> => {
    const { roomId } = useGameStore.getState();
    if (!roomId) return;
    const { auction } = data;
    const pools = sp<PoolMeta[]>(auction.pools, []);
    const queue = sp<string[]>(auction.queue, []);
    const pool  = pools[auction.currentPoolIdx];
    if (!pool) return;

    // Safety: pool.start must be within queue
    if (pool.start >= queue.length) {
      console.error('startNextPool: pool.start out of bounds', pool.start, queue.length);
      return;
    }
    const fp      = getPlayerById(queue[pool.start]);
    const phrases = [announcePool(pool.label), fp ? announcePlayer(fp) : ''].filter(Boolean);

    // ── FIX: Write FULL open state immediately — don't wait for speech ──
    // Speech is fire-and-forget so a TTS failure can never freeze the game
    const announceMs = 14_000; // 14s for auctioneer to finish speaking
    const now        = Date.now();
    const biddingAt  = now + announceMs;
    const timerEnds  = biddingAt + TIMER_NORMAL;

    await update(ref(db, `rooms/${roomId}/auction`), {
      phase:               'auction',
      queueIndex:          pool.start,
      currentBid:          fp?.basePrice ?? 0,
      currentBidderTeamId: null,
      biddingStartAt:      biddingAt,   // ← set immediately, not after speech
      timerEnd:            timerEnds,   // ← set immediately
      poolBreakEnd:        0,           // ← clear break
      hammerTeamId:        null,
      bidCount:            0,
      bidHistory:          '[]',
      lastSoldEntry:       'null',
      announcement:        `▶️ ${pool.label} — ${fp?.name ?? ''}`,
      speechText:          phrases.join(' … '),
      speechSeq:           auction.speechSeq + 1,
    });

    // Fire-and-forget TTS — game continues even if this fails/hangs
    if (useGameStore.getState().soundEnabled) {
      speakChain(phrases, { rate: 0.88 }).catch(() => {});
    }
  };

  // ── Simulate: skip one pool instantly (debug) ─────────────────────────
  const simulatePool = useCallback(async () => {
    const { roomId, roomData } = store;
    if (!roomId || !roomData) return;
    // Reset all locks so simulation is never blocked by a stuck timer
    processing.current      = false;
    breakProcessing.current = false;

    const { auction, teams } = roomData;
    const queue   = sp<string[]>(auction.queue, []);
    const pools   = sp<PoolMeta[]>(auction.pools, []);
    const soldLog = sp<SoldEntry[]>(auction.soldLog, []);
    const curPool = pools.find(p => auction.queueIndex >= p.start && auction.queueIndex < p.end);
    if (!curPool) return;

    const batch: Record<string, unknown> = {};
    const newSoldLog = [...soldLog];
    const newTeams: Record<string, TeamState> = JSON.parse(JSON.stringify(teams));

    // Sell remaining players in pool to random AI teams with realistic prices
    for (let i = auction.queueIndex; i < curPool.end; i++) {
      const pid = queue[i];
      const pl  = getPlayerById(pid);
      if (!pl) continue;
      if (Math.random() < 0.15) continue; // ~15% chance unsold
      const eligible = Object.entries(newTeams).filter(([, t]) => t.isAI && t.purse >= pl.basePrice);
      if (eligible.length === 0) continue;
      const [tid] = eligible[Math.floor(Math.random() * eligible.length)];
      const extraBids = Math.floor(Math.random() * 8);
      let price = pl.basePrice;
      for (let b = 0; b < extraBids; b++) {
        const next = price + (price < 100 ? 5 : price < 200 ? 10 : price < 500 ? 20 : 25);
        if (next > newTeams[tid].purse) break;
        price = next;
      }
      const prev = sp<SoldEntry[]>(newTeams[tid].soldPlayers, []);
      newTeams[tid] = { ...newTeams[tid], purse: newTeams[tid].purse - price, soldPlayers: JSON.stringify([...prev, { playerId: pid, teamId: tid, price }]) };
      newSoldLog.push({ playerId: pid, teamId: tid, price });
    }

    const curPoolIdx  = pools.indexOf(curPool);
    const nextPoolIdx = curPoolIdx + 1;
    const nextPool    = pools[nextPoolIdx];
    const nextPhase: AuctionData['phase'] = nextPool ? 'break' : (sp<string[]>(auction.unsoldIds,[]).length > 0 ? 'rapid' : 'finished');
    const BREAK_MS = 4000; // 4s break for simulation
    const poolBreakEnd = nextPhase === 'break' ? Date.now() + BREAK_MS : 0;

    for (const [tid, ts] of Object.entries(newTeams)) batch[`rooms/${roomId}/teams/${tid}`] = ts;
    batch[`rooms/${roomId}/auction`] = {
      ...auction,
      phase: nextPhase,
      queueIndex:     nextPool ? nextPool.start : queue.length,
      currentPoolIdx: nextPool ? nextPoolIdx : curPoolIdx, // never go out of bounds
      soldLog: JSON.stringify(newSoldLog),
      currentBid: 0, currentBidderTeamId: null,
      biddingStartAt: 0, timerEnd: 0,
      poolBreakEnd,
      hammerTeamId: null, bidCount: 0, bidHistory: '[]', lastSoldEntry: 'null',
      announcement: nextPhase === 'break'
        ? `⏸️ Pool done — ${nextPool?.label} starts in ${BREAK_MS/1000}s`
        : nextPhase === 'finished' ? '🏆 All pools done!' : '⚡ Starting Rapid Round!',
      speechText: '', speechSeq: auction.speechSeq + 1,
    };
    await update(ref(db), batch);

    // For simulate: directly call startNextPool after break via fresh Firebase read
    if (nextPhase === 'break' && nextPool) {
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      const snapRoomId = roomId;
      safetyTimer.current = setTimeout(async () => {
        if (breakProcessing.current) return;
        breakProcessing.current = true;
        try {
          const snap = await get(ref(db, `rooms/${snapRoomId}`));
          const fresh = snap.val() as RoomData | null;
          if (fresh && fresh.auction.phase === 'break') {
            await startNextPool(fresh);
          }
        } catch(e) {
          console.error('safetyTimer startNextPool failed', e);
        } finally {
          breakProcessing.current = false;
        }
      }, BREAK_MS + 600);
    }
  }, [store.roomId, store.roomData]);

  const simulateAll = useCallback(async () => {
    const { roomId, roomData } = store;
    if (!roomId || !roomData) return;
    processing.current      = false;
    breakProcessing.current = false;
    const { auction, teams } = roomData;
    const queue   = sp<string[]>(auction.queue, []);
    const soldLog = sp<SoldEntry[]>(auction.soldLog, []);
    const batch: Record<string, unknown> = {};
    const newSoldLog = [...soldLog];
    const newTeams   = { ...teams };

    for (const pid of queue) {
      const pl = getPlayerById(pid);
      if (!pl) continue;
      const aiEntries = Object.entries(newTeams).filter(([, t]) => (t as TeamState).isAI && (t as TeamState).purse >= pl.basePrice);
      if (aiEntries.length === 0) continue;
      if (Math.random() < 0.2) continue; // ~20% unsold
      const [tid] = aiEntries[Math.floor(Math.random() * aiEntries.length)];
      const price = pl.basePrice + getNextBid(pl.basePrice) * Math.floor(Math.random() * 5);
      const clamped = Math.min(price, (newTeams[tid] as TeamState).purse);
      const prev = sp<SoldEntry[]>((newTeams[tid] as TeamState).soldPlayers, []);
      newTeams[tid] = { ...(newTeams[tid] as TeamState), purse: (newTeams[tid] as TeamState).purse - clamped, soldPlayers: JSON.stringify([...prev, { playerId: pid, teamId: tid, price: clamped }]) };
      newSoldLog.push({ playerId: pid, teamId: tid, price: clamped });
    }

    for (const [tid, ts] of Object.entries(newTeams)) batch[`rooms/${roomId}/teams/${tid}`] = ts;
    batch[`rooms/${roomId}/auction`] = {
      ...auction, phase: 'finished', soldLog: JSON.stringify(newSoldLog),
      unsoldIds: '[]', currentBid: 0, currentBidderTeamId: null,
      biddingStartAt: 0, timerEnd: 0, poolBreakEnd: 0,
      announcement: '🏆 Simulation complete!', speechText: '', speechSeq: auction.speechSeq + 1,
    };
    await update(ref(db), batch);
  }, [store.roomId, store.roomData]);

  // ── Public actions ─────────────────────────────────────────────────────

  const createRoom = useCallback(async (playerName: string) => {
    if (!store.uid) return;
    store.setLoading(true); store.setMyName(playerName);
    const roomId = genCode();
    const { queue, pools } = buildPooledQueue();
    const teams: Record<string, TeamState> = {};
    IPL_TEAMS.forEach(t => {
      teams[t.id] = {
        purse: SQUAD_RULES.startingPurse, soldPlayers: '[]', isAI: true,
        ownerUid: null, ownerName: null,
        aiStrategy: (['aggressive', 'conservative', 'balanced'] as const)[Math.floor(Math.random() * 3)],
      };
    });
    const fp = getPlayerById(queue[0]);
    await set(ref(db, `rooms/${roomId}`), {
      meta: { hostId: store.uid, hostOnline: true, started: false, createdAt: Date.now() },
      participants: { [store.uid]: { name: playerName, teamId: null, isSpectator: false, lastSeen: Date.now() } },
      teams, chat: {},
      auction: {
        phase: 'waiting', queue: JSON.stringify(queue), pools: JSON.stringify(pools),
        currentPoolIdx: 0, queueIndex: 0, unsoldIds: '[]', soldLog: '[]',
        currentBid: fp?.basePrice ?? 200, currentBidderTeamId: null,
        biddingStartAt: 0, timerEnd: 0, poolBreakEnd: 0,
        announcement: 'Welcome to IPL Auction 2025!', speechText: '', speechSeq: 0,
        hammerTeamId: null, bidCount: 0, bidHistory: '[]', lastSoldEntry: 'null',
      },
    });
    store.setRoomId(roomId); store.setIsHost(true); store.setScreen('lobby'); store.setLoading(false);
  }, [store.uid]);

  const joinRoom = useCallback(async (code: string, playerName: string) => {
    if (!store.uid) return;
    store.setLoading(true); store.setMyName(playerName);
    const roomId = code.toUpperCase().trim();
    const snap = await get(ref(db, `rooms/${roomId}`));
    if (!snap.exists()) { store.setError('Room not found!'); store.setLoading(false); return; }
    const roomData = snap.val() as RoomData;

    // ── Session restore ──
    const prev = roomData.participants?.[store.uid];
    const prevTeamId = prev?.teamId ?? null;
    if (roomData.meta.hostId === store.uid) store.setIsHost(true);
    if (prevTeamId && roomData.teams[prevTeamId]?.ownerUid === store.uid) {
      store.setMyTeamId(prevTeamId);
    } else {
      store.setMyTeamId(null);
      if (prevTeamId) await update(ref(db, `rooms/${roomId}/participants/${store.uid}`), { teamId: null });
    }
    if (prev?.isSpectator) store.setIsSpectator(true);

    await update(ref(db, `rooms/${roomId}/participants/${store.uid}`), {
      name: playerName, lastSeen: Date.now(), isSpectator: prev?.isSpectator ?? false,
    });

    store.setRoomId(roomId);
    const ph = roomData.auction.phase;
    if (!roomData.meta.started || ph === 'waiting') store.setScreen('lobby');
    else if (ph === 'break') store.setScreen('break' as any);
    else if (ph === 'finished') store.setScreen('scoreboard');
    else store.setScreen('auction');
    store.setLoading(false);
  }, [store.uid]);

  const selectTeam = useCallback(async (teamId: string) => {
    const { roomId, uid, myName, myTeamId } = store;
    if (!roomId || !uid) return;
    store.setError(null);
    let claimed = false;
    try {
      await runTransaction(ref(db, `rooms/${roomId}/teams/${teamId}`), (td: TeamState | null) => {
        if (!td) return td;
        if (!td.isAI && td.ownerUid && td.ownerUid !== uid) return; // abort
        claimed = true;
        return { ...td, isAI: false, ownerUid: uid, ownerName: myName };
      });
    } catch { store.setError('Failed to claim team. Try again.'); return; }

    if (!claimed) { store.setError('⚡ Team just taken! Pick another.'); return; }

    if (myTeamId && myTeamId !== teamId) {
      await runTransaction(ref(db, `rooms/${roomId}/teams/${myTeamId}`), (td: TeamState | null) => {
        if (!td || td.ownerUid !== uid) return td;
        return { ...td, isAI: true, ownerUid: null, ownerName: null };
      });
    }
    await update(ref(db, `rooms/${roomId}/participants/${uid}`), { teamId });
    store.setMyTeamId(teamId);
  }, [store.roomId, store.uid, store.myTeamId, store.myName]);

  const joinAsSpectator = useCallback(async () => {
    const { roomId, uid, myTeamId } = store;
    if (!roomId || !uid) return;
    if (myTeamId) {
      await runTransaction(ref(db, `rooms/${roomId}/teams/${myTeamId}`), (td: TeamState | null) => {
        if (!td || td.ownerUid !== uid) return td;
        return { ...td, isAI: true, ownerUid: null, ownerName: null };
      });
      store.setMyTeamId(null);
    }
    await update(ref(db, `rooms/${roomId}/participants/${uid}`), { isSpectator: true, teamId: null });
    store.setIsSpectator(true);
  }, [store.roomId, store.uid, store.myTeamId]);

  const startGame = useCallback(async () => {
    const { roomId, roomData } = store;
    if (!roomId || !roomData) return;
    const pools = sp<PoolMeta[]>(roomData.auction.pools, []);
    const queue = sp<string[]>(roomData.auction.queue, []);
    const pool0 = pools[0];
    const fp    = pool0 ? getPlayerById(queue[pool0.start]) : null;
    const phrases = [announcePool(pool0?.label ?? ''), fp ? announcePlayer(fp) : ''].filter(Boolean);
    await update(ref(db, `rooms/${roomId}`), {
      'meta/started': true, 'auction/phase': 'auction',
      'auction/biddingStartAt': 0, 'auction/timerEnd': 0,
      'auction/currentBid': fp?.basePrice ?? 200,
      'auction/bidHistory': '[]', 'auction/lastSoldEntry': 'null',
      'auction/announcement': pool0 ? `▶️ ${pool0.label} — Starting!` : 'Auction started!',
      'auction/speechText': phrases.join(' … '), 'auction/speechSeq': 1,
    });
    await new Promise(r => setTimeout(r, 400));
    await speakAndOpen(phrases, roomId, TIMER_NORMAL);
  }, [store.roomId, store.roomData, speakAndOpen]);

  const placeBid = useCallback(async (amount: number) => {
    const { roomId, myTeamId, roomData } = store;
    if (!roomId || !myTeamId || !roomData) return;
    const { auction, teams } = roomData;
    if (auction.biddingStartAt === 0 || Date.now() < auction.biddingStartAt) return;
    const team = teams[myTeamId];
    if (!team || team.purse < amount) return;
    const ti     = getTeamById(myTeamId);
    const newEnd = Math.max(auction.timerEnd, Date.now() + TIMER_EXTEND);
    const hist   = sp<BidHistoryEntry[]>(auction.bidHistory, []);
    await update(ref(db, `rooms/${roomId}/auction`), {
      currentBid: amount, currentBidderTeamId: myTeamId,
      bidCount: auction.bidCount + 1, timerEnd: newEnd,
      announcement: `💰 ${ti.shortName} bids ${fmtL(amount)}!`,
      speechText: `${ti.shortName} bids ${fmtL(amount)}!`,
      speechSeq: auction.speechSeq + 1,
      bidHistory: JSON.stringify([...hist, { teamId: myTeamId, amount, ts: Date.now() }]),
    });
  }, [store.roomId, store.myTeamId, store.roomData]);

  const sendChat = useCallback(async (text: string, isReaction = false) => {
    const { roomId, uid, myName } = store;
    if (!roomId || !uid) return;
    const msg: ChatMessage = { id: '', uid, name: myName, text, ts: Date.now(), isReaction };
    await push(ref(db, `rooms/${roomId}/chat`), msg);
  }, [store.roomId, store.uid, store.myName]);

  return { createRoom, joinRoom, selectTeam, joinAsSpectator, startGame, placeBid, sendChat, simulatePool, simulateAll };
}
