interface Props {
  timeLeft: number;
  total: number;
  danger: boolean;
  warning: boolean;
  announceLeft: number;
  bidCount: number;
}

export default function CircularTimer({ timeLeft, total, danger, warning, announceLeft, bidCount }: Props) {
  const R = 38;
  const C = 2 * Math.PI * R;
  const pct = announceLeft > 0 ? 1 : Math.max(0, Math.min(1, timeLeft / total));
  const dash = pct * C;

  const color = announceLeft > 0 ? '#a855f7'
    : danger ? '#ef4444'
    : warning ? '#f59e0b'
    : '#22c55e';

  const label = announceLeft > 0 ? `${announceLeft}s` : `${timeLeft}s`;
  const sublabel = announceLeft > 0 ? 'READY' : danger && bidCount > 0 ? 'TWICE' : warning && bidCount > 0 ? 'ONCE' : '';

  return (
    <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
      <svg width="90" height="90" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="45" cy="45" r={R} fill="none" stroke="var(--border)" strokeWidth="5" />
        {/* Progress */}
        <circle cx="45" cy="45" r={R} fill="none"
          stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          style={{ transition: 'stroke-dasharray .25s linear, stroke .4s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: announceLeft > 0 ? 18 : 22,
          color,
          lineHeight: 1,
          animation: danger && bidCount > 0 ? 'sold-flash .4s infinite' : 'none',
          transition: 'color .3s',
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 8, color, fontWeight: 700, letterSpacing: 1, marginTop: 1 }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
