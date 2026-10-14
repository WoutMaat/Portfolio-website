/*
 * common.js – UI-bouwstenen die meerdere schermen delen, beschikbaar als `V`.
 * Maakt ook het lege `Views`-object aan waar elk scherm zichzelf in registreert
 * (Views.home, Views.logForm, ...; zie app.js voor de routes).
 *
 * Voeg hier alleen iets toe als het door minstens twee schermen wordt gebruikt.
 */
(function () {
  'use strict';
  const { h } = U;

  window.Views = {};

  window.V = {

    // --------------------------------------------------------- opmaak

    /**
     * Paginakop met titel (h1), optionele ondertitel en optionele knoppen rechts.
     * De h1 krijgt focus na navigatie (zie app.js), zodat schermlezers de pagina aankondigen.
     */
    header(title, subtitle, actions) {
      return h('div', { class: 'page-head' },
        h('div', null,
          h('h1', { id: 'page-title', tabindex: '-1' }, title),
          subtitle ? h('p', { class: 'muted' }, subtitle) : null),
        actions ? h('div', { class: 'actions' }, actions) : null);
    },

    /**
     * Formulierveld met zichtbaar label.
     * @param {string} label
     * @param {HTMLElement} control invoerelement; moet zelf een `id` hebben (voor `label for`)
     * @param {{optional?: boolean, hint?: string}} [options]
     */
    field(label, control, options = {}) {
      return h('div', { class: 'field' },
        h('label', { for: control.id }, label, options.optional ? h('span', { class: 'opt' }, ' (optioneel)') : null),
        control,
        options.hint ? h('p', { class: 'hint' }, options.hint) : null);
    },

    /** Klein statuslabel. `kind`: 'ok' (groen), 'warn' (oranje) of 'muted' (grijs). */
    chip(text, kind = 'muted') {
      return h('span', { class: 'chip ' + kind }, text);
    },

    /** Statuslabel voor een project (actief/gearchiveerd). */
    statusChip(project) {
      return project.status === 'actief' ? V.chip('Actief', 'ok') : V.chip('Gearchiveerd', 'muted');
    },

    /** Lege staat in een kaart, met optioneel een knop of link eronder. */
    empty(message, action) {
      return h('div', { class: 'empty' }, h('p', null, message), action || null);
    },

    /** Pagina voor een onbekend of niet-toegankelijk item. */
    notFound(message) {
      return h('div', null,
        V.header('Niet gevonden'),
        V.empty(message || 'Deze pagina bestaat niet.', h('a', { class: 'btn secondary', href: '#/home' }, 'Naar home')));
    },

    /** Terugkoppeling bovenaan een subpagina. */
    back(href, label = 'Terug') {
      return h('a', { class: 'back', href }, U.icon('left', 20), label);
    },

    /** Kengetal met label (bijv. "Totaal uren" / "42 u"). */
    stat(label, value) {
      return h('div', { class: 'stat' },
        h('span', { class: 'stat-label' }, label),
        h('span', { class: 'stat-value' }, value));
    },

    /** Eén urenregel als link naar het bewerkscherm. */
    entryRow(entry) {
      return h('a', { class: 'row', href: '#/uren/bewerk/' + entry.id },
        U.dot(entry.project_id),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, Store.projectName(entry.project_id),
            entry.meeting_id ? h('span', { class: 'chip muted inline' }, 'Meeting') : null),
          entry.omschrijving ? h('span', { class: 'row-sub' }, entry.omschrijving) : null),
        h('span', { class: 'row-end' },
          h('strong', null, U.fmtHours(entry.uren)),
          h('span', { class: 'row-sub' }, U.fmtMoney(U.round2(entry.uren * entry.uurtarief)))));
    },

    // --------------------------------------------------- berekeningen

    /** Totaal aantal uren van een lijst urenregels. */
    sumHours: (entries) => U.round2(entries.reduce((sum, e) => sum + e.uren, 0)),

    /** Totaal bedrag van een lijst urenregels (uren x het vastgelegde tarief per regel). */
    sumMoney: (entries) => U.round2(entries.reduce((sum, e) => sum + e.uren * e.uurtarief, 0)),

    // ------------------------------------------------------ handelingen

    /** Voer een actie uit; bij een fout verschijnt de melding als toast. */
    attempt(action) {
      try { return action(); } catch (err) { U.toast(err.message, 'error'); return undefined; }
    },

    /**
     * Submit-handler voor een formulier: voorkomt de standaard submit, wist de oude
     * foutmelding en toont een fout uit `action` in `errorEl` (zie U.errorBox).
     */
    onSubmit(errorEl, action) {
      return (ev) => {
        ev.preventDefault();
        errorEl.textContent = '';
        try { action(); } catch (err) { errorEl.textContent = err.message; }
      };
    },
  };
})();
