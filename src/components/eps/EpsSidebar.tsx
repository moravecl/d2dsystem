import { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert, Cpu, Volume2, Cable, Package, Trash2,
  Upload, Layers, Eye, EyeOff, Search, BarChart3,
  AlertTriangle, Info, ChevronDown, ChevronRight,
  Move, Keyboard, Radio, Pencil, Check, X as XIcon,
} from 'lucide-react';
import type { EpsCatalogData } from '../../hooks/useEpsCatalog';
import type { EpsDesignData, EpsDesignLayer } from '../../hooks/useEpsDesign';
import { calcTotalPrice, calcCableLengthM, calcZoneUtilization, validateDesign } from '../../lib/epsCalculations';

type SidebarTab = 'catalog' | 'layers' | 'calc';
type CatalogSection = 'detectors' | 'motion' | 'panels' | 'keypads' | 'sirens' | 'cables' | 'control' | 'accessories';

const DETECTOR_TYPE_LABELS: Record<string, string> = {
  smoke: 'Detektor kou\u0159e', heat: 'Tepeln\u00fd detektor', smoke_heat: 'Kombinovan\u00fd',
  linear: 'Line\u00e1rn\u00ed', manual_call_point: 'Tla\u010d\u00edtkov\u00fd', gas: 'Plynov\u00fd',
  co: 'CO detektor', flame: 'Plamenov\u00fd',
};
const DETECTOR_TYPE_COLORS: Record<string, string> = {
  smoke: 'bg-blue-500', heat: 'bg-red-500', smoke_heat: 'bg-emerald-500',
  linear: 'bg-violet-500', manual_call_point: 'bg-amber-500', gas: 'bg-pink-500',
  co: 'bg-cyan-500', flame: 'bg-orange-500',
};
const MOTION_TYPE_LABELS: Record<string, string> = {
  pir: 'PIR', pir_camera: 'PIR+kamera', dual_tech: 'Dual (PIR+MW)',
  curtain: 'Z\u00e1vora', outdoor: 'Venkovn\u00ed', pet_immune: 'Pet imunni',
};
const KEYPAD_TYPE_LABELS: Record<string, string> = {
  lcd: 'LCD', segment: 'Segmentov\u00e1', rfid: 'RFID p\u0159\u00edstup', touch: 'Dotykov\u00e1', combined: 'Kombinovan\u00e1',
};
const DEVICE_TYPE_LABELS: Record<string, string> = {
  remote_control: 'D\u00e1lkov\u00e1k', relay_output: 'Rel\u00e9 v\u00fdstup', communicator: 'Komunik\u00e1tor',
  expander: 'Roz\u0161i\u0159ova\u010d', thermostat: 'Termostat', rfid_tag: 'RFID tag', other: 'Ostatn\u00ed',
};

type CanvasMode = 'navigate' | 'place_detector' | 'draw_route' | 'place_panel' | 'place_siren' | 'place_motion_sensor' | 'place_keypad' | 'place_control_device' | 'set_scale';

const MODE_TO_CATALOG: Partial<Record<CanvasMode, CatalogSection>> = {
  place_detector: 'detectors',
  place_motion_sensor: 'motion',
  place_panel: 'panels',
  place_keypad: 'keypads',
  place_siren: 'sirens',
  draw_route: 'cables',
  place_control_device: 'control',
};

interface Props {
  catalog: EpsCatalogData;
  designData: EpsDesignData;
  selectedDetectorModelId: string | null;
  selectedPlacedDetectorId: string | null;
  canvasMode?: CanvasMode;
  onSelectDetectorModel: (id: string | null) => void;
  onSelectMotionSensor: (id: string | null) => void;
  onSelectPanel: (id: string | null) => void;
  onSelectKeypad: (id: string | null) => void;
  onSelectSiren: (id: string | null) => void;
  onSelectControlDevice: (id: string | null) => void;
  onDeletePlacedDetector: (id: string) => void;
  onDeleteMotionSensor: (id: string) => void;
  onDeleteRoute: (id: string) => void;
  onDeletePanel: (id: string) => void;
  onDeleteKeypad: (id: string) => void;
  onDeleteSiren: (id: string) => void;
  onDeleteControlDevice: (id: string) => void;
  onAddLayer: (layer: EpsDesignLayer) => void;
  onDeleteLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string) => void;
  onSelectLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  activeLayerId: string | null;
  onUpdateAccessory: (accessoryId: string, quantity: number) => void;
  onImageLayerNeedsScale: () => void;
}

