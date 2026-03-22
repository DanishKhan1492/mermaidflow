import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';
import { GeneratePayload } from '../middleware/validation';

// Cap concurrent Puppeteer instances to prevent CPU/memory spikes
const limit = pLimit(2);

export type ProgressCallback = (percent: number, label: string) => void;

// Cache the resolved mermaid.min.js path (stays constant at runtime)
let mermaidJsPath: string | null = null;

function getMermaidJsPath(): string {
  if (mermaidJsPath) return mermaidJsPath;
  mermaidJsPath = require.resolve('mermaid/dist/mermaid.min.js');
  return mermaidJsPath;
}

/**
 * Build a minimal HTML template that hosts the Mermaid renderer.
 * The mermaid.js bundle is injected by `page.addScriptTag()` after load,
 * so this template stays small and cache-friendly.
 */
function buildHtmlTemplate(width: number, height: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      background: white;
      overflow: hidden;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }
    #diagram-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #diagram-container svg {
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  <div id="diagram-container"></div>
</body>
</html>`;
}

/**
 * Selector strategy for identifying animatable elements per diagram type.
 * Returns the list in document order so they can be revealed sequentially.
 *
 * Priority:
 *   1. Sequence diagram messages/actors/notes
 *   2. Flowchart nodes and edges
 *   3. Generic: all <g> children of the SVG root (excluding <defs>)
 */
const ELEMENT_QUERY_STRATEGIES = [
  // Sequence diagram
  '.actor, .actor-man, .actor-woman, .messageLine0, .messageLine1, .messageText, .note, .noteText, .loopText, .labelText',
  // Flowchart / graph
  '.node, .edgePath, .edgeLabel, .cluster',
  // Class diagram
  '.classGroup, .relation',
  // State diagram
  '.stateGroup, .transition',
  // Gantt / pie / ER — fall through to generic
] as const;

// ── Parse mermaid code into progressive rendering steps ──────────────────
// Instead of rendering once and toggling CSS opacity on elements (which is
// fragile across mermaid versions), we re-render the diagram for each
// progressive step.  For sequence diagrams this means: participants first,
// then accumulating one message at a time.

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

async function captureFrames(
  payload: GeneratePayload,
  jobId: string,
  onProgress?: ProgressCallback,
): Promise<string[]> {
  const { mermaidCode, theme, width, height } = payload;
  const tmpDir = path.join('/tmp', jobId);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Resolve the executable path:
  //  - In Docker: use the env var pointing to system Chromium.
  //  - In local dev: call puppeteer.executablePath() which returns the exact
  //    path of the Puppeteer-managed Chrome, bypassing the internal validator
  //    that sometimes throws "Could not find Chrome" even when the binary exists.
  const resolvedExecPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? puppeteer.executablePath();

  const isDocker = !!process.env.PUPPETEER_EXECUTABLE_PATH;

  const browser = await puppeteer.launch({
    executablePath: resolvedExecPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      // --no-zygote and --single-process are Linux/Docker-only flags.
      // On macOS they cause Chrome to crash silently, producing a 500 with no logs.
      ...(isDocker ? ['--no-zygote', '--single-process'] : []),
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    // Load the bare HTML container
    await page.setContent(buildHtmlTemplate(width, height), {
      waitUntil: 'domcontentloaded',
    });

    // Inject mermaid.js from local node_modules (no network dependency)
    await page.addScriptTag({ path: getMermaidJsPath() });

    // Render the diagram and inject resulting SVG into the container
    const renderResult = await page.evaluate(
      async (code: string, diagramTheme: string): Promise<{ svg?: string; error?: string }> => {
        try {
          const m = (window as unknown as { mermaid: { initialize: (c: unknown) => void; render: (id: string, code: string) => Promise<{ svg: string }> } }).mermaid;
          m.initialize({
            startOnLoad: false,
            theme: diagramTheme,
            securityLevel: 'strict',
            sequence: { useMaxWidth: false },
            flowchart: { useMaxWidth: false },
          });
          const { svg } = await m.render('mf-diagram', code);
          return { svg };
        } catch (err: unknown) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
      mermaidCode,
      theme
    );

    if (renderResult.error || !renderResult.svg) {
      throw new Error(`Mermaid render failed: ${renderResult.error ?? 'empty SVG'}`);
    }

    // Mount SVG into the page DOM so we can manipulate its elements
    await page.evaluate((svgContent: string) => {
      const container = document.getElementById('diagram-container');
      if (container) container.innerHTML = svgContent;
    }, renderResult.svg);

    // ── Progressive re-rendering approach ─────────────────────────────────────
    // Parse the mermaid code into progressive steps and re-render each one.
    // For sequence diagrams: step 0 = actors only, step 1 = actors + first
    // message, step 2 = first two messages, etc.
    // This produces natural-looking animation where each message appears in
    // order, rather than all nodes first then all edges.

    const steps = parseMermaidSteps(mermaidCode);
    const framePaths: string[] = [];

    onProgress?.(15, `Rendering ${steps.length} frames…`);

    for (let i = 0; i < steps.length; i++) {
      const pct = 15 + Math.round((i / steps.length) * 60);
      onProgress?.(pct, `Rendering frame ${i + 1}/${steps.length}…`);
      // Re-render this step's mermaid code
      const stepResult = await page.evaluate(
        async (code: string, diagramTheme: string, stepIdx: number): Promise<{ svg?: string; error?: string }> => {
          try {
            const m = (window as unknown as { mermaid: { initialize: (c: unknown) => void; render: (id: string, code: string) => Promise<{ svg: string }> } }).mermaid;
            m.initialize({
              startOnLoad: false,
              theme: diagramTheme,
              securityLevel: 'strict',
              sequence: { useMaxWidth: false },
              flowchart: { useMaxWidth: false },
            });
            // Use a unique id per step to avoid mermaid caching issues
            const id = `mf-step-${stepIdx}`;
            // Clean up any lingering element from a previous render
            const stale = document.getElementById(id);
            if (stale) stale.remove();
            const { svg } = await m.render(id, code);
            return { svg };
          } catch {
            return { error: 'step render failed' };
          }
        },
        steps[i],
        theme,
        i
      );

      if (stepResult.svg) {
        await page.evaluate((svgContent: string) => {
          const container = document.getElementById('diagram-container');
          if (container) container.innerHTML = svgContent;
        }, stepResult.svg);
      }
      // If step render failed, keep previous frame content (still screenshot it)

      const framePath = path.join(tmpDir, `frame-${String(i).padStart(3, '0')}.png`);
      await page.screenshot({ path: framePath as `${string}.png`, type: 'png' });
      framePaths.push(framePath);
    }

    if (framePaths.length === 0) {
      // Fallback: single static frame of the full diagram
      const framePath = path.join(tmpDir, 'frame-000.png');
      await page.screenshot({ path: framePath as `${string}.png`, type: 'png' });
      framePaths.push(framePath);
    }

    // Hold the final completed frame for extra weight (3 duplicate frames)
    const lastFrame = framePaths[framePaths.length - 1];
    for (let h = 1; h <= 3; h++) {
      const holdPath = path.join(tmpDir, `frame-${String(framePaths.length + h - 1).padStart(3, '0')}.png`);
      fs.copyFileSync(lastFrame, holdPath);
      framePaths.push(holdPath);
    }

    return framePaths;
  } finally {
    await browser.close();
  }
}

export async function generateFrames(
  payload: GeneratePayload,
  onProgress?: ProgressCallback,
): Promise<{ jobId: string; framePaths: string[] }> {
  return limit(async () => {
    const jobId = uuidv4();
    onProgress?.(5, 'Launching browser…');
    const framePaths = await captureFrames(payload, jobId, onProgress);
    return { jobId, framePaths };
  });
}

/**
 * Render the full diagram to SVG markup (no frames / no GIF).
 */
export async function generateSvg(payload: GeneratePayload): Promise<string> {
  const { mermaidCode, theme, width, height } = payload;

  const resolvedExecPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? puppeteer.executablePath();
  const isDocker = !!process.env.PUPPETEER_EXECUTABLE_PATH;

  const browser = await puppeteer.launch({
    executablePath: resolvedExecPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      ...(isDocker ? ['--no-zygote', '--single-process'] : []),
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(buildHtmlTemplate(width, height), { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: getMermaidJsPath() });

    const result = await page.evaluate(
      async (code: string, diagramTheme: string): Promise<{ svg?: string; error?: string }> => {
        try {
          const m = (window as unknown as { mermaid: { initialize: (c: unknown) => void; render: (id: string, code: string) => Promise<{ svg: string }> } }).mermaid;
          m.initialize({ startOnLoad: false, theme: diagramTheme, securityLevel: 'strict' });
          const { svg } = await m.render('mf-svg-export', code);
          return { svg };
        } catch (err: unknown) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
      mermaidCode,
      theme,
    );

    if (result.error || !result.svg) {
      throw new Error(`Mermaid render failed: ${result.error ?? 'empty SVG'}`);
    }

    return result.svg;
  } finally {
    await browser.close();
  }
}
