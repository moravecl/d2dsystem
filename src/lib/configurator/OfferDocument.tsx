import type { ReactNode } from 'react';
import {
  Home, Thermometer, Wind, Zap, Cable, Droplets, Brain, Shield, Flower2,
  KeyRound, Router, Snowflake, RefreshCw, PiggyBank, Wrench, type LucideIcon,
} from 'lucide-react';
import type { ConfiguratorConfig, QuoteState, QuoteTotals, SectionResult } from './types';

/**
 * Výstupní dokument předběžné nabídky — VĚRNÁ kopie A4 šablony
 * z původní aplikace HouseSmart Manager (stejné Tailwind třídy, fonty
 * Inter + Playfair Display, stejné stránkování a texty). Renderuje se
 * přes renderToStaticMarkup do tiskového okna s Tailwind CDN.
 */

const getVocative = (lastName: string): string => {
  if (!lastName) return '';
  const n = lastName.trim();
  const last = n.slice(-1).toLowerCase();
  if (['a', 'á', 'e', 'é', 'i', 'í', 'o', 'u', 'y', 'ý'].includes(last)) return n;
  return n + 'e';
};

function kc(n: number): string {
  return n.toLocaleString('cs-CZ');
}

const COLOR_MAP: Record<string, string> = {
  red: 'border-red-500 text-red-700 bg-red-50',
  blue: 'border-blue-500 text-blue-700 bg-blue-50',
  green: 'border-green-500 text-green-700 bg-green-50',
  yellow: 'border-yellow-500 text-yellow-700 bg-yellow-50',
  orange: 'border-orange-500 text-orange-700 bg-orange-50',
  cyan: 'border-cyan-500 text-cyan-700 bg-cyan-50',
  emerald: 'border-emerald-500 text-emerald-700 bg-emerald-50',
  indigo: 'border-indigo-500 text-indigo-700 bg-indigo-50',
  gray: 'border-gray-500 text-gray-700 bg-gray-50',
  sky: 'border-sky-500 text-sky-700 bg-sky-50',
};

