import { useGameStore } from '../store/useGameStore';
import { getTeamById } from '../data/teams';
import { getPlayerById } from '../data/players';
import { formatPrice, getSquadStatus } from '../utils/squadRules';
import { SoldEntry, Player } from '../types';

function sp<T>(s: string, fb: T): T { try { return JSON.parse(s) as T; } catch { return fb; } }

function t20Score(players: { player: Player; price: number }[]): {
  batting: number; bowling: number; balance: number; depth: number; overall: number;
} {
  const batters = players.filter(x => ['BAT','WK','AR'].includes(x.player.role));
  const bowlers = players.filter(x => ['BOWL','AR'].includes(x.player.role));
  const batting = batters.length
    ? Math.round(batters.reduce((a, x) => a + x.player.rating * (x.player.role === 'WK' ? 0.9 : 1), 0) / batters.length)
    : 0;
  const bowling = bowlers.length
    ? Math.round(bowlers.reduce((a, x) => a + x.player.rating * (x.player.role === 'AR' ? 0.85 : 1), 0) / bowlers.length)
    : 0;
  const excellentCount = players.filter(x => x.player.form === 'Excellent').length;
  const balance = Math.min(100, Math.round(
    (players.filter(x=>x.player.role==='BAT').length >= 4 ? 25 : 10) +
    (players.filter(x=>x.player.role==='BOWL').length >= 4 ? 25 : 10) +
    (players.filter(x=>x.player.role==='AR').length >= 2 ? 25 : 10) +
    (players.filter(x=>x.player.role==='WK').length >= 2 ? 25 : 10)
  ));
  const depth = Math.min(100, Math.round((players.length / 25) * 100));
  const overall = Math.round((batting * 0.3 + bowling * 0.3 + balance * 0.25 + depth * 0.1 + excellentCount * 1.5));
  return { batting, bowling, balance, depth, overall };
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 99, transition: 'width .8s ease' }} />
      </div>
    </div>
  );
}

export default function MatchPredictor({ onClose }: { onClose: () => void }) {
  const store = useGameStore();
  const room = store.roomData;
  if (!room) return null;

  const allScores = Object.entries(room.teams).map(([teamId, ts]) => {
    const team = getTeamById(teamId);
    const sold = sp<SoldEntry[]>(ts.soldPlayers, []);
    const players = sold.map(e => ({ player: getPlayerById(e.playerId)!, price: e.price })).filter(x => x.player);
    const scores = t20Score(players);
    const status = getSquadStatus(sold, ts.purse);
    return { teamId, team, ts, players, scores, status };
  }).sort((a, b) => b.scores.overall - a.scores.overall);

  const grade = (v: number) => v >= 85 ? 'A+' : v >= 75 ? 'A' : v >= 65 ? 'B+' : v >= 55 ? 'B' : v >= 45 ? 'C' : 'D';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(3px)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(680px, 96vw)', maxHeight: '88vh', overflowY: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, zIndex: 301, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,.7)',
        animation: 'slide-up .3s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 2 }}>🏆 T20 MATCH PREDICTOR</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Live squad strength analysis based on ratings, form & balance</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Leaderboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {allScores.map(({ teamId, team, ts, players, scores, status }, i) => {
            const isMe = store.myTeamId === teamId;
            const MEDALS = ['🥇','🥈','🥉'];
            return (
              <div key={teamId} style={{
                background: isMe ? `${team.primary}18` : 'var(--surface2)',
                border: `1px solid ${isMe ? team.primary : 'var(--border)'}`,
                borderRadius: 12, padding: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{MEDALS[i] ?? `#${i+1}`}</span>
                  <img src={team.logo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{team.shortName}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ts.isAI ? '🤖 AI' : `👤 ${ts.ownerName}`} · {players.length} players</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--gold)', lineHeight: 1 }}>
                          {scores.overall}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Grade: <strong style={{ color: scores.overall >= 70 ? 'var(--green)' : scores.overall >= 50 ? '#f59e0b' : 'var(--red)' }}>{grade(scores.overall)}</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
                <Bar label="Batting Strength" value={scores.batting} color="#60a5fa" />
                <Bar label="Bowling Strength" value={scores.bowling} color="#f87171" />
                <Bar label="Team Balance" value={scores.balance} color="#4ade80" />
                <Bar label="Squad Depth" value={scores.depth} color="#f59e0b" />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {[['WK',status.wkCount],['BAT',status.batCount],['AR',status.arCount],['BOWL',status.bowlCount]].map(([r,c]) => (
                    <span key={r} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '3px 8px', fontSize: 11 }}>
                      {r}: {c}
                    </span>
                  ))}
                  <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11 }}>
                    🌍 {status.overseasCount}/8
                  </span>
                  <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--gold)' }}>
                    💰 {formatPrice(ts.purse)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
