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
  BOWL_1: '#ef4444', BAT_1: '#3b82f6', AR: '#22c55e',
  WK: '#f59e0b', BOWL_2: '#ef4444', BAT_2: '#3b82f6', RAPID: '#a855f7',
};

export default function AuctionScreen() {
  const store = useGameStore();
  const { placeBid } = useGameRoom();

  const room    = store.roomData;
  const auction = room?.auction;
  const myTeam     = store.myTeamId ? room?.teams[store.myTeamId] : null;
  const myTeamInfo = store.myTeamId ? getTeamById(store.myTeamId) : null;

  const [timeLeft, setTimeLeft] = useState(0);
  const [soldAnim, setSoldAnim] = useState(false);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevQueueIdx = useRef(-1);

  useEffect(() => {
    if (!auction?.timerEnd) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((auction.timerEnd - Date.now()) / 1000)));
    }, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auction?.timerEnd]);

  useEffect(() => {
    if (!auction) return;
    if (auction.queueIndex !== prevQueueIdx.current && auction.hammerTeamId) {
      setSoldAnim(true);
      setTimeout(() => setSoldAnim(false), 2000);
    }
    prevQueueIdx.current = auction.queueIndex;
  }, [auction?.queueIndex]);

  if (!auction || !room) return null;

  const queue: string[]     = JSON.parse(auction.queue || '[]');
  const pools: PoolMeta[]   = JSON.parse(auction.pools || '[]');
  const unsoldIds: string[] = JSON.parse(auction.unsoldIds || '[]');
  const soldLog: SoldEntry[]= JSON.parse(auction.soldLog || '[]');

  const isRapid = auction.phase === 'rapid';
  const currentPlayerId = isRapid
    ? (JSON.parse(auction.unsoldIds || '[]') as string[])[auction.queueIndex] ?? queue[auction.queueIndex]
    : queue[auction.queueIndex];
  const currentPlayer = currentPlayerId ? getPlayerById(currentPlayerId) : null;

  // Current pool
  const currentPool = !isRapid
    ? pools.find(p => auction.queueIndex >= p.start && auction.queueIndex < p.end)
    : { name: 'RAPID', label: 'Rapid Round', start: 0, end: 0 } as PoolMeta;
  const poolColor = currentPool ? (POOL_COLORS[currentPool.name] ?? 'var(--gold)') : 'var(--gold)';

  // Pool progress
  const poolTotal    = currentPool ? currentPool.end - currentPool.start : 0;
  const poolDone     = currentPool ? auction.queueIndex - currentPool.start : 0;
  const poolPct      = poolTotal > 0 ? poolDone / poolTotal : 0;

  const bidTeamInfo  = auction.currentBidderTeamId ? getTeamById(auction.currentBidderTeamId) : null;
  const myPurse      = myTeam?.purse ?? 0;
  const mySold: SoldEntry[] = myTeam ? JSON.parse(myTeam.soldPlayers || '[]') : [];
  const myStatus     = getSquadStatus(mySold, myPurse);
  const canBidPlayer = currentPlayer && myTeam
    && myTeam.purse >= auction.currentBid + 5
    && myStatus.playerCount < 25
    && !(currentPlayer.nationality === 'Overseas' && myStatus.overseasCount >= 8);
  const increments   = getBidIncrements(auction.currentBid);
  const isMyBid      = store.myTeamId === auction.currentBidderTeamId;
  const timerPct     = auction.timerEnd
    ? Math.max(0, Math.min(1, (auction.timerEnd - Date.now()) / (isRapid ? 12000 : 25000)))
    : 0;
  const timerDanger  = timeLeft <= 5;
  const timerWarning = timeLeft <= 8 && timeLeft > 5;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Top bar ── */}
      <div style={{
        padding:'8px 16px',
        background:'var(--surface)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexShrink:0, gap:12,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:2, color:'var(--gold)' }}>
            IPL AUCTION 2025
          </span>
          {/* Pool badge */}
          {currentPool && (
            <span style={{
              background: `${poolColor}22`,
              border: `1px solid ${poolColor}66`,
              color: poolColor,
              padding:'3px 12px', borderRadius:99,
              fontFamily:"'Barlow Condensed',sans-serif",
              fontSize:12, fontWeight:700, letterSpacing:1,
            }}>
              {isRapid ? '⚡ RAPID ROUND' : `🎯 ${currentPool.label.toUpperCase()}`}
            </span>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>
            🔨 {soldLog.length} sold · ❌ {unsoldIds.length} unsold
          </span>
          <button className="btn btn-ghost btn-sm"
            onClick={() => store.setSoundEnabled(!store.soundEnabled)}>
            {store.soundEnabled ? '🔊' : '🔇'}
          </button>
          {myTeamInfo && (
            <button className="btn btn-ghost btn-sm"
              style={{ display:'flex', alignItems:'center', gap:6 }}
              onClick={() => { store.setViewingTeamId(store.myTeamId); store.setShowTeamDrawer(true); }}>
              <img src={myTeamInfo.logo} alt="" style={{ width:20, height:20, objectFit:'contain' }} />
              <span>{myTeamInfo.shortName}</span>
              <span style={{ color:'var(--gold)' }}>{formatPrice(myPurse)}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Announcement banner ── */}
      <div style={{
        padding:'7px 16px',
        background: soldAnim ? '#0d2a0d' : isRapid ? '#1a0d2e' : 'var(--surface2)',
        borderBottom:'1px solid var(--border)',
        textAlign:'center', fontSize:13,
        color: soldAnim ? 'var(--green)' : 'var(--muted)',
        fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:.5,
        flexShrink:0, transition:'all .4s',
      }}>
        {auction.announcement || '🎙️ Welcome to IPL Auction 2025!'}
      </div>

      {/* ── Pool progress bar ── */}
      {currentPool && !isRapid && (
        <div style={{ height:3, background:'var(--surface2)', flexShrink:0, position:'relative' }}>
          <div style={{
            height:'100%', background: poolColor,
            width:`${poolPct*100}%`, transition:'width .5s',
            opacity:.7,
          }}/>
        </div>
      )}

      {/* ── Timer bar ── */}
      <div style={{ height:4, background:'var(--surface2)', flexShrink:0 }}>
        <div style={{
          height:'100%',
          width:`${timerPct*100}%`,
          background: timerDanger
            ? 'linear-gradient(90deg,#ef4444,#dc2626)'
            : timerWarning
              ? 'linear-gradient(90deg,#f59e0b,#d97706)'
              : 'linear-gradient(90deg,#22c55e,#16a34a)',
          transition:'width .2s linear, background .5s',
        }}/>
      </div>

      {/* ── Main grid ── */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 300px', overflow:'hidden' }}>

        {/* Center — player + bid */}
        <div style={{ overflowY:'auto', padding:'14px 18px', display:'flex', flexDirection:'column', gap:14 }}>
          {currentPlayer ? (
            <>
              <PlayerCard player={currentPlayer} large />

              {/* Bid panel */}
              <div className="card" style={{ background:'var(--surface2)', padding:'16px 18px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
                  {/* Current bid */}
                  <div className="text-center">
                    <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4, letterSpacing:.5 }}>CURRENT BID</div>
                    <div style={{
                      fontFamily:"'Bebas Neue',sans-serif", fontSize:30,
                      color: isMyBid ? 'var(--green)' : 'var(--gold)',
                    }}>{formatPrice(auction.currentBid)}</div>
                  </div>
                  {/* Leading team */}
                  <div className="text-center">
                    <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4, letterSpacing:.5 }}>LEADING</div>
                    {bidTeamInfo ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <img src={bidTeamInfo.logo} alt="" style={{ width:34, height:34, objectFit:'contain' }} />
                        <span style={{ fontSize:12, fontWeight:700 }}>{bidTeamInfo.shortName}</span>
                      </div>
                    ) : (
                      <div style={{ color:'var(--muted)', fontSize:13, marginTop:8 }}>No bids yet</div>
                    )}
                  </div>
                  {/* Timer */}
                  <div className="text-center">
                    <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4, letterSpacing:.5 }}>TIME</div>
                    <div style={{
                      fontFamily:"'Bebas Neue',sans-serif", fontSize:36,
                      color: timerDanger ? 'var(--red)' : timerWarning ? '#f59e0b' : 'var(--text)',
                      animation: timerDanger ? 'sold-flash .4s infinite' : 'none',
                    }}>{timeLeft}s</div>
                    {timerDanger && auction.bidCount > 0 && (
                      <div style={{ fontSize:10, color:'var(--red)', marginTop:-4 }}>GOING TWICE!</div>
                    )}
                    {timerWarning && !timerDanger && auction.bidCount > 0 && (
                      <div style={{ fontSize:10, color:'#f59e0b', marginTop:-4 }}>GOING ONCE!</div>
                    )}
                  </div>
                </div>

                {/* Bid buttons */}
                {!store.isSpectator && myTeam && (
                  <>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:8, letterSpacing:.5 }}>YOUR BID</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {increments.map(inc => {
                        const nextBid = auction.currentBid + inc;
                        return (
                          <button key={inc}
                            className="btn btn-gold"
                            style={{ flex:1, minWidth:80 }}
                            disabled={!canBidPlayer || isMyBid || nextBid > myPurse}
                            onClick={() => placeBid(nextBid)}>
                            {formatPrice(nextBid)}
                          </button>
                        );
                      })}
                    </div>
                    {isMyBid && (
                      <div style={{ textAlign:'center', color:'var(--green)', fontSize:12, marginTop:8 }}>
                        ✅ You are leading — defend your bid!
                      </div>
                    )}
                    {!canBidPlayer && !isMyBid && currentPlayer && (
                      <div style={{ textAlign:'center', color:'var(--muted)', fontSize:12, marginTop:8 }}>
                        {myStatus.playerCount >= 25 ? '⚠️ Squad full (25/25)' :
                         currentPlayer.nationality === 'Overseas' && myStatus.overseasCount >= 8
                           ? '⚠️ Overseas cap reached (8/8)' : '💸 Insufficient purse'}
                      </div>
                    )}
                  </>
                )}
                {store.isSpectator && (
                  <div style={{ textAlign:'center', color:'var(--muted)', fontSize:12 }}>👁️ Spectator mode</div>
                )}
              </div>

              {/* Pool status */}
              {currentPool && !isRapid && (
                <div className="card" style={{ background:'transparent', borderColor:`${poolColor}33`, padding:'10px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:poolColor, fontWeight:700 }}>
                      {currentPool.label}
                    </span>
                    <span style={{ fontSize:11, color:'var(--muted)' }}>
                      {poolDone}/{poolTotal} players · {poolTotal - poolDone} remaining
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>
              {auction.phase === 'finished' ? '🏆 Auction Complete!' : '⏳ Loading next player…'}
            </div>
          )}
        </div>

        {/* Right — all teams */}
        <div style={{
          borderLeft:'1px solid var(--border)',
          overflowY:'auto', padding:12,
          display:'flex', flexDirection:'column', gap:6,
        }}>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:1, marginBottom:4 }}>ALL TEAMS</div>
          {IPL_TEAMS.map(team => {
            const ts = room.teams[team.id];
            if (!ts) return null;
            const sold: SoldEntry[] = JSON.parse(ts.soldPlayers || '[]');
            const status = getSquadStatus(sold, ts.purse);
            const isLeading = auction.currentBidderTeamId === team.id;
            const isMyTeam  = store.myTeamId === team.id;
            return (
              <button key={team.id}
                onClick={() => { store.setViewingTeamId(team.id); store.setShowTeamDrawer(true); }}
                style={{
                  background: isLeading
                    ? `linear-gradient(135deg,${team.primary}33,${team.secondary}22)`
                    : isMyTeam ? 'var(--surface2)' : 'transparent',
                  border:`1px solid ${isLeading ? team.primary : isMyTeam ? 'var(--border)' : 'transparent'}`,
                  borderRadius:8, padding:'8px 10px',
                  cursor:'pointer', textAlign:'left', transition:'all .15s', color:'var(--text)',
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <img src={team.logo} alt="" style={{ width:26, height:26, objectFit:'contain', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:12, fontWeight:700 }}>{team.shortName}</span>
                      {isLeading && <span style={{ fontSize:9, color:team.primary, fontWeight:700 }}>LEADING</span>}
                      {isMyTeam && !isLeading && <span style={{ fontSize:9, color:'var(--green)' }}>YOU</span>}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                      <span style={{ fontSize:10, color:'var(--muted)' }}>
                        {status.playerCount}/25 {ts.isAI ? '🤖' : '👤'}
                      </span>
                      <span style={{ fontSize:10, color:'var(--gold)' }}>{formatPrice(ts.purse)}</span>
                    </div>
                    <div style={{ height:2, background:'var(--border)', borderRadius:99, marginTop:3 }}>
                      <div style={{
                        height:'100%', borderRadius:99,
                        background:`linear-gradient(90deg,${team.primary},${team.secondary})`,
                        width:`${(ts.purse/12000)*100}%`, transition:'width .3s',
                      }}/>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {store.showTeamDrawer && <TeamDrawer />}
    </div>
  );
}
