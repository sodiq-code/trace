import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trace — The Provenance-First AI Content Engine",
  description:
    "Every AI-generated creator asset, provenance-tagged in one click. EU AI Act Article 50 compliant in under one second.",
  keywords: ["c2pa", "provenance", "ai-content", "eu-ai-act", "compliance", "content-authenticity"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
