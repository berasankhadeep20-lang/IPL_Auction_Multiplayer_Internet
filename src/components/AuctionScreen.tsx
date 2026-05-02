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

const POOL_COLORS:Record<string,string>={BOWL_1:'#ef4444',BAT_1:'#3b82f6',AR:'#22c55e',WK:'#f59e0b',BOWL_2:'#ef4444',BAT_2:'#3b82f6',RAPID:'#a855f7'};
function sp<T>(s:string,fb:T):T{try{return JSON.parse(s) as T;}catch{return fb;}}

// Confetti
function spawnConfetti(){
  if(typeof window==='undefined')return;
  const colors=['#f5c842','#ef4444','#22c55e','#3b82f6','#a855f7','#ff6b35'];
  for(let i=0;i<60;i++){
    const el=document.createElement('div');
    el.style.cssText=`position:fixed;top:0;left:${Math.random()*100}vw;width:8px;height:8px;
      background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:2px;
      pointer-events:none;z-index:9999;animation:confetti-fall ${1.5+Math.random()}s ease forwards;
      transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),3000);
  }
}

export default function AuctionScreen(){
  const store=useGameStore();
  const{placeBid,undoLastBid,sendChat}=useGameRoom();
  const room=store.roomData; const auction=room?.auction;
  const[timeLeft,setTimeLeft]=useState(0);
  const[announceLeft,setAnnounceLeft]=useState(0);
  const[soldAnim,setSoldAnim]=useState(false);
  const[showBidHistory,setShowBidHistory]=useState(false);
  const[mobileTab,setMobileTab]=useState<'bid'|'teams'>('bid');
  const[showUnreadDot,setShowUnreadDot]=useState(false);
  const prevQueueIdx=useRef(-1); const prevHammer=useRef<string|null>(null);
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

  useEffect(()=>{
    if(!auction)return;
    if(auction.queueIndex!==prevQueueIdx.current&&auction.hammerTeamId&&auction.hammerTeamId!==prevHammer.current){
      setSoldAnim(true); spawnConfetti(); setTimeout(()=>setSoldAnim(false),2500);
      prevHammer.current=auction.hammerTeamId;
    }
    prevQueueIdx.current=auction.queueIndex;
  },[auction?.queueIndex,auction?.hammerTeamId]);

  // unread chat dot
  const totalChat=Object.keys(room?.chat??{}).length;
  useEffect(()=>{
    if(totalChat>chatMsgCount.current&&!store.showChat) setShowUnreadDot(true);
    chatMsgCount.current=totalChat;
  },[totalChat]);
  useEffect(()=>{ if(store.showChat) setShowUnreadDot(false); },[store.showChat]);

  if(!auction||!room)return null;
  const isRapid=auction.phase==='rapid';
  const queue=sp<string[]>(auction.queue,[]);
  const pools=sp<PoolMeta[]>(auction.pools,[]);
  const unsoldIds=sp<string[]>(auction.unsoldIds,[]);
  const soldLog=sp<SoldEntry[]>(auction.soldLog,[]);
  const bidHistory=sp<BidHistoryEntry[]>(auction.bidHistory,[]);

  const currentPlayerId=queue[auction.queueIndex];
  const currentPlayer=currentPlayerId?getPlayerById(currentPlayerId):null;
  const currentPool=!isRapid?pools.find(p=>auction.queueIndex>=p.start&&auction.queueIndex<p.end):{name:'RAPID',label:'Rapid Round',start:0,end:0} as PoolMeta;
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
  const timerPct=auction.timerEnd?Math.max(0,Math.min(1,(auction.timerEnd-Date.now())/(isRapid?14000:28000))):0;
  const timerDanger=timeLeft<=5&&biddingOpen; const timerWarn=timeLeft<=8&&timeLeft>5&&biddingOpen;
  // Budget alert
  const budgetAlert=myPurse<=2000&&myPurse>0;

  const BidPanel=()=>(
    <div className="card" style={{background:'var(--surface2)',padding:'14px 16px'}}>
      {budgetAlert&&(
        <div style={{background:'#2a1000',border:'1px solid #f59e0b',borderRadius:8,padding:'6px 12px',
          marginBottom:10,fontSize:12,color:'#fbbf24',textAlign:'center',animation:'sold-flash .8s infinite'}}>
          ⚠️ Budget Alert — Only {formatPrice(myPurse)} left!
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
        <div className="text-center">
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>CURRENT BID</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:isMyBid?'var(--green)':'var(--gold)'}}>
            {formatPrice(auction.currentBid)}
          </div>
        </div>
        <div className="text-center">
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>LEADING</div>
          {bidTeamInfo?(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <img src={bidTeamInfo.logo} alt="" style={{width:30,height:30,objectFit:'contain'}}/>
              <span style={{fontSize:11,fontWeight:700}}>{bidTeamInfo.shortName}</span>
            </div>
          ):<div style={{color:'var(--muted)',fontSize:12,marginTop:6}}>No bids</div>}
        </div>
        <div className="text-center">
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>TIME</div>
          {announceLeft>0?(
            <><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:'#a855f7'}}>{announceLeft}s</div>
            <div style={{fontSize:9,color:'#a855f7'}}>ANNOUNCING</div></>
          ):(
            <><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,
              color:timerDanger?'var(--red)':timerWarn?'#f59e0b':'var(--text)',
              animation:timerDanger?'sold-flash .4s infinite':'none'}}>{timeLeft}s</div>
            {timerDanger&&auction.bidCount>0&&<div style={{fontSize:9,color:'var(--red)'}}>GOING TWICE!</div>}
            {timerWarn&&!timerDanger&&auction.bidCount>0&&<div style={{fontSize:9,color:'#f59e0b'}}>GOING ONCE!</div>}
            </>
          )}
        </div>
      </div>
      {announceLeft>0&&(
        <div style={{background:'#1a0d2e',border:'1px solid #a855f755',borderRadius:8,padding:'8px 12px',
          textAlign:'center',marginBottom:10,fontSize:12,color:'#c084fc'}}>
          🎙️ Auctioneer announcing… bidding opens in <strong>{announceLeft}s</strong>
        </div>
      )}
      {!store.isSpectator&&myTeam&&(
        <>
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:7,letterSpacing:.5}}>PLACE BID</div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${increments.length},1fr)`,gap:6}}>
            {increments.map(inc=>{
              const nb=auction.currentBid+inc;
              return(<button key={inc} className="btn btn-gold" style={{padding:'8px 4px',fontSize:13}}
                disabled={!canBid||nb>myPurse} onClick={()=>placeBid(nb)}>{formatPrice(nb)}</button>);
            })}
          </div>
          {isMyBid&&<div style={{textAlign:'center',color:'var(--green)',fontSize:12,marginTop:8}}>✅ You are leading!</div>}
          {!canBid&&!isMyBid&&currentPlayer&&biddingOpen&&(
            <div style={{textAlign:'center',color:'var(--muted)',fontSize:11,marginTop:8}}>
              {myStatus.playerCount>=25?'⚠️ Squad full'
                :currentPlayer.nationality==='Overseas'&&myStatus.overseasCount>=8?'⚠️ Overseas cap (8/8)'
                :myPurse<auction.currentBid+5?'💸 Insufficient purse':''}
            </div>
          )}
        </>
      )}
      {store.isSpectator&&<div style={{textAlign:'center',color:'var(--muted)',fontSize:12}}>👁️ Spectator</div>}
      {/* Bid history toggle */}
      {bidHistory.length>0&&(
        <button className="btn btn-ghost btn-sm" style={{marginTop:10,width:'100%'}}
          onClick={()=>setShowBidHistory(v=>!v)}>
          {showBidHistory?'▲ Hide':'▼ Show'} bid history ({bidHistory.length})
        </button>
      )}
      {showBidHistory&&(
        <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4,maxHeight:120,overflowY:'auto'}}>
          {[...bidHistory].reverse().map((b,i)=>{
            const ti=getTeamById(b.teamId);
            return(<div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'4px 8px',background:'var(--surface)',borderRadius:5,fontSize:11}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <img src={ti.logo} alt="" style={{width:16,height:16,objectFit:'contain'}}/>
                <span>{ti.shortName}</span>
              </div>
              <span style={{color:'var(--gold)',fontWeight:700}}>{formatPrice(b.amount)}</span>
            </div>);
          })}
        </div>
      )}
      {/* Host undo */}
      {store.isHost&&auction.lastSoldEntry!=='null'&&(
        <button className="btn btn-ghost btn-sm" style={{marginTop:8,width:'100%',color:'var(--red)',borderColor:'var(--red)'}}
          onClick={undoLastBid}>↩️ Undo Last Sold</button>
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
        return(<button key={team.id}
          onClick={()=>{store.setViewingTeamId(team.id);store.setShowTeamDrawer(true);}}
          style={{background:leading?`${team.primary}22`:mine?'var(--surface2)':'transparent',
            border:`1px solid ${leading?team.primary:mine?'var(--border)':'transparent'}`,
            borderRadius:7,padding:'7px 9px',cursor:'pointer',textAlign:'left',transition:'all .15s',color:'var(--text)'}}>
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <img src={team.logo} alt="" style={{width:24,height:24,objectFit:'contain',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,fontWeight:700}}>{team.shortName}</span>
                {leading&&<span style={{fontSize:9,color:team.primary,fontWeight:700}}>BID</span>}
                {mine&&!leading&&<span style={{fontSize:9,color:'var(--green)'}}>YOU</span>}
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:10,color:'var(--muted)'}}>{status.playerCount}/25 {ts.isAI?'🤖':'👤'}</span>
                <span style={{fontSize:10,color:'var(--gold)'}}>{formatPrice(ts.purse)}</span>
              </div>
              <div style={{height:2,background:'var(--border)',borderRadius:99,marginTop:3}}>
                <div style={{height:'100%',borderRadius:99,background:`linear-gradient(90deg,${team.primary},${team.secondary})`,width:`${(ts.purse/12000)*100}%`,transition:'width .3s'}}/>
              </div>
            </div>
          </div>
        </button>);
      })}
    </div>
  );

  return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden',background:'var(--bg)'}}>
      <style>{`
        @keyframes confetti-fall{to{transform:translateY(100vh) rotate(720deg);opacity:0}}
        @media(max-width:700px){.desktop-layout{display:none!important}.mobile-layout{display:flex!important}}
        @media(min-width:701px){.mobile-layout{display:none!important}}
      `}</style>

      {/* Top bar */}
      <div style={{padding:'7px 12px',background:'var(--surface)',borderBottom:'1px solid var(--border)',
        display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,color:'var(--gold)',flexShrink:0}}>IPL 2025</span>
          {currentPool&&(
            <span style={{background:`${poolColor}22`,border:`1px solid ${poolColor}55`,color:poolColor,
              padding:'2px 9px',borderRadius:99,fontFamily:"'Barlow Condensed',sans-serif",
              fontSize:11,fontWeight:700,letterSpacing:.8,flexShrink:0}}>
              {isRapid?'⚡ RAPID':currentPool.label.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          <span style={{fontSize:11,color:'var(--muted)'}}>🔨{soldLog.length} ❌{unsoldIds.length}</span>
          {/* Theme toggle */}
          <button className="btn btn-ghost btn-sm" onClick={()=>store.setTheme(store.theme==='dark'?'light':'dark')}>
            {store.theme==='dark'?'☀️':'🌙'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={()=>store.setSoundEnabled(!store.soundEnabled)}>
            {store.soundEnabled?'🔊':'🔇'}
          </button>
          {/* Chat button */}
          <button className="btn btn-ghost btn-sm" style={{position:'relative'}}
            onClick={()=>store.setShowChat(!store.showChat)}>
            💬{showUnreadDot&&<span style={{position:'absolute',top:2,right:2,width:7,height:7,background:'var(--red)',borderRadius:'50%'}}/>}
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

      {/* Announcement */}
      <div style={{padding:'6px 14px',background:soldAnim?'#0d2a0d':isRapid?'#1a0d2e':'var(--surface2)',
        borderBottom:'1px solid var(--border)',textAlign:'center',fontSize:12,
        color:soldAnim?'var(--green)':'var(--muted)',fontFamily:"'Barlow Condensed',sans-serif",
        letterSpacing:.4,flexShrink:0,transition:'background .4s'}}>
        {auction.announcement||'🎙️ IPL Auction 2025'}
      </div>

      {/* Bars */}
      {currentPool&&!isRapid&&(
        <div style={{height:2,background:'var(--surface2)',flexShrink:0}}>
          <div style={{height:'100%',background:poolColor,width:`${(poolDone/Math.max(poolTotal,1))*100}%`,opacity:.7,transition:'width .5s'}}/>
        </div>
      )}
      <div style={{height:3,background:'var(--surface2)',flexShrink:0}}>
        <div style={{height:'100%',width:`${timerPct*100}%`,
          background:timerDanger?'linear-gradient(90deg,#ef4444,#dc2626)'
            :timerWarn?'linear-gradient(90deg,#f59e0b,#d97706)'
            :announceLeft>0?'linear-gradient(90deg,#a855f7,#7c3aed)'
            :'linear-gradient(90deg,#22c55e,#16a34a)',
          transition:'width .2s linear,background .4s'}}/>
      </div>

      {/* Desktop */}
      <div className="desktop-layout" style={{flex:1,display:'grid',gridTemplateColumns:'1fr 280px',overflow:'hidden'}}>
        <div style={{overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:12}}>
          {currentPlayer?(<><PlayerCard player={currentPlayer} large/><BidPanel/>{currentPool&&!isRapid&&(
            <div style={{border:`1px solid ${poolColor}33`,borderRadius:8,padding:'8px 12px',
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:poolColor,fontWeight:700}}>{currentPool.label}</span>
              <span style={{fontSize:11,color:'var(--muted)'}}>{poolDone}/{poolTotal} · {poolTotal-poolDone} left</span>
            </div>
          )}</>):(<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>{auction.phase==='finished'?'🏆 Auction Complete!':'⏳ Loading…'}</div>)}
        </div>
        <div style={{borderLeft:'1px solid var(--border)',overflowY:'auto',padding:10}}><TeamsPanel/></div>
      </div>

      {/* Mobile */}
      <div className="mobile-layout" style={{display:'none',flex:1,flexDirection:'column',overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto',padding:'10px 12px',display:'flex',flexDirection:'column',gap:10}}>
          {currentPlayer&&(<><PlayerCard player={currentPlayer} large/>{mobileTab==='bid'?<BidPanel/>:<div style={{padding:'4px 0'}}><TeamsPanel/></div>}</>)}
        </div>
        <div style={{display:'flex',borderTop:'1px solid var(--border)',background:'var(--surface)',flexShrink:0}}>
          {(['bid','teams'] as const).map(tab=>(
            <button key={tab} onClick={()=>setMobileTab(tab)}
              style={{flex:1,padding:'11px 0',border:'none',cursor:'pointer',fontSize:13,
                fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:.5,
                background:mobileTab===tab?'var(--surface2)':'transparent',
                color:mobileTab===tab?'var(--gold)':'var(--muted)',
                borderTop:mobileTab===tab?'2px solid var(--gold)':'2px solid transparent',transition:'all .15s'}}>
              {tab==='bid'?'💰 BID':'🏏 TEAMS'}
            </button>
          ))}
        </div>
      </div>

      {store.showTeamDrawer&&<TeamDrawer/>}
      {store.showChat&&<ChatPanel onClose={()=>store.setShowChat(false)}/>}
    </div>
  );
}
