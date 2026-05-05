/**
 * speech.ts — Adaptive, reliable Web Speech API
 *
 * Key design decisions:
 * 1. speak() returns a Promise that resolves ONLY when speech actually ends
 * 2. speakAndMeasure() speaks and returns the actual duration — caller uses this for adaptive delay
 * 3. Chrome bug fixes: resume(), watchdog retry, visibility-change kick
 * 4. Never hangs: onerror + max timeout fallback always resolve
 */

import { Player, TeamInfo } from '../types';
import { formatPrice } from './squadRules';

// ── Voice loading ─────────────────────────────────────────────────────────────
let voices: SpeechSynthesisVoice[] = [];
let voicesReady = false;

function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const v = window.speechSynthesis.getVoices();
  if (v.length) { voices = v; voicesReady = true; }
  window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();
    voicesReady = true;
  };
}
if (typeof window !== 'undefined') {
  loadVoices();
  // Also load on page visibility (mobile wake-up)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadVoices();
  });
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!voicesReady) voices = window.speechSynthesis?.getVoices() ?? [];
  return (
    voices.find(v => v.lang === 'en-IN') ??
    voices.find(v => v.lang === 'en-GB') ??
    voices.find(v => v.lang.startsWith('en') && /male/i.test(v.name)) ??
    voices.find(v => v.lang.startsWith('en')) ??
    null
  );
}

// Chrome pauses speechSynthesis after ~15s idle — always resume before speaking
function wakeUp() {
  if (typeof window === 'undefined') return;
  if ('speechSynthesis' in window) {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  }
}

// ── Core speak ────────────────────────────────────────────────────────────────

/**
 * Speak a single phrase. Returns Promise<number> = actual spoken duration in ms.
 * Never hangs — resolves via onend, onerror, or max-time watchdog.
 */
export function speakOne(
  text: string,
  opts: { rate?: number; pitch?: number; cancel?: boolean } = {}
): Promise<number> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(0); return;
    }
    const trimmed = text.trim();
    if (!trimmed) { resolve(0); return; }

    const { rate = 0.9, pitch = 1.0, cancel = true } = opts;
    const estMs = Math.ceil((trimmed.split(/\s+/).length / rate) * 420); // ~420ms/word at rate=1
    const maxMs = estMs + 3000; // never wait more than estimate + 3s

    if (cancel) window.speechSynthesis.cancel();
    wakeUp();

    const utt = new SpeechSynthesisUtterance(trimmed);
    const voice = pickVoice();
    if (voice) utt.voice = voice;
    utt.lang   = 'en-IN';
    utt.rate   = rate;
    utt.pitch  = pitch;
    utt.volume = 1;

    let startedAt = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      clearTimeout(startWatchdog);
      const dur = startedAt ? Date.now() - startedAt : estMs;
      resolve(dur);
    };

    utt.onstart = () => { startedAt = Date.now(); clearTimeout(startWatchdog); };
    utt.onend   = finish;
    utt.onerror = () => finish();

    // Max-time watchdog — never hang
    const watchdog = setTimeout(finish, maxMs);

    // Start watchdog — if speech hasn't started in 800ms, cancel and retry once
    const startWatchdog = setTimeout(() => {
      if (startedAt) return; // already started
      window.speechSynthesis.cancel();
      wakeUp();
      const utt2 = new SpeechSynthesisUtterance(trimmed);
      if (voice) utt2.voice = voice;
      utt2.lang = 'en-IN'; utt2.rate = rate; utt2.pitch = pitch; utt2.volume = 1;
      utt2.onstart = () => { startedAt = Date.now(); };
      utt2.onend   = finish;
      utt2.onerror = () => finish();
      window.speechSynthesis.speak(utt2);
    }, 800);

    window.speechSynthesis.speak(utt);
  });
}

/**
 * Speak a sequence of phrases, waiting for each to finish before starting next.
 * Returns total duration in ms.
 */
export async function speakChain(
  phrases: string[],
  opts: { rate?: number; pitch?: number } = {}
): Promise<number> {
  let total = 0;
  for (const phrase of phrases) {
    if (!phrase?.trim()) continue;
    const dur = await speakOne(phrase, { ...opts, cancel: false });
    total += dur;
    // Small natural pause between sentences
    await new Promise(r => setTimeout(r, 220));
    total += 220;
  }
  return total;
}

// Keep old `speak` export for backwards compatibility
export function speak(
  text: string,
  opts: { rate?: number; pitch?: number; cancel?: boolean } = {}
): Promise<void> {
  return speakOne(text, opts).then(() => {});
}

export function cancelSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ── Announcement builders ────────────────────────────────────────────────────

export function announcePool(label: string): string {
  return `Ladies and gentlemen! We now begin the ${label} pool! Get ready to place your bids!`;
}

export function announcePlayer(player: Player): string {
  const roleMap: Record<string,string> = {
    BAT:'batsman', BOWL:'bowler', AR:'all-rounder', WK:'wicket-keeper batsman',
  };
  const role   = roleMap[player.role] ?? player.role;
  const nation = player.nationality === 'Indian' ? 'Indian' : 'overseas';
  const base   = formatPrice(player.basePrice);
  const form   = player.form === 'Excellent' ? ', in excellent form'
               : player.form === 'Good'      ? ', in good form' : '';
  return `Up for bid — ${player.name}! A ${nation} ${role}${form}. Base price ${base}.`;
}

export function announceGoingOnce(amount: number): string {
  return `Going once, at ${formatPrice(amount)}!`;
}

export function announceGoingTwice(amount: number): string {
  return `Going twice, at ${formatPrice(amount)}! Last chance!`;
}

export function announceSold(player: Player, team: TeamInfo, amount: number): string {
  return `Sold! ${player.name} goes to ${team.name} for ${formatPrice(amount)}! What a buy!`;
}

export function announceUnsold(player: Player): string {
  return `${player.name} is unsold. Moving on.`;
}

export function announceBreak(nextLabel: string): string {
  return `Pool concluded. We now take a short break before the ${nextLabel} pool. Stand by.`;
}

export function announceRapid(): string {
  return `All pools complete! We now begin the rapid round for unsold players. Bids move faster — stay alert!`;
}
