import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter_Tight } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dicatat | Smart Agreement Builder for Freelancers",
  description: "Buat SPK, kontrak, dan surat perjanjian kerja freelance secara otomatis, cepat, dan profesional.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900 font-sans">{children}</body>
    </html>
  );
}
