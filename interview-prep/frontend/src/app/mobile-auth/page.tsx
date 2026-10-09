'use client';

import { useEffect, useState } from 'react';

// The app opens this page in the website-origin WebView after system-browser
// Google sign-in. Fragments stay out of request logs and referral headers.
export default function MobileAuthPage() {
  const [message,setMessage]=useState('Finishing sign-in…');
  useEffect(()=>{
    const params=new URLSearchParams(window.location.hash.slice(1));
    const code=params.get('code');
    const verifier=params.get('verifier');
    window.history.replaceState(null,'','/mobile-auth');
    if(!code || !verifier){setMessage('Sign-in link is incomplete. Return to JobPrep and retry.');return;}
    void fetch('/api/auth/mobile/exchange',{
      method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
      body:JSON.stringify({code,verifier}),
    }).then(response=>{
      if(!response.ok)throw new Error('Handoff failed');
        window.location.replace('/dashboard');
    }).catch(()=>setMessage('Could not complete sign-in. Return to JobPrep and retry.'));
  },[]);
  return <main className="mx-auto max-w-md p-8" role="status">{message}</main>;
}
