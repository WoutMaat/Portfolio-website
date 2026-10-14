/*
 * myhours.js – "Mijn uren": eigen uren per week of per maand, met totalen (uren en
 * bedrag), subtotaal per project en bewerken door op een regel te tikken.
 *
 * Route: #/uren[?d=YYYY-MM-DD&m=week|maand]
 *   d = een datum binnen de getoonde periode, m = week- of maandweergave.
 */
(function () {
  'use strict';
  const { h } = U;

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const link = (date, mode) => `#/uren?d=${date}&m=${mode}`;

  /**
   * Begin, einde en navigatie van de getoonde periode.
   * @param {'week'|'maand'} mode
   * @param {string} anchor een datum (YYYY-MM-DD) binnen de periode
   */
  function period(mode, anchor) {
    if (mode === 'week') {
      const from = U.weekStart(anchor);
      const to = U.addDays(from, 6);
      return {
        from, to,
        label: `Week ${U.isoWeek(from)} · ${U.fmtShort(from)} – ${U.fmtShort(to)}`,
        prev: U.addDays(from, -7), next: U.addDays(from, 7),
        prevLabel: 'Vorige week', nextLabel: 'Volgende week',
      };
    }
    const from = U.monthStart(anchor);
    const month = U.fmtMonth(from);
    return {
      from, to: U.monthEnd(anchor),
      label: month.charAt(0).toUpperCase() + month.slice(1),
      prev: U.addMonths(from, -1), next: U.addMonths(from, 1),
      prevLabel: 'Vorige maand', nextLabel: 'Volgende maand',
    };
  }

  /** Uren en bedrag per project: [{ projectId, hours, amount }]. */
  function totalsPerProject(entries) {
    const byProject = {};
    entries.forEach((e) => {
      const t = byProject[e.project_id] || (byProject[e.project_id] = { projectId: e.project_id, hours: 0, amount: 0 });
      t.hours += e.uren;
      t.amount += e.uren * e.uurtarief;
    });
    return Object.values(byProject);
  }

  /** Eén dag met zijn urenregels en een plusknop om uren op die dag toe te voegen. */
  function daySection(date, entries, today) {
    const rows = entries.filter((e) => e.datum === date);
    return h('section', { class: 'day' },
      h('div', { class: 'day-head' },
        h('h3', null, U.fmtDay(date), date === today ? h('span', { class: 'chip ok inline' }, 'Vandaag') : null),
        h('span', { class: 'day-total' }, rows.length ? U.fmtHours(V.sumHours(rows)) : '–'),
        h('a', {
          class: 'add-link', href: '#/uren/nieuw?datum=' + date, 'aria-label': 'Uren toevoegen op ' + U.fmtDay(date),
        }, U.icon('plus', 20))),
      rows.length ? h('div', { class: 'list' }, rows.map((e) => V.entryRow(e))) : null);
  }

  Views.myHours = function (ctx) {
    const mode = ctx.query.get('m') === 'maand' ? 'maand' : 'week';
    const queryDate = ctx.query.get('d');
    const anchor = ISO_DATE.test(queryDate || '') ? queryDate : U.today();
    const range = period(mode, anchor);
    const entries = Store.entries({ userId: ctx.user.id, from: range.from, to: range.to });
    const today = U.today();

    const periodNav = h('div', { class: 'period-nav' },
      h('a', { class: 'btn secondary icon-btn', href: link(range.prev, mode), 'aria-label': range.prevLabel }, U.icon('left')),
      h('div', { class: 'period-label', 'aria-live': 'polite' }, range.label),
      h('a', { class: 'btn secondary icon-btn', href: link(range.next, mode), 'aria-label': range.nextLabel }, U.icon('right')));

    const modeToggle = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Weergave' },
      h('a', { href: link(anchor, 'week'), 'aria-current': mode === 'week' ? 'true' : null }, 'Week'),
      h('a', { href: link(anchor, 'maand'), 'aria-current': mode === 'maand' ? 'true' : null }, 'Maand'));

    // Subtotalen per project: in de maandweergave altijd, in de weekweergave pas bij >1 project.
    const perProject = totalsPerProject(entries);
    const showSubtotals = perProject.length > 0 && (mode === 'maand' || perProject.length > 1);

    const summary = h('section', { class: 'card', 'aria-label': 'Totalen' },
      h('div', { class: 'stats' },
        V.stat('Totaal uren', U.fmtHours(V.sumHours(entries))),
        V.stat('Totaal bedrag', U.fmtMoney(V.sumMoney(entries)))),
      showSubtotals
        ? h('ul', { class: 'subtotals' }, perProject.map((t) => h('li', null,
          U.dot(t.projectId),
          h('span', null, Store.projectName(t.projectId)),
          h('span', { class: 'right' }, `${U.fmtHours(U.round2(t.hours))} · ${U.fmtMoney(U.round2(t.amount))}`))))
        : null);

    // Week: alle zeven dagen (weekend alleen als er uren staan). Maand: alleen dagen met uren, nieuwste eerst.
    let days;
    if (mode === 'week') {
      days = [0, 1, 2, 3, 4, 5, 6].map((i) => U.addDays(range.from, i))
        .filter((d) => ![0, 6].includes(U.parse(d).getDay()) || entries.some((e) => e.datum === d));
    } else {
      days = [...new Set(entries.map((e) => e.datum))].sort().reverse();
    }

    return h('div', null,
      V.header('Mijn uren', null,
        h('a', { class: 'btn primary', href: '#/uren/nieuw' }, U.icon('plus', 20), 'Uren schrijven')),
      modeToggle, periodNav, summary,
      days.length
        ? h('div', null, days.map((d) => daySection(d, entries, today)))
        : V.empty('Geen uren in deze maand.'));
  };
})();
