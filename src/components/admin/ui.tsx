import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Icon } from '@/types';

export function StatCard({ icon: Icon, label, value, sub, link, alert }: {
  icon: Icon; label: string; value: string; sub?: string; link?: string; alert?: boolean;
}) {
  const content = (
    <div className={`bg-white border rounded-lg p-5 transition-all duration-200 ${alert ? 'border-amber-300' : 'border-slate-200'} ${link ? 'hover:border-slate-300 hover:shadow-sm' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <Icon size={20} className={alert ? 'text-amber-500' : 'text-slate-400'} strokeWidth={1.5} />
        {alert && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
      </div>
      <p className="text-2xl font-bold text-jet">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

export function SectionCard({ title, action, children, className }: {
  title: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg ${className ?? ''}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-jet">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: {
  children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ icon: Icon, title, desc, action }: {
  icon: Icon; title: string; desc?: string; action?: ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg py-16 text-center">
      <Icon size={32} className="mx-auto text-slate-300 mb-3" strokeWidth={1.5} />
      <p className="text-slate-500">{title}</p>
      {desc && <p className="text-sm text-slate-400 mt-1">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingRows({ count = 3, height = 'h-16' }: { count?: number; height?: string }) {
  return <div className="space-y-2">{Array.from({ length: count }).map((_, i) => <div key={i} className={`${height} bg-white animate-pulse rounded`} />)}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-jet">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1">
      <svg width="16" height="16" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
      <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-slate-200 pl-11 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:border-jet transition-colors" />
    </div>
  );
}

export function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-slate-200 px-4 py-2.5 text-sm bg-white cursor-pointer focus:outline-none focus:border-jet transition-colors">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
