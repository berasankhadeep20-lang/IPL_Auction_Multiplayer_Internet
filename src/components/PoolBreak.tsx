import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { PoolMeta } from '../types';
import { IPL_TEAMS } from '../data/teams';
import { formatPrice } from '../utils/squadRules';
import { SoldEntry } from '../types';

export default function PoolBreak() {
  const store = useGameStore();
  const room  = store.roomData;
  const [secsLeft, setSecsLeft] = useState(60);

  useEffect(() => {
    if (!room) return;
    const end = room.auction.poolBreakEnd;
    const tick = setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecsLeft(s);
    }, 200);
    return () => clearInterval(tick);
  }, [room?.auction.poolBreakEnd]);

  if (!room) return null;
  const { auction } = room;
  const pools: PoolMeta[] = JSON.parse(auction.pools || '[]');
  const nextPool = pools[auction.currentPoolIdx];
  const teams = room.teams;

  return (
    <div style={{
      height: '100vh',
      background: 'radial-gradient(ellipse at 50% 30%, #0d1a2e 0%, #050709 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 32, padding: 24, overflow: 'hidden',
    }}>
      {/* Break clock */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--muted)', letterSpacing: 3, marginBottom: 12 }}>
          POOL BREAK
        </div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(72px, 18vw, 140px)',
          color: secsLeft <= 10 ? 'var(--red)' : 'var(--gold)',
          lineHeight: 1,
          transition: 'color .3s',
          animation: secsLeft <= 10 ? 'sold-flash .5s infinite' : 'none',
        }}>{String(secsLeft).padStart(2, '0')}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>seconds until next pool</div>
      </div>

      {/* Next pool announcement */}
      {nextPool && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '20px 36px',
          textAlign: 'center',
          maxWidth: 400,
        }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: 2, marginBottom: 8 }}>COMING UP NEXT</div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 32,
            letterSpacing: 2,
            background: 'linear-gradient(135deg, #f5c842, #ff6b35)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>{nextPool.label}</div>
        </div>
      )}

      {/* Mini leaderboard */}
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, marginBottom: 10, textAlign: 'center' }}>
          CURRENT STANDINGS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {IPL_TEAMS.map(team => {
            const ts = teams[team.id];
            if (!ts) return null;
            const sold: SoldEntry[] = JSON.parse(ts.soldPlayers || '[]');
            return (
              <div key={team.id} style={{
                background: 'var(--surface2)',
                border: `1px solid ${team.id === store.myTeamId ? team.primary : 'var(--border)'}`,
                borderRadius: 10,
                padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
                minWidth: 140,
              }}>
                <img src={team.logo} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{team.shortName}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {sold.length} players · {formatPrice(ts.purse)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', animation: 'fade-in .5s ease' }}>
        🎙️ The auctioneer will resume shortly…
      </div>
    </div>
  );
}
