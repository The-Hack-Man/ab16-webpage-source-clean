/**
 * Web Audio API Mastering Engine
 * Real in-browser DSP processing chain:
 * Input -> Pre-Gain -> EQ (7-band) -> De-Esser -> Compressor ->
 * Saturation (waveshaper) -> Stereo Width -> Limiter -> Output
 */

export interface EQBandSettings {
  freq: number;
  gain: number;
  q: number;
  type: BiquadFilterType;
  enabled: boolean;
}

export interface MasteringSettings {
  eq: {
    enabled: boolean;
    bands: EQBandSettings[];
  };
  deEsser: {
    enabled: boolean;
    freq: number;
    amount: number;
  };
  compressor: {
    enabled: boolean;
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
    makeup: number;
  };
  saturation: {
    enabled: boolean;
    drive: number;
    mix: number;
  };
  stereoWidth: {
    enabled: boolean;
    width: number;
  };
  limiter: {
    enabled: boolean;
    ceiling: number;
    release: number;
  };
  targetLufs: number;
  outputGain: number;
}

export const DEFAULT_EQ_BANDS: EQBandSettings[] = [
  { freq: 60, gain: 0, q: 0.7, type: 'lowshelf', enabled: false },
  { freq: 150, gain: 0, q: 0.8, type: 'peaking', enabled: false },
  { freq: 400, gain: 0, q: 0.9, type: 'peaking', enabled: false },
  { freq: 1000, gain: 0, q: 1.0, type: 'peaking', enabled: false },
  { freq: 3000, gain: 0, q: 1.0, type: 'peaking', enabled: false },
  { freq: 8000, gain: 0, q: 0.8, type: 'peaking', enabled: false },
  { freq: 14000, gain: 0, q: 0.7, type: 'highshelf', enabled: false },
];

export const DEFAULT_SETTINGS: MasteringSettings = {
  eq: { enabled: true, bands: DEFAULT_EQ_BANDS },
  deEsser: { enabled: false, freq: 6500, amount: 3 },
  compressor: { enabled: true, threshold: -18, ratio: 2, attack: 30, release: 150, makeup: 0 },
  saturation: { enabled: false, drive: 1, mix: 0.15 },
  stereoWidth: { enabled: true, width: 100 },
  limiter: { enabled: true, ceiling: -1.0, release: 50 },
  targetLufs: -14,
  outputGain: 0,
};

export interface PresetConfig {
  id: string;
  name: string;
  desc: string;
  lufs: number;
  settings: Partial<MasteringSettings>;
}

