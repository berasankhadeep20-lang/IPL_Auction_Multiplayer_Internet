let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function ramp(gain: GainNode, from: number, to: number, start: number, end: number) {
  gain.gain.setValueAtTime(from, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(to, 0.0001), end);
}

export function playHammer() {
  try {
    const c = getCtx();
    const t = c.currentTime;
    // Percussive wooden knock
    const osc  = c.createOscillator();
    const gain = c.createGain();
    const dist = c.createWaveShaper();
    dist.curve = makeDistortionCurve(200);
    osc.connect(dist);
    dist.connect(gain);
    gain.connect(c.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
    ramp(gain, 0.6, 0.001, t, t + 0.18);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch { /* silent */ }
}

export function playBidPlaced() {
  try {
    const c = getCtx();
    const t = c.currentTime;
    [440, 660].forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const s = t + i * 0.08;
      ramp(gain, 0.25, 0.001, s, s + 0.15);
      osc.start(s);
      osc.stop(s + 0.18);
    });
  } catch { /* silent */ }
}

export function playCrowdCheer() {
  try {
    const c = getCtx();
    const t = c.currentTime;
    const bufSize = c.sampleRate * 0.8;
    const buffer  = c.createBuffer(1, bufSize, c.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const src    = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain   = c.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    src.buffer = buffer;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.start(t);
    src.stop(t + 0.85);
  } catch { /* silent */ }
}

export function playTimerTick(urgent = false) {
  try {
    const c = getCtx();
    const t = c.currentTime;
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'square';
    osc.frequency.value = urgent ? 880 : 440;
    ramp(gain, urgent ? 0.1 : 0.05, 0.001, t, t + 0.05);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch { /* silent */ }
}

export function playUnsold() {
  try {
    const c = getCtx();
    const t = c.currentTime;
    [350, 280].forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const s = t + i * 0.18;
      ramp(gain, 0.15, 0.001, s, s + 0.3);
      osc.start(s);
      osc.stop(s + 0.35);
    });
  } catch { /* silent */ }
}

export function playNewPlayer() {
  try {
    const c = getCtx();
    const t = c.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const s = t + i * 0.1;
      ramp(gain, 0.2, 0.001, s, s + 0.2);
      osc.start(s);
      osc.stop(s + 0.22);
    });
  } catch { /* silent */ }
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(n) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < n; ++i) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}
