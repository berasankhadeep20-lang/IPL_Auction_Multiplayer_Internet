import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getTeamById, IPL_TEAMS } from '../data/teams';
import { getPlayerById } from '../data/players';
import { formatPrice, getSquadStatus } from '../utils/squadRules';
import { SoldEntry, ScoreEntry } from '../types';

function safeParse<T>(s: string, fb: T): T { try { return JSON.parse(s) as T; } catch { return fb; } }

function computeScores(room: any): ScoreEntry[] {
  return IPL_TEAMS.map(team => {
    const ts   = room.teams[team.id];
    if (!ts) return null;
    const sold = safeParse<SoldEntry[]>(ts.soldPlayers, []);
    const status = getSquadStatus(sold, ts.purse);
    const players = sold.map(e => ({ player: getPlayerById(e.playerId)!, price: e.price })).filter(x => x.player);
    let squadScore = 0;
    players.forEach(({ player, price }) => {
      const rw = player.role==='AR'?1.15:player.role==='WK'?1.1:1.0;
      squadScore += (player.rating / 10) * rw;
    });
    const efficiency = players.length
      ? players.reduce((a,{player,price}) => a + player.rating / (price/player.basePrice), 0) / players.length
      : 0;
    const totalScore = squadScore * 10 + efficiency * 5 + (status.valid ? 50 : 0);
    return {
      teamId: team.id, teamInfo: team,
      ownerName: ts.ownerName ?? 'AI',
      squadScore: Math.round(squadScore*10)/10,
      efficiency: Math.round(efficiency*10)/10,
      totalScore: Math.round(totalScore),
      purseLeft: ts.purse, players, rank: 0, isAI: ts.isAI,
    } as ScoreEntry;
  }).filter(Boolean).sort((a,b) => b!.totalScore - a!.totalScore).map((e,i) => ({ ...e!, rank:i+1 }));
}

const MEDALS = ['🥇','🥈','🥉'];

export default function Scoreboard() {
  const store  = useGameStore();
  const room   = store.roomData;
  const [exp, setExp] = useState<string|null>(null);
  if (!room) return null;
  const scores = computeScores(room);

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden',
      background:'radial-gradient(ellipse at top,#0d1422,#050709)' }}>

      <div style={{ textAlign:'center', padding:'20px 16px 12px', flexShrink:0 }}>
        <div style={{ fontSize:40 }}>🏆</div>
        <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(26px,6vw,52px)',
          letterSpacing:4, background:'linear-gradient(135deg,#f5c842,#ff6b35)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>AUCTION RESULTS</h1>
        <p style={{ color:'var(--muted)', fontSize:12 }}>Ranked by squad quality &amp; efficiency</p>
      </div>

      {/* Podium */}
      <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-end',
        gap:12, padding:'0 16px 14px', flexShrink:0, flexWrap:'wrap' }}>
        {scores.slice(0,3).map((s,i) => (
          <div key={s.teamId} style={{
            background:`linear-gradient(135deg,${s.teamInfo.primary}22,${s.teamInfo.secondary}11)`,
            border:`2px solid ${s.teamInfo.primary}`, borderRadius:14,
            padding:'12px 16px', textAlign:'center', minWidth:120,
            transform: i===0?'scale(1.07)':'scale(1)',
            order: i===0?0:i===1?-1:1,
          }}>
            <div style={{ fontSize:26 }}>{MEDALS[i]}</div>
            <img src={s.teamInfo.logo} alt="" style={{ width:44, height:44, objectFit:'contain', margin:'5px auto' }}/>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:1 }}>{s.teamInfo.shortName}</div>
            <div style={{ fontSize:10, color:'var(--muted)' }}>{s.isAI?'🤖':s.ownerName}</div>
            <div style={{ color:'var(--gold)', fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:700, marginTop:3 }}>
              {s.totalScore}pts
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 14px 20px' }}>
        <div style={{ maxWidth:720, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 70px 60px 70px 50px',
            gap:6, padding:'6px 10px', fontSize:9, color:'var(--muted)', letterSpacing:1,
            borderBottom:'1px solid var(--border)' }}>
            <span>#</span><span>TEAM</span><span className="text-center">SCORE</span>
            <span className="text-center">SQUAD</span><span className="text-center">PURSE</span>
            <span className="text-center">PL</span>
          </div>

          {scores.map(s => (
            <div key={s.teamId}>
              <button onClick={() => setExp(exp===s.teamId?null:s.teamId)}
                style={{ display:'grid', gridTemplateColumns:'36px 1fr 70px 60px 70px 50px',
                  gap:6, padding:'9px 10px', width:'100%', textAlign:'left',
                  background: s.teamId===store.myTeamId ? 'var(--surface2)' : 'transparent',
                  border:'none', borderBottom:'1px solid var(--border)',
                  cursor:'pointer', alignItems:'center', color:'var(--text)' }}>
                <span style={{ fontSize:16 }}>{MEDALS[s.rank-1]??s.rank}</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <img src={s.teamInfo.logo} alt="" style={{ width:28, height:28, objectFit:'contain', flexShrink:0 }}/>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{s.teamInfo.shortName}</div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>{s.isAI?'🤖':s.ownerName}</div>
                  </div>
                </div>
                <span className="text-center" style={{ color:'var(--gold)', fontWeight:700 }}>{s.totalScore}</span>
                <span className="text-center" style={{ fontSize:12 }}>{s.squadScore}</span>
                <span className="text-center" style={{ fontSize:12, color:'var(--green)' }}>{formatPrice(s.purseLeft)}</span>
                <span className="text-center" style={{ fontSize:12 }}>{s.players.length}</span>
              </button>
              {exp === s.teamId && (
                <div style={{ padding:'10px 14px', background:'var(--surface)', borderBottom:'1px solid var(--border)', animation:'fade-in .2s' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {s.players.sort((a,b)=>b.price-a.price).map(({ player, price }) => (
                      <div key={player.id} style={{ background:'var(--surface2)', border:'1px solid var(--border)',
                        borderRadius:6, padding:'4px 9px', fontSize:11, display:'flex', gap:5, alignItems:'center' }}>
                        <span className={`role-${player.role}`}>{player.role}</span>
                        <span>{player.name}</span>
                        <span style={{ color:'var(--gold)', fontSize:10 }}>{formatPrice(price)}</span>
                      </div>
                    ))}
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
