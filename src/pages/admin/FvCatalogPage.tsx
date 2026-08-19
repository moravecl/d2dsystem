import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Save, X, Sun, Zap, Battery, Car, Package, Loader2, Wrench, Anchor, RailSymbol, Grip, BadgePercent, HardHat } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useFvCatalog } from '../../hooks/useFvCatalog';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import { useSubsidyPrograms } from '../../hooks/useSubsidyPrograms';
import type { SubsidyProgram } from '../../hooks/useSubsidyPrograms';
import type { FvPanel, FvInverter, FvBattery, FvWallbox, FvAccessory, FvRoofTile, FvHook, FvRailProfile, FvClamp, FvLaborRate } from '../../hooks/useFvCatalog';

type Tab = 'panels' | 'inverters' | 'batteries' | 'wallboxes' | 'accessories' | 'rooftiles' | 'hooks' | 'railprofiles' | 'clamps' | 'labor' | 'subsidies';

const TABS: { id: Tab; label: string; icon: typeof Sun }[] = [
 { id: 'panels', label: 'Panely', icon: Sun },
 { id: 'inverters', label: 'Střídače', icon: Zap },
 { id: 'batteries', label: 'Baterie', icon: Battery },
 { id: 'wallboxes', label: 'Wallboxy', icon: Car },
 { id: 'accessories', label: 'Příslušenství', icon: Package },
 { id: 'rooftiles', label: 'Krytiny', icon: Wrench },
 { id: 'hooks', label: 'Háky', icon: Anchor },
 { id: 'railprofiles', label: 'Profily', icon: RailSymbol },
 { id: 'clamps', label: 'Příchytky', icon: Grip },
 { id: 'labor', label: 'Montáž', icon: HardHat },
 { id: 'subsidies', label: 'Dotace', icon: BadgePercent },
];

const TECH_LABELS: Record<string, string> = { mono: 'Mono', poly: 'Poly', topcon: 'TOPCon', hjt: 'HJT', other: 'Jiná' };
const CHEM_LABELS: Record<string, string> = { lfp: 'LFP', nmc: 'NMC', lead: 'Olovo', other: 'Jiná' };
const BATTERY_ROLE_LABELS: Record<string, string> = { master: 'Master', slave: 'Slave', bms: 'BMS', standalone: 'Samostatná' };
const CONN_LABELS: Record<string, string> = { type1: 'Type 1', type2: 'Type 2', ccs: 'CCS', chademo: 'CHAdeMO', other: 'Jiný' };
const ACC_TYPE_LABELS: Record<string, string> = {
 mounting_flat: 'Montáž (plochá)', mounting_pitched: 'Montáž (šikmá)', optimizer: 'Optimizer',
 cable: 'Kabel', combiner: 'Kombiner', monitoring: 'Monitoring', protection: 'Ochrana', other: 'Jiné',
};

const TILE_TYPE_LABELS: Record<string, string> = {
 tiled: 'Tašková', metal_sheet: 'Plechová', bitumen: 'Bitumenová',
 flat: 'Plochá', trapezoid: 'Trapézový plech', other: 'Jiná',
};

const MATERIAL_LABELS: Record<string, string> = { aluminum: 'Hliník', steel: 'Ocel', other: 'Jiný' };
const CLAMP_TYPE_LABELS: Record<string, string> = { mid: 'Středová', end: 'Krajová' };
const LABOR_COMPONENT_LABELS: Record<string, string> = {
 panel: 'Panel', inverter: 'Střídač', battery: 'Baterie',
 wallbox: 'Wallbox', construction: 'Konstrukce', other: 'Jiné',
};

type AnyFvItem = FvPanel | FvInverter | FvBattery | FvWallbox | FvAccessory | FvRoofTile | FvHook | FvRailProfile | FvClamp | FvLaborRate | SubsidyProgram;

