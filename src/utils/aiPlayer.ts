import { Player, TeamState, SoldEntry, AIStrategy } from '../types';
import { canAddOverseas, getSquadStatus, getNextBid } from './squadRules';
import { SQUAD_RULES } from '../types';
import { getPlayerById } from '../data/players';

function fairValue(player: Player): number {
  const fm: Record<string,number> = { Excellent:1.6, Good:1.25, Average:1.0, Poor:0.75 };
  return player.basePrice * fm[player.form] * (1 + ((player.rating - 60) / 40) * 2.2);
}

export function computeAIBid(
  team: TeamState,
  player: Player,
  currentBid: number,
  strategy: AIStrategy,
): { shouldBid: boolean; amount: number } {
  const sold: SoldEntry[] = JSON.parse(team.soldPlayers || '[]');
  const status = getSquadStatus(sold, team.purse);

  if (status.playerCount >= SQUAD_RULES.maxPlayers) return { shouldBid:false, amount:0 };
  if (player.nationality === 'Overseas' && !canAddOverseas(sold)) return { shouldBid:false, amount:0 };

  const fv = fairValue(player);
  const budgetFrac = strategy === 'aggressive' ? 0.42 : strategy === 'conservative' ? 0.22 : 0.32;
  const valueMult  = strategy === 'aggressive' ? 1.7  : strategy === 'conservative' ? 1.05 : 1.3;

  // Role need bonus — ensure minimums are met
  let needBonus = 1.0;
  if (player.role === 'WK'   && status.wkCount   < SQUAD_RULES.minWK)   needBonus = 1.5;
  if (player.role === 'BAT'  && status.batCount   < SQUAD_RULES.minBAT)  needBonus = 1.3;
  if (player.role === 'BOWL' && status.bowlCount  < SQUAD_RULES.minBOWL) needBonus = 1.3;
  if (player.role === 'AR'   && status.arCount    < SQUAD_RULES.minAR)   needBonus = 1.25;

  const budgetCap = team.purse * budgetFrac;
  const maxBid = Math.min(fv * valueMult * needBonus, budgetCap, team.purse - 10);

  // Use official IPL increment
  const nextBid = getNextBid(currentBid);
  if (nextBid > maxBid || nextBid > team.purse - 10) return { shouldBid:false, amount:0 };

  // Probability of bidding per tick — higher if player is needed
  const baseChance = strategy === 'aggressive' ? 0.75 : strategy === 'conservative' ? 0.35 : 0.55;
  const chance = Math.min(0.92, baseChance * needBonus);
  if (Math.random() > chance) return { shouldBid:false, amount:0 };

  return { shouldBid:true, amount:nextBid };
}