const CATALOG_TABS: { id: CatalogSection; label: string; icon: typeof ShieldAlert }[] = [
  { id: 'detectors', label: 'Det', icon: ShieldAlert },
  { id: 'motion', label: 'PIR', icon: Move },
  { id: 'panels', label: 'CPU', icon: Cpu },
  { id: 'keypads', label: 'Kláv', icon: Keyboard },
  { id: 'sirens', label: 'Sir', icon: Volume2 },
  { id: 'cables', label: 'Kab', icon: Cable },
  { id: 'control', label: 'Ovl', icon: Radio },
  { id: 'accessories', label: 'Pris', icon: Package },
];

export default function EpsSidebar({
  catalog, designData, selectedDetectorModelId, canvasMode,
  onSelectDetectorModel, onSelectMotionSensor, onSelectPanel, onSelectKeypad, onSelectSiren, onSelectControlDevice,
  onDeletePlacedDetector, onDeleteMotionSensor, onDeleteRoute, onDeletePanel, onDeleteKeypad, onDeleteSiren, onDeleteControlDevice,
  onAddLayer, onDeleteLayer, onToggleLayerVisibility, onSelectLayer, onRenameLayer,
  activeLayerId, onUpdateAccessory, onImageLayerNeedsScale,
}: Props) {
  const [tab, setTab] = useState<SidebarTab>('catalog');
  const [search, setSearch] = useState('');
  const [catalogSection, setCatalogSection] = useState<CatalogSection>('detectors');
  const [expandedPanels, setExpandedPanels] = useState(true);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingLayerId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingLayerId]);

  const startRename = (layer: EpsDesignLayer, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingLayerId(layer.id);
    setRenameValue(layer.name);
  };

  const confirmRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameLayer(id, trimmed);
    setRenamingLayerId(null);
  };

  const cancelRename = () => {
    setRenamingLayerId(null);
    setRenameValue('');
  };

  useEffect(() => {
    if (!canvasMode) return;
    const mapped = MODE_TO_CATALOG[canvasMode];
    if (mapped) {
      setCatalogSection(mapped);
      setTab('catalog');
    }
  }, [canvasMode]);

  const toggleExpanded = () => setExpandedPanels(p => !p);

  const filteredDetectors = catalog.detectors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.model_number.toLowerCase().includes(search.toLowerCase())
  );
  const filteredMotion = catalog.motionSensors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.model_number.toLowerCase().includes(search.toLowerCase())
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = crypto.randomUUID();
      onAddLayer({
        id,
        name: file.name.replace(/\.[^.]+$/, ''),
        type: 'image',
        imageData: reader.result as string,
        visible: true,
      });
      onSelectLayer(id);
      setTimeout(() => onImageLayerNeedsScale(), 200);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const prices = calcTotalPrice(designData, catalog.detectors, catalog.panels, catalog.sirens, catalog.cables, catalog.accessories, catalog.motionSensors, catalog.keypads, catalog.controlDevices);
  const cableLen = calcCableLengthM(designData);
  const zoneUtil = calcZoneUtilization(designData, catalog.panels);
  const warnings = validateDesign(designData, catalog.detectors, catalog.panels);

  const placedTotal = designData.detectors.length + (designData.motionSensors ?? []).length + designData.panels.length +
    (designData.keypads ?? []).length + designData.sirens.length + (designData.controlDevices ?? []).length;

  const tabBtnClass = (t: SidebarTab) =>
    `flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-extrabold transition rounded-lg ${
      tab === t ? 'bg-white/[0.08] text-red-400' : 'text-slate-500 hover:text-slate-300'
    }`;

  return (
    <div className="w-80 h-full flex flex-col bg-slate-900/95 border-l border-slate-700/50">
      <div className="flex gap-0.5 p-1.5 bg-slate-900/50 border-b border-slate-700/50">
        <button onClick={() => setTab('layers')} className={tabBtnClass('layers')}>
          <Layers className="w-3.5 h-3.5" /> Půdorysy
        </button>
        <button onClick={() => setTab('catalog')} className={tabBtnClass('catalog')}>
          <ShieldAlert className="w-3.5 h-3.5" /> Katalog
        </button>
        <button onClick={() => setTab('calc')} className={tabBtnClass('calc')}>
          <BarChart3 className="w-3.5 h-3.5" /> Kalkulace
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'layers' && (
          <div className="p-3 space-y-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/15 transition"
            >
              <Upload className="w-4 h-4" /> Nahrát půdorys
            </button>

            <div className="space-y-1">
              {designData.layers.map((l, i) => (
                <div
                  key={l.id}
                  onClick={() => onSelectLayer(l.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-xs font-bold ${
                    activeLayerId === l.id ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="text-[10px] font-extrabold text-slate-500 w-4 shrink-0">{i + 1}</span>
                  {renamingLayerId === l.id ? (
                    <div className="flex flex-1 items-center gap-1 min-w-0" onClick={e => e.stopPropagation()}>
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') confirmRename(l.id); if (e.key === 'Escape') cancelRename(); }}
                        className="flex-1 min-w-0 bg-white/[0.08] border border-white/[0.15] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-red-500/50"
                      />
                      <button onClick={() => confirmRename(l.id)} className="p-0.5 rounded text-emerald-400 hover:bg-emerald-500/10">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={cancelRename} className="p-0.5 rounded text-slate-500 hover:text-slate-300">
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{l.name}</span>
                      <button onClick={(e) => startRename(l, e)} className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-white/[0.06]">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {renamingLayerId !== l.id && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); onToggleLayerVisibility(l.id); }}
                        className="p-1 rounded hover:bg-white/[0.06]">
                        {l.visible ? <Eye className="w-3 h-3 text-slate-400" /> : <EyeOff className="w-3 h-3 text-slate-600" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteLayer(l.id); }}
                        className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {designData.layers.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nahrajte půdorys pro začátek
                </div>
              )}
            </div>

            {designData.layers.some(l => l.scale) && (
              <div className="space-y-1">
                {designData.layers.filter(l => l.scale).map((l, _i) => (
                  <div key={l.id} className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-extrabold text-cyan-400 uppercase">Měřítko — {l.name}</div>
                      <div className="text-xs font-bold text-white">{l.scale!.realDistanceM} m</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'catalog' && (
          <div className="p-3 space-y-3">
            <div className="flex flex-wrap gap-1 bg-white/[0.04] rounded-lg p-0.5">
              {CATALOG_TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setCatalogSection(id)}
                  className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[9px] font-extrabold transition ${
                    catalogSection === id ? 'bg-white/[0.08] text-red-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>

            {(catalogSection === 'detectors' || catalogSection === 'motion') && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={catalogSection === 'detectors' ? 'Hledat detektor...' : 'Hledat cidlo...'}
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-white/[0.06] border border-white/[0.08] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
                />
              </div>
            )}

            {catalogSection === 'detectors' && (
              <div className="space-y-1">
                {filteredDetectors.map(d => {
                  const selected = selectedDetectorModelId === d.id;
                  const color = DETECTOR_TYPE_COLORS[d.detector_type] ?? 'bg-blue-500';
                  return (
                    <button
                      key={d.id}
                      onClick={() => onSelectDetectorModel(selected ? null : d.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition ${
                        selected ? 'bg-red-500/15 border border-red-500/30' : 'hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md ${color} flex items-center justify-center shrink-0`}>
                        <ShieldAlert className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-white truncate">{d.model_number}</div>
                        <div className="text-[9px] text-slate-500 truncate">{DETECTOR_TYPE_LABELS[d.detector_type]} · {d.connection_type === 'wireless' ? 'Bezdr.' : 'Bus'} · {d.detection_range_m}m</div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{d.price.toLocaleString('cs-CZ')} Kc</span>
                    </button>
                  );
                })}
              </div>
            )}

            {catalogSection === 'motion' && (
              <div className="space-y-1">
                {filteredMotion.map(ms => (
                  <button
                    key={ms.id}
                    onClick={() => onSelectMotionSensor(ms.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-white/[0.04] transition"
                  >
                    <div className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center shrink-0">
                      <Move className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{ms.model_number}</div>
                      <div className="text-[9px] text-slate-500 truncate">{MOTION_TYPE_LABELS[ms.sensor_type]} · {ms.connection_type === 'wireless' ? 'Bezdr.' : 'Bus'} · {ms.detection_range_m}m</div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{ms.price.toLocaleString('cs-CZ')} Kc</span>
                  </button>
                ))}
              </div>
            )}

            {catalogSection === 'panels' && (
              <div className="space-y-1">
                {catalog.panels.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPanel(p.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-white/[0.04] transition"
                  >
                    <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center shrink-0">
                      <Cpu className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{p.model_number}</div>
                      <div className="text-[9px] text-slate-500">{p.max_zones} zón · {p.communicator_type}</div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{p.price.toLocaleString('cs-CZ')} Kc</span>
                  </button>
                ))}
              </div>
            )}

            {catalogSection === 'keypads' && (
              <div className="space-y-1">
                {catalog.keypads.map(kp => (
                  <button
                    key={kp.id}
                    onClick={() => onSelectKeypad(kp.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-white/[0.04] transition"
                  >
                    <div className="w-6 h-6 rounded-md bg-teal-500 flex items-center justify-center shrink-0">
                      <Keyboard className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{kp.model_number}</div>
                      <div className="text-[9px] text-slate-500">{KEYPAD_TYPE_LABELS[kp.keypad_type]} · {kp.has_rfid ? 'RFID' : ''} · {kp.sections_control} sekci</div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{kp.price.toLocaleString('cs-CZ')} Kc</span>
                  </button>
                ))}
              </div>
            )}

            {catalogSection === 'sirens' && (
              <div className="space-y-1">
                {catalog.sirens.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onSelectSiren(s.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-white/[0.04] transition"
                  >
                    <div className="w-6 h-6 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
                      <Volume2 className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{s.model_number}</div>
                      <div className="text-[9px] text-slate-500">{s.siren_type === 'indoor' ? 'Vnitrni' : s.siren_type === 'outdoor' ? 'Venkovni' : 'Kombinovana'} · {s.sound_level_db} dB</div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{s.price.toLocaleString('cs-CZ')} Kc</span>
                  </button>
                ))}
              </div>
            )}

            {catalogSection === 'cables' && (
              <div className="space-y-1">
                {catalog.cables.map(c => (
                  <div key={c.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition">
                    <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center shrink-0">
                      <Cable className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{c.name}</div>
                      <div className="text-[9px] text-slate-500">
                        {c.fire_resistance_minutes > 0 ? `${c.fire_resistance_minutes} min` : 'Standard'} · {c.price_per_m} Kc/m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {catalogSection === 'control' && (
              <div className="space-y-1">
                {catalog.controlDevices.map(cd => (
                  <button
                    key={cd.id}
                    onClick={() => onSelectControlDevice(cd.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-white/[0.04] transition"
                  >
                    <div className="w-6 h-6 rounded-md bg-rose-500 flex items-center justify-center shrink-0">
                      <Radio className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{cd.model_number}</div>
                      <div className="text-[9px] text-slate-500">{DEVICE_TYPE_LABELS[cd.device_type]} · {cd.connection_type === 'wireless' ? 'Bezdr.' : cd.connection_type === 'bus' ? 'Bus' : 'Sam.'}</div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{cd.price.toLocaleString('cs-CZ')} Kc</span>
                  </button>
                ))}
              </div>
            )}

            {catalogSection === 'accessories' && (
              <div className="space-y-1">
                {catalog.accessories.map(a => {
                  const current = designData.accessoryItems.find(i => i.accessoryId === a.id)?.quantity ?? 0;
                  return (
                    <div key={a.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition">
                      <div className="w-6 h-6 rounded-md bg-slate-600 flex items-center justify-center shrink-0">
                        <Package className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-white truncate">{a.name}</div>
                        <div className="text-[9px] text-slate-500">{a.price.toLocaleString('cs-CZ')} Kc</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onUpdateAccessory(a.id, Math.max(0, current - 1))}
                          className="w-6 h-6 rounded bg-white/[0.06] text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center"
                        >-</button>
                        <span className="text-[11px] font-extrabold text-white w-6 text-center">{current}</span>
                        <button
                          onClick={() => onUpdateAccessory(a.id, current + 1)}
                          className="w-6 h-6 rounded bg-white/[0.06] text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={toggleExpanded} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-extrabold text-slate-400 hover:text-slate-300 transition">
              {expandedPanels ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Umístěné prvky ({placedTotal})
            </button>
            {expandedPanels && (
              <div className="space-y-0.5">
                {(() => {
                  let idx = 0;
                  const rows: React.ReactNode[] = [];

                  designData.detectors.forEach(d => {
                    idx++;
                    const n = idx;
                    const model = catalog.detectors.find(m => m.id === d.modelId);
                    const typeLabel = DETECTOR_TYPE_LABELS[model?.detector_type ?? ''] ?? 'Detektor';
                    rows.push(
                      <PlacedRow key={d.id} num={n} icon={<ShieldAlert className="w-3 h-3" />} iconColor="text-blue-400"
                        title={model?.model_number ?? 'Detektor'} subtitle={typeLabel} onDelete={() => onDeletePlacedDetector(d.id)} />
                    );
                  });

                  (designData.motionSensors ?? []).forEach(ms => {
                    idx++;
                    const n = idx;
                    const model = catalog.motionSensors.find(m => m.id === ms.sensorId);
                    const typeLabel = MOTION_TYPE_LABELS[model?.sensor_type ?? ''] ?? 'PIR cidlo';
                    rows.push(
                      <PlacedRow key={ms.id} num={n} icon={<Move className="w-3 h-3" />} iconColor="text-green-400"
                        title={model?.model_number ?? 'PIR cidlo'} subtitle={typeLabel} onDelete={() => onDeleteMotionSensor(ms.id)} />
                    );
                  });

                  designData.panels.forEach(p => {
                    idx++;
                    const n = idx;
                    const model = catalog.panels.find(m => m.id === p.panelId);
                    rows.push(
                      <PlacedRow key={p.id} num={n} icon={<Cpu className="w-3 h-3" />} iconColor="text-sky-400"
                        title={model?.model_number ?? 'Ustredna'} subtitle={`Ústředna · ${model?.max_zones ?? '?'} zón`} onDelete={() => onDeletePanel(p.id)} />
                    );
                  });

                  (designData.keypads ?? []).forEach(kp => {
                    idx++;
                    const n = idx;
                    const model = catalog.keypads.find(m => m.id === kp.keypadId);
                    const typeLabel = KEYPAD_TYPE_LABELS[model?.keypad_type ?? ''] ?? 'Klavesnice';
                    rows.push(
                      <PlacedRow key={kp.id} num={n} icon={<Keyboard className="w-3 h-3" />} iconColor="text-teal-400"
                        title={model?.model_number ?? 'Klavesnice'} subtitle={typeLabel} onDelete={() => onDeleteKeypad(kp.id)} />
                    );
                  });

                  designData.sirens.forEach(s => {
                    idx++;
                    const n = idx;
                    const model = catalog.sirens.find(m => m.id === s.sirenId);
                    const typeLabel = model?.siren_type === 'indoor' ? 'Vnitrni sirena' : model?.siren_type === 'outdoor' ? 'Venkovni sirena' : 'Kombinovana sirena';
                    rows.push(
                      <PlacedRow key={s.id} num={n} icon={<Volume2 className="w-3 h-3" />} iconColor="text-orange-400"
                        title={model?.model_number ?? 'Sirena'} subtitle={`${typeLabel} · ${model?.sound_level_db ?? '?'} dB`} onDelete={() => onDeleteSiren(s.id)} />
                    );
                  });

                  (designData.controlDevices ?? []).forEach(cd => {
                    idx++;
                    const n = idx;
                    const model = catalog.controlDevices.find(m => m.id === cd.deviceId);
                    const typeLabel = DEVICE_TYPE_LABELS[model?.device_type ?? ''] ?? 'Ovladac';
                    rows.push(
                      <PlacedRow key={cd.id} num={n} icon={<Radio className="w-3 h-3" />} iconColor="text-rose-400"
                        title={model?.model_number ?? 'Ovladac'} subtitle={typeLabel} onDelete={() => onDeleteControlDevice(cd.id)} />
                    );
                  });

                  designData.routes.forEach(r => {
                    idx++;
                    const n = idx;
                    const cable = catalog.cables.find(c => c.id === r.cableTypeId);
                    rows.push(
                      <PlacedRow key={r.id} num={n} icon={<Cable className="w-3 h-3" />} iconColor="text-amber-400"
                        title={cable?.name ?? 'Kabel'} subtitle={`Trasa ${r.label || ''} · ${r.points.length} bodu`} onDelete={() => onDeleteRoute(r.id)} />
                    );
                  });

                  return rows;
                })()}
              </div>
            )}
          </div>
        )}

        {tab === 'calc' && (
          <div className="p-3 space-y-3">
            <div className="bg-white/[0.04] rounded-xl p-3 space-y-2">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Souhrn návrhu</div>
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Detektory" value={String(designData.detectors.length)} color="text-blue-400" />
                <StatBox label="PIR čidla" value={String((designData.motionSensors ?? []).length)} color="text-green-400" />
                <StatBox label="Ústředny" value={String(designData.panels.length)} color="text-indigo-400" />
                <StatBox label="Klávesnice" value={String((designData.keypads ?? []).length)} color="text-teal-400" />
                <StatBox label="Sirény" value={String(designData.sirens.length)} color="text-orange-400" />
                <StatBox label="Ovládání" value={String((designData.controlDevices ?? []).length)} color="text-rose-400" />
                <StatBox label="Kabeláž" value={`${cableLen} m`} color="text-amber-400" />
                <StatBox label="Prislusen." value={String(designData.accessoryItems.reduce((s, i) => s + i.quantity, 0))} color="text-slate-400" />
              </div>
            </div>

            <div className="bg-white/[0.04] rounded-xl p-3 space-y-2">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Kapacita ústředny</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${zoneUtil.utilization > 90 ? 'bg-red-500' : zoneUtil.utilization > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, zoneUtil.utilization)}%` }}
                  />
                </div>
                <span className="text-xs font-extrabold text-white">{zoneUtil.totalDetectors}/{zoneUtil.maxZones}</span>
              </div>
            </div>

            <div className="bg-white/[0.04] rounded-xl p-3 space-y-1.5">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Cenový rozpis</div>
              <PriceLine label="Detektory" value={prices.detectorsCost} />
              <PriceLine label="PIR čidla" value={prices.motionSensorsCost} />
              <PriceLine label="Ústředny" value={prices.panelsCost} />
              <PriceLine label="Klávesnice" value={prices.keypadsCost} />
              <PriceLine label="Sirény" value={prices.sirensCost} />
              <PriceLine label="Ovládací prvky" value={prices.controlDevicesCost} />
              <PriceLine label="Kabeláž" value={prices.cablesCost} />
              <PriceLine label="Příslušenství" value={prices.accessoriesCost} />
              <div className="border-t border-white/[0.08] pt-1.5 mt-1.5">
                <div className="flex justify-between">
                  <span className="text-xs font-extrabold text-white">Celkem</span>
                  <span className="text-xs font-extrabold text-red-400">{prices.totalCost.toLocaleString('cs-CZ')} Kc</span>
                </div>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase">Kontrola návrhu</div>
                {warnings.map((w, i) => (
                  <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] font-bold ${
                    w.type === 'error' ? 'bg-red-500/10 text-red-400' :
                    w.type === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {w.type === 'error' ? <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> :
                     w.type === 'warning' ? <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> :
                     <Info className="w-3 h-3 mt-0.5 shrink-0" />}
                    {w.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
      <div className={`text-lg font-extrabold ${color}`}>{value}</div>
      <div className="text-[9px] font-bold text-slate-500 uppercase">{label}</div>
    </div>
  );
}

function PriceLine({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="text-white font-bold">{value.toLocaleString('cs-CZ')} Kc</span>
    </div>
  );
}

function PlacedRow({ num, icon, iconColor, title, subtitle, onDelete }: {
  num: number; icon: React.ReactNode; iconColor: string; title: string; subtitle: string; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] group">
      <span className="w-4 text-[9px] font-extrabold text-slate-600 text-right shrink-0">{num}</span>
      <span className={`${iconColor} shrink-0`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-white font-extrabold truncate">{title}</div>
        <div className="text-[9px] text-slate-500 truncate">{subtitle}</div>
      </div>
      <button onClick={onDelete} className="p-0.5 rounded text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
