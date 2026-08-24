import {
  Lightbulb, Plug, Zap, ToggleLeft, Thermometer,
  Wifi, Speaker, Camera, Bell, Fan, Tv, Eye,
  Lock, Flame, Droplets, Wind, Radio, Power,
  Sun, CircleDot, Monitor, BatteryCharging,
  Lamp, LampCeiling, LampDesk, LampFloor, LampWallDown, LampWallUp,
  ShowerHead, Bath, Heater, Gauge,
  AirVent, Siren, ShieldCheck, ShieldAlert,
  DoorClosed, DoorOpen, Blinds,
  AlarmSmoke, AlarmCheck,
  Antenna, SatelliteDish, Router, Server,
  Timer, Clock, Usb,
  ThermometerSun, ThermometerSnowflake,
  AudioLines, CircuitBoard, GlassWater,
  type LucideIcon,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { sanitizeSvg } from '../../../lib/sanitize';

export interface FloorplanIconDef {
  id: string;
  name: string;
  category: string;
  Icon: LucideIcon;
  custom?: boolean;
}

export const ICON_CATEGORIES = [
  'Osvětlení',
  'Elektro',
  'Ovládání',
  'Senzory',
  'Technika',
  'Voda',
  'Topení',
  'Rekuperace',
  'Bezpečnost',
  'Ostatní',
] as const;

export const FLOORPLAN_ICONS: FloorplanIconDef[] = [
  { id: 'lightbulb', name: 'Světlo', category: 'Osvětlení', Icon: Lightbulb },
  { id: 'sun', name: 'Bodové', category: 'Osvětlení', Icon: Sun },
  { id: 'lamp', name: 'Lampa', category: 'Osvětlení', Icon: Lamp },
  { id: 'lamp-ceiling', name: 'Stropní', category: 'Osvětlení', Icon: LampCeiling },
  { id: 'lamp-desk', name: 'Stolní', category: 'Osvětlení', Icon: LampDesk },
  { id: 'lamp-floor', name: 'Stojací', category: 'Osvětlení', Icon: LampFloor },
  { id: 'lamp-wall-down', name: 'Nástěnné dolů', category: 'Osvětlení', Icon: LampWallDown },
  { id: 'lamp-wall-up', name: 'Nástěnné nahoru', category: 'Osvětlení', Icon: LampWallUp },

  { id: 'plug', name: 'Zásuvka', category: 'Elektro', Icon: Plug },
  { id: 'zap', name: 'Elektro bod', category: 'Elektro', Icon: Zap },
  { id: 'power', name: 'Napájení', category: 'Elektro', Icon: Power },
  { id: 'battery', name: 'Akumulátor', category: 'Elektro', Icon: BatteryCharging },
  { id: 'circuit', name: 'Rozvaděč', category: 'Elektro', Icon: CircuitBoard },
  { id: 'usb', name: 'USB', category: 'Elektro', Icon: Usb },

  { id: 'toggle', name: 'Spínač', category: 'Ovládání', Icon: ToggleLeft },
  { id: 'thermostat', name: 'Termostat', category: 'Ovládání', Icon: Thermometer },
  { id: 'timer', name: 'Časovač', category: 'Ovládání', Icon: Timer },
  { id: 'clock', name: 'Hodiny / plánovač', category: 'Ovládání', Icon: Clock },
  { id: 'blinds', name: 'Žaluzie / rolety', category: 'Ovládání', Icon: Blinds },
  { id: 'monitor', name: 'Panel', category: 'Ovládání', Icon: Monitor },

  { id: 'eye', name: 'Pohyb. čidlo', category: 'Senzory', Icon: Eye },
  { id: 'flame', name: 'Detektor kouře', category: 'Senzory', Icon: Flame },
  { id: 'alarm-smoke', name: 'Detektor požáru', category: 'Senzory', Icon: AlarmSmoke },
  { id: 'droplets', name: 'Detektor vody', category: 'Senzory', Icon: Droplets },
  { id: 'thermo-sun', name: 'Teplotní čidlo', category: 'Senzory', Icon: ThermometerSun },
  { id: 'thermo-frost', name: 'Mrazové čidlo', category: 'Senzory', Icon: ThermometerSnowflake },
  { id: 'gauge', name: 'Tlakoměr / manometr', category: 'Senzory', Icon: Gauge },

  { id: 'wifi', name: 'WiFi / Data', category: 'Technika', Icon: Wifi },
  { id: 'speaker', name: 'Reproduktor', category: 'Technika', Icon: Speaker },
  { id: 'audio', name: 'Audio linka', category: 'Technika', Icon: AudioLines },
  { id: 'tv', name: 'TV vývod', category: 'Technika', Icon: Tv },
  { id: 'radio', name: 'Anténa / RF', category: 'Technika', Icon: Radio },
  { id: 'antenna', name: 'Anténa', category: 'Technika', Icon: Antenna },
  { id: 'satellite', name: 'SAT', category: 'Technika', Icon: SatelliteDish },
  { id: 'router', name: 'Router / switch', category: 'Technika', Icon: Router },
  { id: 'server', name: 'Server / rack', category: 'Technika', Icon: Server },

  { id: 'shower', name: 'Sprcha', category: 'Voda', Icon: ShowerHead },
  { id: 'bath', name: 'Vana', category: 'Voda', Icon: Bath },
  { id: 'glass-water', name: 'Výtok / kohoutek', category: 'Voda', Icon: GlassWater },
  { id: 'droplets-water', name: 'Vodovodní bod', category: 'Voda', Icon: Droplets },

  { id: 'heater', name: 'Radiátor', category: 'Topení', Icon: Heater },
  { id: 'thermo-heat', name: 'Topné čidlo', category: 'Topení', Icon: ThermometerSun },
  { id: 'flame-heat', name: 'Kotel / plamen', category: 'Topení', Icon: Flame },

  { id: 'air-vent', name: 'Přívod / odvod', category: 'Rekuperace', Icon: AirVent },
  { id: 'wind', name: 'Vzduchotechnika', category: 'Rekuperace', Icon: Wind },
  { id: 'fan', name: 'Ventilátor', category: 'Rekuperace', Icon: Fan },

  { id: 'camera', name: 'Kamera', category: 'Bezpečnost', Icon: Camera },
  { id: 'siren', name: 'Siréna', category: 'Bezpečnost', Icon: Siren },
  { id: 'shield-check', name: 'Zabezpečení', category: 'Bezpečnost', Icon: ShieldCheck },
  { id: 'shield-alert', name: 'Alarm zóna', category: 'Bezpečnost', Icon: ShieldAlert },
  { id: 'alarm-check', name: 'Alarm panel', category: 'Bezpečnost', Icon: AlarmCheck },
  { id: 'lock', name: 'Přístup', category: 'Bezpečnost', Icon: Lock },
  { id: 'door-closed', name: 'Dveřní kontakt', category: 'Bezpečnost', Icon: DoorClosed },
  { id: 'door-open', name: 'Dveřní senzor', category: 'Bezpečnost', Icon: DoorOpen },

  { id: 'bell', name: 'Zvonek', category: 'Ostatní', Icon: Bell },
  { id: 'dot', name: 'Obecný bod', category: 'Ostatní', Icon: CircleDot },
];

const ICON_MAP = new Map(FLOORPLAN_ICONS.map((i) => [i.id, i]));

const CUSTOM_ICONS_KEY = 'hs-custom-icons';

interface CustomIconData {
  id: string;
  name: string;
  category: string;
  letter: string;
  color: string;
  svgContent?: string;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

function loadCustomIcons(): CustomIconData[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ICONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomIcons(icons: CustomIconData[]) {
  localStorage.setItem(CUSTOM_ICONS_KEY, JSON.stringify(icons));
}

let cachedCustomIcons: CustomIconData[] = loadCustomIcons();

export function getCustomIcons(): CustomIconData[] {
  return cachedCustomIcons;
}

export function addCustomIcon(icon: CustomIconData) {
  cachedCustomIcons = [...cachedCustomIcons, icon];
  saveCustomIcons(cachedCustomIcons);
}

export function removeCustomIcon(id: string) {
  cachedCustomIcons = cachedCustomIcons.filter((i) => i.id !== id);
  saveCustomIcons(cachedCustomIcons);
}

export function updateCustomIcon(id: string, patch: Partial<CustomIconData>) {
  cachedCustomIcons = cachedCustomIcons.map((i) => i.id === id ? { ...i, ...patch } : i);
  saveCustomIcons(cachedCustomIcons);
}

export function getAllIcons(): FloorplanIconDef[] {
  const customs: FloorplanIconDef[] = cachedCustomIcons.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category || 'Vlastní',
    Icon: CircleDot,
    custom: true,
  }));
  return [...FLOORPLAN_ICONS, ...customs];
}

