import withPWA from '@ducanh2912/next-pwa';

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
  // Allow the app to be accessed from any host (required for LAN mode)
  // Without this, Next.js blocks requests from non-localhost origins
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  navigateFallback: '/offline',
  navigateFallbackAllowlist: [/^(?!\/__).*/],
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /\/api\/signal\/.*/i,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'quark-pages',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 32, maxAgeSeconds: 2592000 },
        },
      },
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'quark-static-assets',
          expiration: { maxEntries: 200, maxAgeSeconds: 31536000 },
        },
      },
      {
        urlPattern: /\.(?:woff|woff2|ttf|otf)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'quark-fonts',
          expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|ico|webp)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'quark-images',
          expiration: { maxEntries: 60, maxAgeSeconds: 2592000 },
        },
      },
    ],
  },
});

export default pwaConfig(nextConfig);
