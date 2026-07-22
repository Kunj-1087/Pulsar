import type { Metadata, Viewport } from 'next';
import "./globals.css";
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GlobalListener } from '../components/GlobalListener';
import { ToastContainer } from '../components/ui/ToastContainer';
import { OfflineBanner } from '../components/OfflineBanner';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';
import UpdateToast from '../components/ui/UpdateToast';

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
  themeColor: '#000000',
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
      <body className="antialiased bg-black text-white font-sans">
        <ErrorBoundary>
          <OfflineBanner />
          {children}
          <GlobalListener />
          <PWAInstallPrompt />
          <ToastContainer />
          <UpdateToast />
        </ErrorBoundary>
      </body>
    </html>
  );
}
