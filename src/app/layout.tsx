import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorker } from '@/client/components/ServiceWorker';

export const metadata: Metadata = {
  title: 'Huddle',
  description: 'Party games for your crew. Everyone plays on their own phone.',
  applicationName: 'Huddle',
  appleWebApp: { capable: true, title: 'Huddle', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/favicon.png', sizes: '48x48', type: 'image/png' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // iOS "Add to Home Screen" (R41): Safari still reads the apple-prefixed tag.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fff7ed',
};

// Applies the stored theme before paint; light is the default whatever the OS prefers (R36).
const themeInit = `try{var t=localStorage.getItem('huddle-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <div className="app-shell">{children}</div>
        <ServiceWorker />
      </body>
    </html>
  );
}
