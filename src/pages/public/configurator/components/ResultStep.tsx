import { useState, useEffect } from 'react';
import { CheckCircle2, Mail, Phone, Download, FileText, Check, Zap, Shield, Sparkles, Flame, Wind, Sun, Cpu, Droplets, Eye, Clock, FileCheck, Ruler, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import type { StepProps } from '../types';
import type { SubsidySetting } from '../types';
import { calculateEstimate } from '../priceCalculator';

interface ResultStepProps extends StepProps {
  subsidies?: SubsidySetting[];
  emailSent?: boolean | null;
  onRetryEmail?: () => void;
  showResultPrices?: boolean;
}

const SECTION_ICONS: Record<string, any> = {
  'Vytápění': Flame,
  'Vzduchotechnika': Wind,
  'Fotovoltaika': Sun,
  'Elektroinstalace': Zap,
  'Smart Home': Cpu,
  'Voda a odpady': Droplets,
  'Zabezpečení': Shield,
};

const SECTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Vytápění': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  'Vzduchotechnika': { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
  'Fotovoltaika': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  'Elektroinstalace': { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
  'Smart Home': { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' },
  'Voda a odpady': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  'Zabezpečení': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

const PAGE1_SECTIONS = ['Vytápění', 'Vzduchotechnika', 'Fotovoltaika', 'Elektroinstalace'];
const PAGE2_SECTIONS = ['Smart Home', 'Voda a odpady', 'Zabezpečení'];

function SectionCard({ detail, showPrice }: { detail: any; showPrice: boolean }) {
  const IconComponent = SECTION_ICONS[detail.label] || Zap;
  const colors = SECTION_COLORS[detail.label] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };

  return (
    <div className={`rounded-xl overflow-hidden border ${colors.border}`}>
      <div className={`flex items-center justify-between ${colors.bg} px-5 py-4`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white/70 ${colors.text}`}>
            <IconComponent size={20} />
          </div>
          <h3 className="font-bold text-lg text-slate-900">{detail.label}</h3>
        </div>
        {showPrice && (
          <div className={`font-bold text-xl ${colors.text}`}>
            {detail.price.toLocaleString('cs-CZ')} Kč
          </div>
        )}
      </div>
      <div className="px-5 py-4 bg-white">
        <ul className="grid sm:grid-cols-2 gap-2">
          {detail.items.map((item: string, itemIdx: number) => (
            <li key={itemIdx} className="flex items-start gap-2 text-sm text-slate-700">
              <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PdfHeader({ data, estimate, logoSrc }: { data: any; estimate: any; logoSrc?: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/8 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <img src={logoSrc || '/housesmartlogo.png'} alt="HouseSmart" className="h-10 mb-2 brightness-0 invert" />
          <div className="text-sm text-slate-300">Komplexní TZB řešení pro rodinné domy</div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>Klient: {data.clientName}</span>
            <span>{data.area} m² | {data.floors === '1' ? 'Bungalov' : 'Patrový dům'}</span>
            {data.clientRegion && <span>{data.clientRegion}</span>}
            <span>{new Date().toLocaleDateString('cs-CZ')}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs opacity-70 uppercase tracking-wider mb-1">Investiční odhad</div>
          <div className="text-4xl font-bold tracking-tight">
            {estimate.total.toLocaleString('cs-CZ')} Kč
          </div>
          <div className="text-xs opacity-60">bez DPH</div>
        </div>
      </div>
    </div>
  );
}

function PdfPageFooter({ pageNum, totalPages }: { pageNum: number; totalPages: number }) {
  return (
    <div className="flex items-center justify-between px-8 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
      <span>HouseSmart - Komplexní TZB řešení</span>
      <span>Strana {pageNum} / {totalPages}</span>
    </div>
  );
}

function useLogoDataUrl() {
  const [logoDataUrl, setLogoDataUrl] = useState<string>('/housesmartlogo.png');
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoDataUrl(canvas.toDataURL('image/png'));
      }
    };
    img.src = '/housesmartlogo.png';
  }, []);
  return logoDataUrl;
}

export default function ResultStep({ data, prices, subsidies, emailSent, onRetryEmail, showResultPrices = true }: ResultStepProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const aiIntroText = '';
  const isLoadingAI = false;
  const logoDataUrl = useLogoDataUrl();

  if (!prices) {
    return (
      <div className="text-center py-20">
        <div className="animate-pulse">
          <div className="text-xl text-slate-600">Načítám ceny...</div>
        </div>
      </div>
    );
  }

  const estimate = calculateEstimate(data, prices, subsidies);
  const page1Details = estimate.details.filter((d: any) => PAGE1_SECTIONS.includes(d.label));
  const page2Details = estimate.details.filter((d: any) => PAGE2_SECTIONS.includes(d.label));

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      const pages = ['pdf-page-1', 'pdf-page-2', 'pdf-page-3']
        .map((id) => document.getElementById(id)?.innerHTML ?? '')
        .filter(Boolean)
        .map((inner) => `<div class="page">${inner}</div>`)
        .join('');
      const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8">
<title>HouseSmart nabídka — ${data.clientName.replace(/</g, '&lt;')}</title>
<script src="https://cdn.tailwindcss.com"><` + `/script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;900&display=swap');
  body { font-family: 'Inter', sans-serif; margin: 0; background: white; }
  .page { width: 794px; margin: 0 auto; page-break-after: always; }
  @media print { @page { size: A4; margin: 0; } }
</style></head><body>${pages}
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 900); });<` + `/script>
</body></html>`;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Nepodařilo se vygenerovat PDF. Zkuste to prosím znovu.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="animate-in pb-20">
      <div className="text-center mb-8">
        <div className="inline-block p-4 rounded-full bg-green-100 text-green-600 mb-4 shadow-sm">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900">Vaše konfigurace je připravena!</h2>
        <p className="text-slate-600 mt-2">
          Poptávka byla uložena. Náš tým se Vám ozve co nejdříve.
        </p>
      </div>

      {emailSent === false && (
        <div className="max-w-4xl mx-auto mb-6 bg-amber-50 border border-amber-300 rounded-xl p-5 flex items-start gap-4">
          <AlertTriangle size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-amber-900 mb-1">E-mail se nepodařilo odeslat</h4>
            <p className="text-sm text-amber-800">
              Vaše konfigurace byla uložena, ale notifikační e-mail se nepodařilo doručit.
              Nemusíte se obávat -- vaše data jsou v bezpečí a náš tým se k nim dostane.
            </p>
            {onRetryEmail && (
              <button
                onClick={onRetryEmail}
                className="mt-3 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                <RefreshCw size={16} />
                Zkusit znovu odeslat
              </button>
            )}
          </div>
        </div>
      )}

      {emailSent === null && (
        <div className="max-w-4xl mx-auto mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
          <Loader2 size={24} className="text-blue-600 animate-spin flex-shrink-0" />
          <p className="text-sm text-blue-800 font-medium">Odesílám notifikační e-mail...</p>
        </div>
      )}

      {/* === WEB VIEW (visible on screen) === */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 max-w-4xl mx-auto mb-8">
        <PdfHeader data={data} estimate={estimate} />

        <div className="p-6 md:p-8">
          {isLoadingAI ? (
            <div className="bg-gradient-to-r from-blue-50 to-sky-50 p-6 rounded-xl border border-blue-200 mb-8 animate-pulse">
              <div className="h-4 bg-blue-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-blue-200 rounded w-full mb-3"></div>
              <div className="h-4 bg-blue-200 rounded w-5/6"></div>
            </div>
          ) : aiIntroText && (
            <div className="bg-gradient-to-r from-blue-50 to-sky-50 p-6 rounded-xl border border-blue-200 mb-8">
              <div className="flex items-start gap-3 mb-3">
                <Sparkles size={24} className="text-blue-600 flex-shrink-0" />
                <h4 className="font-bold text-lg text-slate-900">Vaše řešení na míru</h4>
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">{aiIntroText}</p>
            </div>
          )}

          <div className="space-y-4 mb-8">
            <h4 className="font-bold text-xl text-slate-900 mb-2">Detailní rozpis nabídky</h4>
            {estimate.details.map((detail: any, idx: number) => (
              <SectionCard key={idx} detail={detail} showPrice={showResultPrices} />
            ))}
          </div>

          <div className="mt-8 pt-6 border-t-2 border-slate-200">
            <div className="flex justify-between items-center mb-2 text-base">
              <span className="text-slate-600">Cena bez DPH</span>
              <span className="font-bold text-lg">{estimate.total.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div className="flex justify-between items-center mb-6 text-base">
              <span className="text-slate-600">DPH (12% - Stavba pro bydlení)</span>
              <span className="font-bold">{Math.round(estimate.total * 0.12).toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div className="flex justify-between items-center text-2xl font-black text-slate-900 bg-gradient-to-r from-slate-50 to-blue-50 p-6 rounded-xl border-2 border-blue-200">
              <span>Celkem s DPH</span>
              <span className="text-blue-600">{Math.round(estimate.totalWithVat).toLocaleString('cs-CZ')} Kč</span>
            </div>
          </div>

          <div className="mt-10">
            <div className="text-center mb-8">
              <h4 className="text-2xl font-extrabold text-slate-900 mb-2">
                Proč stavět s jedním dodavatelem?
              </h4>
              <p className="text-slate-500 max-w-2xl mx-auto">
                Koordinovat 5-6 firem na stavbě je jako řídit orchestr bez dirigenta.
                S HouseSmart máte jednoho partnera pro všechny TZB profese.
              </p>
            </div>
            <WhyOneSupplier />
          </div>

          <ImportantInfo />
        </div>
      </div>

      {/* === PDF PAGES (hidden, rendered offscreen for capture) === */}
      <div className="fixed left-[-9999px] top-0" aria-hidden="true">
        {/* PAGE 1: Header + AI + sections through Elektroinstalace */}
        <div id="pdf-page-1" className="bg-white w-[794px]">
          <PdfHeader data={data} estimate={estimate} logoSrc={logoDataUrl} />
          <div className="p-8">
            {aiIntroText && (
              <div className="bg-gradient-to-r from-blue-50 to-sky-50 p-5 rounded-xl border border-blue-200 mb-6">
                <div className="flex items-start gap-3 mb-2">
                  <Sparkles size={20} className="text-blue-600 flex-shrink-0" />
                  <h4 className="font-bold text-base text-slate-900">Vaše řešení na míru</h4>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{aiIntroText}</p>
              </div>
            )}
            <h4 className="font-bold text-lg text-slate-900 mb-3">Detailní rozpis nabídky</h4>
            <div className="space-y-3">
              {page1Details.map((detail: any, idx: number) => (
                <SectionCard key={idx} detail={detail} showPrice={true} />
              ))}
            </div>
          </div>
          <PdfPageFooter pageNum={1} totalPages={3} />
        </div>

        {/* PAGE 2: Smart Home + Water + Security + Price Summary */}
        <div id="pdf-page-2" className="bg-white w-[794px]">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-4 flex items-center justify-between">
            <img src={logoDataUrl} alt="HouseSmart" className="h-7 brightness-0 invert" />
            <div className="text-white text-sm opacity-70">{data.clientName} | {new Date().toLocaleDateString('cs-CZ')}</div>
          </div>
          <div className="p-8">
            <div className="space-y-3 mb-6">
              {page2Details.map((detail: any, idx: number) => (
                <SectionCard key={idx} detail={detail} showPrice={true} />
              ))}
            </div>

            <div className="pt-5 border-t-2 border-slate-200 mb-6">
              <div className="flex justify-between items-center mb-2 text-base">
                <span className="text-slate-600">Cena bez DPH</span>
                <span className="font-bold text-lg">{estimate.total.toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div className="flex justify-between items-center mb-4 text-base">
                <span className="text-slate-600">DPH (12% - Stavba pro bydlení)</span>
                <span className="font-bold">{Math.round(estimate.total * 0.12).toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div className="flex justify-between items-center text-2xl font-black text-slate-900 bg-gradient-to-r from-slate-50 to-blue-50 p-5 rounded-xl border-2 border-blue-200">
                <span>Celkem s DPH</span>
                <span className="text-blue-600">{Math.round(estimate.totalWithVat).toLocaleString('cs-CZ')} Kč</span>
              </div>
            </div>

            <div className="text-center mb-4">
              <h4 className="text-lg font-extrabold text-slate-900 mb-1">
                Proč stavět s jedním dodavatelem?
              </h4>
              <p className="text-slate-500 text-xs max-w-xl mx-auto">
                Koordinovat 5-6 firem na stavbě je jako řídit orchestr bez dirigenta.
                S HouseSmart máte jednoho partnera pro všechny TZB profese.
              </p>
            </div>
            <div className="space-y-2">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="bg-green-100 p-1.5 rounded-lg flex-shrink-0">
                    <Shield size={16} className="text-green-700" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 mb-0.5">Konec "přehazování viny" -- jedna záruka</h5>
                    <p className="text-[11px] text-slate-700 leading-snug">
                      Pokud máte více firem (topenář, elektrikář, vzduchotechnik), při problému se často vymlouvají
                      jeden na druhého. S jedním dodavatelem máte jedno telefonní číslo a jednu ucelenou záruku.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-lg border border-blue-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="bg-blue-100 p-1.5 rounded-lg flex-shrink-0">
                    <Cpu size={16} className="text-blue-700" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 mb-0.5">Perfektní součinnost technologií (MaR)</h5>
                    <p className="text-[11px] text-slate-700 leading-snug">
                      Moderní systémy -- tepelné čerpadlo, rekuperace, fotovoltaika, žaluzie -- spolu musí komunikovat.
                      Jeden dodavatel zajistí, aby systémy nešly proti sobě a aby vše řídil jeden centrální mozek.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="bg-amber-100 p-1.5 rounded-lg flex-shrink-0">
                    <Ruler size={16} className="text-amber-700" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 mb-0.5">Prostorová koordinace a méně kolizí</h5>
                    <p className="text-[11px] text-slate-700 leading-snug">
                      V technické místnosti nebo v podhledech je málo místa. Jedna firma si interně pohlídá,
                      aby si jednotlivé profese "nelezly do zelí".
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <PdfPageFooter pageNum={2} totalPages={3} />
        </div>

        {/* PAGE 3: Why one supplier continued + Important info */}
        <div id="pdf-page-3" className="bg-white w-[794px]">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-4 flex items-center justify-between">
            <img src={logoDataUrl} alt="HouseSmart" className="h-7 brightness-0 invert" />
            <div className="text-white text-sm opacity-70">{data.clientName} | {new Date().toLocaleDateString('cs-CZ')}</div>
          </div>
          <div className="p-8">
            <div className="space-y-2 mb-6">
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg border border-teal-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="bg-teal-100 p-1.5 rounded-lg flex-shrink-0">
                    <Clock size={16} className="text-teal-700" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 mb-0.5">Úspora času a méně administrativy</h5>
                    <p className="text-[11px] text-slate-700 leading-snug">
                      Místo abyste vy (nebo stavbyvedoucí) ladili harmonogramy 5 různých part a hlídali,
                      kdy kdo nastoupí -- máte jednoho projektového manažera, jednu smlouvu a jeden
                      harmonogram. Koordinace návazností profesí jde za námi, ne za vámi.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-rose-50 to-red-50 rounded-lg border border-rose-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="bg-rose-100 p-1.5 rounded-lg flex-shrink-0">
                    <FileCheck size={16} className="text-rose-700" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 mb-0.5">Předvídatelná cena a méně víceprací</h5>
                    <p className="text-[11px] text-slate-700 leading-snug">
                      U více firem často vznikají vícenáklady kvůli chybám v komunikaci (např. elektrikář
                      nenatáhne správný kabel pro čerpadlo, protože o něm nevěděl). Jeden dodavatel si tyto
                      návaznosti hlídá. Pokud uděláme chybu v koordinaci, je to náš náklad, nikoliv váš.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                <Eye size={18} />
                Důležité informace:
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">-</span>
                  <span>Ceny jsou orientační a mohou se lišit podle konkrétních podmínek stavby a dostupnosti materiálu</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">-</span>
                  <span>Zahrnuje kvalitní materiál značkových výrobců, odbornou práci certifikovaných techniků a montáž</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">-</span>
                  <span>Přesná nabídka bude vytvořena po osobním zaměření a prostudování projektové dokumentace</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">-</span>
                  <span>Na všechny práce poskytujeme standardní záruku 24 měsíců, na vybraná zařízení až 5 let</span>
                </li>
              </ul>
            </div>
          </div>
          <PdfPageFooter pageNum={3} totalPages={3} />
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-4 px-8 rounded-lg flex items-center gap-2 shadow-lg transition-all"
        >
          {isGeneratingPdf ? (
            <>
              <FileText size={20} className="animate-pulse" />
              Generuji PDF...
            </>
          ) : (
            <>
              <Download size={20} />
              Stáhnout nabídku jako PDF
            </>
          )}
        </button>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
          <h3 className="font-bold text-lg text-blue-900 mb-3 flex items-center gap-2">
            <Mail size={20} />
            Co se děje dál?
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <span>Váš obchodní zástupce obdržel detailní poptávku s kompletní konfigurací</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                Kontaktujeme Vás do 5 pracovních dnů na emailu <strong>{data.clientEmail}</strong>
                {data.clientPhone && (
                  <>
                    {' '}
                    nebo telefonu <strong>{data.clientPhone}</strong>
                  </>
                )}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <span>Domluvíme si schůzku nebo online konzultaci</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <span>Připravíme přesnou nabídku na míru podle projektové dokumentace</span>
            </li>
          </ul>
        </div>

        <div className="text-center bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="font-bold text-lg mb-2">Máte dotazy?</h3>
          <p className="text-sm text-slate-600 mb-4">Neváhejte nás kontaktovat</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:obchod@housesmart.cz"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg transition-colors"
            >
              <Mail size={18} />
              obchod@housesmart.cz
            </a>
            <a
              href="tel:+420734815329"
              className="inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-6 py-3 rounded-lg transition-colors"
            >
              <Phone size={18} />
              +420 734 815 329
            </a>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = window.location.origin + window.location.pathname;
            }}
            className="text-blue-600 hover:text-blue-800 text-sm font-bold underline"
          >
            Vytvořit novou konfiguraci
          </button>
        </div>
      </div>
    </div>
  );
}

function WhyOneSupplier({ compact = false }: { compact?: boolean }) {
  const cardClass = compact ? "space-y-3" : "space-y-4";
  const itemPadding = compact ? "p-4" : "p-6";
  const iconSize = compact ? 20 : 24;
  const textSize = compact ? "text-sm" : "text-base";
  const bodyTextSize = compact ? "text-xs" : "text-sm";

  return (
    <div className={cardClass}>
      <div className={`bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 ${itemPadding}`}>
        <div className="flex items-start gap-3">
          <div className={`bg-green-100 ${compact ? 'p-2' : 'p-3'} rounded-xl flex-shrink-0`}>
            <Shield size={iconSize} className="text-green-700" />
          </div>
          <div>
            <h5 className={`font-bold ${textSize} text-slate-900 mb-1`}>Konec "přehazování viny" -- jedna záruka</h5>
            <p className={`${bodyTextSize} text-slate-700 leading-relaxed`}>
              Pokud máte více firem (topenář, elektrikář, vzduchotechnik), při problému se často vymlouvají
              jeden na druhého. S jedním dodavatelem máte <strong>jedno telefonní číslo a jednu ucelenou záruku</strong>.
              Když něco nefunguje, je to problém dodavatele, ne váš. Žádná hra na "horký brambor".
            </p>
          </div>
        </div>
      </div>

      <div className={`bg-gradient-to-r from-blue-50 to-sky-50 rounded-xl border border-blue-200 ${itemPadding}`}>
        <div className="flex items-start gap-3">
          <div className={`bg-blue-100 ${compact ? 'p-2' : 'p-3'} rounded-xl flex-shrink-0`}>
            <Cpu size={iconSize} className="text-blue-700" />
          </div>
          <div>
            <h5 className={`font-bold ${textSize} text-slate-900 mb-1`}>Perfektní součinnost technologií (MaR)</h5>
            <p className={`${bodyTextSize} text-slate-700 leading-relaxed`}>
              Moderní systémy -- tepelné čerpadlo, rekuperace, fotovoltaika, žaluzie -- spolu musí komunikovat.
              Jeden dodavatel zajistí, aby systémy <strong>nešly proti sobě</strong> (např. aby klimatizace nechladila
              ve stejnou chvíli, kdy topení topí) a aby vše řídil jeden centrální mozek.
            </p>
          </div>
        </div>
      </div>

      <div className={`bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 ${itemPadding}`}>
        <div className="flex items-start gap-3">
          <div className={`bg-amber-100 ${compact ? 'p-2' : 'p-3'} rounded-xl flex-shrink-0`}>
            <Ruler size={iconSize} className="text-amber-700" />
          </div>
          <div>
            <h5 className={`font-bold ${textSize} text-slate-900 mb-1`}>Prostorová koordinace a méně kolizí</h5>
            <p className={`${bodyTextSize} text-slate-700 leading-relaxed`}>
              V technické místnosti nebo v podhledech je málo místa. Jedna firma si interně pohlídá,
              aby si jednotlivé profese <strong>"nelezly do zelí"</strong>. Nestane se, že vzduchotechnik zabere místo,
              kudy měl vést hlavní rozvaděč -- koordinace probíhá už v projektu.
            </p>
          </div>
        </div>
      </div>

      <div className={`bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200 ${itemPadding}`}>
        <div className="flex items-start gap-3">
          <div className={`bg-teal-100 ${compact ? 'p-2' : 'p-3'} rounded-xl flex-shrink-0`}>
            <Clock size={iconSize} className="text-teal-700" />
          </div>
          <div>
            <h5 className={`font-bold ${textSize} text-slate-900 mb-1`}>Úspora času a méně administrativy</h5>
            <p className={`${bodyTextSize} text-slate-700 leading-relaxed`}>
              Místo abyste vy (nebo stavbyvedoucí) ladili harmonogramy 5 různých part a hlídali,
              kdy kdo nastoupí -- máte <strong>jednoho projektového manažera, jednu smlouvu a jeden
              harmonogram</strong>. Koordinace návazností profesí jde za námi, ne za vámi.
            </p>
          </div>
        </div>
      </div>

      <div className={`bg-gradient-to-r from-rose-50 to-red-50 rounded-xl border border-rose-200 ${itemPadding}`}>
        <div className="flex items-start gap-3">
          <div className={`bg-rose-100 ${compact ? 'p-2' : 'p-3'} rounded-xl flex-shrink-0`}>
            <FileCheck size={iconSize} className="text-rose-700" />
          </div>
          <div>
            <h5 className={`font-bold ${textSize} text-slate-900 mb-1`}>Předvídatelná cena a méně víceprací</h5>
            <p className={`${bodyTextSize} text-slate-700 leading-relaxed`}>
              U více firem často vznikají vícenáklady kvůli chybám v komunikaci (např. elektrikář
              nenatáhne správný kabel pro čerpadlo, protože o něm nevěděl). Jeden dodavatel si tyto
              návaznosti hlídá. <strong>Pokud uděláme chybu v koordinaci, je to náš náklad, nikoliv váš.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportantInfo() {
  return (
    <div className="mt-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
      <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Eye size={20} />
        Důležité informace:
      </h4>
      <ul className="space-y-3 text-sm text-slate-600">
        <li className="flex gap-3">
          <span className="text-blue-600 font-bold">-</span>
          <span>Ceny jsou orientační a mohou se lišit podle konkrétních podmínek stavby a dostupnosti materiálu</span>
        </li>
        <li className="flex gap-3">
          <span className="text-blue-600 font-bold">-</span>
          <span>Zahrnuje kvalitní materiál značkových výrobců, odbornou práci certifikovaných techniků a montáž</span>
        </li>
        <li className="flex gap-3">
          <span className="text-blue-600 font-bold">-</span>
          <span>Přesná nabídka bude vytvořena po osobním zaměření a prostudování projektové dokumentace</span>
        </li>
        <li className="flex gap-3">
          <span className="text-blue-600 font-bold">-</span>
          <span>Na všechny práce poskytujeme standardní záruku 24 měsíců, na vybraná zařízení až 5 let</span>
        </li>
      </ul>
    </div>
  );
}
