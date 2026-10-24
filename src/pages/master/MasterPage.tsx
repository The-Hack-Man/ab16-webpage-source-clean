import { useEffect, useState, useRef, useCallback } from 'react';
import {
  UploadCloud, Loader2, Download, Play, Pause,
  Lock, CheckCircle2, AlertTriangle, Disc3, Save, FileAudio,
  Power, SkipBack, Circle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  MasteringEngine, DEFAULT_SETTINGS, PRESETS, createAudioPreview, decodeAudioFile, getSourceSampleRate, analyzeAudio,
  renderAudio, type MasteringSettings, type AudioAnalysis, type PresetConfig,
  type ExportFormat,
} from '@/lib/masteringEngine';
import { cn, formatLUFS, formatDb, formatDuration, MAX_UPLOAD_BYTES, formatBytes } from '@/lib/utils';
import SpectrumAnalyzer from '@/components/SpectrumAnalyzer';
import { Link } from 'react-router-dom';

const DEMO_DURATION = 30;
const MAX_TRACK_DURATION = 15 * 60;
const EQ_LABELS = ['SUB', 'LOW', 'LO-MID', 'MID', 'PRES', 'HIGH', 'AIR'];

export function MasterPage() {
  const { user } = useAuth();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<MasteringEngine | null>(null);
  const originalBufferRef = useRef<AudioBuffer | null>(null);
  const previewBufferRef = useRef<AudioBuffer | null>(null);
  const originalSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
  const [downloadScope, setDownloadScope] = useState<'preview' | 'full'>('preview');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditRefreshKey, setCreditRefreshKey] = useState(0);
  const [verificationRetryKey, setVerificationRetryKey] = useState(0);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  const progressTimerRef = useRef<number>(0);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setUploadError(null);
    setLoading(true);
    setIsPlaying(false);
    setDownloadUrl(null);
    setHasUnsavedChanges(false);

    try {
      if (!file.type.startsWith('audio/')) throw new Error('Please upload an audio file (WAV, FLAC, or MP3).');
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(`File exceeds ${formatBytes(MAX_UPLOAD_BYTES)} limit. Please export a smaller compressed audio file.`);

      const ctx = getAudioContext();
      const buffer = await decodeAudioFile(file, ctx);
      const sourceSampleRate = await getSourceSampleRate(file, buffer.sampleRate);
      if (buffer.duration > MAX_TRACK_DURATION) throw new Error('Tracks must be 15 minutes or shorter.');
      const preview = createAudioPreview(buffer, ctx, DEMO_DURATION);
      originalBufferRef.current = buffer;
      previewBufferRef.current = preview;
      const baseName = file.name
        .replace(/\.[^.]+$/, '')
        .split('')
        .map((character) => /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? '_' : character)
        .join('');
      setFileName(baseName);
      setDownloadName(`${baseName}_mastered`);
      setAnalysis({
        ...analyzeAudio(preview),
        duration: buffer.duration,
        sampleRate: sourceSampleRate,
      });

      if (engineRef.current) engineRef.current.dispose();
      engineRef.current = new MasteringEngine(ctx);
      engineRef.current.setBuffer(preview);
      setAnalyser(engineRef.current.getAnalyser());
      engineRef.current.applySettings(settings);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = (newSettings: MasteringSettings) => {
    setSettings(newSettings);
    setHasUnsavedChanges(true);
    if (engineRef.current) engineRef.current.applySettings(newSettings);
    if (downloadUrl) setDownloadUrl(null);
  };

  const applyPreset = (preset: PresetConfig) => {
    setActivePreset(preset.id);
    updateSettings({ ...DEFAULT_SETTINGS, ...preset.settings } as MasteringSettings);
  };

  const stopAllPlayback = () => {
    if (engineRef.current) engineRef.current.stop();
    if (originalSourceRef.current) {
      originalSourceRef.current.onended = null;
      try { originalSourceRef.current.stop(); } catch { /* already stopped */ }
      originalSourceRef.current = null;
    }
  };

  const playOriginal = (ctx: AudioContext, play: boolean) => {
    if (originalSourceRef.current) { try { originalSourceRef.current.stop(); } catch { /* already stopped */ } originalSourceRef.current = null; }
    if (play && previewBufferRef.current) {
      originalSourceRef.current = ctx.createBufferSource();
      originalSourceRef.current.buffer = previewBufferRef.current;
      originalSourceRef.current.connect(ctx.destination);
      originalSourceRef.current.onended = () => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); };
      originalSourceRef.current.start(0);
    }
  };

  const handlePlay = () => {
    const ctx = getAudioContext();
    if (!engineRef.current || !previewBufferRef.current) return;
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
        if (previewBufferRef.current) {
          if (originalSourceRef.current) { try { originalSourceRef.current.stop(); } catch { /* already stopped */ } }
          originalSourceRef.current = ctx.createBufferSource();
          originalSourceRef.current.buffer = previewBufferRef.current;
          originalSourceRef.current.connect(ctx.destination);
          originalSourceRef.current.onended = () => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); };
          originalSourceRef.current.start(0, seekTime);
        }
      }
      startProgressTimer();
    }
  };

  const handleRender = async (format: ExportFormat, fullTrack = false) => {
    const sourceBuffer = fullTrack ? originalBufferRef.current : previewBufferRef.current;
    if (!sourceBuffer) return;
    setRendering(true);
    setRenderFormat(format);
    try {
      const blob = await renderAudio(
        sourceBuffer,
        settings,
        format,
        fullTrack ? undefined : DEMO_DURATION,
        320,
      );
      if (fullTrack) {
        const { data, error } = await supabase.rpc('consume_mastering_credit');
        if (error) throw new Error(error.message);
        setCredits(typeof data === 'number' ? data : 0);
      }
      setDownloadUrl(URL.createObjectURL(blob));
      setDownloadScope(fullTrack ? 'full' : 'preview');
      setHasUnsavedChanges(false);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('MP3 encoder') && format === 'mp3') {
        setUploadError('MP3 encoder is unavailable. Please choose WAV and render again.');
        return;
      }
      setUploadError(`Export failed: ${msg}`);
    } finally { setRendering(false); }
  };

  const handleSave = () => {
    if (!downloadUrl) { handleRender(renderFormat); return; }
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${downloadName}${downloadScope === 'preview' ? '_demo' : ''}.${renderFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCheckout = async () => {
    if (!user) {
      setPaymentNotice('Sign in to buy a mastering credit. The free 30-second preview is available without an account.');
      return;
    }
    setCheckoutLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setPaymentNotice('Please sign in to purchase mastering credits.');
        return;
      }

      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>('stripe-checkout', {
        body: { package: 'single', origin: window.location.origin },
      });
      if (error) throw new Error(data?.error || error.message);
      if (!data?.url) throw new Error(data?.error || 'Stripe did not return a checkout link.');
      window.location.assign(data.url);
    } catch (e) {
      setPaymentNotice(`Payment error: ${(e as Error).message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaymentNotice('Confirming your Stripe payment…');
    } else if (params.get('payment') === 'cancelled') {
      setPaymentNotice('Checkout was cancelled. No payment was taken.');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('payment') !== 'success' || !sessionId || !user?.id) return;

    let cancelled = false;
    setCreditsLoading(true);
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Sign in again to verify your mastering purchase.');
        const { data, error } = await supabase.functions.invoke<{
          status?: 'paid' | 'pending' | 'failed';
          credits?: number;
          error?: string;
        }>('verify-mastering-checkout', {
          headers: { Authorization: `Bearer ${token}` },
          body: { sessionId },
        });
        if (error) throw new Error(data?.error || error.message);
        if (cancelled) return;
        if (data?.status === 'paid' && Number.isInteger(data.credits)) {
          setCredits(data.credits as number);
          setPaymentNotice(`Payment confirmed. You have ${data.credits} mastering credit${data.credits === 1 ? '' : 's'}.`);
          setCreditRefreshKey((key) => key + 1);
        } else if (data?.status === 'pending') {
          setPaymentNotice('Stripe is still processing your payment. Check again shortly.');
        } else {
          throw new Error(data?.error || 'The payment could not be verified.');
        }
      } catch (error) {
        if (!cancelled) setPaymentNotice(error instanceof Error ? error.message : 'Could not verify your payment.');
      } finally {
        if (!cancelled) setCreditsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, verificationRetryKey]);

  useEffect(() => {
    if (!downloadUrl) return;
    return () => URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      engineRef.current?.stop();
      if (originalSourceRef.current) {
        try { originalSourceRef.current.stop(); } catch { /* already stopped */ }
      }
      engineRef.current?.dispose();
      void audioCtxRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setCredits(null);
      setCreditsLoading(false);
      return;
    }
    let cancelled = false;
    setCreditsLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('mastering_credits')
          .select('credits')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setPaymentNotice(`Could not load credit balance: ${error.message}`);
        } else {
          const balance = data?.credits ?? 0;
          setCredits(balance);
          if (balance > 0) {
            const message = originalBufferRef.current
              ? 'Your mastering credit is ready.'
              : 'Your mastering credit is ready. Upload your track to create the full master.';
            setPaymentNotice(message);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentNotice(`Could not load credit balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } finally {
        if (!cancelled) setCreditsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, creditRefreshKey]);

  const hasAudio = originalBufferRef.current !== null;
  const duration = previewBufferRef.current?.duration ?? DEMO_DURATION;
  const returnedFromMasteringCheckout = new URLSearchParams(window.location.search).get('payment') === 'success';

  const updateEQBand = (index: number, key: 'freq' | 'gain' | 'enabled', value: number | boolean) => {
    const newBands = [...settings.eq.bands];
    newBands[index] = { ...newBands[index], [key]: value };
    updateSettings({ ...settings, eq: { ...settings.eq, bands: newBands } });
  };

  return (
    <div className="master-page min-h-screen flex flex-col bg-studio-bg text-studio-text font-sans">
      <header className="master-masthead border-b border-studio-border bg-gradient-to-r from-studio-surface via-studio-surface to-studio-bg px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-studio-accent to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Disc3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-studio-text tracking-tight leading-none">JAMIE G <span className="master-title-divider">/</span> MASTERING</h1>
            <p className="text-[10px] text-studio-textMuted mt-0.5 tracking-wide uppercase">Artist-run mastering room</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link className="master-back-link" to="/">Back to the studio <span aria-hidden="true">↗</span></Link>
          {analysis && (
            <div className="hidden md:flex items-center gap-4 text-xs font-mono" title="Approximate browser measurements — not certified for delivery">
              <span className="text-studio-textMuted">LUFS~ <span className="text-studio-text font-bold">{formatLUFS(analysis.lufs)}</span></span>
              <span className="text-studio-textMuted">TP~ <span className="text-studio-text font-bold">{formatDb(analysis.truePeak)}</span></span>
              <span className="text-studio-textMuted">RMS~ <span className="text-studio-text font-bold">{formatDb(analysis.rms)}</span></span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-studio-warning/10 border border-studio-warning/20 rounded-md">
            <Circle className="w-2 h-2 fill-studio-warning text-studio-warning" />
            <span className="text-[10px] text-studio-warning font-bold uppercase tracking-wide">30s Preview</span>
          </div>
        </div>
      </header>

      {paymentNotice && (
        <div role="status" className="master-notice mx-6 mt-4 rounded-lg border border-studio-accent/30 bg-studio-accent/10 px-4 py-3 text-sm text-studio-text">
          {paymentNotice}
          {!user && <Link className="ml-2 font-semibold text-studio-accent underline" to="/account/login">Sign in</Link>}
          {user && returnedFromMasteringCheckout && credits === 0 && !creditsLoading && (
            <button
              type="button"
              className="ml-3 font-semibold text-studio-accent underline"
              onClick={() => setVerificationRetryKey((key) => key + 1)}
            >
              Check payment again
            </button>
          )}
        </div>
      )}

      {/* Transport bar */}
      {hasAudio && (
        <div className="master-transport bg-studio-surface border-b border-studio-border px-6 py-3 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRewind}
              aria-label="Rewind preview"
              className="w-9 h-9 rounded-lg bg-studio-bg border border-studio-border text-studio-textMuted flex items-center justify-center hover:text-studio-text hover:border-studio-textMuted transition-colors"
              title="Rewind"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>
            <button
              type="button"
              onClick={handlePlay}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
              className="w-11 h-11 rounded-lg bg-studio-accent text-white flex items-center justify-center hover:bg-blue-600 transition-colors shadow-md shadow-blue-900/20"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
          </div>

          <div className="flex-1 mx-2">
            <div
              role="slider"
              tabIndex={0}
              aria-label="Preview position"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  const next = Math.max(0, Math.min(duration, currentTime + (event.key === 'ArrowRight' ? 5 : -5)));
                  setCurrentTime(next);
                  if (isPlaying) {
                    stopAllPlayback();
                    if (playMode === 'mastered') {
                      engineRef.current?.seek(next);
                      engineRef.current?.play(() => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); });
                    } else {
                      const ctx = getAudioContext();
                      const preview = previewBufferRef.current;
                      if (preview) {
                        const source = ctx.createBufferSource();
                        source.buffer = preview;
                        source.connect(ctx.destination);
                        source.onended = () => { setIsPlaying(false); setCurrentTime(0); stopProgressTimer(); };
                        source.start(0, next);
                        originalSourceRef.current = source;
                        startProgressTimer();
                      }
                    }
                  }
                }
              }}
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
              type="button"
              onClick={() => togglePlayMode('original')}
              aria-pressed={playMode === 'original'}
              className={cn(
                'px-4 py-1.5 rounded text-[10px] font-bold tracking-widest transition-colors',
                playMode === 'original' ? 'bg-studio-textMuted text-studio-bg' : 'text-studio-textMuted hover:text-studio-text'
              )}
            >
              BEFORE
            </button>
            <button
              type="button"
              onClick={() => togglePlayMode('mastered')}
              aria-pressed={playMode === 'mastered'}
              className={cn(
                'px-4 py-1.5 rounded text-[10px] font-bold tracking-widest transition-colors',
                playMode === 'mastered' ? 'bg-studio-accent text-white' : 'text-studio-textMuted hover:text-studio-text'
              )}
            >
              AFTER
            </button>
          </div>

          <div className="hidden lg:block w-48">
            <div className="master-spectrum">
              <SpectrumAnalyzer
                analyser={playMode === 'mastered' && isPlaying ? analyser : null}
                isPlaying={isPlaying}
                theme="master"
              />
              {!(playMode === 'mastered' && isPlaying) && <span>Play preview to view spectrum</span>}
            </div>
          </div>
        </div>
      )}

      <section className="master-content flex-1 overflow-auto p-6">
        <div className="master-inner max-w-[1200px] mx-auto">
          {!hasAudio && !loading && (
            <div className="master-empty flex flex-col items-center justify-center min-h-[60vh]">
              <div className="master-intro">
                <p className="master-kicker"><span /> A small independent mastering room</p>
                <h2>Give your mix<br /><em>a little more room.</em></h2>
                <p className="master-intro-copy">A careful finishing pass for the music you made. Listen to a free 30-second comparison before you decide on the full track.</p>
              </div>
              <DropZone onDrop={handleUpload} />
              {uploadError && (
                <div className="mt-4 text-sm text-studio-danger bg-studio-danger/10 border border-studio-danger/30 rounded-lg px-4 py-2 max-w-md">
                  {uploadError}
                </div>
              )}
              <div className="mt-6 grid grid-cols-3 gap-6 text-center max-w-lg">
                <FeatureBadge icon={Disc3} text="7-Band EQ" />
                <FeatureBadge icon={Power} text="Sibilance EQ + Comp" />
                <FeatureBadge icon={FileAudio} text="WAV + MP3 Export" />
              </div>
            </div>
          )}

          {loading && (
            <div role="status" className="master-loading flex items-center justify-center min-h-[60vh]">
              <Loader2 className="w-10 h-10 animate-spin text-studio-accent" />
              <span>Preparing your listening copy…</span>
            </div>
          )}

          {hasAudio && (
            <div className="master-session space-y-4">
              <div className="master-track flex items-center gap-3 bg-studio-surface border border-studio-border rounded-lg px-4 py-2.5">
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
                <button
                  onClick={() => {
                    stopAllPlayback();
                    originalBufferRef.current = null;
                    previewBufferRef.current = null;
                    setFileName(null);
                    setAnalysis(null);
                    setIsPlaying(false);
                    setDownloadUrl(null);
                    setUploadError(null);
                  }}
                  className="text-xs text-studio-textMuted hover:text-studio-danger transition-colors"
                  disabled={isPlaying}
                >
                  Replace
                </button>
              </div>
              {analysis && (
                <section className="master-analysis" aria-label="Approximate browser analysis">
                  <div className="master-analysis-heading">
                    <span className="master-kicker"><span /> Listening notes</span>
                    <span>Approximate browser analysis · preview section</span>
                  </div>
                  <div className="master-readouts">
                    <div><span>Integrated loudness</span><strong>{formatLUFS(analysis.lufs)}</strong></div>
                    <div><span>Peak level</span><strong>{formatDb(analysis.truePeak)}</strong></div>
                    <div><span>Average level</span><strong>{formatDb(analysis.rms)} <small>RMS</small></strong></div>
                    <div><span>Source</span><strong>{analysis.sampleRate / 1000}<small> kHz · {analysis.channels === 2 ? 'stereo' : 'mono'}</small></strong></div>
                  </div>
                  <p>These in-browser readings are a guide, not a certified delivery measurement.</p>
                </section>
              )}
              {uploadError && (
                <div role="alert" className="text-sm text-studio-danger bg-studio-danger/10 border border-studio-danger/30 rounded-lg px-4 py-2">
                  {uploadError}
                </div>
              )}

              <div className="master-presets flex items-center gap-2 bg-studio-surface border border-studio-border rounded-lg px-4 py-3">
                <span className="text-[10px] font-bold text-studio-textMuted uppercase tracking-widest mr-2 shrink-0">Style</span>
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={cn(
                      'px-4 py-2 rounded text-sm font-semibold transition-colors border',
                      activePreset === p.id
                        ? 'border-studio-accent bg-studio-accent/15 text-white'
                        : 'border-transparent text-studio-textMuted hover:text-studio-text hover:bg-studio-surfaceLight'
                    )}
                  >
                    <span>{p.name}</span>
                  </button>
                ))}
                <span className="ml-auto text-xs text-studio-textMuted hidden md:block">
                  {PRESETS.find(p => p.id === activePreset)?.desc}
                </span>
              </div>

              <section className="master-rack-section" aria-label="Processing rack">
                <div className="master-section-heading">
                  <div><span className="master-kicker"><span /> The rack</span><h2>Shape the finish</h2></div>
                  <p>Use the presets as a starting point, then make it yours.</p>
                </div>
              <div className="master-rack grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <RackModule
                  title="7-Band EQ"
                  enabled={settings.eq.enabled}
                  onToggle={() => updateSettings({ ...settings, eq: { ...settings.eq, enabled: !settings.eq.enabled } })}
                >
                  <div className="space-y-2.5">
                    {settings.eq.bands.map((band, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => updateEQBand(i, 'enabled', !band.enabled)}
                          aria-label={`${band.enabled ? 'Disable' : 'Enable'} ${EQ_LABELS[i]} EQ band`}
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
                  title="Static sibilance EQ"
                  enabled={settings.deEsser.enabled}
                  onToggle={() => updateSettings({ ...settings, deEsser: { ...settings.deEsser, enabled: !settings.deEsser.enabled } })}
                >
                  <p className="master-module-note">Fixed-frequency cut · not dynamic de-essing.</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Knob label="Cut frequency" value={settings.deEsser.freq} min={2000} max={12000} step={100}
                      onChange={v => updateSettings({ ...settings, deEsser: { ...settings.deEsser, freq: v } })}
                      format={v => `${(v / 1000).toFixed(1)}k`} disabled={!settings.deEsser.enabled} />
                    <Knob label="Cut amount" value={settings.deEsser.amount} min={0} max={12} step={0.5}
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
                </RackModule>
              </div>
              </section>

              <div className="master-export sticky bottom-0 mt-6 bg-studio-surface border border-studio-border rounded-xl p-4 shadow-xl shadow-black/30">
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

                  <div className="flex items-center gap-1.5 text-xs text-studio-success">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-bold">Free 30s Preview</span>
                  </div>

                  {credits !== null && credits > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleRender(renderFormat, true)}
                      disabled={rendering || creditsLoading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-studio-success text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Master full track ({credits} credit{credits === 1 ? '' : 's'})
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {user ? (
                        <>
                          <span className="text-xs text-studio-textMuted">
                            {creditsLoading ? 'Checking credits…' : 'Full-track master'}
                          </span>
                          <button
                            type="button"
                            onClick={handleCheckout}
                            disabled={checkoutLoading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-studio-accent to-blue-600 text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                            Unlock full track · £5
                          </button>
                        </>
                      ) : (
                        <Link
                          to="/account/login"
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-studio-accent to-blue-600 text-white rounded-lg text-sm font-bold"
                        >
                          <Lock className="w-4 h-4" />
                          Sign in to unlock · £5
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </section>
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
          type="button"
          onClick={onToggle}
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${title}`}
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
            background: `conic-gradient(from 225deg, ${disabled ? '#d6cfc2' : 'var(--master-accent, #b94f38)'} ${normalized * 270}deg, transparent ${normalized * 270}deg)`,
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
          aria-label={label}
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
      onKeyDown={e => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={e => { e.preventDefault(); setDragging(false); }}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onDrop(Array.from(e.dataTransfer.files));
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Choose an audio track to upload"
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
      <p className="text-xs text-studio-textMuted mt-1">WAV, FLAC, or MP3 — up to {formatBytes(MAX_UPLOAD_BYTES)} and 15 minutes · free 30-second preview</p>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={e => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = '';
          if (files.length) onDrop(files);
        }}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
