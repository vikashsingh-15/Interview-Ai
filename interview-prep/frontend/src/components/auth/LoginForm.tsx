'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
export function LoginForm() {
  const [ready,setReady]=useState(false);
  const [message,setMessage]=useState('Checking Google sign-in...');
  const [retry,setRetry]=useState(0);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setReady(false);setFailed(false);setMessage('Checking Google sign-in...');
    const loginFailed=new URLSearchParams(window.location.search).has('error');
    api.get('/auth/providers',{timeout:15000,signal:controller.signal}).then(r=>{
      if(!active)return;
      setReady(Boolean(r.data.data.google));
      if(!r.data.data.google){setMessage('Google sign-in is currently unavailable. Please try again later.');setFailed(true);}
      else setMessage(loginFailed ? 'Google sign-in failed. Please try again.' : 'Your account is created automatically on first Google sign-in.');
    }).catch(()=>{if(active){setMessage('Cannot reach the sign-in service. Please try again.');setFailed(true);}});
    return ()=>{active=false;controller.abort();};
  },[retry]);
  return <div className="space-y-4"><Button className="w-full" disabled={!ready} onClick={()=>{ const mobile=(window as typeof window & {JobPrepAndroid?:{startGoogleSignIn:()=>void}}).JobPrepAndroid; if(mobile) mobile.startGoogleSignIn(); else window.location.assign('/api/auth/google'); }}>Continue with Google</Button><p role="status" className="text-sm text-gray-600">{message}</p>{failed && <button type="button" className="text-sm text-brand-secondary underline" onClick={()=>setRetry(n=>n+1)}>Retry</button>}</div>;
}
