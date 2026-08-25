#!/usr/bin/env node
// Documentation validation for the email-manager knowledge system.
//
// Checks:
//   1. Required root + docs/ files exist.
//   2. No markdown file is empty or a near-empty placeholder.
//   3. Relative markdown links resolve to an existing file (or a directory
//      containing an index.md / README.md).
//   4. Required documentation files are present.
//
// Does NOT check external http(s) links (use a linkchecker for those).
//
// Run: node scripts/check-docs.mjs   (or `pnpm check:docs`)
import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(repoRoot, 'docs');

const requiredFiles = [
  'agents.md',
  'STATUS.md',
  'PROJECT_STATUS.md',
  'README.md',
  'AUDIT.md',
  'docs/README.md',
  'docs/index.md',
  'docs/current/README.md',
  'docs/product/README.md',
  'docs/product/overview.md',
  'docs/architecture/README.md',
  'docs/architecture/overview.md',
  'docs/architecture/decisions.md',
  'docs/development/README.md',
  'docs/development/workflows.md',
  'docs/development/testing.md',
  'docs/operations/README.md',
  'docs/operations/deployment.md',
  'docs/operations/jobs/README.md',
  'docs/operations/runbooks/README.md',
  'docs/operations/runbooks/local-dev.md',
  'docs/operations/runbooks/oauth-setup.md',
  'docs/operations/runbooks/digest-verify.md',
  'docs/operations/runbooks/deploy.md',
  'docs/knowledge/README.md',
  'docs/knowledge/learnings/README.md',
  'docs/knowledge/learnings/lessons.md',
  'docs/knowledge/learnings/external-references.md',
  'docs/knowledge/failed-approaches/README.md',
  'scripts/check-docs.mjs',
];

const minBytes = 50; // a real doc has at least a heading + a line
const linkRe = /(?:^|[^!])\[([^\]]*)\]\(([^)]+)\)/g;
const imageRe = /!\[[^\]]*\]\(([^)]+)\)/g;

let failed = false;
const errors = [];
const warn = (msg) => console.warn(`WARN: ${msg}`);
const err = (msg) => {
  errors.push(msg);
  failed = true;
};

// --- 1. Required files ---------------------------------------------------
for (const rel of requiredFiles) {
  try {
    await access(path.join(repoRoot, rel));
  } catch {
    err(`Missing required file: ${rel}`);
  }
}

// --- 2. Walk docs/ + root markdown for empties and broken links ----------
/** @returns {Promise<string[]>} relative-to-repo markdown paths */
async function walkMarkdown(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(full, out);
    } else if (/\.(md|mdx)$/i.test(entry.name)) {
      out.push(path.relative(repoRoot, full));
    }
  }
  return out;
}

const rootMarkdown = [
  'agents.md',
  'STATUS.md',
  'PROJECT_STATUS.md',
  'README.md',
  'AUDIT.md',
  'CLAUDE.md',
];
const docsMarkdown = await walkMarkdown(docsRoot);
const allMarkdown = [...new Set([...rootMarkdown, ...docsMarkdown])];

// Skip generated/presentation dirs that are not source of truth.
const skipPaths = new Set(['landing-astro/dist']);

// Deliberate thin pointer files that are allowed to be tiny.
const pointerAllowlist = new Set(['CLAUDE.md']);

const mdExtensions = ['.md', '.mdx', '.markdown'];
const dirIndexFiles = ['index.mdx', 'index.md', 'README.md', 'readme.md'];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// Resolve a link target from a given source file.
async function resolveTarget(fromRel, target) {
  const fromFull = path.join(repoRoot, fromRel);
  const fileDir = path.dirname(fromFull);
  const [rawPath, anchor] = target.split('#');
  const [pathOnly] = rawPath.split('?');
  if (!pathOnly) return { ok: !!anchor, resolved: '' };
  let base = fileDir;
  let relPath = pathOnly;
  // Leading-slash links inside docs/ resolve against the docs content root.
  // Leading-slash links from root-level markdown are repo-root relative.
  if (pathOnly.startsWith('/')) {
    if (fromRel.startsWith('docs/') || fromRel === 'docs/README.md') {
      base = docsRoot;
      relPath = pathOnly.slice(1);
    } else {
      base = repoRoot;
      relPath = pathOnly.slice(1);
    }
  }
  const resolved = path.resolve(base, relPath);
  try {
    const s = await stat(resolved);
    if (s.isFile()) return { ok: true, resolved };
    if (s.isDirectory()) return { ok: true, resolved };
  } catch {
    // fall through to extension tolerance
  }
  if (!path.extname(resolved)) {
    for (const ext of mdExtensions) {
      if (await exists(resolved + ext)) return { ok: true, resolved: resolved + ext };
    }
    for (const idx of dirIndexFiles) {
      if (await exists(path.join(resolved, idx)))
        return { ok: true, resolved: path.join(resolved, idx) };
    }
  }
  return { ok: false, resolved };
}

for (const rel of allMarkdown) {
  // Skip files inside generated/presentation directories.
  const relDir = path.dirname(rel);
  if (skipPaths.has(relDir))
    continue;

  const full = path.join(repoRoot, rel);
  let content;
  try {
    content = await readFile(full, 'utf8');
  } catch {
    err(`Unreadable markdown: ${rel}`);
    continue;
  }
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes < minBytes && !pointerAllowlist.has(rel)) {
    err(`Empty or placeholder doc (${bytes} bytes): ${rel}`);
    continue;
  }

  const fileDir = path.dirname(full);
  const imageTargets = new Set();
  for (const m of content.matchAll(imageRe)) {
    imageTargets.add(m[1]);
  }
  for (const m of content.matchAll(linkRe)) {
    const target = m[2].trim();
    if (imageTargets.has(target)) continue;
    if (target.startsWith('http://') || target.startsWith('https://')) continue;
    if (target.startsWith('mailto:')) continue;
    if (target.startsWith('#')) continue;
    const { ok, resolved } = await resolveTarget(rel, target);
    if (!ok) {
      err(`Broken link in ${rel}: "${target}" -> ${path.relative(repoRoot, resolved) || '.'}`);
    }
  }
  for (const target of imageTargets) {
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('/'))
      continue;
    const resolved = path.resolve(fileDir, target);
    try {
      await stat(resolved);
    } catch {
      err(`Broken image in ${rel}: "${target}" -> ${path.relative(repoRoot, resolved)}`);
    }
  }
}

// --- Report --------------------------------------------------------------
if (errors.length) {
  console.error(`\nDocumentation validation FAILED (${errors.length} issue(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation validation OK (${allMarkdown.length} markdown files checked).`);
}
