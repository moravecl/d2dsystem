import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Save, X, Camera, Monitor, Cable, Network, Package, Loader2, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCameraCatalog } from '../../hooks/useCameraCatalog';
import { useCatalogCategories } from '../../hooks/useCatalogCategories';
import type { CategoryGroupDef } from '../../hooks/useCatalogCategories';
import CategoryManager from '../../components/admin/CategoryManager';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import type { CameraModel, CameraNvr, CameraCable, CameraPoeSwitch, CameraAccessory } from '../../hooks/useCameraCatalog';

type Tab = 'cameras' | 'nvrs' | 'cables' | 'switches' | 'accessories' | 'categories';

const TABS: { id: Tab; label: string; icon: typeof Camera }[] = [
 { id: 'cameras', label: 'Kamery', icon: Camera },
 { id: 'nvrs', label: 'NVR', icon: Monitor },
 { id: 'cables', label: 'Kabelaz', icon: Cable },
 { id: 'switches', label: 'PoE Switche', icon: Network },
 { id: 'accessories', label: 'Prislusenstvi', icon: Package },
 { id: 'categories', label: 'Kategorie', icon: Tag },
];

const CAMERA_TYPE_DEFAULTS: [string, string][] = [['dome', 'Dome'], ['bullet', 'Bullet'], ['ptz', 'PTZ'], ['fisheye', 'Fisheye'], ['box', 'Box']];
const CABLE_TYPE_DEFAULTS: [string, string][] = [['utp_cat5e', 'UTP Cat5e'], ['utp_cat6', 'UTP Cat6'], ['coax', 'Koaxial'], ['fiber', 'Optika']];
const ACC_TYPE_DEFAULTS: [string, string][] = [['bracket', 'Konzole'], ['junction_box', 'Junction box'], ['hdd', 'HDD disk'], ['power_supply', 'Napajeci zdroj'], ['other', 'Jine']];

const CAMERA_CATEGORY_GROUPS: CategoryGroupDef[] = [
 { group: 'camera_type', label: 'Typy kamer', defaults: CAMERA_TYPE_DEFAULTS },
 { group: 'camera_cable_type', label: 'Typy kabelu', defaults: CABLE_TYPE_DEFAULTS },
 { group: 'camera_accessory_type', label: 'Typy prislusenstvi', defaults: ACC_TYPE_DEFAULTS },
];

const CAMERA_TYPE_LABELS: Record<string, string> = { dome: 'Dome', bullet: 'Bullet', ptz: 'PTZ', fisheye: 'Fisheye', box: 'Box' };
const CABLE_TYPE_LABELS: Record<string, string> = { utp_cat5e: 'UTP Cat5e', utp_cat6: 'UTP Cat6', coax: 'Koaxial', fiber: 'Optika' };
const ACC_TYPE_LABELS: Record<string, string> = { bracket: 'Konzole', junction_box: 'Junction box', hdd: 'HDD disk', power_supply: 'Napajeci zdroj', other: 'Jine' };

const TABLE_NAME: Partial<Record<Tab, string>> = {
 cameras: 'camera_models', nvrs: 'camera_nvrs', cables: 'camera_cables',
 switches: 'camera_poe_switches', accessories: 'camera_accessories',
};

type AnyItem = CameraModel | CameraNvr | CameraCable | CameraPoeSwitch | CameraAccessory;

function emptyItem(tab: Tab): Partial<AnyItem> {
 if (tab === 'cameras') return {
 name: '', manufacturer: '', camera_type: 'bullet', resolution_w: 2560, resolution_h: 1440,
 resolution_label: '2K', h_fov_deg: 106, v_fov_deg: 56, lens_mm: 2.8, ir_range_m: 30,
 poe: true, power_w: 12, ip_rating: 'IP67', price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
 } as Partial<CameraModel>;
 if (tab === 'nvrs') return {
 name: '', manufacturer: '', channels: 8, max_resolution_label: '4K', hdd_bays: 1,
 max_hdd_tb: 10, poe_ports: 8, poe_budget_w: 110, throughput_mbps: 80,
 price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
 } as Partial<CameraNvr>;
 if (tab === 'cables') return {
 name: '', cable_type: 'utp_cat5e', max_length_m: 100, price_per_m: 0, purchase_price_per_m: 0, notes: '', is_active: true,
 } as Partial<CameraCable>;
 if (tab === 'switches') return {
 name: '', manufacturer: '', poe_ports: 4, uplink_ports: 1, poe_budget_w: 60,
 managed: false, price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
 } as Partial<CameraPoeSwitch>;
 return {
 name: '', accessory_type: 'bracket', capacity_tb: null, price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
 } as Partial<CameraAccessory>;
}

