'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
export function LoginForm() {
  const [ready,setReady]=useState(false);
  const [message,setMessage]=useState('Checking Google sign-in...');
  useEffect(()=>{
    if(window.location.search.includes('error='))setMessage('Google sign-in failed. Retry or check configuration/account linking.');
    api.get('/auth/providers').then(r=>{
      setReady(Boolean(r.data.data.google));
      if(!r.data.data.google)setMessage('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the root .env or Render settings.');
      else if(!window.location.search)setMessage('Your account is created automatically on first Google sign-in.');
    }).catch(()=>setMessage('Cannot reach the API. Check BACKEND_API_URL and that the backend is running.'));
  },[]);
  return <div className="space-y-4"><Button className="w-full" disabled={!ready} onClick={()=>{ const mobile=(window as typeof window & {JobPrepAndroid?:{startGoogleSignIn:()=>void}}).JobPrepAndroid; if(mobile) mobile.startGoogleSignIn(); else window.location.assign('/api/auth/google'); }}>Continue with Google</Button><p role="status" className="text-sm text-gray-600">{message}</p></div>;
}
