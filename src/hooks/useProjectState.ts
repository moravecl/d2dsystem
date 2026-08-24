import { useState, useCallback, useEffect, useRef } from 'react';
import type { Product } from '../types/database';
import type { FloorplanObjectData } from '../components/catalog/floorplan/floorplanObjects';
import { supabase } from '../lib/supabase';

export interface Placement {
  id: string;
  x: number;
  y: number;
  note: string;
  ts: number;
  floorId: string;
  config?: { frameSize: number; modules: string[]; colorName?: string; colorHex?: string };
  colorName?: string;
  colorHex?: string;
  icon?: string;
  room?: string;
  circuitId?: string;
  mountingHeight?: string;
}

export interface SelectionState {
  [productId: string]: {
    placements: Placement[];
  };
}

export interface ProjectMeta {
  project: string;
  client: string;
  version: string;
}

export interface FloorScale {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  realDistanceM: number;
  aspectRatio?: number;
}

export interface RoomDoor {
  id: string;
  wallIndex: number;
  position: number;
  widthM: number;
}

export type VentilationMode = 'supply' | 'exhaust' | 'both';

export interface BathroomPlacement {
  id: string;
  symbolId: string;
  x: number;
  y: number;
  rotation: number;
  flipX: boolean;
  note: string;
}

export interface Room {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  /**
   * Volitelne umisteni produktu v mistnosti. Za behu je plni jen workflow
   * (useDesignWorkflow, ProductAssignmentPage) na docasnych kopiich pater;
   * mistnosti v ulozenem stavu projektu toto pole nemaji.
   */
  placements?: Placement[];
  heatingSystemId?: string;
  heatingConfig?: Record<string, string>;
  doors?: RoomDoor[];
  roomType?: string;
  requiredLux?: number;
  ceilingHeight?: number;
  ventilationMode?: VentilationMode;
  airChangesPerHour?: number;
  ductDiameter?: number;
  manualSupplyVents?: number;
  manualExhaustVents?: number;
  bathroomLayout?: BathroomPlacement[];
  labelHidden?: boolean;
  labelOffsetX?: number;
  labelOffsetY?: number;
  labelSize?: number;
}

export interface FloorDistributor {
  id: string;
  x: number;
  y: number;
  name: string;
}

export type CircuitType = 'electric' | 'water' | 'heating' | 'recuperation';

export interface Cable {
  id: string;
  circuitId: string;
  points: { x: number; y: number }[];
  materialName?: string;
}

export interface CircuitBreaker {
  amperage: number;
  poles: number;
  curve: string;
}

export interface FittingOverride {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
}

export interface Circuit {
  id: string;
  name: string;
  color: string;
  type: CircuitType;
  breaker?: CircuitBreaker;
  fittingOverrides?: FittingOverride[];
  fittingCorrections?: Record<string, number>;
}

export interface Dimension {
  id: string;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  label?: string;
}

export interface Floor {
  id: string;
  name: string;
  floorplanImg: string | null;
  scale?: FloorScale;
  rooms?: Room[];
  cables?: Cable[];
  circuits?: Circuit[];
  dimensions?: Dimension[];
  distributors?: FloorDistributor[];
  objects?: FloorplanObjectData[];
}

const STORAGE_KEY = 'hs-project-state';
const DEFAULT_FLOOR: Floor = { id: 'floor-1', name: '1. NP', floorplanImg: null };

function migrateRoomNamesToIds(selected: SelectionState, floors: Floor[]): SelectionState {
  const roomNameToId = new Map<string, string>();
  for (const floor of floors) {
    for (const room of floor.rooms ?? []) {
      roomNameToId.set(room.name, room.id);
    }
  }
  if (roomNameToId.size === 0) return selected;

  const roomIds = new Set(Array.from(roomNameToId.values()));
  let needsMigration = false;
  for (const pid of Object.keys(selected)) {
    for (const pl of selected[pid].placements) {
      if (pl.room && !roomIds.has(pl.room) && roomNameToId.has(pl.room)) {
        needsMigration = true;
        break;
      }
    }
    if (needsMigration) break;
  }
  if (!needsMigration) return selected;

  const migrated: SelectionState = {};
  for (const pid of Object.keys(selected)) {
    migrated[pid] = {
      placements: selected[pid].placements.map(pl => {
        if (pl.room && roomNameToId.has(pl.room)) {
          return { ...pl, room: roomNameToId.get(pl.room) };
        }
        return pl;
      }),
    };
  }
  return migrated;
}

