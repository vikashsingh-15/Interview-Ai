import Link from 'next/link';

const steps = [
  {
    number: '01',
    title: 'Create Your Account',
    description: 'Sign up with your email and start your journey. No credit card required.',
  },
  {
    number: '02',
    title: 'Upload Your Resume',
    description: 'Upload your PDF or DOCX resume. We parse it securely and extract your skills, experience, and projects.',
  },
  {
    number: '03',
    title: 'Review & Confirm Profile',
    description: 'Review the extracted information. Confirm your skills, edit details, and remove anything incorrect.',
  },
  {
    number: '04',
    title: 'Set Your Targets',
    description: 'Choose your target role (SDE-2, Backend, etc.), experience level, and target companies.',
  },
  {
    number: '05',
    title: 'Get Your Curriculum',
    description: 'Receive a personalized curriculum based on your profile, gaps, and market expectations.',
  },
  {
    number: '06',
    title: 'Start Day 1',
    description: 'Begin your first daily session with technical questions, system design, coding, and project questions.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-brand-primary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-brand-secondary/80">
            From resume to interview-ready in six simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Number */}
              <div className="text-4xl font-bold text-brand-secondary/30 mb-4">
                {step.number}
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-2">
                {step.title}
              </h3>
              <p className="text-brand-secondary/80">
                {step.description}
              </p>

              {/* Connector line (except last) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 right-0 w-12 h-0.5 bg-white/10" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <button className="inline-flex items-center px-6 py-3 text-base font-medium rounded-lg bg-brand-secondary text-white hover:bg-brand-secondary/90 transition-colors">
              Start Your Journey
              <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
