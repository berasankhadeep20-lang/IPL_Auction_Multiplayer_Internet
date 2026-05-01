import { useEffect, useRef, useCallback } from 'react';
import {
  ref, set, update, onValue, off, serverTimestamp, get,
} from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase/config';
import { useGameStore } from '../store/useGameStore';
import { buildAuctionQueue, getPlayerById } from '../data/players';
import { IPL_TEAMS } from '../data/teams';
import { computeAIBid } from '../utils/aiPlayer';
import { SoldEntry, RoomData, SQUAD_RULES, AuctionData, TeamState } from '../types';
import {
  playHammer, playBidPlaced, playCrowdCheer,
  playTimerTick, playUnsold, playNewPlayer,
} from '../utils/sounds';

const TIMER_NORMAL  = 25_000;  // ms
const TIMER_RAPID   = 12_000;
const TIMER_EXTEND  = 8_000;   // extend on bid if < this

function genRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function useGameRoom() {
  const store = useGameStore();
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBidCountRef  = useRef<number>(-1);
  const prevQueueIdxRef  = useRef<number>(-1);
  const prevPhaseRef     = useRef<string>('');

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        store.setUid(user.uid);
      } else {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return unsub;
  }, []);

  // ── Room subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    const { roomId } = store;
    if (!roomId || !isFirebaseConfigured()) return;

    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val() as RoomData | null;
      if (!data) return;
      store.setRoomData(data);

      // Phase transitions
      const { auction } = data;
      if (auction.phase === 'auction' || auction.phase === 'rapid') {
        store.setScreen('auction');
      } else if (auction.phase === 'finished') {
        store.setScreen('scoreboard');
      }

      // Sound triggers
      if (store.soundEnabled) {
        const bidCountChanged  = auction.bidCount  !== prevBidCountRef.current;
        const queueIdxChanged  = auction.queueIndex !== prevQueueIdxRef.current;
        const phaseChanged     = auction.phase !== prevPhaseRef.current;

        if (bidCountChanged && prevBidCountRef.current >= 0) {
          playBidPlaced();
        }
        if (queueIdxChanged && prevQueueIdxRef.current >= 0) {
          if (auction.hammerTeamId) { playHammer(); setTimeout(playCrowdCheer, 300); }
          else playNewPlayer();
        }
        if (phaseChanged && auction.phase === 'rapid') playNewPlayer();
      }

      prevBidCountRef.current  = auction.bidCount;
      prevQueueIdxRef.current  = auction.queueIndex;
      prevPhaseRef.current     = auction.phase;
    });

    return () => off(roomRef, 'value', unsub as any);
  }, [store.roomId]);

  // ── Host timer loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;

    timerRef.current = setInterval(() => {
      const data = store.roomData;
      if (!data) return;
      const { auction } = data;
      if (auction.phase !== 'auction' && auction.phase !== 'rapid') return;
      if (Date.now() >= auction.timerEnd) {
        clearInterval(timerRef.current!);
        handleTimerExpired(data);
      } else if (store.soundEnabled) {
        const left = auction.timerEnd - Date.now();
        if (left < 6000 && left > 5900) playTimerTick(true);
      }
    }, 500);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [store.isHost, store.roomId, store.roomData]);

  // ── Host AI tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!store.isHost || !store.roomId) return;

    aiTickRef.current = setInterval(() => {
      const data = store.roomData;
      if (!data) return;
      const { auction, teams } = data;
      if (auction.phase !== 'auction' && auction.phase !== 'rapid') return;
      const queue: string[] = JSON.parse(auction.queue || '[]');
      const playerId = queue[auction.queueIndex];
      if (!playerId) return;
      const player = getPlayerById(playerId);
      if (!player) return;
      const timeLeft = auction.timerEnd - Date.now();
      if (timeLeft < 2500 || timeLeft > (auction.phase === 'rapid' ? TIMER_RAPID : TIMER_NORMAL) - 1500) return;

      // AI bidding (shuffle order to avoid bias)
      const aiTeams = Object.entries(teams)
        .filter(([id, t]) => t.isAI && id !== auction.currentBidderTeamId)
        .sort(() => Math.random() - 0.5);

      for (const [teamId, team] of aiTeams) {
        const dec = computeAIBid(team, player, auction.currentBid, team.aiStrategy);
        if (dec.shouldBid) {
          const aRef = ref(db, `rooms/${store.roomId}/auction`);
          const newTimerEnd = Math.max(auction.timerEnd, Date.now() + TIMER_EXTEND);
          update(aRef, {
            currentBid: dec.amount,
            currentBidderTeamId: teamId,
            bidCount: (auction.bidCount || 0) + 1,
            timerEnd: newTimerEnd,
            announcement: `🤖 ${teamId.toUpperCase()} bids ${fmtL(dec.amount)}!`,
          });
          break;
        }
      }
    }, 3000);

    return () => { if (aiTickRef.current) clearInterval(aiTickRef.current); };
  }, [store.isHost, store.roomId, store.roomData]);

  // ─────────────────────────────────────────────────────────────────────────
  const handleTimerExpired = async (data: RoomData) => {
    const { roomId } = store;
    if (!roomId) return;
    const { auction, teams } = data;
    const queue: string[]    = JSON.parse(auction.queue || '[]');
    const unsoldIds: string[]= JSON.parse(auction.unsoldIds || '[]');
    const soldLog: SoldEntry[]= JSON.parse(auction.soldLog || '[]');
    const playerId = queue[auction.queueIndex];

    let newUnsold  = [...unsoldIds];
    let newSoldLog = [...soldLog];
    let hammerTeamId: string | null = null;
    let newTeams: Record<string, TeamState> = {};

    if (auction.currentBidderTeamId && auction.currentBid >= getPlayerById(playerId)!.basePrice) {
      // SOLD
      const winnerTeam = teams[auction.currentBidderTeamId];
      const prevSold: SoldEntry[] = JSON.parse(winnerTeam?.soldPlayers || '[]');
      newSoldLog.push({ playerId, teamId: auction.currentBidderTeamId, price: auction.currentBid });
      hammerTeamId = auction.currentBidderTeamId;
      newTeams[auction.currentBidderTeamId] = {
        ...winnerTeam,
        purse: winnerTeam.purse - auction.currentBid,
        soldPlayers: JSON.stringify([...prevSold, { playerId, teamId: auction.currentBidderTeamId, price: auction.currentBid }]),
      };
    } else {
      // UNSOLD
      newUnsold.push(playerId);
    }

    const nextIdx = auction.queueIndex + 1;
    const isEndOfQueue = nextIdx >= queue.length;

    let nextPhase = auction.phase;
    let newQueue  = queue;
    let newQueueIdx = nextIdx;
    let newTimerDuration = TIMER_NORMAL;
    let nextPlayerId: string | null = null;

    if (isEndOfQueue) {
      if (auction.phase === 'auction' && newUnsold.length > 0) {
        // Start rapid round
        nextPhase = 'rapid';
        newQueue  = [...newUnsold];
        newUnsold = [];
        newQueueIdx = 0;
        newTimerDuration = TIMER_RAPID;
        nextPlayerId = newQueue[0];
      } else {
        // Game over
        nextPhase = 'finished';
      }
    } else {
      nextPlayerId = queue[nextIdx];
    }

    const updates: Partial<AuctionData> = {
      queueIndex: newQueueIdx,
      queue: JSON.stringify(nextPhase === 'rapid' ? newQueue : queue),
      unsoldIds: JSON.stringify(newUnsold),
      soldLog: JSON.stringify(newSoldLog),
      currentBid: nextPlayerId ? getPlayerById(nextPlayerId)!.basePrice : 0,
      currentBidderTeamId: null,
      timerEnd: nextPlayerId ? Date.now() + newTimerDuration : 0,
      phase: nextPhase,
      hammerTeamId,
      bidCount: 0,
      announcement: hammerTeamId
        ? `🔨 SOLD to ${hammerTeamId.toUpperCase()} for ${fmtL(auction.currentBid)}!`
        : nextPhase === 'rapid'
          ? '⚡ RAPID ROUND — Unsold players!'
          : nextPhase === 'finished'
            ? '🏆 Auction Complete!'
            : '❌ Unsold! Moving on...',
    };

    const batchUpdate: Record<string, unknown> = {};
    batchUpdate[`rooms/${roomId}/auction`] = updates;
    for (const [tid, ts] of Object.entries(newTeams)) {
      batchUpdate[`rooms/${roomId}/teams/${tid}`] = ts;
    }
    await update(ref(db), batchUpdate);

    // Restart timer for next player
    if (nextPlayerId && nextPhase !== 'finished') {
      setTimeout(() => {
        timerRef.current = setInterval(() => {
          const d = useGameStore.getState().roomData;
          if (!d) return;
          const a = d.auction;
          if (a.phase !== 'auction' && a.phase !== 'rapid') return;
          if (Date.now() >= a.timerEnd) {
            clearInterval(timerRef.current!);
            handleTimerExpired(d);
          }
        }, 500);
      }, 1500);
    }
  };

  // ── Public actions ─────────────────────────────────────────────────────
  const createRoom = useCallback(async (playerName: string) => {
    if (!store.uid) return;
    store.setLoading(true);
    store.setMyName(playerName);
    const roomId = genRoomCode();
    const queue  = buildAuctionQueue();
    const teams: Record<string, TeamState> = {};
    IPL_TEAMS.forEach(t => {
      teams[t.id] = {
        purse: SQUAD_RULES.startingPurse,
        soldPlayers: '[]',
        isAI: true,
        ownerUid: null,
        ownerName: null,
        aiStrategy: ['aggressive', 'conservative', 'balanced'][Math.floor(Math.random() * 3)] as any,
      };
    });
    const firstPlayer = getPlayerById(queue[0]);
    const roomData: RoomData = {
      meta: { hostId: store.uid, hostOnline: true, started: false, createdAt: Date.now() },
      participants: {
        [store.uid]: { name: playerName, teamId: null, isSpectator: false, lastSeen: Date.now() },
      },
      teams,
      auction: {
        phase: 'waiting',
        queue: JSON.stringify(queue),
        queueIndex: 0,
        unsoldIds: '[]',
        soldLog: '[]',
        currentBid: firstPlayer?.basePrice ?? 200,
        currentBidderTeamId: null,
        timerEnd: 0,
        announcement: 'Welcome to the IPL Auction 2025!',
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
    if (!snap.exists()) {
      store.setError('Room not found!');
      store.setLoading(false);
      return;
    }
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
    if (!team.isAI && team.ownerUid && team.ownerUid !== uid) {
      store.setError('Team already taken!');
      return;
    }
    // Release previous team if any
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
    const queue: string[] = JSON.parse(roomData.auction.queue);
    const firstPlayer = getPlayerById(queue[0]);
    await update(ref(db, `rooms/${roomId}`), {
      'meta/started': true,
      'auction/phase': 'auction',
      'auction/timerEnd': Date.now() + TIMER_NORMAL,
      'auction/currentBid': firstPlayer?.basePrice ?? 200,
      'auction/announcement': firstPlayer ? `🎙️ Up for Bid: ${firstPlayer.name}!` : '',
    });
  }, [store.roomId, store.roomData]);

  const placeBid = useCallback(async (amount: number) => {
    const { roomId, myTeamId, roomData } = store;
    if (!roomId || !myTeamId || !roomData) return;
    const { auction, teams } = roomData;
    const team = teams[myTeamId];
    if (!team || team.purse < amount) return;
    const newTimerEnd = Math.max(auction.timerEnd, Date.now() + TIMER_EXTEND);
    await update(ref(db, `rooms/${roomId}/auction`), {
      currentBid: amount,
      currentBidderTeamId: myTeamId,
      bidCount: (auction.bidCount || 0) + 1,
      timerEnd: newTimerEnd,
      announcement: `💰 ${myTeamId.toUpperCase()} bids ${fmtL(amount)}!`,
    });
  }, [store.roomId, store.myTeamId, store.roomData]);

  return { createRoom, joinRoom, selectTeam, joinAsSpectator, startGame, placeBid };
}

function fmtL(lakhs: number): string {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
  return `₹${lakhs}L`;
}
