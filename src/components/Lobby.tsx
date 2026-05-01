import { useGameStore } from '../store/useGameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { IPL_TEAMS } from '../data/teams';
import { formatPrice } from '../utils/squadRules';
import { SQUAD_RULES } from '../types';

export default function Lobby() {
  const store = useGameStore();
  const { selectTeam, joinAsSpectator, startGame } = useGameRoom();

  const room    = store.roomData;
  const teams   = room?.teams ?? {};
  const parts   = Object.values(room?.participants ?? {});
  const humanCount = Object.values(teams).filter(t => !t.isAI).length;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Top bar */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:2, color:'var(--gold)' }}>
          🏏 IPL AUCTION LOBBY
        </span>
        <div className="flex gap-3 items-center">
          {store.roomId && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'var(--muted)', fontSize:12 }}>ROOM CODE</span>
              <span style={{
                background:'var(--surface2)', border:'1px solid var(--border)',
                padding:'4px 14px', borderRadius:8, fontFamily:'monospace', fontSize:16,
                color:'var(--gold)', letterSpacing:4, cursor:'pointer',
              }}
                onClick={() => navigator.clipboard.writeText(store.roomId!)}
                title="Click to copy"
              >{store.roomId}</span>
            </div>
          )}
          <span style={{ color:'var(--muted)', fontSize:12 }}>
            👥 {parts.length} connected
          </span>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Left — team grid */}
        <div style={{ flex:1, overflowY:'auto', padding:20 }}>
          <div style={{ marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, letterSpacing:1 }}>
              SELECT YOUR TEAM
            </h2>
            <span style={{ color:'var(--muted)', fontSize:12 }}>
              {humanCount} / 10 human spots filled
            </span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
            {IPL_TEAMS.map(team => {
              const ts        = teams[team.id];
              const isMine    = store.myTeamId === team.id;
              const takenByOther = ts && !ts.isAI && ts.ownerUid !== store.uid;
              const ownerName = ts?.ownerName;

              return (
                <button key={team.id}
                  onClick={() => !takenByOther && selectTeam(team.id)}
                  disabled={!!takenByOther}
                  style={{
                    background: isMine
                      ? `linear-gradient(135deg, ${team.primary}33, ${team.secondary}22)`
                      : 'var(--surface2)',
                    border: `2px solid ${isMine ? team.primary : takenByOther ? '#333' : 'var(--border)'}`,
                    borderRadius: 12,
                    padding: '16px 12px',
                    cursor: takenByOther ? 'not-allowed' : 'pointer',
                    opacity: takenByOther ? .45 : 1,
                    transition: 'all .2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative',
                  }}>
                  {isMine && (
                    <span style={{
                      position:'absolute', top:6, right:8,
                      fontSize:10, color:team.primary, fontWeight:700,
                    }}>✓ YOU</span>
                  )}
                  <img src={team.logo} alt={team.shortName}
                    style={{ width:60, height:60, objectFit:'contain', borderRadius:8 }} />
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:700, letterSpacing:.5 }}>
                      {team.shortName}
                    </div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>
                      {team.name}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>
                    💰 {formatPrice(SQUAD_RULES.startingPurse)}
                  </div>
                  {takenByOther && ownerName && (
                    <div style={{ fontSize:10, color:'#f59e0b' }}>🔒 {ownerName}</div>
                  )}
                  {ts && !ts.isAI && !takenByOther && !isMine && (
                    <div style={{ fontSize:10, color:'var(--green)' }}>✅ Available</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Spectator button */}
          {!store.isSpectator && !store.myTeamId && (
            <button className="btn btn-ghost" style={{ marginTop:16 }}
              onClick={joinAsSpectator}>
              👁️ Watch as Spectator
            </button>
          )}
          {store.isSpectator && (
            <div style={{ marginTop:16, color:'var(--muted)', fontSize:13 }}>
              👁️ You are watching as spectator
            </div>
          )}
        </div>

        {/* Right — participants + start */}
        <div style={{
          width: 260,
          borderLeft: '1px solid var(--border)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ fontSize:13, color:'var(--muted)', marginBottom:10, letterSpacing:1 }}>
              PARTICIPANTS
            </h3>
            <div className="flex-col gap-2">
              {parts.map((p, i) => (
                <div key={i} className="flex items-center gap-2" style={{ fontSize:13 }}>
                  <span style={{ fontSize:16 }}>{p.isSpectator ? '👁️' : '🎮'}</span>
                  <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  {p.teamId && (
                    <img src={IPL_TEAMS.find(t=>t.id===p.teamId)?.logo} alt=""
                      style={{ width:20, height:20, objectFit:'contain' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12, lineHeight:1.7 }}>
              <div>👤 Remaining teams: <strong style={{color:'var(--text)'}}>AI</strong></div>
              <div>📋 Max squad: <strong style={{color:'var(--text)'}}>25</strong></div>
              <div>🌍 Overseas cap: <strong style={{color:'var(--text)'}}>8</strong></div>
              <div>💰 Purse: <strong style={{color:'var(--gold)'}}>₹120 Cr</strong></div>
              <div>🏏 Players: <strong style={{color:'var(--text)'}}>500+</strong></div>
            </div>

            {store.isHost && (
              <button className="btn btn-gold btn-lg w-full animate-pulse-gold"
                onClick={startGame}
                disabled={!store.roomData?.meta.started === false && false}
              >
                🚀 START AUCTION
              </button>
            )}
            {!store.isHost && (
              <div style={{ textAlign:'center', color:'var(--muted)', fontSize:12 }}>
                Waiting for host to start…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
