/**
 * Web Audio API Sound Synthesizer for My Space
 * Provides rich, organic acoustic feedback for Love Nudges, incoming messages, and intimate couple moments.
 */

class SoundService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Check local storage for mute preference
    try {
      const saved = localStorage.getItem('myspace_sound_muted');
      if (saved !== null) {
        this.isMuted = saved === 'true';
      }
    } catch {
      this.isMuted = false;
    }
  }

  /**
   * Lazily initialize and resume AudioContext on user interaction
   */
  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('myspace_sound_muted', String(this.isMuted));
    } catch {}
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('myspace_sound_muted', String(muted));
    } catch {}
  }

  /**
   * 💖 Love Nudge Sound:
   * A warm celestial harp chime arpeggio + intimate heartbeat resonance.
   */
  public playLoveNudgeSound(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Soft Heartbeat Sub-pulse
    this.playSubPulse(now, 110, 0.35, 0.4);
    this.playSubPulse(now + 0.16, 95, 0.28, 0.35);

    // 2. Romantic Celestial Chime Arpeggio (E Major 9th / F# Romance: C#5, E5, G#5, B5, E6)
    const chordNotes = [
      { freq: 554.37, time: 0.00, duration: 0.8, gain: 0.18 }, // C#5
      { freq: 659.25, time: 0.09, duration: 0.9, gain: 0.22 }, // E5
      { freq: 830.61, time: 0.18, duration: 1.1, gain: 0.24 }, // G#5
      { freq: 987.77, time: 0.27, duration: 1.3, gain: 0.20 }, // B5
      { freq: 1318.51, time: 0.38, duration: 1.5, gain: 0.16 } // E6
    ];

    chordNotes.forEach(note => {
      const noteStart = now + note.time;

      // Primary tone (warm sine)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, noteStart);
      filter.frequency.exponentialRampToValueAtTime(800, noteStart + note.duration);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, noteStart);

      // Shimmer harmonic (triangle wave at octave)
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(note.freq * 2, noteStart);

      // Envelope
      oscGain.gain.setValueAtTime(0.0001, noteStart);
      oscGain.gain.linearRampToValueAtTime(note.gain, noteStart + 0.03);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.duration);

      shimmerGain.gain.setValueAtTime(0.0001, noteStart);
      shimmerGain.gain.linearRampToValueAtTime(note.gain * 0.25, noteStart + 0.02);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.duration * 0.7);

      // Connect nodes
      osc.connect(oscGain);
      shimmer.connect(shimmerGain);
      oscGain.connect(filter);
      shimmerGain.connect(filter);
      filter.connect(ctx.destination);

      osc.start(noteStart);
      shimmer.start(noteStart);
      osc.stop(noteStart + note.duration);
      shimmer.stop(noteStart + note.duration);
    });
  }

  /**
   * 💬 Incoming Message Sound:
   * A gentle, crisp crystal droplet chime (two melodic tones).
   */
  public playIncomingMessageSound(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 784, time: 0, dur: 0.35, gain: 0.18 },   // G5
      { freq: 1174.66, time: 0.08, dur: 0.55, gain: 0.22 } // D6
    ];

    notes.forEach(n => {
      const startTime = now + n.time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, startTime);
      filter.frequency.exponentialRampToValueAtTime(1200, startTime + n.dur);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, startTime);
      // Subtle pitch bend upwards
      osc.frequency.exponentialRampToValueAtTime(n.freq * 1.02, startTime + 0.04);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(n.gain, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + n.dur);

      osc.connect(gain);
      gain.connect(filter);
      filter.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + n.dur);
    });
  }

  /**
   * 📤 Outgoing Message Sent Sound:
   * A soft, subtle tactile pop tone.
   */
  public playSentMessageSound(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.05);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * 💓 Heartbeat / Love Tap Sound:
   * An intimate double-thump acoustic bass pulse.
   */
  public playHeartbeatSound(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playSubPulse(now, 120, 0.4, 0.35);
    this.playSubPulse(now + 0.18, 100, 0.32, 0.3);
  }

  /**
   * ✨ Reaction Sparkle Sound:
   * Quick cheerful twinkle.
   */
  public playReactionSound(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [1046.5, 1318.5, 1567.98]; // C6, E6, G6

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.1, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  /**
   * Helper for low frequency pulse
   */
  private playSubPulse(startTime: number, freq: number, gainLevel: number, duration: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, startTime);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainLevel, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const Sound = new SoundService();
