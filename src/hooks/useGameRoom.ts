import { useEffect, useRef, useCallback } from 'react';
import { ref, set, update, onValue, off, get } from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase/config';
import { useGameStore } from '../store/useGameStore';
import { getPlayerById } from '../data/players';
import { buildPooledQueue, getPoolForIndex, isLastInPool } from '../utils/poolBuilder';
import { IPL_TEAMS, getTeamById } from '../data/teams';
import { computeAIBid } from '../utils/aiPlayer';
import { SoldEntry, RoomData, SQUAD_RULES, AuctionData, TeamState, PoolMeta } from '../types';
import { playHammer, playBidPlaced, playCrowdCheer, playTimerTick, playUnsold, playNewPlayer } from '../utils/sounds';
import { speak, announcePool, announcePlayer, announceSold, announceUnsold, announceBreak, announceRapid } from '../utils/speech';

/* ── Constants ─────────────────────────────────────────────────────────────── */
const ANNOUNCE_DELAY = 15_000; // ms before bidding opens after announcement
const TIMER_NORMAL   = 25_000; // bidding window
const TIMER_RAPID    = 12_000;
const TIMER_EXTEND   = 8_000;  // extend on new bid if < this
const BREAK_DURATION = 60_000;
const TRANSITION_GAP = 2_000;  // pause between players

