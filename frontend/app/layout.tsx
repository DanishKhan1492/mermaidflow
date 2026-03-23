import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const SITE_URL = 'https://mermaidflow.dnlabz.cloud';
const TITLE = 'MermaidFlow — Animate Mermaid Diagrams & Export as GIF';
const DESCRIPTION =
  'Free online tool to animate Mermaid.js diagrams step-by-step and export as animated GIF, SVG, or PNG. Live editor, shareable links, diagram library, and one-click export.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | MermaidFlow',
  },
  description: DESCRIPTION,
  applicationName: 'MermaidFlow',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  creator: 'MermaidFlow',
  publisher: 'MermaidFlow',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    type: 'website',
    siteName: 'MermaidFlow',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  keywords: [
    'mermaid diagram animator',
    'mermaid to gif',
    'animate mermaid diagram',
    'mermaid.js gif export',
    'mermaid diagram gif maker',
    'animated flowchart',
    'sequence diagram animation',
    'mermaid online editor',
    'diagram to gif converter',
    'mermaid live editor',
    'export mermaid as gif',
    'export mermaid as svg',
    'export mermaid as png',
    'flowchart animation tool',
    'animated diagram generator',
    'mermaid step by step animation',
    'mermaid diagram tool',
    'free diagram animator',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'MermaidFlow',
              url: SITE_URL,
              description: DESCRIPTION,
              applicationCategory: 'DesignApplication',
              operatingSystem: 'All',
              browserRequirements: 'Requires a modern web browser',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              featureList: [
                'Animate Mermaid.js diagrams step-by-step',
                'Export diagrams as animated GIF',
                'Export diagrams as SVG or PNG',
                'Live Monaco code editor with syntax highlighting',
                'Shareable diagram links',
                'Diagram library with favorites',
                'Pre-built Mermaid templates',
                'Light and dark mode',
                'Mobile responsive layout',
              ],
            }),
          }}
        />
      </head>
      <body className={`${inter.className} bg-gray-950 text-gray-100 dark:bg-gray-950 dark:text-gray-100`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#f3f4f6',
              border: '1px solid #374151',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#1f2937' } },
            error: { iconTheme: { primary: '#f87171', secondary: '#1f2937' } },
          }}
        />
      </body>
    </html>
  );
}
