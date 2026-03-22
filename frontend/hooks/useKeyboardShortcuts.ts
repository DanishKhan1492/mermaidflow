import { useEffect } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

/**
 * Global keyboard shortcuts for the app.
 *
 *   Space          — play / pause step animation
 *   ArrowRight     — next step
 *   ArrowLeft      — previous step
 *   E              — toggle step mode (eye)
 *   Ctrl/⌘ + Enter — generate GIF (calls the provided callback)
 *   +  / =         — zoom in
 *   -              — zoom out
 *   0              — reset zoom
 */
export function useKeyboardShortcuts(onGenerate: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't fire when typing in inputs / textareas / contenteditable
      const tag = (e.target as HTMLElement).tagName;
      const editable = (e.target as HTMLElement).isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return;

      // Don't hijack shortcuts when Monaco editor is focused
      const active = document.activeElement;
      if (active?.closest('.monaco-editor')) return;

      const state = useEditorStore.getState();

      switch (e.key) {
        case ' ': {
          // Space — play/pause (only in step mode)
          if (!state.stepMode) return;
          e.preventDefault();
          // Toggle play is handled by dispatching a custom event picked up by PreviewPane
          window.dispatchEvent(new CustomEvent('mf:toggle-play'));
          break;
        }
        case 'ArrowRight': {
          if (!state.stepMode) return;
          e.preventDefault();
          state.stepNext();
          break;
        }
        case 'ArrowLeft': {
          if (!state.stepMode) return;
          e.preventDefault();
          state.stepPrev();
          break;
        }
        case 'e':
        case 'E': {
          if (e.ctrlKey || e.metaKey) return; // don't steal Ctrl+E
          e.preventDefault();
          state.setStepMode(!state.stepMode);
          break;
        }
        case 'Enter': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (!state.isGenerating) onGenerate();
          }
          break;
        }
        case '+':
        case '=': {
          if (e.ctrlKey || e.metaKey) return; // browser zoom
          e.preventDefault();
          state.setZoom(state.zoom + 0.15);
          break;
        }
        case '-': {
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          state.setZoom(state.zoom - 0.15);
          break;
        }
        case '0': {
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          state.setZoom(1);
          break;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onGenerate]);
}
