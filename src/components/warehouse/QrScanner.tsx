import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, SwitchCamera, X } from 'lucide-react';

interface QrScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  isActive: boolean;
}

export default function QrScanner({ onScan, onClose, isActive }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isStartingRef = useRef(false);

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const backCameraIdx = devices.findIndex(
            (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')
          );
          setCameras(devices);
          setCurrentCameraIdx(backCameraIdx >= 0 ? backCameraIdx : 0);
        } else {
          setError('Nebyly nalezeny zadne kamery');
        }
      })
      .catch(() => {
        setError('Nelze pristoupit ke kamere. Povolte pristup v nastaveni prohlizece.');
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive || cameras.length === 0 || isStartingRef.current) return;

    const startScanner = async () => {
      isStartingRef.current = true;
      setError(null);

      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {}
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      try {
        await scanner.start(
          cameras[currentCameraIdx].id,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            onScan(decodedText);
          },
          () => {}
        );
      } catch (err) {
        setError('Nelze spustit kameru. Zkontrolujte opravneni.');
      } finally {
        isStartingRef.current = false;
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isActive, cameras, currentCameraIdx, onScan]);

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    const nextIdx = (currentCameraIdx + 1) % cameras.length;
    setCurrentCameraIdx(nextIdx);
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="text-white font-bold text-lg">QR Scanner</h2>
        <div className="flex items-center gap-2">
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 transition"
            >
              <SwitchCamera className="w-5 h-5 text-white" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 transition"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center" ref={containerRef}>
        {error ? (
          <div className="text-center p-6">
            <CameraOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition"
            >
              Zavřít
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-md aspect-square">
            <div id="qr-reader" className="w-full h-full" />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
          <Camera className="w-4 h-4" />
          <span>Namíříte kameru na QR kód</span>
        </div>
      </div>
    </div>
  );
}
