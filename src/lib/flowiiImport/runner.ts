import { supabase } from '../supabase';
import {
  type FlowiiEntity, type Row,
  num, str, isoDate, isoTime, isoDateTime, norm, slugify, hashKey, splitNames,
} from './parse';

export interface ImportScope {
  partners: boolean;
  pricelist: boolean;
  jobs: boolean;
  cases: boolean;
  tasks: boolean;
  events: boolean;
  issued: boolean;    // vydané faktury z dokladů
  received: boolean;  // přijaté faktury z dokladů
  finance: boolean;   // úhrady + ostatní příjmy/výdaje
}

export interface ImportOptions {
  orgId: string;
  userId: string;
  /** Vybrané subjekty (sloupec Firma). Prázdné = bez filtru. */
  firms: string[];
  /** Staré jméno uživatele → id účtu v novém systému (null = nemapovat). */
  userMap: Record<string, string | null>;
  tasksRule: 'open_active' | 'all_done';
  scope: ImportScope;
}

export interface ImportLogLine { level: 'info' | 'warn' | 'error'; text: string }
export interface ImportProgress { step: string; done: number; total: number }

export interface ImportCallbacks {
  onProgress: (p: ImportProgress) => void;
  onLog: (l: ImportLogLine) => void;
}

export type ImportCounts = Record<string, number>;

type Files = Partial<Record<FlowiiEntity, Row[]>>;

const BATCH = 200;
const OPEN_JOB_STATES = new Set(['Probíhá', 'Fakturace', 'Čeká', 'Podat NZU po PPP', 'Čeká na vyplacení dotace']);

/** Provede celý import ve správném pořadí; vrací počty zapsaných řádků per tabulka. */
export async function runFlowiiImport(files: Files, opt: ImportOptions, cb: ImportCallbacks): Promise<ImportCounts> {
  const ctx = new Ctx(files, opt, cb);
  const counts: ImportCounts = {};
  const add = (k: string, n: number) => { counts[k] = (counts[k] || 0) + n; };

  if (opt.scope.partners && files.partners) Object.entries(await ctx.importPartners()).forEach(([k, v]) => add(k, v));
  else await ctx.loadExistingClients();
  if (opt.scope.pricelist && files.pricelist) Object.entries(await ctx.importPricelist()).forEach(([k, v]) => add(k, v));
  if (opt.scope.jobs && files.jobs) Object.entries(await ctx.importJobs()).forEach(([k, v]) => add(k, v));
  else await ctx.loadExistingProjects();
  if (opt.scope.cases && files.cases) Object.entries(await ctx.importCases()).forEach(([k, v]) => add(k, v));
  if (opt.scope.tasks && files.tasks) Object.entries(await ctx.importTasks()).forEach(([k, v]) => add(k, v));
  if (opt.scope.events && files.events) Object.entries(await ctx.importEvents()).forEach(([k, v]) => add(k, v));
  if ((opt.scope.issued || opt.scope.received) && files.documents) Object.entries(await ctx.importDocuments()).forEach(([k, v]) => add(k, v));
  if (opt.scope.finance && files.finance) Object.entries(await ctx.importFinance()).forEach(([k, v]) => add(k, v));
  return counts;
}

/** Kolik řádků z tohoto zdroje už v organizaci je (pro souhrn před spuštěním). */
export async function countImported(orgId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const tables: { table: string; orgCol: string }[] = [
    { table: 'clients', orgCol: 'organization_id' }, { table: 'suppliers', orgCol: 'organization_id' },
    { table: 'products', orgCol: 'organization_id' }, { table: 'projects', orgCol: 'organization_id' },
    { table: 'leads', orgCol: 'organization_id' }, { table: 'tasks', orgCol: 'organization_id' },
    { table: 'events', orgCol: 'organization_id' }, { table: 'invoices', orgCol: 'organization_id' },
    { table: 'received_invoices', orgCol: 'organization_id' }, { table: 'cashflow_manual_entries', orgCol: 'org_id' },
  ];
  await Promise.all(tables.map(async t => {
    const { count } = await supabase.from(t.table).select('id', { count: 'exact', head: true })
      .eq(t.orgCol, orgId).like('import_ref', 'flowii:%');
    out[t.table] = count || 0;
  }));
  return out;
}

// ============================================================================

class Ctx {
  clientByName = new Map<string, string>();
  supplierByName = new Map<string, string>();
  projectByNumber = new Map<string, string>();
  projectByName = new Map<string, string>();
  openJobNumbers = new Set<string>();
  invoiceByNumber = new Map<string, { id: string; total: number }>();
  receivedByNumber = new Map<string, { id: string; total: number }>();
  receivedByKey = new Map<string, { id: string; total: number }>();

  constructor(private files: Files, private opt: ImportOptions, private cb: ImportCallbacks) {}

  // ------------------------------------------------------------ pomocné
  private log(level: ImportLogLine['level'], text: string) { this.cb.onLog({ level, text }); }
  private progress(step: string, done: number, total: number) { this.cb.onProgress({ step, done, total }); }

  private firmOk(firma: string): boolean {
    if (this.opt.firms.length === 0) return true;
    if (!str(firma)) return true;
    return this.opt.firms.includes(str(firma));
  }

  private user(oldName: string | undefined): string | null {
    const names = splitNames(oldName);
    for (const n of names) {
      const id = this.opt.userMap[n];
      if (id) return id;
    }
    return null;
  }

