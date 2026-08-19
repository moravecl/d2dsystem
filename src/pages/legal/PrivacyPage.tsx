import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPage() {
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
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Zásady ochrany osobních údajů</h1>
            <p className="text-sm text-slate-500">Platné od 1. 1. 2025 · GDPR</p>
          </div>
        </div>

        <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] p-8 prose prose-slate max-w-none">
          <h2>1. Správce osobních údajů</h2>
          <p>
            Správcem osobních údajů je HouseSmart s.r.o. (dále jen „správce"). Kontaktní
            email pro věci ochrany osobních údajů: <a href="mailto:gdpr@housesmart.cz">gdpr@housesmart.cz</a>.
          </p>

          <h2>2. Jaké údaje zpracováváme</h2>
          <ul>
            <li><strong>Identifikační údaje:</strong> jméno, email, role v organizaci</li>
            <li><strong>Provozní údaje:</strong> záznamy o přihlášení, audit log akcí v systému</li>
            <li><strong>Obchodní data:</strong> projekty, klienti, faktury, zaměstnanci – vkládá zákazník sám</li>
            <li><strong>Technické údaje:</strong> IP adresa při přihlášení, typ prohlížeče</li>
          </ul>

          <h2>3. Účel zpracování a právní základ</h2>
          <ul>
            <li><strong>Plnění smlouvy (čl. 6 odst. 1 písm. b GDPR):</strong> provoz aplikace, fakturace, podpora</li>
            <li><strong>Oprávněný zájem (čl. 6 odst. 1 písm. f GDPR):</strong> bezpečnost systému, prevence podvodů</li>
            <li><strong>Souhlas (čl. 6 odst. 1 písm. a GDPR):</strong> marketingová komunikace (lze kdykoliv odvolat)</li>
          </ul>

          <h2>4. Uchovávání dat</h2>
          <p>
            Osobní údaje uchováváme po dobu trvání smlouvy a dále dle zákonných povinností
            (daňové doklady 10 let, záznamy z auditu 3 roky). Po ukončení smlouvy a uplynutí
            zákonné lhůty jsou data trvale smazána.
          </p>

          <h2>5. Příjemci dat</h2>
          <p>
            Data neprodáváme ani neposkytujeme třetím stranám za účelem marketingu.
            Využíváme pouze tyto zpracovatele:
          </p>
          <ul>
            <li><strong>Supabase Inc.</strong> – databázová infrastruktura (servery v EU)</li>
            <li><strong>Cloudflare, Inc.</strong> – CDN a síťová bezpečnost</li>
          </ul>

          <h2>6. Mezinárodní přenosy</h2>
          <p>
            Data jsou uložena výhradně na serverech v Evropské unii. Neprovádíme přenosy
            do třetích zemí.
          </p>

          <h2>7. Vaše práva</h2>
          <p>Jako subjekt údajů máte právo:</p>
          <ul>
            <li><strong>Na přístup</strong> k vašim osobním údajům</li>
            <li><strong>Na opravu</strong> nepřesných údajů</li>
            <li><strong>Na výmaz</strong> („právo být zapomenut")</li>
            <li><strong>Na přenositelnost</strong> dat ve strojově čitelném formátu</li>
            <li><strong>Vznést námitku</strong> proti zpracování</li>
            <li><strong>Odvolat souhlas</strong> se zpracováním</li>
          </ul>
          <p>
            Export a výmaz vlastních dat lze provést v sekci <strong>Nastavení → GDPR &amp; Export dat</strong>.
            Pro ostatní požadavky kontaktujte <a href="mailto:gdpr@housesmart.cz">gdpr@housesmart.cz</a>.
          </p>

          <h2>8. Soubory cookie</h2>
          <p>
            Aplikace používá technické cookies nezbytné pro fungování (přihlášení, session).
            Nepoužíváme analytické ani marketingové cookies.
          </p>

          <h2>9. Podání stížnosti</h2>
          <p>
            Máte právo podat stížnost u Úřadu pro ochranu osobních údajů (ÚOOÚ),
            Pplk. Sochora 27, 170 00 Praha 7, <a href="https://www.uoou.cz">www.uoou.cz</a>.
          </p>

          <h2>10. Změny zásad</h2>
          <p>
            O podstatných změnách vás budeme informovat emailem s 30denním předstihem.
            Aktuální verze je vždy dostupná na této stránce.
          </p>
        </div>
      </div>
    </div>
  );
}
