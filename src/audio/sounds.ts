import type { EngineEvent, CowBehavior } from '../engine/types'
import { SUNRISE_HOUR, SUNSET_HOUR } from '../engine/constants'

/**
 * Procedural audio engine for the Digital Cow farm simulation.
 *
 * Uses the Web Audio API exclusively — no external audio files.
 * Lazy-initialized on first user gesture to comply with browser autoplay policies.
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  // Persistent nodes for continuous sounds
  private windGain: GainNode | null = null

  // Chewing state
  private chewingSource: AudioBufferSourceNode | null = null
  private chewingGain: GainNode | null = null
  private chewingInterval: ReturnType<typeof setInterval> | null = null

  // Footstep state
  private footstepInterval: ReturnType<typeof setInterval> | null = null

  // Ambient state
  private birdInterval: ReturnType<typeof setInterval> | null = null
  private cricketSource: AudioBufferSourceNode | null = null
  private cricketGain: GainNode | null = null
  private currentAmbient: 'day' | 'night' | 'none' = 'none'

  private initialized = false

  // ── Initialization ──────────────────────────────────────

  /**
   * Call on the first user click / tap. Creates the AudioContext and shared
   * resources, then starts the ambient wind layer (initially silent).
   */
  async init(): Promise<void> {
    if (this.initialized) return

    this.ctx = new AudioContext()

    // Resume if the browser suspended the context before a gesture
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }

    // Master gain — controls overall volume
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 1.0
    this.masterGain.connect(this.ctx.destination)

    // Shared white-noise buffer (2 seconds, mono)
    this.noiseBuffer = this.createNoiseBuffer(2)

    // Start the continuous wind layer (volume controlled externally)
    this.startWindLoop()

    this.initialized = true
  }

  // ── Noise Buffer ────────────────────────────────────────

  private createNoiseBuffer(durationSeconds: number): AudioBuffer {
    const ctx = this.ctx!
    const sampleRate = ctx.sampleRate
    const length = sampleRate * durationSeconds
    const buffer = ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }

    return buffer
  }

  // ── Moo ─────────────────────────────────────────────────

  /**
   * Triangle-wave oscillator: 300 Hz → 200 Hz over 0.6 s with a gain envelope.
   */
  playMoo(): void {
    if (!this.ctx || !this.masterGain) return

    const ctx = this.ctx
    const now = ctx.currentTime

    // Oscillator
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(300, now)
    osc.frequency.linearRampToValueAtTime(200, now + 0.6)

    // Gain envelope: attack 0.05 s, sustain 0.4 s, release 0.15 s
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05)            // attack
    gain.gain.setValueAtTime(0.4, now + 0.05 + 0.4)               // sustain
    gain.gain.linearRampToValueAtTime(0, now + 0.05 + 0.4 + 0.15) // release

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.6)
  }

  // ── Chewing ─────────────────────────────────────────────

  /**
   * Looped noise → bandpass 800 Hz (Q 2) → pulsing gain (0.1 s on / 0.1 s off).
   */
  startChewing(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return

    // Stop any existing chewing sound first
    this.stopChewing()

    const ctx = this.ctx

    // Noise source (looping)
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true

    // Bandpass filter
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 800
    filter.Q.value = 2

    // Gain for pulsing
    const gain = ctx.createGain()
    gain.gain.value = 0

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    source.start()

    // Schedule on/off pulses using setValueAtTime for precise timing
    this.scheduleChewingPulses(gain)

    this.chewingSource = source
    this.chewingGain = gain
  }

  private scheduleChewingPulses(gain: GainNode): void {
    if (!this.ctx) return

    const ctx = this.ctx
    const pulseDuration = 0.1 // seconds on
    const pauseDuration = 0.1 // seconds off
    const cycleLength = pulseDuration + pauseDuration
    const scheduleAhead = 2.0 // seconds to schedule ahead

    const scheduleBatch = (): void => {
      if (!this.chewingGain || this.chewingGain !== gain) return

      const now = ctx.currentTime
      const end = now + scheduleAhead

      let t = now
      while (t < end) {
        gain.gain.setValueAtTime(0.15, t)
        gain.gain.setValueAtTime(0, t + pulseDuration)
        t += cycleLength
      }
    }

    // Initial schedule
    scheduleBatch()

    // Reschedule every second to keep pulses going
    this.chewingInterval = setInterval(scheduleBatch, 1000)
  }

  stopChewing(): void {
    if (this.chewingInterval !== null) {
      clearInterval(this.chewingInterval)
      this.chewingInterval = null
    }

    if (this.chewingSource) {
      try {
        this.chewingSource.stop()
      } catch {
        // Already stopped
      }
      this.chewingSource.disconnect()
      this.chewingSource = null
    }

    if (this.chewingGain) {
      this.chewingGain.disconnect()
      this.chewingGain = null
    }
  }

  // ── Footstep ────────────────────────────────────────────

  /**
   * Short burst of high-pass-filtered noise (0.05 s) with a quick decay.
   */
  playFootstep(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return

    const ctx = this.ctx
    const now = ctx.currentTime

    // Non-looping noise source
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = false

    // High-pass filter
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 2000

    // Quick decay envelope
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    source.start(now)
    source.stop(now + 0.05)
  }

  // ── Place Food ────────────────────────────────────────

  /**
   * Short soft thud/drop sound — low frequency thump (~100 Hz) with a short decay.
   */
  playPlaceFood(): void {
    if (!this.ctx || !this.masterGain) return

    const ctx = this.ctx
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(100, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.15)
  }

  // ── Food Gone ─────────────────────────────────────────

  /**
   * Satisfied chewing finish / gulp — brief noise burst through a bandpass filter.
   */
  playFoodGone(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return

    const ctx = this.ctx
    const now = ctx.currentTime

    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = false

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1200, now)
    filter.frequency.linearRampToValueAtTime(600, now + 0.12)
    filter.Q.value = 3

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    source.start(now)
    source.stop(now + 0.12)
  }

  // ── Jump ──────────────────────────────────────────────

  /**
   * Quick rising whoosh — ascending oscillator sweep 200 → 500 Hz over 0.2 s.
   */
  playJump(): void {
    if (!this.ctx || !this.masterGain) return

    const ctx = this.ctx
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, now)
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.2)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05)
    gain.gain.linearRampToValueAtTime(0.3, now + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.2)
  }

  // ── Cow Call ──────────────────────────────────────────

  /**
   * Longer, more insistent moo — higher pitch, longer sustain than playMoo.
   */
  playCowCall(): void {
    if (!this.ctx || !this.masterGain) return

    const ctx = this.ctx
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(350, now)
    osc.frequency.linearRampToValueAtTime(230, now + 0.9)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.45, now + 0.05)   // attack
    gain.gain.setValueAtTime(0.45, now + 0.05 + 0.6)      // sustain
    gain.gain.linearRampToValueAtTime(0, now + 0.05 + 0.6 + 0.25) // release

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.9)
  }

  // ── Warning ───────────────────────────────────────────

  /**
   * Subtle alert chime for critical needs — two quick high tones (~800 Hz then ~600 Hz).
   */
  playWarning(): void {
    if (!this.ctx || !this.masterGain) return

    const ctx = this.ctx
    const now = ctx.currentTime

    // First tone — 800 Hz
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = 800

    const gain1 = ctx.createGain()
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.02)
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.1)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

    osc1.connect(gain1)
    gain1.connect(this.masterGain)

    osc1.start(now)
    osc1.stop(now + 0.15)

    // Second tone — 600 Hz
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = 600

    const gain2 = ctx.createGain()
    gain2.gain.setValueAtTime(0, now + 0.15)
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.17)
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.25)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    osc2.connect(gain2)
    gain2.connect(this.masterGain)

    osc2.start(now + 0.15)
    osc2.stop(now + 0.3)
  }

  // ── Playful ───────────────────────────────────────────

  /**
   * Short bouncy chirp for play interaction — quick ascending arpeggio.
   */
  playPlayful(): void {
    if (!this.ctx || !this.masterGain) return

    const ctx = this.ctx
    const now = ctx.currentTime
    const notes = [400, 500, 650]

    notes.forEach((freq, i) => {
      const offset = i * 0.08
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now + offset)
      gain.gain.linearRampToValueAtTime(0.25, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08)

      osc.connect(gain)
      gain.connect(this.masterGain!)

      osc.start(now + offset)
      osc.stop(now + offset + 0.08)
    })
  }

  // ── Settle ────────────────────────────────────────────

  /**
   * Soft low "hmmm" / settling sound — low filtered noise with a gentle fade.
   */
  playSettle(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return

    const ctx = this.ctx
    const now = ctx.currentTime

    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = false

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 300
    filter.Q.value = 1

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.15, now + 0.1)
    gain.gain.linearRampToValueAtTime(0.15, now + 0.3)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    source.start(now)
    source.stop(now + 0.6)
  }

  // ── Footstep Scheduling ───────────────────────────────

  private startFootsteps(behavior: 'walking' | 'running'): void {
    this.stopFootsteps()

    const intervalMs = behavior === 'running' ? 300 : 500
    this.playFootstep()
    this.footstepInterval = setInterval(() => {
      this.playFootstep()
    }, intervalMs)
  }

  private stopFootsteps(): void {
    if (this.footstepInterval !== null) {
      clearInterval(this.footstepInterval)
      this.footstepInterval = null
    }
  }

  // ── Wind (continuous) ───────────────────────────────────

  private startWindLoop(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return

    const ctx = this.ctx

    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 400
    filter.Q.value = 0.5

    const gain = ctx.createGain()
    gain.gain.value = 0 // silent until setWindVolume is called

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    source.start()

    this.windGain = gain
  }

  /**
   * Smoothly adjust the wind layer volume.
   * @param strength 0.0 (silent) – 1.0 (full wind)
   */
  setWindVolume(strength: number): void {
    if (!this.windGain || !this.ctx) return

    const clamped = Math.max(0, Math.min(1, strength))
    // Smooth ramp to avoid clicks
    this.windGain.gain.linearRampToValueAtTime(
      clamped * 0.25,
      this.ctx.currentTime + 0.1,
    )
  }

  // ── Milk ──────────────────────────────────────────────

  /**
   * Squirting milk sound — rhythmic filtered noise bursts.
   */
  playMilk(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return
    const ctx = this.ctx
    const now = ctx.currentTime

    for (let i = 0; i < 4; i++) {
      const offset = i * 0.15
      const source = ctx.createBufferSource()
      source.buffer = this.noiseBuffer
      source.loop = false

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1500 + i * 200
      filter.Q.value = 3

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now + offset)
      gain.gain.linearRampToValueAtTime(0.15, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain!)
      source.start(now + offset)
      source.stop(now + offset + 0.1)
    }
  }

  // ── Ambient Sounds ──────────────────────────────────────

  /**
   * Single bird chirp — short sine tweets at random high frequency.
   */
  private playBirdChirp(): void {
    if (!this.ctx || !this.masterGain) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const baseFreq = 2500 + Math.random() * 2000
    const chirpCount = 2 + Math.floor(Math.random() * 3)

    for (let i = 0; i < chirpCount; i++) {
      const offset = i * 0.08
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(baseFreq + Math.random() * 500, now + offset)
      osc.frequency.linearRampToValueAtTime(baseFreq - 200 + Math.random() * 400, now + offset + 0.06)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now + offset)
      gain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.06, now + offset + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06)

      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start(now + offset)
      osc.stop(now + offset + 0.06)
    }
  }

  private startBirdAmbient(): void {
    if (this.birdInterval) return
    // Random chirps every 2-6 seconds
    const chirp = () => {
      this.playBirdChirp()
      const next = 2000 + Math.random() * 4000
      this.birdInterval = setTimeout(chirp, next) as unknown as ReturnType<typeof setInterval>
    }
    chirp()
  }

  private stopBirdAmbient(): void {
    if (this.birdInterval) {
      clearTimeout(this.birdInterval as unknown as number)
      this.birdInterval = null
    }
  }

  private startCricketAmbient(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.cricketSource) return
    const ctx = this.ctx

    // High-frequency filtered noise with amplitude modulation for chirping effect
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 4500
    bp.Q.value = 8

    const gain = ctx.createGain()
    gain.gain.value = 0.06

    // LFO for chirp pattern
    const lfo = ctx.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = 12 // chirp rate
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.04
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)

    source.connect(bp)
    bp.connect(gain)
    gain.connect(this.masterGain)
    lfo.start()
    source.start()

    this.cricketSource = source
    this.cricketGain = gain
  }

  private stopCricketAmbient(): void {
    if (this.cricketSource) {
      try { this.cricketSource.stop() } catch { /* */ }
      this.cricketSource.disconnect()
      this.cricketSource = null
    }
    if (this.cricketGain) {
      this.cricketGain.disconnect()
      this.cricketGain = null
    }
  }

  /**
   * Update ambient sound layers based on time of day.
   * Call periodically (e.g., every few seconds or on time change).
   */
  setAmbientForTime(timeOfDay: number): void {
    if (!this.initialized) return
    const isDay = timeOfDay >= SUNRISE_HOUR && timeOfDay < SUNSET_HOUR
    const target = isDay ? 'day' : 'night'
    if (target === this.currentAmbient) return

    if (target === 'day') {
      this.stopCricketAmbient()
      this.startBirdAmbient()
    } else {
      this.stopBirdAmbient()
      this.startCricketAmbient()
    }
    this.currentAmbient = target
  }

  // ── Master Volume ───────────────────────────────────────

  setMasterVolume(volume: number): void {
    if (!this.masterGain) return
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume))
  }

  // ── Event Processing ────────────────────────────────────

  private isChewingBehavior(behavior: CowBehavior): boolean {
    return behavior === 'eating' || behavior === 'grazing'
  }

  /**
   * Process engine events and trigger the appropriate sounds.
   * Called once per frame with the latest batch of events.
   */
  processEvents(events: EngineEvent[]): void {
    if (!this.initialized) return

    for (const event of events) {
      switch (event.type) {
        case 'behavior_changed': {
          const wasChewing = this.isChewingBehavior(event.from)
          const nowChewing = this.isChewingBehavior(event.to)

          if (nowChewing && !wasChewing) {
            this.startChewing()
          } else if (!nowChewing && wasChewing) {
            this.stopChewing()
          }

          // Footstep scheduling
          if (event.to === 'walking' || event.to === 'running') {
            this.startFootsteps(event.to)
          } else if (event.from === 'walking' || event.from === 'running') {
            this.stopFootsteps()
          }
          break
        }

        case 'pet_received':
          this.playMoo()
          break

        case 'food_placed':
          this.playPlaceFood()
          break

        case 'food_consumed':
          this.playFoodGone()
          break

        case 'play_started':
          this.playPlayful()
          break

        case 'cow_jumped':
          this.playJump()
          break

        case 'cow_called':
          this.playCowCall()
          break

        case 'need_critical':
          this.playWarning()
          break

        case 'cow_settled':
          this.playSettle()
          break

        case 'cow_milked':
          this.playMilk()
          break

        case 'arrived_at_target':
        case 'cow_went_home':
        case 'activity_changed':
        case 'cow_drinking':
        case 'cow_grazing_patch':
          // No sound needed — would be too frequent or annoying
          break
      }
    }
  }
}

export const audioEngine = new AudioEngine()
