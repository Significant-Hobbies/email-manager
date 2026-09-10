(() => {
  'use strict';

  const CATALOG_URL = 'https://sassmaker.com/projects.json';
  const INITIAL_PROJECTS = [{"id":"codevetter","name":"CodeVetter","url":"https://codevetter.com","description":"Execution-backed verification for AI-written software changes — local-first and inspectable."},{"id":"posttrainllm","name":"PostTrainLLM","url":"https://posttrainllm.com","description":"An experimental browser model playground: run small language models locally with visible generation metrics."},{"id":"live","name":"Live","url":"https://live.significanthobbies.com","description":"A free personality and hobby quiz that suggests a small experiment to try; account planning is not yet qualified."},{"id":"saas-maker","name":"SaaS Maker","url":"https://sassmaker.com","description":"A public directory of working experiments, reference projects and reusable tooling."},{"id":"gitstat","name":"GitStat","url":"https://git.significanthobbies.com","description":"An experimental public GitHub analysis tool for repository activity, contributions and code churn."},{"id":"email-manager","name":"Kinetic","url":"https://mail.significanthobbies.com","description":"A private Gmail workspace for local semantic search, sender insights, and explicit unsubscribe workflows."},{"id":"chatgpt-memory-insights","name":"Memory Map","url":"https://chatgpt.significanthobbies.com","description":"A browser-local experiment for importing a ChatGPT export, exploring semantic themes and search, and optionally saving analysis on your device."},{"id":"on-record","name":"High Signal Podcasts","url":"https://podcasts.highsignal.app","description":"Search evidenced podcast claims and follow links back to the original episode or publication."},{"id":"issue-pages","name":"IssuePages","url":"https://issues.sarthakagrawal.dev","description":"Read public GitHub issues as focused articles; publishing requires repository-owner access."},{"id":"research-papers","name":"Research Papers","url":"https://papers.highsignal.app","description":"Search academic papers and follow original sources; account-based research chat is not yet qualified."},{"id":"materia","name":"Materia","url":"https://materia.significanthobbies.com","description":"An educational body-and-remedy reference with condition-specific research citations and explicit uncertainty."},{"id":"anime-list","name":"Anime List","url":"https://anime.significanthobbies.com","description":"Anime and manga discovery with multi-axis filtering and personal watchlists."},{"id":"looptv","name":"LoopTV","url":"https://tv.significanthobbies.com","description":"An experimental lean-back queue of curated science and other videos."},{"id":"swe-interview-prep","name":"SWE Interview Prep","url":"https://learn.significanthobbies.com","description":"A learning OS for software-engineering interview practice."},{"id":"rolepatch","name":"RolePatch","url":"https://rolepatch.com","description":"A guest resume-tailoring experiment with a reviewable diff and browser-local document exports."},{"id":"starboard","name":"Starboard","url":"https://starboard.codevetter.com","description":"Explore public GitHub repositories and related projects through a searchable discovery experiment."},{"id":"mashup","name":"Mashup","url":"https://mashup.highsignal.app","description":"Two playable examples of a local media-editing pipeline, with captions and inspectable source and approval receipts."},{"id":"web-playables","name":"Web Playables","url":"https://idle.aliveville.com","description":"Small browser-playable game experiments."},{"id":"what-it-takes-to-win","name":"Look Sideways","url":"https://paths.significanthobbies.com","description":"Explore sourced career turning points with explicit survivorship and forecasting limits."},{"id":"sarthakagrawal-personal","name":"Sarthak Agrawal","url":"https://sarthakagrawal.dev","description":"Selected engineering case studies, technical writing and working project demonstrations."},{"id":"reddit-insights","name":"Reddit Insights","url":"https://reddit-insights.highsignal.app","description":"Search a dated snapshot of 93 Reddit communities in your browser, with links to original posts and explicit provenance limits."}];
  const REQUEST_TIMEOUT_MS = 800;
  const css = "\n    :host {\n      --portfolio-strip-bg: color-mix(in srgb, currentColor 3%, transparent);\n      --portfolio-strip-text: currentColor;\n      --portfolio-strip-muted: color-mix(in srgb, currentColor 70%, transparent);\n      --portfolio-strip-border: color-mix(in srgb, currentColor 12%, transparent);\n      --portfolio-strip-focus: #2563eb;\n      --portfolio-strip-separator-size: 1rem;\n      --portfolio-strip-tooltip-size: .75rem;\n      display: block;\n      width: 100%;\n      border-block: 1px solid var(--portfolio-strip-border);\n      background: var(--portfolio-strip-bg);\n      color: var(--portfolio-strip-text);\n      font-family: inherit;\n      box-sizing: border-box;\n    }\n    :host([theme='light']) {\n      --portfolio-strip-bg: #fafaf9;\n      --portfolio-strip-text: #292524;\n      --portfolio-strip-muted: #6f6964;\n      --portfolio-strip-border: #e7e5e4;\n    }\n    :host([theme='dark']) {\n      --portfolio-strip-bg: #171717;\n      --portfolio-strip-text: #f5f5f4;\n      --portfolio-strip-muted: #a8a29e;\n      --portfolio-strip-border: #30302f;\n    }\n    *, *::before, *::after { box-sizing: border-box; }\n    .inner { position: relative; display: flex; min-height: 2.75rem; align-items: center; padding: 0 1rem; }\n    a:focus-visible { outline: 2px solid var(--portfolio-strip-focus); outline-offset: 2px; }\n    .viewport { width: 100%; min-width: 0; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 1rem, #000 calc(100% - 1rem), transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000 1rem, #000 calc(100% - 1rem), transparent); }\n    .track { display: flex; width: max-content; align-items: center; animation: portfolio-strip-marquee var(--portfolio-strip-speed, 42s) linear infinite; will-change: transform; }\n    .viewport:hover .track { animation-play-state: paused; }\n    .viewport:focus-within .track { animation-play-state: paused; }\n    ul { display: flex; align-items: center; margin: 0; padding: 0; list-style: none; }\n    li { position: relative; display: inline-flex; align-items: center; white-space: nowrap; }\n    a { position: relative; display: inline-flex; min-height: 2.75rem; align-items: center; border-radius: .2rem; color: var(--portfolio-strip-text); font-size: .8125rem; text-decoration: none; transition: color 150ms ease; }\n    a:hover { text-decoration: underline; text-underline-offset: .2em; }\n    .dot { padding: 0 .7rem; color: var(--portfolio-strip-muted); font-size: var(--portfolio-strip-separator-size); }\n    .tooltip { position: absolute; z-index: 2; bottom: calc(100% + .5rem); left: 50%; width: max-content; max-width: min(22rem, 80vw); padding: .55rem .7rem; border: 1px solid var(--portfolio-strip-border); border-radius: .4rem; background: #171717; color: #f5f5f4; box-shadow: 0 8px 24px rgb(0 0 0 / .18); font-size: var(--portfolio-strip-tooltip-size); font-weight: 400; line-height: 1.35; pointer-events: none; transform: translateX(-50%); white-space: normal; }\n    .tooltip[hidden] { display: none; }\n    @keyframes portfolio-strip-marquee { to { transform: translateX(-50%); } }\n    @media (prefers-reduced-motion: reduce) {\n      .track { animation: none; }\n      .viewport { overflow-x: auto; mask-image: none; -webkit-mask-image: none; }\n      .duplicate { display: none; }\n    }\n    @media (hover: none), (pointer: coarse) {\n      .track { animation: none; }\n      .viewport { overflow-x: auto; mask-image: none; -webkit-mask-image: none; }\n      .duplicate { display: none; }\n    }\n    @media (max-width: 560px) {\n      .inner { padding: 0 .875rem; }\n    }\n  ";

  const validProjects = (value) => {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.filter((project) => {
      if (!project || typeof project !== 'object' || typeof project.id !== 'string' || !project.id || typeof project.name !== 'string' || !project.name || seen.has(project.id)) return false;
      try {
        const url = new URL(project.url);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
      } catch { return false; }
      seen.add(project.id);
      return true;
    });
  };

  const withReferralSource = (url, currentProjectId) => {
    if (!currentProjectId) return url;
    try {
      const destination = new URL(url);
      destination.searchParams.set('ref', currentProjectId);
      return destination.toString();
    } catch { return url; }
  };

  class PortfolioProjectStrip extends HTMLElement {
    constructor() {
      super();
      this.projects = INITIAL_PROJECTS;
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this.revalidate();
    }

    render() {
      const current = this.getAttribute('current-project') || '';
      const label = this.getAttribute('label') || 'Other projects by Sarthak';
      const speed = Math.max(20, Number(this.getAttribute('speed')) || 42);
      const projects = validProjects(this.projects).filter((project) => project.id !== current);
      if (!projects.length) { this.hidden = true; return; }
      this.hidden = false;
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.id = 'portfolio-project-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.hidden = true;
      const showDescription = (project) => {
        if (!project.description) return;
        tooltip.textContent = project.description;
        tooltip.hidden = false;
      };
      const hideDescription = () => { tooltip.hidden = true; };
      let viewport;
      let track;
      const transformOffsetX = (transform) => {
        if (transform === 'none') return 0;
        const values = transform.slice(transform.indexOf('(') + 1, -1).split(',').map(Number);
        const offset = transform.startsWith('matrix3d') ? values[12] : values[4];
        return Number.isFinite(offset) ? offset : 0;
      };
      const keepFocusedLinkVisible = (link) => {
        const viewportRect = viewport.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        const currentOffset = transformOffsetX(getComputedStyle(track).transform);
        const safeInset = 16;
        let correction = 0;
        if (linkRect.left < viewportRect.left + safeInset) correction = viewportRect.left + safeInset - linkRect.left;
        else if (linkRect.right > viewportRect.right - safeInset) correction = viewportRect.right - safeInset - linkRect.right;
        track.style.animation = 'none';
        track.style.transform = 'translateX(' + (currentOffset + correction) + 'px)';
      };
      const resumeTrackAfterFocus = (nextTarget) => {
        if (nextTarget instanceof Node && viewport.contains(nextTarget)) return;
        track.style.removeProperty('animation');
        track.style.removeProperty('transform');
      };
      const list = (duplicate = false) => {
        const ul = document.createElement('ul');
        if (duplicate) { ul.className = 'duplicate'; ul.setAttribute('aria-hidden', 'true'); }
        for (const project of projects) {
          const item = document.createElement('li');
          const link = document.createElement('a');
          link.href = withReferralSource(project.url, current);
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = project.name;
          if (duplicate) link.tabIndex = -1;
          if (project.description) {
            link.setAttribute('aria-label', project.name + ' (opens in a new tab)');
            link.setAttribute('aria-describedby', tooltip.id);
            link.addEventListener('pointerenter', () => showDescription(project));
            link.addEventListener('pointerleave', hideDescription);
            link.addEventListener('focus', () => {
              showDescription(project);
              keepFocusedLinkVisible(link);
            });
            link.addEventListener('blur', (event) => {
              hideDescription();
              resumeTrackAfterFocus(event.relatedTarget);
            });
          } else {
            link.setAttribute('aria-label', project.name + ' (opens in a new tab)');
            link.addEventListener('focus', () => keepFocusedLinkVisible(link));
            link.addEventListener('blur', (event) => resumeTrackAfterFocus(event.relatedTarget));
          }
          const dot = document.createElement('span');
          dot.className = 'dot';
          dot.setAttribute('aria-hidden', 'true');
          dot.textContent = '·';
          item.append(link, dot);
          ul.append(item);
        }
        return ul;
      };

      const aside = document.createElement('aside');
      aside.setAttribute('aria-label', label);
      const inner = document.createElement('div');
      inner.className = 'inner';
      viewport = document.createElement('div');
      viewport.className = 'viewport';
      track = document.createElement('div');
      track.className = 'track';
      track.style.setProperty('--portfolio-strip-speed', speed + 's');
      track.append(list(), list(true));
      viewport.append(track);
      inner.append(viewport, tooltip);
      aside.append(inner);
      if ('adoptedStyleSheets' in this.shadowRoot && typeof CSSStyleSheet !== 'undefined') {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        this.shadowRoot.adoptedStyleSheets = [sheet];
        this.shadowRoot.replaceChildren(aside);
      } else {
        const style = document.createElement('style');
        style.textContent = css;
        this.shadowRoot.replaceChildren(style, aside);
      }
    }

    async revalidate() {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(CATALOG_URL, { headers: { accept: 'application/json' }, cache: 'no-cache', signal: controller.signal });
        if (!response.ok) return;
        const projects = validProjects(await response.json());
        if (projects.length) { this.projects = projects; this.render(); }
      } catch {} finally { window.clearTimeout(timeout); }
    }
  }

  if (!customElements.get('portfolio-project-strip')) customElements.define('portfolio-project-strip', PortfolioProjectStrip);
  const script = document.currentScript;
  const mount = () => {
    if (!script || script.dataset.auto === 'false' || document.querySelector('portfolio-project-strip')) return;
    const strip = document.createElement('portfolio-project-strip');
    if (script.dataset.project) strip.setAttribute('current-project', script.dataset.project);
    if (script.dataset.label) strip.setAttribute('label', script.dataset.label);
    if (script.dataset.theme) strip.setAttribute('theme', script.dataset.theme);
    if (script.dataset.speed) strip.setAttribute('speed', script.dataset.speed);
    document.body.append(strip);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();