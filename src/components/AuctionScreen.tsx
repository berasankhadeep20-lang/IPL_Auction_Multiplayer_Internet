import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { getPlayerById } from '../data/players';
import { getTeamById, IPL_TEAMS } from '../data/teams';
import { formatPrice, getBidIncrements, getSquadStatus } from '../utils/squadRules';
import { SoldEntry, PoolMeta } from '../types';
import TeamDrawer from './TeamDrawer';
import PlayerCard from './PlayerCard';

const POOL_COLORS: Record<string, string> = {
  BOWL_1:'#ef4444', BAT_1:'#3b82f6', AR:'#22c55e',
  WK:'#f59e0b', BOWL_2:'#ef4444', BAT_2:'#3b82f6', RAPID:'#a855f7',
};
function safeParse<T>(s: string, fb: T): T { try { return JSON.parse(s) as T; } catch { return fb; } }

export default function AuctionScreen() {
  const store = useGameStore();
  const { placeBid } = useGameRoom();
  const room    = store.roomData;
  const auction = room?.auction;

  const [timeLeft, setTimeLeft]     = useState(0);
  const [announceLeft, setAnnounceLeft] = useState(0); // countdown during announce delay
  const [soldAnim, setSoldAnim]     = useState(false);
  const [mobileTab, setMobileTab]   = useState<'bid'|'teams'>('bid');
  const prevQueueIdx = useRef(-1);
  const timerRef     = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => {
    if (!auction?.timerEnd) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const now = Date.now();
      setTimeLeft(Math.max(0, Math.ceil((auction.timerEnd - now) / 1000)));
      setAnnounceLeft(Math.max(0, Math.ceil((auction.biddingStartAt - now) / 1000)));
    }, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auction?.timerEnd, auction?.biddingStartAt]);

  useEffect(() => {
    if (!auction) return;
    if (auction.queueIndex !== prevQueueIdx.current && auction.hammerTeamId) {
      setSoldAnim(true); setTimeout(() => setSoldAnim(false), 2200);
    }
    prevQueueIdx.current = auction.queueIndex;
  }, [auction?.queueIndex]);

  if (!auction || !room) return null;

  const isRapid  = auction.phase === 'rapid';
  const queue    = safeParse<string[]>(auction.queue, []);
  const pools    = safeParse<PoolMeta[]>(auction.pools, []);
  const unsoldIds= safeParse<string[]>(auction.unsoldIds, []);
  const soldLog  = safeParse<SoldEntry[]>(auction.soldLog, []);

  const currentPlayerId = queue[auction.queueIndex];
  const currentPlayer   = currentPlayerId ? getPlayerById(currentPlayerId) : null;

  const currentPool = !isRapid
    ? pools.find(p => auction.queueIndex >= p.start && auction.queueIndex < p.end)
    : { name:'RAPID', label:'Rapid Round', start:0, end:0 } as PoolMeta;
  const poolColor  = POOL_COLORS[currentPool?.name ?? ''] ?? 'var(--gold)';
  const poolTotal  = currentPool ? currentPool.end - currentPool.start : 0;
  const poolDone   = currentPool ? Math.max(0, auction.queueIndex - currentPool.start) : 0;
  const poolPct    = poolTotal > 0 ? poolDone / poolTotal : 0;

  const myTeam     = store.myTeamId ? room.teams[store.myTeamId] : null;
  const myTeamInfo = store.myTeamId ? getTeamById(store.myTeamId) : null;
  const myPurse    = myTeam?.purse ?? 0;
  const mySold     = safeParse<SoldEntry[]>(myTeam?.soldPlayers ?? '[]', []);
  const myStatus   = getSquadStatus(mySold, myPurse);

  const biddingOpen = Date.now() >= auction.biddingStartAt;
  const isMyBid     = store.myTeamId === auction.currentBidderTeamId;
  const bidTeamInfo = auction.currentBidderTeamId ? getTeamById(auction.currentBidderTeamId) : null;
  const canBid      = !!(currentPlayer && myTeam && biddingOpen
    && myTeam.purse >= auction.currentBid + 5
    && myStatus.playerCount < 25
    && !(currentPlayer.nationality === 'Overseas' && myStatus.overseasCount >= 8)
    && !isMyBid);
  const increments  = getBidIncrements(auction.currentBid);

  const timerPct    = auction.timerEnd
    ? Math.max(0, Math.min(1, (auction.timerEnd - Date.now()) / (isRapid ? 12000 : 25000)))
    : 0;
  const timerDanger = timeLeft <= 5 && biddingOpen;
  const timerWarn   = timeLeft <= 8 && timeLeft > 5 && biddingOpen;

  /* ── Bid panel ─────────────────────────────────────────────────── */
  const BidPanel = () => (
    <div className="card" style={{ background:'var(--surface2)', padding:'14px 16px' }}>
      {/* Bid stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
        <div className="text-center">
          <div style={{ fontSize:10, color:'var(--muted)', marginBottom:3 }}>CURRENT BID</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28,
            color: isMyBid ? 'var(--green)' : 'var(--gold)' }}>
            {formatPrice(auction.currentBid)}
          </div>
        </div>
        <div className="text-center">
          <div style={{ fontSize:10, color:'var(--muted)', marginBottom:3 }}>LEADING</div>
          {bidTeamInfo ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
              <img src={bidTeamInfo.logo} alt="" style={{ width:30, height:30, objectFit:'contain' }}/>
              <span style={{ fontSize:11, fontWeight:700 }}>{bidTeamInfo.shortName}</span>
            </div>
          ) : (
            <div style={{ color:'var(--muted)', fontSize:12, marginTop:6 }}>No bids</div>
          )}
        </div>
        <div className="text-center">
          <div style={{ fontSize:10, color:'var(--muted)', marginBottom:3 }}>TIME</div>
          {announceLeft > 0 ? (
            <>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:'#f59e0b' }}>
                {announceLeft}s
              </div>
              <div style={{ fontSize:9, color:'#f59e0b' }}>ANNOUNCING</div>
            </>
          ) : (
            <>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32,
                color: timerDanger ? 'var(--red)' : timerWarn ? '#f59e0b' : 'var(--text)',
                animation: timerDanger ? 'sold-flash .4s infinite' : 'none' }}>
                {timeLeft}s
              </div>
              {timerDanger && auction.bidCount > 0 && <div style={{ fontSize:9, color:'var(--red)' }}>GOING TWICE!</div>}
              {timerWarn && !timerDanger && auction.bidCount > 0 && <div style={{ fontSize:9, color:'#f59e0b' }}>GOING ONCE!</div>}
            </>
          )}
        </div>
      </div>

      {/* Announce overlay */}
      {announceLeft > 0 && (
        <div style={{
          background:'#1a0d2e', border:'1px solid #a855f755',
          borderRadius:8, padding:'10px 14px',
          textAlign:'center', marginBottom:12,
          fontSize:13, color:'#c084fc',
        }}>
          🎙️ Auctioneer announcing… bidding opens in <strong>{announceLeft}s</strong>
        </div>
      )}

      {/* Bid buttons */}
      {!store.isSpectator && myTeam && (
        <>
          <div style={{ fontSize:10, color:'var(--muted)', marginBottom:7, letterSpacing:.5 }}>PLACE BID</div>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${increments.length}, 1fr)`, gap:6 }}>
            {increments.map(inc => {
              const nextBid = auction.currentBid + inc;
              return (
                <button key={inc} className="btn btn-gold"
                  style={{ padding:'8px 4px', fontSize:13 }}
                  disabled={!canBid || nextBid > myPurse}
                  onClick={() => placeBid(nextBid)}>
                  {formatPrice(nextBid)}
                </button>
              );
            })}
          </div>
          {isMyBid && <div style={{ textAlign:'center', color:'var(--green)', fontSize:12, marginTop:8 }}>✅ You are leading!</div>}
          {!canBid && !isMyBid && currentPlayer && biddingOpen && (
            <div style={{ textAlign:'center', color:'var(--muted)', fontSize:11, marginTop:8 }}>
              {myStatus.playerCount >= 25 ? '⚠️ Squad full'
                : currentPlayer.nationality === 'Overseas' && myStatus.overseasCount >= 8 ? '⚠️ Overseas cap (8/8)'
                : myPurse < auction.currentBid + 5 ? '💸 Insufficient purse' : ''}
            </div>
          )}
        </>
      )}
      {store.isSpectator && <div style={{ textAlign:'center', color:'var(--muted)', fontSize:12 }}>👁️ Spectator</div>}
    </div>
  );

  /* ── Teams panel ─────────────────────────────────────────────────────── */
  const TeamsPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:1, marginBottom:2 }}>ALL TEAMS</div>
      {IPL_TEAMS.map(team => {
        const ts = room.teams[team.id];
        if (!ts) return null;
        const sold   = safeParse<SoldEntry[]>(ts.soldPlayers, []);
        const status = getSquadStatus(sold, ts.purse);
        const leading = auction.currentBidderTeamId === team.id;
        const mine    = store.myTeamId === team.id;
        return (
          <button key={team.id}
            onClick={() => { store.setViewingTeamId(team.id); store.setShowTeamDrawer(true); }}
            style={{
              background: leading ? `${team.primary}22` : mine ? 'var(--surface2)' : 'transparent',
              border:`1px solid ${leading ? team.primary : mine ? 'var(--border)' : 'transparent'}`,
              borderRadius:7, padding:'7px 9px', cursor:'pointer', textAlign:'left',
              transition:'all .15s', color:'var(--text)',
            }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <img src={team.logo} alt="" style={{ width:24, height:24, objectFit:'contain', flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:700 }}>{team.shortName}</span>
                  {leading && <span style={{ fontSize:9, color:team.primary, fontWeight:700 }}>BID</span>}
                  {mine && !leading && <span style={{ fontSize:9, color:'var(--green)' }}>YOU</span>}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:10, color:'var(--muted)' }}>{status.playerCount}/25 {ts.isAI ? '🤖' : '👤'}</span>
                  <span style={{ fontSize:10, color:'var(--gold)' }}>{formatPrice(ts.purse)}</span>
                </div>
                <div style={{ height:2, background:'var(--border)', borderRadius:99, marginTop:3 }}>
                  <div style={{ height:'100%', borderRadius:99, background:`linear-gradient(90deg,${team.primary},${team.secondary})`,
                    width:`${(ts.purse/12000)*100}%`, transition:'width .3s' }}/>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Top bar ── */}
      <div style={{ padding:'8px 12px', background:'var(--surface)', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:2, color:'var(--gold)', flexShrink:0 }}>
            IPL 2025
          </span>
          {currentPool && (
            <span style={{ background:`${poolColor}22`, border:`1px solid ${poolColor}55`,
              color:poolColor, padding:'2px 9px', borderRadius:99,
              fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700,
              letterSpacing:.8, flexShrink:0 }}>
              {isRapid ? '⚡ RAPID' : currentPool.label.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <span style={{ fontSize:11, color:'var(--muted)', display:'flex', gap:8 }}>
            <span>🔨{soldLog.length}</span><span>❌{unsoldIds.length}</span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => store.setSoundEnabled(!store.soundEnabled)}>
            {store.soundEnabled ? '🔊' : '🔇'}
          </button>
          {myTeamInfo && (
            <button className="btn btn-ghost btn-sm" style={{ display:'flex', alignItems:'center', gap:5 }}
              onClick={() => { store.setViewingTeamId(store.myTeamId); store.setShowTeamDrawer(true); }}>
              <img src={myTeamInfo.logo} alt="" style={{ width:18, height:18, objectFit:'contain' }}/>
              <span style={{ color:'var(--gold)', fontWeight:700 }}>{formatPrice(myPurse)}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Announcement ── */}
      <div style={{ padding:'6px 14px', background: soldAnim ? '#0d2a0d' : isRapid ? '#1a0d2e' : 'var(--surface2)',
        borderBottom:'1px solid var(--border)', textAlign:'center', fontSize:12,
        color: soldAnim ? 'var(--green)' : 'var(--muted)',
        fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:.4, flexShrink:0 }}>
        {auction.announcement || '🎙️ IPL Auction 2025'}
      </div>

      {/* ── Pool + timer bars ── */}
      {currentPool && !isRapid && (
        <div style={{ height:2, background:'var(--surface2)', flexShrink:0 }}>
          <div style={{ height:'100%', background:poolColor, width:`${poolPct*100}%`, transition:'width .5s', opacity:.7 }}/>
        </div>
      )}
      <div style={{ height:3, background:'var(--surface2)', flexShrink:0 }}>
        <div style={{ height:'100%', width:`${timerPct*100}%`,
          background: timerDanger ? 'linear-gradient(90deg,#ef4444,#dc2626)'
            : timerWarn ? 'linear-gradient(90deg,#f59e0b,#d97706)'
            : announceLeft > 0 ? 'linear-gradient(90deg,#a855f7,#7c3aed)'
            : 'linear-gradient(90deg,#22c55e,#16a34a)',
          transition:'width .2s linear, background .4s' }}/>
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="desktop-layout" style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 280px', overflow:'hidden' }}>

        {/* Center */}
        <div style={{ overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:12 }}>
          {currentPlayer ? (
            <>
              <PlayerCard player={currentPlayer} large />
              <BidPanel />
              {currentPool && !isRapid && (
                <div style={{ border:`1px solid ${poolColor}33`, borderRadius:8, padding:'8px 12px',
                  display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:poolColor, fontWeight:700 }}>{currentPool.label}</span>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>{poolDone}/{poolTotal} · {poolTotal-poolDone} left</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>
              {auction.phase === 'finished' ? '🏆 Auction Complete!' : '⏳ Loading…'}
            </div>
          )}
        </div>

        {/* Teams sidebar */}
        <div style={{ borderLeft:'1px solid var(--border)', overflowY:'auto', padding:10 }}>
          <TeamsPanel />
        </div>
      </div>

      {/* ── MOBILE layout ── */}
      <style>{`
        @media (max-width: 700px) {
          .desktop-layout { display: none !important; }
          .mobile-layout  { display: flex !important; }
        }
        @media (min-width: 701px) {
          .mobile-layout  { display: none !important; }
        }
      `}</style>

      <div className="mobile-layout" style={{ display:'none', flex:1, flexDirection:'column', overflow:'hidden' }}>
        {/* Player card + content */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>
          {currentPlayer ? (
            <>
              <PlayerCard player={currentPlayer} large />
              {mobileTab === 'bid' ? <BidPanel /> : (
                <div style={{ padding:'4px 0' }}><TeamsPanel /></div>
              )}
            </>
          ) : null}
        </div>
        {/* Mobile tab bar */}
        <div style={{ display:'flex', borderTop:'1px solid var(--border)', background:'var(--surface)', flexShrink:0 }}>
          {(['bid','teams'] as const).map(tab => (
            <button key={tab}
              onClick={() => setMobileTab(tab)}
              style={{ flex:1, padding:'11px 0', border:'none', cursor:'pointer', fontSize:13,
                fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:.5,
                background: mobileTab === tab ? 'var(--surface2)' : 'transparent',
                color: mobileTab === tab ? 'var(--gold)' : 'var(--muted)',
                borderTop: mobileTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
                transition:'all .15s' }}>
              {tab === 'bid' ? '💰 BID' : '🏏 TEAMS'}
            </button>
          ))}
        </div>
      </div>

      {store.showTeamDrawer && <TeamDrawer />}
    </div>
  );
}
