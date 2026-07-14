import type { Metadata, Viewport } from 'next';
import { Inter, Space_Mono, JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GlobalListener } from '../components/GlobalListener';
import { ToastContainer } from '../components/ui/ToastContainer';
import { OfflineBanner } from '../components/OfflineBanner';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-space-mono',
  weight: ['400', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: "Pulsar — Direct P2P Chat",
  description: "Signal travels. No server needed. A serverless peer-to-peer real-time chat Progressive Web App.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pulsar",
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
        className={`${inter.variable} ${spaceMono.variable} ${jetbrainsMono.variable} antialiased bg-bg-primary text-text-primary`}
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
