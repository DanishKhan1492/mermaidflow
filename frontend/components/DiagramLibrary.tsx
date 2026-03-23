'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Star, Trash2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEditorStore } from '@/store/useEditorStore';
import {
  SavedDiagram,
  getAllDiagrams,
  saveDiagram,
  deleteDiagram,
  toggleFavorite,
} from '@/utils/diagramHistory';

interface DiagramLibraryProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  sequence: 'bg-blue-500/20 text-blue-400',
  flowchart: 'bg-emerald-500/20 text-emerald-400',
  class: 'bg-amber-500/20 text-amber-400',
  state: 'bg-purple-500/20 text-purple-400',
  er: 'bg-pink-500/20 text-pink-400',
  gantt: 'bg-cyan-500/20 text-cyan-400',
  other: 'bg-gray-500/20 text-gray-400',
};

export function DiagramLibrary({ open, onClose }: DiagramLibraryProps) {
  const { mermaidCode, setMermaidCode } = useEditorStore();
  const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  const refresh = async () => {
    try {
      const all = await getAllDiagrams();
      setDiagrams(all);
    } catch {
      // IndexedDB not available
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleSaveCurrent = async () => {
    try {
      await saveDiagram(mermaidCode);
      toast.success('Diagram saved!');
      refresh();
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDiagram(id);
    refresh();
  };

  const handleToggleFav = async (id: string) => {
    await toggleFavorite(id);
    refresh();
  };

  const handleLoad = (code: string) => {
    setMermaidCode(code);
    onClose();
    toast.success('Diagram loaded');
  };

  const filtered = filter === 'favorites' ? diagrams.filter((d) => d.favorite) : diagrams;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg h-[85vh] sm:h-auto sm:max-h-[80vh] bg-gray-900 border-t sm:border border-gray-700 rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Saved diagrams"
      >
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 border-b border-gray-700/60 shrink-0">
          <BookOpen size={16} className="text-violet-400 sm:w-[18px] sm:h-[18px] shrink-0" />
          <h2 className="text-xs sm:text-sm font-bold text-gray-200 uppercase tracking-wider flex-1">Saved Diagrams</h2>
          <button
            onClick={handleSaveCurrent}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors shrink-0"
            aria-label="Save current diagram"
          >
            <Save size={12} className="sm:w-[13px] sm:h-[13px]" /> Save
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors shrink-0" aria-label="Close library">
            <X size={18} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {(['all', 'favorites'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-violet-600/20 text-violet-300'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {f === 'all' ? 'All' : '★ Favorites'}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-600 self-center">{filtered.length} diagrams</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {filtered.length === 0 && (
            <p className="text-center text-gray-600 text-sm py-8">
              {filter === 'favorites' ? 'No favourites yet' : 'No saved diagrams — click Save Current to start'}
            </p>
          )}
          {filtered.map((d) => (
            <div
              key={d.id}
              className="group flex items-start gap-3 p-3 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors cursor-pointer"
              onClick={() => handleLoad(d.code)}
              role="button"
              tabIndex={0}
              aria-label={`Load ${d.name}`}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLoad(d.code); }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${TYPE_COLORS[d.type] ?? TYPE_COLORS.other}`}>
                    {d.type}
                  </span>
                  <span className="text-sm text-gray-200 truncate">{d.name}</span>
                </div>
                <p className="text-xs text-gray-500 font-mono truncate">{d.code.split('\n').slice(0, 2).join(' ')}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleFav(d.id); }}
                  className={`p-1.5 rounded transition-colors ${d.favorite ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400'}`}
                  aria-label={d.favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star size={14} fill={d.favorite ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                  className="p-1.5 rounded text-gray-600 hover:text-red-400 transition-colors"
                  aria-label="Delete diagram"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
