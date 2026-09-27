import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-brand-border bg-brand-background mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
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
              <span className="text-lg font-bold text-brand-primary">Interview Prep</span>
            </Link>
            <p className="text-sm text-brand-textSecondary max-w-xs">
              AI-powered personalized interview preparation for software engineers at all levels.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-brand-text mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/dashboard" className="text-sm text-brand-textSecondary hover:text-brand-secondary transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/features" className="text-sm text-brand-textSecondary hover:text-brand-secondary transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-brand-textSecondary hover:text-brand-secondary transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-brand-text mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/topics" className="text-sm text-brand-textSecondary hover:text-brand-secondary transition-colors">
                  Topics
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-sm text-brand-textSecondary hover:text-brand-secondary transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-brand-textSecondary hover:text-brand-secondary transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-brand-text mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-brand-textSecondary hover:text-brand-secondary transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-brand-textSecondary hover:text-brand-secondary transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-brand-textSecondary hover:text-brand-secondary transition-colors">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-brand-border">
          <p className="text-sm text-brand-textSecondary text-center">
            &copy; {new Date().getFullYear()} Interview Prep. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