function EmptyPanelForm({ tab }: { tab: Tab }) {
 if (tab === 'panels') return {
 name: '', manufacturer: '', power_wp: 400, width_mm: 1134, height_mm: 1762, depth_mm: 35,
 weight_kg: 21.5, technology: 'mono', efficiency_pct: 21.0,
 warranty_product_years: 12, warranty_performance_years: 25, price: 0, purchase_price: 0,
 gap_h_mm: 20, gap_v_mm: 20, image_url: '', notes: '', is_active: true,
 } as Partial<FvPanel>;
 if (tab === 'inverters') return {
 name: '', manufacturer: '', power_kw: 5, phases: 3, mppt_count: 2,
 efficiency_pct: 97.5, technology: 'string', max_pv_power_kw: 7.5, price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
 } as Partial<FvInverter>;
 if (tab === 'batteries') return {
 name: '', manufacturer: '', capacity_kwh: 10, power_kw: 5, chemistry: 'lfp',
 cycles: 6000, dod_pct: 90, warranty_years: 10, price: 0, purchase_price: 0,
 battery_role: 'standalone', compatibility_group: '', max_slave_units: 0,
 image_url: '', notes: '', is_active: true,
 } as Partial<FvBattery>;
 if (tab === 'wallboxes') return {
 name: '', manufacturer: '', power_kw: 11, phases: 3, connector_type: 'type2',
 smart_charging: false, dynamic_load_balancing: false, price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
 } as Partial<FvWallbox>;
 if (tab === 'rooftiles') return {
 name: '', type: 'tiled', hook_spacing_mm: 350, notes: '', is_active: true,
 } as Partial<FvRoofTile>;
 if (tab === 'hooks') return {
 name: '', compatible_tile_type: 'tiled', height_mm: 80, price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
 } as Partial<FvHook>;
 if (tab === 'railprofiles') return {
 name: '', width_mm: 40, height_mm: 40, length_mm: 4200, material: 'aluminum', price_per_m: 0, purchase_price_per_m: 0, image_url: '', notes: '', is_active: true,
 } as Partial<FvRailProfile>;
 if (tab === 'clamps') return {
 name: '', clamp_type: 'mid', min_thickness_mm: 30, max_thickness_mm: 40, price: 0, purchase_price: 0, image_url: '', notes: '', is_active: true,
 } as Partial<FvClamp>;
 if (tab === 'labor') return {
 name: '', component_type: 'panel', price_per_unit: 0, purchase_price_per_unit: 0, unit: 'ks', notes: '', is_active: true, sort_order: 0,
 } as Partial<FvLaborRate>;
 if (tab === 'subsidies') return {
 name: '', description: '', max_amount_czk: 200000, max_percentage: 50, is_active: true, sort_order: 0,
 } as Partial<SubsidyProgram>;
 return {
 name: '', type: 'mounting_pitched', unit: 'ks', price_per_unit: 0, purchase_price_per_unit: 0, notes: '', is_active: true,
 } as Partial<FvAccessory>;
}

