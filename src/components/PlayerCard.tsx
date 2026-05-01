import { Player } from '../types';
import { formatPrice } from '../utils/squadRules';

interface Props { player: Player; large?: boolean; price?: number; }

const FORM_COLOR: Record<string, string> = {
  Excellent: '#22c55e', Good: '#84cc16', Average: '#f59e0b', Poor: '#ef4444',
};

export default function PlayerCard({ player, large, price }: Props) {
  const statLine = () => {
    const s = player.stats;
    const parts: string[] = [];
    if (s.runs)    parts.push(`${s.runs.toLocaleString()} runs`);
    if (s.wickets) parts.push(`${s.wickets} wkts`);
    if (s.average) parts.push(`Avg ${s.average}`);
    if (s.strikeRate) parts.push(`SR ${s.strikeRate}`);
    if (s.economy)    parts.push(`Eco ${s.economy}`);
    return parts.slice(0, 3).join(' · ');
  };

  if (!large) return (
    <div style={{
      background:'var(--surface2)', border:'1px solid var(--border)',
      borderRadius:8, padding:'8px 10px',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700 }}>{player.name}</div>
          <div style={{ display:'flex', gap:4, marginTop:3 }}>
            <span className={`badge badge-${player.role.toLowerCase()}`}>{player.role}</span>
            <span className={`badge badge-${player.nationality === 'Indian' ? 'indian' : 'overseas'}`}>
              {player.nationality === 'Indian' ? '🇮🇳' : '🌍'}
            </span>
          </div>
        </div>
        {price !== undefined && (
          <span style={{ color:'var(--gold)', fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:700 }}>
            {formatPrice(price)}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      background:'linear-gradient(135deg, var(--surface2), var(--surface))',
      border:'1px solid var(--border)',
      borderRadius:12,
      padding:'20px 24px',
      display:'flex',
      gap:24,
      alignItems:'center',
      animation:'slide-up .3s ease',
    }}>
      {/* Avatar placeholder */}
      <div style={{
        width:90, height:90, borderRadius:12,
        background:`linear-gradient(135deg,#1e2530,#2a3040)`,
        border:'2px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:36, flexShrink:0,
      }}>
        {player.role === 'BAT' ? '🏏' : player.role === 'BOWL' ? '⚾' : player.role === 'WK' ? '🥊' : '⚡'}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
          <h2 style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:26, fontWeight:700, lineHeight:1.1 }}>
            {player.name}
          </h2>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:10, color:'var(--muted)' }}>BASE PRICE</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:'var(--gold)' }}>
              {formatPrice(player.basePrice)}
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
          <span className={`badge badge-${player.role.toLowerCase()}`}>{player.role}</span>
          <span className={`badge badge-${player.nationality === 'Indian' ? 'indian' : 'overseas'}`}>
            {player.nationality === 'Indian' ? '🇮🇳 Indian' : '🌍 Overseas'}
          </span>
          <span style={{
            background:'#1a1a2e', color: FORM_COLOR[player.form],
            border:`1px solid ${FORM_COLOR[player.form]}44`,
            padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700,
          }}>
            {player.form} Form
          </span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px', marginTop:12 }}>
          <Stat label="Matches"    value={player.stats.matches} />
          <Stat label="Rating"     value={`⭐ ${player.rating}/98`} />
          {player.stats.runs    && <Stat label="Runs"    value={player.stats.runs.toLocaleString()} />}
          {player.stats.wickets && <Stat label="Wickets" value={player.stats.wickets} />}
          {player.stats.average    && <Stat label="Avg"  value={player.stats.average.toFixed(1)} />}
          {player.stats.strikeRate && <Stat label="SR"   value={player.stats.strikeRate.toFixed(1)} />}
          {player.stats.economy    && <Stat label="Eco"  value={player.stats.economy.toFixed(2)} />}
          {player.iplTeam && <Stat label="Usual Team" value={player.iplTeam} />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string|number }) {
  return (
    <div>
      <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:.5 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize:14, fontWeight:600, marginTop:1 }}>{value}</div>
    </div>
  );
}
