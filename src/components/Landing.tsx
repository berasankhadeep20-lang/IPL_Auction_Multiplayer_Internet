import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { isFirebaseConfigured } from '../firebase/config';
import { IPL_TEAMS } from '../data/teams';

export default function Landing() {
  const store = useGameStore();
  const { createRoom, joinRoom } = useGameRoom();

  const [tab, setTab]         = useState<'create'|'join'>('create');
  const [name, setName]       = useState('');
  const [code, setCode]       = useState('');
  const noFirebase             = !isFirebaseConfigured();

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createRoom(name.trim());
  };

  const handleJoin = async () => {
    if (!name.trim() || !code.trim()) return;
    await joinRoom(code.trim(), name.trim());
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #0d1422 0%, #050709 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      gap: '32px',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div className="text-center" style={{ animation: 'slide-up .5s ease both' }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>🏏</div>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(36px, 8vw, 72px)',
          letterSpacing: 4,
          background: 'linear-gradient(135deg, #f5c842, #ff6b35)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
        }}>IPL AUCTION 2025</h1>
        <p style={{ color: 'var(--muted)', marginTop: 8, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, letterSpacing: 2 }}>
          MULTIPLAYER · REAL PLAYERS · LIVE BIDDING
        </p>
      </div>

      {/* Team logos marquee */}
      <div style={{ width: '100%', maxWidth: 700, overflow: 'hidden', maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
        <div style={{ display: 'flex', gap: 20, animation: 'marquee 20s linear infinite' }}>
          {[...IPL_TEAMS, ...IPL_TEAMS].map((t, i) => (
            <img key={i} src={t.logo} alt={t.shortName}
              style={{ height: 48, width: 48, objectFit: 'contain', borderRadius: 8, background: '#111', flexShrink: 0 }} />
          ))}
        </div>
        <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </div>

      {/* Firebase warning */}
      {noFirebase && (
        <div style={{
          background: '#2a1800',
          border: '1px solid #f59e0b',
          borderRadius: 10,
          padding: '12px 20px',
          maxWidth: 460,
          color: '#fbbf24',
          fontSize: 13,
          lineHeight: 1.6,
          textAlign: 'center',
        }}>
          ⚠️ <strong>Firebase not configured.</strong> Set up <code>.env</code> with your Firebase keys to enable multiplayer.
          <br />See <code>README.md</code> for setup instructions.
        </div>
      )}

      {/* Auth card */}
      {store.error && (
        <div style={{ color: 'var(--red)', background: '#2a0a0a', border: '1px solid var(--red)', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>
          {store.error}
        </div>
      )}
      <div className="card" style={{ width: '100%', maxWidth: 400, animation: 'slide-up .4s .1s ease both', opacity: 0 }}>
        {/* Tabs */}
        <div className="flex gap-2" style={{ marginBottom: 20 }}>
          {(['create','join'] as const).map(t => (
            <button key={t} className={`btn ${tab===t ? 'btn-gold' : 'btn-ghost'} w-full`}
              onClick={() => setTab(t)}>
              {t === 'create' ? '🏟️ Create Room' : '🔗 Join Room'}
            </button>
          ))}
        </div>

        <div className="flex-col gap-3">
          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>YOUR NAME</label>
            <input className="input" placeholder="e.g. Ronnie Deep" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab==='create' ? handleCreate() : handleJoin())} />
          </div>

          {tab === 'join' && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>ROOM CODE</label>
              <input className="input" placeholder="e.g. AB3X9K" value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()} />
            </div>
          )}

          <button
            className="btn btn-gold btn-lg w-full"
            style={{ marginTop: 4 }}
            onClick={tab === 'create' ? handleCreate : handleJoin}
            disabled={store.loading || !name.trim() || (tab==='join' && !code.trim()) || noFirebase}
          >
            {store.loading ? <span className="spin">⏳</span> : tab === 'create' ? '🚀 Create Auction' : '➡️ Join Auction'}
          </button>

          {/* Spectator shortcut for join */}
          {tab === 'join' && (
            <button className="btn btn-ghost btn-sm w-full"
              onClick={async () => {
                if (!name.trim() || !code.trim()) return;
                store.setMyName(name.trim());
                await joinRoom(code.trim(), name.trim());
                useGameStore.getState().setIsSpectator(true);
              }}
              disabled={!name.trim() || !code.trim() || noFirebase}
            >
              👁️ Join as Spectator
            </button>
          )}
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 600, animation: 'fade-in .6s .3s both', opacity:0 }}>
        {['🌐 Internet Multiplayer','⚡ Rapid Round','🤖 AI Teams','📊 Squad Rules',
          '🔨 Auction Hammer','👁️ Spectator Mode','🏆 Scoreboard','500+ Real Players'].map(f => (
          <span key={f} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 99, padding: '4px 14px', fontSize: 12, color: 'var(--muted)',
          }}>{f}</span>
        ))}
      </div>
    </div>
  );
}
