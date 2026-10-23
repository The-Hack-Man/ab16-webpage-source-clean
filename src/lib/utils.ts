export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const MAX_UPLOAD_BYTES = 1073741824;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatLUFS(lufs: number | null | undefined): string {
  if (lufs === null || lufs === undefined || !isFinite(lufs)) return '--';
  return `${lufs.toFixed(1)} LUFS`;
}

export function formatDb(db: number | null | undefined): string {
  if (db === null || db === undefined || !isFinite(db)) return '--';
  return `${db.toFixed(1)} dB`;
}
