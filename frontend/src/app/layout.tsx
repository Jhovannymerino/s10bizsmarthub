import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'S10 BizSmartHub',
  description: 'KPI financieros del Grupo desde S10 ERP',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BizSmartHub',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#050a12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Outfit:wght@100..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-inter: 'Inter', system-ui, -apple-system, sans-serif;
            --font-outfit: 'Outfit', system-ui, sans-serif;
            --font-mono: 'IBM Plex Mono', 'Courier New', monospace;
          }
        `}</style>
        {/* PWA: service worker registration */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(){});
            });
          }
        ` }} />
      </head>
      <body style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