export const PRESETS: PresetConfig[] = [
  {
    id: 'transparent',
    name: 'Transparent',
    desc: 'Minimal processing, preserves original character',
    lufs: -16,
    settings: {
      eq: { enabled: true, bands: DEFAULT_EQ_BANDS.map(b => ({ ...b, gain: b.gain * 0.3, enabled: false })) },
      compressor: { enabled: true, threshold: -24, ratio: 1.5, attack: 50, release: 200, makeup: 0 },
      saturation: { enabled: false, drive: 0, mix: 0 },
      stereoWidth: { enabled: true, width: 100 },
      limiter: { enabled: true, ceiling: -1.0, release: 80 },
      targetLufs: -16,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    desc: 'Adaptive EQ, gentle compression, clean limiting',
    lufs: -14,
    settings: {
      eq: {
        enabled: true,
        bands: DEFAULT_EQ_BANDS.map((b, i) => ({
          ...b,
          gain: i === 0 ? 1.5 : i === 4 ? 0.8 : i === 6 ? 1.0 : 0,
          enabled: i === 0 || i === 4 || i === 6,
        })),
      },
      compressor: { enabled: true, threshold: -18, ratio: 2, attack: 30, release: 150, makeup: 1 },
      saturation: { enabled: true, drive: 1, mix: 0.1 },
      stereoWidth: { enabled: true, width: 105 },
      limiter: { enabled: true, ceiling: -1.0, release: 50 },
      targetLufs: -14,
    },
  },
  {
    id: 'loud',
    name: 'Loud',
    desc: 'Aggressive loudness for streaming platforms',
    lufs: -10,
    settings: {
      eq: {
        enabled: true,
        bands: DEFAULT_EQ_BANDS.map((b, i) => ({
          ...b,
          gain: i === 0 ? 2 : i === 4 ? 1.2 : i === 6 ? 1.5 : i === 2 ? -0.5 : 0,
          enabled: true,
        })),
      },
      compressor: { enabled: true, threshold: -14, ratio: 3, attack: 15, release: 100, makeup: 2 },
      saturation: { enabled: true, drive: 2, mix: 0.2 },
      stereoWidth: { enabled: true, width: 110 },
      limiter: { enabled: true, ceiling: -1.0, release: 30 },
      targetLufs: -10,
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    desc: 'Analog-style warmth with tape saturation',
    lufs: -13,
    settings: {
      eq: {
        enabled: true,
        bands: DEFAULT_EQ_BANDS.map((b, i) => ({
          ...b,
          gain: i === 0 ? 2.5 : i === 1 ? 1.5 : i === 6 ? -0.5 : 0,
          enabled: i === 0 || i === 1 || i === 6,
        })),
      },
      compressor: { enabled: true, threshold: -20, ratio: 2.5, attack: 40, release: 180, makeup: 1.5 },
      saturation: { enabled: true, drive: 3, mix: 0.3 },
      stereoWidth: { enabled: true, width: 95 },
      limiter: { enabled: true, ceiling: -1.0, release: 60 },
      targetLufs: -13,
    },
  },
  {
    id: 'punchy',
    name: 'Punchy',
    desc: 'Tight low end, present mids, punchy transients',
    lufs: -12,
    settings: {
      eq: {
        enabled: true,
        bands: DEFAULT_EQ_BANDS.map((b, i) => ({
          ...b,
          gain: i === 0 ? 1.5 : i === 3 ? 1.0 : i === 4 ? 1.5 : i === 5 ? 0.8 : 0,
          enabled: i === 0 || i === 3 || i === 4 || i === 5,
        })),
      },
      compressor: { enabled: true, threshold: -16, ratio: 2.5, attack: 10, release: 80, makeup: 1.5 },
      saturation: { enabled: true, drive: 1.5, mix: 0.15 },
      stereoWidth: { enabled: true, width: 108 },
      limiter: { enabled: true, ceiling: -1.0, release: 25 },
      targetLufs: -12,
    },
  },
];

export interface PresetPackage {
  id: string;
  name: string;
  desc: string;
  lufs: number;
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Creates a tanh-based waveshaper curve for saturation.
 */
function makeDistortionCurve(drive: number): Float32Array {
  const n = 4096;
  const curve = new Float32Array(n);
  const k = drive * 50;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/**
 * The main mastering engine class.
 * Connects Web Audio nodes into a processing chain.
 */
export class MasteringEngine {
  private ctx: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;

  // Chain nodes
  private inputGain: GainNode;
  private eqNodes: BiquadFilterNode[] = [];
  private deEsserFilter: BiquadFilterNode;
  private compressor: DynamicsCompressorNode;
  private satShaper: WaveShaperNode;
  private satDryGain: GainNode;
  private satWetGain: GainNode;
  private stereoSplitter: ChannelSplitterNode;
  private stereoMerger: ChannelMergerNode;
  private widthGains: GainNode[] = [];
  private limiter: DynamicsCompressorNode;
  private outputGain: GainNode;
  private analyser: AnalyserNode;

  private onEnded: (() => void) | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1;

    // EQ chain
    for (let i = 0; i < 7; i++) {
      const band = ctx.createBiquadFilter();
      band.type = DEFAULT_EQ_BANDS[i].type;
      band.frequency.value = DEFAULT_EQ_BANDS[i].freq;
      band.gain.value = 0;
      band.Q.value = DEFAULT_EQ_BANDS[i].q;
      this.eqNodes.push(band);
    }

    // A narrow, adjustable reduction avoids filtering the entire signal to the sibilance band.
    this.deEsserFilter = ctx.createBiquadFilter();
    this.deEsserFilter.type = 'peaking';
    this.deEsserFilter.frequency.value = 6500;
    this.deEsserFilter.Q.value = 2;

    // Main compressor
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 2;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.15;
    this.compressor.knee.value = 6;

    // Saturation (waveshaper with dry/wet)
    this.satShaper = ctx.createWaveShaper();
    this.satShaper.curve = makeDistortionCurve(1);
    this.satShaper.oversample = '4x';
    this.satDryGain = ctx.createGain();
    this.satDryGain.gain.value = 0.85;
    this.satWetGain = ctx.createGain();
    this.satWetGain.gain.value = 0.15;

    // Stereo width via Mid/Side
    this.inputGain.channelCount = 2;
    this.inputGain.channelCountMode = 'explicit';
    this.inputGain.channelInterpretation = 'speakers';
    this.stereoSplitter = ctx.createChannelSplitter(2);
    this.stereoMerger = ctx.createChannelMerger(2);
    for (const gain of [0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5]) {
      const node = ctx.createGain();
      node.gain.value = gain;
      this.widthGains.push(node);
    }

    // Limiter (fast compressor)
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;
    this.limiter.knee.value = 0;

    // Output
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;

    // Analyser for visualization
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.connectChain();
  }

  private connectChain(): void {
    // EQ series
    this.inputGain.connect(this.eqNodes[0]);
    for (let i = 0; i < this.eqNodes.length - 1; i++) {
      this.eqNodes[i].connect(this.eqNodes[i + 1]);
    }

    // EQ -> sibilance reduction -> Compressor
    this.eqNodes[this.eqNodes.length - 1].connect(this.deEsserFilter);
    this.deEsserFilter.connect(this.compressor);

    // Compressor -> Saturation (parallel dry/wet)
    this.compressor.connect(this.satDryGain);
    this.compressor.connect(this.satShaper);
    this.satShaper.connect(this.satWetGain);
    this.satDryGain.connect(this.stereoSplitter);
    this.satWetGain.connect(this.stereoSplitter);

    // Encode mid/side, scale the side, then decode back to left/right.
    this.stereoSplitter.connect(this.widthGains[0], 0);
    this.stereoSplitter.connect(this.widthGains[1], 1);
    this.stereoSplitter.connect(this.widthGains[2], 0);
    this.stereoSplitter.connect(this.widthGains[3], 1);
    this.stereoSplitter.connect(this.widthGains[4], 0);
    this.stereoSplitter.connect(this.widthGains[5], 1);
    this.stereoSplitter.connect(this.widthGains[6], 0);
    this.stereoSplitter.connect(this.widthGains[7], 1);
    this.widthGains[0].connect(this.stereoMerger, 0, 0);
    this.widthGains[1].connect(this.stereoMerger, 0, 0);
    this.widthGains[2].connect(this.stereoMerger, 0, 1);
    this.widthGains[3].connect(this.stereoMerger, 0, 1);
    this.widthGains[4].connect(this.stereoMerger, 0, 0);
    this.widthGains[5].connect(this.stereoMerger, 0, 0);
    this.widthGains[6].connect(this.stereoMerger, 0, 1);
    this.widthGains[7].connect(this.stereoMerger, 0, 1);

    // Stereo -> Limiter
    this.stereoMerger.connect(this.limiter);

    // Limiter -> Output -> Analyser -> Destination
    this.limiter.connect(this.outputGain);
    this.outputGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  setBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
  }

  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  applySettings(settings: MasteringSettings): void {
    const now = this.ctx.currentTime;

    // EQ
    settings.eq.bands.forEach((band, i) => {
      if (i >= this.eqNodes.length) return;
      const node = this.eqNodes[i];
      node.frequency.setValueAtTime(band.freq, now);
      node.gain.setValueAtTime(settings.eq.enabled && band.enabled ? band.gain : 0, now);
      node.Q.setValueAtTime(band.q, now);
    });

    // De-esser
    this.deEsserFilter.frequency.setValueAtTime(settings.deEsser.freq, now);
    this.deEsserFilter.gain.setValueAtTime(settings.deEsser.enabled ? -settings.deEsser.amount : 0, now);

    // Compressor
    this.compressor.threshold.setValueAtTime(settings.compressor.threshold, now);
    this.compressor.ratio.setValueAtTime(settings.compressor.enabled ? settings.compressor.ratio : 1, now);
    this.compressor.attack.setValueAtTime(settings.compressor.attack / 1000, now);
    this.compressor.release.setValueAtTime(settings.compressor.release / 1000, now);
    // Makeup gain via output gain adjustment
    const makeupBoost = settings.compressor.enabled ? dbToGain(settings.compressor.makeup) : 1;

    // Saturation
    if (settings.saturation.enabled) {
      this.satShaper.curve = makeDistortionCurve(settings.saturation.drive);
      this.satDryGain.gain.setValueAtTime(1 - settings.saturation.mix, now);
      this.satWetGain.gain.setValueAtTime(settings.saturation.mix, now);
    } else {
      this.satDryGain.gain.setValueAtTime(1, now);
      this.satWetGain.gain.setValueAtTime(0, now);
    }

    // Stereo width
    const widthFactor = settings.stereoWidth.enabled ? settings.stereoWidth.width / 100 : 1;
    this.widthGains.slice(4).forEach((node) => {
      const sign = node.gain.value < 0 ? -1 : 1;
      node.gain.setValueAtTime(sign * 0.5 * widthFactor, now);
    });

    // Limiter
    this.limiter.threshold.setValueAtTime(settings.limiter.ceiling, now);
    this.limiter.ratio.setValueAtTime(settings.limiter.enabled ? 20 : 1, now);
    this.limiter.release.setValueAtTime(settings.limiter.release / 1000, now);

    // Output gain (includes compressor makeup)
    this.outputGain.gain.setValueAtTime(makeupBoost * dbToGain(settings.outputGain), now);
  }

  play(onEnded?: () => void): void {
    if (!this.buffer) return;
    this.stop();
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.inputGain);
    this.source.onended = () => {
      if (this.onEnded) this.onEnded();
    };
    this.onEnded = onEnded ?? null;
    this.source.start(0);
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
        this.source.disconnect();
      } catch { /* already stopped */ }
      this.source = null;
    }
  }

  seek(time: number): void {
    if (!this.buffer) return;
    const wasPlaying = this.source !== null;
    this.stop();
    if (wasPlaying) {
      this.source = this.ctx.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.connect(this.inputGain);
      this.source.onended = () => { if (this.onEnded) this.onEnded(); };
      this.source.start(0, Math.min(time, this.buffer.duration));
    }
  }

  getDuration(): number {
    return this.buffer?.duration ?? 0;
  }

  /**
   * Render the processed audio to an offline buffer and return a WAV blob.
   * Only processes up to maxDuration seconds (for demo limitation).
   */
  async renderToWav(maxDuration?: number): Promise<Blob> {
    if (!this.buffer) throw new Error('No audio buffer loaded');

    const duration = maxDuration ? Math.min(maxDuration, this.buffer.duration) : this.buffer.duration;
    const sampleRate = this.buffer.sampleRate;
    const channels = Math.min(2, this.buffer.numberOfChannels);

    const offlineCtx = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);

    // Recreate the full chain in the offline context
    const engine = new MasteringEngine(offlineCtx as unknown as AudioContext);
    engine.setBuffer(this.buffer);

    // Copy current settings — we need to re-apply since it's a new context
    // The settings are applied via applySettings, called by the caller

    const src = offlineCtx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(engine['inputGain']);

    engine.applySettings(this.getCurrentSettings());

    src.start(0);
    const rendered = await offlineCtx.startRendering();

    return audioBufferToWav(rendered, maxDuration);
  }

  private getCurrentSettings(): MasteringSettings {
    return DEFAULT_SETTINGS;
  }

  dispose(): void {
    this.stop();
    this.eqNodes.forEach(n => n.disconnect());
    this.deEsserFilter.disconnect();
    this.compressor.disconnect();
    this.satShaper.disconnect();
    this.satDryGain.disconnect();
    this.satWetGain.disconnect();
    this.stereoSplitter.disconnect();
    this.stereoMerger.disconnect();
    this.widthGains.forEach(n => n.disconnect());
    this.limiter.disconnect();
    this.outputGain.disconnect();
    this.analyser.disconnect();
  }
}

