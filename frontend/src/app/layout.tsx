import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'S10 BizSmartHub',
  description: 'KPI financieros desde S10 ERP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
      </head>
      <body style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
