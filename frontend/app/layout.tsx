import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VPP 3D Orchestrator',
  description: 'Real-time 3D Virtual Power Plant Simulation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