/**
 * Encode an AudioBuffer to a 16-bit PCM WAV Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer, maxDuration?: number): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const duration = maxDuration ? Math.min(maxDuration, buffer.duration) : buffer.duration;
  const numSamples = Math.ceil(duration * sampleRate);

  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * numChannels * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp and convert to 16-bit
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Decode an audio File into an AudioBuffer, truncated to maxDuration if specified.
 */
export async function decodeAudioFile(
  file: File,
  ctx: AudioContext,
  maxDuration?: number,
): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const fullBuffer = await ctx.decodeAudioData(arrayBuffer);

  if (maxDuration && fullBuffer.duration > maxDuration) {
    // Truncate to maxDuration
    const sampleRate = fullBuffer.sampleRate;
    const numChannels = fullBuffer.numberOfChannels;
    const truncatedSamples = Math.ceil(maxDuration * sampleRate);
    const truncated = ctx.createBuffer(numChannels, truncatedSamples, sampleRate);
    for (let c = 0; c < numChannels; c++) {
      const sourceData = fullBuffer.getChannelData(c);
      truncated.copyToChannel(sourceData.slice(0, truncatedSamples), c);
    }
    return truncated;
  }

  return fullBuffer;
}

/**
 * Read the source sample rate from a WAV container header.
 * AudioContext.decodeAudioData may resample the decoded buffer to its output rate.
 */
