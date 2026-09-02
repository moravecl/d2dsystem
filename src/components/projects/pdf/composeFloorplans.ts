/**
 * Slozeni pudorysu pro nativni PDF: bitmapa planu + overlay SVG (mistnosti,
 * kabely, piny...) se vykresli do canvasu a vrati jako JPEG data URL.
 * Overlay se peče do obrazku, protoze @react-pdf/renderer neumi vlozit
 * libovolny SVG markup (napr. vlastni symboly produktu z databaze).
 */

export interface ComposedPlan {
  dataUrl: string;
  /** sirka / vyska */
  aspect: number;
}

const TARGET_WIDTH = 2000;
const JPEG_QUALITY = 0.87;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Obrázek půdorysu se nepodařilo načíst: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

/**
 * Bitmapu nacitame pres fetch -> blob URL, aby canvas nebyl "tainted" u
 * obrazku ze storage (CORS); data URL projdou beze zmeny.
 */
async function loadPlanBitmap(src: string): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return { img: await loadImage(src), revoke: () => {} };
  }
  const resp = await fetch(src);
  if (!resp.ok) throw new Error(`Obrázek půdorysu se nepodařilo stáhnout (HTTP ${resp.status})`);
  const url = URL.createObjectURL(await resp.blob());
  try {
    return { img: await loadImage(url), revoke: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export async function composeFloorplan(planImgSrc: string, overlaySvgContent: string): Promise<ComposedPlan> {
  const { img, revoke } = await loadPlanBitmap(planImgSrc);
  try {
    const natW = img.naturalWidth || 1000;
    const natH = img.naturalHeight || 1000;
    const w = Math.min(TARGET_WIDTH, Math.max(800, natW));
    const h = Math.round(w * (natH / natW));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas není k dispozici');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1 1" preserveAspectRatio="none">${overlaySvgContent}</svg>`;
    const svgUrl = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const overlay = await loadImage(svgUrl);
      ctx.drawImage(overlay, 0, 0, w, h);
    } finally {
      URL.revokeObjectURL(svgUrl);
    }

    return { dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), aspect: w / h };
  } finally {
    revoke();
  }
}
