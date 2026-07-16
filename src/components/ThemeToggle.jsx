import { useState } from 'react'
import { isDark, toggleTheme } from '../lib/theme'

/**
 * Sun/moon dark-mode toggle. Local state mirrors the <html> class so the icon
 * updates on tap; the source of truth is the class + localStorage (see
 * lib/theme.js). Rendered in the corner of every screen's header.
 */
export default function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(isDark)
  return (
    <button
      onClick={() => setDark(toggleTheme())}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`grid size-10 shrink-0 place-items-center rounded-2xl text-lg ring-1 transition bg-white text-slate-600 ring-slate-200 active:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:active:bg-slate-700 ${className}`}
    >
      <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span>
    </button>
  )
}
