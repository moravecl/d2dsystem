import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Trash2, FileDown, ChevronDown, ChevronUp, Calculator, DollarSign, Search, Package, Zap, Droplets, Flame, Wind, Lightbulb, Cable, Save, Wrench, Percent, Thermometer, Fan, Sun, Shield, Wifi, Tv, Home, Camera, RefreshCw, ArrowUp, ArrowDown, CreditCard as Edit3, Check } from 'lucide-react';
import type { Product, Category, Material } from '../../types/database';
import type { SelectionState, ProjectMeta, Floor } from '../../hooks/useProjectState';
import type { HeatingSystemFull } from '../../hooks/useHeatingSystems';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { loadQuoteClientInfo, loadQuoteCompanyInfo, buildQuoteHeaderHtml, type QuoteClientInfo, type QuoteCompanyInfo } from '../../lib/quoteHeaderHtml';
import {
  type QuoteData, type QuoteItem, type QuoteSection,
  type QuoteAttachment, type QuoteSystemSummary, type QuoteSourceMeta,
  getSectionColor, buildSectionsFromCatalog, buildSchematicQuoteSections, mergeSectionLists,
  calcItemTotal, calcSectionTotal, calcSectionCostTotal,
  TRADE_OPTIONS, COLOR_PRESETS,
} from './quoteHelpers';
import FvImportModal, { type FvImportResult } from './FvImportModal';
import CameraImportModal, { type CameraImportResult } from './CameraImportModal';
import EpsImportModal, { type EpsImportResult } from './EpsImportModal';
import QuoteAttachmentsPanel from './QuoteAttachmentsPanel';
import QuoteNotesEditor from './QuoteNotesEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  selected: SelectionState;
  meta: ProjectMeta;
  floors: Floor[];
  materials: Material[];
  heatingSystems: HeatingSystemFull[];
  projectId?: string;
  onSaved?: () => void;
  loadQuoteId?: string | null;
  designElements?: import('../../types/designElements').ProjectDesignElement[];
  elementTypes?: import('../../types/designElements').DesignElementType[];
  productAssignments?: import('../../types/designElements').ProductAssignment[];
  mountingGroups?: import('../../hooks/useMountingGroups').MountingGroupWithSlots[];
  designSeriesLinks?: import('../../types/designElements').DesignSeriesProductLink[];
  productKindMap?: Map<string, string>;
}

const ICON_MAP: Record<string, typeof Zap> = {
  package: Package, zap: Zap, droplets: Droplets, flame: Flame, wind: Wind,
  lightbulb: Lightbulb, cable: Cable, wrench: Wrench, thermometer: Thermometer,
  fan: Fan, sun: Sun, shield: Shield, wifi: Wifi, tv: Tv, home: Home, camera: Camera,
};

const TRADE_ICON_KEY: Record<string, string> = {
  electric: 'zap', water: 'droplets', heating: 'flame',
  recuperation: 'wind', lighting: 'lightbulb', fotovoltaika: 'sun', camera: 'camera', eps: 'shield',
};

const ICON_OPTIONS = Object.entries(ICON_MAP).map(([key, Icon]) => ({ key, Icon }));

function getSectionIconComponent(section: { icon?: string; trade?: string }): typeof Zap {
  if (section.icon && ICON_MAP[section.icon]) return ICON_MAP[section.icon];
  const tradeKey = TRADE_ICON_KEY[section.trade || ''];
  if (tradeKey && ICON_MAP[tradeKey]) return ICON_MAP[tradeKey];
  return Package;
}