  /** Upsert po dávkách; vrací mapu import_ref → id. */
  private async upsert(table: string, rows: Record<string, unknown>[], conflict: string, step: string): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    // stejný import_ref dvakrát v jednom příkazu Postgres odmítne — odliš duplicity příponou
    const seenRefs = new Set<string>();
    let dupes = 0;
    for (const row of rows) {
      let ref = String(row.import_ref);
      if (seenRefs.has(ref)) { dupes++; while (seenRefs.has(ref)) ref += '+'; row.import_ref = ref; }
      seenRefs.add(ref);
    }
    if (dupes) this.log('warn', `${table}: ${dupes} řádků mělo stejný klíč jako jiný řádek — odlišeny příponou, zkontroluj duplicity ve zdroji.`);
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await supabase.from(table).upsert(batch, { onConflict: conflict }).select('id, import_ref');
      if (error) {
        this.log('error', `${table}: dávka ${i + 1}–${i + batch.length} selhala — ${error.message}`);
        // zkus po jednom, ať neshodí celou dávku jeden vadný řádek
        for (const row of batch) {
          const one = await supabase.from(table).upsert(row, { onConflict: conflict }).select('id, import_ref').maybeSingle();
          if (one.error) this.log('error', `${table} [${String(row.import_ref)}]: ${one.error.message}`);
          else if (one.data) ids.set(String((one.data as { import_ref: string }).import_ref), String((one.data as { id: string }).id));
        }
      } else {
        for (const d of (data || []) as { id: string; import_ref: string }[]) ids.set(d.import_ref, d.id);
      }
      this.progress(step, Math.min(i + BATCH, rows.length), rows.length);
    }
    return ids;
  }

  /** Vybere všechny řádky bez limitu 1000 (PostgREST stránkuje). */
  private async selectAll<T>(table: string, select: string, apply: (q: ReturnType<typeof supabase.from>) => unknown): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      let q = supabase.from(table).select(select).range(from, from + 999);
      q = (apply(q as unknown as ReturnType<typeof supabase.from>) as typeof q) || q;
      const { data, error } = await q;
      if (error) { this.log('error', `${table}: čtení selhalo — ${error.message}`); break; }
      out.push(...((data || []) as T[]));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  async loadExistingClients() {
    const rows = await this.selectAll<{ id: string; name: string }>('clients', 'id, name',
      q => (q as unknown as { eq: (c: string, v: string) => unknown }).eq('organization_id', this.opt.orgId));
    for (const r of rows) if (!this.clientByName.has(norm(r.name))) this.clientByName.set(norm(r.name), r.id);
    const sup = await this.selectAll<{ id: string; name: string }>('suppliers', 'id, name',
      q => (q as unknown as { eq: (c: string, v: string) => unknown }).eq('organization_id', this.opt.orgId));
    for (const r of sup) if (!this.supplierByName.has(norm(r.name))) this.supplierByName.set(norm(r.name), r.id);
  }

  async loadExistingProjects() {
    const rows = await this.selectAll<{ id: string; project_name: string; legacy_number: string | null }>('projects', 'id, project_name, legacy_number',
      q => (q as unknown as { eq: (c: string, v: string) => unknown }).eq('organization_id', this.opt.orgId));
    for (const r of rows) {
      if (r.legacy_number) this.projectByNumber.set(r.legacy_number, r.id);
      if (!this.projectByName.has(norm(r.project_name))) this.projectByName.set(norm(r.project_name), r.id);
    }
  }

  private projectFor(number: string | undefined, name: string | undefined): string | null {
    const n = str(number);
    if (n && this.projectByNumber.has(n)) return this.projectByNumber.get(n)!;
    const nm = norm(name);
    if (nm && this.projectByName.has(nm)) return this.projectByName.get(nm)!;
    return null;
  }

  // ------------------------------------------------------------ partneři
  async importPartners(): Promise<ImportCounts> {
    const rows = this.files.partners || [];
    const { orgId, userId } = this.opt;
    const clients: Record<string, unknown>[] = [];
    const suppliers: Record<string, unknown>[] = [];
    const contactsByRef = new Map<string, Record<string, unknown>[]>();
    const addressesByRef = new Map<string, Record<string, unknown>[]>();
    const seen = new Set<string>();

    for (const r of rows) {
      const name = str(r['Název']);
      if (!name) continue;
      const ico = str(r['IČ']);
      let ref = `flowii:partner:${norm(name)}${ico ? `|${ico}` : ''}`;
      while (seen.has(ref)) ref += '+';
      seen.add(ref);
      const street = str(r['Fakturační adresa - ulice']);
      const zip = str(r['Fakturační adresa - PSČ']);
      const city = str(r['Fakturační adresa - město']);
      const email = str(r['Hlavní kontakt - email']);
      const phone = str(r['Hlavní kontakt - telefon 1']) || str(r['Hlavní kontakt - telefon 2']);
      const contactName = [str(r['Hlavní kontakt - jméno']), str(r['Hlavní kontakt - příjmení'])].filter(Boolean).join(' ');
      const noteParts = [str(r['Poznámka']), str(r['Typ']) ? `Typ (Flowii): ${str(r['Typ'])}` : '', str(r['Podtyp']) ? `Podtyp: ${str(r['Podtyp'])}` : ''].filter(Boolean);
      const createdAt = isoDateTime(r['Datum vytvoření']);

      if (str(r['Typ']) === 'Dodavatel') {
        suppliers.push({
          organization_id: orgId, created_by: userId, import_ref: ref,
          name, ico, dic: str(r['DIČ']),
          address: [street, [zip, city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
          email, phone, contact_person: contactName,
          default_due_days: num(r['Splatnost vystavených faktur ve dnech']) || 14,
          note: noteParts.join('\n'), is_active: true,
        });
        continue;
      }

      clients.push({
        organization_id: orgId, user_id: userId, import_ref: ref,
        name, email, phone, address: street, city, ico, dic: str(r['DIČ']),
        note: noteParts.join('\n'),
        client_type: str(r['Firma / osoba']) === 'firma' ? 'firma' : 'rd',
        is_active: true,
        ...(createdAt ? { created_at: createdAt } : {}),
      });

      const contacts: Record<string, unknown>[] = [];
      if (contactName) {
        contacts.push({ import_ref: `${ref}:c1`, name: contactName, role: str(r['Hlavní kontakt - pozice']), email, phone, is_primary: true });
      }
      for (let i = 2; i <= 6; i++) {
        const cn = [str(r[`Kontakt ${i} - jméno`]), str(r[`Kontakt ${i} - příjmení`])].filter(Boolean).join(' ');
        if (!cn) continue;
        contacts.push({
          import_ref: `${ref}:c${i}`, name: cn, role: str(r[`Kontakt ${i} - pozice`]),
          email: str(r[`Kontakt ${i} - email`]), phone: str(r[`Kontakt ${i} - telefon 1`]) || str(r[`Kontakt ${i} - telefon 2`]),
          is_primary: false,
        });
      }
      if (contacts.length) contactsByRef.set(ref, contacts);

      const addresses: Record<string, unknown>[] = [];
      if (street || city) addresses.push({ import_ref: `${ref}:a_billing`, address_type: 'billing', street, city, zip, country: str(r['Fakturační adresa - stát']) || 'Česká republika', label: 'Fakturační' });
      const dStreet = str(r['Dodací adresa - ulice']); const dCity = str(r['Dodací adresa - město']);
      if (dStreet || dCity) addresses.push({ import_ref: `${ref}:a_delivery`, address_type: 'delivery', street: dStreet, city: dCity, zip: str(r['Dodací adresa - PSČ']), country: str(r['Dodací adresa - stát']) || 'Česká republika', label: 'Dodací' });
      if (addresses.length) addressesByRef.set(ref, addresses);
    }

    const clientIds = await this.upsert('clients', clients, 'organization_id,import_ref', 'Klienti');
    for (const c of clients) {
      const id = clientIds.get(String(c.import_ref));
      if (id && !this.clientByName.has(norm(String(c.name)))) this.clientByName.set(norm(String(c.name)), id);
    }
    const supplierIds = await this.upsert('suppliers', suppliers, 'organization_id,import_ref', 'Dodavatelé');
    for (const s of suppliers) {
      const id = supplierIds.get(String(s.import_ref));
      if (id) this.supplierByName.set(norm(String(s.name)), id);
    }

    const contactRows: Record<string, unknown>[] = [];
    for (const [ref, list] of contactsByRef) {
      const cid = clientIds.get(ref); if (!cid) continue;
      for (const c of list) contactRows.push({ ...c, client_id: cid });
    }
    const addressRows: Record<string, unknown>[] = [];
    for (const [ref, list] of addressesByRef) {
      const cid = clientIds.get(ref); if (!cid) continue;
      for (const a of list) addressRows.push({ ...a, client_id: cid });
    }
    await this.upsert('client_contacts', contactRows, 'client_id,import_ref', 'Kontakty klientů');
    await this.upsert('client_addresses', addressRows, 'client_id,import_ref', 'Adresy klientů');

    this.log('info', `Partneři: ${clientIds.size} klientů, ${supplierIds.size} dodavatelů, ${contactRows.length} kontaktů, ${addressRows.length} adres.`);
    return { clients: clientIds.size, suppliers: supplierIds.size, client_contacts: contactRows.length, client_addresses: addressRows.length };
  }

  // ------------------------------------------------------------ ceník
  async importPricelist(): Promise<ImportCounts> {
    const rows = this.files.pricelist || [];
    const { orgId } = this.opt;

    const { data: catData } = await supabase.from('categories').select('id, name, slug').eq('organization_id', orgId);
    const catByName = new Map<string, string>();
    for (const c of (catData || []) as { id: string; name: string }[]) catByName.set(norm(c.name), c.id);
    const wantedCats = [...new Set(rows.map(r => str(r['Kategorie']) || 'Ostatní'))];
    let sort = catByName.size;
    for (const name of wantedCats) {
      if (catByName.has(norm(name))) continue;
      const { data, error } = await supabase.from('categories')
        .insert({ organization_id: orgId, name, slug: slugify(name), sort_order: ++sort })
        .select('id').maybeSingle();
      if (error || !data) { this.log('warn', `Kategorie „${name}": ${error?.message || 'nevytvořena'}`); continue; }
      catByName.set(norm(name), data.id as string);
    }

    const catIds = [...catByName.values()];
    const { data: subData } = catIds.length
      ? await supabase.from('subcategories').select('id, category_id, name').in('category_id', catIds)
      : { data: [] };
    const subByKey = new Map<string, string>();
    for (const s of (subData || []) as { id: string; category_id: string; name: string }[]) subByKey.set(`${s.category_id}::${norm(s.name)}`, s.id);
    const wantedSubs = new Map<string, { catId: string; name: string }>();
    for (const r of rows) {
      const sub = str(r['Podkategorie']); if (!sub) continue;
      const catId = catByName.get(norm(str(r['Kategorie']) || 'Ostatní')); if (!catId) continue;
      const key = `${catId}::${norm(sub)}`;
      if (!subByKey.has(key) && !wantedSubs.has(key)) wantedSubs.set(key, { catId, name: sub });
    }
    for (const [key, s] of wantedSubs) {
      const { data, error } = await supabase.from('subcategories')
        .insert({ category_id: s.catId, name: s.name, slug: slugify(s.name), sort_order: 0 })
        .select('id').maybeSingle();
      if (error || !data) { this.log('warn', `Podkategorie „${s.name}": ${error?.message || 'nevytvořena'}`); continue; }
      subByKey.set(key, data.id as string);
    }

    const tradeFor = (cat: string): string => {
      const c = norm(cat);
      if (c.startsWith('vodo')) return 'water';
      if (c.startsWith('bojler') || c.includes('tepeln') || c.includes('topen')) return 'heating';
      return 'electric';
    };

    const products: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const name = str(r['Název']); if (!name) continue;
      const code = str(r['Číslo']);
      let ref = `flowii:cenik:${code || norm(name)}`;
      while (seen.has(ref)) ref += '+';
      seen.add(ref);
      const cat = str(r['Kategorie']) || 'Ostatní';
      const catId = catByName.get(norm(cat));
      if (!catId) continue;
      const sub = str(r['Podkategorie']);
      const unit = str(r['Měrná jednotka']);
      const desc = [str(r['Doplňující text na faktuře']), unit ? `MJ: ${unit}` : '', str(r['Typ (zboží/služba)']) === 'služba' ? 'Služba' : ''].filter(Boolean).join(' · ');
      products.push({
        organization_id: orgId, import_ref: ref,
        name, code, brand: str(r['Výrobce']),
        price: num(r['Prodejní cena (bez DPH)']), purchase_price: num(r['Nákupní cena (bez DPH)']),
        margin_percent: num(r['Obchodní přirážka (%)']),
        description: desc, category_id: catId,
        subcategory_id: sub ? (subByKey.get(`${catId}::${norm(sub)}`) ?? null) : null,
        tag: sub, trade: tradeFor(cat),
        is_active: norm(cat) !== 'nepoužívané',
      });
    }
    const ids = await this.upsert('products', products, 'organization_id,import_ref', 'Ceník');
    this.log('info', `Ceník: ${ids.size} položek, ${wantedCats.length} kategorií.`);
    return { products: ids.size };
  }

  // ------------------------------------------------------------ zakázky
  async importJobs(): Promise<ImportCounts> {
    const rows = (this.files.jobs || []).filter(r => this.firmOk(r['Firma']));
    const { orgId, userId } = this.opt;
    const statusFor = (s: string): string => {
      if (s === 'Dokončena') return 'done';
      if (s === 'Zrušena') return 'cancelled';
      if (s === 'Čeká') return 'approval';
      return 'execution';
    };
    const TECH: [string, string][] = [
      ['Typ měření', 'typ_mereni'], ['Úmístění technologie', 'umisteni_technologie'], ['WallBox', 'wallbox'],
      ['Umístění WallBoxu', 'umisteni_wallboxu'], ['Hlavní jistič', 'hlavni_jistic'], ['EPS', 'eps'],
      ['Typ krytiny', 'typ_krytiny'], ['Typ panelu', 'typ_panelu'], ['Panely objednány', 'panely_objednany'],
      ['Počet panelů', 'pocet_panelu'], ['Číslo žádosti DIP', 'cislo_zadosti_dip'], ['Číslo elektroměru', 'cislo_elektromeru'],
      ['NZU podklady k podání', 'nzu_podklady'], ['NZU podáno', 'nzu_podano'], ['NZU akceptováno', 'nzu_akceptovano'],
      ['ČEZ PD před podáno', 'cez_pd_podano'], ['ČEZ PD před akceptováno', 'cez_pd_akceptovano'],
      ['ČEZ PPP podáno', 'cez_ppp_podano'], ['ČEZ PPP akceptováno', 'cez_ppp_akceptovano'], ['Typ střídače:', 'typ_stridace'],
    ];
    const out: Record<string, unknown>[] = [];
    for (const r of rows) {
      const number = str(r['Číslo']); const name = str(r['Název']);
      if (!name && !number) continue;
      if (OPEN_JOB_STATES.has(str(r['Stav']))) this.openJobNumbers.add(number);
      const tech: Record<string, unknown> = {};
      for (const [col, key] of TECH) { const v = str(r[col]); if (v) tech[key] = v; }
      tech.flowii = {
        cislo: number, stav: str(r['Stav']), typ: str(r['Typ']), odpovedny: str(r['Odpovědný']), firma: str(r['Firma']),
        dohodnuta_cena: num(r['Dohodnutá cena']), vyfakturovano: num(r['Vyfakturováno']), zbyva_vyfakturovat: num(r['Zbývá vyfakturovat']),
        obchodni_prirazka: num(r['Obchodní přirážka']), predp_trvani: str(r['Predp. trvání (hh:mm)']), skut_trvani: str(r['Skutečné trvání (hh:mm)']),
        datum_dokonceni: isoDate(r['Datum dokončení']), datum_predani: isoDate(r['Datum předání']),
      };
      const partner = str(r['Partner']);
      const descParts = [
        `Zakázka Flowii č. ${number} · ${str(r['Stav'])}${str(r['Typ']) ? ` · ${str(r['Typ'])}` : ''}${str(r['Firma']) ? ` · ${str(r['Firma'])}` : ''}`,
        num(r['Dohodnutá cena']) ? `Dohodnutá cena: ${num(r['Dohodnutá cena']).toLocaleString('cs-CZ')} Kč` : '',
        str(r['Popis a požadavky']),
      ].filter(Boolean);
      const createdAt = isoDateTime(r['Založena']);
      out.push({
        organization_id: orgId, user_id: userId, import_ref: `flowii:zakazka:${number || norm(name)}`,
        legacy_number: number || null,
        name: name || `Zakázka ${number}`, project_name: name || `Zakázka ${number}`,
        client_name: partner, client_id: this.clientByName.get(norm(partner)) ?? null,
        responsible_user_id: this.user(r['Odpovědný']),
        status: statusFor(str(r['Stav'])),
        description: descParts.join('\n'),
        address: [str(r['Partner - fakturačná adresa - ulica']), str(r['Partner - fakturačná adresa - mesto'])].filter(Boolean).join(', '),
        deadline: isoDate(r['Termín dokončení']),
        tech_details: tech,
        ...(createdAt ? { created_at: createdAt } : {}),
      });
    }
    const ids = await this.upsert('projects', out, 'organization_id,import_ref', 'Zakázky');
    for (const p of out) {
      const id = ids.get(String(p.import_ref)); if (!id) continue;
      if (p.legacy_number) this.projectByNumber.set(String(p.legacy_number), id);
      if (!this.projectByName.has(norm(String(p.project_name)))) this.projectByName.set(norm(String(p.project_name)), id);
    }
    this.log('info', `Zakázky: ${ids.size} projektů (${this.openJobNumbers.size} otevřených).`);
    return { projects: ids.size };
  }

  // ------------------------------------------------------------ obchodní případy
  async importCases(): Promise<ImportCounts> {
    const rows = (this.files.cases || []).filter(r => this.firmOk(r['Firma']));
    const statusFor = (s: string): string => {
      if (s === 'Úspěch') return 'converted';
      if (s === 'Neúspěch') return 'lost';
      if (s.startsWith('10%')) return 'new';
      if (s.startsWith('75%') || s.startsWith('90%')) return 'qualified';
      return 'contacted';
    };
    const out: Record<string, unknown>[] = [];
    for (const r of rows) {
      const number = str(r['Číslo']); const name = str(r['Název']); const partner = str(r['Partner']);
      if (!number && !name) continue;
      const createdAt = isoDateTime(r['Založen']);
      out.push({
        organization_id: this.opt.orgId, import_ref: `flowii:op:${number || norm(name)}`,
        name: partner || name,
        email: str(r['Partner - hlavní kontakt - email']),
        phone: str(r['Partner - hlavní kontakt - mobil']) || str(r['Partner - hlavní kontakt - telefón']),
        message: [name, str(r['Popis'])].filter(Boolean).join('\n'),
        source: 'flowii',
        status: statusFor(str(r['Stav'])),
        converted_project_id: this.projectFor(undefined, r['Zakázka']),
        converted_client_id: this.clientByName.get(norm(partner)) ?? null,
        form_data: {
          flowii: {
            cislo: number, nazev: name, stav: str(r['Stav']), typ: str(r['Typ zakázky']),
            cena: num(r['Celková cena']), odpovedny: str(r['Odpovědný']), firma: str(r['Firma']),
            predpokl_uzavreni: isoDate(r['Předpokl. uzavření']), datum_uzavreni: isoDate(r['Datum uzavření']),
            zdroj: str(r['Zdroj kontaktu']), adresa: [str(r['Partner - fakturační adresa - ulice']), str(r['Partner - fakturační adresa - město'])].filter(Boolean).join(', '),
          },
        },
        ...(createdAt ? { created_at: createdAt } : {}),
      });
    }
    const ids = await this.upsert('leads', out, 'organization_id,import_ref', 'Obchodní případy');
    this.log('info', `Obchodní případy: ${ids.size} leadů.`);
    return { leads: ids.size };
  }

  // ------------------------------------------------------------ úkoly
  async importTasks(): Promise<ImportCounts> {
    const rows = this.files.tasks || [];
    const { orgId, userId } = this.opt;
    const today = new Date().toISOString().slice(0, 10);
    const prioFor = (p: string): string => {
      const n = num(p);
      if (!n) return 'medium';
      if (n <= 2) return 'high';
      if (n === 3) return 'medium';
      return 'low';
    };
    const out: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const r of rows) {
      const number = str(r['Číslo']); const title = str(r['Úkol']);
      if (!title) continue;
      const jobNumber = str(r['Číslo zakázky']);
      const projectId = this.projectFor(jobNumber, r['Zakázka']);
      // úkol zakázky, která se neimportovala (jiný subjekt / filtr) — přeskočit
      if ((jobNumber || str(r['Zakázka'])) && !projectId) { skipped++; continue; }
      const due = isoDate(r['Termín']) || isoDate(r['Plánovaný konec']);
      let status = 'done';
      if (this.opt.tasksRule === 'open_active') {
        if (projectId) status = this.openJobNumbers.has(jobNumber) ? 'todo' : 'done';
        else status = due && due >= today ? 'todo' : 'done';
      }
      const descParts = [str(r['Popis']), str(r['Kategorie']) ? `Kategorie: ${str(r['Kategorie'])}` : '',
        str(r['Partner']) ? `Partner: ${str(r['Partner'])}` : '', str(r['Realizuje']) ? `Realizuje (Flowii): ${str(r['Realizuje']).trim()}` : '',
        num(r['Skutečné trvání / hod.']) ? `Skutečné trvání: ${num(r['Skutečné trvání / hod.'])} h` : ''].filter(Boolean);
      const createdAt = isoDateTime(r['Datum vytvoření']);
      out.push({
        organization_id: orgId, import_ref: `flowii:ukol:${number || hashKey(title, r['Datum vytvoření'], jobNumber)}`,
        title, description: descParts.join('\n'), status, priority: prioFor(r['Priorita']),
        assigned_to: this.user(r['Realizuje']),
        created_by: this.user(r['Přidal']) || userId,
        project_id: projectId, due_date: due,
        ...(createdAt ? { created_at: createdAt } : {}),
      });
    }
    const ids = await this.upsert('tasks', out, 'organization_id,import_ref', 'Úkoly');
    const open = out.filter(t => t.status === 'todo').length;
    this.log('info', `Úkoly: ${ids.size} (${open} otevřených, ${skipped} přeskočeno — zakázka mimo výběr).`);
    return { tasks: ids.size };
  }

  // ------------------------------------------------------------ události
  async importEvents(): Promise<ImportCounts> {
    const rows = this.files.events || [];
    const { orgId, userId } = this.opt;
    const { data: typeData } = await supabase.from('event_types').select('id, name').eq('organization_id', orgId);
    const typeByName = new Map<string, string>();
    for (const t of (typeData || []) as { id: string; name: string }[]) typeByName.set(norm(t.name), t.id);
    for (const name of new Set(rows.map(r => str(r['Typ události'])).filter(Boolean))) {
      if (typeByName.has(norm(name))) continue;
      const { data } = await supabase.from('event_types').insert({ organization_id: orgId, name, sort_order: 50 }).select('id').maybeSingle();
      if (data) typeByName.set(norm(name), data.id as string);
    }
    const out: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const typ = str(r['Typ události']); const kat = str(r['Kategorie události']); const partner = str(r['Partner']);
      const start = isoDate(r['Naplánováno od']) || isoDate(r['Datum realizace']);
      if (!start) continue;
      let ref = `flowii:udalost:${hashKey(typ, kat, partner, r['Naplánováno od'], r['Poznámka'])}`;
      while (seen.has(ref)) ref += '+';
      seen.add(ref);
      const creator = this.user(r['Realizátor (Jméno Příjmení)']) || userId;
      const startTime = isoTime(r['Naplánováno od']);
      out.push({
        organization_id: orgId, import_ref: ref,
        title: [[typ, kat].filter(Boolean).join(' – ') || 'Událost', partner].filter(Boolean).join(' · '),
        description: str(r['Poznámka']),
        notes: [str(r['Směr']) ? `Směr: ${str(r['Směr'])}` : '', isoDate(r['Datum realizace']) ? `Realizováno: ${isoDate(r['Datum realizace'])}` : ''].filter(Boolean).join(' · '),
        event_type_id: typeByName.get(norm(typ)) ?? null,
        start_date: start, end_date: isoDate(r['Naplánováno do']) || start,
        start_time: startTime, end_time: isoTime(r['Naplánováno do']),
        all_day: !startTime, location: '',
        project_id: this.projectFor(r['Číslo zakázky'], r['Zakázka']),
        created_by: creator, attendees: [creator],
      });
    }
    const ids = await this.upsert('events', out, 'organization_id,import_ref', 'Události');
    this.log('info', `Události: ${ids.size}.`);
    return { events: ids.size };
  }

  // ------------------------------------------------------------ doklady
  async importDocuments(): Promise<ImportCounts> {
    const rows = (this.files.documents || []).filter(r => this.firmOk(r['Firma']));
    const { orgId, userId } = this.opt;
    const ISSUED: Record<string, string> = {
      'Faktura': 'standard',
      'Zálohová faktura': 'deposit_invoice',
      'Faktura - daňový doklad k přijaté záloze': 'tax_document',
      'Faktura - vyúčtovací faktura': 'settlement_invoice',
      'Dobropis': 'credit_note',
    };
    const payFor = (s: string): string => {
      if (s.startsWith('Hotovost')) return 'cash';
      if (s === 'Kreditní karta') return 'card';
      return 'bank_transfer';
    };
    const issued: Record<string, unknown>[] = [];
    const issuedMeta = new Map<string, { number: string; subtotal: number; tax: number; total: number; vat: number }>();
    const received: Record<string, unknown>[] = [];
    const neededSuppliers = new Map<string, Row>();
    let skippedTypes = 0;

    for (const r of rows) {
      const typ = str(r['Typ']); const number = str(r['Číslo']); const firma = str(r['Firma']);
      if (!number) continue;
      const total = num(r['Celkem s DPH']); const subtotal = num(r['Celkem bez DPH']);
      const paidDate = isoDate(r['Datum úhrady']);
      const remaining = num(r['Zbývá uhradit']);
      const projectId = this.projectFor(r['Číslo zakázky'], undefined);
      const partner = str(r['Partner']);

      if (typ === 'Přijatá f.') {
        if (!this.opt.scope.received) continue;
        if (partner && !this.supplierByName.has(norm(partner)) && !neededSuppliers.has(norm(partner))) neededSuppliers.set(norm(partner), r);
        received.push({
          organization_id: orgId, created_by: userId, import_ref: `flowii:prijata:${number}:${norm(partner)}:${norm(firma)}`,
          supplier_name: partner, invoice_number: number,
          invoice_date: isoDate(r['Datum vystavení']) || isoDate(r['DUZP']) || '1970-01-01',
          due_date: isoDate(r['Datum splatnosti']) || isoDate(r['Datum vystavení']) || '1970-01-01',
          total_amount: total, tax_amount: total - subtotal,
          status: paidDate || (remaining === 0 && total !== 0) ? 'paid' : 'approved',
          paid_date: paidDate, paid_amount: paidDate ? total - remaining : null,
          project_id: projectId,
          note: [str(r['Interní poznámka']), `Import z Flowii (${firma})`, str(r['Variabilní symbol']) ? `VS ${str(r['Variabilní symbol'])}` : ''].filter(Boolean).join(' · '),
          _partner: partner,
        });
        continue;
      }
      const invType = ISSUED[typ];
      if (!invType) { skippedTypes++; continue; }
      if (!this.opt.scope.issued) continue;
      const vat = num(r['Základ - vyšší sazba DPH']) > 0 ? (num(r['Sazba DPH vyšší']) || 21)
        : num(r['Základ - nižší sazba DPH']) > 0 ? (num(r['Sazba DPH nižší']) || 12) : 0;
      const ref = `flowii:doklad:${invType}:${number}:${norm(firma)}`;
      const isPaid = !!paidDate || (remaining === 0 && total !== 0);
      issuedMeta.set(ref, { number, subtotal, tax: total - subtotal, total, vat });
      issued.push({
        organization_id: orgId, created_by: userId, import_ref: ref,
        invoice_number: number, invoice_type: invType,
        invoice_date: isoDate(r['Datum vystavení']) || '1970-01-01',
        taxable_date: isoDate(r['DUZP']) || isoDate(r['Datum vystavení']),
        due_date: isoDate(r['Datum splatnosti']) || isoDate(r['Datum vystavení']) || '1970-01-01',
        client_id: this.clientByName.get(norm(partner)) ?? null, project_id: projectId,
        client_name: partner, client_ico: str(r['IČO']), client_dic: str(r['DIČ']),
        client_address: [str(r['Ulice']), [str(r['PSČ']), str(r['Město'])].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        issuer_name: firma, issued_by: str(r['Vystavil']),
        variable_symbol: str(r['Variabilní symbol']), constant_symbol: str(r['Konstantní symbol']),
        payment_method: payFor(str(r['Způsob úhrady'])), bank_account: str(r['Účet']), iban: str(r['IBAN']),
        subtotal, tax_amount: total - subtotal, amount: total, total,
        currency: str(r['Měna']) || 'CZK',
        status: isPaid ? 'paid' : 'sent',
        paid_at: paidDate ? `${paidDate}T12:00:00.000Z` : null,
        paid_amount: isPaid ? total - remaining : 0,
        note: [str(r['Interní poznámka']), `Import z Flowii (${firma}) — ${typ}`, str(r['Číslo objednávky']) ? `Obj. ${str(r['Číslo objednávky'])}` : ''].filter(Boolean).join(' · '),
        _duzp: isoDate(r['DUZP']),
      });
    }

    // dodavatelé chybějící v číselníku (z přijatých faktur)
    const supRows: Record<string, unknown>[] = [];
    for (const [key, r] of neededSuppliers) {
      supRows.push({
        organization_id: orgId, created_by: userId, import_ref: `flowii:partner:${key}`,
        name: str(r['Partner']), ico: str(r['IČO']), dic: str(r['DIČ']),
        address: [str(r['Ulice']), [str(r['PSČ']), str(r['Město'])].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        email: '', phone: '', contact_person: '', default_due_days: 14, note: 'Založeno importem z Flowii (přijaté faktury)', is_active: true,
      });
    }
    if (supRows.length) {
      const supIds = await this.upsert('suppliers', supRows, 'organization_id,import_ref', 'Dodavatelé z faktur');
      for (const s of supRows) { const id = supIds.get(String(s.import_ref)); if (id) this.supplierByName.set(norm(String(s.name)), id); }
    }
    for (const r of received) {
      r.supplier_id = this.supplierByName.get(norm(String(r._partner))) ?? null;
      delete r._partner;
    }
    for (const r of issued) delete r._duzp;

    const counts: ImportCounts = {};
    if (issued.length) {
      const ids = await this.upsert('invoices', issued, 'organization_id,import_ref', 'Vydané faktury');
      counts.invoices = ids.size;
      // jedna souhrnná položka na doklad (rozpis položek export neobsahuje)
      const invoiceIds = [...ids.values()];
      for (let i = 0; i < invoiceIds.length; i += BATCH) {
        await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds.slice(i, i + BATCH));
      }
      const items: Record<string, unknown>[] = [];
      for (const [ref, id] of ids) {
        const m = issuedMeta.get(ref); if (!m) continue;
        this.invoiceByNumber.set(m.number, { id, total: m.total });
        items.push({
          invoice_id: id, description: `Fakturace dle dokladu ${m.number} (import z Flowii)`,
          quantity: 1, unit: 'ks', unit_price: m.subtotal, total_price: m.subtotal,
          vat_rate: m.vat, vat_amount: m.tax, sort_order: 0, section_name: null,
        });
      }
      for (let i = 0; i < items.length; i += BATCH) {
        const { error } = await supabase.from('invoice_items').insert(items.slice(i, i + BATCH));
        if (error) this.log('error', `invoice_items: ${error.message}`);
        this.progress('Položky faktur', Math.min(i + BATCH, items.length), items.length);
      }
      counts.invoice_items = items.length;
    }
    if (received.length) {
      const { count: legacy } = await supabase.from('received_invoices').select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).like('import_ref', 'flowii:doklad:prijata:%');
      if (legacy) {
        await supabase.from('received_invoices').delete().eq('organization_id', orgId).like('import_ref', 'flowii:doklad:prijata:%');
        this.log('warn', `Přijaté faktury: odstraněno ${legacy} řádků z dřívějšího běhu se starým klíčem (bez dodavatele) — nahradí je správné záznamy.`);
      }
      const ids = await this.upsert('received_invoices', received, 'organization_id,import_ref', 'Přijaté faktury');
      counts.received_invoices = ids.size;
      for (const r of received) {
        const id = ids.get(String(r.import_ref)); if (!id) continue;
        const entry = { id, total: Number(r.total_amount) };
        this.receivedByKey.set(`${String(r.invoice_number)}|${norm(String(r.supplier_name))}`, entry);
        if (!this.receivedByNumber.has(String(r.invoice_number))) this.receivedByNumber.set(String(r.invoice_number), entry);
      }
    }
    this.log('info', `Doklady: ${counts.invoices || 0} vydaných, ${counts.received_invoices || 0} přijatých faktur; ${skippedTypes} dokladů jiného typu (nabídky, objednávky, dodací listy) přeskočeno.`);
    return counts;
  }

  // ------------------------------------------------------------ příjmy a výdaje
  async importFinance(): Promise<ImportCounts> {
    const rows = (this.files.finance || []).filter(r => this.firmOk(r['Firma']));
    const { orgId, userId } = this.opt;
    const PAY_RE = /^Úhrada (přijaté |zálohové )?faktury č\.\s*(.+)$/i;

    const issuedPay = new Map<string, { sum: number; last: string | null; inv: { id: string; total: number } }>();
    const receivedPay = new Map<string, { sum: number; last: string | null; inv: { id: string; total: number } }>();
    const manual: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let matched = 0;

    for (const r of rows) {
      const incomeGross = num(r['Příjem s DPH']) || num(r['Příjem bez DPH']);
      const expenseGross = num(r['Výdaj s DPH']) || num(r['Výdaj bez DPH']);
      const isIncome = incomeGross > 0;
      const amount = isIncome ? incomeGross : expenseGross;
      if (!amount) continue;
      const date = isoDate(r['Datum úhrady']) || isoDate(r['Datum vytvoření']);
      const purpose = str(r['Účel']);
      const m = purpose.match(PAY_RE);
      if (m) {
        const number = m[2].trim();
        const key = isIncome ? number : `${number}|${norm(r['Partner'])}`;
        const found = isIncome ? this.invoiceByNumber.get(number)
          : (this.receivedByKey.get(key) || this.receivedByNumber.get(number));
        if (found) {
          const bucket = isIncome ? issuedPay : receivedPay;
          const bucketKey = isIncome ? number : found.id;
          const cur = bucket.get(bucketKey) || { sum: 0, last: null, inv: found };
          cur.sum += amount;
          if (date && (!cur.last || date > cur.last)) cur.last = date;
          bucket.set(bucketKey, cur);
          matched++;
          continue;
        }
      }
      let ref = `flowii:pv:${hashKey(r['Datum vytvoření'], purpose, String(amount), r['Partner'], r['Firma'])}`;
      while (seen.has(ref)) ref += '+';
      seen.add(ref);
      manual.push({
        org_id: orgId, created_by: userId, import_ref: ref,
        // živá DB má CHECK (type IN ('inflow','outflow')) — migrace v repu s 'in'/'out' je zastaralá
        date: date || '1970-01-01', type: isIncome ? 'inflow' : 'outflow', amount_gross: amount,
        title: purpose || str(r['Kategorie']) || (isIncome ? 'Příjem' : 'Výdaj'),
        note: [str(r['Kategorie']), str(r['Podkategorie']), str(r['Partner']), str(r['Poznámka']), str(r['Firma']) ? `(${str(r['Firma'])})` : ''].filter(Boolean).join(' · ') || null,
        project_id: this.projectFor(r['Číslo zakázky'], r['Zakázka']),
      });
    }

    let i = 0;
    for (const p of issuedPay.values()) {
      const inv = p.inv;
      const full = p.sum >= inv.total - 1;
      await supabase.from('invoices').update({
        status: full ? 'paid' : 'partial', paid_amount: Math.min(p.sum, inv.total),
        paid_at: p.last ? `${p.last}T12:00:00.000Z` : null,
      }).eq('id', inv.id);
      this.progress('Úhrady vydaných faktur', ++i, issuedPay.size);
    }
    i = 0;
    for (const p of receivedPay.values()) {
      const inv = p.inv;
      await supabase.from('received_invoices').update({
        status: p.sum >= inv.total - 1 ? 'paid' : 'approved', paid_amount: Math.min(p.sum, inv.total), paid_date: p.last,
      }).eq('id', inv.id);
      this.progress('Úhrady přijatých faktur', ++i, receivedPay.size);
    }
    const ids = await this.upsert('cashflow_manual_entries', manual, 'org_id,import_ref', 'Ostatní příjmy a výdaje');
    this.log('info', `Příjmy a výdaje: ${matched} úhrad spárováno s fakturami (${issuedPay.size} vydaných, ${receivedPay.size} přijatých), ${ids.size} ostatních pohybů do cashflow.`);
    return { payments_matched: matched, cashflow_manual_entries: ids.size };
  }
}
