import { useEffect, useState } from 'react';
import { IPL_TEAMS } from '../data/teams';

interface Props {
  label: string;
  onDone: () => void;
}

const POOL_GRADIENTS: Record<string, string> = {
  BOWL: 'linear-gradient(135deg, #7c0000, #1a0000)',
  BAT:  'linear-gradient(135deg, #001a7c, #00001a)',
  AR:   'linear-gradient(135deg, #006b00, #001a00)',
  WK:   'linear-gradient(135deg, #7c5000, #1a1000)',
  RAPID:'linear-gradient(135deg, #4b0082, #0d0020)',
};

function getGradient(label: string): string {
  if (label.includes('Bowl')) return POOL_GRADIENTS.BOWL;
  if (label.includes('Batt')) return POOL_GRADIENTS.BAT;
  if (label.includes('All')) return POOL_GRADIENTS.AR;
  if (label.includes('Wicket')) return POOL_GRADIENTS.WK;
  if (label.includes('Rapid')) return POOL_GRADIENTS.RAPID;
  return POOL_GRADIENTS.BAT;
}

export default function PoolCinematic({ label, onDone }: Props) {
  const [phase, setPhase] = useState<'in'|'hold'|'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 300);
    const t2 = setTimeout(() => setPhase('out'), 2800);
    const t3 = setTimeout(onDone, 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: getGradient(label),
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'opacity .5s',
      opacity: phase === 'out' ? 0 : 1,
      pointerEvents: phase === 'out' ? 'none' : 'all',
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.02) 3px,rgba(255,255,255,.02) 4px)',
      }}/>

      <div style={{
        textAlign: 'center',
        transform: phase === 'in' ? 'scale(0.7) translateY(40px)' : 'scale(1) translateY(0)',
        opacity: phase === 'in' ? 0 : 1,
        transition: 'all .5s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', letterSpacing: 4, marginBottom: 10 }}>
          NOW BEGINNING
        </div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(48px, 12vw, 90px)',
          letterSpacing: 6, lineHeight: 1,
          color: '#fff',
          textShadow: '0 0 60px rgba(255,255,255,0.4)',
        }}>{label.toUpperCase()}</div>

        {/* Animated team logos */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 12,
          marginTop: 28, flexWrap: 'wrap', padding: '0 20px',
          opacity: phase === 'hold' ? 1 : 0,
          transition: 'opacity .4s .2s',
        }}>
          {IPL_TEAMS.map((t, i) => (
            <img key={t.id} src={t.logo} alt={t.shortName} style={{
              width: 40, height: 40, objectFit: 'contain', borderRadius: 6,
              animation: `logo-pop .4s ${i * 0.06}s ease both`,
              opacity: 0,
            }}/>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes logo-pop {
          from { transform:scale(0) rotate(-20deg); opacity:0; }
          to   { transform:scale(1) rotate(0);      opacity:1; }
        }
      `}</style>
    </div>
  );
}
