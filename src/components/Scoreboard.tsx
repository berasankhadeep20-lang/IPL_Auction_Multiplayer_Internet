import { useGameStore } from '../store/useGameStore';
import { getTeamById, IPL_TEAMS } from '../data/teams';
import { getPlayerById } from '../data/players';
import { formatPrice, getSquadStatus } from '../utils/squadRules';
import { SoldEntry, ScoreEntry } from '../types';
import { useState } from 'react';

function computeScores(room: any): ScoreEntry[] {
  return IPL_TEAMS.map(team => {
    const ts   = room.teams[team.id];
    if (!ts) return null;
    const sold: SoldEntry[] = JSON.parse(ts.soldPlayers || '[]');
    const status = getSquadStatus(sold, ts.purse);

    // Score = sum of (player.rating * price_multiplier * role_weight)
    let squadScore = 0;
    const players = sold.map(e => ({
      player: getPlayerById(e.playerId)!,
      price:  e.price,
    })).filter(x => x.player);

    players.forEach(({ player, price }) => {
      const roleWeight = player.role === 'AR' ? 1.15 : player.role === 'WK' ? 1.1 : 1.0;
      squadScore += (player.rating / 10) * roleWeight;
    });

    const purseLeft   = ts.purse;
    const efficiency  = players.length > 0
      ? players.reduce((acc, { player, price }) => acc + player.rating / (price / player.basePrice), 0) / players.length
      : 0;

    const totalScore = squadScore * 10 + efficiency * 5 + (status.valid ? 50 : 0);

    return {
      teamId: team.id,
      teamInfo: team,
      ownerName: ts.ownerName ?? 'AI',
      squadScore: Math.round(squadScore * 10) / 10,
      efficiency:  Math.round(efficiency * 10) / 10,
      totalScore:  Math.round(totalScore),
      purseLeft,
      players,
      rank: 0,
      isAI: ts.isAI,
    } as ScoreEntry;
  })
    .filter(Boolean)
    .sort((a, b) => b!.totalScore - a!.totalScore)
    .map((e, i) => ({ ...e!, rank: i + 1 }));
}

const MEDALS = ['🥇','🥈','🥉'];

export default function Scoreboard() {
  const store = useGameStore();
  const room  = store.roomData;
  const [expanded, setExpanded] = useState<string|null>(null);

  if (!room) return null;
  const scores = computeScores(room);

  return (
    <div style={{
      height:'100vh', overflow:'hidden',
      background:'radial-gradient(ellipse at top, #0d1422 0%, #050709 100%)',
      display:'flex', flexDirection:'column',
    }}>
      {/* Header */}
      <div style={{ textAlign:'center', padding:'28px 20px 16px', flexShrink:0 }}>
        <div style={{ fontSize:48 }}>🏆</div>
        <h1 style={{
          fontFamily:"'Bebas Neue',sans-serif",
          fontSize:'clamp(28px,6vw,56px)',
          letterSpacing:4,
          background:'linear-gradient(135deg,#f5c842,#ff6b35)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
        }}>AUCTION RESULTS</h1>
        <p style={{ color:'var(--muted)', fontSize:13 }}>Final standings based on squad quality &amp; efficiency</p>
      </div>

      {/* Podium for top 3 */}
      <div style={{
        display:'flex', justifyContent:'center', alignItems:'flex-end',
        gap:16, padding:'0 20px 16px', flexShrink:0,
        flexWrap:'wrap',
      }}>
        {scores.slice(0, 3).map((s, i) => (
          <div key={s.teamId} style={{
            background:`linear-gradient(135deg,${s.teamInfo.primary}22,${s.teamInfo.secondary}11)`,
            border:`2px solid ${s.teamInfo.primary}`,
            borderRadius:16,
            padding:'16px 20px',
            textAlign:'center',
            minWidth:140,
            transform: i === 0 ? 'scale(1.08)' : 'scale(1)',
            order: i === 0 ? 0 : i === 1 ? -1 : 1,
          }}>
            <div style={{ fontSize:32 }}>{MEDALS[i]}</div>
            <img src={s.teamInfo.logo} alt="" style={{ width:52, height:52, objectFit:'contain', margin:'6px auto' }} />
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:1 }}>{s.teamInfo.shortName}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>{s.isAI ? '🤖 AI' : s.ownerName}</div>
            <div style={{ color:'var(--gold)', fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:700, marginTop:4 }}>
              {s.totalScore} pts
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
              {s.players.length} players · {formatPrice(s.purseLeft)} left
            </div>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 20px 24px' }}>
        <div style={{ maxWidth:780, margin:'0 auto' }}>
          {/* Header row */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'40px 1fr 80px 80px 80px 80px',
            gap:8, padding:'8px 12px',
            fontSize:10, color:'var(--muted)', letterSpacing:1,
            borderBottom:'1px solid var(--border)',
          }}>
            <span>#</span><span>TEAM</span><span className="text-center">SCORE</span>
            <span className="text-center">SQUAD</span><span className="text-center">PURSE</span>
            <span className="text-center">PLAYERS</span>
          </div>

          {scores.map(s => (
            <div key={s.teamId}>
              <button
                onClick={() => setExpanded(expanded === s.teamId ? null : s.teamId)}
                style={{
                  display:'grid',
                  gridTemplateColumns:'40px 1fr 80px 80px 80px 80px',
                  gap:8, padding:'10px 12px',
                  width:'100%', textAlign:'left',
                  background: s.teamId === store.myTeamId ? 'var(--surface2)' : 'transparent',
                  border:'none',
                  borderBottom:'1px solid var(--border)',
                  cursor:'pointer',
                  alignItems:'center',
                  color:'var(--text)',
                  transition:'background .15s',
                }}>
                <span style={{ fontSize:18 }}>{MEDALS[s.rank-1] ?? s.rank}</span>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <img src={s.teamInfo.logo} alt="" style={{ width:32, height:32, objectFit:'contain' }} />
                  <div>
                    <div style={{ fontWeight:700 }}>{s.teamInfo.shortName}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{s.isAI ? '🤖' : '👤'} {s.ownerName}</div>
                  </div>
                </div>
                <span className="text-center" style={{ color:'var(--gold)', fontWeight:700 }}>{s.totalScore}</span>
                <span className="text-center" style={{ fontSize:12 }}>{s.squadScore}</span>
                <span className="text-center" style={{ fontSize:12, color:'var(--green)' }}>{formatPrice(s.purseLeft)}</span>
                <span className="text-center" style={{ fontSize:12 }}>{s.players.length}</span>
              </button>

              {/* Expanded squad */}
              {expanded === s.teamId && (
                <div style={{
                  padding:'12px 16px',
                  background:'var(--surface)',
                  borderBottom:'1px solid var(--border)',
                  animation:'fade-in .2s ease',
                }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {s.players
                      .sort((a,b) => b.price - a.price)
                      .map(({ player, price }) => (
                        <div key={player.id} style={{
                          background:'var(--surface2)',
                          border:'1px solid var(--border)',
                          borderRadius:6, padding:'5px 10px',
                          fontSize:12,
                          display:'flex', gap:6, alignItems:'center',
                        }}>
                          <span className={`role-${player.role}`}>{player.role}</span>
                          <span>{player.name}</span>
                          <span style={{ color:'var(--gold)', fontSize:11 }}>{formatPrice(price)}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
