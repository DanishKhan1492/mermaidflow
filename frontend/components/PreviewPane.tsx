'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Eye, EyeOff, PanelLeftOpen, Play, Pause, Gauge, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEditorStore, SpeedOption } from '@/store/useEditorStore';
import { useMermaidRenderer } from '@/hooks/useMermaidRenderer';

// ── Parse mermaid code into progressive rendering steps ──────────────────

function parseMermaidSteps(code: string): string[] {
  const lines = code.split('\n');
  const firstContent = lines.find((l) => l.trim().length > 0)?.trim() ?? '';

  // ── Sequence diagram ──
  if (firstContent.startsWith('sequenceDiagram')) {
    const headerIdx = lines.findIndex((l) => l.trim().startsWith('sequenceDiagram'));
    if (headerIdx === -1) return [code];
    const header = lines[headerIdx];
    const declarations: string[] = [];
    const actions: string[] = [];

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.length === 0 || t.startsWith('%%')) continue;
      if (t.startsWith('participant') || t.startsWith('actor')) {
        declarations.push(lines[i]);
      } else {
        actions.push(lines[i]);
      }
    }

    const declBlock = declarations.join('\n');
    // Step 0: header only (empty diagram)
    const steps: string[] = [header];

    // Step 1: participants visible
    if (declarations.length > 0) {
      steps.push(header + '\n' + declBlock);
    }

    // Each action adds a cumulative step
    for (let i = 0; i < actions.length; i++) {
      steps.push(
        header + '\n' + declBlock + '\n' + actions.slice(0, i + 1).join('\n'),
      );
    }

    return steps;
  }

  // ── Flowchart / graph ──
  if (/^(flowchart|graph)\b/i.test(firstContent)) {
    const headerIdx = lines.findIndex((l) => /^\s*(flowchart|graph)\b/i.test(l));
    if (headerIdx === -1) return [code];
    const header = lines[headerIdx];
    const content: string[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.length === 0 || t.startsWith('%%')) continue;
      content.push(lines[i]);
    }
    // Step 0: header only (empty diagram)
    const steps: string[] = [header];
    for (let i = 0; i < content.length; i++) {
      steps.push(header + '\n' + content.slice(0, i + 1).join('\n'));
    }
    return steps;
  }

  // ── Generic fallback: one line at a time ──
  const headerIdx = lines.findIndex((l) => l.trim().length > 0);
  if (headerIdx === -1) return [code];
  const header = lines[headerIdx];
  const content: string[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length === 0 || t.startsWith('%%')) continue;
    content.push(lines[i]);
  }
  if (content.length === 0) return [code];
  // Step 0: header only (empty diagram)
  const steps: string[] = [header];
  for (let i = 0; i < content.length; i++) {
    steps.push(header + '\n' + content.slice(0, i + 1).join('\n'));
  }
  return steps;
}

// ─────────────────────────────────────────────────────────────────────────────

interface PreviewPaneProps {
  onExpandEditor?: () => void;
}

