import { useState } from 'react';
import { PLAYERS } from '../data/players';
import { Player } from '../types';
import { formatPrice } from '../utils/squadRules';

interface Props { onClose: () => void; defaultA?: string; }

const FORM_SCORE: Record<string, number> = { Excellent: 4, Good: 3, Average: 2, Poor: 1 };

function StatBar({ label, valA, valB, higherBetter = true }: { label: string; valA: number; valB: number; higherBetter?: boolean }) {
  const max = Math.max(valA, valB, 1);
  const wA = (valA / max) * 100;
  const wB = (valB / max) * 100;
  const aWins = higherBetter ? valA >= valB : valA <= valB;
  const bWins = higherBetter ? valB > valA : valB < valA;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
        <span style={{ fontWeight: aWins ? 700 : 400, color: aWins ? 'var(--gold)' : 'var(--muted)' }}>{valA}</span>
        <span style={{ letterSpacing: .5 }}>{label}</span>
        <span style={{ fontWeight: bWins ? 700 : 400, color: bWins ? '#60a5fa' : 'var(--muted)' }}>{valB}</span>
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${wA}%`, background: aWins ? 'var(--gold)' : 'var(--muted)', borderRadius: 99, marginLeft: 'auto' }} />
        </div>
        <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${wB}%`, background: bWins ? '#60a5fa' : 'var(--muted)', borderRadius: 99 }} />
        </div>
      </div>
    </div>
  );
}

export default function PlayerCompare({ onClose, defaultA }: Props) {
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [pickedA, setPickedA] = useState<Player | null>(defaultA ? PLAYERS.find(p => p.id === defaultA) ?? null : null);
  const [pickedB, setPickedB] = useState<Player | null>(null);

  const filterPlayers = (q: string) =>
    q.length < 2 ? [] : PLAYERS.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);

  const Picker = ({ picked, onPick, search, setSearch, accent }: any) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <input className="input" placeholder="Search player…" value={search}
        onChange={e => setSearch(e.target.value)} style={{ marginBottom: 6 }} />
      {!picked && filterPlayers(search).map(p => (
        <button key={p.id} onClick={() => { onPick(p); setSearch(''); }}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', marginBottom: 4,
            cursor: 'pointer', color: 'var(--text)', fontSize: 12 }}>
          <strong>{p.name}</strong> <span style={{ color: 'var(--muted)' }}>{p.role} · ⭐{p.rating}</span>
        </button>
      ))}
      {picked && (
        <div style={{ background: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700 }}>{picked.name}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => onPick(null)} style={{ fontSize: 10 }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {picked.role} · {picked.nationality === 'Indian' ? '🇮🇳' : '🌍'} · ⭐{picked.rating} · {picked.form}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gold)', marginTop: 6, fontWeight: 700 }}>
            Base: {formatPrice(picked.basePrice)}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(3px)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(600px, 95vw)', maxHeight: '85vh', overflowY: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, zIndex: 301, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,.7)',
        animation: 'slide-up .3s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 2 }}>⚖️ COMPARE PLAYERS</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <Picker picked={pickedA} onPick={setPickedA} search={searchA} setSearch={setSearchA} accent="var(--gold)" />
          <div style={{ display: 'flex', alignItems: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: 'var(--muted)', flexShrink: 0 }}>VS</div>
          <Picker picked={pickedB} onPick={setPickedB} search={searchB} setSearch={setSearchB} accent="#60a5fa" />
        </div>

        {pickedA && pickedB && (
          <div style={{ animation: 'fade-in .3s ease' }}>
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
            <StatBar label="Rating" valA={pickedA.rating} valB={pickedB.rating} />
            <StatBar label="Base Price (L)" valA={pickedA.basePrice} valB={pickedB.basePrice} />
            <StatBar label="Form" valA={FORM_SCORE[pickedA.form]} valB={FORM_SCORE[pickedB.form]} />
            {(pickedA.stats.runs || pickedB.stats.runs) && (
              <StatBar label="IPL Runs" valA={pickedA.stats.runs ?? 0} valB={pickedB.stats.runs ?? 0} />
            )}
            {(pickedA.stats.wickets || pickedB.stats.wickets) && (
              <StatBar label="IPL Wickets" valA={pickedA.stats.wickets ?? 0} valB={pickedB.stats.wickets ?? 0} />
            )}
            {(pickedA.stats.average || pickedB.stats.average) && (
              <StatBar label="Average" valA={pickedA.stats.average ?? 0} valB={pickedB.stats.average ?? 0} />
            )}
            {(pickedA.stats.strikeRate || pickedB.stats.strikeRate) && (
              <StatBar label="Strike Rate" valA={pickedA.stats.strikeRate ?? 0} valB={pickedB.stats.strikeRate ?? 0} />
            )}
            {(pickedA.stats.economy || pickedB.stats.economy) && (
              <StatBar label="Economy" valA={pickedA.stats.economy ?? 0} valB={pickedB.stats.economy ?? 0} higherBetter={false} />
            )}
            <StatBar label="Matches" valA={pickedA.stats.matches} valB={pickedB.stats.matches} />

            {/* Verdict */}
            {(() => {
              const scoreA = pickedA.rating * 2 + FORM_SCORE[pickedA.form] * 5;
              const scoreB = pickedB.rating * 2 + FORM_SCORE[pickedB.form] * 5;
              const winner = scoreA > scoreB ? pickedA : scoreB > scoreA ? pickedB : null;
              return winner ? (
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginTop: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>OVERALL VERDICT</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: 'var(--gold)' }}>
                    🏆 {winner.name} is the better pick
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 16, fontSize: 13 }}>⚖️ Too close to call!</div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