export async function getSourceSampleRate(file: Blob, decodedSampleRate: number): Promise<number> {
  if (file.size < 12) return decodedSampleRate;

  const header = new DataView(await file.slice(0, 12).arrayBuffer());
  const readTag = (view: DataView, offset: number) =>
    String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
  const container = readTag(header, 0);
  const isBigEndian = container === 'RIFX';
  if ((!isBigEndian && container !== 'RIFF') || readTag(header, 8) !== 'WAVE') {
    return decodedSampleRate;
  }

  let offset = 12;
  while (offset + 8 <= file.size) {
    const chunkHeaderBytes = await file.slice(offset, offset + 8).arrayBuffer();
    if (chunkHeaderBytes.byteLength < 8) return decodedSampleRate;
    const chunkHeader = new DataView(chunkHeaderBytes);
    const chunkTag = readTag(chunkHeader, 0);
    const chunkSize = chunkHeader.getUint32(4, !isBigEndian);
    const chunkStart = offset + 8;

    if (chunkTag === 'fmt ' && chunkSize >= 8 && chunkStart + 8 <= file.size) {
      const formatBytes = await file.slice(chunkStart, chunkStart + 8).arrayBuffer();
      if (formatBytes.byteLength < 8) return decodedSampleRate;
      const sampleRate = new DataView(formatBytes).getUint32(4, !isBigEndian);
      return sampleRate > 0 ? sampleRate : decodedSampleRate;
    }

    if (chunkSize === 0xffffffff) return decodedSampleRate;
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  return decodedSampleRate;
}

export function createAudioPreview(
  buffer: AudioBuffer,
  ctx: BaseAudioContext,
  maxDuration: number,
): AudioBuffer {
  const duration = Math.min(buffer.duration, maxDuration);
  const frameCount = Math.ceil(duration * buffer.sampleRate);
  const preview = ctx.createBuffer(buffer.numberOfChannels, frameCount, buffer.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    preview.copyToChannel(buffer.getChannelData(channel).subarray(0, frameCount), channel);
  }

  return preview;
}

/**
 * Approximate LUFS-integrated measurement from an AudioBuffer.
 * This is a simplified K-weighted loudness approximation — not a certified
 * LUFS measurement. Browser Web Audio API does not provide true ITU-R BS.1770
 * loudness. Values are indicative for A/B comparison, not for delivery specs.
 */
export function measureLUFS(buffer: AudioBuffer): number {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const length = buffer.length;

  // K-weighting filter (simplified: high-shelf + high-pass)
  // Stage 1: high-shelf filter at ~1.5kHz +4dB
  // Stage 2: high-pass at ~38Hz
  // For simplicity we use RMS-based approximation with K-weighting correction

  let sumSquares = 0;
  let numSamples = 0;

  for (let c = 0; c < numChannels; c++) {
    const data = buffer.getChannelData(c);
    // Apply simple K-weighting: emphasize frequencies above 1kHz
    let prevSample = 0;
    for (let i = 0; i < length; i++) {
      // Simple high-pass for sub-bass removal
      const hp = data[i] - 0.95 * prevSample;
      prevSample = data[i];
      // Approximate K-weighted value
      const weighted = hp * 1.3;
      sumSquares += weighted * weighted;
      numSamples++;
    }
  }

  // Channel weighting: L and R get 1.0, center gets 1.41
  const channelWeight = numChannels === 1 ? 1.0 : 1.0;
  const meanSquare = (sumSquares / numSamples) * channelWeight;
  if (meanSquare <= 0) return -Infinity;
  const lufs = 10 * Math.log10(meanSquare) - 0.691;

  return lufs;
}

/**
 * Approximate true peak — sample peak with intersample peak approximation.
 * Not a certified true-peak measurement (no 4x oversampling per ITU-R BS.1770).
 */
export function measureTruePeak(buffer: AudioBuffer): number {
  let peak = 0;
  const numChannels = Math.min(2, buffer.numberOfChannels);
  for (let c = 0; c < numChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  // Convert to dB, add 0.5 dB for intersample peak approximation
  if (peak <= 0) return -Infinity;
  return 20 * Math.log10(peak) + 0.5;
}

/**
 * Measure RMS level.
 */
export function measureRMS(buffer: AudioBuffer): number {
  let sumSquares = 0;
  let count = 0;
  const numChannels = Math.min(2, buffer.numberOfChannels);
  for (let c = 0; c < numChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      sumSquares += data[i] * data[i];
      count++;
    }
  }
  const rms = Math.sqrt(sumSquares / count);
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

/**
 * Measure crest factor (peak - RMS in dB).
 */
export function measureDynamicRange(buffer: AudioBuffer): number {
  const rms = measureRMS(buffer);
  let peak = 0;
  const numChannels = Math.min(2, buffer.numberOfChannels);
  for (let c = 0; c < numChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > peak) peak = Math.abs(data[i]);
    }
  }
  if (peak <= 0) return 0;
  const peakDb = 20 * Math.log10(peak);
  if (!isFinite(rms)) return 0;
  return peakDb - rms;
}

