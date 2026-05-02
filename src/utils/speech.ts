/**
 * speech.ts — Reliable Web Speech API wrapper
 * 
 * Key fixes:
 * - Returns Promise<void> so caller can await completion
 * - Queues utterances instead of cancelling
 * - Retries on speechSynthesis "not speaking" bug (Chrome/mobile glitch)
 * - Host-only: going once / twice spoken as chained promises
 */

let voices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve([]); return; }
    const v = window.speechSynthesis.getVoices();
    if (v.length) { voices = v; voicesLoaded = true; resolve(v); return; }
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      resolve(voices);
    };
    // fallback timeout
    setTimeout(() => { voices = window.speechSynthesis.getVoices(); resolve(voices); }, 1000);
  });
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) loadVoices();

function pickVoice(): SpeechSynthesisVoice | null {
  if (!voicesLoaded) voices = window.speechSynthesis?.getVoices() ?? [];
  return (
    voices.find(v => v.lang === 'en-IN') ??
    voices.find(v => v.lang.startsWith('en') && /male/i.test(v.name)) ??
    voices.find(v => v.lang.startsWith('en')) ??
    null
  );
}

// Chrome has a bug where speechSynthesis pauses after ~15s of silence
// Kick it awake before speaking
function resumeCtx() {
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
}

/**
 * Speak text. Returns Promise that resolves when utterance finishes.
 * cancel=true (default) stops any current speech first.
 */
export function speak(
  text: string,
  opts: { rate?: number; pitch?: number; cancel?: boolean } = {}
): Promise<void> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { resolve(); return; }
    if (!text.trim()) { resolve(); return; }

    const { rate = 0.88, pitch = 0.95, cancel = true } = opts;
    if (cancel) window.speechSynthesis.cancel();
    resumeCtx();

    const utt   = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utt.voice = voice;
    utt.lang   = 'en-IN';
    utt.rate   = rate;
    utt.pitch  = pitch;
    utt.volume = 1;

    utt.onend   = () => resolve();
    utt.onerror = () => resolve(); // don't hang on error

    // Chrome mobile bug: speech never starts if tab not focused
    // Retry once after 300ms if still not speaking
    window.speechSynthesis.speak(utt);

    // Watchdog: if nothing happens in 500ms, retry
    const watchdog = setTimeout(() => {
      if (!window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utt);
      }
    }, 500);

    utt.onstart = () => clearTimeout(watchdog);
  });
}

export function cancelSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/** Speak multiple phrases in sequence, no cancellation between them */
export async function speakChain(
  phrases: string[],
  opts: { rate?: number; pitch?: number } = {}
): Promise<void> {
  for (const phrase of phrases) {
    if (!phrase.trim()) continue;
    await speak(phrase, { ...opts, cancel: false });
    // tiny gap between phrases
    await new Promise(r => setTimeout(r, 180));
  }
}

// ── Announcement builders ─────────────────────────────────────────────────

import { Player, TeamInfo } from '../types';
import { formatPrice } from './squadRules';

export function announcePool(label: string): string {
  return `Ladies and gentlemen! We now begin the ${label} pool! Get ready to place your bids!`;
}

export function announcePlayer(player: Player): string {
  const roleMap: Record<string, string> = {
    BAT: 'batsman', BOWL: 'bowler', AR: 'all-rounder', WK: 'wicket-keeper batsman',
  };
  const role   = roleMap[player.role] ?? player.role;
  const nation = player.nationality === 'Indian' ? 'Indian' : 'overseas';
  const base   = formatPrice(player.basePrice);
  const form   = player.form === 'Excellent' ? 'in excellent form' : player.form === 'Good' ? 'in good form' : '';
  return `Up for bid: ${player.name}! A ${nation} ${role}${form ? ', ' + form : ''}. Base price ${base}.`;
}

export function announceBid(amount: number, teamName: string): string {
  return `${teamName} bids ${formatPrice(amount)}!`;
}

export function announceGoingOnce(amount: number): string {
  return `Going once… at ${formatPrice(amount)}!`;
}

export function announceGoingTwice(amount: number): string {
  return `Going twice… at ${formatPrice(amount)}! Last chance!`;
}

export function announceSold(player: Player, team: TeamInfo, amount: number): string {
  return `Sold! ${player.name} goes to ${team.name} for ${formatPrice(amount)}! What a buy!`;
}

export function announceUnsold(player: Player): string {
  return `${player.name} is unsold. Moving on to the next player.`;
}

export function announceBreak(nextLabel: string): string {
  return `Pool concluded! We will now take a one-minute break before the ${nextLabel} pool. Please stand by.`;
}

export function announceRapid(): string {
  return `All main pools are complete! We now begin the rapid round for all unsold players! Bids move faster — stay alert!`;
}