function loadFromStorage(): { selected: SelectionState; meta: ProjectMeta; floors: Floor[]; loadedProjectId?: string | null; pinSize?: number; schematicSymbolScale?: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && data.selected) {
      if (data.floors) {
        data.selected = migrateRoomNamesToIds(data.selected, data.floors);
      }
      return data;
    }
  } catch { /* ignore */ }
  return null;
}

let storageFailed = false;

function saveToStorage(selected: SelectionState, meta: ProjectMeta, floors: Floor[], pinSize: number, schematicSymbolScale: number, loadedProjectId: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ selected, meta, floors, pinSize, schematicSymbolScale, loadedProjectId }));
    storageFailed = false;
  } catch {
    if (!storageFailed) {
      storageFailed = true;
      window.dispatchEvent(new CustomEvent('hs-storage-error'));
    }
  }
}

export function useProjectState() {
  const stored = useRef(loadFromStorage());
  const [selected, setSelected] = useState<SelectionState>(stored.current?.selected ?? {});
  const [meta, setMeta] = useState<ProjectMeta>(stored.current?.meta ?? { project: '', client: '', version: '' });
  const [floors, setFloors] = useState<Floor[]>(stored.current?.floors ?? [{ ...DEFAULT_FLOOR }]);
  const [pinSize, setPinSizeRaw] = useState<number>(stored.current?.pinSize ?? 16);
  const [schematicSymbolScale, setSchematicSymbolScaleRaw] = useState<number>(stored.current?.schematicSymbolScale ?? 24);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(stored.current?.loadedProjectId ?? null);
  const pinSizeLoadedFromDb = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase
        .from('profiles')
        .select('pin_size')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.pin_size != null) {
            setPinSizeRaw(data.pin_size);
          }
          pinSizeLoadedFromDb.current = true;
        });
    });
  }, []);

  const pinSavePending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPinSize = useCallback((size: number) => {
    setPinSizeRaw(size);
    if (pinSavePending.current) clearTimeout(pinSavePending.current);
    pinSavePending.current = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        supabase
          .from('profiles')
          .update({ pin_size: size })
          .eq('id', session.user.id)
          .then(() => {});
      });
    }, 500);
  }, []);

  const setSchematicSymbolScale = useCallback((size: number) => {
    setSchematicSymbolScaleRaw(size);
  }, []);

  useEffect(() => {
    saveToStorage(selected, meta, floors, pinSize, schematicSymbolScale, loadedProjectId);
  }, [selected, meta, floors, pinSize, schematicSymbolScale, loadedProjectId]);

  const isSelected = useCallback((productId: string) => !!selected[productId], [selected]);

  const toggleSelect = useCallback((product: Product, allProducts: Product[]) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[product.id]) {
        delete next[product.id];
      } else {
        if (product.exclusive_group) {
          for (const other of allProducts) {
            if (other.exclusive_group === product.exclusive_group) {
              delete next[other.id];
            }
          }
        }
        next[product.id] = { placements: [] };
      }
      return next;
    });
  }, []);

  const addPlacement = useCallback((productId: string, placement: Placement) => {
    setSelected((prev) => {
      const entry = prev[productId] ?? { placements: [] };
      return {
        ...prev,
        [productId]: { placements: [...entry.placements, placement] },
      };
    });
  }, []);

  const removePlacement = useCallback((productId: string, placementId: string) => {
    setSelected((prev) => {
      const entry = prev[productId];
      if (!entry) return prev;
      const remaining = entry.placements.filter((p) => p.id !== placementId);
      if (remaining.length === 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { placements: remaining } };
    });
  }, []);

  const replacePlacement = useCallback((oldProductId: string, placementId: string, newProductId: string) => {
    setSelected((prev) => {
      const entry = prev[oldProductId];
      if (!entry) return prev;
      const placement = entry.placements.find((p) => p.id === placementId);
      if (!placement) return prev;
      const remaining = entry.placements.filter((p) => p.id !== placementId);
      const next = { ...prev };
      if (remaining.length === 0) delete next[oldProductId];
      else next[oldProductId] = { placements: remaining };
      const newEntry = next[newProductId] ?? { placements: [] };
      next[newProductId] = { placements: [...newEntry.placements, placement] };
      return next;
    });
  }, []);

  const updatePlacementNote = useCallback((productId: string, placementId: string, note: string) => {
    setSelected((prev) => {
      const entry = prev[productId];
      if (!entry) return prev;
      return {
        ...prev,
        [productId]: {
          placements: entry.placements.map((p) => (p.id === placementId ? { ...p, note } : p)),
        },
      };
    });
  }, []);

  const updatePlacementPosition = useCallback((productId: string, placementId: string, x: number, y: number) => {
    setSelected((prev) => {
      const entry = prev[productId];
      if (!entry) return prev;
      return {
        ...prev,
        [productId]: {
          placements: entry.placements.map((p) => (p.id === placementId ? { ...p, x, y } : p)),
        },
      };
    });
  }, []);

  const updatePlacementIcon = useCallback((productId: string, placementId: string, icon: string | undefined) => {
    setSelected((prev) => {
      const entry = prev[productId];
      if (!entry) return prev;
      return {
        ...prev,
        [productId]: {
          placements: entry.placements.map((p) => (p.id === placementId ? { ...p, icon } : p)),
        },
      };
    });
  }, []);

  const updatePlacementRoom = useCallback((productId: string, placementId: string, room: string | undefined) => {
    setSelected((prev) => {
      const entry = prev[productId];
      if (!entry) return prev;
      return {
        ...prev,
        [productId]: {
          placements: entry.placements.map((p) => (p.id === placementId ? { ...p, room } : p)),
        },
      };
    });
  }, []);

  const updatePlacementCircuit = useCallback((productId: string, placementId: string, circuitId: string | undefined) => {
    setSelected((prev) => {
      const entry = prev[productId];
      if (!entry) return prev;
      return {
        ...prev,
        [productId]: {
          placements: entry.placements.map((p) => (p.id === placementId ? { ...p, circuitId } : p)),
        },
      };
    });
  }, []);

  const updatePlacementMountingHeight = useCallback((productId: string, placementId: string, mountingHeight: string | undefined) => {
    setSelected((prev) => {
      const entry = prev[productId];
      if (!entry) return prev;
      return {
        ...prev,
        [productId]: {
          placements: entry.placements.map((p) => (p.id === placementId ? { ...p, mountingHeight } : p)),
        },
      };
    });
  }, []);

  const removeAllPlacements = useCallback((productId: string) => {
    setSelected((prev) => {
      if (!prev[productId]) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const qtyOf = useCallback((productId: string) => selected[productId]?.placements?.length ?? 0, [selected]);

  const totalPins = useCallback(() => {
    let c = 0;
    for (const key of Object.keys(selected)) {
      c += selected[key].placements.length;
    }
    return c;
  }, [selected]);

  const countSelected = useCallback(() => Object.keys(selected).length, [selected]);

  const addFloor = useCallback(() => {
    setFloors((prev) => {
      const num = prev.length + 1;
      return [...prev, { id: `floor-${Date.now()}`, name: `${num}. NP`, floorplanImg: null }];
    });
  }, []);

  const removeFloor = useCallback((floorId: string) => {
    setFloors((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((f) => f.id !== floorId);
    });
    setSelected((prev) => {
      const next: SelectionState = {};
      for (const pid of Object.keys(prev)) {
        const filtered = prev[pid].placements.filter((p) => p.floorId !== floorId);
        if (filtered.length > 0 || prev[pid].placements.length === 0) {
          next[pid] = { placements: filtered };
        }
      }
      return next;
    });
  }, []);

  const renameFloor = useCallback((floorId: string, name: string) => {
    setFloors((prev) => prev.map((f) => (f.id === floorId ? { ...f, name } : f)));
  }, []);

  const duplicateFloor = useCallback((floorId: string) => {
    const newFloorId = `floor-${Date.now()}`;
    const idMap = new Map<string, string>();

    setFloors((prev) => {
      const source = prev.find((f) => f.id === floorId);
      if (!source) return prev;

      const mapId = (old: string) => {
        const n = crypto.randomUUID();
        idMap.set(old, n);
        return n;
      };

      const newFloor: Floor = {
        id: newFloorId,
        name: `${source.name} (kopie)`,
        floorplanImg: source.floorplanImg,
        scale: source.scale ? { ...source.scale } : undefined,
        rooms: (source.rooms ?? []).map((r) => ({
          ...r,
          id: mapId(r.id),
          points: r.points.map((p) => ({ ...p })),
          doors: r.doors?.map((d) => ({ ...d, id: crypto.randomUUID() })),
        })),
        cables: (source.cables ?? []).map((c) => ({
          ...c,
          id: crypto.randomUUID(),
          points: c.points.map((p) => ({ ...p })),
        })),
        circuits: (source.circuits ?? []).map((c) => {
          const nid = mapId(c.id);
          return { ...c, id: nid };
        }),
        dimensions: (source.dimensions ?? []).map((d) => ({
          ...d,
          id: crypto.randomUUID(),
        })),
        distributors: (source.distributors ?? []).map((d) => ({
          ...d,
          id: crypto.randomUUID(),
        })),
        objects: (source.objects ?? []).map((o) => ({
          ...o,
          id: crypto.randomUUID(),
          floorId: newFloorId,
          roomId: o.roomId ? (idMap.get(o.roomId) ?? o.roomId) : '',
        })),
      };

      for (const cable of newFloor.cables ?? []) {
        cable.circuitId = idMap.get(cable.circuitId) ?? cable.circuitId;
      }

      return [...prev, newFloor];
    });

    setSelected((prev) => {
      const next = { ...prev };
      for (const pid of Object.keys(prev)) {
        const floorPlacements = prev[pid].placements.filter((p) => p.floorId === floorId);
        if (floorPlacements.length > 0) {
          const copies = floorPlacements.map((p) => ({
            ...p,
            id: crypto.randomUUID(),
            floorId: newFloorId,
            room: p.room ? (idMap.get(p.room) ?? p.room) : undefined,
            circuitId: p.circuitId ? (idMap.get(p.circuitId) ?? p.circuitId) : undefined,
            ts: Date.now(),
          }));
          next[pid] = { placements: [...(next[pid]?.placements ?? []), ...copies] };
        }
      }
      return next;
    });

    return newFloorId;
  }, []);

  const setFloorImage = useCallback((floorId: string, img: string | null) => {
    setFloors((prev) => prev.map((f) => (f.id === floorId ? { ...f, floorplanImg: img } : f)));
  }, []);

  const setFloorScale = useCallback((floorId: string, scale: FloorScale | undefined) => {
    setFloors((prev) => prev.map((f) => (f.id === floorId ? { ...f, scale } : f)));
  }, []);

  const addRoom = useCallback((floorId: string, room: Room) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, rooms: [...(f.rooms ?? []), room] };
    }));
  }, []);

  const removeRoom = useCallback((floorId: string, roomId: string) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, rooms: (f.rooms ?? []).filter((r) => r.id !== roomId) };
    }));
  }, []);

  const renameRoom = useCallback((floorId: string, roomId: string, name: string) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, rooms: (f.rooms ?? []).map((r) => (r.id === roomId ? { ...r, name } : r)) };
    }));
  }, []);

  const updateRoomHeating = useCallback((floorId: string, roomId: string, heatingSystemId: string | undefined, heatingConfig?: Record<string, string>) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        rooms: (f.rooms ?? []).map((r) =>
          r.id === roomId ? { ...r, heatingSystemId, heatingConfig: heatingConfig ?? r.heatingConfig ?? {} } : r
        ),
      };
    }));
  }, []);

  const updateRoomHeatingConfig = useCallback((floorId: string, roomId: string, key: string, value: string) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        rooms: (f.rooms ?? []).map((r) => {
          if (r.id !== roomId) return r;
          return { ...r, heatingConfig: { ...(r.heatingConfig ?? {}), [key]: value } };
        }),
      };
    }));
  }, []);

  const addRoomDoor = useCallback((floorId: string, roomId: string, door: RoomDoor) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        rooms: (f.rooms ?? []).map((r) => {
          if (r.id !== roomId) return r;
          return { ...r, doors: [...(r.doors ?? []), door] };
        }),
      };
    }));
  }, []);

  const removeRoomDoor = useCallback((floorId: string, roomId: string, doorId: string) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        rooms: (f.rooms ?? []).map((r) => {
          if (r.id !== roomId) return r;
          return { ...r, doors: (r.doors ?? []).filter((d) => d.id !== doorId) };
        }),
      };
    }));
  }, []);

  const updateRoomDoor = useCallback((floorId: string, roomId: string, doorId: string, updates: Partial<RoomDoor>) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        rooms: (f.rooms ?? []).map((r) => {
          if (r.id !== roomId) return r;
          return { ...r, doors: (r.doors ?? []).map((d) => d.id === doorId ? { ...d, ...updates } : d) };
        }),
      };
    }));
  }, []);

  const updateRoomBathroomLayout = useCallback((floorId: string, roomId: string, layout: BathroomPlacement[]) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        rooms: (f.rooms ?? []).map((r) =>
          r.id === roomId ? { ...r, bathroomLayout: layout } : r
        ),
      };
    }));
  }, []);

  const updateRoomVentilation = useCallback((floorId: string, roomId: string, updates: {
    ceilingHeight?: number;
    ventilationMode?: VentilationMode;
    airChangesPerHour?: number;
    ductDiameter?: number;
    manualSupplyVents?: number | null;
    manualExhaustVents?: number | null;
  }) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        rooms: (f.rooms ?? []).map((r) => {
          if (r.id !== roomId) return r;
          const updated = { ...r, ...updates } as Room;
          if (updates.manualSupplyVents === null) delete (updated as any).manualSupplyVents;
          if (updates.manualExhaustVents === null) delete (updated as any).manualExhaustVents;
          return updated;
        }),
      };
    }));
  }, []);

  const updateRoomLabel = useCallback((floorId: string, roomId: string, updates: Partial<Pick<Room, 'labelHidden' | 'labelOffsetX' | 'labelOffsetY' | 'labelSize'>>) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        rooms: (f.rooms ?? []).map((r) => (r.id === roomId ? { ...r, ...updates } : r)),
      };
    }));
  }, []);

  const addDistributor = useCallback((floorId: string, dist: FloorDistributor) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, distributors: [...(f.distributors ?? []), dist] };
    }));
  }, []);

  const removeDistributor = useCallback((floorId: string, distId: string) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, distributors: (f.distributors ?? []).filter((d) => d.id !== distId) };
    }));
  }, []);

  const addCircuit = useCallback((floorId: string, circuit: Circuit) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, circuits: [...(f.circuits ?? []), circuit] };
    }));
  }, []);

  const removeCircuit = useCallback((floorId: string, circuitId: string) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        circuits: (f.circuits ?? []).filter((c) => c.id !== circuitId),
        cables: (f.cables ?? []).filter((c) => c.circuitId !== circuitId),
      };
    }));
  }, []);

  const updateCircuit = useCallback((floorId: string, circuitId: string, updates: Partial<Omit<Circuit, 'id'>>) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        circuits: (f.circuits ?? []).map((c) => (c.id === circuitId ? { ...c, ...updates } : c)),
      };
    }));
  }, []);

  const addCable = useCallback((floorId: string, cable: Cable) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, cables: [...(f.cables ?? []), cable] };
    }));
  }, []);

  const removeCable = useCallback((floorId: string, cableId: string) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, cables: (f.cables ?? []).filter((c) => c.id !== cableId) };
    }));
  }, []);

  const addDimension = useCallback((floorId: string, dim: Dimension) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, dimensions: [...(f.dimensions ?? []), dim] };
    }));
  }, []);

  const removeDimension = useCallback((floorId: string, dimId: string) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, dimensions: (f.dimensions ?? []).filter((d) => d.id !== dimId) };
    }));
  }, []);

  const addFloorObject = useCallback((floorId: string, obj: FloorplanObjectData) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, objects: [...(f.objects ?? []), obj] };
    }));
  }, []);

  const updateFloorObject = useCallback((floorId: string, objectId: string, updates: Partial<FloorplanObjectData>) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, objects: (f.objects ?? []).map((o) => (o.id === objectId ? { ...o, ...updates } : o)) };
    }));
  }, []);

  const removeFloorObject = useCallback((floorId: string, objectId: string) => {
    setFloors((prev) => prev.map((f) => {
      if (f.id !== floorId) return f;
      return { ...f, objects: (f.objects ?? []).filter((o) => o.id !== objectId) };
    }));
  }, []);

  const restoreFromSnapshot = useCallback((selectionData: unknown, floorplanData: unknown) => {
    if (selectionData && typeof selectionData === 'object') {
      setSelected(selectionData as SelectionState);
    }
    if (Array.isArray(floorplanData)) {
      setFloors(floorplanData as Floor[]);
    }
  }, []);

  const resetAll = useCallback(() => {
    setSelected({});
    setMeta({ project: '', client: '', version: '' });
    setFloors([{ ...DEFAULT_FLOOR }]);
    setPinSize(16);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadState = useCallback((s: SelectionState, m: ProjectMeta, floorsOrFp: Floor[] | string | null, projectId?: string | null) => {
    if (Array.isArray(floorsOrFp)) {
      setFloors(floorsOrFp);
      setSelected(s);
    } else {
      const defaultFloor: Floor = { id: 'floor-1', name: '1. NP', floorplanImg: floorsOrFp };
      setFloors([defaultFloor]);
      const migrated: SelectionState = {};
      for (const pid of Object.keys(s)) {
        migrated[pid] = {
          placements: s[pid].placements.map((p) => ({
            ...p,
            floorId: p.floorId || 'floor-1',
          })),
        };
      }
      setSelected(migrated);
    }
    setMeta(m);
    if (projectId !== undefined) setLoadedProjectId(projectId);
  }, []);

  return {
    selected,
    setSelected,
    meta,
    setMeta,
    floors,
    setFloors,
    isSelected,
    toggleSelect,
    addPlacement,
    removePlacement,
    replacePlacement,
    removeAllPlacements,
    updatePlacementNote,
    updatePlacementPosition,
    updatePlacementIcon,
    updatePlacementRoom,
    updatePlacementCircuit,
    updatePlacementMountingHeight,
    qtyOf,
    totalPins,
    countSelected,
    addFloor,
    duplicateFloor,
    removeFloor,
    renameFloor,
    setFloorImage,
    setFloorScale,
    addRoom,
    removeRoom,
    renameRoom,
    updateRoomHeating,
    updateRoomHeatingConfig,
    addRoomDoor,
    removeRoomDoor,
    updateRoomDoor,
    updateRoomBathroomLayout,
    updateRoomVentilation,
    updateRoomLabel,
    addDistributor,
    removeDistributor,
    addCircuit,
    removeCircuit,
    updateCircuit,
    addCable,
    removeCable,
    addDimension,
    removeDimension,
    addFloorObject,
    updateFloorObject,
    removeFloorObject,
    pinSize,
    setPinSize,
    schematicSymbolScale,
    setSchematicSymbolScale,
    restoreFromSnapshot,
    resetAll,
    loadState,
    loadedProjectId,
    setLoadedProjectId,
  };
}

export type ProjectState = ReturnType<typeof useProjectState>;
