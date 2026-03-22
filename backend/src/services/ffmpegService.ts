import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

/**
 * Stitch a sequence of PNG frames into a high-quality GIF using FFmpeg's
 * two-pass palettegen technique to avoid the washed-out colours typical
 * of naive GIF encoding.
 *
 * Pass 1 — analyse every input frame and generate an optimal 256-colour
 *           palette (stats_mode=full ensures non-uniform scenes are covered).
 * Pass 2 — use the palette with bayer dithering for crisp results.
 */
export function stitchGif(
  framePaths: string[],
  jobId: string
): Promise<Buffer> {
  const tmpDir = path.join('/tmp', jobId);
  const palettePath = path.join(tmpDir, 'palette.png');
  const outputPath = path.join(tmpDir, 'output.gif');
  // FFmpeg glob pattern matching the zero-padded frame filenames
  const inputPattern = path.join(tmpDir, 'frame-%03d.png');

  // Fixed 1 fps (1000 ms per frame) so each step is clearly readable.
  const effectiveFps = 1;

  return new Promise<Buffer>((resolve, reject) => {
    // ── Pass 1: generate colour palette ──────────────────────────────────────
    ffmpeg()
      .input(inputPattern)
      .inputOption(`-framerate ${effectiveFps}`)
      .videoFilter('palettegen=stats_mode=full')
      .output(palettePath)
      .on('end', () => {
        // ── Pass 2: encode GIF using the palette ────────────────────────────
        ffmpeg()
          .input(inputPattern)
          .inputOption(`-framerate ${effectiveFps}`)
          .input(palettePath)
          .complexFilter(
            `[0:v][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
          )
          .output(outputPath)
          .on('end', () => {
            try {
              const buffer = fs.readFileSync(outputPath);
              resolve(buffer);
            } catch (readErr) {
              reject(readErr);
            }
          })
          .on('error', (err) => {
            reject(new Error(`FFmpeg pass-2 failed: ${err.message}`));
          })
          .run();
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg pass-1 failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Remove the temporary job directory after the GIF has been sent to the client.
 * Non-critical: log the error but do not propagate it.
 */
export function cleanup(jobId: string): void {
  const tmpDir = path.join('/tmp', jobId);
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[ffmpeg] Cleanup failed for job ${jobId}:`, err);
  }
}
