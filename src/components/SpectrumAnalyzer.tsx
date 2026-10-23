import { useEffect, useRef } from 'react';

interface SpectrumAnalyzerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  theme?: 'studio' | 'master';
}

export default function SpectrumAnalyzer({ analyser, isPlaying, theme = 'studio' }: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      const isMasterTheme = theme === 'master';
      ctx.fillStyle = isMasterTheme ? '#f8f5ee' : '#0a0b0f';
      ctx.fillRect(0, 0, width, height);

      if (!analyser) {
        // Draw idle state
        ctx.strokeStyle = isMasterTheme ? '#d6cfc2' : '#252836';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Draw frequency bars
      const barCount = 64;
      const barWidth = width / barCount;
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, isMasterTheme ? '#b94f38' : '#3b82f6');
      gradient.addColorStop(0.5, isMasterTheme ? '#5e7558' : '#22c55e');
      gradient.addColorStop(1, isMasterTheme ? '#996323' : '#f59e0b');

      ctx.fillStyle = gradient;

      for (let i = 0; i < barCount; i++) {
        // Logarithmic scale for frequency bins
        const dataIndex = Math.floor(Math.pow(i / barCount, 2) * bufferLength);
        const value = dataArray[dataIndex] || 0;
        const barHeight = (value / 255) * height * 0.85;

        const x = i * barWidth;
        const y = height - barHeight;
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      }

      // Draw frequency labels
      ctx.fillStyle = isMasterTheme ? '#716d63' : '#7a7f94';
      ctx.font = '9px JetBrains Mono, monospace';
      const freqs = [60, 250, 1000, 4000, 8000, 16000];
      const labels = ['60', '250', '1k', '4k', '8k', '16k'];
      freqs.forEach((freq, i) => {
        const pos = Math.pow(freq / 20000, 0.5) * width;
        ctx.fillText(labels[i], pos - 8, height - 2);
      });
    };

    draw();

    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isPlaying, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={140}
      className="w-full h-[140px] rounded-lg bg-studio-bg border border-studio-border"
    />
  );
}
