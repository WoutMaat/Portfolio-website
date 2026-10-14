/*
 * overview.js – overzicht en export voor de beheerder.
 *
 * Alle uren filteren op project, persoon en periode; totalen per project en per
 * persoon; de gefilterde uren downloaden als CSV (voor de verantwoording).
 *
 * Route: #/overzicht
 */
(function () {
  'use strict';
  const { h } = U;

  const MAX_TABLE_ROWS = 200; // meer regels in de tabel maakt de pagina traag; de CSV bevat alles

  /** Tel uren en bedrag op per sleutel. Geeft [{ label, uren, bedrag }], op label gesorteerd. */
  function groupTotals(entries, keyOf, labelOf) {
    const groups = {};
    entries.forEach((e) => {
      const key = keyOf(e);
      const g = groups[key] || (groups[key] = { label: labelOf(key), uren: 0, bedrag: 0 });
      g.uren = U.round2(g.uren + e.uren);
      g.bedrag = U.round2(g.bedrag + e.uren * e.uurtarief);
    });
    return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label, 'nl'));
  }

  /** Kleine totaaltabel (naam, uren, bedrag). */
  function totalsTable(title, rows) {
    return h('section', { class: 'card' },
      h('h2', null, title),
      h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null,
          h('th', null, 'Naam'), h('th', { class: 'num' }, 'Uren'), h('th', { class: 'num' }, 'Bedrag'))),
        h('tbody', null, rows.map((r) => h('tr', null,
          h('td', null, r.label),
          h('td', { class: 'num' }, U.fmtNum(r.uren)),
          h('td', { class: 'num' }, U.fmtMoney(r.bedrag))))))));
  }

  /** Tabel met de afzonderlijke urenregels (maximaal MAX_TABLE_ROWS). */
  function entriesTable(entries) {
    const shown = entries.slice(0, MAX_TABLE_ROWS);
    const headers = ['Datum', 'Persoon', 'Project', 'Omschrijving', 'Uren', 'Tarief', 'Bedrag'];
    const firstNumericColumn = 4;

    return h('section', { class: 'card' },
      h('h2', null, 'Alle uren'),
      h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, headers.map((t, i) => h('th', { class: i >= firstNumericColumn ? 'num' : '' }, t)))),
        h('tbody', null, shown.map((e) => h('tr', null,
          h('td', null, U.fmtDay(e.datum)),
          h('td', null, Store.userName(e.user_id)),
          h('td', null, Store.projectName(e.project_id)),
          h('td', null, e.omschrijving || '–', e.meeting_id ? h('span', { class: 'chip muted inline' }, 'Meeting') : null),
          h('td', { class: 'num' }, U.fmtNum(e.uren)),
          h('td', { class: 'num' }, U.fmtMoney(e.uurtarief)),
          h('td', { class: 'num' }, U.fmtMoney(U.round2(e.uren * e.uurtarief)))))))),
      entries.length > shown.length
        ? h('p', { class: 'hint' }, `Eerste ${shown.length} van ${entries.length} regels getoond; de CSV bevat alles.`)
        : null);
  }

  Views.overview = function () {
    const today = U.today();
    // Huidige filterkeuzes. Lege waarde = "alles".
    const filters = { project: '', user: '', from: U.monthStart(today), to: U.monthEnd(today) };
    const resultsBox = h('div', { 'aria-live': 'polite' });
    let current = []; // de uren die bij de filters horen; dit gaat naar de CSV

    // --- Filtervelden: elke wijziging berekent het resultaat opnieuw ---
    const projectSelect = h('select', {
      id: 'f-project', onchange() { filters.project = projectSelect.value; showResults(); },
    }, h('option', { value: '' }, 'Alle projecten'),
    Store.projects({ includeArchived: true }).map((p) => h('option', { value: p.id }, p.naam)));

    const userSelect = h('select', {
      id: 'f-user', onchange() { filters.user = userSelect.value; showResults(); },
    }, h('option', { value: '' }, 'Alle personen'),
    Store.users().map((u) => h('option', { value: u.id }, u.naam)));

    const fromInput = h('input', {
      id: 'f-from', type: 'date', value: filters.from, onchange() { filters.from = fromInput.value; showResults(); },
    });
    const toInput = h('input', {
      id: 'f-to', type: 'date', value: filters.to, onchange() { filters.to = toInput.value; showResults(); },
    });

    function setPeriod(from, to) {
      filters.from = from;
      filters.to = to;
      fromInput.value = from;
      toInput.value = to;
      showResults();
    }
    const weekStart = U.weekStart(today);
    const lastMonth = U.addMonths(today, -1);
    const periodShortcuts = [
      ['Deze week', () => setPeriod(weekStart, U.addDays(weekStart, 6))],
      ['Deze maand', () => setPeriod(U.monthStart(today), U.monthEnd(today))],
      ['Vorige maand', () => setPeriod(U.monthStart(lastMonth), U.monthEnd(lastMonth))],
      ['Alles', () => setPeriod('', '')],
    ];

    /** Haal de uren bij de huidige filters op en teken de totalen en tabellen. */
    function showResults() {
      current = Store.entries({
        projectId: filters.project || undefined, userId: filters.user || undefined,
        from: filters.from || undefined, to: filters.to || undefined,
      });
      if (!current.length) {
        resultsBox.replaceChildren(V.empty('Geen uren gevonden met deze filters.'));
        return;
      }
      resultsBox.replaceChildren(
        h('section', { class: 'card' }, h('div', { class: 'stats' },
          V.stat('Totaal uren', U.fmtHours(V.sumHours(current))),
          V.stat('Totaal bedrag', U.fmtMoney(V.sumMoney(current))),
          V.stat('Urenregels', String(current.length)))),
        h('div', { class: 'grid-2' },
          totalsTable('Per project', groupTotals(current, (e) => e.project_id, (id) => Store.projectName(id))),
          totalsTable('Per persoon', groupTotals(current, (e) => e.user_id, (id) => Store.userName(id)))),
        entriesTable(current));
    }

    const filterCard = h('section', { class: 'card', 'aria-label': 'Filters' },
      h('div', { class: 'filters' },
        V.field('Project', projectSelect), V.field('Persoon', userSelect),
        V.field('Van', fromInput), V.field('Tot en met', toInput)),
      h('div', { class: 'chips' }, periodShortcuts.map(([label, action]) =>
        h('button', { type: 'button', class: 'chip btn-chip', onclick: action }, label))));

    const downloadButton = h('button', {
      class: 'btn primary', type: 'button',
      onclick() {
        if (!current.length) { U.toast('Er zijn geen uren om te downloaden.', 'error'); return; }
        Exports.downloadCsv(`uren-${U.today()}.csv`, current);
      },
    }, U.icon('download', 20), 'CSV downloaden');

    showResults();
    return h('div', null, V.header('Overzicht & export', null, downloadButton), filterCard, resultsBox);
  };
})();
