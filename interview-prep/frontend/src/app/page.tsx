import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { HeroSection } from '@/components/features/HeroSection';
import { FeaturesSection } from '@/components/features/FeaturesSection';
import { HowItWorksSection } from '@/components/features/HowItWorksSection';
import { CTASection } from '@/components/features/CTASection';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* CTA Section */}
      <CTASection />

      {/* Auth Forms */}
      <section className="py-20 bg-brand-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-brand-primary">
              Get Started Today
            </h2>
            <p className="mt-4 text-lg text-brand-textSecondary">
              Join thousands of engineers who are improving their interview skills every day.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Sign In</CardTitle>
                <CardDescription>
                  Already have an account? Sign in to continue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LoginForm />
              </CardContent>
              <CardFooter className="flex justify-center">
                <p className="text-sm text-brand-textSecondary">
                  Don&apos;t have an account?{' '}
                  <Link href="#register" className="text-brand-secondary hover:underline">
                    Sign up
                  </Link>
                </p>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>
                  Start your personalized interview preparation journey.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RegisterForm />
              </CardContent>
              <CardFooter className="flex justify-center">
                <p className="text-sm text-brand-textSecondary">
                  Already have an account?{' '}
                  <Link href="#login" className="text-brand-secondary hover:underline">
                    Sign in
                  </Link>
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
