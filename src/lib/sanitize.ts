import DOMPurify from 'dompurify';

/**
 * Centrální sanitizace pro veškerý obsah vkládaný přes dangerouslySetInnerHTML.
 * Obsah pochází z DB (šablony, e-maily, zápisy, SVG symboly) — tedy od jiných
 * uživatelů, případně z importů. Bez sanitizace je každé takové místo XSS.
 */

/** Rich text: šablony dokumentů, e-maily, zápisy z porad, články. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea'],
  });
}

// SVG symboly se na plátně půdorysu renderují po desítkách při každém
// překreslení — výsledek se proto cachuje podle vstupního řetězce.
const svgCache = new Map<string, string>();
const SVG_CACHE_LIMIT = 500;

/** SVG obsah: symboly koupelen, vlastní ikony, schematické značky. */
export function sanitizeSvg(svg: string): string {
  const cached = svgCache.get(svg);
  if (cached !== undefined) return cached;

  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });

  if (svgCache.size >= SVG_CACHE_LIMIT) svgCache.clear();
  svgCache.set(svg, clean);
  return clean;
}