export function PreviewPane({ onExpandEditor }: PreviewPaneProps) {
  const {
    mermaidCode, theme, zoom, setZoom,
    stepMode, stepIndex, stepTotal,
    setStepMode, setStepTotal, stepNext, stepPrev, stepReset,
    playbackSpeed, setPlaybackSpeed,
  } = useEditorStore();
  const { svg, error } = useMermaidRenderer(mermaidCode, theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(true);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Pre-rendered step SVGs ─────────────────────────────────────────────
  const steps = useMemo(() => parseMermaidSteps(mermaidCode), [mermaidCode]);
  const [stepSvgs, setStepSvgs] = useState<string[]>([]);
  const [prerendering, setPrerendering] = useState(false);

  // Pre-render every step when entering step mode (or when code/theme changes while in step mode)
  useEffect(() => {
    if (!stepMode) {
      setStepSvgs([]);
      setPrerendering(false);
      return;
    }

    let cancelled = false;
    setPrerendering(true);

    (async () => {
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: theme as Parameters<typeof mermaid.initialize>[0]['theme'],
          securityLevel: 'strict',
          sequence: { useMaxWidth: true },
          flowchart: { useMaxWidth: true },
        });

        const rawSvgs: string[] = [];
        for (let i = 0; i < steps.length; i++) {
          if (cancelled) return;
          const id = `mf-step-${i}-${Date.now()}`;
          try {
            const { svg: rendered } = await mermaid.render(id, steps[i]);
            rawSvgs.push(rendered);
          } catch {
            // On failure, push empty for step 0 (header-only), or reuse previous
            rawSvgs.push(rawSvgs.length > 0 ? rawSvgs[rawSvgs.length - 1] : '');
          }
        }

        if (cancelled) return;

        // Deduplicate consecutive identical SVGs so every step produces a
        // visible change.  We strip mermaid-generated ids from the SVG before
        // comparing to avoid false negatives from auto-incremented ids.
        const normalize = (s: string) => s.replace(/id="[^"]*"/g, '').replace(/mermaid-\d+/g, '');
        const deduped: string[] = [];
        for (const s of rawSvgs) {
          if (deduped.length === 0 || normalize(s) !== normalize(deduped[deduped.length - 1])) {
            deduped.push(s);
          }
        }

        setStepSvgs(deduped);
        setStepTotal(deduped.length);
        setPrerendering(false);
      } catch {
        if (!cancelled) {
          setPrerendering(false);
          toast.error('Failed to prepare step animation');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [stepMode, steps, theme, setStepTotal]);

  // Show toast on syntax errors
  useEffect(() => {
    if (error) {
      toast.error('Syntax error — check the editor', {
        id: 'mermaid-syntax-error',
        duration: 3000,
      });
    }
  }, [error]);

  // ── Auto-play animation timer ──────────────────────────────────────────
  useEffect(() => {
    if (playing && stepMode) {
      const interval = 1200 / playbackSpeed;
      playTimerRef.current = setInterval(() => {
        const state = useEditorStore.getState();
        if (state.stepIndex >= state.stepTotal - 1) {
          if (looping) {
            state.stepReset();
          } else {
            setPlaying(false);
          }
        } else {
          state.stepNext();
        }
      }, interval);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [playing, stepMode, playbackSpeed, looping]);

  // Stop playing when step mode is turned off
  useEffect(() => {
    if (!stepMode) setPlaying(false);
  }, [stepMode]);

  const togglePlay = () => {
    if (!stepMode) return;
    const state = useEditorStore.getState();
    if (state.stepIndex >= state.stepTotal - 1) {
      stepReset();
    }
    setPlaying((p) => !p);
  };

  // ── Determine which SVG to display ─────────────────────────────────────
  const displaySvg = (() => {
    if (!stepMode) return svg;                // full render
    if (stepSvgs[stepIndex]) return stepSvgs[stepIndex];
    return '';                                // still pre-rendering
  })();

  // ── Listen for keyboard toggle-play event ───────────────────────────
  useEffect(() => {
    const handler = () => togglePlay();
    window.addEventListener('mf:toggle-play', handler);
    return () => window.removeEventListener('mf:toggle-play', handler);
  });

  const zoomIn = useCallback(() => setZoom(zoom + 0.15), [zoom, setZoom]);
  const zoomOut = useCallback(() => setZoom(zoom - 0.15), [zoom, setZoom]);
  const zoomReset = useCallback(() => setZoom(1), [setZoom]);

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Pane header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 border-b border-gray-700 shrink-0">
        {/* Show editor button — placed BEFORE the label so it's on the left */}
        {onExpandEditor && (
          <button
            onClick={onExpandEditor}
            title="Show editor"
            aria-label="Show editor"
            className="p-2 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}

        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Live Preview
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Step-through toggle */}
          <button
            onClick={() => { setStepMode(!stepMode); stepReset(); setPlaying(false); }}
            title={stepMode ? 'Exit step mode (E)' : 'Enter step mode (E)'}
            aria-label={stepMode ? 'Exit step mode' : 'Enter step mode'}
            aria-pressed={stepMode}
            className={`p-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none ${
              stepMode
                ? 'bg-violet-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            {stepMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>

          {/* Play/Pause — only visible in step mode */}
          {stepMode && (
            <button
              onClick={togglePlay}
              title={playing ? 'Pause animation' : 'Play animation'}
              className={`p-2 rounded transition-colors ${
                playing
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}

          <div className="w-px h-5 bg-gray-700 mx-1" />

          {/* Zoom controls */}
          <button onClick={zoomOut} title="Zoom out (-)" aria-label="Zoom out" className="p-2 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            <ZoomOut size={18} />
          </button>
          <span className="text-sm text-gray-500 min-w-[3.5rem] text-center tabular-nums" aria-label={`Zoom ${Math.round(zoom * 100)}%`}>{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} title="Zoom in (+)" aria-label="Zoom in" className="p-2 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            <ZoomIn size={18} />
          </button>
          <button onClick={zoomReset} title="Reset zoom (0)" aria-label="Reset zoom" className="p-2 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Step controls bar */}
      {stepMode && (
        <div className="flex items-center justify-center gap-3 px-4 py-2.5 bg-gray-900 border-b border-gray-700/60 shrink-0">
          <button
            onClick={() => { setPlaying(false); stepPrev(); }}
            disabled={stepIndex <= 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="text-sm text-gray-400 tabular-nums min-w-[5rem] text-center" role="status" aria-live="polite">
            {stepIndex + 1} / {stepTotal}
          </span>
          <button
            onClick={() => { setPlaying(false); stepNext(); }}
            disabled={stepIndex >= stepTotal - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight size={15} />
          </button>

          <div className="w-px h-5 bg-gray-700/60 mx-1" />

          {/* Speed control */}
          <div className="flex items-center gap-1">
            <Gauge size={14} className="text-gray-500" />
            {([0.5, 1, 2] as SpeedOption[]).map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  playbackSpeed === s
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                }`}
                aria-label={`Speed ${s}x`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Loop toggle */}
          <button
            onClick={() => setLooping(!looping)}
            title={looping ? 'Looping (click to stop at end)' : 'Stop at end (click to loop)'}
            aria-label={looping ? 'Disable loop' : 'Enable loop'}
            aria-pressed={looping}
            className={`p-1.5 rounded transition-colors ${
              looping
                ? 'text-violet-400 bg-violet-600/20'
                : 'text-gray-500 hover:text-gray-300 bg-gray-700/40'
            }`}
          >
            <Repeat size={14} />
          </button>
        </div>
      )}

      {/* Diagram viewport */}
      <div
        id="diagram-container"
        className="flex-1 overflow-auto p-6"
      >
        {error && !stepMode ? (
          <div className="text-red-400 text-sm bg-red-950/40 rounded-xl p-5 border border-red-800/60 max-w-lg w-full">
            <p className="font-semibold mb-2">Syntax Error</p>
            <pre className="font-mono text-xs whitespace-pre-wrap break-words opacity-80">
              {error}
            </pre>
          </div>
        ) : displaySvg ? (
          <div
            ref={containerRef}
            className="inline-block transition-transform duration-150"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            dangerouslySetInnerHTML={{ __html: displaySvg }}
          />
        ) : stepMode && prerendering ? (
          <div className="flex flex-col items-center gap-3 text-gray-500 mt-16">
            <svg
              className="w-8 h-8 opacity-40 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span className="text-sm">Preparing steps…</span>
          </div>
        ) : stepMode && !prerendering ? (
          <div className="flex flex-col items-center gap-3 text-gray-500 mt-16">
            <span className="text-sm">Press <strong>Next</strong> or <strong>Play</strong> to begin</span>
          </div>
        ) : svg ? (
          <div
            ref={containerRef}
            className="inline-block transition-transform duration-150"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-gray-600">
            <svg
              className="w-10 h-10 opacity-30 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span className="text-sm">Rendering diagram…</span>
          </div>
        )}
      </div>
    </div>
  );
}
