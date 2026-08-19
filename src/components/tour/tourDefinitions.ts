import type { Tour } from '../../contexts/TourContext';

export const DASHBOARD_TOUR: Tour = {
  id: 'dashboard',
  steps: [
    {
      id: 'welcome',
      target: 'center',
      title: 'Vítejte v HouseSmart!',
      content: 'Provedeme vás základními funkcemi systému. Průvodce vám ukáže klíčové části aplikace. Kdykoliv ho můžete přeskočit nebo znovu spustit z Admin → Systémová nastavení → Průvodci.',
      placement: 'center',
    },
    {
      id: 'sidebar',
      target: 'nav',
      title: 'Hlavní navigace',
      content: 'Levé menu obsahuje všechny moduly aplikace: Projekty, CRM, Sklad, Finance a další. Kliknutím na šipku vlevo ho lze skrýt a získat více pracovního prostoru.',
      placement: 'right',
      spotlightPadding: 4,
    },
    {
      id: 'header',
      target: 'header',
      title: 'Záhlaví stránky',
      content: 'Zde se zobrazuje název aktuální stránky a drobečková navigace. Vpravo najdete notifikace a přístup k nastavení účtu.',
      placement: 'bottom',
    },
  ],
};

export const PROJECTS_TOUR: Tour = {
  id: 'projects',
  steps: [
    {
      id: 'projects-new',
      target: '[data-tour="primary-action"]',
      title: 'Nový projekt',
      content: 'Kliknutím vytvoříte nový projekt. Nastavíte název, klienta, adresu, zodpovědnou osobu a termín dokončení.',
      placement: 'bottom',
      action: 'Zkuste vytvořit první projekt kliknutím na tlačítko.',
    },
    {
      id: 'projects-filter',
      target: '[data-tour="projects-filter"]',
      title: 'Filtrování a vyhledávání',
      content: 'Projekty lze filtrovat podle stavu nebo vyhledávat podle názvu a klienta. Stavy jsou konfigurovatelné v Admin → Systémová nastavení.',
      placement: 'bottom',
    },
    {
      id: 'projects-view',
      target: '[data-tour="projects-view-toggle"]',
      title: 'Kanban nebo tabulka',
      content: 'Přepněte mezi klasickou tabulkou a Kanban nástěnkou. Na Kanbanu lze projekty přetahovat mezi stavy myší.',
      placement: 'bottom',
    },
  ],
};

