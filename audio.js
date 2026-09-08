/* All sounds are synthesized locally; no downloads, music files or network needed. */
(function (root) {
  'use strict';
  class ForestAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicBus = null;
      this.enabled = true;
      this.music = false;
      this.volume = 0.45;
      this.musicTimer = null;
      this.lastHit = -1;
      this.played = 0;
      this.step = 0;
      this.active = true;
    }
    async unlock() {
      const Context = root.AudioContext || root.webkitAudioContext;
      if (!Context) return false;
      try {
        if (!this.ctx) {
          this.ctx = new Context();
          const limiter = this.ctx.createDynamicsCompressor();
          limiter.threshold.value = -16;
          limiter.ratio.value = 5;
          this.master = this.ctx.createGain();
          this.master.gain.value = this.enabled ? this.volume * 0.35 : 0;
          this.master.connect(limiter);
          limiter.connect(this.ctx.destination);
          this.musicBus = this.ctx.createGain();
          this.musicBus.gain.value = 0.45;
          this.musicBus.connect(this.master);
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        if (this.music && !this.musicTimer && this.enabled && this.active) this.startMusic();
        return this.ctx.state === 'running';
      } catch {
        return false;
      }
    }
    configure({ enabled = this.enabled, music = this.music, volume = this.volume } = {}) {
      this.enabled = enabled;
      this.music = music;
      this.volume = Math.max(0, Math.min(1, volume));
      if (this.master)
        this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.35 : 0, this.ctx.currentTime, 0.04);
      if (this.musicBus) this.musicBus.gain.setTargetAtTime(enabled && music ? 0.45 : 0, this.ctx.currentTime, 0.06);
      if (!enabled || !music) this.stopMusic();
      else if (this.ctx?.state === 'running' && this.active) this.startMusic();
    }
    tone(freq, duration = 0.2, { type = 'sine', gain = 0.25, delay = 0, end = freq, bus = this.master } = {}) {
      if (!this.ctx || !bus) return;
      const at = this.ctx.currentTime + delay,
        osc = this.ctx.createOscillator(),
        env = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), at + duration);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(gain, at + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(env);
      env.connect(bus);
      osc.start(at);
      osc.stop(at + duration + 0.03);
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };
      this.played++;
    }
    noise(duration = 0.12, gain = 0.16, cutoff = 1800) {
      if (!this.ctx) return;
      const n = Math.ceil(this.ctx.sampleRate * duration),
        buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource(),
        filter = this.ctx.createBiquadFilter(),
        env = this.ctx.createGain();
      src.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      env.gain.value = gain;
      src.connect(filter);
      filter.connect(env);
      env.connect(this.master);
      src.start();
      src.onended = () => {
        src.disconnect();
        filter.disconnect();
        env.disconnect();
      };
      this.played++;
    }
    play(name) {
      if (!this.enabled || !this.active || !this.ctx || this.ctx.state === 'closed') return;
      // OfflineAudioContext schedules the same synth before rendering starts.
      if (this.ctx.state !== 'running' && typeof this.ctx.startRendering !== 'function') return;
      switch (name) {
        case 'click':
          this.tone(640, 0.075, { gain: 0.1, end: 480 });
          break;
        case 'move':
          this.tone(280, 0.1, { type: 'triangle', gain: 0.18, end: 350 });
          break;
        case 'buy':
          [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.22, { gain: 0.19, delay: i * 0.065 }));
          break;
        case 'equip':
          [440, 660].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', gain: 0.2, delay: i * 0.07 }));
          break;
        case 'merge':
          [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.6, { gain: 0.24, delay: i * 0.085 }));
          break;
        case 'error':
          this.tone(180, 0.16, { type: 'triangle', gain: 0.18, end: 120 });
          break;
        case 'start':
          [196, 294, 392].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', gain: 0.25, delay: i * 0.12 }));
          break;
        case 'arrow':
          if (this.ctx.currentTime - this.lastHit < 0.09) return;
          this.lastHit = this.ctx.currentTime;
          this.tone(950, 0.1, { gain: 0.08, end: 400 });
          this.noise(0.055, 0.06, 3000);
          break;
        case 'hit':
          if (this.ctx.currentTime - this.lastHit < 0.09) return;
          this.lastHit = this.ctx.currentTime;
          this.noise(0.09, 0.16, 1600);
          this.tone(120, 0.09, { type: 'triangle', gain: 0.19, end: 60 });
          break;
        case 'magic':
          this.tone(430, 0.34, { gain: 0.2, end: 940 });
          this.tone(645, 0.42, { gain: 0.1, delay: 0.05, end: 1290 });
          break;
        case 'heal':
          [587, 740, 880].forEach((f, i) => this.tone(f, 0.4, { gain: 0.12, delay: i * 0.045 }));
          break;
        case 'shield':
          this.tone(210, 0.4, { type: 'triangle', gain: 0.18, end: 420 });
          break;
        case 'death':
          this.tone(180, 0.2, { type: 'triangle', gain: 0.08, end: 70 });
          break;
        case 'victory':
          [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.7, { gain: 0.22, delay: i * 0.13 }));
          break;
        case 'defeat':
          [392, 349, 294, 196].forEach((f, i) => this.tone(f, 0.7, { type: 'triangle', gain: 0.2, delay: i * 0.18 }));
          break;
        case 'reward':
          [660, 880, 1320].forEach((f, i) => this.tone(f, 0.5, { gain: 0.18, delay: i * 0.09 }));
          break;
      }
    }
    startMusic() {
      if (this.musicTimer || !this.ctx || !this.enabled || !this.active) return;
      const melody = [392, 0, 523, 587, 0, 659, 587, 523, 440, 0, 392, 0, 330, 392, 0, 294];
      const next = () => {
        if (!this.music || !this.enabled || !this.active) return;
        const n = this.step++ % melody.length,
          f = melody[n];
        if (f) this.tone(f, 2.4, { gain: 0.1, bus: this.musicBus });
        if (n % 4 === 0) [130.81, 196, 261.63].forEach(v => this.tone(v, 4.5, { gain: 0.04, bus: this.musicBus }));
      };
      next();
      this.musicTimer = setInterval(next, 850);
    }
    stopMusic() {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    setActive(value) {
      this.active = value;
      if (!value) {
        this.stopMusic();
        if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {});
      } else if (this.enabled) this.unlock();
    }
  }
  root.ForestAudio = ForestAudio;
})(typeof window !== 'undefined' ? window : globalThis);
