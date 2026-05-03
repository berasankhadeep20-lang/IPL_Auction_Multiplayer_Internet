import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { getPlayerById } from '../data/players';
import { getTeamById, IPL_TEAMS } from '../data/teams';
import { formatPrice, getNextBid, getSquadStatus } from '../utils/squadRules';
import { SoldEntry, PoolMeta, BidHistoryEntry } from '../types';
import TeamDrawer from './TeamDrawer';
import PlayerCard from './PlayerCard';
import ChatPanel from './ChatPanel';
import SoldSplash from './SoldSplash';
import CircularTimer from './CircularTimer';
import PlayerCompare from './PlayerCompare';
import MatchPredictor from './MatchPredictor';
import BroadcastTicker from './BroadcastTicker';
import BidWarOverlay from './BidWarOverlay';
import PoolCinematic from './PoolCinematic';

const POOL_COLORS: Record<string,string> = {
  BOWL_1:'#ef4444',BAT_1:'#3b82f6',AR:'#22c55e',
  WK:'#f59e0b',BOWL_2:'#ef4444',BAT_2:'#3b82f6',RAPID:'#a855f7',
};
function sp<T>(s:string,fb:T):T{try{return JSON.parse(s) as T;}catch{return fb;}}

function spawnConfetti(){
  const colors=['#f5c842','#ef4444','#22c55e','#3b82f6','#a855f7','#ff6b35'];
  for(let i=0;i<70;i++){
    const el=document.createElement('div');
    const size=5+Math.random()*9;
    el.style.cssText=`position:fixed;top:-12px;left:${Math.random()*100}vw;
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      border-radius:${Math.random()>.5?'50%':'2px'};
      pointer-events:none;z-index:9999;
      animation:confetti-fall ${1.8+Math.random()*1.5}s ease-in forwards;
      transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),4000);
  }
}

export default function AuctionScreen(){
  const store=useGameStore();
  const{placeBid,sendChat,simulatePool,simulateAll}=useGameRoom();
  const room=store.roomData; const auction=room?.auction;

  const[timeLeft,setTimeLeft]=useState(0);
  const[announceLeft,setAnnounceLeft]=useState(0);
  const[soldAnim,setSoldAnim]=useState(false);
  const[splash,setSplash]=useState<{type:'sold'|'unsold';pId:string;teamId:string|null;price:number}|null>(null);
  const[showBidHistory,setShowBidHistory]=useState(false);
  const[mobileTab,setMobileTab]=useState<'bid'|'teams'>('bid');
  const[showUnreadDot,setShowUnreadDot]=useState(false);
  const[showCompare,setShowCompare]=useState(false);
  const[showPredictor,setShowPredictor]=useState(false);
  const[poolCinematic,setPoolCinematic]=useState<string|null>(null);
  const[flipKey,setFlipKey]=useState(0);
  const[bidWarActive,setBidWarActive]=useState(false);

  const prevQueueIdx=useRef(-1);
  const prevHammerTeam=useRef<string|null>(null);
  const prevHammerIdx=useRef(-1);
  const prevPoolName=useRef('');
  const prevBidCount=useRef(0);
  const bidWarTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const timerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const chatMsgCount=useRef(0);

  // Timer countdown
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

  // Sold/unsold splash + confetti + pool cinematic
  useEffect(()=>{
    if(!auction)return;
    const idxChanged=auction.queueIndex!==prevQueueIdx.current;
    if(idxChanged&&prevQueueIdx.current>=0){
      const soldLg=sp<SoldEntry[]>(auction.soldLog,[]);
      if(auction.hammerTeamId&&auction.hammerTeamId!==prevHammerTeam.current||auction.queueIndex!==prevHammerIdx.current){
        const lastSold=soldLg.slice(-1)[0];
        if(lastSold){
          setSplash({type:'sold',pId:lastSold.playerId,teamId:auction.hammerTeamId,price:lastSold.price});
          spawnConfetti();
          prevHammerTeam.current=auction.hammerTeamId;
          prevHammerIdx.current=auction.queueIndex;
        }
      } else if(!auction.hammerTeamId){
        const queue=sp<string[]>(auction.queue,[]);
        setSplash({type:'unsold',pId:queue[prevQueueIdx.current]??'',teamId:null,price:0});
      }
      setSoldAnim(true);
      setTimeout(()=>setSoldAnim(false),2500);
      setFlipKey(k=>k+1);
    }
    prevQueueIdx.current=auction.queueIndex;
  },[auction?.queueIndex,auction?.hammerTeamId]);

  // Pool cinematic on pool change
  useEffect(()=>{
    if(!auction)return;
    const pools=sp<PoolMeta[]>(auction.pools,[]);
    const cur=pools.find(p=>auction.queueIndex>=p.start&&auction.queueIndex<p.end);
    if(cur&&cur.name!==prevPoolName.current&&prevPoolName.current!==''){
      setPoolCinematic(cur.label);
    }
    if(cur) prevPoolName.current=cur.name;
  },[auction?.currentPoolIdx]);

  // Bid war detection — if 6+ bids in <10s
  useEffect(()=>{
    if(!auction)return;
    if(auction.bidCount>prevBidCount.current+1&&auction.bidCount>5){
      setBidWarActive(true);
      if(bidWarTimer.current)clearTimeout(bidWarTimer.current);
      bidWarTimer.current=setTimeout(()=>setBidWarActive(false),5000);
    }
    prevBidCount.current=auction.bidCount;
  },[auction?.bidCount]);

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

  // ── IPL-style single next bid amount ──
  const nextBidAmount=getNextBid(auction.currentBid);
  const canBid=!!(currentPlayer&&myTeam&&biddingOpen
    &&myTeam.purse>=nextBidAmount&&myStatus.playerCount<25
    &&!(currentPlayer.nationality==='Overseas'&&myStatus.overseasCount>=8)&&!isMyBid);

  const timerTotal=isRapid?14:28;
  const timerPct=auction.timerEnd?Math.max(0,Math.min(1,(auction.timerEnd-Date.now())/(timerTotal*1000))):0;
  const timerDanger=timeLeft<=5&&biddingOpen;
  const timerWarn=timeLeft<=8&&timeLeft>5&&biddingOpen;
  const budgetAlert=myPurse<=2000&&myPurse>0&&!store.isSpectator;

  // Leading team color for bid panel flash
  const leadColor=bidTeamInfo?.primary??null;

  // Splash player lookup
  const splashPlayer=splash?getPlayerById(splash.pId):null;
  const splashTeam=splash?.teamId?getTeamById(splash.teamId):null;

  const BidPanel=()=>(
    <div className="card" style={{
      background:'var(--surface2)',padding:'14px 16px',
      border:`1px solid ${isMyBid&&leadColor?leadColor+'88':'var(--border)'}`,
      boxShadow:isMyBid&&leadColor?`0 0 20px ${leadColor}33`:'none',
      transition:'border-color .4s, box-shadow .4s',
    }}>
      {budgetAlert&&(
        <div style={{background:'#2a1000',border:'1px solid #f59e0b',borderRadius:8,padding:'6px 12px',
          marginBottom:10,fontSize:12,color:'#fbbf24',textAlign:'center',animation:'sold-flash .8s infinite'}}>
          ⚠️ Budget Alert — Only {formatPrice(myPurse)} left!
        </div>
      )}

      {/* Timer + bid info row */}
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
        <CircularTimer timeLeft={timeLeft} total={timerTotal} danger={timerDanger}
          warning={timerWarn} announceLeft={announceLeft} bidCount={auction.bidCount}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:2,letterSpacing:.5}}>CURRENT BID</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:34,lineHeight:1,
            color:isMyBid?'var(--green)':'var(--gold)',
            textShadow:isMyBid?'0 0 20px rgba(34,197,94,0.4)':'0 0 20px rgba(245,200,66,0.3)'}}>
            {formatPrice(auction.currentBid)}
          </div>
          {bidTeamInfo?(
            <div style={{alignItems:'center',gap:6,marginTop:5,
              padding:'4px 10px',background:`${bidTeamInfo.primary}22`,
              border:`1px solid ${bidTeamInfo.primary}44`,borderRadius:8,
              display:'inline-flex'}}>
              <img src={bidTeamInfo.logo} alt="" style={{width:20,height:20,objectFit:'contain'}}/>
              <span style={{fontSize:12,fontWeight:700,color:bidTeamInfo.primary}}>{bidTeamInfo.shortName}</span>
              {isMyBid&&<span style={{fontSize:10,color:'var(--green)',fontWeight:700}}>← YOU</span>}
            </div>
          ):(
            <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>No bids yet — be first!</div>
          )}
        </div>
      </div>

      {/* Announce window */}
      {announceLeft>0&&(
        <div style={{background:'#1a0d2e',border:'1px solid #a855f755',borderRadius:8,padding:'8px 14px',
          textAlign:'center',marginBottom:12,fontSize:12,color:'#c084fc'}}>
          🎙️ Auctioneer announcing… bidding opens in <strong style={{fontSize:15}}>{announceLeft}s</strong>
        </div>
      )}

      {/* ── IPL-STYLE SINGLE BID BUTTON ── */}
      {!store.isSpectator&&myTeam&&(
        <div>
          {/* Next bid preview */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'8px 12px',background:'var(--surface)',borderRadius:8,
            border:'1px solid var(--border)',marginBottom:8}}>
            <div>
              <div style={{fontSize:9,color:'var(--muted)',letterSpacing:.5}}>NEXT BID</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:'var(--gold)'}}>
                {formatPrice(nextBidAmount)}
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:9,color:'var(--muted)',letterSpacing:.5}}>YOUR PURSE</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,
                color:myPurse<=2000?'var(--red)':myPurse<=5000?'#f59e0b':'var(--green)'}}>
                {formatPrice(myPurse)}
              </div>
            </div>
          </div>

          {/* Big single BID button */}
          <button
            className="btn btn-gold"
            style={{
              width:'100%',padding:'14px',fontSize:20,letterSpacing:2,
              fontFamily:"'Bebas Neue',sans-serif",
              boxShadow:canBid?'0 0 24px rgba(245,200,66,0.4)':'none',
              animation:canBid&&!isMyBid?'pulse-gold 1.5s infinite':'none',
              opacity:canBid?1:.5,
            }}
            disabled={!canBid}
            onClick={()=>placeBid(nextBidAmount)}>
            🔨 BID {formatPrice(nextBidAmount)}
          </button>

          {isMyBid&&(
            <div style={{textAlign:'center',color:'var(--green)',fontSize:13,marginTop:8,
              fontWeight:700,letterSpacing:.5,fontFamily:"'Barlow Condensed',sans-serif"}}>
              ✅ YOU ARE LEADING — Wait for others to bid!
            </div>
          )}
          {!canBid&&!isMyBid&&currentPlayer&&biddingOpen&&(
            <div style={{textAlign:'center',color:'var(--muted)',fontSize:11,marginTop:8}}>
              {myStatus.playerCount>=25?'⚠️ Squad full (25/25)'
                :currentPlayer.nationality==='Overseas'&&myStatus.overseasCount>=8?'⚠️ Overseas cap (8/8)'
                :myPurse<nextBidAmount?`💸 Need ${formatPrice(nextBidAmount - myPurse)} more`:''}
            </div>
          )}
        </div>
      )}
      {store.isSpectator&&(
        <div style={{textAlign:'center',color:'var(--muted)',fontSize:12,padding:'12px 0'}}>
          👁️ Watching as spectator
        </div>
      )}

      {/* Action row */}
      <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
        {currentPlayer&&(
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowCompare(true)}>⚖️ Compare</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowBidHistory(v=>!v)}>
          📋 Bids{bidHistory.length>0?` (${bidHistory.length})`:''}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowPredictor(true)}>📊 Predictor</button>

      </div>

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
            style={{
              background:leading?`${team.primary}22`:mine?'var(--surface2)':'transparent',
              border:`1px solid ${leading?team.primary:mine?'var(--border)':'transparent'}`,
              borderRadius:7,padding:'7px 9px',cursor:'pointer',textAlign:'left',
              transition:'all .2s',color:'var(--text)',
              boxShadow:leading?`0 0 12px ${team.primary}44`:'none',
            }}>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <img src={team.logo} alt="" style={{width:24,height:24,objectFit:'contain',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,fontWeight:700}}>{team.shortName}</span>
                  {leading&&(
                    <span style={{fontSize:9,color:team.primary,fontWeight:700,letterSpacing:.5,
                      animation:'sold-flash .5s infinite'}}>BIDDING ●</span>
                  )}
                  {mine&&!leading&&<span style={{fontSize:9,color:'var(--green)'}}>YOU</span>}
                </div>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:10,color:'var(--muted)'}}>{status.playerCount}/25 {ts.isAI?'🤖':'👤'}</span>
                  <span style={{fontSize:10,color:'var(--gold)'}}>{formatPrice(ts.purse)}</span>
                </div>
                <div style={{height:2,background:'var(--border)',borderRadius:99,marginTop:3}}>
                  <div style={{height:'100%',borderRadius:99,
                    background:`linear-gradient(90deg,${team.primary},${team.secondary})`,
                    width:`${(ts.purse/12000)*100}%`,transition:'width .4s'}}/>
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
        @keyframes confetti-fall{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(110vh) rotate(720deg)}}
        @media(max-width:700px){.dl{display:none!important}.ml{display:flex!important}}
        @media(min-width:701px){.ml{display:none!important}}
      `}</style>

      {/* Overlays */}
      {splash&&splashPlayer&&(
        <SoldSplash player={splashPlayer} team={splashTeam} price={splash.price}
          type={splash.type} onDone={()=>setSplash(null)}/>
      )}
      {poolCinematic&&(
        <PoolCinematic label={poolCinematic} onDone={()=>setPoolCinematic(null)}/>
      )}
      <BidWarOverlay active={bidWarActive}/>

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
          <span style={{fontSize:11,color:'var(--muted)',display:'flex',gap:8}}>
            <span>🔨{soldLog.length}</span><span>❌{unsoldIds.length}</span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={()=>store.setTheme(store.theme==='dark'?'light':'dark')}>
            {store.theme==='dark'?'☀️':'🌙'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={()=>store.setSoundEnabled(!store.soundEnabled)}>
            {store.soundEnabled?'🔊':'🔇'}
          </button>
          {store.isHost&&(
            <button className="btn btn-ghost btn-sm" style={{color:'#f59e0b',borderColor:'#f59e0b55',fontSize:10}}
              onClick={simulatePool} title="Skip current pool">
              ⏭️ Pool
            </button>
          )}
          {store.isHost&&(
            <button className="btn btn-ghost btn-sm" style={{color:'#ef4444',borderColor:'#ef444455',fontSize:10}}
              onClick={simulateAll} title="Simulate entire auction">
              ⚡ All
            </button>
          )}
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
        background:soldAnim?'#0d2a0d':isRapid?'#1a0d2e':`${leadColor?leadColor+'18':'var(--surface2)'}`,
        borderBottom:'1px solid var(--border)',textAlign:'center',fontSize:12,
        color:soldAnim?'var(--green)':'var(--muted)',
        fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:.4,flexShrink:0,transition:'background .5s'}}>
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

      {/* ── Desktop ── */}
      <div className="dl" style={{flex:1,display:'grid',gridTemplateColumns:'1fr 285px',overflow:'hidden',paddingBottom:28}}>
        <div style={{overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:12}}>
          {currentPlayer?(
            <>
              <PlayerCard player={currentPlayer} large flip key={`pc-${flipKey}`}/>
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
        <div style={{borderLeft:'1px solid var(--border)',overflowY:'auto',padding:10,paddingBottom:36}}>
          <TeamsPanel/>
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="ml" style={{display:'none',flex:1,flexDirection:'column',overflow:'hidden',paddingBottom:28}}>
        <div style={{flex:1,overflowY:'auto',padding:'10px 12px',display:'flex',flexDirection:'column',gap:10}}>
          {currentPlayer&&(
            <>
              <PlayerCard player={currentPlayer} large flip key={`pcm-${flipKey}`}/>
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

      {/* Bottom broadcast ticker */}
      <BroadcastTicker/>

      {store.showTeamDrawer&&<TeamDrawer/>}
      {store.showChat&&<ChatPanel onClose={()=>store.setShowChat(false)}/>}
      {showCompare&&<PlayerCompare onClose={()=>setShowCompare(false)} defaultA={currentPlayerId}/>}
      {showPredictor&&<MatchPredictor onClose={()=>setShowPredictor(false)}/>}
    </div>
  );
}