function genCode(): string { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
function fmtL(l: number): string { return l >= 100 ? `₹${(l / 100).toFixed(2)} Cr` : `₹${l}L`; }
function safeParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

/* ── Hook ───────────────────────────────────────────────────────────────────── */
export function useGameRoom() {
  const store = useGameStore();

  // host-only intervals
  const mainTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiTickRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // edge-detection refs
  const prevSpeechSeq   = useRef(-1);
  const prevBidCount    = useRef(-1);
  const prevQueueIdx    = useRef(-1);
  const prevPhase       = useRef('');
  const goingOnce       = useRef(false);
  const goingTwice      = useRef(false);
  const processingTimer = useRef(false); // prevent double-fire

  /* ── Auth ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return onAuthStateChanged(auth, u => {
      if (u) store.setUid(u.uid);
      else signInAnonymously(auth).catch(console.error);
    });
  }, []);

  /* ── Room subscription (all clients) ─────────────────────────────────── */
  useEffect(() => {
    const { roomId } = store;
    if (!roomId || !isFirebaseConfigured()) return;
    const roomRef = ref(db, `rooms/${roomId}`);

    const handler = onValue(roomRef, snap => {
      const data = snap.val() as RoomData | null;
      if (!data) return;
      store.setRoomData(data);

      const { auction } = data;
      // screen routing
      if (auction.phase === 'break')    store.setScreen('break' as any);
      else if (['auction','rapid'].includes(auction.phase)) store.setScreen('auction');
      else if (auction.phase === 'finished') store.setScreen('scoreboard');

      // TTS — trigger on every client when speechSeq changes
      if (auction.speechSeq !== prevSpeechSeq.current) {
        prevSpeechSeq.current = auction.speechSeq;
        if (store.soundEnabled && auction.speechText) speak(auction.speechText);
      }

      // Sound FX
      if (store.soundEnabled) {
        if (auction.bidCount !== prevBidCount.current && prevBidCount.current >= 0) playBidPlaced();
        if (auction.queueIndex !== prevQueueIdx.current && prevQueueIdx.current >= 0) {
          if (auction.hammerTeamId) { playHammer(); setTimeout(playCrowdCheer, 350); }
          else if (auction.phase !== 'break') playNewPlayer();
        }
        if (auction.phase === 'rapid' && prevPhase.current !== 'rapid') playNewPlayer();
      }

      prevBidCount.current  = auction.bidCount;
      prevQueueIdx.current  = auction.queueIndex;
      prevPhase.current     = auction.phase;
    });

    return () => off(roomRef, 'value', handler as any);
  }, [store.roomId]);

  /* ── HOST: main timer loop ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;
    if (mainTimerRef.current) clearInterval(mainTimerRef.current);

    mainTimerRef.current = setInterval(() => {
      const data = useGameStore.getState().roomData;
      if (!data) return;
      const { auction } = data;
      if (!['auction', 'rapid'].includes(auction.phase)) return;

      const now      = Date.now();
      const timeLeft = Math.ceil((auction.timerEnd - now) / 1000);

      // going once / going twice announcements (host only, local speak)
      if (timeLeft <= 8 && timeLeft > 4 && !goingOnce.current && auction.bidCount > 0) {
        goingOnce.current = true;
        if (store.soundEnabled) speak(`Going once… at ${fmtL(auction.currentBid)}!`, 0.85);
      }
      if (timeLeft <= 4 && timeLeft > 1 && !goingTwice.current && auction.bidCount > 0) {
        goingTwice.current = true;
        if (store.soundEnabled) speak('Going twice!', 0.85);
      }

      // timer tick sounds
      if (timeLeft <= 5 && timeLeft > 0 && store.soundEnabled) playTimerTick(timeLeft <= 2);

      // timer expired
      if (now >= auction.timerEnd && !processingTimer.current) {
        processingTimer.current = true;
        goingOnce.current  = false;
        goingTwice.current = false;
        handleTimerExpired(data).finally(() => {
          processingTimer.current = false;
        });
      }
    }, 400);

    return () => { if (mainTimerRef.current) clearInterval(mainTimerRef.current); };
  }, [store.isHost, store.roomId]);

  /* ── HOST: break countdown ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);

    breakTimerRef.current = setInterval(() => {
      const data = useGameStore.getState().roomData;
      if (!data || data.auction.phase !== 'break') return;
      if (Date.now() >= data.auction.poolBreakEnd) {
        clearInterval(breakTimerRef.current!);
        startNextPool(data);
      }
    }, 800);

    return () => { if (breakTimerRef.current) clearInterval(breakTimerRef.current); };
  }, [store.isHost, store.roomId]);

  /* ── HOST: AI bidder tick ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;
    if (aiTickRef.current) clearInterval(aiTickRef.current);

    aiTickRef.current = setInterval(() => {
      const data = useGameStore.getState().roomData;
      if (!data) return;
      const { auction, teams } = data;
      if (!['auction', 'rapid'].includes(auction.phase)) return;

      // Don't bid during announcement window
      if (Date.now() < auction.biddingStartAt) return;

      const queue = safeParse<string[]>(auction.queue, []);
      const playerId = queue[auction.queueIndex];
      if (!playerId) return;
      const player = getPlayerById(playerId);
      if (!player) return;

      const timeLeft = auction.timerEnd - Date.now();
      if (timeLeft < 1500) return; // don't bid in last 1.5s

      const aiTeams = Object.entries(teams)
        .filter(([id, t]) => t.isAI && id !== auction.currentBidderTeamId)
        .sort(() => Math.random() - 0.5);

      for (const [teamId, team] of aiTeams) {
        const dec = computeAIBid(team, player, auction.currentBid, team.aiStrategy);
        if (dec.shouldBid) {
          const ti = getTeamById(teamId);
          const newEnd = Math.max(auction.timerEnd, Date.now() + TIMER_EXTEND);
          update(ref(db, `rooms/${store.roomId}/auction`), {
            currentBid: dec.amount,
            currentBidderTeamId: teamId,
            bidCount: auction.bidCount + 1,
            timerEnd: newEnd,
            announcement: `🤖 ${ti.shortName} bids ${fmtL(dec.amount)}!`,
            speechText: `${ti.shortName} bids ${fmtL(dec.amount)}!`,
            speechSeq: auction.speechSeq + 1,
          });
          break;
        }
      }
    }, 2500);

    return () => { if (aiTickRef.current) clearInterval(aiTickRef.current); };
  }, [store.isHost, store.roomId]);

  /* ── Timer expired ─────────────────────────────────────────────────────── */
  const handleTimerExpired = async (data: RoomData): Promise<void> => {
    const { roomId } = useGameStore.getState();
    if (!roomId) return;

    const { auction, teams } = data;
    const queue    = safeParse<string[]>(auction.queue, []);
    const pools    = safeParse<PoolMeta[]>(auction.pools, []);
    const unsoldIds= safeParse<string[]>(auction.unsoldIds, []);
    const soldLog  = safeParse<SoldEntry[]>(auction.soldLog, []);
    const isRapid  = auction.phase === 'rapid';

    const playerId = queue[auction.queueIndex];
    if (!playerId) return; // safety guard

    const player = getPlayerById(playerId);
    if (!player) return;

    let newUnsold  = [...unsoldIds];
    let newSoldLog = [...soldLog];
    let hammerTeamId: string | null = null;
    const teamUpdates: Record<string, TeamState> = {};
    let speechText   = '';
    let announcement = '';

    // ── Sold or Unsold decision ──
    if (auction.currentBidderTeamId && auction.currentBid >= player.basePrice) {
      const winner     = teams[auction.currentBidderTeamId];
      const winnerInfo = getTeamById(auction.currentBidderTeamId);
      const prevSold   = safeParse<SoldEntry[]>(winner?.soldPlayers ?? '[]', []);
      const entry: SoldEntry = { playerId, teamId: auction.currentBidderTeamId, price: auction.currentBid };
      newSoldLog.push(entry);
      hammerTeamId = auction.currentBidderTeamId;
      teamUpdates[auction.currentBidderTeamId] = {
        ...winner,
        purse: winner.purse - auction.currentBid,
        soldPlayers: JSON.stringify([...prevSold, entry]),
      };
      announcement = `🔨 SOLD! ${player.name} → ${winnerInfo.shortName} for ${fmtL(auction.currentBid)}`;
      speechText   = announceSold(player, winnerInfo, auction.currentBid);
      if (store.soundEnabled) { playHammer(); setTimeout(playCrowdCheer, 350); }
    } else {
      newUnsold.push(playerId);
      announcement = `❌ UNSOLD — ${player.name}`;
      speechText   = announceUnsold(player);
      if (store.soundEnabled) { playUnsold(); }
    }

    // ── Figure out what comes next ──
    const nextIdx     = auction.queueIndex + 1;
    const endOfQueue  = nextIdx >= queue.length;
    const endOfPool   = !isRapid && isLastInPool(pools, auction.queueIndex);

    let nextPhase: AuctionData['phase']  = auction.phase;
    let newQueueIdx    = nextIdx;
    let newPoolIdx     = auction.currentPoolIdx;
    let poolBreakEnd   = 0;
    let newQueue       = queue;
    let biddingStartAt = 0;
    let nextTimerEnd   = 0;
    let nextSpeech     = '';
    let nextAnnounce   = '';

    if (endOfQueue) {
      if (!isRapid && newUnsold.length > 0) {
        // Kick off rapid round
        nextPhase    = 'rapid';
        newQueue     = [...newUnsold];
        newUnsold    = [];
        newQueueIdx  = 0;
        const fp     = getPlayerById(newQueue[0]);
        const rs     = announceRapid();
        const ps     = fp ? announcePlayer(fp) : '';
        nextSpeech   = [rs, ps].filter(Boolean).join(' … ');
        nextAnnounce = '⚡ RAPID ROUND — Unsold players!';
        biddingStartAt = Date.now() + TRANSITION_GAP + ANNOUNCE_DELAY;
        nextTimerEnd   = biddingStartAt + TIMER_RAPID;
      } else {
        nextPhase    = 'finished';
        nextAnnounce = '🏆 Auction Complete!';
        nextSpeech   = 'The IPL Auction is now complete! Thank you for participating!';
      }
    } else if (endOfPool) {
      nextPhase      = 'break';
      poolBreakEnd   = Date.now() + BREAK_DURATION;
      newPoolIdx     = auction.currentPoolIdx + 1;
      const np       = pools[newPoolIdx];
      nextAnnounce   = `⏸️ Break — ${np?.label ?? 'next pool'} starts in 1 min`;
      nextSpeech     = np ? announceBreak(np.label) : 'Pool complete! Short break.';
    } else {
      // Normal next player
      const np = getPlayerById(queue[nextIdx]);
      if (np) {
        const poolSpeech   = '';
        const playerSpeech = announcePlayer(np);
        nextSpeech   = [poolSpeech, playerSpeech].filter(Boolean).join(' … ');
        nextAnnounce = `🎙️ Up next: ${np.name}`;
      }
      biddingStartAt = Date.now() + TRANSITION_GAP + ANNOUNCE_DELAY;
      nextTimerEnd   = biddingStartAt + (isRapid ? TIMER_RAPID : TIMER_NORMAL);
    }

    const auctionPatch: Partial<AuctionData> = {
      phase:              nextPhase,
      queue:              JSON.stringify(newQueue),
      queueIndex:         newQueueIdx,
      currentPoolIdx:     newPoolIdx,
      unsoldIds:          JSON.stringify(newUnsold),
      soldLog:            JSON.stringify(newSoldLog),
      currentBid:         newQueueIdx < newQueue.length
                            ? (getPlayerById(newQueue[newQueueIdx])?.basePrice ?? 0)
                            : 0,
      currentBidderTeamId: null,
      biddingStartAt,
      timerEnd:           nextTimerEnd,
      poolBreakEnd,
      hammerTeamId,
      bidCount:           0,
      announcement:       nextAnnounce || announcement,
      speechText:         [speechText, nextSpeech].filter(Boolean).join(' … '),
      speechSeq:          auction.speechSeq + 1,
    };

    const batch: Record<string, unknown> = {};
    batch[`rooms/${roomId}/auction`] = { ...auction, ...auctionPatch };
    for (const [tid, ts] of Object.entries(teamUpdates)) {
      batch[`rooms/${roomId}/teams/${tid}`] = ts;
    }
    await update(ref(db), batch);
  };

  /* ── Start next pool after break ──────────────────────────────────────── */
  const startNextPool = async (data: RoomData) => {
    const { roomId } = useGameStore.getState();
    if (!roomId) return;
    const { auction } = data;
    const pools   = safeParse<PoolMeta[]>(auction.pools, []);
    const queue   = safeParse<string[]>(auction.queue, []);
    const pool    = pools[auction.currentPoolIdx];
    if (!pool) return;

    const firstId  = queue[pool.start];
    const fp       = firstId ? getPlayerById(firstId) : null;
    const poolSpch = announcePool(pool.label);
    const plrSpch  = fp ? announcePlayer(fp) : '';
    const combined = [poolSpch, plrSpch].filter(Boolean).join(' … ');
    const bidStart = Date.now() + ANNOUNCE_DELAY;

    await update(ref(db, `rooms/${roomId}/auction`), {
      phase:              'auction',
      queueIndex:         pool.start,
      currentBid:         fp?.basePrice ?? 0,
      currentBidderTeamId: null,
      biddingStartAt:     bidStart,
      timerEnd:           bidStart + TIMER_NORMAL,
      poolBreakEnd:       0,
      hammerTeamId:       null,
      bidCount:           0,
      announcement:       `▶️ ${pool.label} — ${fp?.name ?? ''}`,
      speechText:         combined,
      speechSeq:          auction.speechSeq + 1,
    });
  };

  /* ── Public actions ────────────────────────────────────────────────────── */
  const createRoom = useCallback(async (playerName: string) => {
    if (!store.uid) return;
    store.setLoading(true);
    store.setMyName(playerName);
    const roomId = genCode();
    const { queue, pools } = buildPooledQueue();

    const teams: Record<string, TeamState> = {};
    IPL_TEAMS.forEach(t => {
      teams[t.id] = {
        purse: SQUAD_RULES.startingPurse,
        soldPlayers: '[]',
        isAI: true,
        ownerUid: null,
        ownerName: null,
        aiStrategy: (['aggressive', 'conservative', 'balanced'] as const)[Math.floor(Math.random() * 3)],
      };
    });

    const fp = getPlayerById(queue[0]);
    const roomData: RoomData = {
      meta: { hostId: store.uid, hostOnline: true, started: false, createdAt: Date.now() },
      participants: { [store.uid]: { name: playerName, teamId: null, isSpectator: false, lastSeen: Date.now() } },
      teams,
      auction: {
        phase: 'waiting',
        queue: JSON.stringify(queue),
        pools: JSON.stringify(pools),
        currentPoolIdx: 0,
        queueIndex: 0,
        unsoldIds: '[]',
        soldLog: '[]',
        currentBid: fp?.basePrice ?? 200,
        currentBidderTeamId: null,
        biddingStartAt: 0,
        timerEnd: 0,
        poolBreakEnd: 0,
        announcement: 'Welcome to IPL Auction 2025!',
        speechText: '',
        speechSeq: 0,
        hammerTeamId: null,
        bidCount: 0,
      },
    };
    await set(ref(db, `rooms/${roomId}`), roomData);
    store.setRoomId(roomId);
    store.setIsHost(true);
    store.setScreen('lobby');
    store.setLoading(false);
  }, [store.uid]);

  const joinRoom = useCallback(async (code: string, playerName: string) => {
    if (!store.uid) return;
    store.setLoading(true);
    store.setMyName(playerName);
    const roomId = code.toUpperCase().trim();
    const snap = await get(ref(db, `rooms/${roomId}`));
    if (!snap.exists()) { store.setError('Room not found!'); store.setLoading(false); return; }
    await update(ref(db, `rooms/${roomId}/participants/${store.uid}`), {
      name: playerName, teamId: null, isSpectator: false, lastSeen: Date.now(),
    });
    store.setRoomId(roomId);
    store.setScreen('lobby');
    store.setLoading(false);
  }, [store.uid]);

  const selectTeam = useCallback(async (teamId: string) => {
    const { roomId, uid, myName, myTeamId } = store;
    if (!roomId || !uid) return;
    const snap = await get(ref(db, `rooms/${roomId}/teams/${teamId}`));
    const team = snap.val() as TeamState | null;
    if (!team) return;
    if (!team.isAI && team.ownerUid && team.ownerUid !== uid) {
      store.setError('Team already taken!'); return;
    }
    if (myTeamId) {
      await update(ref(db, `rooms/${roomId}/teams/${myTeamId}`), { isAI: true, ownerUid: null, ownerName: null });
    }
    await update(ref(db, `rooms/${roomId}/teams/${teamId}`), { isAI: false, ownerUid: uid, ownerName: myName });
    await update(ref(db, `rooms/${roomId}/participants/${uid}`), { teamId });
    store.setMyTeamId(teamId);
  }, [store.roomId, store.uid, store.myTeamId, store.myName]);

  const joinAsSpectator = useCallback(async () => {
    const { roomId, uid } = store;
    if (!roomId || !uid) return;
    await update(ref(db, `rooms/${roomId}/participants/${uid}`), { isSpectator: true, teamId: null });
    store.setIsSpectator(true);
    store.setMyTeamId(null);
  }, [store.roomId, store.uid]);

  const startGame = useCallback(async () => {
    const { roomId, roomData } = store;
    if (!roomId || !roomData) return;
    const pools = safeParse<PoolMeta[]>(roomData.auction.pools, []);
    const queue = safeParse<string[]>(roomData.auction.queue, []);
    const pool0  = pools[0];
    const fp     = pool0 ? getPlayerById(queue[pool0.start]) : null;
    const bidStart = Date.now() + ANNOUNCE_DELAY;

    await update(ref(db, `rooms/${roomId}`), {
      'meta/started': true,
      'auction/phase': 'auction',
      'auction/biddingStartAt': bidStart,
      'auction/timerEnd': bidStart + TIMER_NORMAL,
      'auction/currentBid': fp?.basePrice ?? 200,
      'auction/announcement': pool0 ? `▶️ ${pool0.label} — Starting!` : 'Auction started!',
      'auction/speechText': [
        pool0 ? announcePool(pool0.label) : '',
        fp     ? announcePlayer(fp) : '',
      ].filter(Boolean).join(' … '),
      'auction/speechSeq': 1,
    });
  }, [store.roomId, store.roomData]);

  const placeBid = useCallback(async (amount: number) => {
    const { roomId, myTeamId, roomData } = store;
    if (!roomId || !myTeamId || !roomData) return;
    const { auction, teams } = roomData;
    // Block bids during announcement window
    if (Date.now() < auction.biddingStartAt) return;
    const team = teams[myTeamId];
    if (!team || team.purse < amount) return;
    const ti = getTeamById(myTeamId);
    const newEnd = Math.max(auction.timerEnd, Date.now() + TIMER_EXTEND);
    await update(ref(db, `rooms/${roomId}/auction`), {
      currentBid: amount,
      currentBidderTeamId: myTeamId,
      bidCount: auction.bidCount + 1,
      timerEnd: newEnd,
      announcement: `💰 ${ti.shortName} bids ${fmtL(amount)}!`,
      speechText: `${ti.shortName} bids ${fmtL(amount)}!`,
      speechSeq: auction.speechSeq + 1,
    });
  }, [store.roomId, store.myTeamId, store.roomData]);

  return { createRoom, joinRoom, selectTeam, joinAsSpectator, startGame, placeBid };
}
