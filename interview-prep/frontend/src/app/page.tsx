import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { LoginForm } from '@/components/auth/LoginForm';
import { HeroSection } from '@/components/features/HeroSection';
import { FeaturesSection } from '@/components/features/FeaturesSection';
import { HowItWorksSection } from '@/components/features/HowItWorksSection';
import { CTASection } from '@/components/features/CTASection';
export default function HomePage() {
  return <div className="min-h-screen"><HeroSection /><FeaturesSection /><HowItWorksSection /><CTASection />
    <section className="py-20 bg-brand-background"><div className="max-w-md mx-auto px-4">
      <Card><CardHeader><CardTitle>Get started with Google</CardTitle>
        <CardDescription>One sign-in for new and returning users. No separate password or registration form.</CardDescription>
      </CardHeader><CardContent><LoginForm /></CardContent></Card>
    </div></section>
  </div>;
}
