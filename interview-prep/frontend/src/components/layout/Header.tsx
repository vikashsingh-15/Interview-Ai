'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

export function Header() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const desktopAvatarRef = useRef<HTMLDivElement>(null);
  const mobileAvatarRef = useRef<HTMLDivElement>(null);

  // Close the account menu when clicking anywhere else or pressing Escape.
  // Both avatar buttons stay in the DOM (one per breakpoint), so a click is
  // outside only when it misses both wrappers.
  useEffect(() => {
    if (!avatarOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!desktopAvatarRef.current?.contains(target) && !mobileAvatarRef.current?.contains(target)) {
        setAvatarOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAvatarOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [avatarOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-border bg-white/80 backdrop-blur-md">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-secondary to-brand-primary flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold text-brand-primary">Interview Prep</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/experience" className="text-sm font-medium text-brand-text hover:text-brand-secondary">Experience</Link>
            <Link
              href="/dashboard"
              className={cn(
                "text-sm font-medium transition-colors",
                isAuthenticated ? "text-brand-text" : "text-brand-textSecondary hover:text-brand-text"
              )}
            >
              Dashboard
            </Link>
            <Link
              href="/history"
              className={cn(
                "text-sm font-medium transition-colors",
                isAuthenticated ? "text-brand-text" : "text-brand-textSecondary hover:text-brand-text"
              )}
            >
              History
            </Link>
            <Link
              href="/topics"
              className={cn(
                "text-sm font-medium transition-colors",
                isAuthenticated ? "text-brand-text" : "text-brand-textSecondary hover:text-brand-text"
              )}
            >
              Topics
            </Link>
            <Link
              href="/search"
              className={cn(
                "text-sm font-medium transition-colors",
                isAuthenticated ? "text-brand-text" : "text-brand-textSecondary hover:text-brand-text"
              )}
            >
              Search
            </Link>
            <Link
              href="/settings"
              className={cn(
                "text-sm font-medium transition-colors",
                isAuthenticated ? "text-brand-text" : "text-brand-textSecondary hover:text-brand-text"
              )}
            >
              Settings
            </Link>
            <Link
              href="/projects"
              className={cn(
                "text-sm font-medium transition-colors",
                isAuthenticated ? "text-brand-text" : "text-brand-textSecondary hover:text-brand-text"
              )}
            >
              Projects
            </Link>
          </div>

          {/* Auth section */}
          <div className="flex items-center gap-4">
            {authLoading ? (
              <div className="hidden md:flex items-center">
                <div className="w-8 h-8 rounded-full bg-brand-border/40 animate-pulse" aria-label="Loading session" />
              </div>
            ) : isAuthenticated && user ? (
              <>
                <div className="hidden md:flex items-center gap-4">
                  <span className="text-sm text-brand-textSecondary">
                    {user.name}
                  </span>
                  <div className="relative" ref={desktopAvatarRef}>
                    <button
                      onClick={() => setAvatarOpen((v) => !v)}
                      aria-haspopup="menu"
                      aria-expanded={avatarOpen}
                      title="Account menu"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-secondary/10 text-brand-secondary hover:bg-brand-secondary/20 transition-colors"
                    >
                      <span className="text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </button>
                    {avatarOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 mt-2 w-48 rounded-lg border border-brand-border bg-white shadow-lg py-1 z-50"
                      >
                        <div className="px-4 py-2 border-b border-brand-border">
                          <p className="text-sm font-medium text-brand-text truncate">{user.name}</p>
                          <p className="text-xs text-brand-textSecondary truncate">{user.email}</p>
                        </div>
                        <Link
                          href="/settings"
                          role="menuitem"
                          className="block px-4 py-2 text-sm text-brand-text hover:bg-brand-primary/5"
                          onClick={() => setAvatarOpen(false)}
                        >
                          Settings
                        </Link>
                        <button
                          role="menuitem"
                          onClick={() => { setAvatarOpen(false); void logout(); }}
                          className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                        >
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Mobile: avatar button opens the same menu */}
                <div className="relative md:hidden" ref={mobileAvatarRef}>
                  <button
                    onClick={() => setAvatarOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={avatarOpen}
                    aria-label="Account menu"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-secondary/10 text-brand-secondary"
                  >
                    <span className="text-sm font-medium">{user.name.charAt(0).toUpperCase()}</span>
                  </button>
                  {avatarOpen && (
                    <div role="menu" className="absolute right-0 mt-2 w-48 rounded-lg border border-brand-border bg-white shadow-lg py-1 z-50">
                      <div className="px-4 py-2 border-b border-brand-border">
                        <p className="text-sm font-medium text-brand-text truncate">{user.name}</p>
                        <p className="text-xs text-brand-textSecondary truncate">{user.email}</p>
                      </div>
                      <Link href="/settings" role="menuitem" className="block px-4 py-2 text-sm text-brand-text hover:bg-brand-primary/5" onClick={() => setAvatarOpen(false)}>
                        Settings
                      </Link>
                      <button
                        role="menuitem"
                        onClick={() => { setAvatarOpen(false); void logout(); }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link href="/login">
                  <button className="text-sm font-medium text-brand-textSecondary hover:text-brand-text transition-colors">
                    Sign in
                  </button>
                </Link>
                <Link href="/login">
                  <button className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-brand-secondary text-white hover:bg-brand-secondary/90 transition-colors">
                    Get Started
                  </button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-brand-primary/5"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-brand-border animate-fade-in">
            <div className="flex flex-col space-y-4">
              {authLoading ? null : isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    className="text-brand-text font-medium py-2 hover:text-brand-secondary"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/history"
                    className="text-brand-textSecondary py-2 hover:text-brand-text"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    History
                  </Link>
                  <Link
                    href="/settings"
                    className="text-brand-textSecondary py-2 hover:text-brand-text"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Session Settings
                  </Link>
                  <Link
                    href="/topics"
                    className="text-brand-textSecondary py-2 hover:text-brand-text"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Topics
                  </Link>
                  <Link
                    href="/search"
                    className="text-brand-textSecondary py-2 hover:text-brand-text"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Search
                  </Link>
                  <Link
                    href="/projects"
                    className="text-brand-textSecondary py-2 hover:text-brand-text"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Projects
                  </Link>
                  <Link href="/experience" className="text-brand-textSecondary py-2 hover:text-brand-text" onClick={() => setIsMenuOpen(false)}>Experience</Link>
                  <div className="pt-4 border-t border-brand-border">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-brand-textSecondary">{user?.name}</span>
                      <button
                        onClick={() => {
                          logout();
                          setIsMenuOpen(false);
                        }}
                        className="text-sm text-red-500 hover:text-red-600"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-brand-text font-medium py-2 hover:text-brand-secondary"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/login"
                    className="text-brand-secondary font-medium py-2 hover:text-brand-secondary"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
