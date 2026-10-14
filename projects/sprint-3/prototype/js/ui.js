/*
 * ui.js – kleine hulpfuncties voor de hele app, zonder afhankelijkheid van andere
 * bestanden. Beschikbaar als `U`.
 *
 *   DOM        : U.h() bouwt elementen (veilig: tekst gaat nooit via innerHTML), U.icon(), U.logo()
 *   Datums     : datums zijn overal tekst in het formaat YYYY-MM-DD (lokale tijd, geen tijdzone-gedoe)
 *   Getallen   : opmaak in het Nederlands (decimale komma, euro's)
 *   Meldingen  : U.toast(), U.errorBox()
 */
(function () {
  'use strict';
  const U = (window.U = {});

  // ===================================================================
  // DOM
  // ===================================================================

  function appendChildren(parent, children) {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) appendChildren(parent, child);
      else parent.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
    }
  }

  /**
   * Bouw een DOM-element. Tekst wordt altijd als tekstnode toegevoegd (nooit als HTML),
   * dus gebruikersinvoer kan geen script injecteren.
   * @param {string} tag
   * @param {object|null} props `class`, `on<Event>`-handlers, `style` (object) of attributen.
   *   `value`, `checked` en `disabled` worden als property gezet; `false`/`null` wordt overgeslagen.
   * @param {...(Node|string|number|Array|null|false)} children  arrays worden platgeslagen
   * @returns {HTMLElement}
   */
  U.h = function h(tag, props, ...children) {
    const el = document.createElement(tag);
    const deferred = {};
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
        else if (key === 'value' || key === 'checked' || key === 'disabled') deferred[key] = value;
        else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
        else el.setAttribute(key, value === true ? '' : value);
      }
    }
    appendChildren(el, children);
    Object.assign(el, deferred); // `value` pas zetten als de <option>'s er al in zitten
    return el;
  };

  // Iconen: 24x24, alleen lijnen. Gebruik via U.icon(naam).
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.5.6 4 2.4 4 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  };

  /**
   * Een icoon uit `ICONS`. Het is decoratief (verborgen voor schermlezers): zet de betekenis
   * altijd ook in tekst of een aria-label.
   * @param {string} name sleutel in ICONS
   * @param {number} [size=24] breedte en hoogte in pixels
   */
  U.icon = function icon(name, size = 24) {
    const wrapper = document.createElement('span');
    wrapper.className = 'icon';
    wrapper.setAttribute('aria-hidden', 'true');
    // De SVG-inhoud komt uit de vaste lijst hierboven, nooit uit gebruikersinvoer.
    wrapper.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
    return wrapper;
  };

  // Het logo van ICT Campus Foodvalley, in twee varianten:
  //   logo.png      het volledige logo mét tekst (groot gebruik, zoals het inlogscherm)
  //   logo-icon.png alleen de regenboogbogen (kleine plekken: balk, zijbalk, tabblad)
  U.LOGO_SRC = 'assets/logo.png';
  U.LOGO_ICON_SRC = 'assets/logo-icon.png';
  const LOGO_ALT = 'ICT Campus Foodvalley';

  /** Het volledige logo met tekst. */
  U.logoFull = (className) => U.h('img', { src: U.LOGO_SRC, alt: LOGO_ALT, class: className || 'logo-full' });

  /**
   * Alleen de bogen. Staat de naam al als tekst ernaast, geef dan alt = '' mee zodat
   * schermlezers het niet dubbel voorlezen.
   */
  U.logo = (className, alt = LOGO_ALT) => U.h('img', { src: U.LOGO_ICON_SRC, alt, class: className || 'logo' });

  // Regenboogkleuren uit het logo; alleen gebruikt als klein stipje bij een project.
  const PROJECT_COLORS = ['#4AABE1', '#006BA6', '#75BD7C', '#009F57', '#F8B000', '#EE7203', '#E52B12'];

  /** Vaste kleur per project: dezelfde id geeft altijd dezelfde kleur. */
  U.projectColor = function projectColor(id) {
    let hash = 0;
    for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return PROJECT_COLORS[hash % PROJECT_COLORS.length];
  };
  U.dot = (projectId) => U.h('span', {
    class: 'dot', style: { background: U.projectColor(projectId) }, 'aria-hidden': 'true',
  });

  // ===================================================================
  // Datums (YYYY-MM-DD, lokale tijd)
  // ===================================================================

  const MS_PER_DAY = 86400000;
  const pad2 = (n) => String(n).padStart(2, '0');

  /** Date -> 'YYYY-MM-DD'. */
  U.iso = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  /** 'YYYY-MM-DD' -> Date (lokale middernacht). */
  U.parse = (isoDate) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  U.today = () => U.iso(new Date());

  /** Datum plus (of min) een aantal dagen. */
  U.addDays = (isoDate, days) => {
    const date = U.parse(isoDate);
    date.setDate(date.getDate() + days);
    return U.iso(date);
  };

  /** De maandag van de week waarin de datum valt (weken beginnen op maandag). */
  U.weekStart = (isoDate) => {
    const date = U.parse(isoDate);
    const daysSinceMonday = (date.getDay() + 6) % 7; // zondag (0) wordt 6
    date.setDate(date.getDate() - daysSinceMonday);
    return U.iso(date);
  };

  U.monthStart = (isoDate) => isoDate.slice(0, 7) + '-01';

  U.monthEnd = (isoDate) => {
    const date = U.parse(U.monthStart(isoDate));
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // dag 0 van de volgende maand = laatste dag van deze maand
    return U.iso(date);
  };

  /** Eerste dag van de maand, een aantal maanden verder (of terug). */
  U.addMonths = (isoDate, months) => {
    const date = U.parse(U.monthStart(isoDate));
    date.setMonth(date.getMonth() + months);
    return U.iso(date);
  };

  /**
   * ISO-weeknummer (week 1 is de week met de eerste donderdag van het jaar).
   * Zo tellen ook Nederlandse agenda's en de meeste roosters.
   */
  U.isoWeek = (isoDate) => {
    const date = U.parse(isoDate);
    // Ga naar de donderdag van deze week: die bepaalt in welk jaar de week valt.
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const jan4 = new Date(date.getFullYear(), 0, 4); // 4 januari ligt altijd in week 1
    const weekdayOfJan4 = (jan4.getDay() + 6) % 7;
    return 1 + Math.round(((date - jan4) / MS_PER_DAY - 3 + weekdayOfJan4) / 7);
  };

  const formatters = {
    day: new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }),
    long: new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    short: new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }),
    date: new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
    month: new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }),
    time: new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }),
  };
  const dropDots = (text) => text.replace('.', ''); // "okt." -> "okt"

  U.fmtDay = (isoDate) => dropDots(formatters.day.format(U.parse(isoDate)));       // "ma 12 okt"
  U.fmtLong = (isoDate) => formatters.long.format(U.parse(isoDate));               // "maandag 12 oktober 2026"
  U.fmtShort = (isoDate) => dropDots(formatters.short.format(U.parse(isoDate)));   // "12 okt"
  U.fmtDate = (isoDate) => dropDots(formatters.date.format(U.parse(isoDate)));     // "12 okt 2026"
  U.fmtMonth = (isoDate) => formatters.month.format(U.parse(isoDate));             // "oktober 2026"
  /** ISO-tijdstip (met tijd) -> "12 okt 2026 14:03". */
  U.fmtDateTime = (isoTimestamp) => {
    const date = new Date(isoTimestamp);
    return `${dropDots(formatters.date.format(date))} ${formatters.time.format(date)}`;
  };

  // ===================================================================
  // Getallen
  // ===================================================================

  const hoursFormat = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const moneyFormat = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

  /** Rond af op twee decimalen (voorkomt 0.1 + 0.2 = 0.30000000000000004 in totalen). */
  U.round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  U.fmtNum = (n) => hoursFormat.format(n);              // "7,5"
  U.fmtHours = (n) => hoursFormat.format(n) + ' u';     // "7,5 u"
  U.fmtMoney = (n) => moneyFormat.format(n);            // "€ 1.234,50"

  /** Lees een getal zoals een Nederlander het typt ("7,5"). Geeft NaN bij ongeldige invoer. */
  U.parseNum = (text) => {
    const n = parseFloat(String(text).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };

  // ===================================================================
  // Meldingen
  // ===================================================================

  const TOAST_DURATION_MS = 4200;

  /** Korte melding onderaan beeld. `kind` = 'error' voor een foutmelding. */
  U.toast = function toast(message, kind) {
    const container = document.getElementById('toasts');
    if (!container) return;
    const el = U.h('div', { class: 'toast ' + (kind || '') }, message);
    container.appendChild(el);
    setTimeout(() => el.remove(), TOAST_DURATION_MS);
  };

  /** Lege foutmelding voor in een formulier: vul `.textContent`, schermlezers lezen hem voor. */
  U.errorBox = (id) => U.h('div', { class: 'error', id, role: 'alert' });
})();
