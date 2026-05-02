import { useRef, useEffect } from 'react';
import { Player, SoldEntry, TeamInfo } from '../types';
import { formatPrice } from '../utils/squadRules';

interface Props {
  team: TeamInfo;
  players: { player: Player; price: number }[];
  purseLeft: number;
  ownerName: string;
  onClose: () => void;
}

export default function ShareCard({ team, players, purseLeft, ownerName, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const W = 600, H = 800;
    c.width = W; c.height = H;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a0c10');
    bg.addColorStop(1, '#1a0020');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Team color banner
    ctx.fillStyle = team.primary + '44';
    ctx.fillRect(0, 0, W, 160);

    // Team name
    ctx.fillStyle = team.primary;
    ctx.font = "bold 52px 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(team.shortName, W / 2, 70);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '18px Arial';
    ctx.fillText(team.name, W / 2, 100);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px Arial';
    ctx.fillText(`Manager: ${ownerName}`, W / 2, 125);

    ctx.fillStyle = '#f5c842';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Purse remaining: ${formatPrice(purseLeft)}  ·  Squad: ${players.length}/25`, W / 2, 150);

    // Players list
    const roles = ['BAT', 'BOWL', 'AR', 'WK'] as const;
    const roleColors: Record<string, string> = { BAT: '#60a5fa', BOWL: '#f87171', AR: '#4ade80', WK: '#fbbf24' };
    const roleLabels: Record<string, string> = { BAT: '🏏 BATTERS', BOWL: '⚾ BOWLERS', AR: '⚡ ALL-ROUNDERS', WK: '🥊 WICKET-KEEPERS' };

    let y = 175;
    for (const role of roles) {
      const rp = players.filter(x => x.player.role === role);
      if (!rp.length) continue;
      ctx.fillStyle = roleColors[role];
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(roleLabels[role], 20, y);
      y += 6;
      ctx.fillStyle = roleColors[role] + '66';
      ctx.fillRect(20, y, W - 40, 1);
      y += 12;
      for (const { player, price } of rp.sort((a, b) => b.price - a.price)) {
        ctx.fillStyle = '#e8ecf1';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${player.nationality === 'Indian' ? '🇮🇳' : '🌍'} ${player.name}  ⭐${player.rating}`, 30, y);
        ctx.fillStyle = '#f5c842';
        ctx.textAlign = 'right';
        ctx.fillText(formatPrice(price), W - 20, y);
        y += 20;
        if (y > H - 40) break;
      }
      y += 4;
      if (y > H - 40) break;
    }

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('IPL Auction 2025 · berasankhadeep20-lang.github.io/IPL_Auction_Multiplayer_Internet', W / 2, H - 15);
  }, []);

  const download = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `${team.shortName}_squad.png`;
    a.click();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 400 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 401, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        animation: 'slide-up .3s ease',
      }}>
        <canvas ref={canvasRef} style={{ borderRadius: 12, maxWidth: '90vw', maxHeight: '70vh', display: 'block' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-gold" onClick={download}>⬇️ Download PNG</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
