import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white/[0.04]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zpět
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Obchodní podmínky</h1>
            <p className="text-sm text-slate-500">Platné od 1. 1. 2025</p>
          </div>
        </div>

        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-8 prose prose-slate max-w-none">
          <h2>1. Úvodní ustanovení</h2>
          <p>
            Tyto obchodní podmínky (dále jen „podmínky") upravují vztahy mezi společností
            HouseSmart s.r.o. (dále jen „poskytovatel") a zákazníky využívajícími softwarovou
            službu HouseSmart (dále jen „služba").
          </p>

          <h2>2. Předmět smlouvy</h2>
          <p>
            Poskytovatel se zavazuje poskytnout zákazníkovi přístup k webové aplikaci HouseSmart
            pro řízení projektů, správu klientů a interní procesy firmy. Zákazník se zavazuje
            platit cenu dle aktuálního ceníku.
          </p>

          <h2>3. Registrace a účet</h2>
          <p>
            Zákazník se zavazuje uvádět pravdivé a aktuální údaje při registraci. Zákazník je
            odpovědný za bezpečné uchování přístupových údajů. Každá organizace je izolována
            a data jedné organizace nejsou přístupná jiné organizaci.
          </p>

          <h2>4. Ceny a platební podmínky</h2>
          <p>
            Ceny jsou uvedeny v Kč bez DPH. Faktury jsou splatné do 14 dnů od vystavení.
            Poskytovatel si vyhrazuje právo na změnu cen s 30denním předstihem. V případě
            nezaplacení je poskytovatel oprávněn omezit nebo pozastavit přístup ke službě.
          </p>

          <h2>5. Dostupnost služby</h2>
          <p>
            Poskytovatel se snaží zajistit dostupnost služby 99,5 % času. Plánované odstávky
            jsou oznamovány předem. Poskytovatel neodpovídá za výpadky způsobené třetími stranami
            (infrastruktura, internetové připojení zákazníka).
          </p>

          <h2>6. Ochrana dat</h2>
          <p>
            Data zákazníka jsou uložena na serverech v EU. Poskytovatel neposkytuje data třetím
            stranám bez souhlasu zákazníka, s výjimkou zákonných povinností. Podrobnosti viz
            Zásady ochrany osobních údajů.
          </p>

          <h2>7. Zálohy a export dat</h2>
          <p>
            Zákazník má kdykoliv právo exportovat svá data ve strojově čitelném formátu.
            Poskytovatel provádí pravidelné zálohy databáze. Po ukončení smlouvy jsou data
            zákazníka uchována po dobu 30 dnů, poté trvale smazána.
          </p>

          <h2>8. Omezení odpovědnosti</h2>
          <p>
            Celková odpovědnost poskytovatele je omezena na výši zaplacených poplatků za
            poslední 3 měsíce. Poskytovatel neodpovídá za nepřímé škody, ušlý zisk ani ztrátu dat
            způsobenou zákazníkem.
          </p>

          <h2>9. Ukončení smlouvy</h2>
          <p>
            Zákazník může smlouvu ukončit kdykoliv výpovědí s účinností ke konci fakturačního
            období. Poskytovatel může smlouvu ukončit při porušení podmínek s okamžitou účinností.
          </p>

          <h2>10. Závěrečná ustanovení</h2>
          <p>
            Tyto podmínky se řídí právem České republiky. Případné spory budou řešeny u věcně
            příslušného soudu v České republice. Poskytovatel si vyhrazuje právo podmínky
            jednostranně změnit s informováním zákazníka emailem.
          </p>

          <h2>Kontakt</h2>
          <p>
            HouseSmart s.r.o.<br />
            E-mail: <a href="mailto:info@housesmart.cz">info@housesmart.cz</a>
          </p>
        </div>
      </div>
    </div>
  );
}
