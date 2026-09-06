/**
 * Portable agent-edge handler — copy or generate into each product.
 * Spec: fleet-ops/docs/agent-indexing-standard.md
 *
 * Usage in worker.mjs (before openNext.fetch):
 *   import { handleAgentEdge } from './agent-edge.mjs'
 *   const agent = handleAgentEdge(request)
 *   if (agent) return agent
 */

/** @type {{ name: string, url: string, llmsTxt: string, llmsFullTxt?: string, indexMd: string, catalog: object }} */
// biome-ignore format: generated payload from apply-agent-surfaces (JSON keys/quotes)
export const AGENT_SURFACE = {
  "name": "Kinetic",
  "alternateName": "Email Manager",
  "url": "https://mail.significanthobbies.com",
  "llmsFullTxt": "# Kinetic — full agent brief\n\nGmail workspace with local semantic search — private email tooling.\nFormerly \"Email Manager\" (retired alias).\n\n## Index\n\n# Kinetic\n\nGmail workspace with local semantic search.\n\n## Privacy\n\nMailbox content is private. Agents should only use public product description surfaces.\n\n## Agent entrypoints\n\n- https://mail.significanthobbies.com/llms.txt\n- https://mail.significanthobbies.com/api/ai\n- https://mail.significanthobbies.com/index.md\n\n## Product links\n\n- Home: https://mail.significanthobbies.com/ — App shell\n\n## Machine surfaces\n\n- https://mail.significanthobbies.com/llms.txt\n- https://mail.significanthobbies.com/llms-full.txt\n- https://mail.significanthobbies.com/api/ai\n- https://mail.significanthobbies.com/index.md\n- https://mail.significanthobbies.com/sitemap.xml\n- https://mail.significanthobbies.com/robots.txt\n\n## Contact / fleet\n\n- Fleet: https://sassmaker.com\n- Agent email for directory verification: sarthakagrawal@agentmail.to\n",
  "llmsTxt": "# Kinetic\n\n> Gmail workspace with local semantic search — private email tooling.\n> Formerly \"Email Manager\" (retired alias).\n\n## Product\n\n- [Home](https://mail.significanthobbies.com/): App shell\n\n## Machine surfaces\n\n- [Agent catalog](https://mail.significanthobbies.com/api/ai): JSON inventory of public surfaces\n- [OpenAPI spec](https://mail.significanthobbies.com/openapi.json): Machine-readable API description\n- [Homepage markdown](https://mail.significanthobbies.com/index.md): Product brief without JS\n- [This index](https://mail.significanthobbies.com/llms.txt)\n\n## When to use this\n\n- Searching a Gmail inbox locally with semantic similarity without server-side storage\n- Browsing and filtering emails with client-side ML embeddings (privacy-first)\n- Understanding the privacy architecture of a local-first email workspace\n- Checking FAQ about semantic search, subscriptions, and sender analytics\n\n## Optional\n\n- [Foundry](https://sassmaker.com): Parent fleet showcase\n",
  "indexMd": "# Kinetic\n\nGmail workspace with local semantic search.\n\n## Privacy\n\nMailbox content is private. Agents should only use public product description surfaces.\n\n## Agent entrypoints\n\n- https://mail.significanthobbies.com/llms.txt\n- https://mail.significanthobbies.com/api/ai\n- https://mail.significanthobbies.com/index.md\n",
  "catalog": {
    "name": "Kinetic",
    "alternateName": "Email Manager",
    "version": "1",
    "url": "https://mail.significanthobbies.com",
    "llms": "https://mail.significanthobbies.com/llms.txt",
    "llmsFull": "https://mail.significanthobbies.com/llms-full.txt",
    "sitemap": "https://mail.significanthobbies.com/sitemap.xml",
    "robots": "https://mail.significanthobbies.com/robots.txt",
    "openapi": "https://mail.significanthobbies.com/openapi.json",
    "markdown": {
      "suffix": ".md",
      "negotiation": true
    },
    "surfaces": [
      {
        "id": "home",
        "url": "https://mail.significanthobbies.com/",
        "md": "https://mail.significanthobbies.com/index.md",
        "kind": "spa",
        "description": "Product home"
      },
      {
        "id": "faq",
        "url": "https://mail.significanthobbies.com/faq",
        "md": "https://mail.significanthobbies.com/faq.md",
        "kind": "static",
        "description": "Privacy, semantic search, subscriptions, and sender analytics questions"
      },
      {
        "id": "changelog",
        "url": "https://mail.significanthobbies.com/changelog",
        "md": "https://mail.significanthobbies.com/changelog.md",
        "kind": "static",
        "description": "Verified product, privacy, reliability, and operations changes"
      }
    ],
    "auth": {
      "public": true,
      "notes": "Mailbox content and authenticated app routes are private and intentionally excluded."
    }
  }
};

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Kinetic public API',
    version: '1.0.0',
    description:
      'Gmail workspace with local semantic search. The public web API exposes read-only agent surfaces: the agent catalog, llms.txt, sitemap, and markdown alternates. Mailbox content is private.',
    contact: { name: 'Kinetic', url: 'https://mail.significanthobbies.com' },
  },
  servers: [{ url: 'https://mail.significanthobbies.com' }],
  tags: [{ name: 'agent-surfaces', description: 'Machine-readable public surfaces' }],
  paths: {
    '/api/ai': {
      get: {
        operationId: 'getAgentCatalog',
        tags: ['agent-surfaces'],
        summary: 'Agent catalog',
        description: 'JSON inventory of public agent surfaces.',
        responses: {
          200: {
            description: 'Agent catalog',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AgentCatalog' } },
            },
          },
        },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        tags: ['agent-surfaces'],
        summary: 'llms.txt index',
        responses: { 200: { description: 'Markdown index', content: { 'text/plain': {} } } },
      },
    },
    '/llms-full.txt': {
      get: {
        operationId: 'getLlmsFullTxt',
        tags: ['agent-surfaces'],
        summary: 'Full agent brief',
        responses: { 200: { description: 'Markdown brief', content: { 'text/plain': {} } } },
      },
    },
    '/sitemap.xml': {
      get: {
        operationId: 'getSitemap',
        tags: ['agent-surfaces'],
        summary: 'Sitemap',
        responses: { 200: { description: 'XML sitemap', content: { 'application/xml': {} } } },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['agent-surfaces'],
        summary: 'OpenAPI specification',
        description: 'This document.',
        responses: {
          200: { description: 'OpenAPI 3.1 spec', content: { 'application/json': {} } },
        },
      },
    },
  },
  components: {
    schemas: {
      AgentCatalog: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          llms: { type: 'string', format: 'uri' },
          llmsFull: { type: 'string', format: 'uri' },
          sitemap: { type: 'string', format: 'uri' },
          robots: { type: 'string', format: 'uri' },
          openapi: { type: 'string', format: 'uri' },
          markdown: {
            type: 'object',
            properties: { suffix: { type: 'string' }, negotiation: { type: 'boolean' } },
          },
        },
      },
    },
  },
};