function Row({ children, cols }: { children: React.ReactNode; cols?: number }) {
 return <div className={`grid gap-3 ${cols === 3 ? 'grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>{children}</div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
 return (
 <div>
 <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">{label}</label>
 <input className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 focus:outline-none focus:border-blue-400 bg-white/[0.06]"value={value} onChange={e => onChange(e.target.value)} />
 </div>
 );
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
 return (
 <div>
 <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">{label}</label>
 <input type="number"step={step ?? 1} min="0"className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 focus:outline-none focus:border-blue-400 bg-white/[0.06]"value={value} onChange={e => onChange(step ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)} />
 </div>
 );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
 return (
 <div>
 <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">{label}</label>
 <select className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 focus:outline-none focus:border-blue-400 bg-white/[0.06]"value={value} onChange={e => onChange(e.target.value)}>
 {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
 </select>
 </div>
 );
}

function CameraFields({ data, onChange, cameraTypeOptions }: { data: Partial<CameraModel>; onChange: (d: Partial<CameraModel>) => void; cameraTypeOptions: [string, string][] }) {
 const set = (k: keyof CameraModel, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Nazev"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={2}><Field label="Vyrobce"value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /><SelectField label="Typ"value={data.camera_type ?? 'bullet'} options={cameraTypeOptions} onChange={v => set('camera_type', v)} /></Row>
 <Row cols={3}>
 <NumField label="Rozliseni W (px)"value={data.resolution_w ?? 1920} onChange={v => set('resolution_w', v)} />
 <NumField label="Rozliseni H (px)"value={data.resolution_h ?? 1080} onChange={v => set('resolution_h', v)} />
 <SelectField label="Rozliseni"value={data.resolution_label ?? '1080p'} options={[['4K', '4K (8MP)'], ['2K', '2K (4MP)'], ['1440p', '1440p (4MP)'], ['1080p', '1080p (2MP)'], ['720p', '720p (1MP)']]} onChange={v => set('resolution_label', v)} />
 </Row>
 <Row cols={3}>
 <NumField label="FOV horizontal (°)"value={data.h_fov_deg ?? 90} step={0.1} onChange={v => set('h_fov_deg', v)} />
 <NumField label="FOV vertikalni (°)"value={data.v_fov_deg ?? 50} step={0.1} onChange={v => set('v_fov_deg', v)} />
 <NumField label="Ohnisko (mm)"value={data.lens_mm ?? 2.8} step={0.1} onChange={v => set('lens_mm', v)} />
 </Row>
 <Row cols={3}>
 <NumField label="IR dosah (m)"value={data.ir_range_m ?? 30} onChange={v => set('ir_range_m', v)} />
 <NumField label="Prikon (W)"value={data.power_w ?? 12} step={0.1} onChange={v => set('power_w', v)} />
 <Field label="IP stupen"value={data.ip_rating ?? 'IP67'} onChange={v => set('ip_rating', v)} />
 </Row>
 <Row cols={3}>
 <NumField label="Nakupni cena (Kc)"value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
 <NumField label="Prodejni cena (Kc)"value={data.price ?? 0} onChange={v => set('price', v)} />
 <div className="flex items-end pb-2">
 <label className="flex items-center gap-2 text-xs font-extrabold text-slate-400 cursor-pointer">
 <input type="checkbox"checked={data.poe ?? true} onChange={e => set('poe', e.target.checked)} className="accent-blue-500"/>
 PoE napajeni
 </label>
 </div>
 </Row>
 <Row><Field label="URL obrazku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 <Row><Field label="Poznamka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function NvrFields({ data, onChange }: { data: Partial<CameraNvr>; onChange: (d: Partial<CameraNvr>) => void }) {
 const set = (k: keyof CameraNvr, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Nazev"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={2}><Field label="Vyrobce"value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /><NumField label="Kanaly"value={data.channels ?? 8} onChange={v => set('channels', v)} /></Row>
 <Row cols={3}>
 <SelectField label="Max rozliseni"value={data.max_resolution_label ?? '4K'} options={[['4K', '4K'], ['2K', '2K'], ['1080p', '1080p']]} onChange={v => set('max_resolution_label', v)} />
 <NumField label="HDD sloty"value={data.hdd_bays ?? 1} onChange={v => set('hdd_bays', v)} />
 <NumField label="Max HDD (TB)"value={data.max_hdd_tb ?? 10} step={0.1} onChange={v => set('max_hdd_tb', v)} />
 </Row>
 <Row cols={3}>
 <NumField label="PoE porty"value={data.poe_ports ?? 0} onChange={v => set('poe_ports', v)} />
 <NumField label="PoE budget (W)"value={data.poe_budget_w ?? 0} step={0.1} onChange={v => set('poe_budget_w', v)} />
 <NumField label="Propustnost (Mbps)"value={data.throughput_mbps ?? 80} step={0.1} onChange={v => set('throughput_mbps', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Nakupni cena (Kc)"value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
 <NumField label="Prodejni cena (Kc)"value={data.price ?? 0} onChange={v => set('price', v)} />
 </Row>
 <Row><Field label="URL obrazku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 </>
 );
}

function CableFields({ data, onChange, cableTypeOptions }: { data: Partial<CameraCable>; onChange: (d: Partial<CameraCable>) => void; cableTypeOptions: [string, string][] }) {
 const set = (k: keyof CameraCable, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Nazev"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={2}>
 <SelectField label="Typ kabelu"value={data.cable_type ?? 'utp_cat5e'} options={cableTypeOptions} onChange={v => set('cable_type', v)} />
 <NumField label="Max delka (m)"value={data.max_length_m ?? 100} onChange={v => set('max_length_m', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Nakupni cena/m (Kc)"value={data.purchase_price_per_m ?? 0} step={0.01} onChange={v => set('purchase_price_per_m', v)} />
 <NumField label="Prodejni cena/m (Kc)"value={data.price_per_m ?? 0} step={0.01} onChange={v => set('price_per_m', v)} />
 </Row>
 <Row><Field label="Poznamka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function SwitchFields({ data, onChange }: { data: Partial<CameraPoeSwitch>; onChange: (d: Partial<CameraPoeSwitch>) => void }) {
 const set = (k: keyof CameraPoeSwitch, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Nazev"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={2}><Field label="Vyrobce"value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /><NumField label="PoE porty"value={data.poe_ports ?? 4} onChange={v => set('poe_ports', v)} /></Row>
 <Row cols={2}>
 <NumField label="Uplink porty"value={data.uplink_ports ?? 1} onChange={v => set('uplink_ports', v)} />
 <NumField label="PoE budget (W)"value={data.poe_budget_w ?? 60} step={0.1} onChange={v => set('poe_budget_w', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Nakupni cena (Kc)"value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
 <NumField label="Prodejni cena (Kc)"value={data.price ?? 0} onChange={v => set('price', v)} />
 </Row>
 <Row>
 <label className="flex items-center gap-2 text-xs font-extrabold text-slate-400 cursor-pointer">
 <input type="checkbox"checked={data.managed ?? false} onChange={e => set('managed', e.target.checked)} className="accent-blue-500"/>
 Managed switch
 </label>
 </Row>
 <Row><Field label="URL obrazku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 </>
 );
}

function AccessoryFields({ data, onChange, accTypeOptions }: { data: Partial<CameraAccessory>; onChange: (d: Partial<CameraAccessory>) => void; accTypeOptions: [string, string][] }) {
 const set = (k: keyof CameraAccessory, v: unknown) => onChange({ ...data, [k]: v });
 const isHdd = (data.accessory_type ?? 'bracket') === 'hdd';
 return (
 <>
 <Row><Field label="Nazev"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row><SelectField label="Typ"value={data.accessory_type ?? 'bracket'} options={accTypeOptions} onChange={v => set('accessory_type', v)} /></Row>
 <Row cols={2}>
 <NumField label="Nakupni cena (Kc)"value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
 <NumField label="Prodejni cena (Kc)"value={data.price ?? 0} onChange={v => set('price', v)} />
 </Row>
 {isHdd && <Row><NumField label="Kapacita (TB)"value={data.capacity_tb ?? 0} step={0.1} onChange={v => set('capacity_tb', v)} /></Row>}
 <Row><Field label="Poznamka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

export default function CameraCatalogPage() {
 const catalog = useCameraCatalog();
 const catCats = useCatalogCategories('camera', CAMERA_CATEGORY_GROUPS);
 const { organization } = useOrganization();
 const organizationId = organization?.id;
 const { toast } = useToast();
 const [tab, setTab] = useState<Tab>('cameras');
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editData, setEditData] = useState<Partial<AnyItem>>({});
 const [adding, setAdding] = useState(false);
 const [addData, setAddData] = useState<Partial<AnyItem>>({});
 const [saving, setSaving] = useState(false);

 const getItems = (): AnyItem[] => {
 if (tab === 'cameras') return catalog.cameras;
 if (tab === 'nvrs') return catalog.nvrs;
 if (tab === 'cables') return catalog.cables;
 if (tab === 'switches') return catalog.poeSwitches;
 if (tab === 'accessories') return catalog.accessories;
 return [];
 };

 const startAdd = () => { setAdding(true); setAddData(emptyItem(tab)); setEditingId(null); };
 const startEdit = (item: AnyItem) => { setEditingId(item.id); setEditData({ ...item }); setAdding(false); };
 const cancelEdit = () => { setEditingId(null); setAdding(false); };

 const handleSave = useCallback(async (id: string | null, data: Partial<AnyItem>) => {
 if (!organizationId) return;
 setSaving(true);
 try {
 if (id) {
 const { error } = await supabase.from(TABLE_NAME[tab]!).update(data).eq('id', id);
 if (error) throw error;
 toast('Ulozeno', 'success');
 } else {
 const { error } = await supabase.from(TABLE_NAME[tab]!).insert({ ...data, org_id: organizationId });
 if (error) throw error;
 toast('Pridano', 'success');
 }
 catalog.reload();
 setEditingId(null);
 setAdding(false);
 } catch (e: unknown) {
 toast(e instanceof Error ? e.message : 'Chyba', 'error');
 } finally { setSaving(false); }
 }, [organizationId, tab, catalog, toast]);

 const handleDelete = async (id: string) => {
 if (!confirm('Opravdu smazat?')) return;
 const { error } = await supabase.from(TABLE_NAME[tab]!).delete().eq('id', id);
 if (error) toast(error.message, 'error');
 else { toast('Smazano', 'success'); catalog.reload(); }
 };

 const cameraTypeOpts = catCats.getOptions('camera_type').length > 0 ? catCats.getOptions('camera_type') : Object.entries(CAMERA_TYPE_LABELS) as [string, string][];
 const cableTypeOpts = catCats.getOptions('camera_cable_type').length > 0 ? catCats.getOptions('camera_cable_type') : Object.entries(CABLE_TYPE_LABELS) as [string, string][];
 const accTypeOpts = catCats.getOptions('camera_accessory_type').length > 0 ? catCats.getOptions('camera_accessory_type') : Object.entries(ACC_TYPE_LABELS) as [string, string][];

 const renderFields = (data: Partial<AnyItem>, onChange: (d: Partial<AnyItem>) => void) => {
 if (tab === 'cameras') return <CameraFields data={data as Partial<CameraModel>} onChange={onChange as (d: Partial<CameraModel>) => void} cameraTypeOptions={cameraTypeOpts} />;
 if (tab === 'nvrs') return <NvrFields data={data as Partial<CameraNvr>} onChange={onChange as (d: Partial<CameraNvr>) => void} />;
 if (tab === 'cables') return <CableFields data={data as Partial<CameraCable>} onChange={onChange as (d: Partial<CameraCable>) => void} cableTypeOptions={cableTypeOpts} />;
 if (tab === 'switches') return <SwitchFields data={data as Partial<CameraPoeSwitch>} onChange={onChange as (d: Partial<CameraPoeSwitch>) => void} />;
 return <AccessoryFields data={data as Partial<CameraAccessory>} onChange={onChange as (d: Partial<CameraAccessory>) => void} accTypeOptions={accTypeOpts} />;
 };

 const getCamTypeLabel = (key: string) => catCats.getLabel('camera_type', key) || CAMERA_TYPE_LABELS[key] || key;
 const getCableTypeLabel = (key: string) => catCats.getLabel('camera_cable_type', key) || CABLE_TYPE_LABELS[key] || key;
 const getAccTypeLabel = (key: string) => catCats.getLabel('camera_accessory_type', key) || ACC_TYPE_LABELS[key] || key;

 const getSubline = (item: AnyItem): string => {
 if (tab === 'cameras') {
 const c = item as CameraModel;
 return `${c.manufacturer} · ${getCamTypeLabel(c.camera_type)} · ${c.resolution_label} · FOV ${c.h_fov_deg}° · ${c.price.toLocaleString('cs-CZ')} Kc`;
 }
 if (tab === 'nvrs') {
 const n = item as CameraNvr;
 return `${n.manufacturer} · ${n.channels}ch · ${n.poe_ports} PoE · ${n.hdd_bays} HDD · ${n.price.toLocaleString('cs-CZ')} Kc`;
 }
 if (tab === 'cables') {
 const c = item as CameraCable;
 return `${getCableTypeLabel(c.cable_type)} · max ${c.max_length_m}m · ${c.price_per_m.toLocaleString('cs-CZ')} Kc/m`;
 }
 if (tab === 'switches') {
 const s = item as CameraPoeSwitch;
 return `${s.manufacturer} · ${s.poe_ports} PoE · ${s.poe_budget_w}W · ${s.managed ? 'Managed' : 'Unmanaged'} · ${s.price.toLocaleString('cs-CZ')} Kc`;
 }
 const a = item as CameraAccessory;
 return `${getAccTypeLabel(a.accessory_type)}${a.capacity_tb ? ` · ${a.capacity_tb} TB` : ''} · ${a.price.toLocaleString('cs-CZ')} Kc`;
 };

 const getImageUrl = (item: AnyItem): string | null => {
 if (tab === 'cameras') return (item as CameraModel).image_url;
 if (tab === 'nvrs') return (item as CameraNvr).image_url;
 if (tab === 'switches') return (item as CameraPoeSwitch).image_url;
 if (tab === 'accessories') return (item as CameraAccessory).image_url;
 return null;
 };

 const items = getItems();

 return (
 <div className="p-6 max-w-4xl mx-auto">
 <div className="mb-6">
 <div className="flex items-center gap-3 mb-1">
 <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
 <Camera className="w-5 h-5 text-blue-400"/>
 </div>
 <div>
 <h1 className="text-2xl font-extrabold text-white">Kamerovy katalog</h1>
 <p className="text-sm text-slate-500 font-medium">Kamery, NVR, kabelaz, PoE switche a prislusenstvi</p>
 </div>
 </div>
 </div>

 <div className="flex gap-1 mb-6 bg-white/[0.06] rounded-xl p-1">
 {TABS.map(t => {
 const Icon = t.icon;
 const count = (() => {
 if (t.id === 'cameras') return catalog.cameras.length;
 if (t.id === 'nvrs') return catalog.nvrs.length;
 if (t.id === 'cables') return catalog.cables.length;
 if (t.id === 'switches') return catalog.poeSwitches.length;
 if (t.id === 'accessories') return catalog.accessories.length;
 if (t.id === 'categories') return CAMERA_CATEGORY_GROUPS.length;
 return 0;
 })();
 return (
 <button key={t.id} onClick={() => { setTab(t.id); cancelEdit(); }}
 className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-extrabold text-xs transition ${tab === t.id ? 'bg-white/[0.06] text-blue-400 ' : 'text-slate-500 hover:text-slate-300'}`}>
 <Icon className="w-3.5 h-3.5"/>
 {t.label}
 {count > 0 && <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.08] text-slate-500'}`}>{count}</span>}
 </button>
 );
 })}
 </div>

 {tab === 'categories' ? (
 <CategoryManager
  groups={CAMERA_CATEGORY_GROUPS}
  getCategoriesForGroup={catCats.getCategoriesForGroup}
  hasCustomCategories={catCats.hasCustomCategories}
  seedDefaults={catCats.seedDefaults}
  addCategory={catCats.addCategory}
  updateCategory={catCats.updateCategory}
  deleteCategory={catCats.deleteCategory}
  accentColor="blue"
 />
 ) : (<>

 <div className="flex justify-end mb-4">
 <button onClick={startAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-extrabold text-sm hover:bg-blue-700 transition">
 <Plus className="w-4 h-4"/> Pridat
 </button>
 </div>

 {adding && (
 <div className="mb-4 bg-blue-500/10 border border-blue-200 rounded-2xl p-5">
 <div className="text-sm font-extrabold text-white mb-4">Nova polozka</div>
 <div className="space-y-3">{renderFields(addData, setAddData)}</div>
 <div className="flex gap-2 mt-4">
 <button onClick={() => handleSave(null, addData)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-extrabold text-sm hover:bg-blue-700 transition disabled:opacity-50">
 {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Save className="w-3.5 h-3.5"/>} Pridat
 </button>
 <button onClick={cancelEdit} className="px-4 py-2 bg-navy-800/60 border border-white/[0.08] rounded-xl font-extrabold text-sm text-slate-400 hover:bg-white/[0.04] transition flex items-center gap-1.5">
 <X className="w-3.5 h-3.5"/> Zrusit
 </button>
 </div>
 </div>
 )}

 {catalog.loading ? (
 <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500"/></div>
 ) : items.length === 0 && !adding ? (
 <div className="text-center py-12 text-slate-400">
 <Camera className="w-12 h-12 mx-auto mb-3 opacity-20"/>
 <div className="font-extrabold">Zadne polozky</div>
 <div className="text-sm mt-1">Kliknete na "Pridat"pro prvni polozku.</div>
 </div>
 ) : (
 <div className="space-y-2">
 {items.map(item => (
 <div key={item.id} className={`rounded-xl border bg-white/[0.06] overflow-hidden transition ${editingId === item.id ? 'border-blue-300 shadow-md' : 'border-white/10 hover:border-white/[0.12]'}`}>
 {editingId === item.id ? (
 <div className="p-4">
 <div className="space-y-3 mb-4">{renderFields(editData, setEditData)}</div>
 <div className="flex gap-2">
 <button onClick={() => handleSave(item.id, editData)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-extrabold text-sm hover:bg-blue-700 transition disabled:opacity-50">
 {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Save className="w-3.5 h-3.5"/>} Ulozit
 </button>
 <button onClick={cancelEdit} className="px-4 py-2 bg-navy-800/60 border border-white/[0.08] rounded-xl font-extrabold text-sm text-slate-400 hover:bg-white/[0.04] transition flex items-center gap-1.5">
 <X className="w-3.5 h-3.5"/> Zrusit
 </button>
 </div>
 </div>
 ) : (
 <div className="flex items-center gap-3 p-3">
 {getImageUrl(item) ? (
 <img src={getImageUrl(item)!} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10" />
 ) : (
 <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
 <Camera className="w-5 h-5 text-blue-500"/>
 </div>
 )}
 <div className="flex-1 min-w-0">
 <div className="text-sm font-extrabold text-white truncate">{item.name}</div>
 <div className="text-[11px] font-extrabold text-slate-400 truncate">{getSubline(item)}</div>
 </div>
 <div className="flex gap-1 shrink-0">
 <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/100/10 transition"><Pencil className="w-3.5 h-3.5"/></button>
 <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/100/10 transition"><Trash2 className="w-3.5 h-3.5"/></button>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </>)}
 </div>
 );
}
