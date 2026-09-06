import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
 variable: "--font-geist-sans",
 subsets: ["latin"],
});

const geistMono = Geist_Mono({
 variable: "--font-geist-mono",
 subsets: ["latin"],
});

export const metadata: Metadata = {
 title: "Trace — The Provenance-First AI Content Engine",
 description:
  "Every AI-generated asset, provenance-tagged in one click. EU AI Act Article 50 compliant in under one second. Cryptographically-verifiable C2PA manifests.",
 keywords: [
  "C2PA",
  "AI provenance",
  "content authenticity",
  "EU AI Act",
  "Article 50",
  "AI content",
  "watermark",
  "manifest",
 ],
 authors: [{ name: "Trace" }],
 openGraph: {
  title: "Trace — The Provenance-First AI Content Engine",
  description:
   "Every AI-generated asset, provenance-tagged in one click. EU AI Act Article 50 compliant in under one second.",
  siteName: "Trace",
  type: "website",
 },
 twitter: {
  card: "summary_large_image",
  title: "Trace — The Provenance-First AI Content Engine",
  description:
   "Every AI-generated asset, provenance-tagged in one click. EU AI Act Article 50 compliant in under one second.",
 },
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
  <html lang="en" suppressHydrationWarning>
   <body
    className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
   >
    <ThemeProvider
     attribute="class"
     defaultTheme="light"
     enableSystem
     disableTransitionOnChange
    >
     {children}
     <Toaster />
    </ThemeProvider>
   </body>
  </html>
 );
}
