import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileDown, FileUp, RotateCcw, ListChecks, MapPin,
  Settings, Save, FolderOpen, LogOut, User, Lightbulb,
  ChevronDown, AlertTriangle, RefreshCw, FileText, LayoutDashboard,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useCatalogData } from '../hooks/useCatalogData';
import { useProjectState } from '../hooks/useProjectState';
import { useMaterialSettings } from '../hooks/useMaterialSettings';
import { useMaterials } from '../hooks/useMaterials';
import { useHeatingSystems } from '../hooks/useHeatingSystems';
import { useLightingNorms } from '../hooks/useLightingNorms';
import FilterBar, { type CustomFilter } from '../components/catalog/FilterBar';
import ProductCard from '../components/catalog/ProductCard';
import ProductDetailModal from '../components/catalog/ProductDetailModal';
import FloorplanModal from '../components/catalog/FloorplanModal';
import SummaryModal from '../components/catalog/SummaryModal';
import { SaveModal, LoadModal, loadProjectById } from '../components/catalog/SaveLoadModals';
import QuickAuthModal from '../components/catalog/QuickAuthModal';
import QuoteBuilder from '../components/catalog/QuoteBuilder';

function getInitials(name: string): string {
  const parts = name.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-navy-800/60 rounded-3xl overflow-hidden  border border-white/[0.06]">
          <div className="h-52 bg-white/[0.06] animate-skeleton" />
          <div className="p-5 space-y-3">
            <div className="h-3 w-16 bg-white/[0.06] rounded animate-skeleton" />
            <div className="h-5 w-3/4 bg-white/[0.06] rounded animate-skeleton" />
            <div className="h-3 w-full bg-white/[0.06] rounded animate-skeleton" />
            <div className="h-3 w-2/3 bg-white/[0.06] rounded animate-skeleton" />
            <div className="pt-4 border-t border-white/[0.06] flex gap-2">
              <div className="h-8 w-20 bg-white/[0.06] rounded-xl animate-skeleton" />
              <div className="h-8 w-16 bg-white/[0.06] rounded-xl animate-skeleton" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionsDropdown({ children, label }: { children: React.ReactNode; label: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="bg-navy-800/60 border border-white/[0.08] text-slate-300 px-3 py-2 rounded-xl font-extrabold hover:bg-white/[0.04] transition  flex items-center gap-1.5 text-sm">
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-navy-800/60 border border-white/[0.08] rounded-xl shadow-xl z-50 min-w-[180px] py-1.5 animate-dropdown-enter">
          <div onClick={() => setOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CatalogPage() {
  const { user, isAdmin, profile, signOut } = useAuth();
  const { toast } = useToast();
  const { categories, subcategories, products, designModules, designPresets, productColors, loading, error, reload } = useCatalogData();
  const projectState = useProjectState();
  const materialSettings = useMaterialSettings();
  const { materials } = useMaterials();
  const { systems: heatingSystems } = useHeatingSystems();
  const { norms: lightingNorms } = useLightingNorms();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const handler = () => toast('Lokální úložiště je plné. Změny se nemusely uložit. Doporučujeme uložit projekt na server.', 'error');
    window.addEventListener('hs-storage-error', handler);
    return () => window.removeEventListener('hs-storage-error', handler);
  }, [toast]);

  const catFilter = searchParams.get('cat') || 'vse';
  const subCatFilter = searchParams.get('subcat') || '';
  const search = searchParams.get('q') || '';
  const brand = searchParams.get('brand') || 'vse';
  const power = searchParams.get('power') || 'vse';

  const updateParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'vse' || value === '') next.delete(key);
      else next.set(key, value);
      return next;
    });
  };

  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [showFloorplan, setShowFloorplan] = useState(() => searchParams.get('view') === 'floorplan');
  const [showSummary, setShowSummary] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [placingProductId, setPlacingProductId] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);

  const loadParam = searchParams.get('load');
  useEffect(() => {
    if (loadParam && loadParam !== projectState.loadedProjectId) {
      loadProjectById(loadParam).then((result) => {
        if (result) {
          projectState.loadState(result.selected, result.meta, result.floorsOrFp, loadParam);
          toast('Projekt načten');
        }
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('load');
          return next;
        }, { replace: true });
      });
    }
  }, [loadParam]);
  useEffect(() => {
    if (!showFloorplan) return;
    window.history.pushState({ floorplan: true }, '');
    const handlePop = () => {
      setShowFloorplan(false);
      setPlacingProductId(null);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [showFloorplan]);

  useEffect(() => {
    if (!showSummary) return;
    window.history.pushState({ summary: true }, '');
    const handlePop = () => setShowSummary(false);
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [showSummary]);

  const [showAuth, setShowAuth] = useState(false);
  const [authAction, setAuthAction] = useState<'save' | 'load'>('save');
  const [detailProduct, setDetailProduct] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (!p.show_in_catalog) return false;
      const cat = categories.find((c) => c.id === p.category_id);
      if (catFilter !== 'vse' && cat?.slug !== catFilter) return false;
      if (subCatFilter && p.subcategory_id !== subCatFilter) return false;
      if (brand !== 'vse' && p.brand !== brand) return false;
      if (power !== 'vse' && !p.power.includes(power)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q) && !p.tag.toLowerCase().includes(q)) return false;
      for (const cf of customFilters) {
        const val = (p as Record<string, unknown>)[cf.field];
        if (typeof val === 'string' && val !== cf.value) return false;
      }
      return true;
    });
  }, [products, categories, catFilter, subCatFilter, brand, power, search, customFilters]);

  const startPlacing = useCallback((productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (!projectState.isSelected(productId)) {
      projectState.toggleSelect(product, products);
    }
    setPlacingProductId(productId);
    setShowFloorplan(true);
    setShowSummary(false);
  }, [products, projectState]);

  const handleSaveClick = () => {
    if (!user) { setAuthAction('save'); setShowAuth(true); }
    else setShowSave(true);
  };

  const handleLoadClick = () => {
    if (!user) { setAuthAction('load'); setShowAuth(true); }
    else setShowLoad(true);
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
    if (authAction === 'save') setShowSave(true);
    else setShowLoad(true);
  };

  const exportJSON = () => {
    const payload = {
      version: 7,
      exportedAt: new Date().toISOString(),
      meta: projectState.meta,
      selected: projectState.selected,
      floors: projectState.floors,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hs-standard-${(projectState.meta.version || 'v7').replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('JSON exportován');
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const floorsOrFp = data.floors || data.floorplanImg || null;
        projectState.loadState(data.selected || {}, data.meta || { project: '', client: '', version: '' }, floorsOrFp);
        toast('Import hotový');
      } catch {
        toast('Import se nepovedl – špatný JSON', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const selectedCount = projectState.countSelected();

  if (error && !loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-white/[0.04] flex items-center justify-center p-4">
        <div className="bg-navy-800/60 rounded-3xl border border-red-500/20  p-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 mx-auto flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-extrabold text-white">Nepodařilo se načíst data</h2>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
          <button onClick={reload} className="mt-5 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-extrabold hover:bg-blue-700 transition inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Zkusit znovu
          </button>
        </div>
      </div>
    );
  }

  const projectParam = searchParams.get('project');

  return (
    <div className="bg-white/[0.04] min-h-screen">
      {projectParam && (
        <div className="bg-slate-900 text-white print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
            <Link
              to={`/projekty/${projectParam}`}
              className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Zpět na projekt
            </Link>
            <span className="text-slate-400">|</span>
            <span className="text-sm text-slate-400">
              {projectState.meta.project || projectState.meta.client || 'Návrh projektu'}
            </span>
          </div>
        </div>
      )}
      <header className="bg-white/[0.06] border-b sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="shrink-0">
            <img src="/housesmartlogo.png" alt="HouseSmart" className="h-9 w-auto" />
            <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">Katalog standardů</p>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <Link to="/projekty"
                className="hidden sm:flex bg-white/[0.06] border border-white/10 text-slate-300 px-3 py-2 rounded-xl font-extrabold hover:bg-white/[0.08] transition  items-center gap-1.5 text-sm">
                <LayoutDashboard className="w-3.5 h-3.5" /> Projekty
              </Link>
            )}

            <Link to="/inspirace"
              className="hidden sm:flex bg-amber-500/10 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl font-extrabold hover:bg-amber-500/20 transition  items-center gap-1.5 text-sm">
              <Lightbulb className="w-3.5 h-3.5" /> Inspirace
            </Link>

            <button onClick={() => setShowQuote(true)}
              className="hidden md:flex bg-emerald-500/10 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl font-extrabold hover:bg-emerald-500/20 transition  items-center gap-1.5 text-sm">
              <FileText className="w-3.5 h-3.5" /> Nabídka
            </button>

            <button onClick={handleSaveClick}
              className="hidden md:flex bg-navy-800/60 border border-white/[0.08] text-slate-300 px-3 py-2 rounded-xl font-extrabold hover:bg-white/[0.04] transition  items-center gap-1.5 text-sm">
              <Save className="w-3.5 h-3.5" /> Uložit
            </button>
            <button onClick={handleLoadClick}
              className="hidden md:flex bg-navy-800/60 border border-white/[0.08] text-slate-300 px-3 py-2 rounded-xl font-extrabold hover:bg-white/[0.04] transition  items-center gap-1.5 text-sm">
              <FolderOpen className="w-3.5 h-3.5" /> Načíst
            </button>

            <ActionsDropdown label={<span className="hidden sm:inline">Akce</span>}>
              <button onClick={() => setShowQuote(true)}
                className="md:hidden w-full text-left px-4 py-2.5 text-sm font-extrabold text-slate-300 hover:bg-white/[0.04] flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-emerald-500" /> Nabídka
              </button>
              <button onClick={handleSaveClick}
                className="md:hidden w-full text-left px-4 py-2.5 text-sm font-extrabold text-slate-300 hover:bg-white/[0.04] flex items-center gap-2.5">
                <Save className="w-4 h-4 text-slate-400" /> Uložit
              </button>
              <button onClick={handleLoadClick}
                className="md:hidden w-full text-left px-4 py-2.5 text-sm font-extrabold text-slate-300 hover:bg-white/[0.04] flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-slate-400" /> Načíst
              </button>
              <Link to="/inspirace"
                className="sm:hidden w-full text-left px-4 py-2.5 text-sm font-extrabold text-slate-300 hover:bg-white/[0.04] flex items-center gap-2.5">
                <Lightbulb className="w-4 h-4 text-amber-500" /> Inspirace
              </Link>
              <button onClick={exportJSON}
                className="w-full text-left px-4 py-2.5 text-sm font-extrabold text-slate-300 hover:bg-white/[0.04] flex items-center gap-2.5">
                <FileDown className="w-4 h-4 text-slate-400" /> Export JSON
              </button>
              <label className="w-full text-left px-4 py-2.5 text-sm font-extrabold text-slate-300 hover:bg-white/[0.04] flex items-center gap-2.5 cursor-pointer">
                <FileUp className="w-4 h-4 text-slate-400" /> Import JSON
                <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
              </label>
              <div className="h-px bg-white/[0.06] my-1" />
              <button onClick={() => { if (confirm('Opravdu resetovat výběr?')) projectState.resetAll(); }}
                className="w-full text-left px-4 py-2.5 text-sm font-extrabold text-red-400 hover:bg-red-500/100/10 flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4" /> Resetovat vše
              </button>
            </ActionsDropdown>

            <button onClick={() => { setPlacingProductId(null); setShowFloorplan(true); }}
              className="bg-slate-900 text-white px-4 py-2 rounded-xl font-extrabold hover:bg-slate-800 transition shadow-lg shadow-slate-900/15 active:scale-[0.99] flex items-center gap-1.5 text-sm">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Půdorys</span>
            </button>

            <button onClick={() => setShowSummary(true)}
              className="bg-blue-600 text-white px-3 py-2 rounded-xl font-extrabold hover:bg-blue-700 transition shadow-lg shadow-blue-600/15 active:scale-[0.99] flex items-center gap-1.5 text-sm">
              <ListChecks className="w-4 h-4" />
              <span className="bg-white/[0.06]/20 px-1.5 py-0.5 rounded-md text-xs">{selectedCount}</span>
            </button>

            {user ? (
              <div className="flex items-center gap-1.5">
                <div
                  className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center cursor-default"
                  title={profile?.display_name || user.email || ''}
                >
                  <span className="text-xs font-extrabold text-blue-400 leading-none">
                    {getInitials(profile?.display_name || user.email || '')}
                  </span>
                </div>
                <button onClick={() => signOut()} className="p-2 rounded-xl hover:bg-white/[0.06] transition border border-white/10" title="Odhlásit">
                  <LogOut className="w-4 h-4 text-slate-500" />
                </button>
                {isAdmin && (
                  <Link to="/admin" className="p-2 rounded-xl hover:bg-white/[0.06] transition border border-white/10" title="Administrace">
                    <Settings className="w-4 h-4 text-slate-500" />
                  </Link>
                )}
              </div>
            ) : (
              <button onClick={() => { setAuthAction('save'); setShowAuth(true); }}
                className="p-2 rounded-xl hover:bg-white/[0.06] transition border border-white/10" title="Přihlásit se">
                <User className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden">
        <FilterBar
          categories={categories}
          subcategories={subcategories}
          products={products}
          currentCat={catFilter}
          currentSubCat={subCatFilter}
          search={search}
          brand={brand}
          power={power}
          onCatChange={(v) => { updateParam('cat', v); updateParam('subcat', ''); }}
          onSubCatChange={(v) => updateParam('subcat', v)}
          onSearchChange={(v) => updateParam('q', v)}
          onBrandChange={(v) => updateParam('brand', v)}
          onPowerChange={(v) => updateParam('power', v)}
          customFilters={customFilters}
          onCustomFiltersChange={setCustomFilters}
        />

        {loading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <div className="bg-white/[0.06] border border-white/[0.06] rounded-3xl p-10 text-center ">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.06] mx-auto flex items-center justify-center mb-4">
              <ListChecks className="w-8 h-8 text-slate-400" />
            </div>
            <div className="text-lg font-extrabold text-white">Nic nenalezeno</div>
            <div className="text-sm text-slate-500 mt-1">Zkus upravit filtry nebo hledání.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                category={categories.find((c) => c.id === p.category_id)}
                selected={projectState.isSelected(p.id)}
                qty={projectState.qtyOf(p.id)}
                onToggle={() => projectState.toggleSelect(p, products)}
                onPlace={() => startPlacing(p.id)}
                onDetail={() => setDetailProduct(p.id)}
              />
            ))}
          </div>
        )}
      </main>

      <FloorplanModal
        open={showFloorplan}
        onClose={() => { setShowFloorplan(false); setPlacingProductId(null); window.history.back(); }}
        products={products}
        categories={categories}
        designModules={designModules}
        designPresets={designPresets}
        productColors={productColors}
        project={projectState}
        placingProductId={placingProductId}
        onStopPlacing={() => setPlacingProductId(null)}
        onStartPlacing={(pid) => {
          const product = products.find((p) => p.id === pid);
          if (product && !projectState.isSelected(pid)) {
            projectState.toggleSelect(product, products);
          }
          setPlacingProductId(pid);
        }}
        materialSettings={materialSettings}
        materials={materials}
        onToggleProduct={(product) => projectState.toggleSelect(product, products)}
        heatingSystems={heatingSystems}
        lightingNorms={lightingNorms}
      />

      <SummaryModal
        open={showSummary}
        onClose={() => { setShowSummary(false); window.history.back(); }}
        products={products}
        categories={categories}
        selected={projectState.selected}
        meta={projectState.meta}
        onMetaChange={projectState.setMeta}
        onStartPlacing={(pid) => { setShowSummary(false); startPlacing(pid); }}
        floors={projectState.floors}
        materials={materials}
        heatingSystems={heatingSystems}
        designModules={designModules}
        pinSize={projectState.pinSize}
        projectId={projectState.loadedProjectId}
      />

      <SaveModal open={showSave} onClose={() => setShowSave(false)} meta={projectState.meta} selected={projectState.selected} floors={projectState.floors} />
      <LoadModal open={showLoad} onClose={() => setShowLoad(false)} onLoad={projectState.loadState} />
      <QuickAuthModal open={showAuth} onClose={() => setShowAuth(false)} onSuccess={handleAuthSuccess} />

      <QuoteBuilder
        open={showQuote}
        onClose={() => setShowQuote(false)}
        products={products}
        categories={categories}
        selected={projectState.selected}
        meta={projectState.meta}
        floors={projectState.floors}
        materials={materials}
        heatingSystems={heatingSystems}
      />

      {detailProduct && (
        <ProductDetailModal
          productId={detailProduct}
          products={products}
          categories={categories}
          onClose={() => setDetailProduct(null)}
          selected={projectState.isSelected(detailProduct)}
          onToggle={() => {
            const product = products.find((p) => p.id === detailProduct);
            if (product) projectState.toggleSelect(product, products);
          }}
          onPlace={() => {
            setDetailProduct(null);
            startPlacing(detailProduct);
          }}
          qty={projectState.qtyOf(detailProduct)}
        />
      )}
    </div>
  );
}
