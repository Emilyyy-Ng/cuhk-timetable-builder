// frontend/src/components/ui/Button.jsx
import React from 'react';

const BASE =
  'inline-flex items-center justify-center gap-2 select-none ' +
  'transition-all duration-150 ease-out cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed motion-reduce:transition-none';

const VARIANTS = {
  primary:
    'bg-cuhk-primary text-white shadow-sm font-semibold ' +
    'focus-visible:ring-cuhk-primary ' +
    'hover:bg-cuhk-primary-dark hover:shadow-md hover:shadow-cuhk-primary/25 ' +
    'active:bg-cuhk-primary-darker active:scale-[0.98] active:shadow-sm ' +
    'disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none',
    secondary:
      'bg-white text-slate-700 border border-slate-300 shadow-sm font-medium ' +
      'focus-visible:ring-cuhk-primary ' +
      'hover:border-cuhk-primary/20 hover:text-cuhk-primary-dark hover:bg-cuhk-primary/10 ' +  
      'active:scale-[0.98] disabled:opacity-50',
  soft:
    'bg-cuhk-primary/10 text-cuhk-primary-dark font-semibold ' +
    'focus-visible:ring-cuhk-primary ' +
    'hover:bg-cuhk-primary/20 active:bg-cuhk-primary/25 active:scale-[0.98] ' +
    'disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70',
  ghost:
    'border border-slate-300 shadow-sm font-medium ' +
    'focus-visible:ring-cuhk-primary ' +
    'hover:bg-cuhk-primary/5 ' +
    'active:scale-[0.98] disabled:opacity-50',
  dangerGhost:
    'bg-white text-red-600 border border-red-300 shadow-sm font-medium ' +
    'focus-visible:ring-red-400 ' +
    'hover:bg-red-50 hover:border-red-400 active:bg-red-100 active:scale-[0.98] ' +
    'disabled:opacity-50',
  link:
    'text-cuhk-blue font-medium underline-offset-4 ' +
    'focus-visible:ring-cuhk-blue ' +
    'hover:underline active:scale-[0.98]',
};

const SIZES = {
  sm: 'text-sm py-1.5 px-3 rounded-lg',
  md: 'text-sm py-2 px-4 rounded-lg',
  lg: 'text-base py-3 px-5 rounded-xl',
};

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

// Square, icon-only button (remove ✕, collapse chevron, etc.)
export function IconButton({ label, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 cursor-pointer
        transition-all duration-150 active:scale-90
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}