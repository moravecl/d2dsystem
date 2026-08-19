import type { CameraModel } from '../hooks/useCameraCatalog';
import type { StorageConfig, PlacedCamera } from '../hooks/useCameraDesign';

const BITRATE_MAP: Record<string, Record<string, number>> = {
  h264:   { '4K': 12, '2K': 6, '1440p': 5, '1080p': 4, '720p': 2 },
  h265:   { '4K': 8,  '2K': 4, '1440p': 3.5, '1080p': 2.5, '720p': 1.5 },
  'h265+': { '4K': 5,  '2K': 2.5, '1440p': 2, '1080p': 1.5, '720p': 1 },
};

export function getBitrateMbps(resolutionLabel: string, codec: StorageConfig['codec']): number {
  const map = BITRATE_MAP[codec] ?? BITRATE_MAP.h265;
  return map[resolutionLabel] ?? map['1080p'] ?? 2.5;
}

export interface StorageCalcResult {
  totalBitrateGbPerHour: number;
  dailyStorageGb: number;
  totalStorageGb: number;
  totalStorageTb: number;
  recommendedHddCount: number;
  recommendedHddSizeTb: number;
  perCameraDailyGb: number[];
}

export function calculateStorage(
  placedCameras: PlacedCamera[],
  cameraModels: CameraModel[],
  config: StorageConfig
): StorageCalcResult {
  const perCameraDailyGb: number[] = [];
  let totalBitrateMbps = 0;

  for (const placed of placedCameras) {
    const model = cameraModels.find(m => m.id === placed.modelId);
    if (!model) { perCameraDailyGb.push(0); continue; }

    const bitrate = getBitrateMbps(model.resolution_label, config.codec);
    const effectiveBitrate = bitrate * (1 - (config.motionOnlyPct / 100) * 0.6);
    totalBitrateMbps += effectiveBitrate;

    const dailyGb = (effectiveBitrate * 3600 * config.recordingHoursPerDay) / 8 / 1024;
    perCameraDailyGb.push(Math.round(dailyGb * 100) / 100);
  }

  const totalBitrateGbPerHour = (totalBitrateMbps * 3600) / 8 / 1024;
  const dailyStorageGb = totalBitrateGbPerHour * config.recordingHoursPerDay;
  const totalStorageGb = dailyStorageGb * config.retentionDays;
  const totalStorageTb = totalStorageGb / 1024;

  const hddSizes = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  let recommendedHddSizeTb = 4;
  let recommendedHddCount = 1;

  for (const size of hddSizes) {
    if (size >= totalStorageTb) {
      recommendedHddSizeTb = size;
      recommendedHddCount = 1;
      break;
    }
    if (size === hddSizes[hddSizes.length - 1]) {
      recommendedHddSizeTb = size;
      recommendedHddCount = Math.ceil(totalStorageTb / size);
    }
  }

  return {
    totalBitrateGbPerHour: Math.round(totalBitrateGbPerHour * 100) / 100,
    dailyStorageGb: Math.round(dailyStorageGb * 100) / 100,
    totalStorageGb: Math.round(totalStorageGb * 100) / 100,
    totalStorageTb: Math.round(totalStorageTb * 100) / 100,
    recommendedHddCount,
    recommendedHddSizeTb,
    perCameraDailyGb,
  };
}

export function calcTotalPoePowerW(
  placedCameras: PlacedCamera[],
  cameraModels: CameraModel[]
): number {
  return placedCameras.reduce((sum, cam) => {
    const model = cameraModels.find(m => m.id === cam.modelId);
    return sum + (model?.power_w ?? 15);
  }, 0);
}
