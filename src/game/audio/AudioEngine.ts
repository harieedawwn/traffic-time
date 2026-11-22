import type { VehicleId } from '../types';

/**
 * Web Audio Engine for Traffic Time:
 * - Loads real CC0 audio assets from public/assets/audio/ (motorcycles, car engine, car horn, tire brake, crash)
 * - Procedural Web Audio synthesis for:
 *   * Vietnamese motorbike dual-tone raspy horn (~420Hz + 500Hz)
 *   * Turn-signal relay tick-tock
 *   * Vietnamese street ambience (filtered city traffic noise + occasional distant honks)
 *   * Emergency ambulance siren when nearby
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loadingStarted = false;

  // Engine loop
  private engineSource: AudioBufferSourceNode | null = null;
  private engineGain: GainNode | null = null;
  private synthEngineOsc: OscillatorNode | null = null;
  private synthEngineGain: GainNode | null = null;
  private currentVehicle: VehicleId = 'wave110';

  // Ambience
  private ambienceGain: GainNode | null = null;
  private distantHonkTimer = 3;

  // Active horn
  private hornActive = false;
  private bikeHornOsc1: OscillatorNode | null = null;
  private bikeHornOsc2: OscillatorNode | null = null;
  private bikeHornGain: GainNode | null = null;
  private carHornSource: AudioBufferSourceNode | null = null;

  // Brake screech cooldown & relay state
  private lastBrakePlay = 0;
  private lastCrashPlay = 0;
  private lastBlinkState = false;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  volume = 0.7;
  muted = false;

  /** Must be called from a user interaction gesture (Start click / keypress) to unlock Web Audio. */
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.startAmbience();
      this.startSynthEngine();
      this.preloadAssets();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setVolume(vol: number, muted: boolean) {
    this.volume = vol;
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : vol, this.ctx.currentTime, 0.04);
    }
  }

  setVehicle(v: VehicleId) {
    this.currentVehicle = v;
    if (this.ctx) this.restartEngineLoop();
  }

  private async preloadAssets() {
    if (this.loadingStarted || !this.ctx) return;
    this.loadingStarted = true;
    const files: [string, string][] = [
      ['engine-moto', '/assets/audio/vehicles/kenney-engine-motorcycle.ogg'],
      ['engine-car', '/assets/audio/vehicles/kenney-engine-car.ogg'],
      ['honk-car', '/assets/audio/vehicles/rg-honk.mp3'],
      ['brake', '/assets/audio/vehicles/rg-tire-brake.mp3'],
      ['crash', '/assets/audio/vehicles/rg-crash.mp3'],
    ];
    for (const [key, url] of files) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        if (!this.ctx) return;
        const decoded = await this.ctx.decodeAudioData(arr);
        this.buffers.set(key, decoded);
        if ((key === 'engine-moto' && this.currentVehicle !== 'sedan') || (key === 'engine-car' && this.currentVehicle === 'sedan')) {
          this.restartEngineLoop();
        }
      } catch {
        // Fallback procedural audio remains active
      }
    }
  }

  private startSynthEngine() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 65;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    this.synthEngineOsc = osc;
    this.synthEngineGain = gain;
  }

  private restartEngineLoop() {
    if (!this.ctx || !this.masterGain) return;
    if (this.engineSource) {
      try {
        this.engineSource.stop();
      } catch {
        /* ignore */
      }
      this.engineSource.disconnect();
      this.engineSource = null;
    }
    const key = this.currentVehicle === 'sedan' ? 'engine-car' : 'engine-moto';
    const buf = this.buffers.get(key);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.22;
    src.connect(gain);
    gain.connect(this.masterGain);
    src.start();
    this.engineSource = src;
    this.engineGain = gain;
  }

  private startAmbience() {
    if (!this.ctx || !this.masterGain) return;
    // Filtered brown/pink noise representing distant Vietnamese urban traffic hum
    const len = this.ctx.sampleRate * 3;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.035 * white) / 1.035;
      last = data[i];
      data[i] *= 2.8;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 280;
    filter.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.07;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();
    this.ambienceGain = gain;
  }

  update(
    dt: number,
    playing: boolean,
    rpm: number,
    maxRpm: number,
    speedKmh: number,
    braking: boolean,
    hornPressed: boolean,
    signalBlinkOn: boolean,
    ambulanceNearby: boolean,
    elapsedSec: number,
  ) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const rpmFrac = Math.max(0, Math.min(1, rpm / Math.max(1000, maxRpm)));

    // Silence active loops when paused/title
    const activeScale = playing ? 1 : 0;

    if (this.engineSource && this.engineGain) {
      this.engineSource.playbackRate.setTargetAtTime(0.65 + rpmFrac * 1.35, now, 0.06);
      this.engineGain.gain.setTargetAtTime(activeScale * (0.14 + rpmFrac * 0.16), now, 0.06);
    }
    if (this.synthEngineOsc && this.synthEngineGain) {
      const baseHz = this.currentVehicle === 'sedan' ? 42 : 62;
      this.synthEngineOsc.frequency.setTargetAtTime(baseHz + rpmFrac * (this.currentVehicle === 'sedan' ? 110 : 175), now, 0.05);
      const hasSample = Boolean(this.engineSource);
      this.synthEngineGain.gain.setTargetAtTime(activeScale * (hasSample ? 0.025 : 0.075), now, 0.06);
    }
    if (this.ambienceGain) {
      this.ambienceGain.gain.setTargetAtTime(playing ? 0.065 : 0.02, now, 0.1);
    }

    // Player Horn (E / F)
    if (playing && hornPressed && !this.hornActive) {
      this.startHorn();
    } else if ((!playing || !hornPressed) && this.hornActive) {
      this.stopHorn();
    }

    // Turn-signal relay tick-tock
    if (playing && signalBlinkOn !== this.lastBlinkState) {
      this.lastBlinkState = signalBlinkOn;
      this.playRelayClick(signalBlinkOn);
    }

    // Hard brake screech
    if (playing && braking && speedKmh > 26 && elapsedSec - this.lastBrakePlay > 0.9) {
      this.lastBrakePlay = elapsedSec;
      this.playOneShot('brake', 0.28);
    }

    // Random distant Vietnamese city honk ambience
    if (playing) {
      this.distantHonkTimer -= dt;
      if (this.distantHonkTimer <= 0) {
        this.distantHonkTimer = 4.5 + Math.random() * 8;
        this.playDistantBikeHonk(0.025 + Math.random() * 0.03);
      }
    }

    // Emergency Ambulance Siren
    if (playing && ambulanceNearby) {
      if (!this.sirenOsc && this.masterGain) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        const gain = this.ctx.createGain();
        gain.gain.value = 0.09;
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        this.sirenOsc = osc;
        this.sirenGain = gain;
      }
      if (this.sirenOsc) {
        const freq = 660 + Math.sin(elapsedSec * 5.2) * 210;
        this.sirenOsc.frequency.setTargetAtTime(freq, now, 0.03);
      }
    } else if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
      } catch {
        /* ignore */
      }
      this.sirenOsc.disconnect();
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  private startHorn() {
    if (!this.ctx || !this.masterGain) return;
    this.hornActive = true;
    if (this.currentVehicle === 'sedan' && this.buffers.has('honk-car')) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.get('honk-car')!;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0.35;
      src.connect(g);
      g.connect(this.masterGain);
      src.start();
      this.carHornSource = src;
      return;
    }
    // Authentic VN motorbike dual-tone raspy horn (~420Hz + ~505Hz sawtooth through bandpass)
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.frequency.value = this.currentVehicle === 'sedan' ? 380 : 425;
    o2.frequency.value = this.currentVehicle === 'sedan' ? 475 : 510;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 1.4;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.16;
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    o1.start();
    o2.start();
    this.bikeHornOsc1 = o1;
    this.bikeHornOsc2 = o2;
    this.bikeHornGain = gain;
  }

  private stopHorn() {
    this.hornActive = false;
    if (this.carHornSource) {
      try {
        this.carHornSource.stop();
      } catch {
        /* ignore */
      }
      this.carHornSource.disconnect();
      this.carHornSource = null;
    }
    if (this.bikeHornOsc1) {
      try {
        this.bikeHornOsc1.stop();
        this.bikeHornOsc2?.stop();
      } catch {
        /* ignore */
      }
      this.bikeHornOsc1.disconnect();
      this.bikeHornOsc2?.disconnect();
      this.bikeHornGain?.disconnect();
      this.bikeHornOsc1 = null;
      this.bikeHornOsc2 = null;
      this.bikeHornGain = null;
    }
  }

  playNpcHonk(distance: number) {
    const vol = Math.max(0.015, Math.min(0.14, (1 - distance / 35) * 0.13));
    this.playDistantBikeHonk(vol);
  }

  private playDistantBikeHonk(vol: number) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 410 + Math.random() * 90;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.015);
    g.gain.setValueAtTime(vol, now + 0.14);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    o.start(now);
    o.stop(now + 0.2);
  }

  private playRelayClick(high: boolean) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = high ? 1400 : 980;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(now);
    o.stop(now + 0.03);
  }

  playCrash(elapsedSec: number) {
    if (!this.ctx || !this.masterGain || elapsedSec - this.lastCrashPlay < 0.45) return;
    this.lastCrashPlay = elapsedSec;
    if (this.buffers.has('crash')) {
      this.playOneShot('crash', 0.42);
      return;
    }
    // Procedural impact thud fallback
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, now);
    o.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(now);
    o.stop(now + 0.26);
  }

  private playOneShot(key: string, vol: number) {
    if (!this.ctx || !this.masterGain) return;
    const buf = this.buffers.get(key);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.masterGain);
    src.start();
  }

  dispose() {
    this.stopHorn();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
