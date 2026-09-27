import Link from 'next/link';
import { Button } from '@/components/ui';

const features = [
  {
    title: 'Personalized Question Bank',
    description: 'Get questions tailored to your resume, target role, and confirmed skills. Never see the same generic list twice.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    color: 'brand-secondary',
  },
  {
    title: 'Resume Parsing & Profile',
    description: 'Upload your resume and get a structured profile extracted with AI. Confirm, edit, and verify your skills and projects.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'emerald',
  },
  {
    title: 'AI Question Generation',
    description: 'Fresh questions generated daily with semantic diversity. No duplicate questions, no rephrasing the same concept.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: 'violet',
  },
  {
    title: 'Spaced Repetition Revision',
    description: 'Automatic revision scheduling at +1 day, +7 days, and +30 days. Master concepts permanently with intelligent review.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'amber',
  },
  {
    title: 'Project Interview Preparation',
    description: 'Practice defending your actual projects. Get questions about your architecture, technology choices, and design decisions.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    color: 'rose',
  },
  {
    title: 'Weakness Detection Engine',
    description: 'Identify weak concepts automatically from your answers. Focus your preparation where it matters most.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    color: 'orange',
  },
  {
    title: 'System Design Practice',
    description: 'Two system design questions daily covering HLD, LLD, distributed systems, and backend architecture.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    color: 'pink',
  },
  {
    title: 'Coding/DSA Tracking',
    description: 'Track coding problems with patterns, difficulty, and progress. Focus on interview-relevant problem types.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    color: 'cyan',
  },
  {
    title: 'Mock Interview Mode',
    description: 'Full-length mock interviews with dynamic follow-up questions. Practice like a real interview with detailed feedback.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    color: 'indigo',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-brand-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base text-brand-secondary font-semibold tracking-wide uppercase">
            Everything You Need
          </h2>
          <p className="mt-2 text-3xl font-bold text-brand-primary">
            A Complete Interview Preparation System
          </p>
          <p className="mt-4 text-xl text-brand-textSecondary">
            From resume parsing to mock interviews, we have you covered at every step.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-xl bg-white border border-brand-border shadow-sm hover:shadow-md hover:border-brand-secondary/30 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={`w-12 h-12 rounded-lg bg-${feature.color}-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <span className={`text-${feature.color}-600`}>
                  {feature.icon}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-brand-primary mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-brand-textSecondary">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/dashboard">
            <Button variant="secondary" size="lg">
              Explore Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
