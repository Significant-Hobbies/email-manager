import type { Email } from './gmail';

/** HTML is parsed in an inert template, never inserted into a live document. */
export function emailPreviewText(email: Pick<Email, 'snippet' | 'previewContent'>): string {
  const source = email.previewContent;
  if (!source) return email.snippet;
  let text = source.text;
  if (source.mimeType === 'text/html') {
    const template = document.createElement('template');
    template.innerHTML = text;
    for (const node of template.content.querySelectorAll('script,style,template,noscript')) {
      node.remove();
    }
    for (const node of template.content.querySelectorAll('br,p,div,li,tr,h1,h2,h3,h4,blockquote')) {
      node.append(template.ownerDocument.createTextNode(' '));
      node.prepend(template.ownerDocument.createTextNode(' '));
    }
    text = template.content.textContent ?? '';
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 200) || email.snippet;
}

export function needsPreviewHydration(email: Pick<Email, 'snippet' | 'previewContent'>): boolean {
  // Old bodies have no MIME provenance: never guess whether their entities are literal.
  return email.previewContent === undefined && /&(?:#|[a-z])/i.test(email.snippet);
}
