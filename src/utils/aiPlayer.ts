import { Player, TeamState, SoldEntry, AIStrategy } from '../types';
import { canAddOverseas, getSquadStatus } from './squadRules';
import { SQUAD_RULES } from '../types';

/** Fair market value for a player (in Lakhs) */
function fairValue(player: Player): number {
  const base = player.basePrice;
  const ratingMultiplier = (player.rating - 60) / 40; // 0–1
  const formBonus: Record<string, number> = {
    Excellent: 1.5, Good: 1.2, Average: 1.0, Poor: 0.8
  };
  return base * formBonus[player.form] * (1 + ratingMultiplier * 2);
}

export function computeAIBid(
  team: TeamState,
  player: Player,
  currentBid: number,
  strategy: AIStrategy,
): { shouldBid: boolean; amount: number } {
  const sold: SoldEntry[] = JSON.parse(team.soldPlayers || '[]');
  const status = getSquadStatus(sold, team.purse);

  // Can't buy if squad full or not enough purse
  if (status.playerCount >= SQUAD_RULES.maxPlayers) return { shouldBid: false, amount: 0 };
  if (team.purse < currentBid + 5) return { shouldBid: false, amount: 0 };
  if (player.nationality === 'Overseas' && !canAddOverseas(sold)) {
    return { shouldBid: false, amount: 0 };
  }

  const fv = fairValue(player);
  const budgetCap = team.purse * (strategy === 'aggressive' ? 0.45 : strategy === 'conservative' ? 0.25 : 0.35);
  const maxBid = Math.min(fv * (strategy === 'aggressive' ? 1.6 : strategy === 'conservative' ? 1.0 : 1.3), budgetCap);

  // Role need bonus
  let needBonus = 1.0;
  if (player.role === 'WK'   && status.wkCount   < SQUAD_RULES.minWK)   needBonus = 1.3;
  if (player.role === 'BAT'  && status.batCount   < SQUAD_RULES.minBAT)  needBonus = 1.2;
  if (player.role === 'BOWL' && status.bowlCount  < SQUAD_RULES.minBOWL) needBonus = 1.2;
  if (player.role === 'AR'   && status.arCount    < SQUAD_RULES.minAR)   needBonus = 1.15;

  const adjustedMax = Math.min(maxBid * needBonus, team.purse - 10);
  if (currentBid >= adjustedMax) return { shouldBid: false, amount: 0 };

  // Add small increment above current bid
  const increments: number[] = [5, 10, 25, 50, 100];
  const inc = increments.find(i => currentBid + i <= adjustedMax) ?? 5;
  const nextBid = currentBid + inc;

  if (nextBid > team.purse - 5) return { shouldBid: false, amount: 0 };

  // Probabilistic chance to bid (not every tick)
  const chance = strategy === 'aggressive' ? 0.7 : strategy === 'conservative' ? 0.3 : 0.5;
  if (Math.random() > chance) return { shouldBid: false, amount: 0 };

  return { shouldBid: true, amount: nextBid };
}
