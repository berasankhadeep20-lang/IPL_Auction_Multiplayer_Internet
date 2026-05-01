import { useEffect, useRef, useCallback } from 'react';
import { ref, set, update, onValue, off, get } from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase/config';
import { useGameStore } from '../store/useGameStore';
import { getPlayerById } from '../data/players';
import { buildPooledQueue, getPoolForIndex, isLastInPool, PooledQueue } from '../utils/poolBuilder';
import { IPL_TEAMS } from '../data/teams';
import { getTeamById } from '../data/teams';
import { computeAIBid } from '../utils/aiPlayer';
import { SoldEntry, RoomData, SQUAD_RULES, AuctionData, TeamState, PoolMeta } from '../types';
import {
  playHammer, playBidPlaced, playCrowdCheer, playTimerTick, playUnsold, playNewPlayer,
} from '../utils/sounds';
import {
  speak, announcePool, announcePlayer, announceSold, announceUnsold,
  announceBreak, announceRapid,
} from '../utils/speech';

const TIMER_NORMAL  = 25_000;
const TIMER_RAPID   = 12_000;
const TIMER_EXTEND  = 8_000;
const BREAK_DURATION = 60_000;
const GOING_ONCE_AT  = 8;  // seconds left
const GOING_TWICE_AT = 4;

function genRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function fmtL(lakhs: number): string {
  return lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2)} Cr` : `₹${lakhs}L`;
}

export function useGameRoom() {
  const store = useGameStore();
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiTickRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const goingOnceRef    = useRef(false);
  const goingTwiceRef   = useRef(false);
  const prevBidCountRef = useRef(-1);
  const prevQueueIdxRef = useRef(-1);
  const prevSpeechSeq   = useRef(-1);
  const prevPhaseRef    = useRef('');

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return onAuthStateChanged(auth, u => {
      if (u) store.setUid(u.uid);
      else signInAnonymously(auth).catch(console.error);
    });
  }, []);

  // ── Room subscription ────────────────────────────────────────────────────
  useEffect(() => {
    const { roomId } = store;
    if (!roomId || !isFirebaseConfigured()) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, snap => {
      const data = snap.val() as RoomData | null;
      if (!data) return;
      store.setRoomData(data);

      const { auction } = data;
      if (['auction','rapid'].includes(auction.phase)) store.setScreen('auction');
      else if (auction.phase === 'break')    store.setScreen('break' as any);
      else if (auction.phase === 'finished') store.setScreen('scoreboard');

      // TTS for all clients
      if (store.soundEnabled && auction.speechSeq !== prevSpeechSeq.current) {
        prevSpeechSeq.current = auction.speechSeq;
        if (auction.speechText) speak(auction.speechText);
      }

      // Sound FX
      if (store.soundEnabled) {
        if (auction.bidCount !== prevBidCountRef.current && prevBidCountRef.current >= 0) playBidPlaced();
        if (auction.queueIndex !== prevQueueIdxRef.current && prevQueueIdxRef.current >= 0) {
          if (auction.hammerTeamId) { playHammer(); setTimeout(playCrowdCheer, 350); }
          else playNewPlayer();
        }
        if (auction.phase === 'rapid' && prevPhaseRef.current !== 'rapid') playNewPlayer();
      }

      prevBidCountRef.current = auction.bidCount;
      prevQueueIdxRef.current = auction.queueIndex;
      prevPhaseRef.current    = auction.phase;
    });
    return () => off(roomRef, 'value', unsub as any);
  }, [store.roomId]);

  // ── Host: main timer loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;
    timerRef.current = setInterval(() => {
      const data = store.roomData;
      if (!data) return;
      const { auction } = data;
      if (!['auction','rapid'].includes(auction.phase)) return;

      const left = Math.ceil((auction.timerEnd - Date.now()) / 1000);

      // Going once / going twice announcements (client-side for host only)
      if (left <= GOING_ONCE_AT && left > GOING_TWICE_AT && !goingOnceRef.current && auction.bidCount > 0) {
        goingOnceRef.current = true;
        if (store.soundEnabled) speak(`Going once… at ${fmtL(auction.currentBid)}!`, 0.85);
      }
      if (left <= GOING_TWICE_AT && left > 1 && !goingTwiceRef.current && auction.bidCount > 0) {
        goingTwiceRef.current = true;
        if (store.soundEnabled) speak('Going twice!', 0.85);
      }

      if (left <= 4 && store.soundEnabled) playTimerTick(left <= 2);

      if (Date.now() >= auction.timerEnd) {
        clearInterval(timerRef.current!);
        goingOnceRef.current  = false;
        goingTwiceRef.current = false;
        handleTimerExpired(data);
      }
    }, 400);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [store.isHost, store.roomId, store.roomData]);

  // ── Host: break countdown ─────────────────────────────────────────────────
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;
    breakTimerRef.current = setInterval(() => {
      const data = store.roomData;
      if (!data) return;
      const { auction } = data;
      if (auction.phase !== 'break') return;
      if (Date.now() >= auction.poolBreakEnd) {
        clearInterval(breakTimerRef.current!);
        startNextPool(data);
      }
    }, 1000);
    return () => { if (breakTimerRef.current) clearInterval(breakTimerRef.current); };
  }, [store.isHost, store.roomId, store.roomData]);

  // ── Host: AI tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;
    aiTickRef.current = setInterval(() => {
      const data = store.roomData;
      if (!data) return;
      const { auction, teams } = data;
      if (!['auction','rapid'].includes(auction.phase)) return;
      const queue: string[] = JSON.parse(auction.queue || '[]');
      const playerId = queue[auction.queueIndex];
      if (!playerId) return;
      const player = getPlayerById(playerId);
      if (!player) return;
      const timeLeft = auction.timerEnd - Date.now();
      if (timeLeft < 2500 || timeLeft > (auction.phase === 'rapid' ? TIMER_RAPID : TIMER_NORMAL) - 1500) return;

      const aiTeams = Object.entries(teams)
        .filter(([id, t]) => t.isAI && id !== auction.currentBidderTeamId)
        .sort(() => Math.random() - 0.5);

      for (const [teamId, team] of aiTeams) {
        const dec = computeAIBid(team, player, auction.currentBid, team.aiStrategy);
        if (dec.shouldBid) {
          const teamInfo = getTeamById(teamId);
          const newTimerEnd = Math.max(auction.timerEnd, Date.now() + TIMER_EXTEND);
          update(ref(db, `rooms/${store.roomId}/auction`), {
            currentBid: dec.amount,
            currentBidderTeamId: teamId,
            bidCount: (auction.bidCount || 0) + 1,
            timerEnd: newTimerEnd,
            announcement: `🤖 ${teamInfo.shortName} bids ${fmtL(dec.amount)}!`,
            speechText: `${teamInfo.shortName} bids ${fmtL(dec.amount)}!`,
            speechSeq: (auction.speechSeq || 0) + 1,
          });
          break;
        }
      }
    }, 3000);
    return () => { if (aiTickRef.current) clearInterval(aiTickRef.current); };
  }, [store.isHost, store.roomId, store.roomData]);

  // ── Timer expired handler ─────────────────────────────────────────────────
  const handleTimerExpired = async (data: RoomData) => {
    const { roomId } = store;
    if (!roomId) return;
    const { auction, teams } = data;
    const queue: string[]     = JSON.parse(auction.queue || '[]');
    const pools: PoolMeta[]   = JSON.parse(auction.pools || '[]');
    const unsoldIds: string[] = JSON.parse(auction.unsoldIds || '[]');
    const soldLog: SoldEntry[]= JSON.parse(auction.soldLog || '[]');
    const playerId = queue[auction.queueIndex];
    const player   = getPlayerById(playerId);
    if (!player) return;

    let newUnsold  = [...unsoldIds];
    let newSoldLog = [...soldLog];
    let hammerTeamId: string | null = null;
    const newTeams: Record<string, TeamState> = {};
    let speechText = '';
    let announcement = '';

    if (auction.currentBidderTeamId && auction.currentBid >= player.basePrice) {
      const winnerTeam = teams[auction.currentBidderTeamId];
      const winnerInfo = getTeamById(auction.currentBidderTeamId);
      const prevSold: SoldEntry[] = JSON.parse(winnerTeam?.soldPlayers || '[]');
      newSoldLog.push({ playerId, teamId: auction.currentBidderTeamId, price: auction.currentBid });
      hammerTeamId = auction.currentBidderTeamId;
      newTeams[auction.currentBidderTeamId] = {
        ...winnerTeam,
        purse: winnerTeam.purse - auction.currentBid,
        soldPlayers: JSON.stringify([...prevSold, { playerId, teamId: auction.currentBidderTeamId, price: auction.currentBid }]),
      };
      announcement = `🔨 SOLD! ${player.name} → ${winnerInfo.shortName} for ${fmtL(auction.currentBid)}`;
      speechText   = announceSold(player, winnerInfo, auction.currentBid);
      if (store.soundEnabled) { playHammer(); setTimeout(playCrowdCheer, 350); }
    } else {
      newUnsold.push(playerId);
      announcement = `❌ UNSOLD — ${player.name}`;
      speechText   = announceUnsold(player);
      if (store.soundEnabled) playUnsold();
    }

    const nextIdx     = auction.queueIndex + 1;
    const endOfQueue  = nextIdx >= queue.length;
    const endOfPool   = isLastInPool(pools, auction.queueIndex);
    const isRapid     = auction.phase === 'rapid';

    let nextPhase     = auction.phase;
    let poolBreakEnd  = 0;
    let newQueueIdx   = nextIdx;
    let newPoolIdx    = auction.currentPoolIdx;
    let nextPlayerId: string | null = null;
    let nextPoolSpeech = '';
    let nextPlayerSpeech = '';

    if (endOfQueue) {
      if (!isRapid && newUnsold.length > 0) {
        nextPhase    = 'rapid';
        newQueueIdx  = 0;
        announcement = '⚡ RAPID ROUND — All unsold players!';
        speechText   = announceRapid();
      } else {
        nextPhase    = 'finished';
        announcement = '🏆 Auction Complete!';
        speechText   = 'The IPL Auction is now complete! Thank you for participating!';
      }
    } else if (!isRapid && endOfPool) {
      // Start break before next pool
      const nextPoolIdx = auction.currentPoolIdx + 1;
      const nextPool    = pools[nextPoolIdx];
      nextPhase   = 'break';
      poolBreakEnd = Date.now() + BREAK_DURATION;
      newPoolIdx  = nextPoolIdx;
      nextPlayerId = null;
      announcement = `⏸️ Break — ${nextPool?.label ?? 'next pool'} starts in 1 min`;
      speechText   = nextPool ? announceBreak(nextPool.label) : 'Break time!';
    } else {
      nextPlayerId = queue[nextIdx];
      const nextPlayer = nextPlayerId ? getPlayerById(nextPlayerId) : null;
      if (nextPlayer) {
        nextPlayerSpeech = announcePlayer(nextPlayer);
        const nextPool = getPoolForIndex(pools, nextIdx);
        const curPool  = getPoolForIndex(pools, auction.queueIndex);
        if (nextPool && curPool && nextPool.name !== curPool.name) {
          nextPoolSpeech = announcePool(nextPool.label);
        }
      }
    }

    // Build rapid queue if entering rapid
    let rapidQueue = queue;
    if (nextPhase === 'rapid' && !isRapid) {
      rapidQueue = [...newUnsold];
      newUnsold  = [];
      newQueueIdx = 0;
      nextPlayerId = rapidQueue[0] ?? null;
    }

    const combinedSpeech = nextPhase === 'auction'
      ? [speechText, nextPoolSpeech, nextPlayerSpeech].filter(Boolean).join(' … ')
      : speechText;

    const auctionUpdate: Partial<AuctionData> = {
      phase: nextPhase,
      queue: nextPhase === 'rapid' && !isRapid ? JSON.stringify(rapidQueue) : auction.queue,
      queueIndex: newQueueIdx,
      currentPoolIdx: newPoolIdx,
      unsoldIds: JSON.stringify(newUnsold),
      soldLog: JSON.stringify(newSoldLog),
      currentBid: nextPlayerId ? (getPlayerById(nextPlayerId)?.basePrice ?? 0) : 0,
      currentBidderTeamId: null,
      timerEnd: nextPlayerId && nextPhase !== 'break'
        ? Date.now() + (nextPhase === 'rapid' ? TIMER_RAPID : TIMER_NORMAL)
        : 0,
      poolBreakEnd,
      hammerTeamId,
      bidCount: 0,
      announcement,
      speechText: combinedSpeech,
      speechSeq: (auction.speechSeq || 0) + 1,
    };

    const batch: Record<string, unknown> = {};
    batch[`rooms/${roomId}/auction`] = auctionUpdate;
    for (const [tid, ts] of Object.entries(newTeams)) {
      batch[`rooms/${roomId}/teams/${tid}`] = ts;
    }
    await update(ref(db), batch);

    // Restart timer after delay
    if (nextPlayerId && nextPhase === 'auction') {
      setTimeout(() => {
        timerRef.current = setInterval(() => {
          const d = useGameStore.getState().roomData;
          if (!d) return;
          const a = d.auction;
          if (!['auction','rapid'].includes(a.phase)) return;
          if (Date.now() >= a.timerEnd) {
            clearInterval(timerRef.current!);
            goingOnceRef.current  = false;
            goingTwiceRef.current = false;
            handleTimerExpired(d);
          }
        }, 400);
      }, 2000);
    }
  };

  // ── Start next pool after break ───────────────────────────────────────────
  const startNextPool = async (data: RoomData) => {
    const { roomId } = store;
    if (!roomId) return;
    const { auction } = data;
    const pools: PoolMeta[] = JSON.parse(auction.pools || '[]');
    const queue: string[]   = JSON.parse(auction.queue  || '[]');
    const nextPool   = pools[auction.currentPoolIdx];
    if (!nextPool) return;
    const firstId    = queue[nextPool.start];
    const firstPlayer = firstId ? getPlayerById(firstId) : null;
    const poolSpeech  = announcePool(nextPool.label);
    const playerSpeech = firstPlayer ? announcePlayer(firstPlayer) : '';

    await update(ref(db, `rooms/${roomId}/auction`), {
      phase: 'auction',
      queueIndex: nextPool.start,
      currentBid: firstPlayer?.basePrice ?? 0,
      currentBidderTeamId: null,
      timerEnd: Date.now() + TIMER_NORMAL,
      poolBreakEnd: 0,
      hammerTeamId: null,
      bidCount: 0,
      announcement: `▶️ ${nextPool.label} — ${firstPlayer?.name ?? ''}`,
      speechText: [poolSpeech, playerSpeech].join(' … '),
      speechSeq: (auction.speechSeq || 0) + 1,
    });
  };

  // ── Public actions ────────────────────────────────────────────────────────
  const createRoom = useCallback(async (playerName: string) => {
    if (!store.uid) return;
    store.setLoading(true);
    store.setMyName(playerName);
    const roomId = genRoomCode();
    const { queue, pools }: PooledQueue = buildPooledQueue();
    const teams: Record<string, TeamState> = {};
    IPL_TEAMS.forEach(t => {
      teams[t.id] = {
        purse: SQUAD_RULES.startingPurse,
        soldPlayers: '[]',
        isAI: true,
        ownerUid: null,
        ownerName: null,
        aiStrategy: ['aggressive','conservative','balanced'][Math.floor(Math.random()*3)] as any,
      };
    });
    const firstPlayer = getPlayerById(queue[0]);
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
        currentBid: firstPlayer?.basePrice ?? 200,
        currentBidderTeamId: null,
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
    const roomId = code.toUpperCase();
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
    const { roomId, uid, myName } = store;
    if (!roomId || !uid) return;
    const snap = await get(ref(db, `rooms/${roomId}/teams/${teamId}`));
    const team = snap.val() as TeamState | null;
    if (!team) return;
    if (!team.isAI && team.ownerUid && team.ownerUid !== uid) { store.setError('Team already taken!'); return; }
    if (store.myTeamId) {
      await update(ref(db, `rooms/${roomId}/teams/${store.myTeamId}`), { isAI: true, ownerUid: null, ownerName: null });
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
    const pools: PoolMeta[] = JSON.parse(roomData.auction.pools || '[]');
    const queue: string[]   = JSON.parse(roomData.auction.queue  || '[]');
    const firstPool   = pools[0];
    const firstPlayer = firstPool ? getPlayerById(queue[firstPool.start]) : null;
    const poolSpeech   = firstPool ? announcePool(firstPool.label) : '';
    const playerSpeech = firstPlayer ? announcePlayer(firstPlayer) : '';

    await update(ref(db, `rooms/${roomId}`), {
      'meta/started': true,
      'auction/phase': 'auction',
      'auction/timerEnd': Date.now() + TIMER_NORMAL,
      'auction/currentBid': firstPlayer?.basePrice ?? 200,
      'auction/announcement': firstPool ? `▶️ ${firstPool.label} — Starting!` : '',
      'auction/speechText': [poolSpeech, playerSpeech].join(' … '),
      'auction/speechSeq': 1,
    });
  }, [store.roomId, store.roomData]);

  const placeBid = useCallback(async (amount: number) => {
    const { roomId, myTeamId, roomData } = store;
    if (!roomId || !myTeamId || !roomData) return;
    const { auction, teams } = roomData;
    const team = teams[myTeamId];
    if (!team || team.purse < amount) return;
    const teamInfo   = getTeamById(myTeamId);
    const newTimerEnd = Math.max(auction.timerEnd, Date.now() + TIMER_EXTEND);
    await update(ref(db, `rooms/${roomId}/auction`), {
      currentBid: amount,
      currentBidderTeamId: myTeamId,
      bidCount: (auction.bidCount || 0) + 1,
      timerEnd: newTimerEnd,
      announcement: `💰 ${teamInfo.shortName} bids ${fmtL(amount)}!`,
      speechText: `${teamInfo.shortName} bids ${fmtL(amount)}!`,
      speechSeq: (auction.speechSeq || 0) + 1,
    });
  }, [store.roomId, store.myTeamId, store.roomData]);

  return { createRoom, joinRoom, selectTeam, joinAsSpectator, startGame, placeBid };
}
