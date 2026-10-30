import type { Metadata } from 'next';
import './globals.css';
import { FONT_IDS, GOOGLE_FONTS_HREF } from '@/lib/fonts';

export const metadata: Metadata = {
  title: "FinTracker",
  description: 'Live finance dashboard backed by Postgres.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-font="playfair" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('fintracker_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');var f=localStorage.getItem('fintracker_font');document.documentElement.setAttribute('data-font',${JSON.stringify(FONT_IDS)}.indexOf(f)>-1?f:'playfair')}catch(e){}`
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href={GOOGLE_FONTS_HREF}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
