import { PLAYERS } from '../data/players';
import { PoolMeta, PoolName } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface PooledQueue {
  queue: string[];      // flat ordered player IDs
  pools: PoolMeta[];
}

export function buildPooledQueue(): PooledQueue {
  const bowlers = shuffle(PLAYERS.filter(p => p.role === 'BOWL').map(p => p.id));
  const batters  = shuffle(PLAYERS.filter(p => p.role === 'BAT').map(p => p.id));
  const arAll    = shuffle(PLAYERS.filter(p => p.role === 'AR').map(p => p.id));
  const wkAll    = shuffle(PLAYERS.filter(p => p.role === 'WK').map(p => p.id));

  const half = (arr: string[]) => [arr.slice(0, Math.ceil(arr.length / 2)), arr.slice(Math.ceil(arr.length / 2))] as [string[], string[]];
  const [bowl1, bowl2] = half(bowlers);
  const [bat1,  bat2 ] = half(batters);

  const segments: { name: PoolName; label: string; ids: string[] }[] = [
    { name: 'BOWL_1', label: 'Bowlers — Set 1',   ids: bowl1 },
    { name: 'BAT_1',  label: 'Batters — Set 1',   ids: bat1  },
    { name: 'AR',     label: 'All-Rounders',       ids: arAll },
    { name: 'WK',     label: 'Wicket-Keepers',     ids: wkAll },
    { name: 'BOWL_2', label: 'Bowlers — Set 2',   ids: bowl2 },
    { name: 'BAT_2',  label: 'Batters — Set 2',   ids: bat2  },
  ];

  const queue: string[] = [];
  const pools: PoolMeta[] = [];
  for (const seg of segments) {
    const start = queue.length;
    queue.push(...seg.ids);
    pools.push({ name: seg.name, label: seg.label, start, end: queue.length });
  }

  return { queue, pools };
}

export function getPoolForIndex(pools: PoolMeta[], idx: number): PoolMeta | null {
  return pools.find(p => idx >= p.start && idx < p.end) ?? null;
}

export function isLastInPool(pools: PoolMeta[], idx: number): boolean {
  const pool = getPoolForIndex(pools, idx);
  return pool ? idx === pool.end - 1 : false;
}
