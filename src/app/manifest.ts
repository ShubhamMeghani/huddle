import type { MetadataRoute } from 'next';

/** Installable PWA manifest (R41). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Huddle: party games for your crew',
    short_name: 'Huddle',
    description: 'Game night for your crew. Everyone plays on their own phone.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff7ed',
    theme_color: '#6d28d9',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