function PdfCard({ title, icon: Icon, color, children, priceRes, inclusions, subsidy }: {
  title: string;
  icon: LucideIcon;
  color: string;
  children?: ReactNode;
  priceRes: SectionResult;
  inclusions?: string[];
  subsidy?: { active: boolean; amount: number };
}) {
  const hasDiscount = priceRes.discount > 0;
  return (
    <div
      className={`break-inside-avoid border-l-[6px] p-5 mb-0 shadow-sm rounded-r-xl flex flex-col justify-between ${COLOR_MAP[color] ?? 'border-gray-200 text-gray-800 bg-gray-50'} bg-white`}
      style={{ minHeight: '200px' }}
    >
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-black/5 pb-2">
          <div className="flex items-center gap-3">
            <Icon size={24} strokeWidth={2} />
            <h3 className="font-bold text-base uppercase tracking-wide">{title}</h3>
          </div>
        </div>
        <div className="text-xs text-slate-700 space-y-2 font-medium leading-relaxed">{children}</div>
      </div>
      <div>
        {subsidy && subsidy.active && (
          <div className="mt-2 mb-2 text-[10px] p-1.5 rounded border font-bold text-center flex items-center justify-center gap-1 bg-green-50 text-green-800 border-green-200">
            <PiggyBank size={12} />Možná dotace: {kc(subsidy.amount)} Kč
          </div>
        )}
        {inclusions && (
          <div className="mt-3 pt-2 border-t border-black/5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Wrench size={10} /> Součástí realizace:
            </p>
            <div className="text-[9px] text-slate-500 leading-tight space-y-0.5">
              {inclusions.map((item, i) => (
                <div key={i} className="flex items-start gap-1"><span className="opacity-50">•</span> <span>{item}</span></div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 pt-2 border-t border-dashed border-black/10 text-right">
          {hasDiscount && (
            <div className="flex justify-end items-center gap-2 text-[10px] mb-1">
              <span className="opacity-60 line-through">{kc(priceRes.base)}</span>
              <span className="bg-white/80 px-2 py-0.5 rounded text-green-700 font-bold border border-green-200">-{priceRes.percent}%</span>
            </div>
          )}
          <div className="font-black text-2xl leading-none tracking-tight">
            {kc(Math.round(priceRes.final))} <span className="text-sm font-bold opacity-60">Kč</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhyFairSection() {
  const items: { n: number; title: string; body: ReactNode }[] = [
    { n: 1, title: 'Komplexní řešení', body: (<><p className="text-[10px] text-slate-600 mb-2 leading-relaxed">Nekupujete produkty, ale funkční systém.</p><ul className="text-[10px] text-slate-600 list-disc pl-4 space-y-0.5"><li>Sjednocená záruka</li><li>Jeden realizační tým</li></ul></>) },
    { n: 2, title: 'Špičkové komponenty', body: <p className="text-[10px] text-slate-600 mb-2 leading-relaxed">Používáme ověřené prvky (Ventbox, Zehnder, SolaX, Loxone). Žádné levné náhražky.</p> },
    { n: 3, title: 'Úspory v provozu', body: <p className="text-[10px] text-slate-600 mb-2 leading-relaxed">Inteligentní řízení ukládá energii z FVE do akumulace a TUV.</p> },
    { n: 4, title: 'Zdravé klima', body: <p className="text-[10px] text-slate-600 leading-relaxed">Řízené větrání zajišťuje čerstvý vzduch bez ztráty tepla.</p> },
    { n: 5, title: 'Kompletní dodávka', body: <p className="text-[10px] text-slate-600 leading-relaxed">Cena zahrnuje montáž, revize, zprovoznění a zaškolení.</p> },
    { n: 6, title: 'Budoucnost', body: <p className="text-[10px] text-slate-600 mb-2 leading-relaxed">Příprava na elektromobilitu a rozšíření systému je standardem.</p> },
  ];
  return (
    <div className="px-10 py-8 bg-slate-50 mt-8 border-t border-slate-200 break-inside-avoid">
      <h2 className="font-serif text-2xl text-slate-800 mb-6">Proč je cena technologie HouseSmart férová?</h2>
      <div className="grid grid-cols-2 gap-8">
        {items.map((item) => (
          <div key={item.n}>
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2 text-sm">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">{item.n}</div> {item.title}
            </h3>
            {item.body}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OfferDocument({ state, totals, config }: {
  state: QuoteState;
  totals: QuoteTotals;
  config: ConfiguratorConfig;
}) {
  const C = config.catalog;
  const s = state;
  const t = totals;
  const vocative = s.client.vocative || getVocative(s.client.lastName);
  const onOffLights = Math.max(0, s.electro.lightCircuits - s.loxone.dimmableCount);
  const recupUnit = C.recuperationUnits[s.ventilation.unitIndex] ?? C.recuperationUnits[0];

  const keyElements = s.introText ? (
    <div className="text-xs text-slate-600 bg-slate-50 p-4 rounded border border-slate-200 whitespace-pre-line">
      {s.introText}
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-4 text-xs text-slate-600 bg-slate-50 p-4 rounded border border-slate-200">
      {s.heating.active && (
        <div><strong className="text-slate-800">Vytápění:</strong> {(C.heatSources[s.heating.sourceIndex]?.id === 'hp_ground')
          ? 'Zvolili jsme extrémně účinné tepelné čerpadlo Země/Voda, které zajišťuje stabilní výkon po celý rok.'
          : 'Systém je navržen s důrazem na zónovou regulaci – každé patro a místnost topí přesně podle potřeby díky integraci s Loxone.'}</div>
      )}
      {s.ventilation.active && (
        <div><strong className="text-slate-800">Klima:</strong> {(recupUnit.label || '').includes('Zehnder')
          ? 'Švýcarská technologie Zehnder zajistí trvalý přísun čerstvého vzduchu, tichý chod a maximální hygienu potrubí.'
          : 'Centrální rekuperace s entalpickým výměníkem se postará o zdravé vnitřní klima bez ztráty vlhkosti.'}
        {s.ventilation.coolingType !== 'none' && ' Součástí je i systém chlazení pro letní komfort.'}</div>
      )}
      {s.fve.active && (
        <div><strong className="text-slate-800">Energetika:</strong> {t.kwp.toFixed(2)} kWp fotovoltaika s {t.batteryCapacity.toFixed(1)} kWh baterií tvoří srdce domu. Díky propojení s Loxone spotřebujete maximum vyrobené energie sami (nahřívání vody, nabíjení auta).</div>
      )}
      {(s.security.active || s.access.active) && (
        <div>
          <strong className="text-slate-800">Bezpečí &amp; Vstup:</strong>
          {s.security.active && s.security.jablotron ? ' Dům je chráněn profesionálním zabezpečením Jablotron.' : ''}
          {s.security.active && s.security.cameraMode === 'yes' ? ' Součástí je kamerový systém pro dokonalý přehled.' : ''}
          {s.access.active ? ' Vstup do domu je řešen moderně bez klíčů – pomocí NFC kódu a videotelefonu propojeného na Váš mobil.' : ''}
        </div>
      )}
    </div>
  );

  const budgetSections: { title: string; data: SectionResult; active: boolean }[] = [
    { title: 'Vytápění & Zóny', data: t.resHeating, active: s.heating.active },
    { title: 'Vzduchotechnika & Chlazení', data: t.resVent, active: s.ventilation.active },
    { title: 'Fotovoltaika (FVE)', data: t.resFve, active: s.fve.active },
    { title: 'Elektroinstalace', data: t.resElectro, active: s.electro.active },
    { title: 'Voda & Odpady', data: t.resWater, active: s.water.active },
    { title: 'Smart Home Loxone', data: t.resLoxone, active: s.loxone.active },
    { title: 'Zabezpečení', data: t.resSec, active: s.security.active },
    { title: 'Exteriér', data: t.resExt, active: s.exterior.active },
    { title: 'Vstup & Přístup', data: t.resAccess, active: s.access.active },
    { title: 'IT Síť', data: t.resNet, active: s.network.active },
  ];

  const extraGlobalDiscount = t.totalDiscountCombined - t.totalSectionDiscounts
    - s.fees.coordinationDiscount - s.fees.manualDiscount;

  return (
    <div className="a4-container text-slate-800 mx-auto">
      {/* STRANA 1: hlavicka + uvod + prvni karty */}
      <div className="page-break-after bg-white">
        <div className="bg-slate-900 text-white px-10 py-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-600 p-1.5 rounded"><Home size={24} /></div>
              <span className="text-2xl font-bold tracking-tight">Komplexní nabídka technologií</span>
            </div>
            <h1 className="text-xl font-light opacity-90 tracking-wide">Komplexní nabídka technologií</h1>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Projekt</div>
              <div className="font-bold text-lg leading-tight">RD {(s.client.lastName || '').toUpperCase()}</div>
              <div className="text-xs text-slate-400">{s.client.address}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-slate-800 px-3 py-1 rounded text-xs text-blue-400 font-bold mb-1">NABÍDKA</div>
            <div className="text-xs text-slate-500">{new Date(s.client.date).toLocaleDateString('cs-CZ')}</div>
          </div>
        </div>
        <div className="px-10 pt-8 pb-4">
          <p className="text-sm text-slate-700 leading-relaxed font-serif italic mb-6">
            Vážený pane {vocative},<br /><br />
            předkládáme Vám kompletní návrh technologií pro Váš dům. Řešení eliminuje starosti s koordinací více
            dodavatelů a přináší systémovou záruku na celý celek.<br /><br />
            Klíčové prvky návrhu:
          </p>
          {keyElements}
        </div>
        <div className="px-10 pb-8">
          <div className="grid grid-cols-2 gap-6">
            {s.heating.active && (
              <PdfCard title="Vytápění & Zóny" icon={Thermometer} color="red" priceRes={t.resHeating}
                subsidy={{ active: s.heating.subsidy, amount: s.heating.subsidyAmount }}
                inclusions={['Montáž zdroje a AKU', 'Pokládka desek', 'Rozvody', 'Tlakové zkoušky']}>
                <div className="font-bold border-b border-red-100 pb-1 mb-2">
                  {(C.heatSources[s.heating.sourceIndex] ?? C.heatSources[0]).label}
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span>Zóna 1 (Přízemí):</span> <strong>{s.heating.zone1Area}m² ({(C.floorInstallationTypes[s.heating.zone1TypeIndex] ?? C.floorInstallationTypes[0]).label})</strong></div>
                  <div className="flex justify-between"><span>Zóna 2 (Patro):</span> <strong>{s.heating.zone2Area}m² ({(C.floorInstallationTypes[s.heating.zone2TypeIndex] ?? C.floorInstallationTypes[0]).label})</strong></div>
                </div>
              </PdfCard>
            )}
            {s.ventilation.active && (
              <PdfCard title="Vzduchotechnika" icon={Wind} color="sky" priceRes={t.resVent}
                subsidy={{ active: s.ventilation.subsidy, amount: s.ventilation.subsidyAmount }}
                inclusions={['Jednotka', 'Rozvody', 'Regulace']}>
                <div className="font-bold mb-2 flex items-center gap-2">
                  {recupUnit.label}
                  {recupUnit.label.includes('Zehnder') && <span className="bg-red-600 text-white text-[9px] px-1 rounded font-bold">SWISS</span>}
                </div>
                <div className="text-xs flex justify-between"><span>Rozvody:</span> {s.ventilation.inlets} přívodů, {s.ventilation.outlets} odtahů</div>
                {s.ventilation.coolingType === 'ventbox_cool' && (
                  <div className="text-sky-700 font-bold text-xs mt-2 flex items-center gap-1"><Snowflake size={12} /> Modul aktivního chlazení CoolBreeze</div>
                )}
              </PdfCard>
            )}
          </div>
        </div>
      </div>

      {/* STRANA 2: FVE, elektro, voda, smart home */}
      <div className="page-break-after px-10 py-10 bg-white">
        <div className="grid grid-cols-2 gap-6 auto-rows-fr">
          {s.fve.active && (
            <PdfCard title="Fotovoltaika" icon={Zap} color="yellow" priceRes={t.resFve}
              subsidy={{ active: s.fve.subsidy, amount: s.fve.subsidyAmount }}
              inclusions={['Panely', 'Baterie', 'Revize']}>
              <div className="font-bold">{t.kwp.toFixed(2)} kWp</div>
              <div className="text-xs">{t.batteryCapacity.toFixed(1)} kWh baterie</div>
              <div className="text-[10px] text-slate-500 mt-1">{(C.pvInverters[s.fve.inverterIndex] ?? C.pvInverters[0]).label}</div>
            </PdfCard>
          )}
          {s.electro.active && (
            <PdfCard title="Elektro" icon={Cable} color="orange" priceRes={t.resElectro} inclusions={['Hrubé', 'Kompletace']}>
              <div className="font-bold">Kompletní instalace</div>
              <div className="text-xs">{s.electro.sockets230} zásuvek, {s.electro.socketsData} datových</div>
              <div className="text-xs text-orange-800 mt-1">{s.electro.lightCircuits} světelných okruhů</div>
            </PdfCard>
          )}
          {s.water.active && (
            <PdfCard title="Voda & Odpady" icon={Droplets} color="cyan" priceRes={t.resWater} inclusions={['Rozvody', 'Kanalizace', 'Izolace']}>
              <div className="font-bold mb-1">{(C.waterMaterials[s.water.materialIndex] ?? C.waterMaterials[0]).label}</div>
              <div className="text-[10px] text-slate-500">Baterie: {(C.faucetTypes[s.water.faucetTypeIndex] ?? C.faucetTypes[0]).label}</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mt-2 border-t border-cyan-100 pt-1">
                <span>WC: {s.water.fixtures.wc}</span><span>Vana: {s.water.fixtures.bath}</span>
                <span>Umyv: {s.water.fixtures.washbasin}</span><span>Sprcha: {s.water.fixtures.shower}</span>
                <span>Dřez: {s.water.fixtures.sink}</span><span>Myčka: {s.water.fixtures.dishwasher}</span>
                <span>Pračka: {s.water.fixtures.washer}</span><span>Zahr.: {s.water.fixtures.garden}</span>
              </div>
              {s.water.circulation && <div className="font-bold text-cyan-700 text-[10px] mt-2 flex items-center gap-1"><RefreshCw size={10} /> Cirkulace TUV</div>}
            </PdfCard>
          )}
          {s.loxone.active && (
            <PdfCard title="Smart Home" icon={Brain} color="green" priceRes={t.resLoxone} inclusions={['Miniserver', 'Config']}>
              <div className="font-bold">Loxone</div>
              <ul className="list-disc pl-4 text-xs text-slate-600 space-y-0.5 mt-1">
                <li>{s.loxone.dimmableCount}x Stmívaný okruh</li>
                <li>{onOffLights}x Spínaný (ON/OFF) okruh</li>
                <li>Topení: {s.loxone.heatingZones} zón</li>
                {s.loxone.intShading && <li>Stínění: {s.loxone.windowCount} oken</li>}
                {s.loxone.intAudio && <li>Audio: {s.loxone.audioZones} zón</li>}
                {s.loxone.weatherStation && <li>Meteostanice</li>}
                {s.loxone.alarmIntegration && <li>Integrace alarmu</li>}
              </ul>
            </PdfCard>
          )}
        </div>
      </div>

      {/* STRANA 3: zabezpeceni, exterier, vstup, sit */}
      <div className="page-break-after px-10 py-10 bg-white">
        <div className="grid grid-cols-2 gap-6 auto-rows-fr">
          {s.security.active && (
            <PdfCard title="Zabezpečení" icon={Shield} color="red" priceRes={t.resSec} inclusions={['Montáž', 'Kamery']}>
              {s.security.jablotron && (
                <div className="mb-2 border-b border-red-100 pb-2">
                  <div className="font-bold">Jablotron 100+</div>
                  <div className="text-xs">{s.security.jabPir}x PIR, {s.security.jabMag}x Mag</div>
                </div>
              )}
              {s.security.cameraMode === 'yes' && (
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-slate-800">Kamerový systém</div>
                  <div>{s.security.cameraCount}x Kamera</div>
                  <div className="text-[10px] text-slate-500">{(C.nvrTypes[s.security.nvrIndex] ?? C.nvrTypes[0]).label}</div>
                  <div className="text-[10px] text-slate-500 font-bold">HDD: {(C.hddSizes[s.security.hddSizeIndex] ?? C.hddSizes[0]).label}</div>
                </div>
              )}
              {s.security.cameraMode === 'prep' && <div className="text-xs italic text-slate-500">Příprava pro kamery</div>}
            </PdfCard>
          )}
          {s.exterior.active && (
            <PdfCard title="Exteriér" icon={Flower2} color="emerald" priceRes={t.resExt} inclusions={['Zásuvky', 'Světla']}>
              <div className="text-xs">{s.exterior.switchedSockets}x Zásuvka, {s.exterior.lightPoints}x Světlo</div>
              {s.exterior.pool && <div className="text-xs font-bold mt-1">+ Bazén</div>}
              {s.exterior.sauna && <div className="text-xs font-bold mt-1">+ Sauna</div>}
              {s.exterior.gateControl && <div className="text-xs font-bold mt-1">+ Brána</div>}
            </PdfCard>
          )}
          {s.access.active && (
            <PdfCard title="Vstup" icon={KeyRound} color="indigo" priceRes={t.resAccess} inclusions={['Interkom', 'Zámek']}>
              <div className="font-bold">{(C.accessTypes[s.access.intercomTypeIndex] ?? C.accessTypes[0]).label}</div>
              <div className="text-xs">Počet: {s.access.intercomCount}</div>
              {s.access.nfcCount > 0 && <div className="text-xs">+ {s.access.nfcCount}x NFC Code</div>}
              {s.access.electricStrike && <div className="text-xs font-bold">+ Elektrozámek</div>}
            </PdfCard>
          )}
          {s.network.active && (
            <PdfCard title="Síť" icon={Router} color="gray" priceRes={t.resNet} inclusions={['Rack', 'Měření']}>
              <div className="font-bold">{s.network.apCount}x WiFi AP</div>
              <div className="text-xs">{(C.rackSizes[s.network.rackIndex] ?? C.rackSizes[0]).label}</div>
              <div className="text-[10px] text-slate-500">{(C.switchTypes[s.network.switchTypeIndex] ?? C.switchTypes[0]).label}</div>
            </PdfCard>
          )}
        </div>
      </div>

      {/* STRANA 4: proc ferova cena + tmavy cenovy souhrn */}
      <div className="page-break-after bg-white">
        <WhyFairSection />
        <div className="mt-8 bg-slate-900 text-white p-10">
          <div className="flex flex-col gap-2 mb-6 text-sm opacity-80 border-b border-slate-700 pb-4">
            <div className="flex justify-between"><span>Běžná tržní cena při realizaci po částech:</span><span className="line-through text-slate-400">{kc(t.marketPrice)} Kč</span></div>
            <div className="flex justify-between text-green-400 font-bold text-base"><span>Vaše úspora s HouseSmart:</span><span>-{kc(Math.round(t.totalSavings))} Kč</span></div>
          </div>
          <div className="border-b border-slate-700 pb-6 mb-6">
            <div className="flex justify-between text-sm opacity-60 mb-2"><span>Ceníková cena celkem:</span><span>{kc(Math.round(t.totalBase))} Kč</span></div>
            {t.totalSectionDiscounts > 0 && (
              <div className="flex justify-between text-sm text-green-400 mb-1"><span>Sleva na technologie:</span><span>-{kc(Math.round(t.totalSectionDiscounts))} Kč</span></div>
            )}
            {s.fees.manualDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-400 mb-1"><span>Obchodní sleva:</span><span>-{kc(s.fees.manualDiscount)} Kč</span></div>
            )}
            {s.fees.globalDiscountPercent > 0 && (
              <div className="flex justify-between text-sm text-green-400 mb-1 font-bold"><span>Celková sleva ({s.fees.globalDiscountPercent}%):</span><span>-{kc(Math.round(extraGlobalDiscount))} Kč</span></div>
            )}
            {s.fees.coordinationDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-400 mb-1"><span>Bonus za komplet:</span><span>-{kc(s.fees.coordinationDiscount)} Kč</span></div>
            )}
          </div>
          <div className="flex justify-between items-end border-b border-slate-700 pb-6 mb-6">
            <div>
              <div className="text-sm opacity-50 mb-1">Cena HouseSmart bez DPH</div>
              <div className="text-4xl font-bold tracking-tighter text-blue-400">{kc(Math.round(t.totalFinal))} Kč</div>
            </div>
            <div className="text-right text-sm opacity-60">
              <div>DPH ({s.vatRate}%): {kc(Math.round(t.vat))} Kč</div>
              <div className="font-bold text-white text-lg mt-1">S DPH: {kc(Math.round(t.totalWithVat))} Kč</div>
            </div>
          </div>
          {t.totalSubsidy > 0 && (
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <div className="flex justify-between items-center text-sm text-slate-400 mb-2"><span>Celková cena s DPH (Investiční náklad):</span><span>{kc(Math.round(t.totalWithVat))} Kč</span></div>
              <div className="flex justify-between items-center text-green-400 text-sm mb-4 font-bold"><span>Předpokládané dotace NZÚ:</span><span>-{kc(t.totalSubsidy)} Kč</span></div>
              <div className="flex justify-between items-end pt-4 border-t border-slate-700">
                <span className="text-xl font-bold text-white">Cena po odečtu dotací:</span>
                <span className="text-4xl font-black text-green-400">{kc(Math.round(t.finalPriceAfterSubsidy))} Kč</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STRANA 5: polozkovy rozpocet */}
      <div className="print-page px-10 py-8 bg-white">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-300 pb-2">Položkový rozpočet</h2>
        <div className="space-y-6">
          {budgetSections.map((section, idx) => section.active && (
            <div key={idx} className="break-inside-avoid">
              <h3 className="font-bold text-slate-800 bg-slate-100 p-2 text-sm border-l-4 border-blue-500 mb-2">{section.title}</h3>
              <table className="w-full text-xs"><tbody>
                {section.data.details.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pl-2 text-slate-600 w-3/4">{item.label}</td>
                    <td className="py-1.5 pr-2 text-right font-medium text-slate-800 w-1/4">{kc(Math.round(item.price))} Kč</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold border-t border-slate-200">
                  <td className="py-2 pl-2 text-slate-500">Mezisoučet sekce</td>
                  <td className="py-2 pr-2 text-right text-slate-800">{kc(Math.round(section.data.base))} Kč</td>
                </tr>
                <tr className="font-black text-slate-900 border-t border-slate-300 bg-slate-100/50">
                  <td className="py-2 pl-2">Cena po slevě</td>
                  <td className="py-2 pr-2 text-right">{kc(Math.round(section.data.final))} Kč</td>
                </tr>
              </tbody></table>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-4 border-t-2 border-slate-800 text-right">
          <div className="text-3xl font-bold text-slate-900">{kc(Math.round(t.totalFinal))} Kč</div>
          <div className="text-xs text-slate-400 mt-1">S DPH: {kc(Math.round(t.totalWithVat))} Kč</div>
          <div className="mt-6 text-[10px] text-slate-500 italic bg-yellow-50 p-3 border border-yellow-100 rounded text-center">
            <strong>Poznámka:</strong> Všechny uvedené ceny v položkovém rozpočtu obsahují kompletní dodávku materiálu,
            montážní práce, dopravu, revize a zaškolení obsluhy.
          </div>
        </div>
      </div>
    </div>
  );
}
