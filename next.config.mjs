import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    navigateFallback: '/offline',
    navigateFallbackAllowlist: [/^(?!\/__).*/],
    runtimeCaching: [
      {
        // Live WebRTC signaling API routes must NEVER be cached
        urlPattern: /\/api\/signal\/.*/i,
        handler: 'NetworkOnly',
      },
      {
        // App shell / navigation requests
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'quark-pages',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        // Static JS/CSS chunks
        urlPattern: /\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'quark-static-assets',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        // Fonts
        urlPattern: /\.(?:woff|woff2|ttf|otf)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'quark-fonts',
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        // Icons & image assets
        urlPattern: /\.(?:png|jpg|jpeg|svg|ico|webp)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'quark-images',
          expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['ably'],
  },
};

export default withPWA(nextConfig);
