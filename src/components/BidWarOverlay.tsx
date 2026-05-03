interface Props { active: boolean; }

export default function BidWarOverlay({ active }: Props) {
  if (!active) return null;
  return (
    <div style={{
      position: 'fixed', top: 60, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 95, pointerEvents: 'none',
      animation: 'slide-up .3s ease',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #7c1a1a, #1a0d00)',
        border: '2px solid #ef4444',
        borderRadius: 12,
        padding: '8px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 0 30px rgba(239,68,68,0.5)',
        animation: 'bid-war-pulse 0.6s ease infinite alternate',
      }}>
        <span style={{ fontSize: 22 }}>🔥</span>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, color: '#ef4444' }}>
          BID WAR
        </div>
        <span style={{ fontSize: 22 }}>🔥</span>
      </div>
      <style>{`
        @keyframes bid-war-pulse {
          from { box-shadow: 0 0 20px rgba(239,68,68,0.4); }
          to   { box-shadow: 0 0 50px rgba(239,68,68,0.8); }
        }
      `}</style>
    </div>
  );
}
