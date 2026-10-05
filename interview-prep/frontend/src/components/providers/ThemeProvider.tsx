'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type ThemeContextValue = { theme: ThemeMode; setTheme: (theme: ThemeMode) => void; resolvedTheme: 'light' | 'dark' };
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function systemTheme(): 'light' | 'dark' {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const saved = window.localStorage.getItem('interview-prep-theme') as ThemeMode | null;
    setThemeState(saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system');
  }, []);
  useEffect(() => {
    const apply = () => { const resolved = theme === 'system' ? systemTheme() : theme; setResolvedTheme(resolved); document.documentElement.classList.toggle('dark', resolved === 'dark'); };
    apply();
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)'); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply);
  }, [theme]);
  const setTheme = (next: ThemeMode) => { setThemeState(next); window.localStorage.setItem('interview-prep-theme', next); };
  return <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const value = useContext(ThemeContext); if (!value) throw new Error('useTheme must be used within ThemeProvider'); return value; }
