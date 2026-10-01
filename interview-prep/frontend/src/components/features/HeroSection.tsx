import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 via-transparent to-brand-secondary/5" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-secondary/10 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-secondary/10 text-brand-secondary text-sm font-medium mb-8 animate-fade-in">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI-Powered Interview Preparation
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-6xl font-bold text-brand-primary tracking-tight animate-slide-up">
            Master Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-secondary to-brand-primary">
              SDE Interview
            </span>{' '}
            with an AI Coach That Knows You
          </h1>

          {/* Subheading */}
          <p className="mt-6 text-xl text-brand-textSecondary max-w-2xl mx-auto animate-fade-in stagger-1">
            Personalized daily sessions based on your resume, target role, and weak areas.
            Practice system design, coding, technical questions, and project interviews.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in stagger-2">
            <Link href="/login">
              <Button size="lg" className="px-8">
                Start Free Preparation
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="secondary" size="lg" className="px-8">
                See How It Works
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto animate-fade-in stagger-3">
            <div>
              <div className="text-3xl font-bold text-brand-primary">10k+</div>
              <div className="text-sm text-brand-textSecondary">Engineers preparing</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-brand-primary">500+</div>
              <div className="text-sm text-brand-textSecondary">Interview topics</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-brand-primary">4.9</div>
              <div className="text-sm text-brand-textSecondary">Average rating</div>
            </div>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl bg-white border border-brand-border shadow-sm">
            <div className="w-12 h-12 rounded-lg bg-brand-secondary/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-brand-primary mb-2">Resume-Based</h3>
            <p className="text-sm text-brand-textSecondary">
              Your resume is parsed to create personalized questions based on your actual experience and skills.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white border border-brand-border shadow-sm">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-brand-primary mb-2">Adaptive Learning</h3>
            <p className="text-sm text-brand-textSecondary">
              The system learns from your answers and adapts to focus on your weak areas with spaced repetition.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white border border-brand-border shadow-sm">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-brand-primary mb-2">Daily Sessions</h3>
            <p className="text-sm text-brand-textSecondary">
              Fresh questions every day with system design, coding, technical, and project interview sections.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
