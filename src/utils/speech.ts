let voices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  voices = window.speechSynthesis?.getVoices() ?? [];
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!voices.length) loadVoices();
  // Prefer Indian English, fallback to any English male
  return (
    voices.find(v => v.lang === 'en-IN') ??
    voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')) ??
    voices.find(v => v.lang.startsWith('en')) ??
    null
  );
}

export function speak(text: string, rate = 0.88, pitch = 0.95): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) utt.voice = v;
  utt.lang  = 'en-IN';
  utt.rate  = rate;
  utt.pitch = pitch;
  utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

export function cancelSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ── Canned announcement builders ──────────────────────────────────────────
import { Player, TeamInfo } from '../types';
import { formatPrice } from './squadRules';

export function announcePool(label: string): string {
  return `Ladies and gentlemen! We now begin the ${label} pool! Get ready to bid!`;
}

export function announcePlayer(player: Player): string {
  const roleMap: Record<string, string> = {
    BAT: 'batsman', BOWL: 'bowler', AR: 'all-rounder', WK: 'wicket-keeper batsman',
  };
  const role   = roleMap[player.role] ?? player.role;
  const nation = player.nationality === 'Indian' ? 'Indian' : 'overseas';
  const base   = formatPrice(player.basePrice);
  return `Up for bid: ${player.name}! A ${nation} ${role}, rated ${player.rating} out of 100. Base price ${base}.`;
}

export function announceBid(amount: number, teamName: string): string {
  return `${teamName} bids ${formatPrice(amount)}!`;
}

export function announceGoingOnce(amount: number): string {
  return `Going once… at ${formatPrice(amount)}!`;
}

export function announceGoingTwice(): string {
  return `Going twice!`;
}

export function announceSold(player: Player, team: TeamInfo, amount: number): string {
  return `Sold! ${player.name} goes to ${team.name} for ${formatPrice(amount)}! What a buy!`;
}

export function announceUnsold(player: Player): string {
  return `${player.name} is unsold. Moving on.`;
}

export function announceBreak(nextLabel: string): string {
  return `Pool concluded! We will now take a one-minute break before the ${nextLabel} pool. Please stand by.`;
}

export function announceRapid(): string {
  return `All pools are complete! We now begin the rapid round for unsold players! Bids will be faster — stay alert!`;
}
