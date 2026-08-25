const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "frame-src 'self' blob: https://accounts.google.com",
  "connect-src 'self' https://accounts.google.com https://huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://*.huggingface.co https://api.sassmaker.com https://sassmaker.com https://us.i.posthog.com https://us-assets.i.posthog.com https://cloudflareinsights.com https://vitals.fleet.workers.dev",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com/gsi/client https://sassmaker.com https://us-assets.i.posthog.com https://static.cloudflareinsights.com",
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
