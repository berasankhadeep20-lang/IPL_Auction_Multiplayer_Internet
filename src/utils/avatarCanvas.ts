const ROLE_COLORS: Record<string,string> = {
  BAT:'#60a5fa', BOWL:'#f87171', AR:'#4ade80', WK:'#fbbf24',
};
const cache = new Map<string,string>();

export function generateAvatar(name: string, role: string, size=200): string {
  const key = `${name}-${role}-${size}`;
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = Math.round(size * 1.25);
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width; const H = canvas.height;
  const color = ROLE_COLORS[role] ?? '#f5c842';
  // BG
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#1a1e25'); bg.addColorStop(1,'#0d1020');
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
  // Glow
  const cx=W/2, cy=H*0.4;
  const g = ctx.createRadialGradient(cx,cy,0,cx,cy,W*0.38);
  g.addColorStop(0,color+'44'); g.addColorStop(1,'transparent');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // Circle
  ctx.beginPath(); ctx.arc(cx,cy,W*0.33,0,Math.PI*2);
  ctx.fillStyle=color+'22'; ctx.fill();
  ctx.strokeStyle=color+'88'; ctx.lineWidth=2; ctx.stroke();
  // Initials
  const parts = name.trim().split(' ');
  const initials = parts.length>=2 ? parts[0][0]+parts[parts.length-1][0] : parts[0].substring(0,2);
  ctx.fillStyle=color;
  ctx.font=`bold ${Math.round(W*0.26)}px Arial`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(initials.toUpperCase(),cx,cy);
  // Name strip
  ctx.fillStyle=color+'22'; ctx.fillRect(0,H*0.76,W,H*0.24);
  ctx.fillStyle='rgba(255,255,255,0.85)';
  ctx.font=`${Math.round(W*0.095)}px Arial`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const shortName = parts.length>=2 ? parts[parts.length-1] : name;
  ctx.fillText(shortName.toUpperCase().substring(0,10),cx,H*0.87);
  // Role strip
  ctx.fillStyle=color; ctx.fillRect(0,H*0.96,W,H*0.04);
  const url = canvas.toDataURL();
  cache.set(key,url);
  return url;
}
