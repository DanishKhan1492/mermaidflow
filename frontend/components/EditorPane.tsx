'use client';

import { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { editor } from 'monaco-editor';
import { PanelLeftClose, PanelLeftOpen, FileCode2, ChevronDown, Undo2, Redo2, Upload, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEditorStore } from '@/store/useEditorStore';
import { DIAGRAM_TEMPLATES } from '@/data/templates';

// Monaco Editor is browser-only; disable SSR to avoid hydration issues
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((m) => m.default),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

function EditorSkeleton() {
  return (
    <div className="flex-1 bg-[#1e1e1e] animate-pulse" aria-label="Loading editor…" />
  );
}

interface EditorPaneProps {
  onToggleCollapse?: () => void;
}

export function EditorPane({ onToggleCollapse }: EditorPaneProps) {
  const { mermaidCode, editorCollapsed, setMermaidCode } = useEditorStore();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount = useCallback((ed: editor.IStandaloneCodeEditor) => {
    editorRef.current = ed;
  }, []);

  const handleUndo = () => editorRef.current?.trigger('keyboard', 'undo', null);
  const handleRedo = () => editorRef.current?.trigger('keyboard', 'redo', null);

  // ── Drag-and-drop .mmd file ──────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.match(/\.(mmd|mermaid|md|txt)$/i)) {
      toast.error('Drop a .mmd, .mermaid, .md, or .txt file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setMermaidCode(text);
      toast.success(`Loaded ${file.name}`);
    };
    reader.onerror = () => toast.error('Failed to read file');
    reader.readAsText(file);
  }, [setMermaidCode]);

  // ── Export as .mmd ─────────────────────────────────────────────────────────
  const handleExportMmd = () => {
    const blob = new Blob([mermaidCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.mmd';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── File picker ────────────────────────────────────────────────────────────
  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mmd,.mermaid,.md,.txt';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setMermaidCode(reader.result as string);
        toast.success(`Loaded ${file.name}`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div
      className={`flex flex-col h-full bg-[#1e1e1e] relative ${dragOver ? 'ring-2 ring-violet-500 ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-30 bg-violet-600/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="px-6 py-4 rounded-xl bg-gray-900/90 border-2 border-dashed border-violet-500 text-violet-300 text-sm font-medium">
            Drop .mmd file to load
          </div>
        </div>
      )}

      {/* Pane header */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0 overflow-x-auto">
        <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
        <span className="text-[10px] sm:text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap shrink-0">
          Mermaid Code
        </span>

        {/* Template picker */}
        <div className="relative ml-1 sm:ml-2 shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setTemplateOpen((o) => !o)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-xs font-medium bg-gray-700/70 text-gray-300 hover:bg-gray-600 hover:text-gray-100 transition-colors"
            aria-label="Choose template"
            aria-expanded={templateOpen}
          >
            <FileCode2 size={12} className="sm:w-[13px] sm:h-[13px]" />
            <span className="hidden xs:inline">Templates</span>
            <ChevronDown size={11} className={`transition-transform sm:w-3 sm:h-3 ${templateOpen ? 'rotate-180' : ''}`} />
          </button>

          {templateOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setTemplateOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 overflow-hidden" role="menu">
                {DIAGRAM_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    role="menuitem"
                    onClick={() => {
                      setMermaidCode(t.code);
                      setTemplateOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-violet-600/20 hover:text-white transition-colors text-left"
                  >
                    <span className="text-base leading-none w-5 text-center">{t.icon}</span>
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 ml-0.5 sm:ml-1 shrink-0">
          <button onClick={handleUndo} title="Undo (Ctrl+Z)" className="p-1 sm:p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors" aria-label="Undo">
            <Undo2 size={13} className="sm:w-[14px] sm:h-[14px]" />
          </button>
          <button onClick={handleRedo} title="Redo (Ctrl+Shift+Z)" className="p-1 sm:p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors" aria-label="Redo">
            <Redo2 size={13} className="sm:w-[14px] sm:h-[14px]" />
          </button>
        </div>

        {/* Import / Export .mmd */}
        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          <button onClick={handleImportFile} title="Import .mmd file" className="p-1 sm:p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors" aria-label="Import file">
            <Upload size={13} className="sm:w-[14px] sm:h-[14px]" />
          </button>
          <button onClick={handleExportMmd} title="Export as .mmd" className="p-1 sm:p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors" aria-label="Export .mmd file">
            <Download size={13} className="sm:w-[14px] sm:h-[14px]" />
          </button>

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={editorCollapsed ? 'Expand editor' : 'Collapse editor'}
              className="p-2 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
              aria-label={editorCollapsed ? 'Expand editor' : 'Collapse editor'}
            >
              {editorCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language="markdown"
          value={mermaidCode}
          onChange={(val) => setMermaidCode(val ?? '')}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 16, bottom: 16 },
            renderLineHighlight: 'gutter',
            smoothScrolling: true,
            cursorSmoothCaretAnimation: 'on',
          }}
        />
      </div>
    </div>
  );
}
