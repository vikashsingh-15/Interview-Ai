'use client';

import { Toaster } from 'react-hot-toast';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f172a',
            color: 'white',
            borderRadius: '0.5rem',
            padding: '1rem',
          },
        }}
      />
      {children}
    </>
  );
}
