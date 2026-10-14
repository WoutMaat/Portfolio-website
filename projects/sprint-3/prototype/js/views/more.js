/*
 * more.js – "Meer": beheerlinks (beheerder), mijn projecten met rol en tarief,
 * uitloggen en de demo-data herstellen.
 *
 * Route: #/meer. Op desktop staan de beheerlinks in de zijbalk; dit scherm is vooral
 * de plek voor die links op mobiel.
 */
(function () {
  'use strict';
  const { h } = U;

  /** Menuregel met icoon, titel, uitleg en een pijltje, als link. */
  function menuRow(href, icon, title, description) {
    return h('a', { class: 'row', href },
      U.icon(icon, 24),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, title),
        description ? h('span', { class: 'row-sub' }, description) : null),
      U.icon('right', 20));
  }

  /** Beheerlinks: alleen voor beheerders. */
  function adminCard() {
    return h('section', { class: 'card' },
      h('h2', null, 'Beheer'),
      h('div', { class: 'list' },
        menuRow('#/projecten', 'folder', 'Projecten', 'Tarieven en leden'),
        menuRow('#/overzicht', 'chart', 'Overzicht & export', 'Filteren en CSV'),
        menuRow('#/gebruikers', 'users', 'Gebruikers', 'Uitnodigen en rollen')));
  }

  /** De projecten waar ik lid van ben, met mijn rol en uurtarief. */
  function myProjectsCard() {
    const projects = Store.recentProjects();
    const row = (project) => {
      const rate = Store.myRate(project.id);
      return h('div', { class: 'row static' },
        U.dot(project.id),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, project.naam),
          h('span', { class: 'row-sub' }, rate ? `${rate.roleName} · ${U.fmtMoney(rate.uurtarief)} per uur` : '')));
    };
    return h('section', { class: 'card' },
      h('h2', null, 'Mijn projecten'),
      projects.length
        ? h('div', { class: 'list' }, projects.map(row))
        : h('p', { class: 'muted' }, 'Je zit nog in geen enkel project.'));
  }

  /** Uitloggen en (alleen in het prototype) de demo-data terugzetten. */
  function accountCard() {
    const logout = () => { Store.logout(); App.go('/login'); };
    const resetDemo = () => {
      if (!confirm('Alle gegevens terugzetten naar de demo-data?')) return;
      Store.resetDemo();
      U.toast('Demo-data hersteld.');
      App.refresh();
    };
    return h('section', { class: 'card' },
      h('h2', null, 'Account'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn secondary', type: 'button', onclick: logout }, U.icon('logout', 20), 'Uitloggen')),
      h('hr'),
      h('p', { class: 'hint' }, 'Prototype: zet alle nepdata terug naar het begin.'),
      h('button', { class: 'btn ghost', type: 'button', onclick: resetDemo }, 'Demo-data herstellen'));
  }

  Views.more = function (ctx) {
    const isAdmin = ctx.user.rol === 'beheerder';
    return h('div', null,
      V.header('Meer', `${ctx.user.naam} · ${isAdmin ? 'Beheerder' : 'Medewerker'}`),
      isAdmin ? adminCard() : null,
      myProjectsCard(),
      accountCard());
  };
})();
