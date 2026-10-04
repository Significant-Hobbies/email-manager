// Keep the runtime CDN version aligned with the locked Transformers.js ONNX runtime.
// Verify actual model loading with pnpm verify:browser-model after dependency changes.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "frame-src 'self' blob: https://accounts.google.com",
  "connect-src 'self' https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/ https://ingest.sassmaker.com https://accounts.google.com https://huggingface.co https://us.aws.cdn.hf.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://*.huggingface.co https://api.sassmaker.com https://sassmaker.com https://us.i.posthog.com https://us-assets.i.posthog.com https://cloudflareinsights.com https://*.clarity.ms https://c.bing.com",
  "script-src 'self' blob: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/ 'unsafe-inline' 'unsafe-eval' https://accounts.google.com/gsi/client https://sassmaker.com https://health.sassmaker.com https://us-assets.i.posthog.com https://static.cloudflareinsights.com https://www.clarity.ms",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), identity-credentials-get=(self)',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
};

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
