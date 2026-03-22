import { useEffect, useRef, useState } from 'react';

interface RendererResult {
  svg: string;
  error: string | null;
}

let renderCounter = 0;

/**
 * Debounced Mermaid render loop.
 *
 * - Waits 500 ms after the last code/theme change before rendering.
 * - Uses dynamic import so mermaid is never bundled into the server render.
 * - Cleans up any orphaned render elements left by failed renders.
 */
export function useMermaidRenderer(code: string, theme: string): RendererResult {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (cancelledRef.current) return;

      try {
        // Dynamic import keeps mermaid out of the SSR bundle
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        if (cancelledRef.current) return;

        mermaid.initialize({
          startOnLoad: false,
          // Cast required: mermaid's theme type is a union string literal
          theme: theme as Parameters<typeof mermaid.initialize>[0]['theme'],
          securityLevel: 'strict',
          sequence: { useMaxWidth: true },
          flowchart: { useMaxWidth: true },
        });

        const id = `mf-preview-${++renderCounter}`;

        // Clean up any residual element from a previous failed render
        const stale = document.getElementById(id);
        if (stale) stale.remove();

        const { svg: renderedSvg } = await mermaid.render(id, code);

        if (cancelledRef.current) return;

        setSvg(renderedSvg);
        setError(null);
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
            ? err
            : 'Invalid Mermaid syntax';
        setError(msg);
      }
    }, 500);

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code, theme]);

  return { svg, error };
}
