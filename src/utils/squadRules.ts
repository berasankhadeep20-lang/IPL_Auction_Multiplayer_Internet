import { Player, SoldEntry, SQUAD_RULES } from '../types';
import { getPlayerById } from '../data/players';

export interface SquadStatus {
  valid: boolean; playerCount: number; overseasCount: number;
  wkCount: number; batCount: number; bowlCount: number; arCount: number;
  issues: string[]; canBuy: boolean;
}

export function getSquadStatus(soldPlayers: SoldEntry[], purse: number): SquadStatus {
  const players = soldPlayers.map(e => getPlayerById(e.playerId)).filter((p): p is Player => !!p);
  const wkCount = players.filter(p => p.role === 'WK').length;
  const batCount = players.filter(p => p.role === 'BAT').length;
  const bowlCount = players.filter(p => p.role === 'BOWL').length;
  const arCount = players.filter(p => p.role === 'AR').length;
  const overseasCount = players.filter(p => p.nationality === 'Overseas').length;
  const playerCount = players.length;
  const issues: string[] = [];
  if (playerCount < SQUAD_RULES.minPlayers) issues.push(`Need ${SQUAD_RULES.minPlayers - playerCount} more players`);
  if (wkCount < SQUAD_RULES.minWK)     issues.push(`Need ${SQUAD_RULES.minWK - wkCount} more WK`);
  if (batCount < SQUAD_RULES.minBAT)   issues.push(`Need ${SQUAD_RULES.minBAT - batCount} more BAT`);
  if (bowlCount < SQUAD_RULES.minBOWL) issues.push(`Need ${SQUAD_RULES.minBOWL - bowlCount} more BOWL`);
  if (arCount < SQUAD_RULES.minAR)     issues.push(`Need ${SQUAD_RULES.minAR - arCount} more AR`);
  if (overseasCount > SQUAD_RULES.maxOverseas) issues.push(`${overseasCount - SQUAD_RULES.maxOverseas} overseas over limit`);
  return { valid: issues.length === 0, playerCount, overseasCount, wkCount, batCount, bowlCount, arCount, issues, canBuy: playerCount < SQUAD_RULES.maxPlayers && purse > 0 };
}

export function canAddOverseas(soldPlayers: SoldEntry[]): boolean {
  const players = soldPlayers.map(e => getPlayerById(e.playerId)).filter((p): p is Player => !!p);
  return players.filter(p => p.nationality === 'Overseas').length < SQUAD_RULES.maxOverseas;
}

/**
 * IPL official bid increment rules:
 * ≤ ₹1 Cr  → +₹5L
 * ₹1–2 Cr  → +₹10L
 * ₹2–5 Cr  → +₹20L
 * > ₹5 Cr  → +₹25L
 */
export function getNextBidIncrement(currentBidLakhs: number): number {
  if (currentBidLakhs < 100)  return 5;   // below 1 Cr
  if (currentBidLakhs < 200)  return 10;  // 1–2 Cr
  if (currentBidLakhs < 500)  return 20;  // 2–5 Cr
  return 25;                               // above 5 Cr
}

export function getNextBid(currentBidLakhs: number): number {
  return currentBidLakhs + getNextBidIncrement(currentBidLakhs);
}

export function formatPrice(lakhs: number): string {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
  return `₹${lakhs}L`;
}

// kept for legacy callers that don't need it anymore
export function getBidIncrements(_: number): number[] { return []; }
