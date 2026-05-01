import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { getPlayerById } from '../data/players';
import { getTeamById, IPL_TEAMS } from '../data/teams';
import { formatPrice, getBidIncrements, getSquadStatus } from '../utils/squadRules';
import { SoldEntry } from '../types';
import TeamDrawer from './TeamDrawer';
import PlayerCard from './PlayerCard';

export default function AuctionScreen() {
  const store = useGameStore();
  const { placeBid } = useGameRoom();

  const room      = store.roomData;
  const auction   = room?.auction;
  const myTeam    = store.myTeamId ? room?.teams[store.myTeamId] : null;
  const myTeamInfo = store.myTeamId ? getTeamById(store.myTeamId) : null;

  const [timeLeft, setTimeLeft] = useState(0);
  const [soldAnim, setSoldAnim] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const announcementRef = useRef<HTMLDivElement>(null);
  const prevQueueIdx = useRef(-1);

  // Timer countdown
  useEffect(() => {
    if (!auction?.timerEnd) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((auction.timerEnd - Date.now()) / 1000)));
    }, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auction?.timerEnd]);

  // Sold animation trigger
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
  const unsoldIds: string[] = JSON.parse(auction.unsoldIds || '[]');
  const soldLog: SoldEntry[]= JSON.parse(auction.soldLog || '[]');

  const currentPlayerId     = queue[auction.queueIndex];
  const currentPlayer       = currentPlayerId ? getPlayerById(currentPlayerId) : null;

  // Next 3 players
  const upcomingIds = queue.slice(auction.queueIndex + 1, auction.queueIndex + 4);
  const upcoming    = upcomingIds.map(id => getPlayerById(id)).filter(Boolean);

  const isRapid       = auction.phase === 'rapid';
  const bidTeamInfo   = auction.currentBidderTeamId ? getTeamById(auction.currentBidderTeamId) : null;

  const myPurse       = myTeam?.purse ?? 0;
  const mySold: SoldEntry[] = myTeam ? JSON.parse(myTeam.soldPlayers || '[]') : [];
  const myStatus      = getSquadStatus(mySold, myPurse);
  const canBidPlayer  = currentPlayer && myTeam
    && myTeam.purse >= auction.currentBid + 5
    && myStatus.playerCount < 25
    && !(currentPlayer.nationality === 'Overseas' && myStatus.overseasCount >= 8);

  const increments    = getBidIncrements(auction.currentBid);
  const isMyBid       = store.myTeamId === auction.currentBidderTeamId;

  const timerPct      = auction.timerEnd
    ? Math.max(0, Math.min(1, (auction.timerEnd - Date.now()) / (isRapid ? 12000 : 25000)))
    : 0;
  const timerDanger   = timeLeft <= 5;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>
      {/* Top bar */}
      <div style={{
        padding:'8px 16px',
        background:'var(--surface)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexShrink:0, gap:12,
      }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:2, color:'var(--gold)' }}>
            IPL AUCTION 2025
          </span>
          {isRapid && (
            <span style={{
              background:'linear-gradient(135deg,#ff6b35,#ef4444)',
              color:'#fff', padding:'3px 12px', borderRadius:99,
              fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:700, letterSpacing:1,
              animation:'pulse-gold 1s infinite',
            }}>⚡ RAPID ROUND</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Sold/remaining */}
          <span style={{ fontSize:12, color:'var(--muted)' }}>
            🔨 {soldLog.length} sold · ❌ {unsoldIds.length} unsold
          </span>
          {/* Sound toggle */}
          <button className="btn btn-ghost btn-sm"
            onClick={() => store.setSoundEnabled(!store.soundEnabled)}>
            {store.soundEnabled ? '🔊' : '🔇'}
          </button>
          {/* My team */}
          {myTeamInfo && (
            <button className="btn btn-ghost btn-sm flex items-center gap-2"
              onClick={() => { store.setViewingTeamId(store.myTeamId); store.setShowTeamDrawer(true); }}>
              <img src={myTeamInfo.logo} alt="" style={{ width:20, height:20, objectFit:'contain' }} />
              <span>{myTeamInfo.shortName}</span>
              <span style={{ color:'var(--gold)' }}>{formatPrice(myPurse)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Announcement banner */}
      <div ref={announcementRef} style={{
        padding:'8px 16px',
        background: soldAnim
          ? 'linear-gradient(90deg,#1a3a1a,#0d2a0d)'
          : isRapid ? '#1a0d0d' : 'var(--surface2)',
        borderBottom:'1px solid var(--border)',
        textAlign:'center',
        fontSize:14,
        color: soldAnim ? 'var(--green)' : 'var(--muted)',
        fontFamily:"'Barlow Condensed',sans-serif",
        letterSpacing:.5,
        transition:'background .4s',
        flexShrink:0,
      }}>
        {auction.announcement || '🎙️ Welcome to IPL Auction 2025!'}
      </div>

      {/* Main grid */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 320px', overflow:'hidden' }}>

        {/* Center — current player */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Timer bar */}
          <div style={{ height:4, background:'var(--surface2)', flexShrink:0 }}>
            <div style={{
              height:'100%',
              width: `${timerPct * 100}%`,
              background: timerDanger
                ? 'linear-gradient(90deg,#ef4444,#dc2626)'
                : 'linear-gradient(90deg,#22c55e,#16a34a)',
              transition:'width .2s linear',
            }} />
          </div>

          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
            {/* Player info */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>
              {currentPlayer ? (
                <>
                  <PlayerCard player={currentPlayer} large />

                  {/* Bid info */}
                  <div className="card" style={{ background:'var(--surface2)', padding:'16px 20px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
                      <div className="text-center">
                        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>CURRENT BID</div>
                        <div style={{
                          fontFamily:"'Bebas Neue',sans-serif",
                          fontSize:28,
                          color: isMyBid ? 'var(--green)' : 'var(--gold)',
                        }}>{formatPrice(auction.currentBid)}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>LEADING BID</div>
                        {bidTeamInfo ? (
                          <div className="flex-col items-center gap-1" style={{ alignItems:'center' }}>
                            <img src={bidTeamInfo.logo} alt="" style={{ width:32, height:32, objectFit:'contain' }} />
                            <span style={{ fontSize:12, fontWeight:700 }}>{bidTeamInfo.shortName}</span>
                          </div>
                        ) : (
                          <div style={{ color:'var(--muted)', fontSize:13 }}>None yet</div>
                        )}
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>TIME LEFT</div>
                        <div style={{
                          fontFamily:"'Bebas Neue',sans-serif",
                          fontSize:32,
                          color: timerDanger ? 'var(--red)' : 'var(--text)',
                          animation: timerDanger ? 'sold-flash .5s infinite' : 'none',
                        }}>{timeLeft}s</div>
                      </div>
                    </div>

                    {/* Bid buttons */}
                    {!store.isSpectator && myTeam && (
                      <div>
                        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:8 }}>PLACE BID</div>
                        <div className="flex gap-2" style={{ flexWrap:'wrap' }}>
                          {increments.map(inc => {
                            const nextBid = auction.currentBid + inc;
                            const canBid  = canBidPlayer && nextBid <= myPurse;
                            return (
                              <button key={inc}
                                className="btn btn-gold"
                                style={{ flex:1, minWidth:80 }}
                                disabled={!canBid || isMyBid}
                                onClick={() => placeBid(nextBid)}
                              >
                                {formatPrice(nextBid)}
                              </button>
                            );
                          })}
                        </div>
                        {isMyBid && (
                          <div style={{ color:'var(--green)', fontSize:12, marginTop:8, textAlign:'center' }}>
                            ✅ You are the leading bidder!
                          </div>
                        )}
                        {!canBidPlayer && !isMyBid && (
                          <div style={{ color:'var(--muted)', fontSize:12, marginTop:8, textAlign:'center' }}>
                            {myStatus.playerCount >= 25 ? '⚠️ Squad full (25/25)' :
                             currentPlayer?.nationality === 'Overseas' && myStatus.overseasCount >= 8 ? '⚠️ Overseas limit reached (8/8)' :
                             myPurse < auction.currentBid + 5 ? '💸 Insufficient purse' : ''}
                          </div>
                        )}
                      </div>
                    )}
                    {store.isSpectator && (
                      <div style={{ textAlign:'center', color:'var(--muted)', fontSize:12 }}>👁️ Spectator mode</div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>
                  {auction.phase === 'finished' ? '🏆 Auction Complete!' : 'Loading...'}
                </div>
              )}
            </div>

            {/* Up next */}
            <div style={{
              width: 180,
              borderLeft:'1px solid var(--border)',
              overflowY:'auto',
              padding:12,
              flexShrink:0,
            }}>
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:10, letterSpacing:1 }}>COMING UP</div>
              <div className="flex-col gap-2">
                {upcoming.map((p, i) => p && (
                  <div key={p.id} style={{
                    background:'var(--surface2)',
                    border:'1px solid var(--border)',
                    borderRadius:8,
                    padding:'8px 10px',
                    opacity: 1 - i * 0.2,
                  }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{p.name}</div>
                    <div style={{ display:'flex', gap:4, marginTop:4 }}>
                      <span className={`badge badge-${p.role.toLowerCase()}`}>{p.role}</span>
                      <span style={{ fontSize:10, color:'var(--muted)' }}>⭐{p.rating}</span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{formatPrice(p.basePrice)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — all teams */}
        <div style={{
          borderLeft:'1px solid var(--border)',
          overflowY:'auto',
          padding:12,
          display:'flex',
          flexDirection:'column',
          gap:8,
        }}>
          <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4, letterSpacing:1 }}>ALL TEAMS</div>
          {IPL_TEAMS.map(team => {
            const ts   = room.teams[team.id];
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
                  border: `1px solid ${isLeading ? team.primary : isMyTeam ? 'var(--border)' : 'transparent'}`,
                  borderRadius:8,
                  padding:'8px 10px',
                  cursor:'pointer',
                  textAlign:'left',
                  transition:'all .15s',
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <img src={team.logo} alt="" style={{ width:28, height:28, objectFit:'contain', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:13, fontWeight:700 }}>{team.shortName}</span>
                      {isLeading && <span style={{ fontSize:10, color:team.primary, fontWeight:700 }}>LEADING</span>}
                      {isMyTeam && !isLeading && <span style={{ fontSize:10, color:'var(--green)' }}>YOU</span>}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                      <span style={{ fontSize:11, color:'var(--muted)' }}>
                        {status.playerCount}/25 · {ts.isAI ? '🤖' : '👤' + (ts.ownerName ?? '')}
                      </span>
                      <span style={{ fontSize:11, color:'var(--gold)' }}>{formatPrice(ts.purse)}</span>
                    </div>
                    {/* Mini purse bar */}
                    <div style={{ height:3, background:'var(--border)', borderRadius:99, marginTop:4 }}>
                      <div style={{
                        height:'100%',
                        borderRadius:99,
                        background: `linear-gradient(90deg,${team.primary},${team.secondary})`,
                        width:`${(ts.purse / 12000) * 100}%`,
                        transition:'width .3s',
                      }} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Team drawer */}
      {store.showTeamDrawer && <TeamDrawer />}
    </div>
  );
}
