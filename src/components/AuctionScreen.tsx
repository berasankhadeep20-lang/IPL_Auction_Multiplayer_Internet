import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { getPlayerById } from '../data/players';
import { getTeamById, IPL_TEAMS } from '../data/teams';
import { formatPrice, getBidIncrements, getSquadStatus } from '../utils/squadRules';
import { SoldEntry, PoolMeta, BidHistoryEntry } from '../types';
import TeamDrawer from './TeamDrawer';
import PlayerCard from './PlayerCard';
import ChatPanel from './ChatPanel';
import SoldSplash from './SoldSplash';
import CircularTimer from './CircularTimer';
import PlayerCompare from './PlayerCompare';
import MatchPredictor from './MatchPredictor';

const POOL_COLORS: Record<string,string> = {
  BOWL_1:'#ef4444',BAT_1:'#3b82f6',AR:'#22c55e',
  WK:'#f59e0b',BOWL_2:'#ef4444',BAT_2:'#3b82f6',RAPID:'#a855f7',
};
function sp<T>(s:string,fb:T):T{try{return JSON.parse(s) as T;}catch{return fb;}}

function spawnConfetti(){
  const colors=['#f5c842','#ef4444','#22c55e','#3b82f6','#a855f7','#ff6b35'];
  for(let i=0;i<70;i++){
    const el=document.createElement('div');
    const size=6+Math.random()*8;
    el.style.cssText=`position:fixed;top:-10px;left:${Math.random()*100}vw;width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>0.5?'50%':'2px'};
      pointer-events:none;z-index:9999;opacity:1;
      animation:confetti-fall ${1.8+Math.random()*1.5}s ease-in forwards;
      transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),4000);
  }
}

export default function AuctionScreen(){
  const store=useGameStore();
  const{placeBid,undoLastBid,sendChat}=useGameRoom();
  const room=store.roomData; const auction=room?.auction;

  const[timeLeft,setTimeLeft]=useState(0);
  const[announceLeft,setAnnounceLeft]=useState(0);
  const[soldAnim,setSoldAnim]=useState(false);
  const[splash,setSplash]=useState<{type:'sold'|'unsold';playerIdx:number;teamId:string|null;price:number}|null>(null);
  const[showBidHistory,setShowBidHistory]=useState(false);
  const[mobileTab,setMobileTab]=useState<'bid'|'teams'>('bid');
  const[showUnreadDot,setShowUnreadDot]=useState(false);
  const[showCompare,setShowCompare]=useState(false);
  const[comparePlayerId,setComparePlayerId]=useState<string|undefined>(undefined);
  const[showPredictor,setShowPredictor]=useState(false);

  const prevQueueIdx=useRef(-1);
  const prevHammerTeam=useRef<string|null>(null);
  const prevHammerIdx=useRef(-1);
  const timerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const chatMsgCount=useRef(0);

  useEffect(()=>{
    if(!auction?.timerEnd)return;
    if(timerRef.current)clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{
      const now=Date.now();
      setTimeLeft(Math.max(0,Math.ceil((auction.timerEnd-now)/1000)));
      setAnnounceLeft(Math.max(0,Math.ceil((auction.biddingStartAt-now)/1000)));
    },200);
    return()=>{if(timerRef.current)clearInterval(timerRef.current);};
  },[auction?.timerEnd,auction?.biddingStartAt]);

  // Sold/unsold splash trigger
  useEffect(()=>{
    if(!auction)return;
    const idxChanged=auction.queueIndex!==prevQueueIdx.current;
    const hammerChanged=auction.hammerTeamId!==prevHammerTeam.current||auction.queueIndex!==prevHammerIdx.current;
    if(idxChanged&&prevQueueIdx.current>=0){
      if(auction.hammerTeamId&&hammerChanged){
        // SOLD
        const soldPlayer=sp<SoldEntry[]>(auction.soldLog,[]).slice(-1)[0];
        if(soldPlayer){
          setSplash({type:'sold',playerIdx:prevQueueIdx.current,teamId:auction.hammerTeamId,price:soldPlayer.price});
          spawnConfetti();
        }
        prevHammerTeam.current=auction.hammerTeamId;
        prevHammerIdx.current=auction.queueIndex;
      } else if(!auction.hammerTeamId){
        // UNSOLD
        setSplash({type:'unsold',playerIdx:prevQueueIdx.current,teamId:null,price:0});
      }
      setSoldAnim(true); setTimeout(()=>setSoldAnim(false),2500);
    }
    prevQueueIdx.current=auction.queueIndex;
  },[auction?.queueIndex,auction?.hammerTeamId]);

  // Unread chat dot
  const totalChat=Object.keys(room?.chat??{}).length;
  useEffect(()=>{
    if(totalChat>chatMsgCount.current&&!store.showChat)setShowUnreadDot(true);
    chatMsgCount.current=totalChat;
  },[totalChat]);
  useEffect(()=>{if(store.showChat)setShowUnreadDot(false);},[store.showChat]);

  if(!auction||!room)return null;

  const isRapid=auction.phase==='rapid';
  const queue=sp<string[]>(auction.queue,[]);
  const pools=sp<PoolMeta[]>(auction.pools,[]);
  const unsoldIds=sp<string[]>(auction.unsoldIds,[]);
  const soldLog=sp<SoldEntry[]>(auction.soldLog,[]);
  const bidHistory=sp<BidHistoryEntry[]>(auction.bidHistory,[]);

  const currentPlayerId=queue[auction.queueIndex];
  const currentPlayer=currentPlayerId?getPlayerById(currentPlayerId):null;

  const currentPool=!isRapid
    ?pools.find(p=>auction.queueIndex>=p.start&&auction.queueIndex<p.end)
    :{name:'RAPID',label:'Rapid Round',start:0,end:0} as PoolMeta;
  const poolColor=POOL_COLORS[currentPool?.name??'']??'var(--gold)';
  const poolTotal=currentPool?currentPool.end-currentPool.start:0;
  const poolDone=currentPool?Math.max(0,auction.queueIndex-currentPool.start):0;

  const myTeam=store.myTeamId?room.teams[store.myTeamId]:null;
  const myTeamInfo=store.myTeamId?getTeamById(store.myTeamId):null;
  const myPurse=myTeam?.purse??0;
  const mySold=sp<SoldEntry[]>(myTeam?.soldPlayers??'[]',[]);
  const myStatus=getSquadStatus(mySold,myPurse);
  const biddingOpen=auction.biddingStartAt>0&&Date.now()>=auction.biddingStartAt;
  const isMyBid=store.myTeamId===auction.currentBidderTeamId;
  const bidTeamInfo=auction.currentBidderTeamId?getTeamById(auction.currentBidderTeamId):null;
  const canBid=!!(currentPlayer&&myTeam&&biddingOpen
    &&myTeam.purse>=auction.currentBid+5&&myStatus.playerCount<25
    &&!(currentPlayer.nationality==='Overseas'&&myStatus.overseasCount>=8)&&!isMyBid);
  const increments=getBidIncrements(auction.currentBid);
  const timerTotal=isRapid?14000:28000;
  const timerPct=auction.timerEnd?Math.max(0,Math.min(1,(auction.timerEnd-Date.now())/timerTotal)):0;
  const timerDanger=timeLeft<=5&&biddingOpen;
  const timerWarn=timeLeft<=8&&timeLeft>5&&biddingOpen;
  const budgetAlert=myPurse<=2000&&myPurse>0&&!store.isSpectator;

  // Splash player lookup
  const splashPlayer=splash?getPlayerById(queue[splash.playerIdx]):null;
  const splashTeam=splash?.teamId?getTeamById(splash.teamId):null;

  const BidPanel=()=>(
    <div className="card" style={{background:'var(--surface2)',padding:'14px 16px'}}>
      {budgetAlert&&(
        <div style={{background:'#2a1000',border:'1px solid #f59e0b',borderRadius:8,padding:'6px 12px',
          marginBottom:10,fontSize:12,color:'#fbbf24',textAlign:'center',animation:'sold-flash .8s infinite'}}>
          ⚠️ Budget Alert — Only {formatPrice(myPurse)} left!
        </div>
      )}
      {/* Timer + bid info */}
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}>
        <CircularTimer timeLeft={timeLeft} total={timerTotal/1000} danger={timerDanger}
          warning={timerWarn} announceLeft={announceLeft} bidCount={auction.bidCount}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:2}}>CURRENT BID</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,lineHeight:1,
            color:isMyBid?'var(--green)':'var(--gold)'}}>{formatPrice(auction.currentBid)}</div>
          {bidTeamInfo&&(
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
              <img src={bidTeamInfo.logo} alt="" style={{width:20,height:20,objectFit:'contain'}}/>
              <span style={{fontSize:12,fontWeight:700}}>{bidTeamInfo.shortName}</span>
              {isMyBid&&<span style={{fontSize:10,color:'var(--green)'}}>← YOU</span>}
            </div>
          )}
          {!bidTeamInfo&&<div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>No bids yet</div>}
        </div>
      </div>

      {/* Announce overlay */}
      {announceLeft>0&&(
        <div style={{background:'#1a0d2e',border:'1px solid #a855f755',borderRadius:8,padding:'8px 12px',
          textAlign:'center',marginBottom:10,fontSize:12,color:'#c084fc'}}>
          🎙️ Auctioneer announcing… bidding opens in <strong>{announceLeft}s</strong>
        </div>
      )}

      {/* Bid buttons */}
      {!store.isSpectator&&myTeam&&(
        <>
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:7,letterSpacing:.5}}>PLACE BID</div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${increments.length},1fr)`,gap:6}}>
            {increments.map(inc=>{
              const nb=auction.currentBid+inc;
              return(
                <button key={inc} className="btn btn-gold" style={{padding:'9px 4px',fontSize:13,
                  boxShadow:canBid&&nb<=myPurse?'0 0 12px rgba(245,200,66,.3)':'none'}}
                  disabled={!canBid||nb>myPurse} onClick={()=>placeBid(nb)}>
                  {formatPrice(nb)}
                </button>
              );
            })}
          </div>
          {isMyBid&&<div style={{textAlign:'center',color:'var(--green)',fontSize:12,marginTop:8,
            fontWeight:700,letterSpacing:.5}}>✅ YOU ARE LEADING — Defend your bid!</div>}
          {!canBid&&!isMyBid&&currentPlayer&&biddingOpen&&(
            <div style={{textAlign:'center',color:'var(--muted)',fontSize:11,marginTop:8}}>
              {myStatus.playerCount>=25?'⚠️ Squad full (25/25)'
                :currentPlayer.nationality==='Overseas'&&myStatus.overseasCount>=8?'⚠️ Overseas cap (8/8)'
                :myPurse<auction.currentBid+5?'💸 Insufficient purse':''}
            </div>
          )}
        </>
      )}
      {store.isSpectator&&<div style={{textAlign:'center',color:'var(--muted)',fontSize:12}}>👁️ Spectator mode</div>}

      {/* Action row */}
      <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
        {currentPlayer&&(
          <button className="btn btn-ghost btn-sm" onClick={()=>{setComparePlayerId(currentPlayerId);setShowCompare(true);}}>
            ⚖️ Compare
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowBidHistory(v=>!v)}>
          📋 Bids{bidHistory.length>0?` (${bidHistory.length})`:''}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowPredictor(true)}>
          📊 Predict
        </button>
        {store.isHost&&auction.lastSoldEntry!=='null'&&(
          <button className="btn btn-ghost btn-sm" style={{color:'var(--red)',borderColor:'var(--red)'}}
            onClick={undoLastBid}>↩️ Undo</button>
        )}
      </div>

      {/* Bid history */}
      {showBidHistory&&bidHistory.length>0&&(
        <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:3,maxHeight:130,overflowY:'auto'}}>
          {[...bidHistory].reverse().map((b,i)=>{
            const ti=getTeamById(b.teamId);
            return(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'4px 8px',background:'var(--surface)',borderRadius:5,fontSize:11}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <img src={ti.logo} alt="" style={{width:16,height:16,objectFit:'contain'}}/>
                  <span>{ti.shortName}</span>
                </div>
                <span style={{color:'var(--gold)',fontWeight:700}}>{formatPrice(b.amount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const TeamsPanel=()=>(
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      <div style={{fontSize:10,color:'var(--muted)',letterSpacing:1,marginBottom:2}}>ALL TEAMS</div>
      {IPL_TEAMS.map(team=>{
        const ts=room.teams[team.id]; if(!ts)return null;
        const sold=sp<SoldEntry[]>(ts.soldPlayers,[]);
        const status=getSquadStatus(sold,ts.purse);
        const leading=auction.currentBidderTeamId===team.id;
        const mine=store.myTeamId===team.id;
        return(
          <button key={team.id}
            onClick={()=>{store.setViewingTeamId(team.id);store.setShowTeamDrawer(true);}}
            style={{background:leading?`${team.primary}22`:mine?'var(--surface2)':'transparent',
              border:`1px solid ${leading?team.primary:mine?'var(--border)':'transparent'}`,
              borderRadius:7,padding:'7px 9px',cursor:'pointer',textAlign:'left',
              transition:'all .15s',color:'var(--text)'}}>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <img src={team.logo} alt="" style={{width:24,height:24,objectFit:'contain',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,fontWeight:700}}>{team.shortName}</span>
                  {leading&&<span style={{fontSize:9,color:team.primary,fontWeight:700,animation:'sold-flash .6s infinite'}}>BIDDING</span>}
                  {mine&&!leading&&<span style={{fontSize:9,color:'var(--green)'}}>YOU</span>}
                </div>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:10,color:'var(--muted)'}}>{status.playerCount}/25 {ts.isAI?'🤖':'👤'}</span>
                  <span style={{fontSize:10,color:'var(--gold)'}}>{formatPrice(ts.purse)}</span>
                </div>
                <div style={{height:2,background:'var(--border)',borderRadius:99,marginTop:3}}>
                  <div style={{height:'100%',borderRadius:99,
                    background:`linear-gradient(90deg,${team.primary},${team.secondary})`,
                    width:`${(ts.purse/12000)*100}%`,transition:'width .3s'}}/>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden',background:'var(--bg)'}}>
      <style>{`
        @keyframes confetti-fall{0%{opacity:1;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(110vh) rotate(720deg)}}
        @media(max-width:700px){.dl{display:none!important}.ml{display:flex!important}}
        @media(min-width:701px){.ml{display:none!important}}
      `}</style>

      {/* SOLD/UNSOLD splash */}
      {splash&&splashPlayer&&(
        <SoldSplash player={splashPlayer} team={splashTeam} price={splash.price}
          type={splash.type} onDone={()=>setSplash(null)}/>
      )}

      {/* ── Top bar ── */}
      <div style={{padding:'7px 12px',background:'var(--surface)',borderBottom:'1px solid var(--border)',
        display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,color:'var(--gold)',flexShrink:0}}>
            IPL AUCTION 2025
          </span>
          {currentPool&&(
            <span style={{background:`${poolColor}22`,border:`1px solid ${poolColor}55`,color:poolColor,
              padding:'2px 9px',borderRadius:99,fontFamily:"'Barlow Condensed',sans-serif",
              fontSize:11,fontWeight:700,letterSpacing:.8,flexShrink:0}}>
              {isRapid?'⚡ RAPID ROUND':currentPool.label.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
          <span style={{fontSize:11,color:'var(--muted)',gap:6,display:'flex'}}>
            <span>🔨{soldLog.length}</span><span>❌{unsoldIds.length}</span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={()=>store.setTheme(store.theme==='dark'?'light':'dark')}>
            {store.theme==='dark'?'☀️':'🌙'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={()=>store.setSoundEnabled(!store.soundEnabled)}>
            {store.soundEnabled?'🔊':'🔇'}
          </button>
          <button className="btn btn-ghost btn-sm" style={{position:'relative'}}
            onClick={()=>store.setShowChat(!store.showChat)}>
            💬{showUnreadDot&&<span style={{position:'absolute',top:2,right:2,width:7,height:7,
              background:'var(--red)',borderRadius:'50%'}}/>}
          </button>
          {myTeamInfo&&(
            <button className="btn btn-ghost btn-sm" style={{display:'flex',alignItems:'center',gap:5}}
              onClick={()=>{store.setViewingTeamId(store.myTeamId);store.setShowTeamDrawer(true);}}>
              <img src={myTeamInfo.logo} alt="" style={{width:18,height:18,objectFit:'contain'}}/>
              <span style={{color:'var(--gold)',fontWeight:700}}>{formatPrice(myPurse)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Announcement banner */}
      <div style={{padding:'6px 14px',
        background:soldAnim?'#0d2a0d':isRapid?'#1a0d2e':'var(--surface2)',
        borderBottom:'1px solid var(--border)',textAlign:'center',fontSize:12,
        color:soldAnim?'var(--green)':'var(--muted)',
        fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:.4,flexShrink:0,transition:'background .4s'}}>
        {auction.announcement||'🎙️ IPL Auction 2025'}
      </div>

      {/* Pool progress bar */}
      {currentPool&&!isRapid&&(
        <div style={{height:3,background:'var(--surface2)',flexShrink:0}}>
          <div style={{height:'100%',background:poolColor,opacity:.7,
            width:`${(poolDone/Math.max(poolTotal,1))*100}%`,transition:'width .6s ease'}}/>
        </div>
      )}

      {/* Timer bar */}
      <div style={{height:3,background:'var(--surface2)',flexShrink:0}}>
        <div style={{height:'100%',width:`${timerPct*100}%`,
          background:timerDanger?'linear-gradient(90deg,#ef4444,#dc2626)'
            :timerWarn?'linear-gradient(90deg,#f59e0b,#d97706)'
            :announceLeft>0?'linear-gradient(90deg,#a855f7,#7c3aed)'
            :'linear-gradient(90deg,#22c55e,#16a34a)',
          transition:'width .2s linear,background .4s'}}/>
      </div>

      {/* ── Desktop layout ── */}
      <div className="dl" style={{flex:1,display:'grid',gridTemplateColumns:'1fr 285px',overflow:'hidden'}}>
        <div style={{overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:12}}>
          {currentPlayer?(
            <>
              <PlayerCard player={currentPlayer} large/>
              <BidPanel/>
              {currentPool&&!isRapid&&(
                <div style={{border:`1px solid ${poolColor}33`,borderRadius:8,padding:'8px 12px',
                  display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,color:poolColor,fontWeight:700}}>{currentPool.label}</span>
                  <span style={{fontSize:11,color:'var(--muted)'}}>{poolDone}/{poolTotal} · {poolTotal-poolDone} left</span>
                </div>
              )}
            </>
          ):(
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>
              {auction.phase==='finished'?'🏆 Auction Complete!':'⏳ Loading next player…'}
            </div>
          )}
        </div>
        <div style={{borderLeft:'1px solid var(--border)',overflowY:'auto',padding:10}}>
          <TeamsPanel/>
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="ml" style={{display:'none',flex:1,flexDirection:'column',overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto',padding:'10px 12px',display:'flex',flexDirection:'column',gap:10}}>
          {currentPlayer&&(
            <>
              <PlayerCard player={currentPlayer} large/>
              {mobileTab==='bid'?<BidPanel/>:<div style={{padding:'4px 0'}}><TeamsPanel/></div>}
            </>
          )}
        </div>
        <div style={{display:'flex',borderTop:'1px solid var(--border)',background:'var(--surface)',flexShrink:0}}>
          {(['bid','teams'] as const).map(tab=>(
            <button key={tab} onClick={()=>setMobileTab(tab)}
              style={{flex:1,padding:'11px 0',border:'none',cursor:'pointer',fontSize:13,
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:.5,
                background:mobileTab===tab?'var(--surface2)':'transparent',
                color:mobileTab===tab?'var(--gold)':'var(--muted)',
                borderTop:mobileTab===tab?'2px solid var(--gold)':'2px solid transparent',
                transition:'all .15s'}}>
              {tab==='bid'?'💰 BID':'🏏 TEAMS'}
            </button>
          ))}
        </div>
      </div>

      {store.showTeamDrawer&&<TeamDrawer/>}
      {store.showChat&&<ChatPanel onClose={()=>store.setShowChat(false)}/>}
      {showCompare&&<PlayerCompare onClose={()=>setShowCompare(false)} defaultA={comparePlayerId}/>}
      {showPredictor&&<MatchPredictor onClose={()=>setShowPredictor(false)}/>}
    </div>
  );
}
