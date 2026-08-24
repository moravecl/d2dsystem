import { useState, useEffect, useCallback, useRef } from 'react';
import { Layers, PenTool, Grid3x3 as Grid3X3, BarChart3, ArrowRight, Sparkles, Plus, Copy, Pencil, Trash2, Check, X, Eye, Sun, Camera, ShieldAlert, History, ChevronDown, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../ui/Toast';
import { loadProjectById } from '../catalog/SaveLoadModals';
import Modal from '../ui/Modal';

interface DesignVersion {
  id: string;
  project_id: string;
  version_number: number;
  label: string;
  description: string;
  selection_data: Record<string, unknown>;
  floorplan_data: unknown[];
  created_at: string;
  created_by: string;
}

interface FvVersion {
  id: string;
  version_number: number;
  note: string;
  summary_panel_kwp: number;
  summary_panel_count: number;
  summary_inverter_kw: number;
  summary_battery_kwh: number;
  created_at: string;
}

interface CameraVersion {
  id: string;
  version_number: number;
  note: string;
  summary_camera_count: number;
  summary_total_price: number;
  created_at: string;
}

interface EpsVersion {
  id: string;
  version_number: number;
  note: string;
  summary_detector_count: number;
  summary_total_price: number;
  created_at: string;
}

interface Props {
  projectId: string;
  onViewVersion?: (versionId: string | null) => void;
}

const features = [
  {
    icon: Layers,
    title: 'Katalog produktů',
    description: 'Procházejte kompletní katalog, vybírejte a konfigurujte produkty pro váš projekt.',
    bg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    icon: PenTool,
    title: 'Půdorysový editor',
    description: 'Nahrajte půdorys, nakreslete místnosti a umístěte produkty přímo do plánu.',
    bg: 'bg-teal-500/10',
    iconColor: 'text-teal-600',
  },
  {
    icon: Grid3X3,
    title: 'Místnosti a okruhy',
    description: 'Definujte místnosti, nastavte osvětlení, vytápění a elektroinstalaci.',
    bg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
  },
  {
    icon: BarChart3,
    title: 'Souhrn návrhu',
    description: 'Kompletní přehled všech vybraných produktů, materiálů a nákladů.',
    bg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
];

export default function ProjectDesignTab({ projectId, onViewVersion }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [fvVersions, setFvVersions] = useState<FvVersion[]>([]);
  const [cameraVersions, setCameraVersions] = useState<CameraVersion[]>([]);
  const [epsVersions, setEpsVersions] = useState<EpsVersion[]>([]);
  const [, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [versionDesc, setVersionDesc] = useState('');
  const [editingVersion, setEditingVersion] = useState<DesignVersion | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showFvSaveModal, setShowFvSaveModal] = useState(false);
  const [showCamSaveModal, setShowCamSaveModal] = useState(false);
  const [showEpsSaveModal, setShowEpsSaveModal] = useState(false);
  const [fvVersionNote, setFvVersionNote] = useState('');
  const [camVersionNote, setCamVersionNote] = useState('');
  const [epsVersionNote, setEpsVersionNote] = useState('');

  const orgId = organization?.id;

  const loadVersions = useCallback(async () => {
    const { data } = await supabase
      .from('design_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });
    setVersions((data ?? []) as DesignVersion[]);
    setLoading(false);
  }, [projectId]);

  const loadFvVersions = useCallback(async () => {
    if (!orgId) return;
    const { data: fvDesign } = await supabase
      .from('fv_designs')
      .select('id')
      .eq('project_id', projectId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!fvDesign) return;
    const { data } = await supabase
      .from('fv_design_versions')
      .select('id, version_number, note, summary_panel_kwp, summary_panel_count, summary_inverter_kw, summary_battery_kwh, created_at')
      .eq('fv_design_id', fvDesign.id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setFvVersions((data ?? []) as FvVersion[]);
  }, [projectId, orgId]);

  const loadCameraVersions = useCallback(async () => {
    if (!orgId) return;
    const { data: camDesign } = await supabase
      .from('camera_designs')
      .select('id')
      .eq('project_id', projectId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!camDesign) return;
    const { data } = await supabase
      .from('camera_design_versions')
      .select('id, version_number, note, summary_camera_count, summary_total_price, created_at')
      .eq('camera_design_id', camDesign.id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setCameraVersions((data ?? []) as CameraVersion[]);
  }, [projectId, orgId]);

  const loadEpsVersions = useCallback(async () => {
    if (!orgId) return;
    const { data: epsDesign } = await supabase
      .from('eps_designs')
      .select('id')
      .eq('project_id', projectId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!epsDesign) return;
    const { data } = await supabase
      .from('eps_design_versions')
      .select('id, version_number, note, summary_detector_count, summary_total_price, created_at')
      .eq('eps_design_id', epsDesign.id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setEpsVersions((data ?? []) as EpsVersion[]);
  }, [projectId, orgId]);

  useEffect(() => {
    loadVersions();
    loadFvVersions();
    loadCameraVersions();
    loadEpsVersions();
  }, [loadVersions, loadFvVersions, loadCameraVersions, loadEpsVersions]);

  const handleSaveVersion = async () => {
    if (!user) return;
    setSaving(true);

    const result = await loadProjectById(projectId);
    if (!result) {
      toast('Žádná data návrhu k uložení', 'error');
      setSaving(false);
      return;
    }

    const nextNumber = versions.length > 0
      ? Math.max(...versions.map(v => v.version_number)) + 1
      : 1;

    const label = versionLabel.trim() || `V${nextNumber}`;

    const { error } = await supabase.from('design_versions').insert({
      project_id: projectId,
      version_number: nextNumber,
      label,
      description: versionDesc.trim(),
      selection_data: result.selected,
      floorplan_data: Array.isArray(result.floorsOrFp) ? result.floorsOrFp : [],
      created_by: user.id,
    });

    setSaving(false);
    if (error) {
      toast('Chyba při ukládání verze', 'error');
      return;
    }

    toast('Verze uložena');
    setShowSaveModal(false);
    setVersionLabel('');
    setVersionDesc('');
    loadVersions();
  };

  const handleNewVersionFromExisting = async (sourceVersion: DesignVersion) => {
    if (!user) return;

    await supabase.from('projects').update({
      selection_data: sourceVersion.selection_data,
      floorplan_url: JSON.stringify(sourceVersion.floorplan_data),
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);

    toast('Data verze načtena do editoru');
    navigate(`/projekty/${projectId}/navrh`);
  };

  const handleLoadVersionToEditor = async (version: DesignVersion) => {
    await supabase.from('projects').update({
      selection_data: version.selection_data,
      floorplan_url: JSON.stringify(version.floorplan_data),
      active_design_version_id: version.id,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);

    navigate(`/projekty/${projectId}/navrh`);
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!confirm('Opravdu smazat tuto verzi?')) return;
    const { error } = await supabase.from('design_versions').delete().eq('id', versionId);
    if (error) {
      toast('Chyba při mazání', 'error');
      return;
    }
    toast('Verze smazána');
    loadVersions();
  };

  const handleRenameVersion = async () => {
    if (!editingVersion || !editLabel.trim()) return;
    const { error } = await supabase
      .from('design_versions')
      .update({ label: editLabel.trim() })
      .eq('id', editingVersion.id);
    if (error) {
      toast('Chyba při přejmenování', 'error');
      return;
    }
    setEditingVersion(null);
    loadVersions();
  };

  const handleSaveFvVersion = async () => {
    if (!orgId) return;
    setSaving(true);

    const { data: fvDesign } = await supabase
      .from('fv_designs')
      .select('*')
      .eq('project_id', projectId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!fvDesign) {
      toast('Žádný FV návrh k uložení', 'error');
      setSaving(false);
      return;
    }

    const nextNumber = fvVersions.length > 0
      ? Math.max(...fvVersions.map(v => v.version_number)) + 1
      : 1;

    const roofs = Array.isArray(fvDesign.roofs) ? fvDesign.roofs : [];
    let totalKwp = 0;
    let totalCount = 0;
    for (const r of roofs) {
      const roof = r as { panelCount?: number; panelWp?: number };
      totalCount += roof.panelCount ?? 0;
      totalKwp += ((roof.panelCount ?? 0) * (roof.panelWp ?? 0)) / 1000;
    }

    const sysConfig = (fvDesign.system_config ?? {}) as Record<string, unknown>;

    const { error } = await supabase.from('fv_design_versions').insert({
      fv_design_id: fvDesign.id,
      org_id: orgId,
      version_number: nextNumber,
      note: fvVersionNote.trim() || `V${nextNumber}`,
      summary_panel_kwp: Math.round(totalKwp * 100) / 100,
      summary_panel_count: totalCount,
      summary_inverter_kw: 0,
      summary_battery_kwh: (sysConfig.batteryCount as number ?? 0) > 0 ? (sysConfig.batteryCount as number ?? 0) : 0,
      input_params: fvDesign.input_params ?? {},
      roofs: fvDesign.roofs ?? [],
      system_config: fvDesign.system_config ?? {},
      pvgis_results: fvDesign.pvgis_results ?? null,
      created_by: user?.id ?? null,
    });

    setSaving(false);
    if (error) {
      toast('Chyba při ukládání FV verze', 'error');
      return;
    }

    toast('FV verze uložena');
    setShowFvSaveModal(false);
    setFvVersionNote('');
    loadFvVersions();
  };

  const handleSaveCameraVersion = async () => {
    if (!orgId) return;
    setSaving(true);

    const { data: camDesign } = await supabase
      .from('camera_designs')
      .select('*')
      .eq('project_id', projectId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!camDesign) {
      toast('Žádný kamerový návrh k uložení', 'error');
      setSaving(false);
      return;
    }

    const nextNumber = cameraVersions.length > 0
      ? Math.max(...cameraVersions.map(v => v.version_number)) + 1
      : 1;

    const designData = (camDesign.design_data ?? {}) as Record<string, unknown>;
    const cameras = Array.isArray(designData.cameras) ? designData.cameras : [];

    const { error } = await supabase.from('camera_design_versions').insert({
      camera_design_id: camDesign.id,
      org_id: orgId,
      version_number: nextNumber,
      note: camVersionNote.trim() || `V${nextNumber}`,
      summary_camera_count: cameras.length,
      summary_total_price: 0,
      design_data: camDesign.design_data ?? {},
      created_by: user?.id ?? null,
    });

    setSaving(false);
    if (error) {
      toast('Chyba při ukládání kamerové verze', 'error');
      return;
    }

    toast('Kamerová verze uložena');
    setShowCamSaveModal(false);
    setCamVersionNote('');
    loadCameraVersions();
  };

  const handleSaveEpsVersion = async () => {
    if (!orgId) return;
    setSaving(true);

    const { data: epsDesign } = await supabase
      .from('eps_designs')
      .select('*')
      .eq('project_id', projectId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!epsDesign) {
      toast('Žádný EPS / EZS návrh k uložení', 'error');
      setSaving(false);
      return;
    }

    const nextNumber = epsVersions.length > 0
      ? Math.max(...epsVersions.map(v => v.version_number)) + 1
      : 1;

    const designData = (epsDesign.design_data ?? {}) as Record<string, unknown>;
    const detectors = Array.isArray(designData.detectors) ? designData.detectors : [];

    const { error } = await supabase.from('eps_design_versions').insert({
      eps_design_id: epsDesign.id,
      org_id: orgId,
      version_number: nextNumber,
      note: epsVersionNote.trim() || `V${nextNumber}`,
      summary_detector_count: detectors.length,
      summary_total_price: 0,
      design_data: epsDesign.design_data ?? {},
      created_by: user?.id ?? null,
    });

    setSaving(false);
    if (error) {
      toast('Chyba při ukládání EPS / EZS verze', 'error');
      return;
    }

    toast('EPS / EZS verze uložena');
    setShowEpsSaveModal(false);
    setEpsVersionNote('');
    loadEpsVersions();
  };

  const productCount = (version: DesignVersion) => {
    if (!version.selection_data || typeof version.selection_data !== 'object') return 0;
    return Object.keys(version.selection_data).length;
  };

  const placementCount = (version: DesignVersion) => {
    if (!version.selection_data || typeof version.selection_data !== 'object') return 0;
    let count = 0;
    for (const val of Object.values(version.selection_data)) {
      const entry = val as { placements?: unknown[] };
      if (entry?.placements) count += entry.placements.length;
    }
    return count;
  };

  const inputClasses = 'w-full px-3.5 py-2.5 text-sm border border-white/[0.08] rounded-xl bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition';

  return (
    <div className="space-y-6 animate-fade-in">
      <DesignerCard
        title="Otevřít návrhový nástroj"
        subtitle="Upravit aktuální pracovní verzi návrhu"
        icon={<Sparkles className="w-8 h-8 text-white" />}
        variant="dark"
        onClick={() => navigate(`/projekty/${projectId}/navrh`)}
        versions={versions}
        versionType="design"
        onSaveVersion={() => { setVersionLabel(''); setVersionDesc(''); setShowSaveModal(true); }}
        renderVersionItem={(v) => {
          const version = v as DesignVersion;
          return (
            <DesignVersionRow
              key={version.id}
              version={version}
              editingVersion={editingVersion}
              editLabel={editLabel}
              onEditLabel={setEditLabel}
              onStartEdit={(ver) => { setEditingVersion(ver); setEditLabel(ver.label); }}
              onCancelEdit={() => setEditingVersion(null)}
              onSaveEdit={handleRenameVersion}
              onLoadToEditor={handleLoadVersionToEditor}
              onNewFromExisting={handleNewVersionFromExisting}
              onDelete={handleDeleteVersion}
              onViewVersion={onViewVersion}
              productCount={productCount(version)}
              placementCount={placementCount(version)}
            />
          );
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <DesignerCard
          title="Fotovoltaický návrhář"
          subtitle="Návrh FV systému, výpočty a export"
          icon={<Sun className="w-6 h-6 text-orange-400" />}
          variant="fv"
          onClick={() => navigate(`/projekty/${projectId}/fv-navrh`)}
          versions={fvVersions}
          versionType="fv"
          onSaveVersion={() => { setFvVersionNote(''); setShowFvSaveModal(true); }}
          renderVersionItem={(v) => {
            const fv = v as FvVersion;
            return (
              <div key={fv.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 text-[10px] font-extrabold text-orange-400">
                  v{fv.version_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{fv.note || 'Bez poznámky'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-bold text-orange-400">{fv.summary_panel_kwp} kWp</span>
                    <span className="text-[9px] font-bold text-slate-400">{fv.summary_panel_count} panelu</span>
                    {fv.summary_battery_kwh > 0 && (
                      <span className="text-[9px] font-bold text-emerald-400">{fv.summary_battery_kwh} kWh</span>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {new Date(fv.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          }}
        />

        <DesignerCard
          title="Kamerový systém"
          subtitle="Návrh CCTV, kabeláž a kalkulace"
          icon={<Camera className="w-6 h-6 text-sky-400" />}
          variant="camera"
          onClick={() => navigate(`/projekty/${projectId}/kamerovy-system`)}
          versions={cameraVersions}
          versionType="camera"
          onSaveVersion={() => { setCamVersionNote(''); setShowCamSaveModal(true); }}
          renderVersionItem={(v) => {
            const cam = v as CameraVersion;
            return (
              <div key={cam.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0 text-[10px] font-extrabold text-sky-400">
                  v{cam.version_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{cam.note || 'Bez poznámky'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-bold text-sky-400">{cam.summary_camera_count} kamer</span>
                    {cam.summary_total_price > 0 && (
                      <span className="text-[9px] font-bold text-emerald-400">{cam.summary_total_price.toLocaleString('cs-CZ')} Kc</span>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {new Date(cam.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          }}
        />

        <DesignerCard
          title="EPS / EZS"
          subtitle="Požární signalizace a elektronické zabezpečení"
          icon={<ShieldAlert className="w-6 h-6 text-red-400" />}
          variant="eps"
          onClick={() => navigate(`/projekty/${projectId}/eps-navrh`)}
          versions={epsVersions}
          versionType="eps"
          onSaveVersion={() => { setEpsVersionNote(''); setShowEpsSaveModal(true); }}
          renderVersionItem={(v) => {
            const eps = v as EpsVersion;
            return (
              <div key={eps.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 text-[10px] font-extrabold text-red-400">
                  v{eps.version_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{eps.note || 'Bez poznámky'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-bold text-red-400">{eps.summary_detector_count} detektoru</span>
                    {eps.summary_total_price > 0 && (
                      <span className="text-[9px] font-bold text-emerald-400">{eps.summary_total_price.toLocaleString('cs-CZ')} Kc</span>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {new Date(eps.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map((feat) => (
          <div
            key={feat.title}
            className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] p-5 hover:border-white/[0.12] transition-all duration-200"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 ${feat.bg} rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-80 transition-opacity`} />
            <div className="relative">
              <div className={`w-10 h-10 rounded-xl ${feat.bg} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                <feat.icon className={`w-5 h-5 ${feat.iconColor}`} />
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">{feat.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{feat.description}</p>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Uložit verzi návrhu"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowSaveModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveVersion}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : 'Uložit verzi'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Název verze</label>
            <input
              type="text"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              className={inputClasses}
              placeholder={`V${(versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1)} - Premium`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Popis (volitelně)</label>
            <textarea
              value={versionDesc}
              onChange={(e) => setVersionDesc(e.target.value)}
              rows={3}
              className={`${inputClasses} resize-none`}
              placeholder="Co se změnilo v této verzi..."
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showFvSaveModal}
        onClose={() => setShowFvSaveModal(false)}
        title="Uložit verzi FV návrhu"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowFvSaveModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveFvVersion}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : 'Uložit verzi'}
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Poznámka k verzi</label>
          <input
            type="text"
            value={fvVersionNote}
            onChange={(e) => setFvVersionNote(e.target.value)}
            className={inputClasses}
            placeholder={`V${(fvVersions.length > 0 ? Math.max(...fvVersions.map(v => v.version_number)) + 1 : 1)}`}
          />
        </div>
      </Modal>

      <Modal
        open={showCamSaveModal}
        onClose={() => setShowCamSaveModal(false)}
        title="Uložit verzi kamerového návrhu"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowCamSaveModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveCameraVersion}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : 'Uložit verzi'}
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Poznámka k verzi</label>
          <input
            type="text"
            value={camVersionNote}
            onChange={(e) => setCamVersionNote(e.target.value)}
            className={inputClasses}
            placeholder={`V${(cameraVersions.length > 0 ? Math.max(...cameraVersions.map(v => v.version_number)) + 1 : 1)}`}
          />
        </div>
      </Modal>

      <Modal
        open={showEpsSaveModal}
        onClose={() => setShowEpsSaveModal(false)}
        title="Uložit verzi EPS / EZS návrhu"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowEpsSaveModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-xl transition"
            >
              Zrušit
            </button>
            <button
              onClick={handleSaveEpsVersion}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : 'Uložit verzi'}
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Poznámka k verzi</label>
          <input
            type="text"
            value={epsVersionNote}
            onChange={(e) => setEpsVersionNote(e.target.value)}
            className={inputClasses}
            placeholder={`V${(epsVersions.length > 0 ? Math.max(...epsVersions.map(v => v.version_number)) + 1 : 1)}`}
          />
        </div>
      </Modal>
    </div>
  );
}

interface DesignerCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  variant: 'dark' | 'fv' | 'camera' | 'eps';
  onClick: () => void;
  versions: { id: string; version_number: number }[];
  versionType: 'design' | 'fv' | 'camera' | 'eps';
  onSaveVersion?: () => void;
  renderVersionItem: (version: { id: string; version_number: number }) => React.ReactNode;
}

function DesignerCard({
  title,
  subtitle,
  icon,
  variant,
  onClick,
  versions,
  onSaveVersion,
  renderVersionItem,
}: DesignerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  if (variant === 'dark') {
    return (
      <div ref={panelRef} className="relative">
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-left group transition-all duration-300">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-teal-500/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/4" />

          <button onClick={onClick} className="relative w-full p-8 text-left">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/15 transition-all duration-300">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-200 transition-colors">
                  {title}
                </h3>
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  {subtitle}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 group-hover:translate-x-1 transition-all duration-300">
                <ArrowRight className="w-5 h-5 text-white" />
              </div>
            </div>
          </button>

          <div className="relative px-8 pb-4 flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-[11px] font-bold transition"
            >
              <History className="w-3 h-3" />
              Verze
              {versions.length > 0 && (
                <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[9px] font-extrabold">
                  {versions.length}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {onSaveVersion && (
              <button
                onClick={(e) => { e.stopPropagation(); onSaveVersion(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/30 hover:bg-blue-500/40 text-blue-200 text-[11px] font-bold transition"
              >
                <Plus className="w-3 h-3" /> Uložit verzi
              </button>
            )}
          </div>
        </div>

        {expanded && versions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white/[0.06] backdrop-blur-sm rounded-xl border border-white/[0.08] z-30 max-h-[400px] overflow-y-auto">
            <div className="sticky top-0 bg-white/[0.06] px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-300">Verze návrhu</span>
              <span className="text-[9px] font-bold text-slate-400 bg-white/[0.06] px-1.5 py-0.5 rounded">{versions.length}</span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {versions.map(v => renderVersionItem(v))}
            </div>
          </div>
        )}
        {expanded && versions.length === 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white/[0.06] backdrop-blur-sm rounded-xl border border-white/[0.08] z-30 p-6 text-center">
            <History className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-400">Zatím žádné uložené verze</p>
          </div>
        )}
      </div>
    );
  }

  const colorMap = {
    fv: {
      border: 'border-orange-500/20 hover:border-orange-500/30',
      bg: 'bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-orange-500/5',
      accent: 'bg-orange-400/10 group-hover:bg-orange-400/15',
      iconBg: 'bg-orange-500/20 border-orange-500/20 group-hover:bg-orange-500/20',
      titleHover: 'group-hover:text-orange-400',
      arrowBg: 'bg-orange-500/20 group-hover:bg-orange-500/20',
      arrowColor: 'text-orange-400',
      tagBg: 'bg-orange-500/20 text-orange-400',
      tagBgHover: 'hover:bg-orange-500/20',
      plusBg: 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20',
    },
    camera: {
      border: 'border-sky-500/20 hover:border-sky-500/30',
      bg: 'bg-gradient-to-br from-sky-500/5 via-cyan-500/5 to-sky-500/5',
      accent: 'bg-sky-400/10 group-hover:bg-sky-400/15',
      iconBg: 'bg-sky-500/20 border-sky-500/20 group-hover:bg-sky-500/20',
      titleHover: 'group-hover:text-sky-400',
      arrowBg: 'bg-sky-500/20 group-hover:bg-sky-500/20',
      arrowColor: 'text-sky-400',
      tagBg: 'bg-sky-500/20 text-sky-400',
      tagBgHover: 'hover:bg-sky-500/20',
      plusBg: 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20',
    },
    eps: {
      border: 'border-red-500/20 hover:border-red-500/30',
      bg: 'bg-gradient-to-br from-red-500/5 via-rose-500/5 to-red-500/5',
      accent: 'bg-red-400/10 group-hover:bg-red-400/15',
      iconBg: 'bg-red-500/20 border-red-500/20 group-hover:bg-red-500/20',
      titleHover: 'group-hover:text-red-400',
      arrowBg: 'bg-red-500/20 group-hover:bg-red-500/20',
      arrowColor: 'text-red-400',
      tagBg: 'bg-red-500/20 text-red-400',
      tagBgHover: 'hover:bg-red-500/20',
      plusBg: 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
    },
  };
  const c = colorMap[variant] ?? colorMap.fv;

  return (
    <div ref={panelRef} className="relative">
      <div className={`relative w-full overflow-hidden rounded-2xl border ${c.border} ${c.bg} text-left group transition-all duration-300`}>
        <div className={`absolute top-0 right-0 w-40 h-40 ${c.accent} rounded-full -translate-y-1/2 translate-x-1/4 transition-colors`} />
        <button onClick={onClick} className="relative w-full p-5 text-left">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${c.iconBg} border flex items-center justify-center group-hover:scale-110 transition-all duration-300 shrink-0`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-bold text-white mb-0.5 ${c.titleHover} transition-colors`}>
                {title}
              </h3>
              <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                {subtitle}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-full ${c.arrowBg} flex items-center justify-center group-hover:translate-x-1 transition-all duration-300 shrink-0`}>
              <ArrowRight className={`w-4 h-4 ${c.arrowColor}`} />
            </div>
          </div>
        </button>

        <div className="relative px-5 pb-3 flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${c.tagBg} ${c.tagBgHover} text-[10px] font-bold transition`}
          >
            <History className="w-2.5 h-2.5" />
            Verze
            {versions.length > 0 && (
              <span className="font-extrabold">{versions.length}</span>
            )}
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          {onSaveVersion && (
            <button
              onClick={(e) => { e.stopPropagation(); onSaveVersion(); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${c.plusBg} text-[10px] font-bold transition`}
            >
              <Plus className="w-2.5 h-2.5" /> Uložit verzi
            </button>
          )}
        </div>
      </div>

      {expanded && versions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white/[0.06] backdrop-blur-sm rounded-xl border border-white/[0.08] z-30 max-h-[350px] overflow-y-auto">
          <div className="sticky top-0 bg-white/[0.06] px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
            <History className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400">Historie verzí</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {versions.map(v => renderVersionItem(v))}
          </div>
        </div>
      )}
      {expanded && versions.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white/[0.06] backdrop-blur-sm rounded-xl border border-white/[0.08] z-30 p-5 text-center">
          <History className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
          <p className="text-[10px] font-bold text-slate-400">Zatím žádné verze</p>
        </div>
      )}
    </div>
  );
}

interface DesignVersionRowProps {
  version: DesignVersion;
  editingVersion: DesignVersion | null;
  editLabel: string;
  onEditLabel: (val: string) => void;
  onStartEdit: (v: DesignVersion) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onLoadToEditor: (v: DesignVersion) => void;
  onNewFromExisting: (v: DesignVersion) => void;
  onDelete: (id: string) => void;
  onViewVersion?: (id: string | null) => void;
  productCount: number;
  placementCount: number;
}

function DesignVersionRow({
  version,
  editingVersion,
  editLabel,
  onEditLabel,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onLoadToEditor,
  onNewFromExisting,
  onDelete,
  onViewVersion,
  productCount,
  placementCount,
}: DesignVersionRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition cursor-pointer" onClick={() => onLoadToEditor(version)}>
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 text-[10px] font-extrabold text-blue-400 group-hover:bg-blue-500/20 transition">
        v{version.version_number}
      </div>
      <div className="flex-1 min-w-0">
        {editingVersion?.id === version.id ? (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={editLabel}
              onChange={(e) => onEditLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
              className="px-2 py-1 text-xs font-semibold border border-blue-500/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-40"
            />
            <button onClick={onSaveEdit} className="p-1 rounded text-blue-400 hover:bg-blue-500/10"><Check className="w-3 h-3" /></button>
            <button onClick={onCancelEdit} className="p-1 rounded text-slate-400 hover:bg-white/[0.04]"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <div className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">{version.label}</div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] font-bold text-blue-400">{productCount} produktů</span>
          <span className="text-[9px] font-bold text-slate-400">{placementCount} pinů</span>
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5">
          {new Date(version.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
        {version.description && (
          <p className="text-[9px] text-slate-500 mt-0.5 truncate">{version.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onViewVersion && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewVersion(version.id); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
            title="Zobrazit výběr"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white/[0.06] rounded-xl shadow-xl border border-white/[0.08] w-44 z-40 overflow-hidden">
              <button onClick={() => { setMenuOpen(false); onLoadToEditor(version); }} className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/[0.04] transition text-left">
                <Pencil className="w-3 h-3 text-slate-400" /> Otevřít v editoru
              </button>
              <button onClick={() => { setMenuOpen(false); onNewFromExisting(version); }} className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/[0.04] transition text-left">
                <Copy className="w-3 h-3 text-slate-400" /> Nová verze z této
              </button>
              <button onClick={() => { setMenuOpen(false); onStartEdit(version); }} className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/[0.04] transition text-left">
                <Pencil className="w-3 h-3 text-slate-400" /> Přejmenovat
              </button>
              <div className="border-t border-white/[0.06]" />
              <button onClick={() => { setMenuOpen(false); onDelete(version.id); }} className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition text-left">
                <Trash2 className="w-3 h-3" /> Smazat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
