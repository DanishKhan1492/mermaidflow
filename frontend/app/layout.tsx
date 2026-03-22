import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MermaidFlow — Mermaid.js to Animated GIF',
  description:
    'Convert Mermaid.js diagrams into frame-by-frame animated GIFs with a single click. Share diagrams, export as GIF/SVG/PNG.',
  openGraph: {
    title: 'MermaidFlow — Mermaid.js to Animated GIF',
    description: 'Convert Mermaid.js diagrams into animated GIFs, SVGs, and PNGs. Step-through animation, shareable links, and more.',
    type: 'website',
    siteName: 'MermaidFlow',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MermaidFlow — Mermaid.js to Animated GIF',
    description: 'Convert Mermaid.js diagrams into animated GIFs with a single click.',
  },
  keywords: ['mermaid', 'diagram', 'gif', 'animation', 'flowchart', 'sequence diagram', 'svg', 'png'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
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
