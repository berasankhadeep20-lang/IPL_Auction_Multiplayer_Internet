import { useGameStore } from '../store/useGameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { IPL_TEAMS } from '../data/teams';
import { formatPrice } from '../utils/squadRules';
import { SQUAD_RULES } from '../types';

export default function Lobby() {
  const store = useGameStore();
  const { selectTeam, joinAsSpectator, startGame } = useGameRoom();
  const room   = store.roomData;
  const teams  = room?.teams ?? {};
  const parts  = Object.values(room?.participants ?? {});

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'10px 16px', background:'var(--surface)', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:2, color:'var(--gold)' }}>
          🏏 AUCTION LOBBY
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {store.roomId && (
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ fontSize:11, color:'var(--muted)' }}>ROOM</span>
              <span style={{ background:'var(--surface2)', border:'1px solid var(--border)',
                padding:'3px 12px', borderRadius:7, fontFamily:'monospace', fontSize:15,
                color:'var(--gold)', letterSpacing:4, cursor:'pointer' }}
                onClick={() => navigator.clipboard.writeText(store.roomId!)}
                title="Click to copy">
                {store.roomId}
              </span>
            </div>
          )}
          <span style={{ fontSize:11, color:'var(--muted)' }}>👥 {parts.length}</span>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden', flexDirection:'column' }}>
        {/* Team grid */}
        <div style={{ flex:1, overflowY:'auto', padding:14 }}>
          <div style={{ marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, letterSpacing:1 }}>SELECT YOUR TEAM</h2>
            <span style={{ fontSize:11, color:'var(--muted)' }}>{Object.values(teams).filter(t=>!t.isAI).length}/10 human</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
            {IPL_TEAMS.map(team => {
              const ts = teams[team.id];
              const mine  = store.myTeamId === team.id;
              const taken = ts && !ts.isAI && ts.ownerUid !== store.uid;
              return (
                <button key={team.id} onClick={() => !taken && selectTeam(team.id)} disabled={!!taken}
                  style={{ background: mine ? `linear-gradient(135deg,${team.primary}33,${team.secondary}22)` : 'var(--surface2)',
                    border:`2px solid ${mine ? team.primary : taken ? '#333' : 'var(--border)'}`,
                    borderRadius:10, padding:'14px 10px', cursor:taken?'not-allowed':'pointer',
                    opacity:taken?.45:1, transition:'all .2s', display:'flex', flexDirection:'column',
                    alignItems:'center', gap:7, position:'relative', color:'var(--text)' }}>
                  {mine && <span style={{ position:'absolute', top:5, right:8, fontSize:9, color:team.primary, fontWeight:700 }}>✓ YOU</span>}
                  <img src={team.logo} alt={team.shortName} style={{ width:52, height:52, objectFit:'contain', borderRadius:7 }}/>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:700 }}>{team.shortName}</div>
                    <div style={{ fontSize:9, color:'var(--muted)', marginTop:1 }}>{formatPrice(SQUAD_RULES.startingPurse)}</div>
                  </div>
                  {taken && ts?.ownerName && <div style={{ fontSize:9, color:'#f59e0b' }}>🔒 {ts.ownerName}</div>}
                </button>
              );
            })}
          </div>
          {!store.isSpectator && !store.myTeamId && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop:14 }} onClick={joinAsSpectator}>
              👁️ Watch as Spectator
            </button>
          )}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop:'1px solid var(--border)', padding:'12px 16px', background:'var(--surface)',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:12, flexWrap:'wrap' }}>
          <div style={{ fontSize:11, color:'var(--muted)', display:'flex', gap:12, flexWrap:'wrap' }}>
            <span>👥 {parts.map(p=>`${p.name}${p.teamId?' ('+IPL_TEAMS.find(t=>t.id===p.teamId)?.shortName+')':''}${p.isSpectator?' 👁️':''}`).join(' · ')}</span>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--muted)' }}>📋 25 max · 🌍 8 overseas · 💰₹120Cr</span>
            {store.isHost ? (
              <button className="btn btn-gold animate-pulse-gold" onClick={startGame}>🚀 START</button>
            ) : (
              <span style={{ color:'var(--muted)', fontSize:12 }}>Waiting for host…</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