function SectionCustomizer({
  section, onUpdate, onClose,
}: {
  section: QuoteSection;
  onUpdate: (updates: Partial<QuoteSection>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const currentIcon = section.icon || TRADE_ICON_KEY[section.trade || ''] || 'package';

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 bg-navy-800/60 rounded-xl shadow-2xl border border-white/10 p-3 z-50 w-64"
      onClick={e => e.stopPropagation()}>
      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Ikona</div>
      <div className="grid grid-cols-5 gap-1 mb-3">
        {ICON_OPTIONS.map(({ key, Icon }) => (
          <button key={key} onClick={() => onUpdate({ icon: key })} title={key}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
              currentIcon === key ? 'bg-blue-500/20 text-blue-400 ring-2 ring-blue-400' : 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.06]'
            }`}>
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Barva</div>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PRESETS.map((c) => (
          <button key={c.key} onClick={() => onUpdate({ color: c.key })}
            className={`w-7 h-7 rounded-full transition ring-offset-1 ${
              section.color === c.key ? 'ring-2 ring-slate-400 scale-110' : 'hover:scale-110'
            }`}
            style={{ background: c.accent }} title={c.key} />
        ))}
      </div>
    </div>
  );
}

function ProductPickerDropdown({
  products, categories, onAdd, onClose,
}: {
  products: Product[];
  categories: Category[];
  onAdd: (product: Product) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.slice(0, 30);
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [products, search]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-navy-800/60 rounded-2xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b bg-white/[0.04] flex items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold text-white">Vybrat z ceníku</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat podle názvu, kódu, značky..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">Nic nenalezeno</div>
          ) : filtered.map((product) => {
            const cat = categories.find((c) => c.id === product.category_id);
            return (
              <button key={product.id} onClick={() => onAdd(product)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition text-left group">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] shrink-0 flex items-center justify-center overflow-hidden">
                  {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-white truncate">{product.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {product.code} {product.brand && `| ${product.brand}`} {cat && ` | ${cat.name}`}
                    {product.lumens > 0 && ` | ${product.lumens} lm`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-extrabold text-white">{product.price ? `${product.price.toLocaleString('cs-CZ')} Kč` : '-'}</div>
                </div>
                <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TRADE_LABELS: Record<string, string> = {
  electric: 'Elektro',
  water: 'Voda',
  heating: 'Topení',
  recuperation: 'Rekuperace',
};

function MaterialPickerDropdown({
  materials, onAdd, onClose,
}: {
  materials: Material[];
  onAdd: (material: Material) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filterTrade, setFilterTrade] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return materials.filter((m) => {
      if (filterTrade !== 'all' && m.trade !== filterTrade) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q);
    }).slice(0, 40);
  }, [materials, search, filterTrade]);

  const tradeIcons: Record<string, typeof Zap> = { electric: Zap, water: Droplets, heating: Flame, recuperation: Wind };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-navy-800/60 rounded-2xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b bg-white/[0.04] flex items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-slate-500" />
            Vybrat z materiálů
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="px-4 pt-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat materiál..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterTrade('all')}
              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg transition ${
                filterTrade === 'all' ? 'bg-slate-900 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
              }`}>Vše</button>
            {Object.entries(TRADE_LABELS).map(([val, label]) => (
              <button key={val} onClick={() => setFilterTrade(val)}
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg transition ${
                  filterTrade === val ? 'bg-slate-900 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
                }`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">Nic nenalezeno</div>
          ) : filtered.map((mat) => {
            const TIcon = tradeIcons[mat.trade] || Package;
            return (
              <button key={mat.id} onClick={() => onAdd(mat)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition text-left group">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] shrink-0 flex items-center justify-center">
                  {mat.material_type === 'fitting'
                    ? <Wrench className="w-4 h-4 text-slate-400" />
                    : <TIcon className="w-4 h-4 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-white truncate">{mat.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {TRADE_LABELS[mat.trade] || mat.trade}
                    {mat.material_type === 'fitting' && ' | Tvarovka'}
                    {` | ${mat.unit}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-extrabold text-white">{mat.price_per_unit ? `${mat.price_per_unit.toLocaleString('cs-CZ')} Kč` : '-'}</div>
                </div>
                <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function generateChangelog(prevSections: QuoteData['sections'], nextSections: QuoteData['sections']): string {
  const changes: string[] = [];
  const prevMap = new Map<string, { name: string; qty: number; price: number }>();
  for (const sec of prevSections) {
    for (const item of sec.items) {
      const key = item.code || item.name;
      const existing = prevMap.get(key);
      if (existing) existing.qty += item.quantity;
      else prevMap.set(key, { name: item.name, qty: item.quantity, price: item.sellingPrice });
    }
  }
  const nextMap = new Map<string, { name: string; qty: number; price: number }>();
  for (const sec of nextSections) {
    for (const item of sec.items) {
      const key = item.code || item.name;
      const existing = nextMap.get(key);
      if (existing) existing.qty += item.quantity;
      else nextMap.set(key, { name: item.name, qty: item.quantity, price: item.sellingPrice });
    }
  }
  for (const [key, val] of nextMap) {
    const prev = prevMap.get(key);
    if (!prev) changes.push(`+ ${val.name} (${val.qty} ks)`);
    else {
      if (val.qty !== prev.qty) changes.push(`${val.name}: ${prev.qty} \u2192 ${val.qty} ks`);
      if (val.price !== prev.price) changes.push(`${val.name}: cena ${prev.price} \u2192 ${val.price}`);
    }
  }
  for (const [key, val] of prevMap) {
    if (!nextMap.has(key)) changes.push(`- ${val.name}`);
  }
  const prevSecNames = new Set(prevSections.map(s => s.name));
  const nextSecNames = new Set(nextSections.map(s => s.name));
  for (const name of nextSecNames) if (!prevSecNames.has(name)) changes.push(`+ sekce "${name}"`);
  for (const name of prevSecNames) if (!nextSecNames.has(name)) changes.push(`- sekce "${name}"`);
  return changes.slice(0, 10).join('; ') || 'Bez výrazných změn';
}

export default function QuoteBuilder({ open, onClose, products, categories, selected, meta, floors, materials, heatingSystems, projectId, onSaved, loadQuoteId, designElements = [], elementTypes = [], productAssignments = [], mountingGroups = [], designSeriesLinks = [], productKindMap = new Map() }: Props) {
  const [quoteData, setQuoteData] = useState<QuoteData>({ sections: [], globalDiscount: 0, globalVatRate: 21 });
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionTrade, setNewSectionTrade] = useState('electric');
  const [showAddSection, setShowAddSection] = useState(false);
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null);
  const [materialPickerSectionId, setMaterialPickerSectionId] = useState<string | null>(null);
  const [customizerSectionId, setCustomizerSectionId] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
  const [currentQuoteVersion, setCurrentQuoteVersion] = useState<number | null>(null);
  const [showFvImport, setShowFvImport] = useState(false);
  const [showCameraImport, setShowCameraImport] = useState(false);
  const [showEpsImport, setShowEpsImport] = useState(false);
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([]);
  const [summaries, setSummaries] = useState<QuoteSystemSummary[]>([]);
  const [sourceMeta, setSourceMeta] = useState<QuoteSourceMeta>({ sourceType: 'manual' });
  const [quoteClient, setQuoteClient] = useState<QuoteClientInfo | null>(null);
  const [quoteCompany, setQuoteCompany] = useState<QuoteCompanyInfo | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const didAutoImport = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (projectId) loadQuoteClientInfo(projectId).then(setQuoteClient);
    loadQuoteCompanyInfo().then(setQuoteCompany);
  }, [open, projectId]);

  useEffect(() => {
    if (!open) {
      didAutoImport.current = false;
      return;
    }
    if (loadQuoteId) {
      setCurrentQuoteId(loadQuoteId);
      (async () => {
        const { data } = await supabase
          .from('project_quotes')
          .select('sections_data, source_metadata, attachments, version')
          .eq('id', loadQuoteId)
          .maybeSingle();
        if (data?.sections_data) {
          const parsed = data.sections_data as any;
          const sections = Array.isArray(parsed) ? parsed : (parsed.sections ?? []);
          const globalDiscount = Array.isArray(parsed) ? 0 : (parsed.globalDiscount ?? 0);
          const globalVatRate = Array.isArray(parsed) ? 21 : (parsed.globalVatRate ?? 21);
          const notes = Array.isArray(parsed) ? '' : (parsed.notes ?? '');
          setQuoteData({ sections, globalDiscount, globalVatRate, notes });
        }
        if (data?.attachments) {
          const att = data.attachments as any;
          setAttachments(att.images ?? []);
          setSummaries(att.summaries ?? []);
        }
        if (data?.source_metadata) {
          setSourceMeta(data.source_metadata as QuoteSourceMeta);
        }
        if (data?.version != null) {
          setCurrentQuoteVersion(data.version as number);
        }
      })();
    } else if (!didAutoImport.current) {
      setCurrentQuoteId(null);
      setCurrentQuoteVersion(null);
      didAutoImport.current = true;
      setAttachments([]);
      setSummaries([]);
      setSourceMeta({ sourceType: 'manual' });
      (async () => {
        const catalogSections = await buildSectionsFromCatalog(selected, products, categories, materials, floors, heatingSystems);
        const allRooms = floors.flatMap(f => (f.rooms ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
        const { sections: schematicSections } = buildSchematicQuoteSections({
          designElements,
          elementTypes,
          assignments: productAssignments,
          mountingGroups,
          designSeriesLinks,
          products,
          productKindMap,
          rooms: allRooms,
          floors,
        });
        const merged = mergeSectionLists(catalogSections, schematicSections);
        if (merged.length > 0) setQuoteData({ sections: merged });
      })();
    }
  }, [open, loadQuoteId]);

  const saveQuote = (data: QuoteData) => {
    setQuoteData(data);
  };

  const importFromCatalog = async () => {
    const catalogSections = await buildSectionsFromCatalog(selected, products, categories, materials, floors, heatingSystems);
    const allRooms = floors.flatMap(f => (f.rooms ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
    const { sections: schematicSections } = buildSchematicQuoteSections({
      designElements,
      elementTypes,
      assignments: productAssignments,
      mountingGroups,
      designSeriesLinks,
      products,
      productKindMap,
      rooms: allRooms,
      floors,
    });
    const merged = mergeSectionLists(catalogSections, schematicSections);
    if (merged.length === 0) return;
    saveQuote({ sections: merged });
  };

  const handleFvImport = (section: QuoteSection, meta?: FvImportResult) => {
    const filtered = quoteData.sections.filter(s => s.trade !== 'fotovoltaika');
    saveQuote({ ...quoteData, sections: [...filtered, section] });

    if (meta) {
      const existingNonFv = attachments.filter(a => a.type !== 'roof_snapshot');
      setAttachments([...existingNonFv, ...meta.attachments]);

      const existingNonFvSummaries = summaries.filter(s => s.type !== 'fve');
      setSummaries([...existingNonFvSummaries, meta.summary]);

      setSourceMeta(prev => {
        const hasCam = prev.cameraDesignId;
        return {
          ...prev,
          sourceType: hasCam ? 'mixed' : 'fve',
          fvDesignId: meta.designId,
          fvVersionId: meta.versionId,
          summaries: [...existingNonFvSummaries, meta.summary],
        };
      });
    }
  };

  const handleCameraImport = (section: QuoteSection, meta?: CameraImportResult) => {
    const filtered = quoteData.sections.filter(s => s.trade !== 'camera');
    saveQuote({ ...quoteData, sections: [...filtered, section] });

    if (meta) {
      const existingNonCam = attachments.filter(a => a.type !== 'camera_layout');
      setAttachments([...existingNonCam, ...meta.attachments]);

      const existingNonCamSummaries = summaries.filter(s => s.type !== 'camera');
      setSummaries([...existingNonCamSummaries, meta.summary]);

      setSourceMeta(prev => {
        const hasFv = prev.fvDesignId;
        return {
          ...prev,
          sourceType: hasFv ? 'mixed' : 'camera',
          cameraDesignId: meta.designId,
          cameraVersionId: meta.versionId,
          summaries: [...existingNonCamSummaries, meta.summary],
        };
      });
    }
  };

  const addSection = () => {
    if (!newSectionName.trim()) return;
    saveQuote({
      ...quoteData,
      sections: [...quoteData.sections, {
        id: crypto.randomUUID(), name: newSectionName.trim(), items: [],
        trade: newSectionTrade,
      }],
    });
    setNewSectionName('');
    setNewSectionTrade('electric');
    setShowAddSection(false);
  };

  const updateSections = (sections: QuoteSection[]) => {
    saveQuote({ ...quoteData, sections });
  };

  const removeSection = (sectionId: string) => {
    if (!confirm('Smazat sekci?')) return;
    updateSections(quoteData.sections.filter((s) => s.id !== sectionId));
  };

  const toggleSection = (sectionId: string) => {
    updateSections(quoteData.sections.map((s) =>
      s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s
    ));
  };

  const updateSection = (sectionId: string, updates: Partial<QuoteSection>) => {
    updateSections(quoteData.sections.map((s) =>
      s.id === sectionId ? { ...s, ...updates } : s
    ));
  };

  const addItem = (sectionId: string) => {
    updateSections(quoteData.sections.map((s) =>
      s.id === sectionId ? { ...s, items: [...s.items, {
        id: crypto.randomUUID(), code: '', name: '', unit: 'ks',
        quantity: 1, sellingPrice: 0, costPrice: 0,
      }] } : s
    ));
  };

  const addProductToSection = (sectionId: string, product: Product) => {
    updateSections(quoteData.sections.map((s) =>
      s.id === sectionId ? { ...s, items: [...s.items, {
        id: crypto.randomUUID(), code: product.code, name: product.name,
        unit: 'ks', quantity: 1, sellingPrice: product.price || 0,
        costPrice: product.purchase_price || 0, productId: product.id,
      }] } : s
    ));
    setPickerSectionId(null);
  };

  const addMaterialToSection = (sectionId: string, material: Material) => {
    updateSections(quoteData.sections.map((s) =>
      s.id === sectionId ? { ...s, items: [...s.items, {
        id: crypto.randomUUID(), code: '', name: material.name,
        unit: material.unit, quantity: 1, sellingPrice: material.price_per_unit || 0,
        costPrice: material.purchase_price || (material.price_per_unit * 0.7) || 0,
      }] } : s
    ));
    setMaterialPickerSectionId(null);
  };

  const updateItem = (sectionId: string, itemId: string, updates: Partial<QuoteItem>) => {
    updateSections(quoteData.sections.map((s) =>
      s.id === sectionId
        ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)) }
        : s
    ));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    updateSections(quoteData.sections.map((s) =>
      s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s
    ));
  };

  const moveSectionUp = (index: number) => {
    if (index <= 0) return;
    const arr = [...quoteData.sections];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    updateSections(arr);
  };

  const moveSectionDown = (index: number) => {
    if (index >= quoteData.sections.length - 1) return;
    const arr = [...quoteData.sections];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    updateSections(arr);
  };

  const moveItemUp = (sectionId: string, itemIndex: number) => {
    if (itemIndex <= 0) return;
    updateSections(quoteData.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const items = [...s.items];
      [items[itemIndex - 1], items[itemIndex]] = [items[itemIndex], items[itemIndex - 1]];
      return { ...s, items };
    }));
  };

  const moveItemDown = (sectionId: string, itemIndex: number) => {
    updateSections(quoteData.sections.map((s) => {
      if (s.id !== sectionId) return s;
      if (itemIndex >= s.items.length - 1) return s;
      const items = [...s.items];
      [items[itemIndex], items[itemIndex + 1]] = [items[itemIndex + 1], items[itemIndex]];
      return { ...s, items };
    }));
  };

  const startRenamingSection = (section: QuoteSection, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
  };

  const finishRenamingSection = () => {
    if (editingSectionId && editingSectionName.trim()) {
      updateSection(editingSectionId, { name: editingSectionName.trim() });
    }
    setEditingSectionId(null);
    setEditingSectionName('');
  };

  const applyGlobalVat = (rate: number) => {
    const updated = quoteData.sections.map(s => ({
      ...s,
      items: s.items.map(i => ({ ...i, vatRate: rate })),
    }));
    saveQuote({ ...quoteData, sections: updated, globalVatRate: rate });
  };

  const handleSaveToDb = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const sectionsPayload = { sections: quoteData.sections, globalDiscount: quoteData.globalDiscount || 0, globalVatRate: quoteData.globalVatRate ?? 21, notes: quoteData.notes || '' };
      const attachPayload = (attachments.length > 0 || summaries.length > 0) ? { images: attachments, summaries } : null;

      if (saveMode === 'overwrite' && currentQuoteId) {
        const { error } = await supabase
          .from('project_quotes')
          .update({
            note: saveNote,
            changelog: 'Aktualizace stavajici verze',
            sections_data: sectionsPayload,
            total_selling: Number.isFinite(totals.totalSelling) ? totals.totalSelling : 0,
            total_cost: Number.isFinite(totals.totalCost) ? totals.totalCost : 0,
            source_type: sourceMeta.sourceType !== 'manual' ? sourceMeta.sourceType : null,
            source_metadata: sourceMeta.sourceType !== 'manual' ? sourceMeta : null,
            attachments: attachPayload,
          })
          .eq('id', currentQuoteId);
        if (error) throw error;
        toast('Nabídka aktualizována');
      } else {
        const { data: existing } = await supabase
          .from('project_quotes')
          .select('version, sections_data, quote_number')
          .eq('project_id', projectId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersion = (existing?.version ?? 0) + 1;
        const quoteNumber = existing?.quote_number
          ? existing.quote_number.replace(/v\d+$/, `v${nextVersion}`)
          : `HN-${Date.now().toString(36).toUpperCase().slice(-6)}-v${nextVersion}`;

        let prevSections: QuoteData['sections'] = [];
        if (existing?.sections_data) {
          const raw = existing.sections_data as any;
          prevSections = Array.isArray(raw) ? raw : (raw.sections ?? []);
        }
        const changelog = prevSections.length > 0
          ? generateChangelog(prevSections, quoteData.sections)
          : 'První verze nabídky';

        const { error } = await supabase.from('project_quotes').insert({
          project_id: projectId,
          version: nextVersion,
          quote_number: quoteNumber,
          note: saveNote,
          changelog,
          sections_data: sectionsPayload,
          total_selling: Number.isFinite(totals.totalSelling) ? totals.totalSelling : 0,
          total_cost: Number.isFinite(totals.totalCost) ? totals.totalCost : 0,
          created_by: user?.id ?? null,
          source_type: sourceMeta.sourceType !== 'manual' ? sourceMeta.sourceType : null,
          source_metadata: sourceMeta.sourceType !== 'manual' ? sourceMeta : null,
          attachments: attachPayload,
        });
        if (error) throw error;
        toast('Nabídka uložena jako nová verze');
      }
      setSaveNote('');
      setShowSaveForm(false);
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast(err.message || 'Chyba při ukládání', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAttachment = (id: string, updates: Partial<QuoteAttachment>) => {
    setAttachments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateSummary = (index: number, key: string, value: string | number) => {
    setSummaries(prev => prev.map((s, i) => i === index ? { ...s, data: { ...s.data, [key]: value } } : s));
  };

  const handleEpsImport = (section: QuoteSection, meta?: EpsImportResult) => {
    const filtered = quoteData.sections.filter(s => s.trade !== 'eps');
    saveQuote({ ...quoteData, sections: [...filtered, section] });

    if (meta) {
      const existingAtt = attachments.filter(a => !a.label.startsWith('EPS/EZS'));
      setAttachments([...existingAtt, ...meta.attachments]);

      const existingNonEps = summaries.filter(s => s.type !== 'eps');
      setSummaries([...existingNonEps, meta.summary]);

      setSourceMeta(prev => {
        const hasOther = prev.fvDesignId || prev.cameraDesignId;
        return {
          ...prev,
          sourceType: hasOther ? 'mixed' : 'eps',
          epsDesignId: meta.designId,
          summaries: [...existingNonEps, meta.summary],
        };
      });
    }
  };

  const hasFvSource = sourceMeta.fvDesignId != null;
  const hasCameraSource = sourceMeta.cameraDesignId != null;
  const hasEpsSource = sourceMeta.epsDesignId != null;

  const totals = useMemo(() => {
    let totalSelling = 0, totalCost = 0;
    let totalVat = 0;
    quoteData.sections.forEach((s) => {
      const secTotal = calcSectionTotal(s);
      totalSelling += secTotal;
      totalCost += calcSectionCostTotal(s);
      s.items.forEach(item => {
        const itemTotal = calcItemTotal(item);
        const rate = item.vatRate ?? quoteData.globalVatRate ?? 21;
        totalVat += itemTotal * (rate / 100);
      });
    });
    const totalBeforeDiscount = totalSelling;
    const gd = quoteData.globalDiscount || 0;
    if (gd > 0) {
      totalSelling = totalSelling * (1 - gd / 100);
      totalVat = totalVat * (1 - gd / 100);
    }
    const discountAmount = totalBeforeDiscount - totalSelling;
    const profit = totalSelling - totalCost;
    const margin = totalSelling > 0 ? (profit / totalSelling) * 100 : 0;
    const totalWithVat = totalSelling + totalVat;
    return { totalSelling, totalCost, profit, margin, totalVat, totalWithVat, totalBeforeDiscount, discountAmount };
  }, [quoteData]);

  const fmt = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const exportPDF = () => {
    const projectName = meta.project || 'Projekt';
    const dateStr = new Date().toLocaleDateString('cs-CZ');
    const totalItems = quoteData.sections.reduce((s, sec) => s + sec.items.length, 0);
    const gd = quoteData.globalDiscount || 0;
    const hasGlobalDiscount = gd > 0;

    let globalIdx = 0;
    const sectionTables = quoteData.sections.map((section, sIdx) => {
      const sc = getSectionColor(section.trade, section.color);
      const secTotal = calcSectionTotal(section);
      const rawTotal = section.items.reduce((s, i) => s + calcItemTotal(i), 0);
      const rows = section.items.map((item) => {
        globalIdx++;
        const lineTotal = calcItemTotal(item);
        const discountLabel = (item.discount ?? 0) > 0 ? `<span class="disc-tag">-${item.discount}%</span>` : '';
        return `<tr class="${globalIdx % 2 === 0 ? 'row-even' : ''}">
          <td class="c-num">${globalIdx}.</td>
          <td class="c-desc">${item.code ? `<span class="code-tag">${item.code}</span>` : ''}${item.name || '-'}${item.isAutoMaterial ? '<span class="auto-tag">auto</span>' : ''}${discountLabel}</td>
          <td class="c-unit">${item.unit}</td>
          <td class="c-qty">${fmt(item.quantity)}</td>
          <td class="c-price">${fmt(item.sellingPrice)}</td>
          <td class="c-total">${fmt(lineTotal)}</td>
        </tr>`;
      }).join('');

      const discountRow = (section.discount ?? 0) > 0
        ? `<tr class="sec-foot"><td colspan="5" style="border-left: 4px solid ${sc.accent}; color: #dc2626;">Sleva na sekci: -${section.discount}%</td><td class="c-total" style="color: #dc2626">-${fmt(rawTotal - secTotal)} Kč</td></tr>`
        : '';

      return `<div class="section-block">
        <table class="main"><tbody>
        <tr class="sec-head"><td colspan="6" style="background:${sc.bg}; border-left: 4px solid ${sc.accent}; color:${sc.text}"><span class="sec-num" style="background:${sc.accent}">${sIdx + 1}</span>${section.name}</td></tr>
        ${rows}
        ${discountRow}
        <tr class="sec-foot"><td colspan="5" style="border-left: 4px solid ${sc.accent}">Mezisoučet ${section.name}</td><td class="c-total">${fmt(secTotal)} Kč</td></tr>
        </tbody></table></div>`;
    }).join('');

    const recapRows = quoteData.sections.map((section, sIdx) => {
      const sc = getSectionColor(section.trade, section.color);
      const sTotal = calcSectionTotal(section);
      return `<tr><td style="border-left:4px solid ${sc.accent}; padding-left:12px"><span class="recap-dot" style="background:${sc.accent}"></span>${sIdx + 1}. ${section.name}${(section.discount ?? 0) > 0 ? ` <span style="color:#dc2626; font-size:9px;">(-${section.discount}%)</span>` : ''}</td><td class="recap-val">${fmt(sTotal)} Kč</td></tr>`;
    }).join('');

    const gtRows: string[] = [];
    if (hasGlobalDiscount) {
      gtRows.push(`<div class="gt-row"><div class="gt-row-label">Cena bez DPH</div><div class="gt-row-val">${fmt(totals.totalBeforeDiscount)} Kč</div></div>`);
      gtRows.push(`<div class="gt-row gt-row-discount"><div class="gt-row-label">Sleva ${gd}%</div><div class="gt-row-val">-${fmt(totals.discountAmount)} Kč</div></div>`);
      gtRows.push(`<div class="gt-row gt-row-sep"><div class="gt-row-label" style="font-weight:700">Cena po sleve bez DPH</div><div class="gt-row-val" style="font-weight:800">${fmt(totals.totalSelling)} Kč</div></div>`);
    } else {
      gtRows.push(`<div class="gt-row"><div class="gt-row-label">Cena bez DPH</div><div class="gt-row-val" style="font-weight:800">${fmt(totals.totalSelling)} Kč</div></div>`);
    }
    gtRows.push(`<div class="gt-row gt-row-sep" style="opacity:0.7"><div class="gt-row-label">DPH</div><div class="gt-row-val">+ ${fmt(totals.totalVat)} Kč</div></div>`);
    gtRows.push(`<div class="gt-row gt-row-final"><div class="gt-row-label">Celkova cena s DPH</div><div class="gt-row-val">${fmt(totals.totalWithVat)} Kč</div></div>`);

    const notesHtml = quoteData.notes && quoteData.notes.replace(/<[^>]*>/g, '').trim()
      ? `<div class="notes-section"><h3 class="notes-title">Poznamky</h3><div class="notes-content">${quoteData.notes}</div></div>`
      : '';

    const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8">
<title>Cenova nabidka - ${projectName}</title>
<style>
@page { margin: 18mm 14mm 22mm 14mm; size: A4; }
@media print { .no-print { display: none !important; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a2e; font-size: 10.5px; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { max-width: 800px; margin: 0 auto; padding: 0 10px; }
.brand-bar { height: 5px; background: linear-gradient(90deg, #0f172a 0%, #1e40af 40%, #3b82f6 70%, #93c5fd 100%); margin-bottom: 28px; border-radius: 0 0 3px 3px; }
.hdr { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 1px solid #e2e8f0; }
.hdr-left .doc-type { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 4px; }
.hdr-left h1 { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.15; }
.hdr-right { text-align: right; }
.hdr-right .field { margin-bottom: 6px; }
.hdr-right .field-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 700; }
.hdr-right .field-value { font-size: 12px; font-weight: 700; color: #0f172a; }
.info-row { display: flex; gap: 12px; margin-bottom: 22px; }
.info-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; background: #fafbfc; }
.info-card .lbl { font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 700; margin-bottom: 1px; }
.info-card .val { font-size: 12px; font-weight: 700; color: #0f172a; }
.section-block { page-break-inside: avoid; break-inside: avoid; }
table.main { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
table.main th { background: #0f172a; color: #fff; padding: 9px 10px; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; }
table.main td { padding: 7px 10px; border-bottom: 1px solid #eef0f4; font-size: 10.5px; vertical-align: middle; }
.row-even td { background: #fafbfc; }
.c-num { width: 32px; text-align: center; color: #94a3b8; font-weight: 600; font-size: 10px; }
.c-desc { font-weight: 500; }
.c-unit { width: 42px; text-align: center; color: #64748b; }
.c-qty { width: 55px; text-align: right; font-weight: 600; }
.c-price { width: 80px; text-align: right; color: #475569; }
.c-total { width: 90px; text-align: right; font-weight: 700; color: #0f172a; }
.code-tag { display: inline-block; background: #e8ecf1; color: #475569; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-right: 5px; font-family: 'SF Mono', 'Consolas', monospace; }
.auto-tag { display: inline-block; background: #dbeafe; color: #1d4ed8; font-size: 8px; font-weight: 700; padding: 0 4px; border-radius: 3px; margin-left: 5px; }
.disc-tag { display: inline-block; background: #fef2f2; color: #dc2626; font-size: 8px; font-weight: 700; padding: 0 4px; border-radius: 3px; margin-left: 5px; }
.sec-head td { font-weight: 800; font-size: 11.5px; padding: 10px; border-bottom: 2px solid #cbd5e1; letter-spacing: -0.2px; }
.sec-num { display: inline-block; color: #fff; font-size: 9px; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 4px; margin-right: 8px; font-weight: 800; }
.sec-foot td { background: #f8fafc !important; font-weight: 700; font-size: 10px; color: #475569; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; }
.recap { margin-top: 20px; margin-bottom: 4px; page-break-inside: avoid; break-inside: avoid; }
.recap h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 8px; }
table.recap-tbl { width: 100%; border-collapse: collapse; }
table.recap-tbl td { padding: 7px 10px; border-bottom: 1px solid #eef0f4; font-size: 10.5px; }
table.recap-tbl .recap-val { text-align: right; font-weight: 700; width: 120px; }
.recap-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
.grand-total { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; border-radius: 8px; padding: 16px 22px; margin-top: 12px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid; }
.gt-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
.gt-row-label { font-size: 11px; font-weight: 500; }
.gt-row-val { font-size: 13px; font-weight: 600; }
.gt-row-discount { color: #fca5a5; }
.gt-row-sep { border-top: 1px solid rgba(255,255,255,0.15); margin-top: 4px; padding-top: 8px; }
.gt-row-final { border-top: 2px solid rgba(255,255,255,0.3); margin-top: 6px; padding-top: 10px; }
.gt-row-final .gt-row-label { font-size: 14px; font-weight: 700; }
.gt-row-final .gt-row-val { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
.notes-section { margin-top: 20px; page-break-inside: avoid; break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; background: #fafbfc; }
.notes-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 10px; }
.notes-content { font-size: 10.5px; line-height: 1.7; color: #334155; }
.notes-content b, .notes-content strong { font-weight: 700; color: #0f172a; }
.notes-content ul, .notes-content ol { padding-left: 20px; margin-bottom: 8px; }
.notes-content li { margin-bottom: 3px; }
.notes-content p { margin-bottom: 6px; }
.footer-bar { border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
.footer-bar .fl { font-size: 9px; color: #94a3b8; }
.footer-bar .fr { font-size: 9px; color: #94a3b8; font-weight: 600; }
</style></head><body><div class="page">
<div class="brand-bar"></div>
<div class="hdr"><div class="hdr-left"><div class="doc-type">Cenova nabidka</div><h1>${projectName}</h1></div>
<div class="hdr-right"><div class="field"><div class="field-label">Datum vystaveni</div><div class="field-value">${dateStr}</div></div>
<div class="field"><div class="field-label">Cislo nabidky</div><div class="field-value">HN-${Date.now().toString(36).toUpperCase().slice(-6)}</div></div></div></div>
${buildQuoteHeaderHtml(quoteCompany, quoteClient, '#1e40af')}
<div class="info-row"><div class="info-card"><div class="lbl">Projekt</div><div class="val">${projectName}</div></div>
<div class="info-card"><div class="lbl">Polozek</div><div class="val">${totalItems}</div></div>
<div class="info-card"><div class="lbl">Sekci</div><div class="val">${quoteData.sections.length}</div></div></div>
${sectionTables}
<div class="recap"><h3>Rekapitulace</h3><table class="recap-tbl">${recapRows}</table></div>
<div class="grand-total">${gtRows.join('')}</div>
${notesHtml}
<div class="footer-bar"><div class="fl">Vygenerovano: ${dateStr} | HouseSmart</div>
<div class="fr">Platnost nabidky: 30 dni</div></div>
</div></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) { w.onload = () => { setTimeout(() => w.print(), 400); }; }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-2 sm:p-4 animate-backdrop-enter">
      <div className="bg-navy-800/60 rounded-3xl max-w-[98vw] w-full max-h-[95vh] overflow-hidden shadow-2xl flex flex-col animate-modal-enter">
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Cenova nabidka</div>
              <div className="text-lg font-extrabold text-white flex items-center gap-3 mt-0.5">
                <span>Polozky projektu</span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" /> {fmtInt(totals.totalSelling)} Kc
                  </span>
                  {totals.totalVat > 0 && (
                    <span className="text-slate-400 text-xs">+ {fmtInt(totals.totalVat)} DPH = <span className="text-emerald-300 font-extrabold">{fmtInt(totals.totalWithVat)} Kc</span></span>
                  )}
                  <span className="text-slate-600">|</span>
                  <span className="text-blue-400">Zisk: {fmtInt(totals.profit)} Kc ({totals.margin.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={importFromCatalog}
              className="bg-blue-600 text-white px-3.5 py-2 rounded-xl font-bold hover:bg-blue-700 transition text-xs flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Import z katalogu
            </button>
            {projectId && (
              <button onClick={() => setShowFvImport(true)}
                className="bg-orange-500 text-white px-3.5 py-2 rounded-xl font-bold hover:bg-orange-600 transition text-xs flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" /> {hasFvSource ? 'Aktualizovat FVE' : 'Importovat FVE'}
              </button>
            )}
            {projectId && (
              <button onClick={() => setShowCameraImport(true)}
                className="bg-sky-500 text-white px-3.5 py-2 rounded-xl font-bold hover:bg-sky-600 transition text-xs flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> {hasCameraSource ? 'Aktualizovat kamery' : 'Importovat kamery'}
              </button>
            )}
            {projectId && (
              <button onClick={() => setShowEpsImport(true)}
                className="bg-rose-500 text-white px-3.5 py-2 rounded-xl font-bold hover:bg-rose-600 transition text-xs flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> {hasEpsSource ? 'Aktualizovat EPS/EZS' : 'Importovat EPS/EZS'}
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {projectId && (
                <button onClick={() => setShowSaveForm(true)} disabled={quoteData.sections.length === 0}
                  className="bg-amber-500 text-white px-3.5 py-2 rounded-xl font-bold hover:bg-amber-600 transition text-xs flex items-center gap-1.5 disabled:opacity-40">
                  <Save className="w-3.5 h-3.5" /> Ulozit
                </button>
              )}
              <button onClick={exportPDF} disabled={quoteData.sections.length === 0}
                className="bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-bold hover:bg-emerald-700 transition text-xs flex items-center gap-1.5 disabled:opacity-40">
                <FileDown className="w-3.5 h-3.5" /> Export PDF
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <QuoteAttachmentsPanel
            attachments={attachments}
            summaries={summaries}
            onUpdateAttachment={handleUpdateAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onUpdateSummary={handleUpdateSummary}
          />

          {quoteData.sections.length === 0 ? (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-10 text-center">
              <Calculator className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <div className="text-lg font-extrabold text-white">{`Zatím žádné sekce`}</div>
              <div className="text-sm text-slate-500 mt-1">
                {`Klikni na "Import z katalogu" pro naimportování položek včetně materiálu, vytápění a osvětlení.`}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {quoteData.sections.map((section, sectionIndex) => {
                const sc = getSectionColor(section.trade, section.color);
                const sectionTotal = calcSectionTotal(section);
                const sectionCost = calcSectionCostTotal(section);
                const sectionProfit = sectionTotal - sectionCost;
                const sectionMargin = sectionTotal > 0 ? (sectionProfit / sectionTotal) * 100 : 0;
                const sectionRawTotal = section.items.reduce((sum, i) => sum + calcItemTotal(i), 0);

                return (
                  <div key={section.id} className="rounded-2xl overflow-hidden border-2 transition-shadow hover:shadow-md"
                    style={{ borderColor: sc.border }}>
                    <div onClick={() => toggleSection(section.id)}
                      className="px-4 py-3 flex items-center justify-between cursor-pointer transition"
                      style={{ background: sc.bg }}>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => moveSectionUp(sectionIndex)} disabled={sectionIndex === 0}
                            className="p-0.5 rounded hover:bg-black/10 disabled:opacity-20 transition" title="Posunout nahoru">
                            <ArrowUp className="w-3 h-3" style={{ color: sc.text }} />
                          </button>
                          <button onClick={() => moveSectionDown(sectionIndex)} disabled={sectionIndex === quoteData.sections.length - 1}
                            className="p-0.5 rounded hover:bg-black/10 disabled:opacity-20 transition" title="Posunout dolu">
                            <ArrowDown className="w-3 h-3" style={{ color: sc.text }} />
                          </button>
                        </div>
                        <div className="relative w-9 h-9 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setCustomizerSectionId(customizerSectionId === section.id ? null : section.id); }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-80 transition"
                            style={{ background: sc.accent }}
                            title="Zmenit ikonu a barvu"
                          >
                            {(() => { const I = getSectionIconComponent(section); return <I className="w-4 h-4 text-white" />; })()}
                          </button>
                          {customizerSectionId === section.id && (
                            <SectionCustomizer
                              section={section}
                              onUpdate={(updates) => updateSection(section.id, updates)}
                              onClose={() => setCustomizerSectionId(null)}
                            />
                          )}
                        </div>
                        <div>
                          {editingSectionId === section.id ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={editingSectionName}
                                onChange={e => setEditingSectionName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') finishRenamingSection(); if (e.key === 'Escape') { setEditingSectionId(null); setEditingSectionName(''); } }}
                                onBlur={finishRenamingSection}
                                className="text-sm font-extrabold px-2 py-0.5 rounded border border-white/20 bg-white/80 outline-none"
                                style={{ color: sc.text }}
                              />
                              <button onClick={finishRenamingSection} className="p-1 rounded hover:bg-black/10 transition">
                                <Check className="w-3.5 h-3.5" style={{ color: sc.text }} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-extrabold" style={{ color: sc.text }}>{section.name}</h3>
                              <button onClick={(e) => startRenamingSection(section, e)}
                                className="p-0.5 rounded hover:bg-black/10 transition opacity-50 hover:opacity-100" title="Prejmenovat sekci">
                                <Edit3 className="w-3 h-3" style={{ color: sc.text }} />
                              </button>
                            </div>
                          )}
                          <span className="text-[10px] font-extrabold" style={{ color: sc.text, opacity: 0.6 }}>
                            {`${section.items.length} polozek`}
                            {(section.discount ?? 0) > 0 && ` | sleva ${section.discount}%`}
                          </span>
                        </div>
                        <button className="text-slate-500 ml-1">
                          {section.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-extrabold" style={{ color: sc.accent }}>
                          {fmtInt(sectionTotal)} Kc
                        </span>
                        {(section.discount ?? 0) > 0 && sectionRawTotal !== sectionTotal && (
                          <span className="text-[10px] line-through opacity-50" style={{ color: sc.text }}>
                            {fmtInt(sectionRawTotal)}
                          </span>
                        )}
                        <span className="text-xs text-blue-400 hidden sm:inline">
                          Zisk: {fmtInt(sectionProfit)} Kc ({sectionMargin.toFixed(1)}%)
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
                          className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {!section.collapsed && (
                      <div className="p-4 bg-white/[0.06]">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b-2" style={{ borderColor: sc.border }}>
                                <th className="w-6"></th>
                                <th className="text-left py-2 px-2 font-extrabold text-slate-400">Kod</th>
                                <th className="text-left py-2 px-2 font-extrabold text-slate-400">Nazev</th>
                                <th className="text-left py-2 px-2 font-extrabold text-slate-400">Jedn.</th>
                                <th className="text-right py-2 px-2 font-extrabold text-slate-400">Pocet</th>
                                <th className="text-right py-2 px-2 font-extrabold text-slate-400">Prodej/j.</th>
                                <th className="text-right py-2 px-2 font-extrabold text-slate-400">Naklad/j.</th>
                                <th className="text-right py-2 px-2 font-extrabold text-slate-400">Sleva %</th>
                                <th className="text-right py-2 px-2 font-extrabold text-slate-400">DPH %</th>
                                <th className="text-right py-2 px-2 font-extrabold text-slate-400">Celkem</th>
                                <th className="text-right py-2 px-2 font-extrabold text-slate-400">Zisk</th>
                                <th className="w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {section.items.map((item, itemIndex) => {
                                const itemTotal = calcItemTotal(item);
                                const itemCost = item.quantity * item.costPrice;
                                const itemProfit = itemTotal - itemCost;
                                return (
                                  <tr key={item.id} className="border-b border-white/[0.06] hover:bg-white/[0.04]">
                                    <td className="py-2 px-0.5">
                                      <div className="flex flex-col gap-0">
                                        <button onClick={() => moveItemUp(section.id, itemIndex)} disabled={itemIndex === 0}
                                          className="p-0 text-slate-500 hover:text-white disabled:opacity-20 transition" title="Nahoru">
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => moveItemDown(section.id, itemIndex)} disabled={itemIndex === section.items.length - 1}
                                          className="p-0 text-slate-500 hover:text-white disabled:opacity-20 transition" title="Dolu">
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </td>
                                    <td className="py-2 px-2">
                                      <input value={item.code} onChange={(e) => updateItem(section.id, item.id, { code: e.target.value })}
                                        className="w-full px-2 py-1 rounded border border-white/10 text-xs" placeholder="Kod" />
                                    </td>
                                    <td className="py-2 px-2">
                                      <div className="flex items-center gap-1">
                                        <input value={item.name} onChange={(e) => updateItem(section.id, item.id, { name: e.target.value })}
                                          className="w-full px-2 py-1 rounded border border-white/10 text-xs" placeholder="Nazev" />
                                        {item.isAutoMaterial && (
                                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20">auto</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 px-2">
                                      <input value={item.unit} onChange={(e) => updateItem(section.id, item.id, { unit: e.target.value })}
                                        className="w-16 px-2 py-1 rounded border border-white/10 text-xs" />
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <input type="number" value={item.quantity}
                                        onChange={(e) => updateItem(section.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                        className="w-16 px-2 py-1 rounded border border-white/10 text-xs text-right" />
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <input type="number" value={item.sellingPrice}
                                        onChange={(e) => updateItem(section.id, item.id, { sellingPrice: parseFloat(e.target.value) || 0 })}
                                        className={`w-20 px-2 py-1 rounded border text-xs text-right ${!item.sellingPrice ? 'border-red-300 bg-red-500/10 text-red-400 font-extrabold' : 'border-white/10'}`} />
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <input type="number" value={item.costPrice}
                                        onChange={(e) => updateItem(section.id, item.id, { costPrice: parseFloat(e.target.value) || 0 })}
                                        className={`w-20 px-2 py-1 rounded border text-xs text-right ${!item.costPrice ? 'border-red-300 bg-red-500/10 text-red-400 font-extrabold' : 'border-white/10'}`} />
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <input type="number" value={item.discount || 0} min={0} max={100}
                                        onChange={(e) => updateItem(section.id, item.id, { discount: parseFloat(e.target.value) || 0 })}
                                        className="w-14 px-2 py-1 rounded border border-white/10 text-xs text-right" />
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <input type="number" value={item.vatRate ?? quoteData.globalVatRate ?? 21} min={0} max={100}
                                        onChange={(e) => updateItem(section.id, item.id, { vatRate: parseFloat(e.target.value) || 0 })}
                                        className="w-14 px-2 py-1 rounded border border-white/10 text-xs text-right" />
                                    </td>
                                    <td className={`py-2 px-2 text-right font-extrabold ${itemTotal === 0 ? 'text-red-500' : ''}`} style={itemTotal !== 0 ? { color: sc.accent } : undefined}>
                                      {fmt(itemTotal)} Kc
                                    </td>
                                    <td className={`py-2 px-2 text-right font-extrabold ${itemProfit >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
                                      {fmt(itemProfit)} Kc
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <button onClick={() => removeItem(section.id, item.id)}
                                        className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button onClick={() => addItem(section.id)}
                            className="bg-white/[0.06] text-slate-300 px-3 py-1.5 rounded-xl font-extrabold hover:bg-white/[0.08] transition text-xs flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" /> {`Prázdná položka`}
                          </button>
                          <button onClick={() => setPickerSectionId(section.id)}
                            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold hover:opacity-80 transition"
                            style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                            <Search className="w-3.5 h-3.5" /> {`Z ceníku`}
                          </button>
                          <button onClick={() => setMaterialPickerSectionId(section.id)}
                            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold bg-amber-500/10 text-amber-800 border border-amber-200 hover:bg-amber-500/20 transition">
                            <Wrench className="w-3.5 h-3.5" /> {`Z materiálů`}
                          </button>
                          <div className="ml-auto flex items-center gap-2">
                            <label className="text-[10px] font-extrabold text-slate-500 flex items-center gap-1.5">
                              <Percent className="w-3 h-3" /> Sleva na sekci:
                            </label>
                            <input type="number" min={0} max={100} value={section.discount || 0}
                              onChange={(e) => updateSection(section.id, { discount: parseFloat(e.target.value) || 0 })}
                              className="w-16 px-2 py-1 rounded-lg border border-white/10 text-xs text-right font-extrabold" />
                            <span className="text-[10px] text-slate-400">%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 space-y-3">
            {showAddSection ? (
              <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 flex items-center gap-2">
                <select value={newSectionTrade} onChange={(e) => setNewSectionTrade(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold bg-white/[0.06]">
                  {TRADE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input autoFocus value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSection()} placeholder={`Název sekce`}
                  className="flex-1 px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold" />
                <button onClick={addSection}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl font-extrabold hover:bg-blue-700 transition text-sm">
                  {`Přidat`}
                </button>
                <button onClick={() => setShowAddSection(false)}
                  className="bg-navy-800/60 border border-white/[0.08] text-slate-300 px-4 py-2 rounded-xl font-extrabold hover:bg-white/[0.04] transition text-sm">
                  {`Zrušit`}
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAddSection(true)}
                className="bg-white/[0.06] text-slate-300 px-4 py-2 rounded-xl font-extrabold hover:bg-white/[0.08] transition text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> {`Nová sekce`}
              </button>
            )}

            {quoteData.sections.length > 0 && (
              <div className="space-y-3">
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                        <Percent className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-white">DPH</div>
                        <div className="text-[10px] text-slate-500">Centralni sazba - prepise vsechny polozky</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {[0, 12, 21].map(rate => (
                        <button key={rate} onClick={() => applyGlobalVat(rate)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            (quoteData.globalVatRate ?? 21) === rate
                              ? 'bg-blue-600 text-white'
                              : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
                          }`}>{rate}%</button>
                      ))}
                      <input type="number" min={0} max={100} value={quoteData.globalVatRate ?? 21}
                        onChange={(e) => applyGlobalVat(parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1.5 rounded-lg border border-white/10 text-xs font-extrabold text-right" />
                      <span className="text-xs font-extrabold text-slate-500">%</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
                        <Percent className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-white">Celkova sleva na nabidku</div>
                        <div className="text-[10px] text-slate-500">Aplikuje se na celkovou prodejni cenu po vsech slevach</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={100} value={quoteData.globalDiscount || 0}
                        onChange={(e) => saveQuote({ ...quoteData, globalDiscount: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-3 py-2 rounded-xl border border-white/10 text-sm font-extrabold text-right" />
                      <span className="text-sm font-extrabold text-slate-500">%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {quoteData.sections.length > 0 && (
              <QuoteNotesEditor
                value={quoteData.notes || ''}
                onChange={(html) => saveQuote({ ...quoteData, notes: html })}
              />
            )}
          </div>
        </div>
      </div>

      {showSaveForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-navy-800/60 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-4 border-b bg-white/[0.04]">
              <h3 className="text-sm font-extrabold text-white">{`Uložit nabídku`}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {`${quoteData.sections.length} sekci, ${quoteData.sections.reduce((s, sec) => s + sec.items.length, 0)} položek`}
                {` — ${fmtInt(totals.totalSelling)} Kč`}
              </p>
            </div>
            <div className="p-4 space-y-3">
              {currentQuoteId && (
                <div>
                  <label className="block text-xs font-extrabold text-slate-300 mb-2">{`Způsob uložení`}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSaveMode('overwrite')}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        saveMode === 'overwrite'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                          : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mx-auto mb-1" />
                      {`Prepsat v${currentQuoteVersion ?? ''}`}
                    </button>
                    <button
                      onClick={() => setSaveMode('new')}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        saveMode === 'new'
                          ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                          : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 mx-auto mb-1" />
                      {`Nova verze`}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-extrabold text-slate-300 mb-1">{`Poznámka`}</label>
                <textarea
                  value={saveNote}
                  onChange={(e) => setSaveNote(e.target.value)}
                  rows={3}
                  placeholder={`Např. důvod změn, poznámka pro klienta...`}
                  className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t bg-white/[0.04] flex items-center justify-end gap-2">
              <button onClick={() => setShowSaveForm(false)}
                className="bg-navy-800/60 border border-white/[0.08] text-slate-300 px-4 py-2 rounded-xl font-extrabold hover:bg-white/[0.04] transition text-sm">
                {`Zrušit`}
              </button>
              <button onClick={handleSaveToDb} disabled={saving}
                className={`text-white px-4 py-2 rounded-xl font-extrabold transition text-sm flex items-center gap-1.5 disabled:opacity-60 ${
                  saveMode === 'overwrite' && currentQuoteId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                {saveMode === 'overwrite' && currentQuoteId
                  ? <RefreshCw className="w-4 h-4" />
                  : <Save className="w-4 h-4" />}
                {saving
                  ? `Ukládám...`
                  : saveMode === 'overwrite' && currentQuoteId
                    ? `Přepsat verzi`
                    : `Uložit jako novou verzi`}
              </button>
            </div>
          </div>
        </div>
      )}

      {pickerSectionId && (
        <ProductPickerDropdown products={products} categories={categories}
          onAdd={(product) => addProductToSection(pickerSectionId, product)}
          onClose={() => setPickerSectionId(null)} />
      )}

      {materialPickerSectionId && (
        <MaterialPickerDropdown materials={materials}
          onAdd={(material) => addMaterialToSection(materialPickerSectionId, material)}
          onClose={() => setMaterialPickerSectionId(null)} />
      )}

      <FvImportModal
        open={showFvImport}
        onClose={() => setShowFvImport(false)}
        projectId={projectId}
        onImport={handleFvImport}
      />
      <CameraImportModal
        open={showCameraImport}
        onClose={() => setShowCameraImport(false)}
        projectId={projectId}
        onImport={handleCameraImport}
      />
      <EpsImportModal
        open={showEpsImport}
        onClose={() => setShowEpsImport(false)}
        projectId={projectId}
        onImport={handleEpsImport}
      />
    </div>
  );
}
