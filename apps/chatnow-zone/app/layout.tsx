import type { ReactNode } from 'react';

export const metadata = {
  title: 'ChatNow.Zone',
  description: 'OmniQuest Media Inc. — adult performance platform.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          background: '#0b0b0d',
          color: '#f1f1f3',
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}
