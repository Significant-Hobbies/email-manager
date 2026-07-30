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
  "name": "Email Manager",
  "url": "https://mail.significanthobbies.com",
  "llmsFullTxt": "# Email Manager — full agent brief\n\nGmail workspace with local semantic search — private email tooling.\n\n## Index\n\n# Email Manager\n\nGmail workspace with local semantic search.\n\n## Privacy\n\nMailbox content is private. Agents should only use public product description surfaces.\n\n## Agent entrypoints\n\n- https://mail.significanthobbies.com/llms.txt\n- https://mail.significanthobbies.com/api/ai\n- https://mail.significanthobbies.com/index.md\n\n## Product links\n\n- Home: https://mail.significanthobbies.com/ — App shell\n\n## Machine surfaces\n\n- https://mail.significanthobbies.com/llms.txt\n- https://mail.significanthobbies.com/llms-full.txt\n- https://mail.significanthobbies.com/api/ai\n- https://mail.significanthobbies.com/index.md\n- https://mail.significanthobbies.com/sitemap.xml\n- https://mail.significanthobbies.com/robots.txt\n\n## Contact / fleet\n\n- Fleet: https://sassmaker.com\n- Agent email for directory verification: sarthakagrawal@agentmail.to\n",
  "llmsTxt": "# Email Manager\n\n> Gmail workspace with local semantic search — private email tooling.\n\n## Product\n\n- [Home](https://mail.significanthobbies.com/): App shell\n\n## Machine surfaces\n\n- [Agent catalog](https://mail.significanthobbies.com/api/ai): JSON inventory of public surfaces\n- [Homepage markdown](https://mail.significanthobbies.com/index.md): Product brief without JS\n- [This index](https://mail.significanthobbies.com/llms.txt)\n\n## Optional\n\n- [Foundry](https://sassmaker.com): Parent fleet showcase\n",
  "indexMd": "# Email Manager\n\nGmail workspace with local semantic search.\n\n## Privacy\n\nMailbox content is private. Agents should only use public product description surfaces.\n\n## Agent entrypoints\n\n- https://mail.significanthobbies.com/llms.txt\n- https://mail.significanthobbies.com/api/ai\n- https://mail.significanthobbies.com/index.md\n",
  "catalog": {
    "name": "Email Manager",
    "version": "1",
    "url": "https://mail.significanthobbies.com",
    "llms": "https://mail.significanthobbies.com/llms.txt",
    "llmsFull": "https://mail.significanthobbies.com/llms-full.txt",
    "sitemap": "https://mail.significanthobbies.com/sitemap.xml",
    "robots": "https://mail.significanthobbies.com/robots.txt",
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

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname === '' ? '/' : url.pathname;

  if (path === '/llms.txt') {
    return text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/llms-full.txt' && AGENT_SURFACE.llmsFullTxt) {
    return text(AGENT_SURFACE.llmsFullTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/index.md') {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8');
  }
  if (path === '/api/ai') {
    // Re-bind origin so preview/custom domains stay correct
    const catalog = {
      ...AGENT_SURFACE.catalog,
      url: url.origin,
      llms: `${url.origin}/llms.txt`,
      llmsFull: `${url.origin}/llms-full.txt`,
      sitemap: AGENT_SURFACE.catalog.sitemap
        ? String(AGENT_SURFACE.catalog.sitemap).replace(AGENT_SURFACE.url, url.origin)
        : `${url.origin}/sitemap.xml`,
      surfaces: (AGENT_SURFACE.catalog.surfaces || []).map((s) => ({
        ...s,
        url: s.url ? String(s.url).replace(AGENT_SURFACE.url, url.origin) : s.url,
        md: s.md ? String(s.md).replace(AGENT_SURFACE.url, url.origin) : s.md,
      })),
    };
    return json(catalog);
  }

  // Homepage markdown negotiation
  if ((path === '/' || path === '') && wantsMarkdown(request)) {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8', {
      Link: '</index.md>; rel="alternate"; type="text/markdown"',
      Vary: 'Accept',
    });
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
