import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { SECURITY_HEADERS } from '../security-headers';

describe('Content Security Policy', () => {
  it('allows model redirects and the pinned browser runtime without allowing all CDN scripts', () => {
    const policy = SECURITY_HEADERS['Content-Security-Policy'];
    const directives = policy.split('; ');
    const connect = directives.find((value) => value.startsWith('connect-src '));
    const script = directives.find((value) => value.startsWith('script-src '));
    expect(connect).toContain('https://us.aws.cdn.hf.co');
    expect(connect).toContain(
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/'
    );
    expect(script).toContain(
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/'
    );
    expect(script?.split(' ')).not.toContain('https://cdn.jsdelivr.net');
    expect(script?.split(' ')).toContain('blob:');
  });

  it('allows the shared first-party footer script and catalog', () => {
    const policy = SECURITY_HEADERS['Content-Security-Policy'];
    const directives = policy.split('; ');
    const connectSources = directives.find((directive) => directive.startsWith('connect-src '));
    const scriptSources = directives.find((directive) => directive.startsWith('script-src '));

    expect(connectSources).toContain('https://sassmaker.com');
    expect(scriptSources).toContain('https://sassmaker.com');
  });

  it('allows Microsoft Clarity collection without broadening other script origins', () => {
    const policy = SECURITY_HEADERS['Content-Security-Policy'];
    const directives = policy.split('; ');
    const connectSources = directives.find((directive) => directive.startsWith('connect-src '));
    const scriptSources = directives.find((directive) => directive.startsWith('script-src '));

    expect(connectSources).toContain('https://*.clarity.ms');
    expect(connectSources).toContain('https://c.bing.com');
    expect(scriptSources).toContain('https://www.clarity.ms');
  });

  it('allows the shared footer origins on static landing responses', () => {
    const staticHeaders = readFileSync(
      new URL('../../../public/_headers', import.meta.url),
      'utf8'
    );
    const contentSecurityPolicy = staticHeaders
      .split('\n')
      .find((line) => line.trimStart().startsWith('Content-Security-Policy:'));

    expect(contentSecurityPolicy).toMatch(/connect-src[^;]*https:\/\/sassmaker\.com/);
    expect(contentSecurityPolicy).toMatch(/script-src[^;]*https:\/\/sassmaker\.com/);
    expect(contentSecurityPolicy).toMatch(/connect-src[^;]*https:\/\/\*\.clarity\.ms/);
    expect(contentSecurityPolicy).toMatch(/connect-src[^;]*https:\/\/c\.bing\.com/);
    expect(contentSecurityPolicy).toMatch(/script-src[^;]*https:\/\/www\.clarity\.ms/);
  });

  it('loads the Email Manager Clarity project with the entire SPA root masked', () => {
    const source = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

    expect(source).toContain('y6bt70yq9x');
    expect(source).toContain('window.clarity("set","project_id","email-manager")');
    expect(source).toMatch(/<div id="root" data-clarity-mask="true"><\/div>/u);
  });
});
