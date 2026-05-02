import { useEffect, useState } from 'react';
import { Player, TeamInfo } from '../types';
import { formatPrice } from '../utils/squadRules';

interface Props {
  player: Player;
  team: TeamInfo | null;
  price: number;
  type: 'sold' | 'unsold';
  onDone: () => void;
}

export default function SoldSplash({ player, team, price, type, onDone }: Props) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 400);
    const t2 = setTimeout(() => setPhase('out'), 2800);
    const t3 = setTimeout(onDone, 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const roleIcon: Record<string, string> = { BAT: '🏏', BOWL: '⚾', AR: '⚡', WK: '🥊' };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: type === 'sold'
        ? 'radial-gradient(ellipse at center, rgba(0,40,0,.97) 0%, rgba(0,10,0,.99) 100%)'
        : 'radial-gradient(ellipse at center, rgba(40,0,0,.97) 0%, rgba(10,0,0,.99) 100%)',
      transition: 'opacity .4s',
      opacity: phase === 'out' ? 0 : 1,
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.015) 2px, rgba(255,255,255,.015) 4px)',
      }} />

      <div style={{
        textAlign: 'center', padding: '32px 40px',
        transform: phase === 'in' ? 'scale(.6)' : phase === 'hold' ? 'scale(1)' : 'scale(1.08)',
        opacity: phase === 'in' ? 0 : 1,
        transition: 'transform .45s cubic-bezier(.34,1.56,.64,1), opacity .4s',
        maxWidth: 480, width: '100%',
      }}>
        {/* SOLD / UNSOLD stamp */}
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(72px, 20vw, 120px)',
          letterSpacing: 8,
          color: type === 'sold' ? '#22c55e' : '#ef4444',
          lineHeight: 1,
          textShadow: type === 'sold'
            ? '0 0 40px rgba(34,197,94,.6), 0 0 80px rgba(34,197,94,.3)'
            : '0 0 40px rgba(239,68,68,.6), 0 0 80px rgba(239,68,68,.3)',
          animation: 'stamp-in .35s cubic-bezier(.36,.07,.19,.97)',
        }}>
          {type === 'sold' ? 'SOLD' : 'UNSOLD'}
        </div>

        {/* Hammer icon */}
        {type === 'sold' && (
          <div style={{ fontSize: 48, marginTop: -8, animation: 'hammer-drop .4s .2s ease both' }}>🔨</div>
        )}

        {/* Player name */}
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: 'clamp(22px, 5vw, 36px)',
          fontWeight: 700, color: '#fff',
          marginTop: 12, lineHeight: 1.1,
        }}>
          {roleIcon[player.role]} {player.name}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>
          {player.nationality === 'Indian' ? '🇮🇳' : '🌍'} {player.role} · ⭐{player.rating}
        </div>

        {/* Sold to team */}
        {type === 'sold' && team && (
          <div style={{
            marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 16, animation: 'slide-up .4s .3s ease both', opacity: 0,
            animationFillMode: 'both',
          }}>
            <img src={team.logo} alt="" style={{
              width: 70, height: 70, objectFit: 'contain',
              filter: 'drop-shadow(0 0 16px rgba(255,255,255,.3))',
            }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', letterSpacing: 1 }}>GOING TO</div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 32, letterSpacing: 2, color: team.primary,
              }}>{team.shortName}</div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28, color: '#f5c842', letterSpacing: 1,
              }}>{formatPrice(price)}</div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes stamp-in { 0%{transform:scale(2.5) rotate(-8deg);opacity:0} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes hammer-drop { 0%{transform:rotate(-50deg) translateY(-20px);opacity:0} 80%{transform:rotate(15deg)} 100%{transform:rotate(0);opacity:1} }
      `}</style>
    </div>
  );
}
