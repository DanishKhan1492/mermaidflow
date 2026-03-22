import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

export interface ShareState {
  code: string;
  theme?: string;
  resolution?: string;
}

export function encodeShareUrl(state: ShareState): string {
  const json = JSON.stringify(state);
  const compressed = compressToEncodedURIComponent(json);
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return `${base}?diagram=${compressed}`;
}

export function decodeShareUrl(search: string): ShareState | null {
  try {
    const params = new URLSearchParams(search);
    const encoded = params.get('diagram');
    if (!encoded) return null;
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (typeof parsed.code !== 'string') return null;
    return parsed as ShareState;
  } catch {
    return null;
  }
}
