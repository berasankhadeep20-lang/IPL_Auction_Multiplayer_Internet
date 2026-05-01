import { useGameStore } from '../store/useGameStore';
import { getTeamById } from '../data/teams';
import { getPlayerById } from '../data/players';
import { formatPrice, getSquadStatus } from '../utils/squadRules';
import { SoldEntry } from '../types';

export default function TeamDrawer() {
  const store = useGameStore();
  const room  = store.roomData;
  const teamId = store.viewingTeamId;
  if (!room || !teamId) return null;

  const ts       = room.teams[teamId];
  const teamInfo = getTeamById(teamId);
  const sold: SoldEntry[] = JSON.parse(ts?.soldPlayers || '[]');
  const status   = getSquadStatus(sold, ts?.purse ?? 0);

  const sortedSold = [...sold].sort((a, b) => b.price - a.price);
  const roles = ['BAT','BOWL','AR','WK'] as const;

  return (
    <>
      {/* Backdrop */}
      <div onClick={() => store.setShowTeamDrawer(false)}
        style={{
          position:'fixed', inset:0,
          background:'rgba(0,0,0,.6)',
          backdropFilter:'blur(2px)',
          zIndex:100,
        }} />

      {/* Drawer */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0,
        width: Math.min(480, window.innerWidth),
        background:'var(--surface)',
        borderLeft:'1px solid var(--border)',
        zIndex:101,
        display:'flex', flexDirection:'column',
        animation:'slide-right .25s ease',
        boxShadow:'-8px 0 32px rgba(0,0,0,.6)',
      }}>
        <style>{`@keyframes slide-right { from { transform:translateX(100%); } to { transform:translateX(0); } }`}</style>

        {/* Header */}
        <div style={{
          padding:'16px 20px',
          borderBottom:'1px solid var(--border)',
          background:`linear-gradient(135deg,${teamInfo.primary}22,transparent)`,
          display:'flex', alignItems:'center', gap:14,
          flexShrink:0,
        }}>
          <img src={teamInfo.logo} alt={teamInfo.shortName}
            style={{ width:56, height:56, objectFit:'contain' }} />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:1, color:teamInfo.primary }}>
              {teamInfo.shortName}
            </div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>{teamInfo.name}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
              {ts?.isAI ? '🤖 AI' : `👤 ${ts?.ownerName ?? 'Human'}`}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm"
            onClick={() => store.setShowTeamDrawer(false)}>✕</button>
        </div>

        {/* Stats strip */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(4,1fr)',
          borderBottom:'1px solid var(--border)',
          flexShrink:0,
        }}>
          {[
            { label:'PURSE LEFT', value: formatPrice(ts?.purse ?? 0), color:'var(--gold)' },
            { label:'SQUAD', value: `${status.playerCount}/25` },
            { label:'OVERSEAS', value: `${status.overseasCount}/8` },
            { label:'WK/BAT/AR/BOWL', value: `${status.wkCount}/${status.batCount}/${status.arCount}/${status.bowlCount}` },
          ].map(s => (
            <div key={s.label} style={{
              padding:'10px 8px', textAlign:'center',
              borderRight:'1px solid var(--border)',
            }}>
              <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:.5 }}>{s.label}</div>
              <div style={{ fontSize:14, fontWeight:700, marginTop:2, color: s.color ?? 'var(--text)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Squad issues */}
        {status.issues.length > 0 && (
          <div style={{
            padding:'8px 16px',
            background:'#2a1800',
            borderBottom:'1px solid #f59e0b44',
            flexShrink:0,
          }}>
            {status.issues.map(i => (
              <div key={i} style={{ fontSize:11, color:'#fbbf24' }}>⚠️ {i}</div>
            ))}
          </div>
        )}

        {/* Player list */}
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {sold.length === 0 ? (
            <div style={{ color:'var(--muted)', textAlign:'center', marginTop:40, fontSize:14 }}>
              No players bought yet
            </div>
          ) : (
            roles.map(role => {
              const rolePlayers = sortedSold
                .map(e => ({ entry: e, player: getPlayerById(e.playerId) }))
                .filter(x => x.player?.role === role);
              if (!rolePlayers.length) return null;
              return (
                <div key={role} style={{ marginBottom:16 }}>
                  <div style={{
                    fontSize:11, letterSpacing:1, color:'var(--muted)',
                    marginBottom:6, paddingBottom:4,
                    borderBottom:'1px solid var(--border)',
                  }}>
                    {role === 'BAT' ? '🏏 BATTERS' : role === 'BOWL' ? '⚾ BOWLERS' : role === 'AR' ? '⚡ ALL-ROUNDERS' : '🥊 WK-BATTERS'}
                    {' '}({rolePlayers.length})
                  </div>
                  <div className="flex-col gap-1">
                    {rolePlayers.map(({ entry, player }) => player && (
                      <div key={entry.playerId} style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'6px 10px',
                        background:'var(--surface2)',
                        borderRadius:8,
                        border:'1px solid var(--border)',
                      }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600 }}>{player.name}</div>
                          <div style={{ display:'flex', gap:4, marginTop:2 }}>
                            <span className={`badge badge-${player.nationality === 'Indian' ? 'indian' : 'overseas'}`} style={{ fontSize:9 }}>
                              {player.nationality === 'Indian' ? '🇮🇳' : '🌍'}
                            </span>
                            <span style={{ fontSize:10, color:'var(--muted)' }}>⭐{player.rating}</span>
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--gold)' }}>
                            {formatPrice(entry.price)}
                          </div>
                          {entry.price > player.basePrice && (
                            <div style={{ fontSize:9, color:'var(--green)' }}>
                              +{formatPrice(entry.price - player.basePrice)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
