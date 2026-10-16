'use client';
import { PracticeScreen } from '@/components/features/PracticeScreen';
import { useAuth } from '@/components/providers/AuthProvider';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
export default function TopicsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <SignInPrompt pageName="topics" returnTo="/topics" isLoading />;
  if (!isAuthenticated) return <SignInPrompt pageName="topics" returnTo="/topics" />;
  return <PracticeScreen key={user?.id || 'anonymous'} />;
}
