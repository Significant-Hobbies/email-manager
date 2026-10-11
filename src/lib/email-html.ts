import outfitFontUrl from '@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2?inline';

const EMAIL_SHELL_STYLES = `
  @font-face {
    font-family: "Outfit Variable";
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url(${outfitFontUrl}) format("woff2");
  }
  :root { color-scheme: dark; }
  html, body {
    margin: 0;
    padding: 0;
    background: oklch(0.21 0.022 275);
    color: oklch(0.96 0.01 275);
    font-family: "Outfit Variable", "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 15px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  body { padding: 1.25rem 1.5rem 2rem; }
  a { color: oklch(0.74 0.14 272); }
  img { max-width: 100%; height: auto; }
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    margin: 0;
  }
  blockquote {
    margin: 0.75rem 0;
    padding-left: 1rem;
    border-left: 3px solid oklch(0.3 0.022 275);
    color: oklch(0.74 0.02 275);
  }
`;

/** Wrap Gmail HTML (or a plain snippet) in a high-contrast dark reading shell. */
export function wrapEmailHtml(body: string | undefined, snippet: string): string {
  const inner = body?.trim() || `<pre>${escapeHtml(snippet)}</pre>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>${EMAIL_SHELL_STYLES}</style></head><body>${inner}</body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
