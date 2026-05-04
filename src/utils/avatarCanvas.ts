/**
 * Generates a player avatar as a data URL using Canvas.
 * Used as guaranteed fallback when remote image fails.
 */

const ROLE_COLORS: Record<string, string> = {
  BAT:  '#60a5fa',
  BOWL: '#f87171',
  AR:   '#4ade80',
  WK:   '#fbbf24',
};

const cache = new Map<string, string>();

export function generateAvatar(name: string, role: string, size = 200): string {
  const key = `${name}-${role}-${size}`;
  if (cache.has(key)) return cache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = Math.round(size * 1.2);
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const color = ROLE_COLORS[role] ?? '#f5c842';

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a1e25');
  bg.addColorStop(1, '#0d1020');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Role color glow circle
  const cx = W / 2, cy = H * 0.42;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.35);
  grad.addColorStop(0, color + '44');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Circle background
  ctx.beginPath();
  ctx.arc(cx, cy, W * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = color + '22';
  ctx.fill();
  ctx.strokeStyle = color + '66';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Initials
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].substring(0, 2);

  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(W * 0.28)}px 'Rajdhani', 'Barlow Condensed', Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials.toUpperCase(), cx, cy);

  // Bottom name strip
  ctx.fillStyle = color + '22';
  ctx.fillRect(0, H * 0.76, W, H * 0.24);

  ctx.fillStyle = '#e8ecf1';
  ctx.font = `bold ${Math.round(W * 0.1)}px Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  // Truncate long names
  const displayName = name.length > 14 ? name.split(' ').slice(-1)[0] : name;
  ctx.fillText(displayName.toUpperCase(), cx, H * 0.87);

  // Role badge strip at bottom
  ctx.fillStyle = color;
  ctx.fillRect(0, H * 0.96, W, H * 0.04);

  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
