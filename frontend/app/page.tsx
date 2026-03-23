'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Sun, Moon, Share2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { EditorPane } from '@/components/EditorPane';
import { PreviewPane } from '@/components/PreviewPane';
import { ExportSidebar, ExportSidebarRef } from '@/components/ExportSidebar';
import { DiagramLibrary } from '@/components/DiagramLibrary';
import { useEditorStore } from '@/store/useEditorStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { encodeShareUrl, decodeShareUrl } from '@/utils/shareUrl';

type MobileTab = 'editor' | 'preview' | 'export';

export default function HomePage() {
  const { editorCollapsed, setEditorCollapsed, appTheme, toggleAppTheme, mermaidCode, theme, setMermaidCode, setTheme, setResolution } = useEditorStore();
  const editorPanelRef = useRef<ImperativePanelHandle>(null);
  const exportRef = useRef<ExportSidebarRef>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');

  const triggerGenerate = useCallback(() => {
    exportRef.current?.generate();
  }, []);

  useKeyboardShortcuts(triggerGenerate);

  // ── Load diagram from URL params on first mount ─────────────────────────
  useEffect(() => {
    const shared = decodeShareUrl(window.location.search);
    if (shared) {
      setMermaidCode(shared.code);
      if (shared.theme) setTheme(shared.theme as 'default' | 'dark' | 'forest' | 'neutral');
      if (shared.resolution) setResolution(shared.resolution as '720p' | '1080p' | 'custom');
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname);
      toast.success('Diagram loaded from shared link');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply app theme class to <html> ─────────────────────────────────────
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', appTheme === 'dark');
    html.classList.toggle('light', appTheme === 'light');
  }, [appTheme]);

  const handleShare = () => {
    const url = encodeShareUrl({ code: mermaidCode, theme });
    navigator.clipboard.writeText(url).then(
      () => toast.success('Shareable link copied!'),
      () => toast.error('Failed to copy link'),
    );
  };

  const toggleEditor = () => {
    const panel = editorPanelRef.current;
    if (!panel) return;
    if (editorCollapsed) {
      panel.expand();
      panel.resize(38);
      setEditorCollapsed(false);
    } else {
      panel.collapse();
      setEditorCollapsed(true);
    }
  };

  const isDark = appTheme === 'dark';

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* ── App header ──────────────────────────────────────────────────── */}
      <header
        className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-2.5 shrink-0 z-10 border-b ${
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}
        role="banner"
      >
        {/* Logo mark */}
        <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-violet-600 shadow-lg shadow-violet-900/50 shrink-0">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"
            />
          </svg>
        </div>

        <div className="flex items-baseline gap-1 sm:gap-2 min-w-0">
          <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">
            <span className={isDark ? 'text-white' : 'text-gray-900'}>Mermaid</span>
            <span className="text-violet-500">Flow</span>
          </h1>
          <span className={`hidden lg:inline text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Mermaid.js → Animated GIF
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Shortcut hints — only desktop */}
        <span className={`hidden xl:inline text-[10px] font-mono tracking-wide ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          E step · Space play · ←→ navigate · ⌘↵ generate
        </span>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            onClick={() => setLibraryOpen(true)}
            title="Saved diagrams"
            aria-label="Open diagram library"
            className={`p-1.5 sm:p-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none ${
              isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <BookOpen size={16} className="sm:w-[17px] sm:h-[17px]" />
          </button>
          <button
            onClick={handleShare}
            title="Copy shareable link"
            aria-label="Copy shareable link"
            className={`p-1.5 sm:p-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none ${
              isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Share2 size={16} className="sm:w-[17px] sm:h-[17px]" />
          </button>
          <button
            onClick={toggleAppTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none ${
              isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {isDark ? <Sun size={16} className="sm:w-[17px] sm:h-[17px]" /> : <Moon size={16} className="sm:w-[17px] sm:h-[17px]" />}
          </button>
        </div>
      </header>

      {/* ── Mobile tab bar (md down) ─────────────────────────────────────── */}
      <nav
        className={`md:hidden flex border-b shrink-0 ${
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}
        role="tablist"
        aria-label="Mobile navigation"
      >
        {(['editor', 'preview', 'export'] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={mobileTab === tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              mobileTab === tab
                ? 'text-violet-500 border-b-2 border-violet-500'
                : isDark
                  ? 'text-gray-500 hover:text-gray-300'
                  : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* ── Main workspace — Desktop (md+) ───────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden min-h-0">
        <PanelGroup direction="horizontal" className="flex-1 min-w-0">
          <Panel
            ref={editorPanelRef}
            defaultSize={38}
            minSize={10}
            collapsible
            collapsedSize={0}
            onCollapse={() => setEditorCollapsed(true)}
            onExpand={() => setEditorCollapsed(false)}
          >
            <EditorPane onToggleCollapse={toggleEditor} />
          </Panel>

          <PanelResizeHandle className={`w-[3px] hover:bg-violet-500 active:bg-violet-400 transition-colors cursor-col-resize ${isDark ? 'bg-gray-700/60' : 'bg-gray-200'}`} />

          <Panel defaultSize={62} minSize={20}>
            <PreviewPane onExpandEditor={editorCollapsed ? toggleEditor : undefined} />
          </Panel>
        </PanelGroup>

        <ExportSidebar ref={exportRef} />
      </div>

      {/* ── Main workspace — Mobile (< md) ───────────────────────────────── */}
      <div className="md:hidden flex-1 overflow-hidden min-h-0">
        {mobileTab === 'editor' && <EditorPane />}
        {mobileTab === 'preview' && <PreviewPane />}
        {mobileTab === 'export' && (
          <div className="h-full overflow-y-auto">
            <ExportSidebar ref={exportRef} />
          </div>
        )}
      </div>

      {/* ── Diagram library modal ────────────────────────────────────────── */}
      <DiagramLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} />

      {/* ── Skip-to-content (a11y) ───────────────────────────────────────── */}
      <a
        href="#diagram-container"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:bg-violet-600 focus:text-white focus:px-4 focus:py-2"
      >
        Skip to diagram
      </a>
    </div>
  );
}
