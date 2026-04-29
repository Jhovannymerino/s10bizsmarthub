import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'S10 BizSmartHub',
  description: 'KPI financieros desde S10 ERP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
