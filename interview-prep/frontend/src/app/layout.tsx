import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { Header } from "@/components/layout/Header";
import { ThemeProvider } from "@/components/providers/ThemeProvider";


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
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('interview-prep-theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}" }} />
        <ThemeProvider><AuthProvider><ToastProvider><Header /><main className="flex-1">{children}</main></ToastProvider></AuthProvider></ThemeProvider>
      </body>
    </html>
  );
}