export function getFloorplanIcon(id: string | undefined): FloorplanIconDef | undefined {
  if (!id) return undefined;
  const builtIn = ICON_MAP.get(id);
  if (builtIn) return builtIn;
  const custom = cachedCustomIcons.find((c) => c.id === id);
  if (custom) {
    return {
      id: custom.id,
      name: custom.name,
      category: custom.category || 'Vlastní',
      Icon: CircleDot,
      custom: true,
    };
  }
  return undefined;
}

export function getCustomIconData(id: string): CustomIconData | undefined {
  return cachedCustomIcons.find((c) => c.id === id);
}

export function renderPinIcon(iconId: string | undefined, size = 14, className = 'text-white', colorOverride?: string) {
  if (!iconId) return null;
  const custom = cachedCustomIcons.find((c) => c.id === iconId);
  if (custom) {
    if (custom.svgContent) {
      const scale = custom.scale ?? 1;
      const ox = custom.offsetX ?? 0;
      const oy = custom.offsetY ?? 0;
      const scaledSize = Math.round(size * scale);
      let svg = custom.svgContent
        .replace(/\s+width="[^"]*"/, '')
        .replace(/\s+height="[^"]*"/, '')
        .replace('<svg', `<svg width="${scaledSize}" height="${scaledSize}"`);
      if (colorOverride) {
        svg = svg
          .replace(/stroke="(?!none)[^"]*"/g, `stroke="${colorOverride}"`)
          .replace(/fill="(?!none)[^"]*"/g, `fill="${colorOverride}"`);
        if (!/stroke=/.test(svg) && !/fill=/.test(svg)) {
          svg = svg.replace('<svg', `<svg stroke="${colorOverride}" fill="${colorOverride}"`);
        }
      }
      const oxScaled = ox * (scaledSize / 24);
      const oyScaled = oy * (scaledSize / 24);
      return (
        <span
          style={{ width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible', position: 'relative' }}
        >
          <span
            style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(calc(-50% + ${oxScaled}px), calc(-50% + ${oyScaled}px))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'visible' }}
            dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
          />
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center justify-center font-extrabold leading-none"
        style={{ width: size, height: size, fontSize: size * 0.7, color: colorOverride ?? 'inherit', flexShrink: 0 }}
      >
        {custom.letter}
      </span>
    );
  }
  const def = getFloorplanIcon(iconId);
  if (!def) return null;
  const { Icon } = def;
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, overflow: 'visible', color: colorOverride }}>
      <Icon className={colorOverride ? undefined : className} width={size} height={size} strokeWidth={2.5} style={{ display: 'block', flexShrink: 0, color: colorOverride }} />
    </span>
  );
}

