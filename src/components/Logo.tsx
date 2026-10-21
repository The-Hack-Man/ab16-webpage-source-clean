import { Link } from 'react-router-dom';

interface LogoProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export function AB16Logo({ variant = 'dark', className = '' }: LogoProps) {
  const color = variant === 'light' ? 'text-bone' : 'text-jet';
  const towerColor = variant === 'light' ? 'brightness-0 invert' : '';
  return (
    <Link to="/" className={`inline-flex items-center gap-2 font-display font-extrabold tracking-tight ${color} ${className}`} aria-label="AB16 Clothing home">
      <span className="inline-flex items-center text-xl leading-none">
        <span>AB</span>
        <img src="/images/brand/ab16-tower.png" alt="" className={`mx-0.5 h-7 w-[0.6rem] object-contain ${towerColor}`} />
        <span>16</span>
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.3em] opacity-60">Clothing</span>
    </Link>
  );
}

export function JamieGLogo({ variant = 'light', className = '' }: LogoProps) {
  const color = variant === 'light' ? 'text-bone' : 'text-jet';
  return (
    <Link to="/music" className={`inline-flex items-baseline gap-1 font-display font-extrabold tracking-tight ${color} ${className}`} aria-label="Jamie G Music home">
      <span className="text-xl leading-none">JAMIE G</span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.3em] opacity-50">Music</span>
    </Link>
  );
}

export function BadgeMark({ variant = 'light', className = '' }: LogoProps) {
  const stroke = variant === 'light' ? '#F5F2EC' : '#080808';
  const towerFilter = variant === 'light' ? 'brightness(0) invert(1)' : 'none';
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="3" stroke={stroke} strokeWidth="2" />
      <text x="17" y="23" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="Archivo, sans-serif" fill={stroke}>AB</text>
      <image href="/images/brand/ab16-tower.png" x="21" y="4" width="7" height="35" preserveAspectRatio="xMidYMid meet" style={{ filter: towerFilter }} />
      <text x="31.5" y="23" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="Archivo, sans-serif" fill={stroke}>16</text>
      <line x1="8" y1="28" x2="40" y2="28" stroke={stroke} strokeWidth="1" opacity="0.4" />
      <text x="24" y="38" textAnchor="middle" fontSize="7" fontWeight="600" fontFamily="Inter, sans-serif" fill={stroke} opacity="0.7" letterSpacing="1">JAMIE G</text>
    </svg>
  );
}
