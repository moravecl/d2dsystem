import { useState, useEffect, useRef } from 'react';
import {
  Camera, Monitor, Cable, Network, Package, HardDrive, Trash2,
  ChevronDown, ChevronRight, Layers, Upload,
  Map, Image as ImageIcon, Eye, EyeOff, Search, Loader2, Lock, Pencil, Check, X,
} from 'lucide-react';
import type { CameraCatalogData } from '../../hooks/useCameraCatalog';
import type { CameraDesignData, DesignLayer, StorageConfig } from '../../hooks/useCameraDesign';
import { calculateStorage, calcTotalPoePowerW } from '../../lib/cameraCalculations';
import { polylineLength, normalizedToMeters } from '../catalog/floorplan/geometry';
import MapSetupModal from './MapSetupModal';

type SidebarTab = 'catalog' | 'layers' | 'calc';

export type CatalogFilter = 'cameras' | 'nvrs' | 'switches' | null;

interface Props {
  catalog: CameraCatalogData;
  designData: CameraDesignData;
  selectedCameraModelId: string | null;
  selectedPlacedCameraId: string | null;
  onSelectCameraModel: (id: string | null) => void;
  onSelectNvr: (id: string | null) => void;
  onSelectSwitch: (id: string | null) => void;
  onDeletePlacedCamera: (id: string) => void;
  onDeleteRoute: (id: string) => void;
  onDeleteNvr: (id: string) => void;
  onDeleteSwitch: (id: string) => void;
  onUpdateStorageConfig: (config: StorageConfig) => void;
  onAddLayer: (layer: DesignLayer) => void;
  onDeleteLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string) => void;
  onSelectLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  activeLayerId: string | null;
  onUpdateAccessory: (accessoryId: string, quantity: number) => void;
  onImageLayerNeedsScale: () => void;
  mapScale?: { metersPerPixel: number };
  catalogFilter?: CatalogFilter;
  projectAddress?: string | null;
  projectLat?: number | null;
  projectLon?: number | null;
}

const CAMERA_TYPE_COLORS: Record<string, string> = {
  dome: 'bg-blue-500', bullet: 'bg-emerald-500', ptz: 'bg-amber-500', fisheye: 'bg-pink-500', box: 'bg-violet-500',
};