const ICON_SVG_PATHS: Record<string, string> = {
  'lightbulb': 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5 M9 18h6 M10 22h4',
  'sun': 'M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M6.34 17.66l-1.41 1.41 M19.07 4.93l-1.41 1.41 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  'lamp': 'M8 2h8l4 10H4L8 2Z M12 12v6 M8 22v-4h8v4',
  'lamp-ceiling': 'M12 2v4 M10 6h4 M8 6l-2 8h12l-2-8',
  'lamp-desk': 'M14.5 2H9.5a2 2 0 0 0-2 2v4h9V4a2 2 0 0 0-2-2Z M7.5 8l-1 8 M16.5 8l1 8 M6.5 16h11 M12 16v6',
  'lamp-floor': 'M9 2h6l3 7H6l3-7z M12 9v13 M9 22h6',
  'lamp-wall-down': 'M11 4h6 M11 4v8h6l2-8 M11 12h6',
  'lamp-wall-up': 'M11 20h6 M11 20v-8h6l2 8 M11 12h6',
  'plug': 'M12 22v-5 M9 8V2 M15 8V2 M18 8v5a6 6 0 0 1-12 0V8Z',
  'zap': 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  'power': 'M12 2v10 M18.4 6.6a9 9 0 1 1-12.77.04',
  'battery': 'M7 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-3 M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2 M7 7h10',
  'circuit': 'M12 2v4 M8 6h8 M6 10H4 M6 14H4 M20 10h-2 M20 14h-2 M6 10v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2z M9 14h.01 M12 14h.01 M15 14h.01',
  'usb': 'M12 22V8 M6 12v-1.5A1.5 1.5 0 0 1 7.5 9H12 M18 12v-1.5a1.5 1.5 0 0 0-1.5-1.5H12 M6 15a3 3 0 1 0 0-6 M18 15a3 3 0 1 1 0-6 M12 8V2',
  'toggle': 'M16 6H8a6 6 0 0 0 0 12h8a6 6 0 0 0 0-12Z M8 12h.01',
  'thermostat': 'M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z',
  'timer': 'M10 2h4 M12 14l3-3 M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  'clock': 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2',
  'blinds': 'M3 3h18 M3 8h18 M3 13h18 M3 18h18 M3 3v18 M21 3v18',
  'monitor': 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z M8 21h8 M12 15v6',
  'eye': 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'flame': 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  'alarm-smoke': 'M12 20h.01 M8 12a4 4 0 0 1 8 0 M12 2v4 M4.93 10.93 2 8 M2 12h2 M19.07 10.93 22 8 M22 12h-2',
  'droplets': 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z M17 18.5c1.46 0 2.66-1.22 2.66-2.7s-1.2-2.7-2.66-2.7-2.66 1.22-2.66 2.7 1.2 2.7 2.66 2.7z',
  'thermo-sun': 'M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 3v2 M12 19v2 M18.4 5.6l-1.4 1.4 M7 17l-1.4 1.4 M21 12h-2 M5 12H3 M18.4 18.4l-1.4-1.4 M7 7 5.6 5.6',
  'thermo-frost': 'M2 12h20 M12 2v20 M20 16l-4-4 4-4 M4 8l4 4-4 4 M16 4l-4 4-4-4 M8 20l4-4 4 4',
  'gauge': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  'wifi': 'M5 12.55a11 11 0 0 1 14.08 0 M1.42 9a16 16 0 0 1 21.16 0 M8.53 16.11a6 6 0 0 1 6.95 0 M12 20h.01',
  'speaker': 'M6 9H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2l6 5V4L6 9Z M15.54 8.46a5 5 0 0 1 0 7.07 M19.07 4.93a10 10 0 0 1 0 14.14',
  'audio': 'M2 10v4 M6 6v12 M10 2v20 M14 6v12 M18 10v4 M22 8v8',
  'tv': 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z M17 21H7',
  'radio': 'M4.9 19.1C1 15.2 1 8.8 4.9 4.9 M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5 M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5 M19.1 4.9C23 8.8 23 15.1 19.1 19 M12 12h.01',
  'antenna': 'M12 5v17 M5 12h14',
  'satellite': 'M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M4.9 4.9l2.8 2.8 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83 M19.07 19.07l-2.83-2.83 M2 12h4 M18 12h4 M12 18v4 M12 2v4',
  'router': 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z M18 12h.01 M8 12h.01 M12 12h.01',
  'server': 'M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4z M2 14a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4z M6 6h.01 M6 16h.01',
  'shower': 'M4 4a2 2 0 1 0 4 0 2 2 0 0 0-4 0 M5 8v14 M5 10h9a3 3 0 0 1 3 3v7 M10 16l-4 4 M15 16l4 4',
  'bath': 'M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z M6 12V5a2 2 0 0 1 2-2h3v2.25',
  'glass-water': 'M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.104l-1.774 16A1 1 0 0 1 16.117 21H7.883a1 1 0 0 1-.993-.896l-1.774-16z M6.824 14h10.352',
  'droplets-water': 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z M17 18.5c1.46 0 2.66-1.22 2.66-2.7s-1.2-2.7-2.66-2.7-2.66 1.22-2.66 2.7 1.2 2.7 2.66 2.7z',
  'heater': 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M7 5v14 M11 5v14 M15 5v14 M19 5v14',
  'thermo-heat': 'M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z',
  'flame-heat': 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  'air-vent': 'M6 12H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2 M6 8h12 M10.3 20A6.5 6.5 0 0 1 6 12h12a6.5 6.5 0 0 1-4.3 8',
  'wind': 'M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2 M9.6 4.6A2 2 0 1 1 11 8H2 M12.6 19.4A2 2 0 1 0 14 16H2',
  'fan': 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M12 3c2.2 0 4 3 4 6-.7 1-2.2 2-4 2s-3.3-1-4-2c0-3 1.8-6 4-6z M12 21c-2.2 0-4-3-4-6 .7-1 2.2-2 4-2s3.3 1 4 2c0 3-1.8 6-4 6z M3 12c0-2.2 3-4 6-4 1 .7 2 2.2 2 4s-1 3.3-2 4c-3 0-6-1.8-6-4z M21 12c0 2.2-3 4-6 4-1-.7-2-2.2-2-4s1-3.3 2-4c3 0 6 1.8 6 4z',
  'camera': 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  'siren': 'M12 2v2 M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.93 4.93l1.41 1.41 M19.07 4.93l-1.41 1.41 M2 12h2 M20 12h2 M19 22H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1z',
  'shield-check': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  'shield-alert': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4 M12 16h.01',
  'alarm-check': 'M12 5a7 7 0 1 0 7 7 M22 2 L11 13 M22 2l-4.5 4.5 M8.5 8.5 11 11',
  'lock': 'M5 11a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7z M12 15v2 M8 9V6a4 4 0 0 1 8 0v3',
  'door-closed': 'M3 21h18 M18 21V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v17 M15 12h.01',
  'door-open': 'M13 4h3a2 2 0 0 1 2 2v14 M2 20h3 M13 20h9 M10 12v.01 M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561z',
  'bell': 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
  'dot': 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
};

export function renderPinIconSvgPath(iconId: string | undefined): string | null {
  if (!iconId) return null;
  return ICON_SVG_PATHS[iconId] ?? null;
}

export function getCustomIconLetter(iconId: string | undefined): string | null {
  if (!iconId) return null;
  const custom = cachedCustomIcons.find((c) => c.id === iconId);
  return custom?.letter ?? null;
}

export function useCustomIcons() {
  const [icons, setIcons] = useState<CustomIconData[]>(cachedCustomIcons);
  const version = useRef(0);

  const refresh = useCallback(() => {
    cachedCustomIcons = loadCustomIcons();
    setIcons([...cachedCustomIcons]);
    version.current++;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback((icon: CustomIconData) => {
    addCustomIcon(icon);
    setIcons([...cachedCustomIcons]);
  }, []);

  const remove = useCallback((id: string) => {
    removeCustomIcon(id);
    setIcons([...cachedCustomIcons]);
  }, []);

  return { icons, add, remove, refresh };
}
