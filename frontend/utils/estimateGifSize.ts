/**
 * Rough GIF size estimator.
 * Based on: frames × (width × height × bytesPerPixel) / compressionFactor
 * GIF typically compresses 10-20× for diagram-style content with palettegen.
 */
export function estimateGifSize(
  code: string,
  width: number,
  height: number,
): { frames: number; estimatedBytes: number; label: string } {
  // Count steps (same logic as parseMermaidSteps in PreviewPane)
  const lines = code.split('\n').filter((l) => l.trim().length > 0 && !l.trim().startsWith('%%'));
  const firstContent = lines[0]?.trim().toLowerCase() ?? '';

  let frames: number;
  if (firstContent.startsWith('sequencediagram')) {
    // declarations + actions + 3 held final frames
    const actions = lines.filter(
      (l) => !l.trim().startsWith('participant') && !l.trim().startsWith('actor') && !l.trim().startsWith('sequencediagram'),
    ).length;
    const hasDecls = lines.some((l) => l.trim().startsWith('participant') || l.trim().startsWith('actor'));
    frames = (hasDecls ? 1 : 0) + actions + 3;
  } else {
    // content lines + 3 held final frames
    frames = Math.max(lines.length - 1, 1) + 3;
  }

  // Empirical: diagram GIFs with palettegen compress ~15× for simple,  ~8× for complex
  const rawBytesPerFrame = width * height * 3; // RGB
  const compressionFactor = 12;
  const estimatedBytes = Math.round((frames * rawBytesPerFrame) / compressionFactor);

  let label: string;
  if (estimatedBytes < 1024) label = `~${estimatedBytes} B`;
  else if (estimatedBytes < 1024 * 1024) label = `~${(estimatedBytes / 1024).toFixed(0)} KB`;
  else label = `~${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;

  return { frames, estimatedBytes, label };
}