function jsonError(status, code, message, path) {
  return new Response(JSON.stringify({ error: { code, message, path } }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function markdown404(pathname, origin) {
  const body = `# 404 — Not Found

\`${pathname}\` does not exist on ${origin}.

## Where to look next

- [Home](${origin}/)
- [Sitemap](${origin}/sitemap.xml)
- [Agent index](${origin}/llms.txt)
- [Full agent brief](${origin}/llms-full.txt)
- [Agent catalog (JSON)](${origin}/api/ai)
`;
  return new Response(body, {
    status: 404,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

const TEXT_ROUTES = {
  '/llms.txt': () => text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8'),
  '/index.md': () => text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8'),
};

function buildCatalog(url) {
  const rebind = (v) => (v ? String(v).replace(AGENT_SURFACE.url, url.origin) : v);
  return {
    ...AGENT_SURFACE.catalog,
    url: url.origin,
    llms: `${url.origin}/llms.txt`,
    llmsFull: `${url.origin}/llms-full.txt`,
    sitemap: AGENT_SURFACE.catalog.sitemap
      ? rebind(AGENT_SURFACE.catalog.sitemap)
      : `${url.origin}/sitemap.xml`,
    openapi: `${url.origin}/openapi.json`,
    surfaces: (AGENT_SURFACE.catalog.surfaces || []).map((s) => ({
      ...s,
      url: rebind(s.url),
      md: rebind(s.md),
    })),
  };
}

function openApiResponse() {
  return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600',
    },
  });
}

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname === '' ? '/' : url.pathname;

  if (path === '/openapi.json' || path === '/openapi.yaml') return openApiResponse();

  const textRoute = TEXT_ROUTES[path];
  if (textRoute) return textRoute();

  if (path === '/llms-full.txt' && AGENT_SURFACE.llmsFullTxt) {
    return text(AGENT_SURFACE.llmsFullTxt, 'text/plain; charset=utf-8');
  }

  if (path === '/api/ai') return json(buildCatalog(url));

  if (path.startsWith('/api/')) {
    return jsonError(404, 'not_found', `Unknown API path: ${path}`, path);
  }

  if (wantsMarkdown(request)) {
    if (path === '/' || path === '') {
      return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8', {
        Link: '</index.md>; rel="alternate"; type="text/markdown"',
        Vary: 'Accept',
      });
    }
    if (!path.includes('.')) {
      return markdown404(path, url.origin);
    }
  }

  return null;
}

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
}

function text(body, type, extra = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=300',
      ...extra,
    },
  });
}

function json(data) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
