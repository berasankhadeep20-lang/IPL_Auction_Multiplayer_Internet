import { useState, useEffect } from 'react';
import { Player } from '../types';
import { formatPrice } from '../utils/squadRules';
import { getPlayerImage } from '../data/playerImages';

interface Props { player: Player; large?: boolean; price?: number; flip?: boolean; }

const ROLE_COLOR: Record<string,string> = { BAT:'#60a5fa', BOWL:'#f87171', AR:'#4ade80', WK:'#fbbf24' };
const ROLE_LABEL: Record<string,string> = { BAT:'BATTER', BOWL:'BOWLER', AR:'ALL-ROUNDER', WK:'WK-BATTER' };
const FORM_COLOR: Record<string,string> = { Excellent:'#22c55e', Good:'#84cc16', Average:'#f59e0b', Poor:'#ef4444' };

function Img({ src, style }: { src: string; style: React.CSSProperties }) {
  const [err, setErr] = useState(false);
  const fb = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120'><rect width='100' height='120' fill='%231a1e25'/><circle cx='50' cy='42' r='26' fill='%232a3040'/><ellipse cx='50' cy='110' rx='38' ry='30' fill='%232a3040'/></svg>`;
  return <img src={err ? fb : src} alt="" style={style} onError={() => setErr(true)} />;
}

export default function PlayerCard({ player, large, price, flip }: Props) {
  const [revealed, setRevealed] = useState(!flip);
  const img = getPlayerImage(player.id);
  const rc = ROLE_COLOR[player.role];

  useEffect(() => {
    if (!flip) { setRevealed(true); return; }
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(t);
  }, [player.id, flip]);

  if (!large) return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <Img src={img} style={{ width:30, height:30, borderRadius:'50%', objectFit:'cover', objectPosition:'top', border:`2px solid ${rc}44`, flexShrink:0 }}/>
        <div>
          <div style={{ fontSize:13, fontWeight:700 }}>{player.name}</div>
          <div style={{ display:'flex', gap:4, marginTop:2 }}>
            <span className={`badge badge-${player.role.toLowerCase()}`}>{player.role}</span>
            <span style={{ fontSize:10, color:'var(--muted)' }}>⭐{player.rating}</span>
          </div>
        </div>
      </div>
      {price !== undefined && <span style={{ color:'var(--gold)', fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, fontWeight:700 }}>{formatPrice(price)}</span>}
    </div>
  );

  return (
    <div style={{ perspective:'1200px' }}>
      <div style={{
        position:'relative', transformStyle:'preserve-3d',
        transition:'transform 0.65s cubic-bezier(0.4,0,0.2,1)',
        transform: revealed ? 'rotateY(0deg)' : 'rotateY(180deg)',
        borderRadius:14, minHeight:160,
      }}>
        {/* ── FRONT ── */}
        <div style={{
          backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
          background:`linear-gradient(135deg,${rc}15,var(--surface2) 55%)`,
          border:`1px solid ${rc}44`, borderRadius:14,
          padding:'14px 16px', display:'flex', gap:16, alignItems:'stretch',
          boxShadow:`0 0 30px ${rc}18`,
        }}>
          {/* Image column */}
          <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <div style={{
              width:86, height:108, borderRadius:10, overflow:'hidden', flexShrink:0,
              border:`2px solid ${rc}66`, background:'var(--surface)',
              boxShadow:`0 4px 24px ${rc}33`,
            }}>
              <Img src={img} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center' }}/>
            </div>
            <div style={{
              background:`${rc}22`, border:`1px solid ${rc}55`, color:rc,
              padding:'2px 7px', borderRadius:99, fontFamily:"'Barlow Condensed',sans-serif",
              fontSize:9, fontWeight:700, letterSpacing:1, textAlign:'center',
            }}>{ROLE_LABEL[player.role]}</div>
          </div>

          {/* Info column */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
              <h2 style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:'clamp(18px,3vw,23px)', fontWeight:700, lineHeight:1.1 }}>
                {player.name}
              </h2>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:9, color:'var(--muted)' }}>BASE PRICE</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:'var(--gold)', lineHeight:1 }}>
                  {formatPrice(player.basePrice)}
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:5, marginTop:7, flexWrap:'wrap', alignItems:'center' }}>
              <span className={`badge badge-${player.nationality==='Indian'?'indian':'overseas'}`}>
                {player.nationality==='Indian'?'🇮🇳 Indian':'🌍 Overseas'}
              </span>
              <span style={{
                background:`${FORM_COLOR[player.form]}22`, border:`1px solid ${FORM_COLOR[player.form]}55`,
                color:FORM_COLOR[player.form], padding:'2px 7px', borderRadius:99, fontSize:10, fontWeight:700,
              }}>{player.form}</span>
              <span style={{ fontSize:11, color:'var(--muted)' }}>⭐{player.rating}/98</span>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(76px,1fr))', gap:'4px 10px', marginTop:10 }}>
              <S label="Matches" value={player.stats.matches}/>
              {player.stats.runs      && <S label="IPL Runs"  value={player.stats.runs.toLocaleString()}/>}
              {player.stats.wickets   && <S label="Wickets"   value={player.stats.wickets}/>}
              {player.stats.average   && <S label="Avg"       value={player.stats.average.toFixed(1)}/>}
              {player.stats.strikeRate && <S label="SR"       value={player.stats.strikeRate.toFixed(1)}/>}
              {player.stats.economy   && <S label="Economy"   value={player.stats.economy.toFixed(2)}/>}
              {player.iplTeam         && <S label="Team"      value={player.iplTeam}/>}
            </div>
          </div>
        </div>

        {/* ── BACK ── */}
        <div style={{
          position:'absolute', inset:0,
          backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
          transform:'rotateY(180deg)',
          background:'linear-gradient(135deg,#0d1020,#1a1e25)',
          border:'1px solid var(--border)', borderRadius:14,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <div style={{ fontSize:14, color:'rgba(245,200,66,0.4)', letterSpacing:3, fontFamily:"'Barlow Condensed',sans-serif" }}>
            IPL AUCTION 2025
          </div>
          <div style={{ fontSize:48, color:'rgba(245,200,66,0.15)', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:4 }}>🏏</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.15)', letterSpacing:2 }}>NEXT PLAYER</div>
        </div>
      </div>
    </div>
  );
}

function S({ label, value }: { label:string; value:string|number }) {
  return (
    <div>
      <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:.4 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize:12, fontWeight:600, marginTop:1 }}>{value}</div>
    </div>
  );
}
