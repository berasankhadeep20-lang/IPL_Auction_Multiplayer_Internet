import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { IPL_TEAMS } from '../data/teams';
import { formatPrice } from '../utils/squadRules';
import { PoolMeta, SoldEntry } from '../types';

function safeParse<T>(s: string, fb: T): T { try { return JSON.parse(s) as T; } catch { return fb; } }

export default function PoolBreak() {
  const store = useGameStore();
  const room  = store.roomData;
  const [secs, setSecs] = useState(60);

  useEffect(() => {
    if (!room) return;
    const end  = room.auction.poolBreakEnd;
    const tick = setInterval(() => setSecs(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 200);
    return () => clearInterval(tick);
  }, [room?.auction.poolBreakEnd]);

  if (!room) return null;
  const { auction } = room;
  const pools    = safeParse<PoolMeta[]>(auction.pools, []);
  const nextPool = pools[auction.currentPoolIdx];

  return (
    <div style={{ height:'100vh', background:'radial-gradient(ellipse at 50% 30%,#0d1a2e,#050709)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:24, padding:'20px 16px', overflow:'hidden' }}>

      <div className="text-center">
        <div style={{ fontSize:12, color:'var(--muted)', letterSpacing:3, marginBottom:10 }}>POOL BREAK</div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif",
          fontSize:'clamp(80px,20vw,140px)',
          color: secs <= 10 ? 'var(--red)' : 'var(--gold)',
          lineHeight:1, animation: secs <= 10 ? 'sold-flash .5s infinite' : 'none' }}>
          {String(secs).padStart(2,'0')}
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:6 }}>seconds until next pool</div>
      </div>

      {nextPool && (
        <div className="card" style={{ textAlign:'center', maxWidth:360, width:'100%' }}>
          <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:2, marginBottom:7 }}>COMING UP NEXT</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:2,
            background:'linear-gradient(135deg,#f5c842,#ff6b35)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            {nextPool.label}
          </div>
        </div>
      )}

      {/* Mini standings */}
      <div style={{ width:'100%', maxWidth:540 }}>
        <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:1, marginBottom:8, textAlign:'center' }}>STANDINGS</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:7 }}>
          {IPL_TEAMS.map(team => {
            const ts   = room.teams[team.id];
            if (!ts) return null;
            const sold = safeParse<SoldEntry[]>(ts.soldPlayers, []);
            return (
              <div key={team.id} style={{ background:'var(--surface2)',
                border:`1px solid ${team.id===store.myTeamId ? team.primary : 'var(--border)'}`,
                borderRadius:9, padding:'8px 10px', display:'flex', alignItems:'center', gap:7 }}>
                <img src={team.logo} alt="" style={{ width:26, height:26, objectFit:'contain' }}/>
                <div>
                  <div style={{ fontSize:12, fontWeight:700 }}>{team.shortName}</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>
                    {sold.length}p · {formatPrice(ts.purse)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize:12, color:'var(--muted)' }}>🎙️ The auctioneer will resume shortly…</div>
    </div>
  );
}
