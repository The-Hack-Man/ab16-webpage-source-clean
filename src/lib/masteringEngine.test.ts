import { describe, expect, it, vi } from 'vitest';
import { audioBufferToWav, createAudioPreview, getSourceSampleRate } from './masteringEngine';

describe('audio preview', () => {
  it('keeps only the requested leading section of a track', () => {
    const firstChannel = Float32Array.from({ length: 600 }, (_, index) => index);
    const secondChannel = Float32Array.from({ length: 600 }, (_, index) => -index);
    const copyToChannel = vi.fn();
    const previewBuffer = {
      copyToChannel,
    } as unknown as AudioBuffer;
    const context = {
      createBuffer: vi.fn(() => previewBuffer),
    } as unknown as BaseAudioContext;
    const source = {
      duration: 60,
      sampleRate: 10,
      numberOfChannels: 2,
      getChannelData: vi.fn((channel: number) => [firstChannel, secondChannel][channel]),
    } as unknown as AudioBuffer;

    const result = createAudioPreview(source, context, 30);

    expect(context.createBuffer).toHaveBeenCalledWith(2, 300, 10);
    expect(copyToChannel).toHaveBeenNthCalledWith(1, firstChannel.subarray(0, 300), 0);
    expect(copyToChannel).toHaveBeenNthCalledWith(2, secondChannel.subarray(0, 300), 1);
    expect(result).toBe(previewBuffer);
  });

  it('does not extend a track shorter than the preview limit', () => {
    const shortAudio = Float32Array.from([0.25, -0.25]);
    const copyToChannel = vi.fn();
    const context = {
      createBuffer: vi.fn(() => ({ copyToChannel }) as unknown as AudioBuffer),
    } as unknown as BaseAudioContext;
    const source = {
      duration: 1,
      sampleRate: 2,
      numberOfChannels: 1,
      getChannelData: vi.fn(() => shortAudio),
    } as unknown as AudioBuffer;

    createAudioPreview(source, context, 30);

    expect(context.createBuffer).toHaveBeenCalledWith(1, 2, 2);
    expect(copyToChannel).toHaveBeenCalledWith(shortAudio, 0);
  });
});

describe('WAV export', () => {
  it('writes a valid PCM WAV header and preserves the requested duration', async () => {
    const samples = Float32Array.from([0, 0.5, -0.5, 1]);
    const audio = {
      duration: 2,
      sampleRate: 2,
      numberOfChannels: 1,
      getChannelData: vi.fn(() => samples),
    } as unknown as AudioBuffer;

    const blob = audioBufferToWav(audio, 1);
    const bytes = new DataView(await blob.arrayBuffer());

    expect(blob.type).toBe('audio/wav');
    expect(bytes.getUint32(4, true)).toBe(36 + 4);
    expect(bytes.getUint16(22, true)).toBe(1);
    expect(bytes.getUint32(24, true)).toBe(2);
    expect(bytes.getUint32(40, true)).toBe(4);
  });

  describe('uploaded source sample rate', () => {
    it('uses the 44.1 kHz WAV header when the decoded buffer is resampled to 48 kHz', async () => {
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);
      const writeTag = (offset: number, value: string) => {
        for (let index = 0; index < value.length; index++) {
          view.setUint8(offset + index, value.charCodeAt(index));
        }
      };
      writeTag(0, 'RIFF');
      view.setUint32(4, 36, true);
      writeTag(8, 'WAVE');
      writeTag(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 2, true);
      view.setUint32(24, 44100, true);
      writeTag(36, 'data');
      view.setUint32(40, 0, true);
      const uploadedWav = new Blob([wavHeader], { type: 'audio/wav' });
      const decodedBuffer = { sampleRate: 48000 } as AudioBuffer;

      await expect(getSourceSampleRate(uploadedWav, decodedBuffer.sampleRate)).resolves.toBe(44100);
    });
  });
});
