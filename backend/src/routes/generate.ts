import { Router, Request, Response } from 'express';
import { validateGenerateRequest, GeneratePayload } from '../middleware/validation';
import { generateFrames, ProgressCallback } from '../services/puppeteerService';
import { stitchGif, cleanup } from '../services/ffmpegService';

export const generateRouter = Router();

generateRouter.post(
  '/generate-gif',
  validateGenerateRequest,
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as GeneratePayload;
    const useSSE = req.headers.accept === 'text/event-stream';
    let jobId: string | undefined;

    if (useSSE) {
      // ── SSE mode: stream progress events ───────────────────────────────
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const onProgress: ProgressCallback = (pct, label) => {
          sendEvent('progress', { progress: pct, label });
        };

        const { jobId: id, framePaths } = await generateFrames(payload, onProgress);
        jobId = id;

        onProgress(80, 'Stitching GIF…');
        const gifBuffer = await stitchGif(framePaths, jobId);

        onProgress(95, 'Encoding…');
        const base64 = gifBuffer.toString('base64');

        sendEvent('complete', {
          gif: `data:image/gif;base64,${base64}`,
          frameCount: framePaths.length,
        });
        res.end();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[generate-gif] Error:', message);
        sendEvent('error', { error: message });
        res.end();
      } finally {
        if (jobId) cleanup(jobId);
      }
    } else {
      // ── Classic mode: single response ──────────────────────────────────
      try {
        const { jobId: id, framePaths } = await generateFrames(payload);
        jobId = id;

        const gifBuffer = await stitchGif(framePaths, jobId);

        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Content-Disposition', 'inline; filename="mermaidflow.gif"');
        res.setHeader('X-Frame-Count', String(framePaths.length));
        res.send(gifBuffer);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error during GIF generation';
        console.error('[generate-gif] Error:', message);
        res.status(500).json({ error: message });
      } finally {
        if (jobId) cleanup(jobId);
      }
    }
  }
);

// ── SVG / PNG export (no FFmpeg needed) ────────────────────────────────────
generateRouter.post(
  '/export-static',
  validateGenerateRequest,
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as GeneratePayload & { format?: 'svg' | 'png' };
    const format = payload.format ?? 'svg';
    let jobId: string | undefined;

    try {
      // Reuse puppeteer for rendering but only take the final frame
      const { jobId: id, framePaths } = await generateFrames(payload);
      jobId = id;

      if (format === 'png') {
        const fs = await import('fs');
        const pngBuffer = fs.readFileSync(framePaths[framePaths.length - 1]);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', 'inline; filename="mermaidflow.png"');
        res.send(pngBuffer);
      } else {
        // SVG — we re-render to get SVG markup
        const { generateSvg } = await import('../services/puppeteerService');
        const svgContent = await generateSvg(payload);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', 'inline; filename="mermaidflow.svg"');
        res.send(svgContent);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[export-static] Error:', message);
      res.status(500).json({ error: message });
    } finally {
      if (jobId) cleanup(jobId);
    }
  }
);
