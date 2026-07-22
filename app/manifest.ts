import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quark',
    short_name: 'Quark',
    description: 'Serverless peer-to-peer chat and file sharing',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#E50914',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
