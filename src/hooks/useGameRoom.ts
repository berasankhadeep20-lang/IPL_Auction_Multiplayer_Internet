import { useEffect, useRef, useCallback } from 'react';
import { ref, set, update, onValue, off, get, push } from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../firebase/config';
import { useGameStore } from '../store/useGameStore';
import { getPlayerById } from '../data/players';
import { buildPooledQueue, getPoolForIndex, isLastInPool } from '../utils/poolBuilder';
import { IPL_TEAMS, getTeamById } from '../data/teams';
import { computeAIBid } from '../utils/aiPlayer';
import { SoldEntry, RoomData, SQUAD_RULES, AuctionData, TeamState, PoolMeta, BidHistoryEntry, ChatMessage } from '../types';
import { playHammer, playBidPlaced, playCrowdCheer, playTimerTick, playUnsold, playNewPlayer } from '../utils/sounds';
import { speak, speakChain, announcePool, announcePlayer, announceSold, announceUnsold, announceBreak, announceRapid, announceGoingOnce, announceGoingTwice } from '../utils/speech';

const TIMER_NORMAL=28_000; const TIMER_RAPID=14_000; const TIMER_EXTEND=9_000;
const BREAK_DURATION=60_000; const POST_RESULT_GAP=1_800;
function genCode(){return Math.random().toString(36).substring(2,8).toUpperCase();}
function fmtL(l:number){return l>=100?`₹${(l/100).toFixed(2)} Cr`:`₹${l}L`;}
function sp<T>(s:string,fb:T):T{try{return JSON.parse(s) as T;}catch{return fb;}}

