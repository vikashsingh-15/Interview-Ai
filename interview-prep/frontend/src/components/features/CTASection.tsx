export function CTASection() {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-secondary to-brand-primary" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDAgMTAgMTJMMzYgMTAiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Ready to Ace Your Next Interview?
        </h2>
        <p className="mt-6 text-xl text-white/80 max-w-2xl mx-auto">
          Join thousands of engineers who are improving their interview skills every day with personalized, adaptive preparation.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="/login" className="inline-flex items-center px-8 py-4 text-base font-semibold rounded-lg bg-white text-brand-primary hover:bg-gray-100 transition-colors shadow-lg">
            Start Free Now
            <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
          <a href="/login" className="inline-flex items-center px-8 py-4 text-base font-semibold rounded-lg border border-white/30 text-white hover:bg-white/10 transition-colors">
            Sign In
          </a>
        </div>

        <p className="mt-8 text-sm text-white/60">
          No credit card required. Start preparing today.
        </p>
      </div>
    </section>
  );
}