export const PROJECT_DETAIL_TOUR: Tour = {
  id: 'project-detail',
  steps: [
    {
      id: 'project-tabs',
      target: '[data-tour="project-tabs-section"]',
      title: 'Záložky projektu',
      content: 'Každý projekt má záložky: Přehled, Návrh, Výběr, Nabídky, Realizace, Finance, Dokumenty, Soubory, Fotky, Úkoly, E-maily a Servis. Vše na jednom místě.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
  ],
};

export const CRM_TOUR: Tour = {
  id: 'crm',
  steps: [
    {
      id: 'crm-intro',
      target: '[data-tour="crm-header"]',
      title: 'CRM – Správa klientů',
      content: 'Modul CRM slouží ke správě klientů a obchodních kontaktů. Ke každému klientovi lze přiřadit projekty, aktivity a dokumenty.',
      placement: 'bottom',
    },
    {
      id: 'crm-new',
      target: '[data-tour="primary-action"]',
      title: 'Přidat klienta',
      content: 'Kliknutím přidáte nového klienta. Zadejte jméno, kontaktní údaje a přiřaďte kategorii.',
      placement: 'bottom',
      action: 'Přidejte prvního klienta před vytvořením projektu – propojení klienta s projektem umožní generovat nabídky a faktury.',
    },
  ],
};

export const FINANCE_TOUR: Tour = {
  id: 'finance',
  steps: [
    {
      id: 'finance-stats',
      target: '[data-tour="finance-stats"]',
      title: 'Přehled plateb',
      content: 'Statistiky ukazují celkový objem faktur: fakturováno, zaplaceno, čekající platby a faktury po splatnosti. Červené číslo po splatnosti vyžaduje pozornost.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'finance-tabs',
      target: '[data-tour="finance-tabs"]',
      title: 'Faktury a ruční záznamy',
      content: 'V záložce Faktury jsou vydané faktury generované ze systému. Ruční záznamy slouží pro rychlé zadání výnosů nebo nákladů bez vytváření celé faktury.',
      placement: 'bottom',
    },
    {
      id: 'finance-new',
      target: '[data-tour="primary-action"]',
      title: 'Nová faktura',
      content: 'Faktury lze vystavit ručně nebo vygenerovat přímo z projektové nabídky v záložce Finance na detailu projektu.',
      placement: 'bottom',
    },
    {
      id: 'finance-received',
      target: '[href="/finance/prijate"]',
      title: 'Přijaté faktury',
      content: 'V levém menu Finance najdete i přijaté faktury od dodavatelů a správu dodavatelů pro kompletní finanční přehled.',
      placement: 'right',
    },
  ],
};

export const CATALOG_TOUR: Tour = {
  id: 'catalog',
  steps: [
    {
      id: 'catalog-intro',
      target: '[data-tour="catalog-header"]',
      title: 'Katalog produktů',
      content: 'Katalog obsahuje všechny vaše produkty a ceníkové položky. Produkty jsou organizovány do kategorií a lze je filtrovat podle oboru.',
      placement: 'bottom',
    },
    {
      id: 'catalog-filter',
      target: '[data-tour="catalog-filter"]',
      title: 'Filtrování produktů',
      content: 'Filtrujte produkty podle kategorie, oboru nebo ceny. Vybrané produkty lze přidat do nabídky nebo projektové specifikace.',
      placement: 'bottom',
    },
  ],
};

export const TASKS_TOUR: Tour = {
  id: 'tasks',
  steps: [
    {
      id: 'tasks-intro',
      target: '[data-tour="tasks-kanban"]',
      title: 'Kanban úkolů',
      content: 'Úkoly jsou zobrazeny jako Kanban nástěnka s přizpůsobitelnými sloupci. Úkoly lze přetahovat myší mezi stavy a přiřazovat k projektům nebo kolegům.',
      placement: 'top',
      spotlightPadding: 6,
    },
    {
      id: 'tasks-filters',
      target: '[data-tour="tasks-filters"]',
      title: 'Filtrování úkolů',
      content: 'Filtrujte úkoly podle projektu nebo zodpovědné osoby. Takto snadno vidíte co je potřeba udělat pro konkrétní projekt.',
      placement: 'bottom',
    },
    {
      id: 'tasks-new',
      target: '[data-tour="primary-action"]',
      title: 'Nový úkol',
      content: 'Vytvořte nový úkol, přiřaďte ho kolegovi, nastavte prioritu, termín a projekt. Úkoly lze vytvářet i přímo z detailu projektu.',
      placement: 'bottom',
      action: 'Zkuste přidat první úkol.',
    },
  ],
};

export const CALENDAR_TOUR: Tour = {
  id: 'calendar',
  steps: [
    {
      id: 'calendar-main',
      target: '[data-tour="calendar-main"]',
      title: 'Kalendář',
      content: 'Kalendář zobrazuje všechny události, termíny projektů, plánované servisy a pracovní záznamy. Kliknutím na den přidáte novou událost.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'calendar-views',
      target: '[data-tour="calendar-views"]',
      title: 'Zobrazení: Měsíc / Týden / Den',
      content: 'Přepínač vpravo nahoře umožňuje zobrazit kalendář jako měsíční přehled, týdenní rozvrh nebo denní detail s hodinovým rozpisem.',
      placement: 'bottom',
    },
    {
      id: 'calendar-new',
      target: '[data-tour="primary-action"]',
      title: 'Nová událost',
      content: 'Kliknutím přidáte událost přímo pro konkrétní den a čas. Události lze přiřadit k projektům a kolegům.',
      placement: 'bottom',
    },
  ],
};

export const WAREHOUSE_TOUR: Tour = {
  id: 'warehouse',
  steps: [
    {
      id: 'warehouse-stats',
      target: '[data-tour="warehouse-stats"]',
      title: 'Přehled skladu',
      content: 'Statistiky zobrazují celkový počet položek, hodnotu skladu v Kč, položky s nízkým stavem a počet položek propojených s katalogem produktů.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'warehouse-tabs',
      target: '[data-tour="warehouse-tabs"]',
      title: 'Položky, pohyby a upozornění',
      content: 'Záložka Sklad obsahuje přehled položek. Pohyby evidují příjmy a výdeje. Upozornění hlídají položky s nízkým stavem zásoby.',
      placement: 'bottom',
    },
    {
      id: 'warehouse-search',
      target: '[data-tour="warehouse-search-bar"]',
      title: 'Vyhledávání a filtry',
      content: 'Hledejte položky podle názvu nebo filtrujte podle kategorie a podkategorie. Položky lze exportovat do CSV.',
      placement: 'bottom',
    },
    {
      id: 'warehouse-new',
      target: '[data-tour="primary-action"]',
      title: 'Nová položka / pohyb',
      content: 'Přidejte novou skladovou položku nebo synchronizujte sklad s katalogem produktů jedním kliknutím.',
      placement: 'bottom',
    },
  ],
};

export const EMPLOYEES_TOUR: Tour = {
  id: 'employees',
  steps: [
    {
      id: 'employees-stats',
      target: '[data-tour="employees-stats"]',
      title: 'Přehled zaměstnanců',
      content: 'Statistiky ukazují počet zaměstnanců, certifikací, přiřazeného vybavení a brzy expirujících certifikátů.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'employees-tabs',
      target: '[data-tour="employees-tabs-section"]',
      title: 'Záložky modulu',
      content: 'Záložky umožňují správu přehledu zaměstnanců, jejich certifikací (BOZP, řidičák…), přiřazeného vybavení a evidence dovolených.',
      placement: 'bottom',
    },
  ],
};

export const SERVICE_TOUR: Tour = {
  id: 'service',
  steps: [
    {
      id: 'service-tabs',
      target: '[data-tour="service-tabs-nav"]',
      title: 'Servisní modul',
      content: 'Servisní modul obsahuje Dashboard, Tikety, Plánované servisy a Mapu objektů. Spravujte záruky, pravidelné servisy a servisní požadavky zákazníků.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'service-stats',
      target: '[data-tour="service-stats"]',
      title: 'Servisní statistiky',
      content: 'Přehled zobrazuje plánované servisy, překročené termíny, blížící se servisy a otevřené tikety. Červené hodnoty vyžadují okamžitou akci.',
      placement: 'bottom',
    },
    {
      id: 'service-new',
      target: '[data-tour="primary-action"]',
      title: 'Nový tiket',
      content: 'Vytvořte servisní tiket pro zákazníka, přiřaďte ho technikovi a nastavte prioritu. Zákazník může podávat tikety i přes klientský portál.',
      placement: 'bottom',
    },
  ],
};

export const GANTT_TOUR: Tour = {
  id: 'gantt',
  steps: [
    {
      id: 'gantt-intro',
      target: '[data-tour="gantt-controls"]',
      title: 'Ganttův diagram',
      content: 'Ganttův diagram zobrazuje všechny projekty a milníky na časové ose. Šipky vlevo/vpravo posunují zobrazené období.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'gantt-presets',
      target: '[data-tour="gantt-presets"]',
      title: 'Předdefinovaná zobrazení',
      content: 'Tlačítka 1T, 1M, 3M, 6M, 1R přepínají zoom diagramu. Tlačítko PDF umožňuje exportovat diagram pro tisk nebo sdílení.',
      placement: 'bottom',
    },
  ],
};

export const REPORTS_TOUR: Tour = {
  id: 'reports',
  steps: [
    {
      id: 'reports-stats',
      target: '[data-tour="reports-stats"]',
      title: 'Souhrnné statistiky',
      content: 'Rychlý přehled zobrazuje počet projektů, hodnotu schválených nabídek, celkový odpracovaný čas a hodnotu skladu.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'reports-tabs',
      target: '[data-tour="reports-main"]',
      title: 'Detailní reporty',
      content: 'Záložky nabízejí detailní reporty projektů, financí, odpracovaného času a skladu. Data lze exportovat do CSV pro zpracování v Excelu.',
      placement: 'top',
    },
  ],
};

export const EMAIL_TOUR: Tour = {
  id: 'emailing',
  steps: [
    {
      id: 'email-stats',
      target: '[data-tour="email-stats"]',
      title: 'Emailový přehled',
      content: 'Statistiky zobrazují celkový počet emailů, úspěšně odeslané, selhané a ve frontě čekající na odeslání.',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'email-new',
      target: '[data-tour="primary-action"]',
      title: 'Nový email',
      content: 'Napište email přímo ze systému – přiřaďte ho k projektu, vyberte šablonu a sledujte jeho doručení. Nastavte SMTP server v Admin → SMTP účty.',
      placement: 'bottom',
      action: 'Před odesíláním emailů nastavte SMTP účet v administraci.',
    },
  ],
};

export const ADMIN_TOUR: Tour = {
  id: 'admin',
  steps: [
    {
      id: 'admin-intro',
      target: 'center',
      title: 'Administrace systému',
      content: 'Tato sekce je dostupná pouze administrátorům. Zde nastavíte produkty, kategorie, tým, fakturaci, SMTP a další parametry systému.',
      placement: 'center',
    },
    {
      id: 'admin-team',
      target: '[href="/admin/team"]',
      title: 'Správa týmu',
      content: 'V sekci Tým & Role přidáte kolegy do organizace a nastavíte jim přístupová práva (Admin, Manažer, Zaměstnanec, Čtenář).',
      placement: 'right',
    },
    {
      id: 'admin-company',
      target: '[href="/admin/firma"]',
      title: 'Informace o firmě',
      content: 'Vyplňte firemní údaje – název, adresu, IČO a DIČ. Tyto údaje se použijí na fakturách a dokumentech.',
      placement: 'right',
      action: 'Doporučujeme jako první krok vyplnit informace o firmě.',
    },
    {
      id: 'admin-invoice',
      target: '[href="/admin/fakturace"]',
      title: 'Nastavení fakturace',
      content: 'Nastavte číselnou řadu faktur, splatnost, bankovní účet a logo pro tisk faktur.',
      placement: 'right',
    },
    {
      id: 'admin-products',
      target: '[href="/admin/produkty"]',
      title: 'Správa produktů',
      content: 'Přidávejte a upravujte produkty v katalogu. Produkty jsou základem pro tvorbu nabídek a projektových specifikací.',
      placement: 'right',
    },
  ],
};

export const TOURS_BY_PATH: Record<string, Tour> = {
  '/dashboard': DASHBOARD_TOUR,
  '/projekty': PROJECTS_TOUR,
  '/crm': CRM_TOUR,
  '/finance': FINANCE_TOUR,
  '/katalog': CATALOG_TOUR,
  '/ukoly': TASKS_TOUR,
  '/kalendar': CALENDAR_TOUR,
  '/sklad': WAREHOUSE_TOUR,
  '/zamestnanci': EMPLOYEES_TOUR,
  '/servis': SERVICE_TOUR,
  '/gantt': GANTT_TOUR,
  '/reporty': REPORTS_TOUR,
  '/emailing': EMAIL_TOUR,
  '/admin': ADMIN_TOUR,
};
