import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { Header } from "@/components/layout/Header";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ClientErrorMonitor } from "@/components/providers/ClientErrorMonitor";


export const metadata: Metadata = {
  title: "Interview Prep - Resume-driven Personal Coaching",
  description: "Personalized interview practice for your resume, professional background and chosen goals.",
  keywords: ["interview", "resume", "system design", "coding", "preparation", "technical interview"],
  authors: [{ name: "Interview Prep" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="font-sans h-full min-h-screen flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: `(()=>{let n=0;const send=e=>{if(n++>=10)return;try{const body=JSON.stringify({...e,page:location.pathname});const blob=new Blob([body],{type:'application/json'});if(!navigator.sendBeacon('/api/client-errors',blob))fetch('/api/client-errors',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{})}catch{}};window.__interviewPrepErrorBoot=true;addEventListener('error',e=>send({category:'window_error',message:e.message||e.error?.message||'Uncaught browser error',stack:e.error?.stack,filename:e.filename,line:e.lineno,column:e.colno}));addEventListener('unhandledrejection',e=>send({category:'unhandled_rejection',message:e.reason instanceof Error?e.reason.message:String(e.reason??'Unhandled promise rejection'),stack:e.reason instanceof Error?e.reason.stack:undefined}))})()` }} />
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('interview-prep-theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}" }} />
        <ThemeProvider><AuthProvider><ToastProvider><ClientErrorMonitor /><Header /><main className="flex-1">{children}</main></ToastProvider></AuthProvider></ThemeProvider>
      </body>
    </html>
  );
}
