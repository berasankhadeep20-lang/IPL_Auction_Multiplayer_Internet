import { useGameStore } from '../store/useGameStore';
import { IPL_TEAMS } from '../data/teams';
import { formatPrice, getSquadStatus } from '../utils/squadRules';
import { SoldEntry } from '../types';

function sp<T>(s: string, fb: T): T { try { return JSON.parse(s) as T; } catch { return fb; } }

export default function BroadcastTicker() {
  const store = useGameStore();
  const room = store.roomData;
  if (!room) return null;

  const items: string[] = [];

  // Team purse + squad summary
  IPL_TEAMS.forEach(team => {
    const ts = room.teams[team.id];
    if (!ts) return;
    const sold = sp<SoldEntry[]>(ts.soldPlayers, []);
    const status = getSquadStatus(sold, ts.purse);
    const owner = ts.isAI ? '🤖' : '👤';
    items.push(`${owner} ${team.shortName}  ${status.playerCount} players  ${formatPrice(ts.purse)} left`);
  });

  const { auction } = room;
  const soldLog = sp<SoldEntry[]>(auction.soldLog, []);
  items.push(`🔨 ${soldLog.length} players SOLD`);

  const unsold = sp<string[]>(auction.unsoldIds, []);
  items.push(`❌ ${unsold.length} UNSOLD`);

  const pools = sp<{label:string;start:number;end:number}[]>(auction.pools, []);
  const curPool = pools.find(p => auction.queueIndex >= p.start && auction.queueIndex < p.end);
  if (curPool) {
    const done = auction.queueIndex - curPool.start;
    const total = curPool.end - curPool.start;
    items.push(`🎯 ${curPool.label.toUpperCase()}  ${done}/${total} done`);
  }

  const ticker = [...items, ...items].join('   ·   ');

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      height: 28,
      background: 'linear-gradient(90deg, #1a0a00, #0d0d1a, #001a0a)',
      borderTop: '2px solid #f5c842',
      overflow: 'hidden',
      zIndex: 90,
      display: 'flex',
      alignItems: 'center',
    }}>
      {/* LIVE badge */}
      <div style={{
        background: '#ef4444',
        color: '#fff',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.5,
        padding: '2px 8px',
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', animation: 'blink 1s infinite' }} />
        LIVE
      </div>

      {/* Scrolling text */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          animation: 'ticker-scroll 60s linear infinite',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 12,
          letterSpacing: 0.5,
          color: '#e8ecf1',
          padding: '0 20px',
        }}>
          {ticker}
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes ticker-scroll { 0%{transform:translateX(100vw)} 100%{transform:translateX(-100%)} }
      `}</style>
    </div>
  );
}
