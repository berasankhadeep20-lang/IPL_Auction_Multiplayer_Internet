import { Player, SoldEntry, SQUAD_RULES } from '../types';
import { getPlayerById } from '../data/players';

export interface SquadStatus {
  valid: boolean;
  playerCount: number;
  overseasCount: number;
  wkCount: number;
  batCount: number;
  bowlCount: number;
  arCount: number;
  issues: string[];
  canBuy: boolean;  // has room + purse
}

export function getSquadStatus(soldPlayers: SoldEntry[], purse: number, newPlayerCost?: number): SquadStatus {
  const players = soldPlayers
    .map(e => getPlayerById(e.playerId))
    .filter((p): p is Player => !!p);

  const wkCount    = players.filter(p => p.role === 'WK').length;
  const batCount   = players.filter(p => p.role === 'BAT').length;
  const bowlCount  = players.filter(p => p.role === 'BOWL').length;
  const arCount    = players.filter(p => p.role === 'AR').length;
  const overseasCount = players.filter(p => p.nationality === 'Overseas').length;
  const playerCount = players.length;

  const issues: string[] = [];
  if (playerCount < SQUAD_RULES.minPlayers) issues.push(`Need ${SQUAD_RULES.minPlayers - playerCount} more players`);
  if (wkCount < SQUAD_RULES.minWK)   issues.push(`Need ${SQUAD_RULES.minWK - wkCount} more WK`);
  if (batCount < SQUAD_RULES.minBAT) issues.push(`Need ${SQUAD_RULES.minBAT - batCount} more BAT`);
  if (bowlCount < SQUAD_RULES.minBOWL) issues.push(`Need ${SQUAD_RULES.minBOWL - bowlCount} more BOWL`);
  if (arCount < SQUAD_RULES.minAR)   issues.push(`Need ${SQUAD_RULES.minAR - arCount} more AR`);
  if (overseasCount > SQUAD_RULES.maxOverseas) issues.push(`${overseasCount - SQUAD_RULES.maxOverseas} overseas over limit`);

  const cost = newPlayerCost ?? 0;
  const canBuy = playerCount < SQUAD_RULES.maxPlayers && purse >= cost;

  return {
    valid: issues.length === 0,
    playerCount, overseasCount, wkCount, batCount, bowlCount, arCount,
    issues, canBuy,
  };
}

export function canAddOverseas(soldPlayers: SoldEntry[]): boolean {
  const players = soldPlayers
    .map(e => getPlayerById(e.playerId))
    .filter((p): p is Player => !!p);
  return players.filter(p => p.nationality === 'Overseas').length < SQUAD_RULES.maxOverseas;
}

/** Bid increment steps based on current bid (in Lakhs) */
export function getBidIncrements(currentBid: number): number[] {
  if (currentBid < 200)   return [5, 10, 25, 50];
  if (currentBid < 500)   return [25, 50, 100];
  if (currentBid < 1000)  return [50, 100, 200];
  return [100, 200, 500];
}

export function formatPrice(lakhs: number): string {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
  return `₹${lakhs}L`;
}
