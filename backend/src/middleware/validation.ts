import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const generateSchema = z.object({
  mermaidCode: z
    .string()
    .min(1, 'Mermaid code is required')
    .max(50000, 'Mermaid code too long'),
  width: z.number().int().min(320).max(3840).default(1280),
  height: z.number().int().min(240).max(2160).default(720),
  theme: z.enum(['default', 'dark', 'forest', 'neutral']).default('default'),
  format: z.enum(['gif', 'svg', 'png']).optional(),
});

export type GeneratePayload = z.infer<typeof generateSchema>;

/**
 * Strip constructs that could be exploited in the headless browser context:
 * - <script> blocks
 * - Inline event handlers (onclick=, onload=, etc.)
 * - javascript: pseudo-protocol
 */
function sanitizeMermaidCode(code: string): string {
  let sanitized = code.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  return sanitized;
}

export function validateGenerateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const result = generateSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: result.error.flatten(),
    });
    return;
  }

  result.data.mermaidCode = sanitizeMermaidCode(result.data.mermaidCode);
  req.body = result.data;
  next();
}
