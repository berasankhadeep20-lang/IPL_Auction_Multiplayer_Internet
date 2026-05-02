import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { isFirebaseConfigured } from '../firebase/config';
import { IPL_TEAMS } from '../data/teams';

export default function Landing() {
  const store = useGameStore();
  const { createRoom, joinRoom } = useGameRoom();
  const [tab,  setTab]  = useState<'create'|'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const noFire = !isFirebaseConfigured();

  const go = () => tab === 'create' ? createRoom(name.trim()) : joinRoom(code.trim(), name.trim());

  return (
    <div style={{ minHeight:'100vh', background:'radial-gradient(ellipse at top,#0d1422,#050709)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'24px 16px', gap:24, overflowY:'auto' }}>

      {/* Title */}
      <div className="text-center" style={{ animation:'slide-up .5s ease' }}>
        <div style={{ fontSize:56, marginBottom:6 }}>🏏</div>
        <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(34px,10vw,72px)',
          letterSpacing:4, lineHeight:1,
          background:'linear-gradient(135deg,#f5c842,#ff6b35)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          IPL AUCTION 2025
        </h1>
        <p style={{ color:'var(--muted)', marginTop:6,
          fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, letterSpacing:2 }}>
          MULTIPLAYER · 500+ REAL PLAYERS · LIVE BIDDING
        </p>
      </div>

      {/* Logo marquee */}
      <div style={{ width:'100%', maxWidth:600, overflow:'hidden',
        maskImage:'linear-gradient(to right,transparent,black 15%,black 85%,transparent)' }}>
        <div style={{ display:'flex', gap:16, animation:'marquee 18s linear infinite' }}>
          {[...IPL_TEAMS,...IPL_TEAMS].map((t,i) => (
            <img key={i} src={t.logo} alt={t.shortName}
              style={{ height:44, width:44, objectFit:'contain', borderRadius:8, background:'#111', flexShrink:0 }}/>
          ))}
        </div>
      </div>

      {/* Firebase warning */}
      {noFire && (
        <div style={{ background:'#2a1800', border:'1px solid #f59e0b', borderRadius:10,
          padding:'10px 18px', maxWidth:420, color:'#fbbf24', fontSize:12, textAlign:'center', lineHeight:1.7 }}>
          ⚠️ Firebase not configured. Add your keys to <code>.env</code>
        </div>
      )}

      {store.error && (
        <div style={{ color:'var(--red)', background:'#2a0a0a', border:'1px solid var(--red)',
          borderRadius:8, padding:'7px 16px', fontSize:13 }}>{store.error}</div>
      )}

      {/* Card */}
      <div className="card" style={{ width:'100%', maxWidth:380, animation:'slide-up .4s .1s ease both', opacity:0 }}>
        <div style={{ display:'flex', gap:8, marginBottom:18 }}>
          {(['create','join'] as const).map(t => (
            <button key={t} className={`btn ${tab===t?'btn-gold':'btn-ghost'} w-full`} onClick={() => setTab(t)}>
              {t==='create'?'🏟️ Create':'🔗 Join'}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:5 }}>YOUR NAME</label>
            <input className="input" placeholder="e.g. Ronnie Deep" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key==='Enter' && go()} />
          </div>
          {tab==='join' && (
            <div>
              <label style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:5 }}>ROOM CODE</label>
              <input className="input" placeholder="e.g. AB3X9K" value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key==='Enter' && go()} />
            </div>
          )}
          <button className="btn btn-gold btn-lg w-full" style={{ marginTop:4 }}
            onClick={go}
            disabled={store.loading || !name.trim() || (tab==='join' && !code.trim()) || noFire}>
            {store.loading ? <span className="spin">⏳</span> : tab==='create' ? '🚀 Create Room' : '➡️ Join Room'}
          </button>
          {tab==='join' && (
            <button className="btn btn-ghost btn-sm w-full"
              disabled={!name.trim() || !code.trim() || noFire}
              onClick={async () => {
                store.setMyName(name.trim());
                await joinRoom(code.trim(), name.trim());
                useGameStore.getState().setIsSpectator(true);
              }}>
              👁️ Spectator Mode
            </button>
          )}
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:7, justifyContent:'center', maxWidth:560,
        animation:'fade-in .6s .3s both', opacity:0 }}>
        {['🌐 Internet Multiplayer','⚡ Rapid Round','🤖 AI Teams','📋 Squad Rules',
          '🎙️ Auctioneer Voice','👁️ Spectator Mode','🏆 Scoreboard','500+ Real Players'].map(f => (
          <span key={f} style={{ background:'var(--surface2)', border:'1px solid var(--border)',
            borderRadius:99, padding:'4px 12px', fontSize:11, color:'var(--muted)' }}>{f}</span>
        ))}
      </div>
    </div>
  );
}
