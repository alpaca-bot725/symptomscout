/**
 * Dark-mode state. The initial `.dark` class on <html> is set before paint by
 * the inline script in index.html (no flash). This module is the single place
 * that reads/writes the choice at runtime so the toggle and persistence stay
 * in sync. Theme is a manual override that wins over the OS preference once set.
 */

const STORAGE_KEY = 'symptomscout_theme'

/** True if dark mode is currently applied. */
export function isDark() {
  return document.documentElement.classList.contains('dark')
}

/** Apply a theme ('dark' | 'light'), persist it, and reflect it on <html>. */
export function setTheme(theme) {
  const dark = theme === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  // Keep the mobile browser chrome (address bar) in sync with the theme.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0f172a' : '#f0f7ff')
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  } catch {
    // localStorage can throw in private mode; the class change still applies.
  }
  return dark
}

/** Flip between dark and light. Returns the new isDark value. */
export function toggleTheme() {
  return setTheme(isDark() ? 'light' : 'dark')
}
