import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Innovative CFO — Operations',
  description:
    'Lead capture, proposals, e-signature, payment, onboarding and recurring task management for accounting firms.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
