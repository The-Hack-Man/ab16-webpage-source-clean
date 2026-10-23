export function storeImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url === '/images/merch/ab16clothing1.png') return '/images/merch/opt/ab16clothing1.webp';
  if (url === '/images/merch/ab16clothing.png') return '/images/merch/opt/ab16clothing.webp';
  if (url === '/images/albumcovers/newalbumcover.png') return '/images/albumcovers/newalbumcover.webp';
  if (url?.startsWith('/images/merch/') && url.endsWith('.png') && !url.includes('/opt/')) {
    const base = url.replace('/images/merch/', '').replace('.png', '');
    return `/images/merch/opt/${base}.webp`;
  }
  return url;
}

export function formatPrice(pence: number, currency = 'GBP'): string {
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
  const symbol = symbols[currency] ?? '£';
  return `${symbol}${(pence / 100).toFixed(2)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatDate(date: string | Date | null): string {
  if (!date) return 'TBC';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateLong(date: string | Date | null): string {
  if (!date) return 'TBC';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `AB16-${ymd}-${rand}`;
}

export function timeUntil(target: string | Date | null): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
} {
  if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  const targetMs = typeof target === 'string' ? new Date(target).getTime() : target.getTime();
  const total = Math.max(0, targetMs - Date.now());
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}
