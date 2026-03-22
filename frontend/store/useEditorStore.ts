import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeOption = 'default' | 'dark' | 'forest' | 'neutral';
export type ResolutionOption = '720p' | '1080p' | 'custom';
export type SpeedOption = 0.5 | 1 | 2;
export type AppTheme = 'dark' | 'light';
export type ExportFormat = 'gif' | 'svg' | 'png';

interface EditorState {
  // ── Editor ────────────────────────────────────────────────────────────────
  mermaidCode: string;
  editorCollapsed: boolean;

  // ── App theme (chrome) ────────────────────────────────────────────────────
  appTheme: AppTheme;

  // ── Export settings ───────────────────────────────────────────────────────
  theme: ThemeOption;
  resolution: ResolutionOption;
  customWidth: number;
  customHeight: number;
  exportFormat: ExportFormat;

  // ── Preview ───────────────────────────────────────────────────────────────
  zoom: number;

  // ── Step-through visualiser ───────────────────────────────────────────────
  stepMode: boolean;
  stepIndex: number; // -1 = nothing revealed yet
  stepTotal: number;
  playbackSpeed: SpeedOption;

  // ── Generation status ─────────────────────────────────────────────────────
  isGenerating: boolean;
  progress: number;
  progressLabel: string;
  gifDataUrl: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  setMermaidCode: (code: string) => void;
  setEditorCollapsed: (collapsed: boolean) => void;
  setAppTheme: (theme: AppTheme) => void;
  toggleAppTheme: () => void;
  setTheme: (theme: ThemeOption) => void;
  setResolution: (resolution: ResolutionOption) => void;
  setCustomWidth: (w: number) => void;
  setCustomHeight: (h: number) => void;
  setExportFormat: (format: ExportFormat) => void;
  setZoom: (zoom: number) => void;
  setStepMode: (on: boolean) => void;
  setStepIndex: (index: number) => void;
  setStepTotal: (total: number) => void;
  stepNext: () => void;
  stepPrev: () => void;
  stepReset: () => void;
  setPlaybackSpeed: (speed: SpeedOption) => void;
  setIsGenerating: (generating: boolean) => void;
  setProgress: (progress: number) => void;
  setProgressLabel: (label: string) => void;
  setGifDataUrl: (url: string | null) => void;
}

const DEFAULT_CODE = `sequenceDiagram
    participant A as Alice
    participant B as Bob
    participant C as Charlie

    A->>B: Hello Bob, how are you?
    B-->>A: Great, thanks for asking!
    A->>C: Hey Charlie, join us?
    C-->>A: On my way!
    B->>C: Welcome to the chat!
    C-->>B: Happy to be here 🎉`;

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      mermaidCode: DEFAULT_CODE,
      editorCollapsed: false,
      appTheme: 'dark',
      theme: 'default',
      resolution: '720p',
      customWidth: 1280,
      customHeight: 720,
      exportFormat: 'gif',
      zoom: 1,
      stepMode: false,
      stepIndex: -1,
      stepTotal: 0,
      playbackSpeed: 1,
      isGenerating: false,
      progress: 0,
      progressLabel: '',
      gifDataUrl: null,

      setMermaidCode: (mermaidCode) => set({ mermaidCode }),
      setEditorCollapsed: (editorCollapsed) => set({ editorCollapsed }),
      setAppTheme: (appTheme) => set({ appTheme }),
      toggleAppTheme: () => set((s) => ({ appTheme: s.appTheme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
      setResolution: (resolution) => set({ resolution }),
      setCustomWidth: (customWidth) => set({ customWidth }),
      setCustomHeight: (customHeight) => set({ customHeight }),
      setExportFormat: (exportFormat) => set({ exportFormat }),
      setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(3, zoom)) }),
      setStepMode: (stepMode) => set({ stepMode, stepIndex: 0 }),
      setStepIndex: (stepIndex) => set({ stepIndex }),
      setStepTotal: (stepTotal) => set({ stepTotal }),
      stepNext: () =>
        set((s) => ({ stepIndex: Math.min(s.stepIndex + 1, s.stepTotal - 1) })),
      stepPrev: () =>
        set((s) => ({ stepIndex: Math.max(s.stepIndex - 1, 0) })),
      stepReset: () => set({ stepIndex: 0 }),
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setProgress: (progress) => set({ progress }),
      setProgressLabel: (progressLabel) => set({ progressLabel }),
      setGifDataUrl: (gifDataUrl) =>
        set((state) => {
          if (
            state.gifDataUrl?.startsWith('blob:') &&
            typeof URL !== 'undefined'
          ) {
            URL.revokeObjectURL(state.gifDataUrl);
          }
          return { gifDataUrl };
        }),
    }),
    {
      name: 'mermaidflow-editor',
      partialize: (state) => ({
        mermaidCode: state.mermaidCode,
        editorCollapsed: state.editorCollapsed,
        appTheme: state.appTheme,
        theme: state.theme,
        resolution: state.resolution,
        customWidth: state.customWidth,
        customHeight: state.customHeight,
        exportFormat: state.exportFormat,
      }),
    }
  )
);
