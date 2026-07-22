import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GlobalListener } from '../components/GlobalListener';
import { ToastContainer } from '../components/ui/ToastContainer';
import { OfflineBanner } from '../components/OfflineBanner';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';

// Display / Wordmark / Headings: JetBrains Mono
// Stronger geometric character than Space Mono, supports tabular numerals and stylistic sets.
// Use for wordmark, headings, timestamps, peer IDs, room codes, technical data.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
  display: 'swap',
});

// Body / UI Text: Inter
// Industry standard for interface text, excellent legibility at small sizes.
// Use for message text, buttons, form labels, tooltips, help text.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Quark — Chat without the middle",
  description: "Peer-to-peer chat and file sharing. End-to-end encrypted. No servers, no accounts, no trace. Works online, offline, and on any local network.",
  manifest: "/manifest.json",
  applicationName: "Quark",
  openGraph: {
    title: "Quark — Chat without the middle",
    description: "Peer-to-peer chat. Nothing in between.",
    type: "website",
  },
  twitter: {
    title: "Quark",
    description: "Peer-to-peer chat. Nothing in between.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Quark",
  },
};

export const viewport: Viewport = {
  themeColor: '#191919',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-bg-base text-fg-primary`}
      >
        <ErrorBoundary>
          <OfflineBanner />
          {children}
          <GlobalListener />
          <PWAInstallPrompt />
          <ToastContainer />
        </ErrorBoundary>
      </body>
    </html>
  );
}
