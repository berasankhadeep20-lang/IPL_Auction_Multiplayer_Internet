import { useGameStore } from '../store/useGameStore';
import { getTeamById } from '../data/teams';
import { getPlayerById } from '../data/players';
import { formatPrice, getSquadStatus } from '../utils/squadRules';
import { SoldEntry } from '../types';

function safeParse<T>(s: string, fb: T): T { try { return JSON.parse(s) as T; } catch { return fb; } }

export default function TeamDrawer() {
  const store  = useGameStore();
  const room   = store.roomData;
  const teamId = store.viewingTeamId;
  if (!room || !teamId) return null;

  const ts       = room.teams[teamId];
  const teamInfo = getTeamById(teamId);
  const sold     = safeParse<SoldEntry[]>(ts?.soldPlayers ?? '[]', []);
  const status   = getSquadStatus(sold, ts?.purse ?? 0);

  const roles = ['BAT','BOWL','AR','WK'] as const;

  return (
    <>
      <div onClick={() => store.setShowTeamDrawer(false)}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(2px)', zIndex:100 }}/>
      <div style={{ position:'fixed', top:0, right:0, bottom:0,
        width: Math.min(440, window.innerWidth),
        background:'var(--surface)', borderLeft:'1px solid var(--border)',
        zIndex:101, display:'flex', flexDirection:'column',
        animation:'slide-right .25s ease', boxShadow:'-8px 0 32px rgba(0,0,0,.6)' }}>

        {/* Header */}
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)',
          background:`linear-gradient(135deg,${teamInfo.primary}22,transparent)`,
          display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <img src={teamInfo.logo} alt="" style={{ width:50, height:50, objectFit:'contain' }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:1, color:teamInfo.primary }}>{teamInfo.shortName}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>{teamInfo.name}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>{ts?.isAI?'🤖 AI':`👤 ${ts?.ownerName??'Human'}`}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => store.setShowTeamDrawer(false)}>✕</button>
        </div>

        {/* Stats strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {[
            { label:'PURSE',   value:formatPrice(ts?.purse??0), color:'var(--gold)' },
            { label:'SQUAD',   value:`${status.playerCount}/25` },
            { label:'OVERSEAS',value:`${status.overseasCount}/8` },
            { label:'WK·BAT·AR·BOWL', value:`${status.wkCount}·${status.batCount}·${status.arCount}·${status.bowlCount}` },
          ].map(s => (
            <div key={s.label} style={{ padding:'8px 6px', textAlign:'center', borderRight:'1px solid var(--border)' }}>
              <div style={{ fontSize:8, color:'var(--muted)', letterSpacing:.5 }}>{s.label}</div>
              <div style={{ fontSize:13, fontWeight:700, marginTop:2, color:s.color??'var(--text)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Issues */}
        {status.issues.length > 0 && (
          <div style={{ padding:'7px 14px', background:'#2a1800', borderBottom:'1px solid #f59e0b44', flexShrink:0 }}>
            {status.issues.map(i => <div key={i} style={{ fontSize:11, color:'#fbbf24' }}>⚠️ {i}</div>)}
          </div>
        )}

        {/* Player list */}
        <div style={{ flex:1, overflowY:'auto', padding:14 }}>
          {sold.length === 0 ? (
            <div style={{ color:'var(--muted)', textAlign:'center', marginTop:36, fontSize:13 }}>No players yet</div>
          ) : (
            roles.map(role => {
              const rp = [...sold].sort((a,b)=>b.price-a.price)
                .map(e => ({ e, p: getPlayerById(e.playerId) }))
                .filter(x => x.p?.role === role);
              if (!rp.length) return null;
              return (
                <div key={role} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, letterSpacing:1, color:'var(--muted)',
                    marginBottom:5, paddingBottom:4, borderBottom:'1px solid var(--border)' }}>
                    {role==='BAT'?'🏏 BATTERS':role==='BOWL'?'⚾ BOWLERS':role==='AR'?'⚡ ALL-ROUNDERS':'🥊 WICKET-KEEPERS'}
                    {` (${rp.length})`}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {rp.map(({ e, p }) => p && (
                      <div key={e.playerId} style={{ display:'flex', alignItems:'center', gap:8,
                        padding:'6px 9px', background:'var(--surface2)',
                        borderRadius:7, border:'1px solid var(--border)' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>{p.name}</div>
                          <div style={{ display:'flex', gap:4, marginTop:2 }}>
                            <span className={`badge badge-${p.nationality==='Indian'?'indian':'overseas'}`} style={{ fontSize:9 }}>
                              {p.nationality==='Indian'?'🇮🇳':'🌍'}
                            </span>
                            <span style={{ fontSize:10, color:'var(--muted)' }}>⭐{p.rating}</span>
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--gold)' }}>{formatPrice(e.price)}</div>
                          {e.price > p.basePrice && (
                            <div style={{ fontSize:9, color:'var(--green)' }}>+{formatPrice(e.price-p.basePrice)}</div>
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
