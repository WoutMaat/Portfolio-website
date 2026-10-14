/*
 * app.js – de "schil" van de app.
 *   - routes (hash-gebaseerd, bijv. #/uren/nieuw?project=p_twin)
 *   - navigatie: onderbalk op mobiel, zijbalk op desktop
 *   - toegangscontrole per scherm (beheerschermen alleen voor beheerders)
 *   - de demo-gebruikerswissel in de bovenbalk
 *
 * Een scherm is een functie in `Views` (js/views/*.js) die een DOM-element teruggeeft.
 * `render()` bouwt bij elke navigatie de hele pagina opnieuw op; dat is eenvoudig en
 * voor deze omvang snel genoeg. Na een wijziging roept een scherm `App.refresh()` aan.
 */
(function () {
  'use strict';
  const { h } = U;

  /**
   * Routetabel. De eerste die matcht wint, dus specifieke paden (/uren/nieuw)
   * staan vóór de varianten met een id (/uren/bewerk/:id).
   *   re    : patroon op het pad; capture groups worden `ctx.params`
   *   view  : naam van de functie in `Views`
   *   nav   : welk menu-item actief is
   *   admin : true = alleen voor beheerders
   */
  const ROUTES = [
    { re: /^\/home$/, view: 'home', nav: 'home' },
    { re: /^\/uren$/, view: 'myHours', nav: 'uren' },
    { re: /^\/uren\/nieuw$/, view: 'logForm', nav: 'uren' },
    { re: /^\/uren\/bewerk\/([^/]+)$/, view: 'logForm', nav: 'uren' },
    { re: /^\/meetings$/, view: 'meetings', nav: 'meetings' },
    { re: /^\/meetings\/nieuw$/, view: 'meetingNew', nav: 'meetings' },
    { re: /^\/meetings\/([^/]+)$/, view: 'meetingDetail', nav: 'meetings' },
    { re: /^\/meer$/, view: 'more', nav: 'meer' },
    { re: /^\/projecten$/, view: 'projects', nav: 'projecten', admin: true },
    { re: /^\/projecten\/nieuw$/, view: 'projectNew', nav: 'projecten', admin: true },
    { re: /^\/projecten\/([^/]+)$/, view: 'projectDetail', nav: 'projecten', admin: true },
    { re: /^\/overzicht$/, view: 'overview', nav: 'overzicht', admin: true },
    { re: /^\/gebruikers$/, view: 'users', nav: 'gebruikers', admin: true },
  ];

  /** Paden die ook zonder inloggen bereikbaar zijn. */
  const PUBLIC_PATHS = ['/login', '/wachtwoord-vergeten'];

  /** Splits "#/pad?a=1" in { path: '/pad', query: URLSearchParams }. */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    const q = raw.indexOf('?');
    return {
      path: (q < 0 ? raw : raw.slice(0, q)) || '/',
      query: new URLSearchParams(q < 0 ? '' : raw.slice(q + 1)),
    };
  }

  /** Zoek de route bij een pad. Geeft { route, params } of null. */
  function findRoute(path) {
    for (const route of ROUTES) {
      const m = path.match(route.re);
      if (m) return { route, params: m.slice(1).map(decodeURIComponent) };
    }
    return null;
  }

  /**
   * Menu-items voor de ingelogde gebruiker.
   * `mobileOnly` = alleen in de onderbalk ("Meer"); de zijbalk heeft alle schermen zelf.
   */
  function navItems(user, openConfirmations) {
    const items = [
      { key: 'home', label: 'Home', icon: 'home', href: '#/home' },
      { key: 'uren', label: 'Mijn uren', icon: 'clock', href: '#/uren' },
      { key: 'meetings', label: 'Meetings', icon: 'calendar', href: '#/meetings', badge: openConfirmations },
    ];
    if (user.rol === 'beheerder') {
      items.push(
        { key: 'projecten', label: 'Projecten', icon: 'folder', href: '#/projecten' },
        { key: 'overzicht', label: 'Overzicht', icon: 'chart', href: '#/overzicht' },
        { key: 'gebruikers', label: 'Gebruikers', icon: 'users', href: '#/gebruikers' });
    }
    items.push({ key: 'meer', label: 'Meer', icon: 'more', href: '#/meer', mobileOnly: true });
    return items;
  }

  /** Eén menu-item (zelfde opmaak in zijbalk en onderbalk). */
  function navLink(item, activeKey) {
    return h('a', { class: 'nav-item', href: item.href, 'aria-current': item.key === activeKey ? 'page' : null },
      U.icon(item.icon, 24),
      h('span', null, item.label),
      item.badge ? h('span', { class: 'badge', 'aria-label': `${item.badge} openstaand` }, String(item.badge)) : null);
  }

  /** De omlijsting rond een scherm: zijbalk, bovenbalk, inhoud en onderbalk. */
  function shell(content, activeNav, user) {
    const items = navItems(user, Store.openConfirmations().length);
    const sideItems = items.filter((i) => !i.mobileOnly);
    // Onderbalk: Home, Uren, Meetings en Meer (de eerste drie + het laatste item).
    const bottomItems = [items[0], items[1], items[2], items[items.length - 1]];
    // De beheerschermen staan in de onderbalk onder "Meer".
    const bottomActive = ['projecten', 'overzicht', 'gebruikers'].includes(activeNav) ? 'meer' : activeNav;

    const demoSelect = h('select', {
      class: 'demo-select', 'aria-label': 'Demo: wissel van gebruiker', value: user.id,
      onchange(e) { Store.loginAs(e.target.value); App.go('/home'); },
    }, Store.demoUsers().map((u) => h('option', { value: u.id }, `${u.naam} (${u.rol})`)));

    const logout = () => { Store.logout(); App.go('/login'); };

    return h('div', { class: 'shell' },
      h('a', { class: 'skip', href: '#main', onclick(e) { e.preventDefault(); document.getElementById('main').focus(); } }, 'Naar inhoud'),
      h('aside', { class: 'sidebar' },
        h('div', { class: 'brand' }, U.logo('logo'), h('span', null, 'ICT Campus Foodvalley')),
        h('nav', { 'aria-label': 'Hoofdmenu' }, sideItems.map((i) => navLink(i, activeNav))),
        h('div', { class: 'side-foot' },
          h('p', { class: 'who' }, user.naam, h('small', null, user.rol === 'beheerder' ? 'Beheerder' : 'Medewerker')),
          h('button', { class: 'btn ghost light', type: 'button', onclick: logout }, U.icon('logout', 20), 'Uitloggen'))),
      h('div', { class: 'content' },
        h('header', { class: 'topbar' },
          h('div', { class: 'brand-mobile' }, U.logo('logo'), h('span', null, 'Urenregistratie')),
          h('div', { class: 'demo-wrap' }, h('span', { class: 'demo-label' }, 'Demo:'), demoSelect)),
        h('main', { id: 'main', tabindex: '-1' }, content)),
      h('nav', { class: 'bottom-nav', 'aria-label': 'Hoofdmenu' }, bottomItems.map((i) => navLink(i, bottomActive))));
  }

  /** Eenvoudige foutpagina's in dezelfde opmaak. */
  function messagePage(title, text) {
    return h('div', null, V.header(title),
      V.empty(text, h('a', { class: 'btn secondary', href: '#/home' }, 'Naar home')));
  }

  /**
   * Bouw de pagina op voor de huidige URL.
   * @param {boolean} isNavigation true bij echte navigatie (scroll naar boven en focus
   *   op de paginatitel voor schermlezers); false bij een refresh na een wijziging,
   *   dan blijft de scrollpositie staan.
   */
  function render(isNavigation) {
    const root = document.getElementById('app');
    const { path, query } = parseHash();
    const user = Store.currentUser();
    const previousScroll = window.scrollY;
    root.replaceChildren();

    // Niet ingelogd: alleen het inlogscherm en "wachtwoord vergeten".
    if (!user) {
      if (!PUBLIC_PATHS.includes(path)) history.replaceState(null, '', '#/login');
      const view = path === '/wachtwoord-vergeten' ? Views.forgot : Views.login;
      root.appendChild(view({ user: null, params: [], query }));
      document.title = 'Inloggen – Urenregistratie';
      return;
    }

    // Wel ingelogd maar op een publiek pad of de root: doorsturen naar home.
    if (path === '/' || PUBLIC_PATHS.includes(path)) {
      history.replaceState(null, '', '#/home');
      render(true);
      return;
    }

    const found = findRoute(path);
    let content;
    if (!found) {
      content = V.notFound('Deze pagina bestaat niet.');
    } else if (found.route.admin && user.rol !== 'beheerder') {
      // De echte afdwinging zit in de datalaag; dit is alleen een nette melding.
      content = messagePage('Geen toegang', 'Dit onderdeel is alleen voor beheerders.');
    } else {
      try {
        content = Views[found.route.view]({ user, params: found.params, query });
      } catch (err) {
        console.error(err);
        content = messagePage('Er ging iets mis', err.message || 'Onbekende fout.');
      }
    }

    root.appendChild(shell(content, found ? found.route.nav : '', user));

    const title = document.getElementById('page-title');
    document.title = (title ? title.textContent : 'Urenregistratie') + ' – Urenregistratie';
    if (isNavigation) {
      window.scrollTo(0, 0);
      if (title) title.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, previousScroll);
    }
  }

  /** Publieke API voor de schermen. */
  window.App = {
    /** Ga naar een pad zoals '/uren?d=2026-10-12'. Rendert ook als je al op dat pad staat. */
    go(path) {
      if (location.hash === '#' + path) render(true);
      else location.hash = path;
    },
    /** Teken het huidige scherm opnieuw (na een wijziging), zonder te scrollen. */
    refresh() { render(false); },
  };

  window.addEventListener('hashchange', () => render(true));
  window.addEventListener('DOMContentLoaded', () => render(true));
})();
