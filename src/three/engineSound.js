let audioCtx = null;
let masterGain = null;
let idleOsc = null;
let idleGain = null;
let harmonics = [];
let noiseNode = null;
let noiseGain = null;
let started = false;

export function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.3;
  masterGain.connect(audioCtx.destination);
}

export function playStartupSound(onComplete) {
  if (!audioCtx) initAudio();
  if (!audioCtx) return;
  if (started) return;
  started = true;

  const now = audioCtx.currentTime;

  /* ─── STARTER MOTOR (0-0.6s) ─── */
  const starter = audioCtx.createOscillator();
  const starterGain = audioCtx.createGain();
  starter.type = 'sawtooth';
  starter.frequency.setValueAtTime(80, now);
  starter.frequency.linearRampToValueAtTime(120, now + 0.5);
  starterGain.gain.setValueAtTime(0.15, now);
  starterGain.gain.linearRampToValueAtTime(0.2, now + 0.3);
  starterGain.gain.linearRampToValueAtTime(0, now + 0.6);
  starter.connect(starterGain);
  starterGain.connect(masterGain);
  starter.start(now);
  starter.stop(now + 0.6);

  /* ─── INITIAL COUGH / BACKFIRE (0.5s) ─── */
  const cough = audioCtx.createOscillator();
  const coughGain = audioCtx.createGain();
  cough.type = 'sawtooth';
  cough.frequency.setValueAtTime(40, now + 0.5);
  cough.frequency.linearRampToValueAtTime(150, now + 0.7);
  coughGain.gain.setValueAtTime(0, now + 0.4);
  coughGain.gain.linearRampToValueAtTime(0.25, now + 0.55);
  coughGain.gain.linearRampToValueAtTime(0, now + 0.8);
  cough.connect(coughGain);
  coughGain.connect(masterGain);
  cough.start(now + 0.4);
  cough.stop(now + 0.8);

  /* ─── ENGINE START BURST (0.6-1.2s) ─── */
  const burstOsc = audioCtx.createOscillator();
  const burstGain = audioCtx.createGain();
  burstOsc.type = 'sawtooth';
  burstOsc.frequency.setValueAtTime(100, now + 0.6);
  burstOsc.frequency.linearRampToValueAtTime(180, now + 1.0);
  burstOsc.frequency.linearRampToValueAtTime(80, now + 1.8);
  burstGain.gain.setValueAtTime(0, now + 0.5);
  burstGain.gain.linearRampToValueAtTime(0.3, now + 0.7);
  burstGain.gain.linearRampToValueAtTime(0.15, now + 1.2);
  burstGain.gain.setValueAtTime(0.15, now + 1.8);
  burstOsc.connect(burstGain);
  burstGain.connect(masterGain);
  burstOsc.start(now + 0.5);
  burstOsc.stop(now + 2.0);

  /* ─── NOISE BURST (exhaust pop) ─── */
  const bufferSize = audioCtx.sampleRate * 0.3;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.05));
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const noiseEnv = audioCtx.createGain();
  noiseEnv.gain.setValueAtTime(0, now + 0.55);
  noiseEnv.gain.linearRampToValueAtTime(0.2, now + 0.65);
  noiseEnv.gain.linearRampToValueAtTime(0, now + 0.9);
  noise.connect(noiseEnv);
  noiseEnv.connect(masterGain);
  noise.start(now + 0.55);
  noise.stop(now + 0.9);

  /* ─── TRANSITION TO IDLE ─── */
  setTimeout(() => {
    startIdle();
    if (onComplete) onComplete();
  }, 2000);
}

function startIdle() {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  /* Main idle rumble */
  idleOsc = audioCtx.createOscillator();
  idleGain = audioCtx.createGain();
  idleOsc.type = 'sawtooth';
  idleOsc.frequency.setValueAtTime(85, now);
  idleOsc.frequency.linearRampToValueAtTime(75, now + 0.5);

  idleGain.gain.setValueAtTime(0.12, now);
  idleOsc.connect(idleGain);
  idleGain.connect(masterGain);
  idleOsc.start(now);

  /* Harmonics for richness */
  const harmFreqs = [150, 220, 310, 420];
  harmonics = harmFreqs.map((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = i < 2 ? 'sawtooth' : 'square';
    osc.frequency.value = freq;
    gain.gain.value = 0.04 / (i + 1);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    return { osc, gain, baseFreq: freq };
  });

  /* Exhaust noise */
  noiseNode = audioCtx.createBufferSource();
  const noiseLen = audioCtx.sampleRate * 2;
  const noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.3;
  }
  noiseNode.buffer = noiseBuf;
  noiseNode.loop = true;

  const lpFilter = audioCtx.createBiquadFilter();
  lpFilter.type = 'lowpass';
  lpFilter.frequency.value = 200;
  lpFilter.Q.value = 1;

  noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.03;

  noiseNode.connect(lpFilter);
  lpFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseNode.start(now);
}

export function setRPM(frac) {
  if (!audioCtx || !idleOsc) return;
  const now = audioCtx.currentTime;
  const freq = 75 + frac * 350;
  idleOsc.frequency.setTargetAtTime(freq, now, 0.1);
  idleGain.gain.setTargetAtTime(0.08 + frac * 0.25, now, 0.1);

  harmonics.forEach((h, i) => {
    const hFreq = h.baseFreq + frac * 600;
    h.osc.frequency.setTargetAtTime(hFreq, now, 0.1);
    h.gain.gain.setTargetAtTime(0.03 / (i + 1) + frac * 0.08, now, 0.1);
  });

  if (noiseGain) {
    noiseGain.gain.setTargetAtTime(0.02 + frac * 0.06, now, 0.1);
  }
}

export function stopEngine() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  if (idleOsc) {
    idleGain.gain.linearRampToValueAtTime(0, now + 0.3);
    idleOsc.stop(now + 0.3);
    idleOsc = null;
  }

  harmonics.forEach((h) => {
    h.gain.gain.linearRampToValueAtTime(0, now + 0.3);
    h.osc.stop(now + 0.3);
  });
  harmonics = [];

  if (noiseNode) {
    noiseGain.gain.linearRampToValueAtTime(0, now + 0.3);
    noiseNode.stop(now + 0.3);
    noiseNode = null;
  }

  if (masterGain) {
    masterGain.gain.linearRampToValueAtTime(0, now + 0.3);
  }

  started = false;
}
