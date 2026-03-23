'use client';

import { forwardRef, useCallback, useImperativeHandle, useState, useMemo } from 'react';
import { Download, Play, Settings2, Loader2, Clipboard, Check, Image, FileImage, FileType } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useEditorStore,
  ThemeOption,
  ResolutionOption,
  ExportFormat,
} from '@/store/useEditorStore';
import { estimateGifSize } from '@/utils/estimateGifSize';

const RESOLUTION_DIMS: Record<'720p' | '1080p', { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

const FORMAT_INFO: Record<ExportFormat, { label: string; icon: typeof Image; ext: string }> = {
  gif: { label: 'Animated GIF', icon: FileImage, ext: 'gif' },
  svg: { label: 'SVG Vector', icon: FileType, ext: 'svg' },
  png: { label: 'PNG Image', icon: Image, ext: 'png' },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${
        active
          ? 'bg-violet-600 text-white shadow-sm shadow-violet-900'
          : 'bg-gray-700/70 text-gray-300 hover:bg-gray-600 dark:bg-gray-700/70 dark:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

export interface ExportSidebarRef {
  generate: () => void;
}

export const ExportSidebar = forwardRef<ExportSidebarRef>(function ExportSidebar(_props, ref) {
  const [copied, setCopied] = useState(false);
  const {
    mermaidCode,
    theme,
    resolution,
    customWidth,
    customHeight,
    exportFormat,
    isGenerating,
    progress,
    progressLabel,
    gifDataUrl,
    setTheme,
    setResolution,
    setCustomWidth,
    setCustomHeight,
    setExportFormat,
    setIsGenerating,
    setProgress,
    setProgressLabel,
    setGifDataUrl,
  } = useEditorStore();

  const dims = resolution === 'custom'
    ? { width: customWidth, height: customHeight }
    : RESOLUTION_DIMS[resolution];

  const estimate = useMemo(
    () => estimateGifSize(mermaidCode, dims.width, dims.height),
    [mermaidCode, dims.width, dims.height],
  );

  const handleGenerate = useCallback(async () => {
    const { width, height } = dims;

    setIsGenerating(true);
    setGifDataUrl(null);
    setProgress(0);
    setProgressLabel('Starting…');

    if (exportFormat === 'svg' || exportFormat === 'png') {
      // Static export — no SSE needed
      try {
        const response = await fetch('/api/export-static', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mermaidCode, width, height, theme, format: exportFormat }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error((payload as { error?: string }).error ?? `Server error ${response.status}`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setProgress(100);
        setProgressLabel('Done!');
        setGifDataUrl(objectUrl);
        toast.success(`${exportFormat.toUpperCase()} exported!`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Export failed');
        setProgress(0);
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // GIF — use SSE for real-time progress
    try {
      const response = await fetch('/api/generate-gif', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ mermaidCode, width, height, theme }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? `Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const eventStr of events) {
          const lines = eventStr.split('\n');
          let eventType = '';
          let eventData = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            if (line.startsWith('data: ')) eventData = line.slice(6);
          }
          if (!eventType || !eventData) continue;

          try {
            const data = JSON.parse(eventData);
            if (eventType === 'progress') {
              setProgress(data.progress);
              setProgressLabel(data.label ?? '');
            } else if (eventType === 'complete') {
              setProgress(100);
              setProgressLabel('Done!');
              setGifDataUrl(data.gif);
              toast.success('GIF generated!');
            } else if (eventType === 'error') {
              throw new Error(data.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate GIF';
      toast.error(msg);
      setProgress(0);
    } finally {
      setIsGenerating(false);
    }
  }, [mermaidCode, theme, resolution, customWidth, customHeight, exportFormat, dims, setIsGenerating, setGifDataUrl, setProgress, setProgressLabel]);

  useImperativeHandle(ref, () => ({ generate: handleGenerate }), [handleGenerate]);

  const handleCopyToClipboard = async () => {
    if (!gifDataUrl) return;
    try {
      const resp = await fetch(gifDataUrl);
      const blob = await resp.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy — try downloading instead');
    }
  };

  const handleDownload = () => {
    if (!gifDataUrl) return;
    const ext = FORMAT_INFO[exportFormat].ext;
    const a = document.createElement('a');
    a.href = gifDataUrl;
    a.download = `mermaidflow.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <aside className="flex flex-col h-full w-full md:w-72 md:min-w-[280px] bg-gray-900 md:border-l border-gray-700/60" role="complementary" aria-label="Export settings">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <Settings2 size={14} className="text-violet-400" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Export Settings
        </span>
      </div>

      {/* Settings scroll area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* Export Format */}
        <div>
          <SectionLabel>Format</SectionLabel>
          <div className="flex gap-2">
            {(['gif', 'svg', 'png'] as ExportFormat[]).map((f) => (
              <OptionButton key={f} active={exportFormat === f} onClick={() => setExportFormat(f)}>
                {f.toUpperCase()}
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <div>
          <SectionLabel>Resolution</SectionLabel>
          <div className="flex gap-2 mb-2">
            {(['720p', '1080p', 'custom'] as ResolutionOption[]).map((r) => (
              <OptionButton
                key={r}
                active={resolution === r}
                onClick={() => setResolution(r)}
              >
                {r === 'custom' ? 'Custom' : r}
              </OptionButton>
            ))}
          </div>

          {resolution === 'custom' && (
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                value={customWidth}
                min={320}
                max={3840}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                className="flex-1 bg-gray-700 text-gray-200 text-sm rounded px-2.5 py-1.5 border border-gray-600 focus:outline-none focus:border-violet-500"
                placeholder="Width px"
                aria-label="Custom width"
              />
              <span className="self-center text-gray-500 text-sm">×</span>
              <input
                type="number"
                value={customHeight}
                min={240}
                max={2160}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                className="flex-1 bg-gray-700 text-gray-200 text-sm rounded px-2.5 py-1.5 border border-gray-600 focus:outline-none focus:border-violet-500"
                placeholder="Height px"
                aria-label="Custom height"
              />
            </div>
          )}
        </div>

        {/* Theme */}
        <div>
          <SectionLabel>Diagram Theme</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(['default', 'dark', 'forest', 'neutral'] as ThemeOption[]).map((t) => (
              <OptionButton key={t} active={theme === t} onClick={() => setTheme(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Size estimate (GIF only) */}
        {exportFormat === 'gif' && (
          <div className="px-3 py-2.5 rounded-lg bg-gray-800/60 border border-gray-700/40">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Estimated Output</p>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{estimate.frames} frames</span>
              <span className="font-medium text-gray-300">{estimate.label}</span>
            </div>
          </div>
        )}
      </div>

      {/* Generate + result area */}
      <div className="p-3 sm:p-4 border-t border-gray-700 space-y-3 shrink-0">
        {/* Progress bar */}
        {isGenerating && (
          <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Export progress">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span className="truncate mr-2">{progressLabel || 'Processing…'}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-lg shadow-violet-900/30"
          aria-label={`Generate ${exportFormat.toUpperCase()}`}
        >
          {isGenerating ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Play size={15} />
              Export {exportFormat.toUpperCase()}
            </>
          )}
        </button>

        {/* Result */}
        {gifDataUrl && (
          <div className="space-y-2 pt-1">
            {exportFormat === 'gif' && (
              <img
                src={gifDataUrl}
                alt="Generated animated GIF"
                className="w-full rounded-lg border border-gray-700 bg-gray-800"
              />
            )}
            {exportFormat === 'png' && (
              <img
                src={gifDataUrl}
                alt="Exported PNG"
                className="w-full rounded-lg border border-gray-700 bg-gray-800"
              />
            )}
            {exportFormat === 'svg' && (
              <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-gray-800/60 border border-gray-700/40 text-sm text-gray-300">
                <FileType size={16} className="text-violet-400" />
                SVG ready for download
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm transition-colors"
                aria-label={`Download ${exportFormat.toUpperCase()}`}
              >
                <Download size={15} />
                Download
              </button>
              {exportFormat !== 'svg' && (
                <button
                  onClick={handleCopyToClipboard}
                  title="Copy to clipboard"
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold text-sm transition-colors"
                  aria-label="Copy to clipboard"
                >
                  {copied ? <Check size={15} className="text-emerald-400" /> : <Clipboard size={15} />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
});