export interface AudioAnalysis {
  lufs: number;
  truePeak: number;
  rms: number;
  dynamicRange: number;
  duration: number;
  sampleRate: number;
  channels: number;
  clippingDetected: boolean;
}

export function analyzeAudio(buffer: AudioBuffer): AudioAnalysis {
  const truePeak = measureTruePeak(buffer);
  return {
    lufs: measureLUFS(buffer),
    truePeak,
    rms: measureRMS(buffer),
    dynamicRange: measureDynamicRange(buffer),
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    clippingDetected: truePeak > 0,
  };
}

// Proper import — lamejs exports Mp3Encoder directly in ESM/Vite context
import { Mp3Encoder as LameMp3Encoder } from 'lamejs';

/**
 * Encode an AudioBuffer to an MP3 Blob using lamejs.
 * Default bitrate: 320 kbps for high quality.
 */
export function audioBufferToMp3(buffer: AudioBuffer, maxDuration?: number, bitrate = 320): Blob {
  if (!LameMp3Encoder) {
    throw new Error('MP3 encoder not available');
  }

  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const duration = maxDuration ? Math.min(maxDuration, buffer.duration) : buffer.duration;
  const numSamples = Math.ceil(duration * sampleRate);

  const encoder = new LameMp3Encoder(numChannels, sampleRate, bitrate);
  const blockSize = 1152;
  const mp3Data: Int8Array[] = [];

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c).slice(0, numSamples));
  }

  for (let i = 0; i < numSamples; i += blockSize) {
    const left = new Int16Array(blockSize);
    const right = numChannels > 1 ? new Int16Array(blockSize) : null;

    for (let j = 0; j < blockSize && i + j < numSamples; j++) {
      // Convert float32 to int16
      left[j] = Math.max(-32768, Math.min(32767, channels[0][i + j] * 0x7fff));
      if (right && numChannels > 1) {
        right[j] = Math.max(-32768, Math.min(32767, channels[1][i + j] * 0x7fff));
      }
    }

    let mp3buf: Int8Array;
    if (numChannels === 2) {
      mp3buf = encoder.encodeBuffer(left, right ?? left);
    } else {
      mp3buf = encoder.encodeBuffer(left);
    }
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }

  const flush = encoder.flush();
  if (flush.length > 0) mp3Data.push(flush);

  // Combine all chunks
  const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([result], { type: 'audio/mp3' });
}

export type ExportFormat = 'wav' | 'mp3';

export function renderAudio(
  buffer: AudioBuffer,
  settings: MasteringSettings,
  format: ExportFormat,
  maxDuration?: number,
  mp3Bitrate = 320,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const duration = maxDuration ? Math.min(maxDuration, buffer.duration) : buffer.duration;
    const sampleRate = buffer.sampleRate;
    const channels = Math.min(2, buffer.numberOfChannels);

    const offlineCtx = new OfflineAudioContext(
      channels,
      Math.ceil(duration * sampleRate),
      sampleRate,
    );

    const offlineEngine = new MasteringEngine(offlineCtx as unknown as AudioContext);
    offlineEngine.applySettings(settings);

    const src = offlineCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(offlineEngine['inputGain']);
    src.start(0);
    offlineCtx.startRendering().then((rendered) => {
      try {
        if (format === 'mp3') {
          resolve(audioBufferToMp3(rendered, maxDuration, mp3Bitrate));
        } else {
          resolve(audioBufferToWav(rendered, maxDuration));
        }
      } catch (e) {
        reject(e);
      }
    }).catch(reject);
  });
}