export function useGameRoom(){
  const store=useGameStore();
  const mainTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const breakTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const aiTickRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const processingTimer=useRef(false);
  const speakingForRoom=useRef<string|null>(null);
  const prevSpeechSeq=useRef(-1); const prevBidCount=useRef(-1);
  const prevQueueIdx=useRef(-1); const prevPhase=useRef('');
  const goingOnce=useRef(false); const goingTwice=useRef(false);

  // Auth
  useEffect(()=>{
    if(!isFirebaseConfigured())return;
    return onAuthStateChanged(auth,u=>{
      if(u)store.setUid(u.uid); else signInAnonymously(auth).catch(console.error);
    });
  },[]);

  // Room subscription
  useEffect(()=>{
    const{roomId}=store;
    if(!roomId||!isFirebaseConfigured())return;
    const roomRef=ref(db,`rooms/${roomId}`);
    const handler=onValue(roomRef,snap=>{
      const data=snap.val() as RoomData|null;
      if(!data)return;
      store.setRoomData(data);
      const{auction}=data;
      if(auction.phase==='break') store.setScreen('break' as any);
      else if(['auction','rapid'].includes(auction.phase)) store.setScreen('auction');
      else if(auction.phase==='finished') store.setScreen('scoreboard');
      if(!store.isHost&&store.soundEnabled&&auction.speechSeq!==prevSpeechSeq.current){
        prevSpeechSeq.current=auction.speechSeq;
        if(auction.speechText) speakChain(auction.speechText.split(' … '),{rate:0.88});
      }
      if(store.soundEnabled){
        if(auction.bidCount!==prevBidCount.current&&prevBidCount.current>=0) playBidPlaced();
        if(auction.queueIndex!==prevQueueIdx.current&&prevQueueIdx.current>=0){
          if(auction.hammerTeamId){playHammer();setTimeout(playCrowdCheer,380);}
          else if(auction.phase!=='break') playNewPlayer();
        }
        if(auction.phase==='rapid'&&prevPhase.current!=='rapid') playNewPlayer();
      }
      prevBidCount.current=auction.bidCount; prevQueueIdx.current=auction.queueIndex; prevPhase.current=auction.phase;
    });
    return()=>off(roomRef,'value',handler as any);
  },[store.roomId]);

  // Speak then open bidding (host only)
  const speakAndOpenBidding=useCallback(async(phrases:string[],roomId:string,dur:number)=>{
    speakingForRoom.current=roomId;
    if(store.soundEnabled) await speakChain(phrases.filter(Boolean),{rate:0.88});
    if(speakingForRoom.current!==roomId)return;
    const now=Date.now();
    await update(ref(db,`rooms/${roomId}/auction`),{biddingStartAt:now,timerEnd:now+dur});
  },[store.soundEnabled]);

  // Main timer loop (host)
  useEffect(()=>{
    if(!store.isHost||!store.roomId)return;
    if(mainTimerRef.current)clearInterval(mainTimerRef.current);
    mainTimerRef.current=setInterval(()=>{
      const data=useGameStore.getState().roomData;
      if(!data)return;
      const{auction}=data;
      if(!['auction','rapid'].includes(auction.phase))return;
      if(auction.biddingStartAt===0||Date.now()<auction.biddingStartAt)return;
      const left=Math.ceil((auction.timerEnd-Date.now())/1000);
      if(left<=8&&left>4&&!goingOnce.current&&auction.bidCount>0&&store.soundEnabled){
        goingOnce.current=true; speak(announceGoingOnce(auction.currentBid),{cancel:false});
      }
      if(left<=4&&left>1&&!goingTwice.current&&auction.bidCount>0&&store.soundEnabled){
        goingTwice.current=true; speak(announceGoingTwice(auction.currentBid),{cancel:false});
      }
      if(left<=5&&left>0&&store.soundEnabled) playTimerTick(left<=2);
      if(Date.now()>=auction.timerEnd&&!processingTimer.current){
        processingTimer.current=true; goingOnce.current=false; goingTwice.current=false;
        handleTimerExpired(data).finally(()=>setTimeout(()=>{processingTimer.current=false;},500));
      }
    },400);
    return()=>{if(mainTimerRef.current)clearInterval(mainTimerRef.current);};
  },[store.isHost,store.roomId]);

  // Break countdown (host)
  useEffect(()=>{
    if(!store.isHost||!store.roomId)return;
    if(breakTimerRef.current)clearInterval(breakTimerRef.current);
    breakTimerRef.current=setInterval(()=>{
      const data=useGameStore.getState().roomData;
      if(!data||data.auction.phase!=='break')return;
      if(Date.now()>=data.auction.poolBreakEnd){clearInterval(breakTimerRef.current!);startNextPool(data);}
    },800);
    return()=>{if(breakTimerRef.current)clearInterval(breakTimerRef.current);};
  },[store.isHost,store.roomId]);

  // AI tick (host)
  useEffect(()=>{
    if(!store.isHost||!store.roomId)return;
    if(aiTickRef.current)clearInterval(aiTickRef.current);
    aiTickRef.current=setInterval(()=>{
      const data=useGameStore.getState().roomData;
      if(!data)return;
      const{auction,teams}=data;
      if(!['auction','rapid'].includes(auction.phase))return;
      if(auction.biddingStartAt===0||Date.now()<auction.biddingStartAt)return;
      if(auction.timerEnd-Date.now()<1500)return;
      const queue=sp<string[]>(auction.queue,[]);
      const player=getPlayerById(queue[auction.queueIndex]);
      if(!player)return;
      const aiTeams=Object.entries(teams).filter(([id,t])=>t.isAI&&id!==auction.currentBidderTeamId).sort(()=>Math.random()-.5);
      for(const[teamId,team]of aiTeams){
        const dec=computeAIBid(team,player,auction.currentBid,team.aiStrategy);
        if(dec.shouldBid){
          const ti=getTeamById(teamId); const newEnd=Math.max(auction.timerEnd,Date.now()+TIMER_EXTEND);
          const hist=sp<BidHistoryEntry[]>(auction.bidHistory,[]);
          update(ref(db,`rooms/${store.roomId}/auction`),{
            currentBid:dec.amount,currentBidderTeamId:teamId,bidCount:auction.bidCount+1,timerEnd:newEnd,
            announcement:`🤖 ${ti.shortName} bids ${fmtL(dec.amount)}!`,
            speechText:`${ti.shortName} bids ${fmtL(dec.amount)}!`,speechSeq:auction.speechSeq+1,
            bidHistory:JSON.stringify([...hist,{teamId,amount:dec.amount,ts:Date.now()}]),
          });
          break;
        }
      }
    },2500);
    return()=>{if(aiTickRef.current)clearInterval(aiTickRef.current);};
  },[store.isHost,store.roomId]);

  const handleTimerExpired=async(data:RoomData):Promise<void>=>{
    const{roomId}=useGameStore.getState(); if(!roomId)return;
    const{auction,teams}=data;
    const queue=sp<string[]>(auction.queue,[]); const pools=sp<PoolMeta[]>(auction.pools,[]);
    const unsoldIds=sp<string[]>(auction.unsoldIds,[]); const soldLog=sp<SoldEntry[]>(auction.soldLog,[]);
    const isRapid=auction.phase==='rapid';
    const playerId=queue[auction.queueIndex]; if(!playerId)return;
    const player=getPlayerById(playerId); if(!player)return;

    let newUnsold=[...unsoldIds]; let newSoldLog=[...soldLog];
    let hammerTeamId:string|null=null;
    const teamUpdates:Record<string,TeamState>={};
    let resultPhrases:string[]=[]; let lastSoldEntry='null';

    if(auction.currentBidderTeamId&&auction.currentBid>=player.basePrice){
      const winner=teams[auction.currentBidderTeamId];
      const winnerInfo=getTeamById(auction.currentBidderTeamId);
      const prevSold=sp<SoldEntry[]>(winner?.soldPlayers??'[]',[]);
      const entry:SoldEntry={playerId,teamId:auction.currentBidderTeamId,price:auction.currentBid};
      newSoldLog.push(entry); hammerTeamId=auction.currentBidderTeamId; lastSoldEntry=JSON.stringify(entry);
      teamUpdates[auction.currentBidderTeamId]={...winner,purse:winner.purse-auction.currentBid,soldPlayers:JSON.stringify([...prevSold,entry])};
      resultPhrases=[announceSold(player,winnerInfo,auction.currentBid)];
      if(store.soundEnabled){playHammer();setTimeout(playCrowdCheer,380);}
    } else {
      newUnsold.push(playerId); resultPhrases=[announceUnsold(player)];
      if(store.soundEnabled)playUnsold();
    }

    const nextIdx=auction.queueIndex+1; const endOfQueue=nextIdx>=queue.length;
    const endOfPool=!isRapid&&isLastInPool(pools,auction.queueIndex);
    let nextPhase:AuctionData['phase']=auction.phase;
    let newQueueIdx=nextIdx; let newPoolIdx=auction.currentPoolIdx;
    let poolBreakEnd=0; let newQueue=queue; let nextPhrases:string[]=[]; let dur=isRapid?TIMER_RAPID:TIMER_NORMAL;

    if(endOfQueue){
      if(!isRapid&&newUnsold.length>0){
        nextPhase='rapid'; newQueue=[...newUnsold]; newUnsold=[]; newQueueIdx=0; dur=TIMER_RAPID;
        const fp=getPlayerById(newQueue[0]);
        nextPhrases=[announceRapid(),fp?announcePlayer(fp):''];
      } else { nextPhase='finished'; nextPhrases=['The IPL Auction 2025 is now complete!']; }
    } else if(endOfPool){
      nextPhase='break'; poolBreakEnd=Date.now()+BREAK_DURATION; newPoolIdx=auction.currentPoolIdx+1;
      const np=pools[newPoolIdx]; nextPhrases=[np?announceBreak(np.label):'Pool complete!'];
    } else {
      const np=getPlayerById(queue[nextIdx]);
      const curP=getPoolForIndex(pools,auction.queueIndex); const nxtP=getPoolForIndex(pools,nextIdx);
      nextPhrases=(nxtP&&curP&&nxtP.name!==curP.name)?[announcePool(nxtP.label),np?announcePlayer(np):'']:[np?announcePlayer(np):''];
    }

    const nextPlayerId=newQueueIdx<newQueue.length?newQueue[newQueueIdx]:null;
    const auctionPatch:Partial<AuctionData>={
      phase:nextPhase,queue:JSON.stringify(newQueue),queueIndex:newQueueIdx,currentPoolIdx:newPoolIdx,
      unsoldIds:JSON.stringify(newUnsold),soldLog:JSON.stringify(newSoldLog),
      currentBid:nextPlayerId?(getPlayerById(nextPlayerId)?.basePrice??0):0,
      currentBidderTeamId:null,biddingStartAt:0,timerEnd:0,poolBreakEnd,
      hammerTeamId,bidCount:0,bidHistory:'[]',lastSoldEntry,
      announcement:hammerTeamId?`🔨 SOLD! ${player.name} → ${getTeamById(hammerTeamId).shortName} for ${fmtL(auction.currentBid)}`
        :nextPhase==='finished'?'🏆 Auction Complete!':nextPhase==='break'?'⏸️ 1-min break…':`❌ UNSOLD — ${player.name}`,
      speechText:[...resultPhrases,...nextPhrases].filter(Boolean).join(' … '),speechSeq:auction.speechSeq+1,
    };
    const batch:Record<string,unknown>={};
    batch[`rooms/${roomId}/auction`]={...auction,...auctionPatch};
    for(const[tid,ts]of Object.entries(teamUpdates)) batch[`rooms/${roomId}/teams/${tid}`]=ts;
    await update(ref(db),batch);

    if(nextPhase==='auction'||nextPhase==='rapid'){
      await new Promise(r=>setTimeout(r,POST_RESULT_GAP));
      await speakAndOpenBidding([...resultPhrases,...nextPhrases].filter(Boolean),roomId,dur);
    } else if(store.soundEnabled) await speakChain(resultPhrases,{rate:0.88});
  };

  const startNextPool=async(data:RoomData)=>{
    const{roomId}=useGameStore.getState(); if(!roomId)return;
    const{auction}=data;
    const pools=sp<PoolMeta[]>(auction.pools,[]); const queue=sp<string[]>(auction.queue,[]);
    const pool=pools[auction.currentPoolIdx]; if(!pool)return;
    const fp=getPlayerById(queue[pool.start]);
    const phrases=[announcePool(pool.label),fp?announcePlayer(fp):''].filter(Boolean);
    await update(ref(db,`rooms/${roomId}/auction`),{
      phase:'auction',queueIndex:pool.start,currentBid:fp?.basePrice??0,
      currentBidderTeamId:null,biddingStartAt:0,timerEnd:0,poolBreakEnd:0,
      hammerTeamId:null,bidCount:0,bidHistory:'[]',lastSoldEntry:'null',
      announcement:`▶️ ${pool.label} — ${fp?.name??''}`,
      speechText:phrases.join(' … '),speechSeq:auction.speechSeq+1,
    });
    await new Promise(r=>setTimeout(r,600));
    await speakAndOpenBidding(phrases,roomId,TIMER_NORMAL);
  };

  // Public actions
  const createRoom=useCallback(async(playerName:string)=>{
    if(!store.uid)return;
    store.setLoading(true); store.setMyName(playerName);
    const roomId=genCode();
    const{queue,pools}=buildPooledQueue();
    const teams:Record<string,TeamState>={};
    IPL_TEAMS.forEach(t=>{ teams[t.id]={purse:SQUAD_RULES.startingPurse,soldPlayers:'[]',isAI:true,ownerUid:null,ownerName:null,aiStrategy:(['aggressive','conservative','balanced']as const)[Math.floor(Math.random()*3)]}; });
    const fp=getPlayerById(queue[0]);
    const roomData:RoomData={
      meta:{hostId:store.uid,hostOnline:true,started:false,createdAt:Date.now()},
      participants:{[store.uid]:{name:playerName,teamId:null,isSpectator:false,lastSeen:Date.now()}},
      teams,chat:{},
      auction:{phase:'waiting',queue:JSON.stringify(queue),pools:JSON.stringify(pools),currentPoolIdx:0,queueIndex:0,
        unsoldIds:'[]',soldLog:'[]',currentBid:fp?.basePrice??200,currentBidderTeamId:null,
        biddingStartAt:0,timerEnd:0,poolBreakEnd:0,announcement:'Welcome to IPL Auction 2025!',
        speechText:'',speechSeq:0,hammerTeamId:null,bidCount:0,bidHistory:'[]',lastSoldEntry:'null'},
    };
    await set(ref(db,`rooms/${roomId}`),roomData);
    store.setRoomId(roomId); store.setIsHost(true); store.setScreen('lobby'); store.setLoading(false);
  },[store.uid]);

  const joinRoom=useCallback(async(code:string,playerName:string)=>{
    if(!store.uid)return;
    store.setLoading(true); store.setMyName(playerName);
    const roomId=code.toUpperCase().trim();
    const snap=await get(ref(db,`rooms/${roomId}`));
    if(!snap.exists()){store.setError('Room not found!');store.setLoading(false);return;}
    await update(ref(db,`rooms/${roomId}/participants/${store.uid}`),{name:playerName,teamId:null,isSpectator:false,lastSeen:Date.now()});
    store.setRoomId(roomId); store.setScreen('lobby'); store.setLoading(false);
  },[store.uid]);

  const selectTeam=useCallback(async(teamId:string)=>{
    const{roomId,uid,myName,myTeamId}=store;
    if(!roomId||!uid)return;
    const snap=await get(ref(db,`rooms/${roomId}/teams/${teamId}`));
    const team=snap.val() as TeamState|null;
    if(!team)return;
    if(!team.isAI&&team.ownerUid&&team.ownerUid!==uid){store.setError('Team just taken! Pick another.');return;}
    if(myTeamId) await update(ref(db,`rooms/${roomId}/teams/${myTeamId}`),{isAI:true,ownerUid:null,ownerName:null});
    await update(ref(db,`rooms/${roomId}/teams/${teamId}`),{isAI:false,ownerUid:uid,ownerName:myName});
    await update(ref(db,`rooms/${roomId}/participants/${uid}`),{teamId});
    store.setMyTeamId(teamId);
  },[store.roomId,store.uid,store.myTeamId,store.myName]);

  const joinAsSpectator=useCallback(async()=>{
    const{roomId,uid}=store; if(!roomId||!uid)return;
    await update(ref(db,`rooms/${roomId}/participants/${uid}`),{isSpectator:true,teamId:null});
    store.setIsSpectator(true); store.setMyTeamId(null);
  },[store.roomId,store.uid]);

  const startGame=useCallback(async()=>{
    const{roomId,roomData}=store; if(!roomId||!roomData)return;
    const pools=sp<PoolMeta[]>(roomData.auction.pools,[]); const queue=sp<string[]>(roomData.auction.queue,[]);
    const pool0=pools[0]; const fp=pool0?getPlayerById(queue[pool0.start]):null;
    const phrases=[announcePool(pool0?.label??''),fp?announcePlayer(fp):''].filter(Boolean);
    await update(ref(db,`rooms/${roomId}`),{
      'meta/started':true,'auction/phase':'auction','auction/biddingStartAt':0,'auction/timerEnd':0,
      'auction/currentBid':fp?.basePrice??200,'auction/bidHistory':'[]','auction/lastSoldEntry':'null',
      'auction/announcement':pool0?`▶️ ${pool0.label} — Starting!`:'Auction started!',
      'auction/speechText':phrases.join(' … '),'auction/speechSeq':1,
    });
    await new Promise(r=>setTimeout(r,400));
    await speakAndOpenBidding(phrases,roomId,TIMER_NORMAL);
  },[store.roomId,store.roomData,speakAndOpenBidding]);

  const placeBid=useCallback(async(amount:number)=>{
    const{roomId,myTeamId,roomData}=store; if(!roomId||!myTeamId||!roomData)return;
    const{auction,teams}=roomData;
    if(Date.now()<auction.biddingStartAt||auction.biddingStartAt===0)return;
    const team=teams[myTeamId]; if(!team||team.purse<amount)return;
    const ti=getTeamById(myTeamId); const newEnd=Math.max(auction.timerEnd,Date.now()+TIMER_EXTEND);
    const hist=sp<BidHistoryEntry[]>(auction.bidHistory,[]);
    await update(ref(db,`rooms/${roomId}/auction`),{
      currentBid:amount,currentBidderTeamId:myTeamId,bidCount:auction.bidCount+1,timerEnd:newEnd,
      announcement:`💰 ${ti.shortName} bids ${fmtL(amount)}!`,
      speechText:`${ti.shortName} bids ${fmtL(amount)}!`,speechSeq:auction.speechSeq+1,
      bidHistory:JSON.stringify([...hist,{teamId:myTeamId,amount,ts:Date.now()}]),
    });
  },[store.roomId,store.myTeamId,store.roomData]);

  const undoLastBid=useCallback(async()=>{
    const{roomId,roomData,isHost}=store; if(!roomId||!roomData||!isHost)return;
    const{auction,teams}=roomData;
    const entry=sp<{playerId:string;teamId:string;price:number}|null>(auction.lastSoldEntry,null);
    if(!entry||!entry.teamId)return;
    const winner=teams[entry.teamId]; if(!winner)return;
    const prevSold=sp<SoldEntry[]>(winner.soldPlayers,[]).filter(e=>e.playerId!==entry.playerId);
    const newSoldLog=sp<SoldEntry[]>(auction.soldLog,[]).filter(e=>e.playerId!==entry.playerId);
    await Promise.all([
      update(ref(db,`rooms/${roomId}/teams/${entry.teamId}`),{purse:winner.purse+entry.price,soldPlayers:JSON.stringify(prevSold)}),
      update(ref(db,`rooms/${roomId}/auction`),{soldLog:JSON.stringify(newSoldLog),lastSoldEntry:'null',announcement:'↩️ Last bid undone by host'}),
    ]);
  },[store.roomId,store.roomData,store.isHost]);

  const sendChat=useCallback(async(text:string,isReaction=false)=>{
    const{roomId,uid,myName}=store; if(!roomId||!uid)return;
    const msg:ChatMessage={id:'',uid,name:myName,text,ts:Date.now(),isReaction};
    await push(ref(db,`rooms/${roomId}/chat`),msg);
  },[store.roomId,store.uid,store.myName]);

  return{createRoom,joinRoom,selectTeam,joinAsSpectator,startGame,placeBid,undoLastBid,sendChat};
}