export default function CameraSidebar({
  catalog, designData, selectedCameraModelId,
  selectedPlacedCameraId,
  onSelectCameraModel, onSelectNvr, onSelectSwitch,
  onDeletePlacedCamera, onDeleteRoute,
  onUpdateStorageConfig, onAddLayer, onDeleteLayer, onToggleLayerVisibility, onSelectLayer, onRenameLayer, activeLayerId,
  onUpdateAccessory, onImageLayerNeedsScale, mapScale, catalogFilter,
  projectAddress, projectLat, projectLon,
}: Props) {
  const [tab, setTab] = useState<SidebarTab>('layers');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['cameras', 'layers']));

  useEffect(() => {
    if (catalogFilter) {
      setTab('catalog');
      setExpandedSections(prev => {
        const next = new Set(prev);
        next.add(catalogFilter);
        return next;
      });
    }
  }, [catalogFilter]);

  const [addressQuery, setAddressQuery] = useState('');
  const [addressSearching, setAddressSearching] = useState(false);
  const [mapSetup, setMapSetup] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const addressPrefilledRef = useRef(false);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addressPrefilledRef.current || designData.layers.length > 0) return;
    if (projectAddress) {
      addressPrefilledRef.current = true;
      setAddressQuery(projectAddress.split(',')[0] || projectAddress);
    }
  }, [designData.layers.length, projectAddress]);

  const toggleSection = (s: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const storage = calculateStorage(designData.cameras, catalog.cameras, designData.storageConfig);
  const totalPoe = calcTotalPoePowerW(designData.cameras, catalog.cameras);

  const getRouteLengthM = (route: { points: { x: number; y: number }[]; layerIndex: number }): number => {
    if (route.points.length < 2) return 0;
    const normLen = polylineLength(route.points);
    const layer = designData.layers[route.layerIndex];
    const layerScale = layer?.scale ?? designData.scale;
    if (layerScale) {
      return normalizedToMeters(normLen, layerScale);
    }
    if (mapScale) {
      return normLen * 1000 * mapScale.metersPerPixel;
    }
    return 0;
  };

  const totalCableLengthM = designData.routes.reduce((sum, route) => {
    return sum + getRouteLengthM(route);
  }, 0);

  const totalPrice = (() => {
    let p = 0;
    designData.cameras.forEach(cam => {
      const model = catalog.cameras.find(m => m.id === cam.modelId);
      if (model) p += model.price;
    });
    designData.nvrs.forEach(nvr => {
      const nvrModel = catalog.nvrs.find(n => n.id === nvr.nvrId);
      if (nvrModel) p += nvrModel.price;
    });
    designData.switches.forEach(sw => {
      const swModel = catalog.poeSwitches.find(s => s.id === sw.switchId);
      if (swModel) p += swModel.price;
    });
    designData.routes.forEach(route => {
      if (route.points.length < 2) return;
      const cable = catalog.cables.find(c => c.id === route.cableTypeId);
      if (cable) {
        const len = getRouteLengthM(route);
        p += len * cable.price_per_m;
      }
    });
    designData.accessoryItems.forEach(ai => {
      const acc = catalog.accessories.find(a => a.id === ai.accessoryId);
      if (acc) p += acc.price * ai.quantity;
    });
    return p;
  })();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onAddLayer({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        type: 'image',
        imageData: reader.result as string,
        visible: true,
      });
      onImageLayerNeedsScale();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddressSearch = async () => {
    const q = addressQuery.trim();
    if (!q) return;
    setAddressSearching(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'cs' } }
      );
      const results = await resp.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        setMapSetup({
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          name: display_name.split(',')[0] || 'Satelitni mapa',
        });
      }
    } catch {
    } finally {
      setAddressSearching(false);
    }
  };

  const handleAddMapLayer = () => {
    if (projectLat && projectLon) {
      setMapSetup({
        lat: projectLat,
        lon: projectLon,
        name: projectAddress?.split(',')[0] || 'Satelitni mapa',
      });
    } else {
      setMapSetup({ lat: 50.0755, lon: 14.4378, name: 'Satelitni mapa' });
    }
  };

  const handleConfirmMap = (zoom: number, finalLat: number, finalLon: number) => {
    if (!mapSetup) return;
    onAddLayer({
      id: crypto.randomUUID(),
      name: mapSetup.name,
      type: 'map',
      mapCenter: { lat: finalLat, lon: finalLon },
      mapZoom: zoom,
      visible: true,
      locked: true,
    });
    setMapSetup(null);
  };

  const startRename = (layer: DesignLayer) => {
    setRenamingLayerId(layer.id);
    setRenameValue(layer.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const confirmRename = () => {
    if (renamingLayerId && renameValue.trim()) {
      onRenameLayer(renamingLayerId, renameValue.trim());
    }
    setRenamingLayerId(null);
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenamingLayerId(null);
    setRenameValue('');
  };

  const activeLayerIndex = designData.layers.findIndex(l => l.id === activeLayerId);
  const camerasOnActiveLayer = designData.cameras.filter(c => c.layerIndex === activeLayerIndex);
  const routesOnActiveLayer = designData.routes.filter(r => r.layerIndex === activeLayerIndex);

  const SectionHeader = ({ id, label, icon: Icon, count }: { id: string; label: string; icon: typeof Camera; count?: number }) => (
    <button onClick={() => toggleSection(id)} className="flex items-center gap-2 w-full py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition">
      {expandedSections.has(id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      <Icon className="w-3.5 h-3.5" />
      {label}
      {count !== undefined && count > 0 && <span className="text-[10px] bg-white/[0.08] text-slate-400 px-1.5 py-0.5 rounded-full font-bold">{count}</span>}
    </button>
  );

  return (
    <div className="w-80 bg-navy-800/60 border-l border-white/[0.08] flex flex-col h-full overflow-hidden">
      <div className="flex gap-0.5 p-2 bg-white/[0.04] border-b border-white/10">
        {[
          { id: 'layers' as SidebarTab, label: 'Vrstvy', icon: Layers },
          { id: 'catalog' as SidebarTab, label: 'Katalog', icon: Camera },
          { id: 'calc' as SidebarTab, label: 'Kalkulace', icon: HardDrive },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-bold transition ${
              tab === t.id ? 'bg-white/[0.06] text-blue-400 ' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {tab === 'layers' && (
          <>
            <div className="mb-3 space-y-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={addressQuery}
                  onChange={e => setAddressQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddressSearch(); }}
                  placeholder="Zadat adresu..."
                  className="flex-1 border border-white/10 rounded-lg px-2.5 py-2 text-xs bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                />
                <button
                  onClick={handleAddressSearch}
                  disabled={addressSearching || !addressQuery.trim()}
                  className="flex items-center justify-center w-9 h-9 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition shrink-0"
                >
                  {addressSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddMapLayer} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[11px] font-bold hover:bg-blue-500/20 transition border border-blue-200">
                  <Map className="w-3.5 h-3.5" /> Satelitni mapa
                </button>
                <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-[11px] font-bold hover:bg-emerald-500/20 transition border border-emerald-200 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Nahrat foto
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            </div>

            {designData.layers.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">Pridejte vrstvu</p>
                <p className="text-[10px] mt-1">Zadejte adresu nebo nahrajte fotku z dronu</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {designData.layers.map(layer => (
                  <div
                    key={layer.id}
                    onClick={() => onSelectLayer(layer.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                      activeLayerId === layer.id ? 'border-blue-300 bg-blue-500/10' : 'border-white/10 hover:border-white/[0.12] bg-white/[0.06]'
                    }`}
                  >
                    {layer.type === 'map' ? <Map className="w-4 h-4 text-blue-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />}

                    {renamingLayerId === layer.id ? (
                      <div className="flex-1 flex items-center gap-1 min-w-0" onClick={e => e.stopPropagation()}>
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmRename();
                            if (e.key === 'Escape') cancelRename();
                          }}
                          className="flex-1 text-xs font-semibold text-slate-300 border border-blue-300 rounded px-1.5 py-0.5 bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0"
                        />
                        <button onClick={confirmRename} className="p-0.5 rounded text-emerald-500 hover:bg-emerald-500/10 transition">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={cancelRename} className="p-0.5 rounded text-slate-400 hover:bg-white/[0.06] transition">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex-1 text-xs font-semibold text-slate-300 truncate">{layer.name}</span>
                    )}

                    {renamingLayerId !== layer.id && (
                      <>
                        {layer.locked && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename(layer); }}
                          className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-blue-500 transition"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleLayerVisibility(layer.id); }}
                          className="p-1 rounded hover:bg-white/[0.06] transition"
                        >
                          {layer.visible ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                          className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-white/[0.06] mt-4 pt-3">
              <SectionHeader id="placed-cameras" label="Kamery na vrstve" icon={Camera} count={camerasOnActiveLayer.length} />
              {expandedSections.has('placed-cameras') && (
                <div className="space-y-1 mt-1">
                  {camerasOnActiveLayer.map(cam => {
                    const model = catalog.cameras.find(m => m.id === cam.modelId);
                    return (
                      <div key={cam.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${cam.id === selectedPlacedCameraId ? 'bg-blue-500/10 border border-blue-200' : 'bg-white/[0.04]'}`}>
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${CAMERA_TYPE_COLORS[model?.camera_type ?? 'bullet']}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-300 truncate">{cam.label || model?.name || 'Kamera'}</div>
                          {model && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{model.resolution_label}</span>
                              <span className="text-slate-300">·</span>
                              <span>FOV {model.h_fov_deg}°</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-red-500 font-bold">IR {model.ir_range_m}m</span>
                            </div>
                          )}
                        </div>
                        <button onClick={() => onDeletePlacedCamera(cam.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  {camerasOnActiveLayer.length === 0 && <p className="text-[10px] text-slate-400 py-1 pl-5">Zadne kamery na teto vrstve</p>}
                </div>
              )}

              <SectionHeader id="placed-routes" label="Trasy na vrstve" icon={Cable} count={routesOnActiveLayer.length} />
              {expandedSections.has('placed-routes') && (
                <div className="space-y-1 mt-1">
                  {routesOnActiveLayer.map(route => {
                    const cable = catalog.cables.find(c => c.id === route.cableTypeId);
                    const len = route.points.length >= 2
                      ? getRouteLengthM(route).toFixed(1)
                      : '?';
                    return (
                      <div key={route.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] text-xs">
                        <Cable className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-300 truncate">
                            {route.label || cable?.name || 'Kabel'} ({len} m)
                          </div>
                          {route.label && cable && (
                            <div className="text-[10px] text-slate-400 truncate">{cable.name}</div>
                          )}
                        </div>
                        <button onClick={() => onDeleteRoute(route.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  {routesOnActiveLayer.length === 0 && <p className="text-[10px] text-slate-400 py-1 pl-5">Zadne trasy na teto vrstve</p>}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'catalog' && (
          <>
            <SectionHeader id="cameras" label="Kamery" icon={Camera} count={catalog.cameras.length} />
            {expandedSections.has('cameras') && (
              <div className="space-y-1 mt-1">
                {catalog.cameras.map(cam => (
                  <button
                    key={cam.id}
                    onClick={() => onSelectCameraModel(selectedCameraModelId === cam.id ? null : cam.id)}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition ${
                      selectedCameraModelId === cam.id ? 'border-blue-400 bg-blue-500/10' : 'border-white/10 hover:border-white/[0.12] bg-white/[0.06]'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${CAMERA_TYPE_COLORS[cam.camera_type]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{cam.name}</div>
                      <div className="text-[10px] text-slate-400">{cam.resolution_label} · FOV {cam.h_fov_deg}° · <span className="text-red-500 font-bold">IR {cam.ir_range_m}m</span> · {cam.price.toLocaleString('cs-CZ')} Kc</div>
                    </div>
                  </button>
                ))}
                {catalog.cameras.length === 0 && <p className="text-[10px] text-slate-400 py-2 text-center">Pridejte kamery v Admin / Kamerovy katalog</p>}
              </div>
            )}

            <SectionHeader id="nvrs" label="NVR" icon={Monitor} count={catalog.nvrs.length} />
            {expandedSections.has('nvrs') && (
              <div className="space-y-1 mt-1">
                {catalog.nvrs.map(nvr => (
                  <button
                    key={nvr.id}
                    onClick={() => onSelectNvr(nvr.id)}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition border-white/10 hover:border-white/[0.12] bg-white/[0.06]"
                  >
                    <Monitor className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{nvr.name}</div>
                      <div className="text-[10px] text-slate-400">{nvr.channels}ch · {nvr.poe_ports} PoE · {nvr.hdd_bays} HDD · {nvr.price.toLocaleString('cs-CZ')} Kc</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <SectionHeader id="switches" label="PoE Switche" icon={Network} count={catalog.poeSwitches.length} />
            {expandedSections.has('switches') && (
              <div className="space-y-1 mt-1">
                {catalog.poeSwitches.map(sw => (
                  <button
                    key={sw.id}
                    onClick={() => onSelectSwitch(sw.id)}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition border-white/10 hover:border-white/[0.12] bg-white/[0.06]"
                  >
                    <Network className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{sw.name}</div>
                      <div className="text-[10px] text-slate-400">{sw.poe_ports} PoE · {sw.poe_budget_w}W · {sw.price.toLocaleString('cs-CZ')} Kc</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'calc' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                <div className="text-lg font-extrabold text-blue-400">{designData.cameras.length}</div>
                <div className="text-[10px] font-bold text-blue-500 uppercase">Kamer</div>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                <div className="text-lg font-extrabold text-emerald-400">{totalCableLengthM.toFixed(0)} m</div>
                <div className="text-[10px] font-bold text-emerald-500 uppercase">Kabelaz</div>
              </div>
              <div className="bg-amber-500/10 rounded-xl p-3 text-center">
                <div className="text-lg font-extrabold text-amber-400">{totalPoe.toFixed(0)} W</div>
                <div className="text-[10px] font-bold text-amber-500 uppercase">PoE prikon</div>
              </div>
              <div className="bg-white/[0.06] rounded-xl p-3 text-center">
                <div className="text-lg font-extrabold text-slate-300">{totalPrice.toLocaleString('cs-CZ')}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">Cena (Kc)</div>
              </div>
            </div>

            <div className="bg-white/[0.04] rounded-xl p-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" /> Vypocet uloziste
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Kodek</label>
                  <select
                    value={designData.storageConfig.codec}
                    onChange={e => onUpdateStorageConfig({ ...designData.storageConfig, codec: e.target.value as StorageConfig['codec'] })}
                    className="w-full border border-white/10 rounded-lg px-2.5 py-1.5 text-xs bg-white/[0.06]"
                  >
                    <option value="h264">H.264</option>
                    <option value="h265">H.265</option>
                    <option value="h265+">H.265+</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Hodin/den</label>
                    <input
                      type="number" min={1} max={24}
                      value={designData.storageConfig.recordingHoursPerDay}
                      onChange={e => onUpdateStorageConfig({ ...designData.storageConfig, recordingHoursPerDay: parseInt(e.target.value) || 24 })}
                      className="w-full border border-white/10 rounded-lg px-2.5 py-1.5 text-xs bg-white/[0.06]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Dnu retence</label>
                    <input
                      type="number" min={1} max={365}
                      value={designData.storageConfig.retentionDays}
                      onChange={e => onUpdateStorageConfig({ ...designData.storageConfig, retentionDays: parseInt(e.target.value) || 14 })}
                      className="w-full border border-white/10 rounded-lg px-2.5 py-1.5 text-xs bg-white/[0.06]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Detekce pohybu (%)</label>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={designData.storageConfig.motionOnlyPct}
                    onChange={e => onUpdateStorageConfig({ ...designData.storageConfig, motionOnlyPct: parseInt(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Non-stop</span>
                    <span className="font-bold text-slate-400">{designData.storageConfig.motionOnlyPct}%</span>
                    <span>Jen pohyb</span>
                  </div>
                </div>
              </div>

              <div className="bg-navy-800/60 rounded-xl p-3 border border-white/10 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Denni objem</span>
                  <span className="font-bold text-slate-300">{storage.dailyStorageGb.toFixed(1)} GB</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Celkovy objem ({designData.storageConfig.retentionDays}d)</span>
                  <span className="font-bold text-slate-300">{storage.totalStorageTb.toFixed(2)} TB</span>
                </div>
                <div className="border-t border-white/[0.06] pt-1.5 flex justify-between text-xs">
                  <span className="text-slate-400 font-bold">Navrzeny HDD</span>
                  <span className="font-extrabold text-blue-400">{storage.recommendedHddCount}x {storage.recommendedHddSizeTb} TB</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Kapacita HDD celkem</span>
                  <span className="font-bold text-slate-300">{storage.recommendedHddCount * storage.recommendedHddSizeTb} TB</span>
                </div>
                <div className="border-t border-white/[0.06] pt-1.5 flex justify-between text-xs">
                  <span className="text-green-400 font-bold">Vydrz zaznamu</span>
                  <span className="font-extrabold text-green-400">
                    {storage.dailyStorageGb > 0
                      ? Math.floor(storage.recommendedHddCount * storage.recommendedHddSizeTb * 1024 / storage.dailyStorageGb)
                      : 0} dni
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.04] rounded-xl p-3 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Prislusenstvi
              </h4>
              {catalog.accessories.map(acc => {
                const existing = designData.accessoryItems.find(a => a.accessoryId === acc.id);
                return (
                  <div key={acc.id} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 text-slate-400 truncate">{acc.name}</span>
                    <input
                      type="number" min={0} max={99}
                      value={existing?.quantity ?? 0}
                      onChange={e => onUpdateAccessory(acc.id, parseInt(e.target.value) || 0)}
                      className="w-14 border border-white/10 rounded-lg px-2 py-1 text-center bg-white/[0.06]"
                    />
                    <span className="text-slate-400 w-16 text-right">{acc.price.toLocaleString('cs-CZ')} Kc</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {mapSetup && (
        <MapSetupModal
          lat={mapSetup.lat}
          lon={mapSetup.lon}
          name={mapSetup.name}
          onConfirm={handleConfirmMap}
          onCancel={() => setMapSetup(null)}
        />
      )}
    </div>
  );
}
