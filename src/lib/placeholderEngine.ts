import type { DocumentTemplateType } from '../types/database';

export interface PlaceholderDef {
  key: string;
  label: string;
  category: string;
  description: string;
}

export const PLACEHOLDER_CATEGORIES = [
  { key: 'company', label: 'Firma' },
  { key: 'project', label: 'Projekt' },
  { key: 'client', label: 'Klient' },
  { key: 'quote', label: 'Nabídka' },
  { key: 'job', label: 'Zakázka' },
  { key: 'general', label: 'Obecné' },
] as const;

export const PLACEHOLDER_REGISTRY: PlaceholderDef[] = [
  { key: 'company.name', label: 'Název firmy', category: 'company', description: 'Název firmy' },
  { key: 'company.ico', label: 'IČO firmy', category: 'company', description: 'IČO firmy' },
  { key: 'company.dic', label: 'DIČ firmy', category: 'company', description: 'DIČ firmy' },
  { key: 'company.address', label: 'Adresa firmy', category: 'company', description: 'Adresa firmy' },
  { key: 'company.city', label: 'Město firmy', category: 'company', description: 'Město firmy' },
  { key: 'company.zip', label: 'PSČ firmy', category: 'company', description: 'PSČ firmy' },
  { key: 'company.phone', label: 'Telefon firmy', category: 'company', description: 'Telefon firmy' },
  { key: 'company.email', label: 'Email firmy', category: 'company', description: 'Email firmy' },
  { key: 'project.name', label: 'Název projektu', category: 'project', description: 'Název projektu' },
  { key: 'project.address', label: 'Adresa projektu', category: 'project', description: 'Adresa realizace' },
  { key: 'project.status', label: 'Stav projektu', category: 'project', description: 'Aktuální stav projektu' },
  { key: 'project.description', label: 'Popis projektu', category: 'project', description: 'Popis projektu' },
  { key: 'project.deadline', label: 'Termín', category: 'project', description: 'Termín dokončení' },
  { key: 'project.created_at', label: 'Datum vytvoření', category: 'project', description: 'Datum vytvoření projektu' },
  { key: 'project.responsible', label: 'Odpovědná osoba', category: 'project', description: 'Jméno odpovědné osoby' },
  { key: 'client.name', label: 'Jméno klienta', category: 'client', description: 'Jméno klienta' },
  { key: 'client.email', label: 'E-mail klienta', category: 'client', description: 'E-mailová adresa klienta' },
  { key: 'client.phone', label: 'Telefon klienta', category: 'client', description: 'Telefonní číslo klienta' },
  { key: 'client.address', label: 'Adresa klienta', category: 'client', description: 'Adresa klienta' },
  { key: 'client.ico', label: 'IČO klienta', category: 'client', description: 'IČO klienta' },
  { key: 'client.dic', label: 'DIČ klienta', category: 'client', description: 'DIČ klienta' },
  { key: 'quote.name', label: 'Název nabídky', category: 'quote', description: 'Název nabídky' },
  { key: 'quote.version', label: 'Verze nabídky', category: 'quote', description: 'Číslo verze nabídky' },
  { key: 'quote.total', label: 'Celková cena', category: 'quote', description: 'Celková cena nabídky' },
  { key: 'quote.status', label: 'Stav nabídky', category: 'quote', description: 'Aktuální stav nabídky' },
  { key: 'job.status', label: 'Stav zakázky', category: 'job', description: 'Aktuální stav zakázky' },
  { key: 'job.started_at', label: 'Datum zahájení', category: 'job', description: 'Datum zahájení zakázky' },
  { key: 'today', label: 'Dnešní datum', category: 'general', description: 'Aktuální datum' },
  { key: 'current_user', label: 'Přihlášený uživatel', category: 'general', description: 'Jméno přihlášeného uživatele' },
  { key: 'year', label: 'Rok', category: 'general', description: 'Aktuální rok' },
];

export const TEMPLATE_TYPE_LABELS: Record<DocumentTemplateType, string> = {
  zapis_stavba: 'Zápis na stavbě',
  predavaci_protokol: 'Předávací protokol',
  servisni_protokol: 'Servisní protokol',
  checklist: 'Checklist',
  obecny: 'Obecný dokument',
};

export interface RenderContext {
  company?: Record<string, unknown>;
  project?: Record<string, unknown>;
  client?: Record<string, unknown>;
  quote?: Record<string, unknown>;
  job?: Record<string, unknown>;
  currentUser?: string;
}

type MissingMode = 'empty' | 'show_missing';

function resolveValue(ctx: RenderContext, key: string): string | null {
  if (key === 'today') return new Date().toLocaleDateString('cs-CZ');
  if (key === 'year') return String(new Date().getFullYear());
  if (key === 'current_user') return ctx.currentUser || null;

  const parts = key.split('.');
  if (parts.length === 2) {
    const [group, field] = parts;
    const obj = ctx[group as keyof RenderContext];
    if (obj && typeof obj === 'object' && field in (obj as Record<string, unknown>)) {
      const val = (obj as Record<string, unknown>)[field];
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val.toLocaleDateString('cs-CZ');
      return String(val);
    }
    return null;
  }
  return null;
}

export function renderTemplate(
  template: string,
  ctx: RenderContext,
  missingMode: MissingMode = 'empty'
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim();
    const value = resolveValue(ctx, trimmed);
    if (value !== null) return value;
    return missingMode === 'show_missing' ? `[MISSING: ${trimmed}]` : '';
  });
}
