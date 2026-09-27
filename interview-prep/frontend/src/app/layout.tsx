import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Interview Prep - Personalized SDE Interview Coaching",
  description: "AI-powered personalized interview preparation platform for software engineers. Practice system design, coding, and technical questions tailored to your profile.",
  keywords: ["interview", "SDE", "system design", "coding", "preparation", "technical interview"],
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
      <body className={`${inter.className} h-full min-h-screen flex flex-col`}>
        <AuthProvider>
          <ToastProvider>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
