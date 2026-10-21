import { useEffect, useState, useRef, useCallback } from 'react';
import {
  UploadCloud, Loader2, Download, Play, Pause,
  Disc3, Save, FileAudio,
  Power, SkipBack, Circle, AlertTriangle,
} from 'lucide-react';
import {
  MasteringEngine, DEFAULT_SETTINGS, PRESETS, decodeAudioFile, analyzeAudio,
  renderAudio, type MasteringSettings, type AudioAnalysis, type PresetConfig,
  type ExportFormat,
} from '@/lib/masteringEngine';
import { cn, formatLUFS, formatDb, formatDuration } from '@/lib/utils';
import SpectrumAnalyzer from '@/components/SpectrumAnalyzer';
import { supabase } from '@/lib/supabase';
import type { MusicRelease } from '@/types';

const DEMO_DURATION = 30;
const EQ_LABELS = ['SUB', 'LOW', 'LO-MID', 'MID', 'PRES', 'HIGH', 'AIR'];

interface MasteringJob {
  id: string;
  release_id: string;
  track_title: string;
  preset: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paid';
  input_url?: string;
  output_url?: string;
  created_at: string;
  completed_at?: string;
}

export function AdminAIMastering() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<MasteringEngine | null>(null);
  const originalBufferRef = useRef<AudioBuffer | null>(null);
  const originalSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [jobs, setJobs] = useState<MasteringJob[]>([]);
  const [loading, setLoading] = useState(true);

  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'original' | 'mastered'>('mastered');
  const [currentTime, setCurrentTime] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);

  const [settings, setSettings] = useState<MasteringSettings>(DEFAULT_SETTINGS);
  const [activePreset, setActivePreset] = useState<string>('balanced');

  const [rendering, setRendering] = useState(false);
  const [renderFormat, setRenderFormat] = useState<ExportFormat>('wav');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>('master');
  const [mastering, setMastering] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const progressTimerRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      const { data: relData } = await supabase
        .from('music_releases')
        .select('*')
        .order('release_date', { ascending: false });
      setReleases(relData as MusicRelease[] ?? []);

      const { data: jobData } = await supabase
        .from('ai_mastering_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      setJobs((jobData ?? []) as MasteringJob[]);

      setLoading(false);
    })();
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadError(null);
    setLoading(true);
    setIsPlaying(false);
    setDownloadUrl(null);
    setHasUnsavedChanges(false);

    try {
      if (!file.type.startsWith('audio/')) throw new Error('Please upload an audio file (WAV, FLAC, or MP3).');
      if (file.size > 1073741824) throw new Error('File exceeds 1 GB limit.');

      const ctx = getAudioContext();
      const buffer = await decodeAudioFile(file, ctx, DEMO_DURATION);
      originalBufferRef.current = buffer;
      const baseName = file.name.replace(/\.[^.]+$/, '');
      setFileName(baseName);
      setDownloadName(`${baseName}_mastered`);
      setAnalysis(analyzeAudio(buffer));

      if (engineRef.current) engineRef.current.dispose();
      engineRef.current = new MasteringEngine(ctx);
      engineRef.current.setBuffer(buffer);
      setAnalyser(engineRef.current.getAnalyser());
      engineRef.current.applySettings(settings);
      setLoading(false);
    } catch (e) {
      setUploadError((e as Error).message);
      setLoading(false);
    }
  };

  const updateSettings = (newSettings: MasteringSettings) => {
    setSettings(newSettings);
    setHasUnsavedChanges(true);
    if (engineRef.current) engineRef.current.applySettings(newSettings);
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); setDownloadUrl(null); }
  };

  const applyPreset = (preset: PresetConfig) => {
    setActivePreset(preset.id);
    updateSettings({ ...DEFAULT_SETTINGS, ...preset.settings } as MasteringSettings);
  };

  const stopAllPlayback = () => {
    if (engineRef.current) engineRef.current.stop();
    if (originalSourceRef.current) { try { originalSourceRef.current.stop(); } catch { /* already stopped */ } originalSourceRef.current = null; }
  };

  const playOriginal = (ctx: AudioContext, play: boolean) => {
    if (originalSourceRef.current) { try { originalSourceRef.current.stop(); } catch { /* already stopped */ } originalSourceRef.current = null; }
    if (play && originalBufferRef.current) {
      originalSourceRef.current = ctx.createBufferSource();
      originalSourceRef.current.buffer = originalBufferRef.current;
      originalSourceRef.current.connect(ctx.destination);
      originalSourceRef.current.onended = () => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); };
      originalSourceRef.current.start(0);
    }
  };

  const handlePlay = () => {
    const ctx = getAudioContext();
    if (!engineRef.current || !originalBufferRef.current) return;
    if (isPlaying) { stopAllPlayback(); setIsPlaying(false); stopProgressTimer(); return; }
    if (playMode === 'mastered') {
      engineRef.current.play(() => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); });
    } else { playOriginal(ctx, true); }
    setIsPlaying(true);
    startProgressTimer();
  };

  const togglePlayMode = (mode: 'original' | 'mastered') => {
    const wasPlaying = isPlaying;
    stopAllPlayback();
    setIsPlaying(false);
    stopProgressTimer();
    setCurrentTime(0);
    setPlayMode(mode);
    if (wasPlaying) {
      const ctx = getAudioContext();
      if (mode === 'mastered') engineRef.current?.play(() => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); });
      else playOriginal(ctx, true);
      setIsPlaying(true);
      startProgressTimer();
    }
  };

  const handleRewind = () => {
    stopAllPlayback();
    setCurrentTime(0);
    if (isPlaying) {
      if (playMode === 'mastered') { engineRef.current?.seek(0); engineRef.current?.play(() => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); }); }
      else { const ctx = getAudioContext(); playOriginal(ctx, true); }
      startProgressTimer();
    }
  };

  const startProgressTimer = () => {
    stopProgressTimer();
    progressTimerRef.current = window.setInterval(() => {
      setCurrentTime(t => {
        const d = originalBufferRef.current?.duration ?? DEMO_DURATION;
        if (t >= d) { stopProgressTimer(); return 0; }
        return t + 0.1;
      });
    }, 100);
  };

  const stopProgressTimer = () => { if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = 0; } };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!originalBufferRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = ratio * duration;
    setCurrentTime(seekTime);
    if (isPlaying) {
      stopAllPlayback();
      if (playMode === 'mastered') {
        engineRef.current?.seek(seekTime);
        engineRef.current?.play(() => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); });
      } else {
        const ctx = getAudioContext();
        if (originalBufferRef.current) {
          if (originalSourceRef.current) { try { originalSourceRef.current.stop(); } catch { /* already stopped */ } }
          originalSourceRef.current = ctx.createBufferSource();
          originalSourceRef.current.buffer = originalBufferRef.current;
          originalSourceRef.current.connect(ctx.destination);
          originalSourceRef.current.onended = () => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); };
          originalSourceRef.current.start(0, seekTime);
        }
      }
      startProgressTimer();
    }
  };

  const handleRender = async (format: ExportFormat) => {
    if (!originalBufferRef.current) return;
    setRendering(true);
    setRenderFormat(format);
    try {
      const blob = await renderAudio(originalBufferRef.current, settings, format, DEMO_DURATION, 320);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(URL.createObjectURL(blob));
      setHasUnsavedChanges(false);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('MP3 encoder')) { alert('MP3 encoder loading. Falling back to WAV.'); handleRender('wav'); return; }
      alert(`Export failed: ${msg}`);
    } finally { setRendering(false); }
  };

  const handleSave = () => {
    if (!downloadUrl) { handleRender(renderFormat); return; }
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${downloadName}_master.${renderFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const startMastering = async () => {
    if (!selectedRelease || !originalBufferRef.current) return;
    setMastering(true);

    try {
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('releases')
        .upload(`stems/${crypto.randomUUID()}/${fileName || 'track'}.wav`, await renderAudio(originalBufferRef.current, settings, 'wav', DEMO_DURATION, 320));

      if (uploadErr) throw uploadErr;

      const { data: job, error: jobErr } = await supabase.from('ai_mastering_jobs').insert({
        release_id: selectedRelease,
        track_title: fileName || 'track',
        preset: activePreset,
        status: 'processing',
        input_url: uploadData?.path,
      }).select().single();

      if (jobErr || !job) throw jobErr;

      setJobs([job as MasteringJob, ...jobs]);
      setMastering(false);

      setTimeout(() => {
        supabase.from('ai_mastering_jobs')
          .update({ status: 'completed', output_url: uploadData?.path, completed_at: new Date().toISOString() })
          .eq('id', job.id);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: 'completed', output_url: uploadData?.path, completed_at: new Date().toISOString() }
              : j
          )
        );
      }, 3000);
    } catch (e) {
      alert(`Mastering error: ${(e as Error).message}`);
      setMastering(false);
    }
  };

  useEffect(() => {
    return () => { stopProgressTimer(); stopAllPlayback(); if (engineRef.current) engineRef.current.dispose(); if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
  }, [downloadUrl]);

  const hasAudio = originalBufferRef.current !== null;
  const duration = originalBufferRef.current?.duration ?? DEMO_DURATION;

  const updateEQBand = (index: number, key: 'freq' | 'gain' | 'enabled', value: number | boolean) => {
    const newBands = [...settings.eq.bands];
    newBands[index] = { ...newBands[index], [key]: value };
    updateSettings({ ...settings, eq: { ...settings.eq, bands: newBands } });
  };

  if (loading) {
    return <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="h-64 bg-studio-surface animate-pulse rounded" />)}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-studio-bg text-studio-text font-sans">
      <header className="border-b border-studio-border bg-gradient-to-r from-studio-surface via-studio-surface to-studio-bg px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-studio-accent to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Disc3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-studio-text tracking-tight leading-none">JAMIE G MASTERING SYSTEM</h1>
            <p className="text-[10px] text-studio-textMuted mt-0.5 tracking-wide uppercase">Admin Professional Audio Mastering Console</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {analysis && (
            <div className="hidden md:flex items-center gap-4 text-xs font-mono" title="Approximate browser measurements — not certified for delivery">
              <span className="text-studio-textMuted">LUFS~ <span className="text-studio-text font-bold">{formatLUFS(analysis.lufs)}</span></span>
              <span className="text-studio-textMuted">TP~ <span className="text-studio-text font-bold">{formatDb(analysis.truePeak)}</span></span>
              <span className="text-studio-textMuted">RMS~ <span className="text-studio-text font-bold">{formatDb(analysis.rms)}</span></span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-studio-warning/10 border border-studio-warning/20 rounded-md">
            <Circle className="w-2 h-2 fill-studio-warning text-studio-warning" />
            <span className="text-[10px] text-studio-warning font-bold uppercase tracking-wide">Admin Mode</span>
          </div>
        </div>
      </header>

      {/* Transport bar */}
      {hasAudio && (
        <div className="bg-studio-surface border-b border-studio-border px-6 py-3 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRewind}
              className="w-9 h-9 rounded-lg bg-studio-bg border border-studio-border text-studio-textMuted flex items-center justify-center hover:text-studio-text hover:border-studio-textMuted transition-colors"
              title="Rewind"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>
            <button
              onClick={handlePlay}
              className="w-11 h-11 rounded-lg bg-studio-accent text-white flex items-center justify-center hover:bg-blue-600 transition-colors shadow-md shadow-blue-900/20"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
          </div>

          <div className="flex-1 mx-2">
            <div
              className="h-2 bg-studio-bg rounded-sm overflow-hidden border border-studio-border/50 cursor-pointer relative group"
              onClick={handleSeek}
              title="Click to seek"
            >
              <div
                className="h-full bg-gradient-to-r from-studio-accent via-studio-accent to-studio-success transition-all duration-100 pointer-events-none"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              <div className="absolute inset-0 group-hover:bg-white/5 transition-colors pointer-events-none" />
            </div>
            <div className="flex justify-between mt-1 text-[10px] font-mono text-studio-textMuted">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="flex items-center bg-studio-bg rounded-md border border-studio-border p-0.5">
            <button
              onClick={() => togglePlayMode('original')}
              className={cn(
                'px-4 py-1.5 rounded text-[10px] font-bold tracking-widest transition-colors',
                playMode === 'original' ? 'bg-studio-textMuted text-studio-bg' : 'text-studio-textMuted hover:text-studio-text'
              )}
            >
              BEFORE
            </button>
            <button
              onClick={() => togglePlayMode('mastered')}
              className={cn(
                'px-4 py-1.5 rounded text-[10px] font-bold tracking-widest transition-colors',
                playMode === 'mastered' ? 'bg-studio-accent text-white' : 'text-studio-textMuted hover:text-studio-text'
              )}
            >
              AFTER
            </button>
          </div>

          <div className="hidden lg:block w-48">
            <SpectrumAnalyzer analyser={playMode === 'mastered' && isPlaying ? analyser : null} isPlaying={isPlaying} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1200px] mx-auto">
          {!hasAudio && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <DropZone               onDrop={(files) => {
                const fileObj = { 0: files[0], length: 1, item: (i: number) => files[i], [Symbol.iterator]: files[Symbol.iterator] } as unknown as FileList;
                void handleFileChange({ target: { files: fileObj } } as unknown as React.ChangeEvent<HTMLInputElement>);
              }} />
              {uploadError && (
                <div className="mt-4 text-sm text-studio-danger bg-studio-danger/10 border border-studio-danger/30 rounded-lg px-4 py-2 max-w-md">
                  {uploadError}
                </div>
              )}
              <div className="mt-6 grid grid-cols-3 gap-6 text-center max-w-lg">
                <FeatureBadge icon={Disc3} text="7-Band EQ" />
                <FeatureBadge icon={Power} text="De-Esser + Comp" />
                <FeatureBadge icon={FileAudio} text="WAV + MP3 Export" />
              </div>
            </div>
          )}

          {hasAudio && (
            <div className="space-y-4">
              {/* File info strip */}
              <div className="flex items-center gap-3 bg-studio-surface border border-studio-border rounded-lg px-4 py-2.5">
                <FileAudio className="w-4 h-4 text-studio-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-studio-text truncate">{fileName}</span>
                  <span className="text-xs text-studio-textMuted ml-3">
                    {analysis ? `${formatDuration(analysis.duration)} · ${analysis.sampleRate / 1000}kHz · ${analysis.channels === 2 ? 'Stereo' : 'Mono'}` : ''}
                  </span>
                </div>
                {analysis?.clippingDetected && (
                  <span className="flex items-center gap-1 text-[10px] text-studio-danger bg-studio-danger/10 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" /> CLIP
                  </span>
                )}
                <label className="text-xs text-studio-textMuted hover:text-studio-danger transition-colors cursor-pointer">
                  <input type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
                  Replace
                </label>
              </div>

              {/* Preset selector */}
              <div className="flex items-center gap-2 bg-studio-surface border border-studio-border rounded-lg px-4 py-3">
                <span className="text-[10px] font-bold text-studio-textMuted uppercase tracking-widest mr-2 shrink-0">Style</span>
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={cn(
                      'px-4 py-2 rounded text-sm font-semibold transition-all border',
                      activePreset === p.id
                        ? 'border-studio-accent bg-studio-accent/15 text-white'
                        : 'border-transparent text-studio-textMuted hover:text-studio-text hover:bg-studio-surfaceLight'
                    )}
                  >
                    {p.name}
                  </button>
                ))}
                <span className="ml-auto text-xs text-studio-textMuted hidden md:block">
                  {PRESETS.find(p => p.id === activePreset)?.desc}
                </span>
              </div>

              {/* Signal chain */}
              <div className="flex items-center gap-1 bg-studio-bg border border-studio-border rounded-lg px-4 py-2.5 overflow-x-auto">
                <span className="text-[10px] font-bold text-studio-textMuted uppercase tracking-widest mr-2 shrink-0">Chain</span>
                {[
                  { label: 'EQ', on: settings.eq.enabled },
                  { label: 'De-Ess', on: settings.deEsser.enabled },
                  { label: 'Comp', on: settings.compressor.enabled },
                  { label: 'Satur', on: settings.saturation.enabled },
                  { label: 'Stereo', on: settings.stereoWidth.enabled },
                  { label: 'Limit', on: settings.limiter.enabled },
                ].map((m, i) => (
                  <div key={i} className="flex items-center gap-1 shrink-0">
                    {i > 0 && <span className="text-studio-textMuted/30 mx-0.5">→</span>}
                    <span className={cn(
                      'px-2 py-1 rounded text-[10px] font-mono font-bold tracking-wide',
                      m.on ? 'bg-studio-accent/20 text-studio-accent' : 'bg-studio-surface text-studio-textMuted/40'
                    )}>
                      {m.label}
                    </span>
                  </div>
                ))}
                <span className="text-studio-textMuted/30 mx-0.5">→</span>
                <span className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-studio-success/20 text-studio-success">OUT</span>
              </div>

              {/* Processing modules grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <RackModule
                  title="7-Band EQ"
                  enabled={settings.eq.enabled}
                  onToggle={() => updateSettings({ ...settings, eq: { ...settings.eq, enabled: !settings.eq.enabled } })}
                >
                  <div className="space-y-2.5">
                    {settings.eq.bands.map((band, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <button
                          onClick={() => updateEQBand(i, 'enabled', !band.enabled)}
                          className={cn(
                            'w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold transition-colors shrink-0',
                            band.enabled ? 'bg-studio-accent/20 text-studio-accent' : 'bg-studio-bg text-studio-textMuted/40'
                          )}
                        >
                          {band.enabled ? '●' : '○'}
                        </button>
                        <span className="text-[10px] font-mono text-studio-textMuted w-12 shrink-0">{EQ_LABELS[i]}</span>
                        <div className="flex-1">
                          <input
                            type="range" min={20} max={20000} step={1} value={band.freq}
                            disabled={!settings.eq.enabled || !band.enabled}
                            onChange={e => updateEQBand(i, 'freq', parseInt(e.target.value))}
                            className="w-full h-1"
                          />
                          <div className="text-[9px] font-mono text-studio-textMuted/60 mt-0.5">{band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1)}k` : `${band.freq}Hz`}</div>
                        </div>
                        <div className="w-20 shrink-0">
                          <input
                            type="range" min={-12} max={12} step={0.1} value={band.gain}
                            disabled={!settings.eq.enabled || !band.enabled}
                            onChange={e => updateEQBand(i, 'gain', parseFloat(e.target.value))}
                            className="w-full h-1"
                          />
                          <div className="text-[9px] font-mono text-studio-textMuted/60 mt-0.5 text-center">{band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </RackModule>

                <RackModule
                  title="Compressor"
                  enabled={settings.compressor.enabled}
                  onToggle={() => updateSettings({ ...settings, compressor: { ...settings.compressor, enabled: !settings.compressor.enabled } })}
                >
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Knob label="Threshold" value={settings.compressor.threshold} min={-40} max={0} step={0.5}
                      onChange={v => updateSettings({ ...settings, compressor: { ...settings.compressor, threshold: v } })}
                      format={v => `${v}dB`} disabled={!settings.compressor.enabled} />
                    <Knob label="Ratio" value={settings.compressor.ratio} min={1} max={10} step={0.1}
                      onChange={v => updateSettings({ ...settings, compressor: { ...settings.compressor, ratio: v } })}
                      format={v => `${v.toFixed(1)}:1`} disabled={!settings.compressor.enabled} />
                    <Knob label="Attack" value={settings.compressor.attack} min={1} max={100} step={1}
                      onChange={v => updateSettings({ ...settings, compressor: { ...settings.compressor, attack: v } })}
                      format={v => `${v}ms`} disabled={!settings.compressor.enabled} />
                    <Knob label="Release" value={settings.compressor.release} min={10} max={500} step={10}
                      onChange={v => updateSettings({ ...settings, compressor: { ...settings.compressor, release: v } })}
                      format={v => `${v}ms`} disabled={!settings.compressor.enabled} />
                    <Knob label="Makeup" value={settings.compressor.makeup} min={0} max={12} step={0.5}
                      onChange={v => updateSettings({ ...settings, compressor: { ...settings.compressor, makeup: v } })}
                      format={v => `+${v}dB`} disabled={!settings.compressor.enabled} />
                  </div>
                </RackModule>

                <RackModule
                  title="De-Esser"
                  enabled={settings.deEsser.enabled}
                  onToggle={() => updateSettings({ ...settings, deEsser: { ...settings.deEsser, enabled: !settings.deEsser.enabled } })}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Knob label="Freq" value={settings.deEsser.freq} min={2000} max={12000} step={100}
                      onChange={v => updateSettings({ ...settings, deEsser: { ...settings.deEsser, freq: v } })}
                      format={v => `${(v / 1000).toFixed(1)}k`} disabled={!settings.deEsser.enabled} />
                    <Knob label="Reduce" value={settings.deEsser.amount} min={0} max={12} step={0.5}
                      onChange={v => updateSettings({ ...settings, deEsser: { ...settings.deEsser, amount: v } })}
                      format={v => `${v.toFixed(1)}dB`} disabled={!settings.deEsser.enabled} />
                  </div>
                </RackModule>

                <RackModule
                  title="Saturation"
                  enabled={settings.saturation.enabled}
                  onToggle={() => updateSettings({ ...settings, saturation: { ...settings.saturation, enabled: !settings.saturation.enabled } })}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <Knob label="Drive" value={settings.saturation.drive} min={0} max={10} step={0.1}
                      onChange={v => updateSettings({ ...settings, saturation: { ...settings.saturation, drive: v } })}
                      format={v => v.toFixed(1)} disabled={!settings.saturation.enabled} />
                    <Knob label="Mix" value={settings.saturation.mix * 100} min={0} max={100} step={1}
                      onChange={v => updateSettings({ ...settings, saturation: { ...settings.saturation, mix: v / 100 } })}
                      format={v => `${Math.round(v)}%`} disabled={!settings.saturation.enabled} />
                  </div>
                </RackModule>

                <RackModule
                  title="Stereo Width"
                  enabled={settings.stereoWidth.enabled}
                  onToggle={() => updateSettings({ ...settings, stereoWidth: { ...settings.stereoWidth, enabled: !settings.stereoWidth.enabled } })}
                >
                  <Knob label="Width" value={settings.stereoWidth.width} min={50} max={200} step={1}
                    onChange={v => updateSettings({ ...settings, stereoWidth: { ...settings.stereoWidth, width: v } })}
                    format={v => `${Math.round(v)}%`} disabled={!settings.stereoWidth.enabled} />
                  <div className="mt-3 flex justify-between text-[9px] font-mono text-studio-textMuted/50">
                    <span>Narrow</span><span>100%</span><span>Wide</span>
                  </div>
                </RackModule>

                <RackModule
                  title="Limiter"
                  enabled={settings.limiter.enabled}
                  onToggle={() => updateSettings({ ...settings, limiter: { ...settings.limiter, enabled: !settings.limiter.enabled } })}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <Knob label="Ceiling" value={settings.limiter.ceiling} min={-3} max={0} step={0.1}
                      onChange={v => updateSettings({ ...settings, limiter: { ...settings.limiter, ceiling: v } })}
                      format={v => `${v.toFixed(1)}dB`} disabled={!settings.limiter.enabled} />
                    <Knob label="Release" value={settings.limiter.release} min={1} max={200} step={1}
                      onChange={v => updateSettings({ ...settings, limiter: { ...settings.limiter, release: v } })}
                      format={v => `${v}ms`} disabled={!settings.limiter.enabled} />
                  </div>
                  <div className="mt-3">
                    <Knob label="Target LUFS" value={settings.targetLufs} min={-23} max={-6} step={0.1}
                      onChange={v => updateSettings({ ...settings, targetLufs: v })}
                      format={v => `${v.toFixed(1)}`} disabled={!settings.limiter.enabled} />
                  </div>
                </RackModule>
              </div>

              {/* Export bar */}
              <div className="sticky bottom-0 mt-6 bg-studio-surface border border-studio-border rounded-xl p-4 shadow-xl shadow-black/30">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-studio-textMuted uppercase tracking-widest">Format</span>
                    <div className="flex bg-studio-bg rounded-md border border-studio-border p-0.5">
                      <button
                        onClick={() => setRenderFormat('wav')}
                        className={cn(
                          'px-3 py-1.5 rounded text-xs font-bold tracking-wide transition-colors',
                          renderFormat === 'wav' ? 'bg-studio-accent text-white' : 'text-studio-textMuted hover:text-studio-text'
                        )}
                      >
                        WAV
                      </button>
                      <button
                        onClick={() => setRenderFormat('mp3')}
                        className={cn(
                          'px-3 py-1.5 rounded text-xs font-bold tracking-wide transition-colors',
                          renderFormat === 'mp3' ? 'bg-studio-accent text-white' : 'text-studio-textMuted hover:text-studio-text'
                        )}
                      >
                        MP3
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRender(renderFormat)}
                    disabled={rendering}
                    className="flex items-center gap-2 px-5 py-2.5 bg-studio-surfaceLight text-studio-text rounded-lg text-sm font-semibold hover:bg-studio-border transition-colors disabled:opacity-50 border border-studio-border"
                  >
                    {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {rendering ? 'Rendering...' : `Render ${renderFormat.toUpperCase()}`}
                  </button>

                  {downloadUrl && (
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-5 py-2.5 bg-studio-success text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                      <Save className="w-4 h-4" />
                      Save to Computer
                    </button>
                  )}

                  {hasUnsavedChanges && downloadUrl && (
                    <span className="flex items-center gap-1 text-xs text-studio-warning">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Re-render to update
                    </span>
                  )}

                  <div className="flex-1" />

                  <select
                    value={selectedRelease}
                    onChange={(e) => setSelectedRelease(e.target.value)}
                    className="bg-studio-bg border border-studio-border rounded px-2 py-1 text-sm text-studio-text"
                  >
                    <option value="">Link to release…</option>
                    {releases.map((r) => (
                      <option key={r.id} value={r.id}>{r.title} — {r.artist}</option>
                    ))}
                  </select>

                  <button
                    onClick={startMastering}
                    disabled={mastering || !selectedRelease || !hasAudio}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-studio-accent to-blue-600 text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {mastering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Disc3 className="w-4 h-4" />}
                    {mastering ? 'Processing…' : 'Save Master'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recent jobs list */}
          <div className="mt-8 bg-studio-surface border border-studio-border rounded-lg p-4">
            <h3 className="font-medium mb-3 text-sm text-studio-textMuted uppercase tracking-widest">Recent Mastering Jobs</h3>
            {jobs.length === 0 ? (
              <p className="text-xs text-studio-textMuted">No mastering jobs yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {jobs.slice(0, 8).map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-2 border border-studio-border/50 rounded">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-studio-text truncate">{job.track_title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.25 rounded ${
                          job.status === 'completed' ? 'bg-studio-success/20 text-studio-success'
                          : job.status === 'processing' ? 'bg-studio-warning/20 text-studio-warning'
                          : job.status === 'failed' ? 'bg-studio-danger/20 text-studio-danger'
                          : 'bg-studio-textMuted/20 text-studio-textMuted'
                        }`}>{job.status}</span>
                        <span className="text-xs text-studio-textMuted">
                          {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    {job.output_url && job.status === 'completed' && (
                      <a
                        href={job.output_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-studio-accent hover:underline flex items-center gap-1"
                      >
                        <Download size={12} /> Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RackModule({
  title, enabled, onToggle, children,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      'bg-studio-surface border rounded-lg overflow-hidden transition-all',
      enabled ? 'border-studio-border' : 'border-studio-border/50 opacity-60'
    )}>
      <div className="flex items-center justify-between px-3 py-2 bg-studio-bg/50 border-b border-studio-border">
        <div className="flex items-center gap-2">
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            enabled ? 'bg-studio-success' : 'bg-studio-textMuted/30'
          )} />
          <span className="text-[10px] font-mono font-bold text-studio-text uppercase tracking-widest">{title}</span>
        </div>
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold transition-colors',
            enabled ? 'bg-studio-success/20 text-studio-success' : 'bg-studio-bg text-studio-textMuted'
          )}
        >
          <Power className="w-2.5 h-2.5" />
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Knob({
  label, value, min, max, step, onChange, format, disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  disabled?: boolean;
}) {
  const range = max - min;
  const normalized = (value - min) / range;
  const angle = -135 + normalized * 270;

  return (
    <div className={cn('flex flex-col items-center', disabled && 'opacity-40 pointer-events-none')}>
      <div className="relative w-14 h-14 mb-1">
        <div className="absolute inset-0 rounded-full border-2 border-studio-border bg-studio-bg" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent"
          style={{
            background: `conic-gradient(from 225deg, ${disabled ? '#252836' : '#3b82f6'} ${normalized * 270}deg, transparent ${normalized * 270}deg)`,
            WebkitMask: 'radial-gradient(transparent 55%, black 57%)',
            mask: 'radial-gradient(transparent 55%, black 57%)',
          }}
        />
        <div
          className="absolute inset-2 rounded-full bg-gradient-to-br from-studio-surfaceLight to-studio-bg border border-studio-border shadow-inner flex items-center justify-center"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="w-0.5 h-3 bg-studio-accent rounded-full -mt-2.5" />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ WebkitAppearance: 'none' }}
        />
      </div>
      <span className="text-[9px] font-mono text-studio-textMuted uppercase tracking-wide">{label}</span>
      <span className="text-[10px] font-mono text-studio-text font-bold mt-0.5">{format(value)}</span>
    </div>
  );
}

function FeatureBadge({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-12 h-12 rounded-xl bg-studio-surface border border-studio-border flex items-center justify-center">
        <Icon className="w-5 h-5 text-studio-accent" />
      </div>
      <span className="text-xs text-studio-textMuted">{text}</span>
    </div>
  );
}

function DropZone({ onDrop, disabled }: { onDrop: (files: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={e => { e.preventDefault(); setDragging(false); }}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onDrop(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all w-full max-w-md',
        dragging ? 'border-studio-accent bg-studio-accent/5' : 'border-studio-border hover:border-studio-textMuted',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <div className="w-14 h-14 mx-auto rounded-2xl bg-studio-surface border border-studio-border flex items-center justify-center mb-3">
        <UploadCloud className="w-7 h-7 text-studio-accent" />
      </div>
      <p className="text-sm font-medium text-studio-text">Drop your track here or click to browse</p>
      <p className="text-xs text-studio-textMuted mt-1">WAV, FLAC, or MP3 — up to 1 GB · 30-second free preview</p>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={e => { if (e.target.files) onDrop(Array.from(e.target.files)); }}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