function PanelFields({ data, onChange }: { data: Partial<FvPanel>; onChange: (d: Partial<FvPanel>) => void }) {
 const set = (k: keyof FvPanel, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row><Field label="Výrobce"value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /></Row>
 <Row cols={3}>
 <NumField label="Výkon (Wp)"value={data.power_wp ?? 0} onChange={v => set('power_wp', v)} />
 <NumField label="Šířka (mm)"value={data.width_mm ?? 0} onChange={v => set('width_mm', v)} />
 <NumField label="Výška (mm)"value={data.height_mm ?? 0} onChange={v => set('height_mm', v)} />
 </Row>
 <Row cols={3}>
 <NumField label="Hloubka (mm)"value={data.depth_mm ?? 35} onChange={v => set('depth_mm', v)} />
 <NumField label="Hmotnost (kg)"value={data.weight_kg ?? 0} step={0.1} onChange={v => set('weight_kg', v)} />
 <NumField label="Účinnost (%)"value={data.efficiency_pct ?? 0} step={0.1} onChange={v => set('efficiency_pct', v)} />
 </Row>
 <Row cols={2}>
 <SelectField label="Technologie"value={data.technology ?? 'mono'} options={Object.entries(TECH_LABELS)} onChange={v => set('technology', v)} />
 <NumField label="Prodejní cena (Kč)"value={data.price ?? 0} onChange={v => set('price', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Nákupní cena (Kč)"value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
 <div></div>
 </Row>
 <Row cols={2}>
 <NumField label="Záruka produkt (r)"value={data.warranty_product_years ?? 12} onChange={v => set('warranty_product_years', v)} />
 <NumField label="Záruka výkon (r)"value={data.warranty_performance_years ?? 25} onChange={v => set('warranty_performance_years', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Mezera horizontální (mm)"value={data.gap_h_mm ?? 20} onChange={v => set('gap_h_mm', v)} />
 <NumField label="Mezera vertikální (mm)"value={data.gap_v_mm ?? 20} onChange={v => set('gap_v_mm', v)} />
 </Row>
 <Row><Field label="URL obrázku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 <Row><Field label="Poznámka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function InverterFields({ data, onChange }: { data: Partial<FvInverter>; onChange: (d: Partial<FvInverter>) => void }) {
 const set = (k: keyof FvInverter, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row><Field label="Výrobce"value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /></Row>
 <Row cols={3}>
 <NumField label="Výkon (kW)"value={data.power_kw ?? 0} step={0.1} onChange={v => set('power_kw', v)} />
 <SelectField label="Fáze"value={String(data.phases ?? 3)} options={[['1', '1-fázový'], ['3', '3-fázový']]} onChange={v => set('phases', parseInt(v) as 1 | 3)} />
 <NumField label="MPPT"value={data.mppt_count ?? 1} onChange={v => set('mppt_count', v)} />
 </Row>
 <Row cols={3}>
 <NumField label="Účinnost (%)"value={data.efficiency_pct ?? 0} step={0.1} onChange={v => set('efficiency_pct', v)} />
 <NumField label="Max. FV výkon (kW)"value={data.max_pv_power_kw ?? 0} step={0.1} onChange={v => set('max_pv_power_kw', v)} />
 <NumField label="Prodejní cena (Kč)"value={data.price ?? 0} onChange={v => set('price', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Nákupní cena (Kč)"value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
 <Field label="Technologie / poznámka"value={data.technology ?? ''} onChange={v => set('technology', v)} />
 </Row>
 <Row><Field label="URL obrázku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 </>
 );
}

function BatteryFields({ data, onChange }: { data: Partial<FvBattery>; onChange: (d: Partial<FvBattery>) => void }) {
 const set = (k: keyof FvBattery, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row><Field label="Výrobce"value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /></Row>
 <Row cols={3}>
 <NumField label="Kapacita (kWh)"value={data.capacity_kwh ?? 0} step={0.1} onChange={v => set('capacity_kwh', v)} />
 <NumField label="Výkon (kW)"value={data.power_kw ?? 0} step={0.1} onChange={v => set('power_kw', v)} />
 <SelectField label="Chemie"value={data.chemistry ?? 'lfp'} options={Object.entries(CHEM_LABELS)} onChange={v => set('chemistry', v as FvBattery['chemistry'])} />
 </Row>
 <Row cols={3}>
 <NumField label="Cykly"value={data.cycles ?? 3000} onChange={v => set('cycles', v)} />
 <NumField label="DoD (%)"value={data.dod_pct ?? 90} onChange={v => set('dod_pct', v)} />
 <NumField label="Prodejní cena (Kč)"value={data.price ?? 0} onChange={v => set('price', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Nákupní cena (Kč)"value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
 <NumField label="Záruka (roky)"value={data.warranty_years ?? 10} onChange={v => set('warranty_years', v)} />
 </Row>
 <Row cols={3}>
 <SelectField label="Role baterie"value={data.battery_role ?? 'standalone'} options={Object.entries(BATTERY_ROLE_LABELS)} onChange={v => set('battery_role', v as FvBattery['battery_role'])} />
 <Field label="Skupina kompatibility"value={data.compatibility_group ?? ''} onChange={v => set('compatibility_group', v)} />
 <NumField label="Max. slave jednotek"value={data.max_slave_units ?? 0} onChange={v => set('max_slave_units', v)} />
 </Row>
 <Row><Field label="URL obrázku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 <Row><Field label="Poznámka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function WallboxFields({ data, onChange }: { data: Partial<FvWallbox>; onChange: (d: Partial<FvWallbox>) => void }) {
 const set = (k: keyof FvWallbox, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row><Field label="Výrobce"value={data.manufacturer ?? ''} onChange={v => set('manufacturer', v)} /></Row>
 <Row cols={3}>
 <NumField label="Výkon (kW)"value={data.power_kw ?? 11} step={0.1} onChange={v => set('power_kw', v)} />
 <SelectField label="Fáze"value={String(data.phases ?? 3)} options={[['1', '1-fázový'], ['3', '3-fázový']]} onChange={v => set('phases', parseInt(v) as 1 | 3)} />
 <SelectField label="Konektor"value={data.connector_type ?? 'type2'} options={Object.entries(CONN_LABELS)} onChange={v => set('connector_type', v as FvWallbox['connector_type'])} />
 </Row>
 <Row cols={3}>
 <NumField label="Prodejní cena (Kč)"value={data.price ?? 0} onChange={v => set('price', v)} />
 <NumField label="Nákupní cena (Kč)"value={data.purchase_price ?? 0} onChange={v => set('purchase_price', v)} />
 <div className="flex flex-col gap-1">
 <label className="text-[10px] font-extrabold text-slate-400 uppercase">Funkce</label>
 <label className="flex items-center gap-2 text-xs font-extrabold text-slate-400 cursor-pointer">
 <input type="checkbox"checked={data.smart_charging ?? false} onChange={e => set('smart_charging', e.target.checked)} className="accent-orange-500"/>
 Smart charging
 </label>
 <label className="flex items-center gap-2 text-xs font-extrabold text-slate-400 cursor-pointer">
 <input type="checkbox"checked={data.dynamic_load_balancing ?? false} onChange={e => set('dynamic_load_balancing', e.target.checked)} className="accent-orange-500"/>
 Dynamické vyrovnávání
 </label>
 </div>
 </Row>
 <Row><Field label="URL obrázku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 </>
 );
}

function AccessoryFields({ data, onChange }: { data: Partial<FvAccessory>; onChange: (d: Partial<FvAccessory>) => void }) {
 const set = (k: keyof FvAccessory, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={2}>
 <SelectField label="Typ"value={data.type ?? 'other'} options={Object.entries(ACC_TYPE_LABELS)} onChange={v => set('type', v as FvAccessory['type'])} />
 <Field label="Jednotka"value={data.unit ?? 'ks'} onChange={v => set('unit', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Prodejní cena/jednotka (Kč)"value={data.price_per_unit ?? 0} step={0.01} onChange={v => set('price_per_unit', v)} />
 <NumField label="Nákupní cena/jednotka (Kč)"value={data.purchase_price_per_unit ?? 0} step={0.01} onChange={v => set('purchase_price_per_unit', v)} />
 </Row>
 <Row><Field label="Poznámka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function RoofTileFields({ data, onChange }: { data: Partial<FvRoofTile>; onChange: (d: Partial<FvRoofTile>) => void }) {
 const set = (k: keyof FvRoofTile, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={2}>
 <SelectField label="Typ krytiny"value={data.type ?? 'tiled'} options={Object.entries(TILE_TYPE_LABELS)} onChange={v => set('type', v)} />
 <NumField label="Rozteč háků (mm)"value={data.hook_spacing_mm ?? 350} onChange={v => set('hook_spacing_mm', v)} />
 </Row>
 <Row><Field label="Poznámka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function HookFields({ data, onChange }: { data: Partial<FvHook>; onChange: (d: Partial<FvHook>) => void }) {
 const set = (k: keyof FvHook, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={2}>
 <SelectField label="Kompatibilní krytina"value={data.compatible_tile_type ?? 'tiled'} options={Object.entries(TILE_TYPE_LABELS)} onChange={v => set('compatible_tile_type', v)} />
 <NumField label="Výška (mm)"value={data.height_mm ?? 80} onChange={v => set('height_mm', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Prodejní cena (Kč)"value={data.price ?? 0} step={0.01} onChange={v => set('price', v)} />
 <NumField label="Nákupní cena (Kč)"value={data.purchase_price ?? 0} step={0.01} onChange={v => set('purchase_price', v)} />
 </Row>
 <Row><Field label="URL obrázku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 <Row><Field label="Poznámka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function RailProfileFields({ data, onChange }: { data: Partial<FvRailProfile>; onChange: (d: Partial<FvRailProfile>) => void }) {
 const set = (k: keyof FvRailProfile, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={3}>
 <NumField label="Šířka (mm)"value={data.width_mm ?? 40} onChange={v => set('width_mm', v)} />
 <NumField label="Výška (mm)"value={data.height_mm ?? 40} onChange={v => set('height_mm', v)} />
 <NumField label="Délka (mm)"value={data.length_mm ?? 4200} onChange={v => set('length_mm', v)} />
 </Row>
 <Row cols={3}>
 <SelectField label="Materiál"value={data.material ?? 'aluminum'} options={Object.entries(MATERIAL_LABELS)} onChange={v => set('material', v)} />
 <NumField label="Prodejní cena/m (Kč)"value={data.price_per_m ?? 0} step={0.01} onChange={v => set('price_per_m', v)} />
 <NumField label="Nákupní cena/m (Kč)"value={data.purchase_price_per_m ?? 0} step={0.01} onChange={v => set('purchase_price_per_m', v)} />
 </Row>
 <Row><Field label="URL obrázku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 <Row><Field label="Poznámka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function ClampFields({ data, onChange }: { data: Partial<FvClamp>; onChange: (d: Partial<FvClamp>) => void }) {
 const set = (k: keyof FvClamp, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={3}>
 <SelectField label="Typ příchytky"value={data.clamp_type ?? 'mid'} options={Object.entries(CLAMP_TYPE_LABELS)} onChange={v => set('clamp_type', v)} />
 <NumField label="Min. tloušťka (mm)"value={data.min_thickness_mm ?? 30} onChange={v => set('min_thickness_mm', v)} />
 <NumField label="Max. tloušťka (mm)"value={data.max_thickness_mm ?? 40} onChange={v => set('max_thickness_mm', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Prodejní cena (Kč)"value={data.price ?? 0} step={0.01} onChange={v => set('price', v)} />
 <NumField label="Nákupní cena (Kč)"value={data.purchase_price ?? 0} step={0.01} onChange={v => set('purchase_price', v)} />
 </Row>
 <Row><Field label="URL obrázku"value={data.image_url ?? ''} onChange={v => set('image_url', v)} /></Row>
 <Row><Field label="Poznámka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function LaborRateFields({ data, onChange }: { data: Partial<FvLaborRate>; onChange: (d: Partial<FvLaborRate>) => void }) {
 const set = (k: keyof FvLaborRate, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row cols={3}>
 <SelectField label="Typ komponenty"value={data.component_type ?? 'panel'} options={Object.entries(LABOR_COMPONENT_LABELS)} onChange={v => set('component_type', v)} />
 <NumField label="Prodejní cena/jednotka (Kč)"value={data.price_per_unit ?? 0} step={0.01} onChange={v => set('price_per_unit', v)} />
 <Field label="Jednotka"value={data.unit ?? 'ks'} onChange={v => set('unit', v)} />
 </Row>
 <Row cols={3}>
 <NumField label="Nákladová cena/jednotka (Kč)"value={data.purchase_price_per_unit ?? 0} step={0.01} onChange={v => set('purchase_price_per_unit', v)} />
 <NumField label="Pořadí"value={data.sort_order ?? 0} onChange={v => set('sort_order', v)} />
 <div>
 <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">Stav</label>
 <label className="flex items-center gap-2 text-xs font-extrabold text-slate-400 cursor-pointer mt-2">
 <input type="checkbox"checked={data.is_active ?? true} onChange={e => set('is_active', e.target.checked)} className="accent-orange-500"/>
 Aktivní
 </label>
 </div>
 </Row>
 <Row><Field label="Poznámka"value={data.notes ?? ''} onChange={v => set('notes', v)} /></Row>
 </>
 );
}

function SubsidyFields({ data, onChange }: { data: Partial<SubsidyProgram>; onChange: (d: Partial<SubsidyProgram>) => void }) {
 const set = (k: keyof SubsidyProgram, v: unknown) => onChange({ ...data, [k]: v });
 return (
 <>
 <Row><Field label="Název programu"value={data.name ?? ''} onChange={v => set('name', v)} /></Row>
 <Row><Field label="Popis"value={data.description ?? ''} onChange={v => set('description', v)} /></Row>
 <Row cols={2}>
 <NumField label="Max. částka (Kč)"value={data.max_amount_czk ?? 0} onChange={v => set('max_amount_czk', v)} />
 <NumField label="Max. procent (%)"value={data.max_percentage ?? 0} step={0.1} onChange={v => set('max_percentage', v)} />
 </Row>
 <Row cols={2}>
 <NumField label="Pořadí"value={data.sort_order ?? 0} onChange={v => set('sort_order', v)} />
 <div>
 <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">Stav</label>
 <label className="flex items-center gap-2 text-xs font-extrabold text-slate-400 cursor-pointer mt-2">
 <input type="checkbox"checked={data.is_active ?? true} onChange={e => set('is_active', e.target.checked)} className="accent-orange-500"/>
 Aktivní
 </label>
 </div>
 </Row>
 </>
 );
}

function Row({ children, cols }: { children: React.ReactNode; cols?: number }) {
 return (
 <div className={`grid gap-3 ${cols === 3 ? 'grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
 {children}
 </div>
 );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
 return (
 <div>
 <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">{label}</label>
 <input
 className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06]"
 value={value}
 onChange={e => onChange(e.target.value)}
 />
 </div>
 );
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
 return (
 <div>
 <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">{label}</label>
 <input
 type="number"
 step={step ?? 1}
 min="0"
 className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06]"
 value={value}
 onChange={e => onChange(step ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)}
 />
 </div>
 );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
 return (
 <div>
 <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-0.5">{label}</label>
 <select
 className="w-full border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 focus:outline-none focus:border-orange-400 bg-white/[0.06]"
 value={value}
 onChange={e => onChange(e.target.value)}
 >
 {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
 </select>
 </div>
 );
}

const TABLE_NAME: Record<Tab, string> = {
 panels: 'fv_panels', inverters: 'fv_inverters', batteries: 'fv_batteries',
 wallboxes: 'fv_wallboxes', accessories: 'fv_accessories',
 rooftiles: 'fv_roof_tiles', hooks: 'fv_hooks', railprofiles: 'fv_rail_profiles',
 clamps: 'fv_clamps', labor: 'fv_labor_rates', subsidies: 'fv_subsidy_programs',
};

export default function FvCatalogPage() {
 const catalog = useFvCatalog();
 const { programs: subsidyPrograms, reload: reloadSubsidies } = useSubsidyPrograms();
 const { organization } = useOrganization();
 const organizationId = organization?.id;
 const { toast } = useToast();
 const [tab, setTab] = useState<Tab>('panels');
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editData, setEditData] = useState<Partial<AnyFvItem>>({});
 const [adding, setAdding] = useState(false);
 const [addData, setAddData] = useState<Partial<AnyFvItem>>({});
 const [saving, setSaving] = useState(false);

 const getItems = (): AnyFvItem[] => {
 if (tab === 'panels') return catalog.panels;
 if (tab === 'inverters') return catalog.inverters;
 if (tab === 'batteries') return catalog.batteries;
 if (tab === 'wallboxes') return catalog.wallboxes;
 if (tab === 'rooftiles') return catalog.roofTiles;
 if (tab === 'hooks') return catalog.hooks;
 if (tab === 'railprofiles') return catalog.railProfiles;
 if (tab === 'clamps') return catalog.clamps;
 if (tab === 'labor') return catalog.laborRates;
 if (tab === 'subsidies') return subsidyPrograms as unknown as AnyFvItem[];
 return catalog.accessories;
 };

 const startAdd = () => {
 setAdding(true);
 setAddData(EmptyPanelForm({ tab }));
 setEditingId(null);
 };

 const startEdit = (item: AnyFvItem) => {
 setEditingId(item.id);
 setEditData({ ...item });
 setAdding(false);
 };

 const cancelEdit = () => { setEditingId(null); setAdding(false); };

 const handleSave = useCallback(async (id: string | null, data: Partial<AnyFvItem>) => {
 if (!organizationId) return;
 setSaving(true);
 try {
 if (id) {
 const { error } = await supabase.from(TABLE_NAME[tab]).update(data).eq('id', id);
 if (error) throw error;
 toast('Uloženo', 'success');
 } else {
 const { error } = await supabase.from(TABLE_NAME[tab]).insert({ ...data, org_id: organizationId });
 if (error) throw error;
 toast('Přidáno', 'success');
 }
 if (tab === 'subsidies') reloadSubsidies(); else catalog.reload();
 setEditingId(null);
 setAdding(false);
 } catch (e: unknown) {
 const msg = e instanceof Error ? e.message : 'Chyba při ukládání';
 toast(msg, 'error');
 } finally {
 setSaving(false);
 }
 }, [organizationId, tab, catalog, toast, reloadSubsidies]);

 const handleDelete = async (id: string) => {
 if (!confirm('Opravdu smazat?')) return;
 const { error } = await supabase.from(TABLE_NAME[tab]).delete().eq('id', id);
 if (error) toast(error.message, 'error');
 else { toast('Smazáno', 'success'); if (tab === 'subsidies') reloadSubsidies(); else catalog.reload(); }
 };

 const renderFields = (data: Partial<AnyFvItem>, onChange: (d: Partial<AnyFvItem>) => void) => {
 if (tab === 'panels') return <PanelFields data={data as Partial<FvPanel>} onChange={onChange as (d: Partial<FvPanel>) => void} />;
 if (tab === 'inverters') return <InverterFields data={data as Partial<FvInverter>} onChange={onChange as (d: Partial<FvInverter>) => void} />;
 if (tab === 'batteries') return <BatteryFields data={data as Partial<FvBattery>} onChange={onChange as (d: Partial<FvBattery>) => void} />;
 if (tab === 'wallboxes') return <WallboxFields data={data as Partial<FvWallbox>} onChange={onChange as (d: Partial<FvWallbox>) => void} />;
 if (tab === 'rooftiles') return <RoofTileFields data={data as Partial<FvRoofTile>} onChange={onChange as (d: Partial<FvRoofTile>) => void} />;
 if (tab === 'hooks') return <HookFields data={data as Partial<FvHook>} onChange={onChange as (d: Partial<FvHook>) => void} />;
 if (tab === 'railprofiles') return <RailProfileFields data={data as Partial<FvRailProfile>} onChange={onChange as (d: Partial<FvRailProfile>) => void} />;
 if (tab === 'clamps') return <ClampFields data={data as Partial<FvClamp>} onChange={onChange as (d: Partial<FvClamp>) => void} />;
 if (tab === 'labor') return <LaborRateFields data={data as Partial<FvLaborRate>} onChange={onChange as (d: Partial<FvLaborRate>) => void} />;
 if (tab === 'subsidies') return <SubsidyFields data={data as Partial<SubsidyProgram>} onChange={onChange as (d: Partial<SubsidyProgram>) => void} />;
 return <AccessoryFields data={data as Partial<FvAccessory>} onChange={onChange as (d: Partial<FvAccessory>) => void} />;
 };

 const getItemSubline = (item: AnyFvItem): string => {
 if (tab === 'panels') {
 const p = item as FvPanel;
 return `${p.manufacturer} · ${p.power_wp} Wp · ${TECH_LABELS[p.technology] ?? p.technology} · ${p.price.toLocaleString('cs-CZ')} Kč`;
 }
 if (tab === 'inverters') {
 const i = item as FvInverter;
 return `${i.manufacturer} · ${i.power_kw} kW · ${i.phases}f · ${i.mppt_count} MPPT · ${i.price.toLocaleString('cs-CZ')} Kč`;
 }
 if (tab === 'batteries') {
 const b = item as FvBattery;
 return `${b.manufacturer} · ${b.capacity_kwh} kWh · ${CHEM_LABELS[b.chemistry] ?? b.chemistry} · ${b.price.toLocaleString('cs-CZ')} Kč`;
 }
 if (tab === 'wallboxes') {
 const w = item as FvWallbox;
 return `${w.manufacturer} · ${w.power_kw} kW · ${w.phases}f · ${CONN_LABELS[w.connector_type] ?? w.connector_type} · ${w.price.toLocaleString('cs-CZ')} Kč`;
 }
 if (tab === 'rooftiles') {
 const rt = item as FvRoofTile;
 return `${TILE_TYPE_LABELS[rt.type] ?? rt.type} · rozteč háků ${rt.hook_spacing_mm} mm`;
 }
 if (tab === 'hooks') {
 const h = item as FvHook;
 return `${TILE_TYPE_LABELS[h.compatible_tile_type] ?? h.compatible_tile_type} · výška ${h.height_mm} mm · ${h.price.toLocaleString('cs-CZ')} Kč`;
 }
 if (tab === 'railprofiles') {
 const rp = item as FvRailProfile;
 return `${rp.width_mm}x${rp.height_mm} mm · ${rp.length_mm} mm · ${MATERIAL_LABELS[rp.material] ?? rp.material} · ${rp.price_per_m.toLocaleString('cs-CZ')} Kč/m`;
 }
 if (tab === 'clamps') {
 const cl = item as FvClamp;
 return `${CLAMP_TYPE_LABELS[cl.clamp_type] ?? cl.clamp_type} · ${cl.min_thickness_mm}-${cl.max_thickness_mm} mm · ${cl.price.toLocaleString('cs-CZ')} Kč`;
 }
 if (tab === 'labor') {
 const lr = item as FvLaborRate;
 return `${LABOR_COMPONENT_LABELS[lr.component_type] ?? lr.component_type} · ${lr.price_per_unit.toLocaleString('cs-CZ')} Kč/${lr.unit}`;
 }
 if (tab === 'subsidies') {
 const sp = item as unknown as SubsidyProgram;
 return `Max. ${sp.max_amount_czk.toLocaleString('cs-CZ')} Kč · Max. ${sp.max_percentage}% · ${sp.is_active ? 'Aktivní' : 'Neaktivní'}`;
 }
 const a = item as FvAccessory;
 return `${ACC_TYPE_LABELS[a.type] ?? a.type} · ${a.price_per_unit.toLocaleString('cs-CZ')} Kč/${a.unit}`;
 };

 const items = getItems();

 return (
 <div className="p-6 max-w-4xl mx-auto">
 <div className="mb-6">
 <div className="flex items-center gap-3 mb-1">
 <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
 <Sun className="w-5 h-5 text-orange-600"/>
 </div>
 <div>
 <h1 className="text-2xl font-extrabold text-white">FV Katalog</h1>
 <p className="text-sm text-slate-500 font-medium">Panely, střídače, baterie, wallboxy, příslušenství a konstrukční prvky</p>
 </div>
 </div>
 </div>

 <div className="flex flex-wrap gap-1 mb-6 bg-white/[0.06] rounded-xl p-1">
 {TABS.map(t => {
 const Icon = t.icon;
 const count = (() => {
 if (t.id === 'panels') return catalog.panels.length;
 if (t.id === 'inverters') return catalog.inverters.length;
 if (t.id === 'batteries') return catalog.batteries.length;
 if (t.id === 'wallboxes') return catalog.wallboxes.length;
 if (t.id === 'rooftiles') return catalog.roofTiles.length;
 if (t.id === 'hooks') return catalog.hooks.length;
 if (t.id === 'railprofiles') return catalog.railProfiles.length;
 if (t.id === 'clamps') return catalog.clamps.length;
 if (t.id === 'labor') return catalog.laborRates.length;
 if (t.id === 'subsidies') return subsidyPrograms.length;
 return catalog.accessories.length;
 })();
 return (
 <button
 key={t.id}
 onClick={() => { setTab(t.id); setEditingId(null); setAdding(false); }}
 className={`flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg font-extrabold text-xs transition whitespace-nowrap ${
 tab === t.id ? 'bg-white/[0.06] text-orange-600 ' : 'text-slate-500 hover:text-slate-300'
 }`}
 >
 <Icon className="w-3.5 h-3.5 shrink-0"/>
 <span className="hidden sm:inline">{t.label}</span>
 {count > 0 && <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-orange-100 text-orange-600' : 'bg-white/[0.08] text-slate-500'}`}>{count}</span>}
 </button>
 );
 })}
 </div>

 <div className="flex justify-end mb-4">
 <button
 onClick={startAdd}
 className="flex items-center gap-2 px-4 py-2 bg-orange-500/100 text-white rounded-xl font-extrabold text-sm hover:bg-orange-600 transition"
 >
 <Plus className="w-4 h-4"/> Přidat
 </button>
 </div>

 {adding && (
 <div className="mb-4 bg-orange-500/10 border border-orange-200 rounded-2xl p-5">
 <div className="text-sm font-extrabold text-white mb-4">Nová položka</div>
 <div className="space-y-3">
 {renderFields(addData, setAddData)}
 </div>
 <div className="flex gap-2 mt-4">
 <button
 onClick={() => handleSave(null, addData)}
 disabled={saving}
 className="flex items-center gap-1.5 px-4 py-2 bg-orange-500/100 text-white rounded-xl font-extrabold text-sm hover:bg-orange-600 transition disabled:opacity-50"
 >
 {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Save className="w-3.5 h-3.5"/>}
 Přidat
 </button>
 <button onClick={cancelEdit} className="px-4 py-2 bg-navy-800/60 border border-white/[0.08] rounded-xl font-extrabold text-sm text-slate-400 hover:bg-white/[0.04] transition flex items-center gap-1.5">
 <X className="w-3.5 h-3.5"/> Zrušit
 </button>
 </div>
 </div>
 )}

 {catalog.loading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-6 h-6 animate-spin text-orange-500"/>
 </div>
 ) : items.length === 0 && !adding ? (
 <div className="text-center py-12 text-slate-400">
 <Sun className="w-12 h-12 mx-auto mb-3 opacity-20"/>
 <div className="font-extrabold">Žádné položky</div>
 <div className="text-sm mt-1">Klikněte na "Přidat"pro první položku.</div>
 </div>
 ) : (
 <div className="space-y-2">
 {items.map(item => (
 <div key={item.id} className={`rounded-xl border bg-white/[0.06] overflow-hidden transition ${editingId === item.id ? 'border-orange-300 shadow-md' : 'border-white/10 hover:border-white/[0.12]'}`}>
 {editingId === item.id ? (
 <div className="p-4">
 <div className="space-y-3 mb-4">
 {renderFields(editData, setEditData)}
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => handleSave(item.id, editData)}
 disabled={saving}
 className="flex items-center gap-1.5 px-4 py-2 bg-orange-500/100 text-white rounded-xl font-extrabold text-sm hover:bg-orange-600 transition disabled:opacity-50"
 >
 {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Save className="w-3.5 h-3.5"/>}
 Uložit
 </button>
 <button onClick={cancelEdit} className="px-4 py-2 bg-navy-800/60 border border-white/[0.08] rounded-xl font-extrabold text-sm text-slate-400 hover:bg-white/[0.04] transition flex items-center gap-1.5">
 <X className="w-3.5 h-3.5"/> Zrušit
 </button>
 </div>
 </div>
 ) : (
 <div className="flex items-center gap-3 p-3">
 <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
 <Sun className="w-4 h-4 text-orange-500"/>
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-sm font-extrabold text-white truncate">{item.name}</div>
 <div className="text-[11px] font-extrabold text-slate-400 truncate">{getItemSubline(item)}</div>
 </div>
 {!(item as { is_active?: boolean }).is_active && (
 <span className="text-[10px] font-extrabold text-slate-400 bg-white/[0.06] rounded-full px-2 py-0.5 shrink-0">Neaktivní</span>
 )}
 <div className="flex gap-1 shrink-0">
 <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-500/10 transition">
 <Pencil className="w-3.5 h-3.5"/>
 </button>
 <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/100/10 transition">
 <Trash2 className="w-3.5 h-3.5"/>
 </button>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
