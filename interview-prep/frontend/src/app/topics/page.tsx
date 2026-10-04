'use client';
import { PracticeScreen } from '@/components/features/PracticeScreen';
import { useAuth } from '@/components/providers/AuthProvider';
export default function TopicsPage() {
  const { user } = useAuth();
  return <PracticeScreen key={user?.id || 'anonymous'} />;
}
