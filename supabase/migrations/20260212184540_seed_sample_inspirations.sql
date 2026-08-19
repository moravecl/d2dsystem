/*
  # Seed sample inspiration posts

  1. New Data
    - 2 sample inspiration articles with real-world installation tips
    - Both are published with cover images from Pexels
    - Content includes formatted HTML with headings, paragraphs, lists, images, and blockquotes

  2. Notes
    - These are demo articles to show how the inspiration section works
    - Cover images are from Pexels (free stock photos)
    - Content is in Czech language matching the rest of the application
*/

INSERT INTO inspirations (title, slug, excerpt, content, cover_image, is_published, published_at)
VALUES
(
  'Jak sladit vypinace s interiérem - tipy z realizace v Praze',
  'jak-sladit-vypinace-s-interierem',
  'Podivejte se, jak jsme v modernizovanem byte v Praze 6 sladili designove vypinace ABB Tango s minimalistickym interiérem. Ukazeme vam kombinace barev a materialu, ktere fungují.',
  '<h2>Moderni byt v Praze 6</h2>
<p>Pri teto realizaci jsme resili kompletni elektroinstalaci v modernizovanem byte 3+kk. Klient mel jasnou predstavu — cisty minimalisticky design s durazem na kvalitni materialy.</p>

<img src="https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750" alt="Moderni interier" />

<h2>Volba designove rady</h2>
<p>Po diskuzi jsme zvolili <strong>ABB Tango v bile barve</strong>, ktera perfektne doplnuje bile steny a svetly dubovy nabytek. Pro kontrast jsme v loznici pouzili antracitovou variantu, ktera se skvele hodi k tmavsimu interierru.</p>

<h3>Co fungovalo nejlepe</h3>
<ul>
<li><strong>Obyvaci pokoj:</strong> Bile vypinace ABB Tango s Touch Pure ovladanim — elegatni a intuitivni</li>
<li><strong>Kuchyne:</strong> Vypinace u linky v bile barve, doplnene o stmivac pro osvetleni pracovni plochy</li>
<li><strong>Loznice:</strong> Antracitove vypinace u postele s noctnim podsvicenim</li>
<li><strong>Koupelna:</strong> Bile provedeni s krytim IP44 proti vlhkosti</li>
</ul>

<blockquote>Tip: Vzdy si vyzadejte vzorky vypinacù pred finalni objednavkou. Barvy na monitoru se mohou lisit od skutecnosti.</blockquote>

<img src="https://images.pexels.com/photos/1643384/pexels-photo-1643384.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750" alt="Detail vypinace v interiru" />

<h2>Napajeni a technické reseni</h2>
<p>Cely byt je rizen systemem Loxone s napajenim 24V pro vsechny ovladace. To nam umoznilo pouzit tenke kabely a jednodussi instalaci. Vsechny scene (vecer, rano, kino, party) se ovladaji jedním dotykem.</p>

<h3>Tipy pro vasi realizaci</h3>
<ul>
<li>Planujte pozice vypinacù uz ve fazi projektu — dodate
cne premiistovani je nakladne</li>
<li>U postele pocitejte s vypinaci na obe strany</li>
<li>V kuchyni umistete ovladac osvetleni linky do dosahu pracovni plochy</li>
<li>Nezapomente na ovladani zaluzi — idealne vedle oken</li>
</ul>',
  'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
  true,
  now() - interval '3 days'
),
(
  'Chytra domacnost v rodinnem dome - kompletní realizace Loxone',
  'chytra-domacnost-rodinny-dum-loxone',
  'Kompletni realizace chytre domacnosti v novostavbe rodinneho domu. Od osvetleni pres vytapeni az po zabezpeceni — vse ridi Loxone Miniserver.',
  '<h2>Novostavba s chytrymi technologiemi</h2>
<p>Tato realizace zahrnovala kompletni chytrou domacnost v rodinnem dome 5+kk v Richanech u Prahy. Klienti chteli maximalni komfort pri zachovani jednoducheho ovladani pro celou rodinu vcetne deti.</p>

<img src="https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750" alt="Moderni rodinny dum" />

<h2>Co vsechno dum umi</h2>
<h3>Osvetleni</h3>
<p>Vsechna svetla v dome jsou stmivatelna a ovladana pres Loxone. Kazda mistnost ma prednastavene sceny — <strong>den, vecer, noc, party</strong>. Svetla v chodbách se automaticky rozsvici pri detekcí pohybu a v noci sviti pouze na 10 %.</p>

<h3>Vytapeni a klimatizace</h3>
<p>Podlahove topeni je rizene po zonach. Kazda mistnost ma vlastni cidlo teploty a vlhkosti. System se uci z chovani rodiny a automaticky upravuje teploty behem dne.</p>

<h3>Zaluzie a markýzy</h3>
<p>Venkovni zaluzie reagují na polohu slunce, teplotu a vitr. V lete automaticky stini, v zime propousti svetlo pro pasivni ohrev.</p>

<blockquote>Automaticke stineni usetri az 30 % nakladu na klimatizaci v letnich mesicich. Je to jedna z nejlepse hodnocenych funkci nasimi klienty.</blockquote>

<img src="https://images.pexels.com/photos/1090638/pexels-photo-1090638.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750" alt="Interier s chytrym osvetlenim" />

<h2>Zabezpeceni</h2>
<p>Dum je vybaven pohybovymi cidly, okennimi kontakty a kamerovym systemem. Vse je integrovano do Loxone a klienti dostavaji notifikace na telefon. Alarm se automaticky aktivuje, kdyz vsichni odejdou z domu (detekce pres telefony).</p>

<h2>Co jsme se naucili</h2>
<ul>
<li><strong>Jednoduchest je klíc</strong> — klienti nepouzivaji funkce, ktere jsou prilis slozite na ovladani</li>
<li><strong>Investice do kvalitních cidel</strong> se vraci v podobe presnejsi automatizace</li>
<li><strong>Tree topologie</strong> je spolehlivejsi nez Air pro nosne funkce (osvetleni, topeni)</li>
<li><strong>Testovani pred nastehovanim</strong> — tydne ladeni scen a automatik usetri spoustu pozdejsich uprav</li>
</ul>

<h3>Pouzite technologie</h3>
<ul>
<li>Loxone Miniserver + Extensions</li>
<li>Loxone Touch Pure (sklo) — bile provedeni v celem dome</li>
<li>ABB Tango pro technicke mistnosti (garaz, dilna)</li>
<li>Loxone Tree cidla pohybu, teploty, vlhkosti</li>
<li>Venkovni zaluzie s Loxone pohonem</li>
</ul>',
  'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
  true,
  now() - interval '1 day'
)
ON CONFLICT (slug) DO NOTHING;
