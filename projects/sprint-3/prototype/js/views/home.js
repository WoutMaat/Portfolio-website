/*
 * home.js – startscherm.
 *
 * Van boven naar beneden: begroeting met weektotaal, openstaande "Was je erbij?"-
 * meldingen, de snelle acties (uren schrijven, zelfde als gisteren, recente projecten),
 * de uren van vandaag en een staafgrafiek van de week.
 *
 * Route: #/home
 */
(function () {
  'use strict';
  const { h } = U;

  const DAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  const MAX_QUICK_PROJECTS = 3;   // aantal "Snel naar"-knoppen
  const CHART_MIN_SCALE_HOURS = 8; // minimaal een werkdag als schaal, anders lijkt 1 uur vol
  const BAR_MAX_PX = 80;           // hoogte van de hoogste staaf
  const BAR_MIN_PX = 6;            // een dag met uren blijft zichtbaar
  const BAR_EMPTY_PX = 2;          // een lege dag toont een streepje

  /** Begroeting met de uren en het bedrag van de lopende week. */
  function heroCard(user, today, weekStart, weekEntries) {
    return h('section', { class: 'hero', 'aria-labelledby': 'page-title' },
      h('h1', { id: 'page-title', tabindex: '-1' }, `Hoi ${user.naam.split(' ')[0]}`),
      h('p', { class: 'hero-date' }, U.fmtLong(today)),
      h('div', { class: 'hero-stats' },
        h('div', { class: 'hero-stat' },
          h('span', null, `Uren in week ${U.isoWeek(weekStart)}`),
          h('strong', null, U.fmtHours(V.sumHours(weekEntries)))),
        h('div', { class: 'hero-stat' },
          h('span', null, 'Bedrag'),
          h('strong', null, U.fmtMoney(V.sumMoney(weekEntries))))));
  }

  /** Melding "Was je erbij?" voor één meeting. "Ja" is de handtekening en schrijft de uren. */
  function confirmationCard(meeting) {
    const answer = (status) => V.attempt(() => {
      const created = Store.respond(meeting.id, status);
      if (status === 'aanwezig') {
        U.toast(`Bedankt! ${created ? U.fmtHours(created.uren) + ' is toegevoegd aan je uren.' : 'Je aanwezigheid is vastgelegd.'}`);
      } else {
        U.toast('Genoteerd: je was er niet bij.');
      }
      App.refresh();
    });
    const when = `${U.fmtDay(meeting.datum)} · ${meeting.starttijd}–${meeting.eindtijd}`;
    const detail = `${Store.projectName(meeting.project_id)} · ${when} (${U.fmtHours(Store.meetingHours(meeting))})`;

    return h('section', { class: 'card alert-card', 'aria-label': 'Was je erbij?' },
      h('p', { class: 'eyebrow' }, 'Was je erbij?'),
      h('h2', null, meeting.titel),
      h('p', { class: 'muted' }, detail),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => answer('aanwezig') }, U.icon('check', 20), 'Ja, ik was erbij'),
        h('button', { class: 'btn secondary', type: 'button', onclick: () => answer('afwezig') }, 'Nee')));
  }

  /** Naam van de dag voor de knop "Zelfde als …": "gisteren" of de weekdag. */
  function dayName(isoDate, today) {
    if (isoDate === U.addDays(today, -1)) return 'gisteren';
    return new Intl.DateTimeFormat('nl-NL', { weekday: 'long' }).format(U.parse(isoDate));
  }

  /**
   * Kaart met de snelste routes naar uren schrijven.
   * @param {string|null} copySource dag waarvan de uren gekopieerd kunnen worden (of null)
   * @param {object[]} recentProjects actieve projecten, laatst gebruikte eerst
   */
  function actionsCard(today, copySource, recentProjects) {
    const card = h('div', { class: 'card stack' },
      h('a', { class: 'btn primary big block', href: '#/uren/nieuw' }, U.icon('plus', 24), 'Uren schrijven'));

    if (copySource) {
      const name = dayName(copySource, today);
      card.appendChild(h('button', {
        class: 'btn secondary block', type: 'button',
        onclick() {
          V.attempt(() => {
            const result = Store.copyLastDay();
            U.toast(`${result.count} ${result.count === 1 ? 'urenregel' : 'urenregels'} van ${name} gekopieerd naar vandaag.`);
            App.refresh();
          });
        },
      }, U.icon('copy', 20), `Zelfde als ${name}`));
    }

    if (recentProjects.length > 1) {
      card.appendChild(h('div', { class: 'quick' },
        h('span', { class: 'hint' }, 'Snel naar:'),
        recentProjects.slice(0, MAX_QUICK_PROJECTS).map((p) =>
          h('a', { class: 'chip link', href: '#/uren/nieuw?project=' + p.id }, U.dot(p.id), p.naam))));
    }
    if (recentProjects.length === 0) {
      card.appendChild(h('p', { class: 'hint' }, 'Je bent nog niet aan een project gekoppeld. Vraag een beheerder om je toe te voegen.'));
    }
    return card;
  }

  /** De uren die vandaag zijn geschreven. */
  function todayCard(todaysEntries) {
    return h('section', { class: 'card', 'aria-labelledby': 'today-h' },
      h('div', { class: 'card-head' },
        h('h2', { id: 'today-h' }, 'Vandaag'),
        h('strong', null, U.fmtHours(V.sumHours(todaysEntries)))),
      todaysEntries.length
        ? h('div', { class: 'list' }, todaysEntries.map((e) => V.entryRow(e)))
        : h('p', { class: 'muted' }, 'Nog geen uren geschreven vandaag.'));
  }

  /** Staafgrafiek met de uren per dag van de lopende week (maandag t/m zondag). */
  function weekCard(today, weekStart, weekEntries) {
    const days = DAY_LABELS.map((label, i) => {
      const date = U.addDays(weekStart, i);
      return { label, date, hours: V.sumHours(weekEntries.filter((e) => e.datum === date)) };
    });
    const scale = Math.max(CHART_MIN_SCALE_HOURS, ...days.map((d) => d.hours));
    const barHeight = (hours) => (hours
      ? Math.max(BAR_MIN_PX, (hours / scale) * BAR_MAX_PX)
      : BAR_EMPTY_PX);
    // Zelfde informatie als tekst voor schermlezers (de staven zelf zijn alleen visueel).
    const summary = 'Uren per dag: ' + days.map((d) => `${d.label} ${U.fmtNum(d.hours)}`).join(', ');

    return h('section', { class: 'card', 'aria-labelledby': 'week-h' },
      h('div', { class: 'card-head' },
        h('h2', { id: 'week-h' }, `Week ${U.isoWeek(weekStart)}`),
        h('a', { href: '#/uren' }, 'Alle uren')),
      h('div', { class: 'bars', role: 'img', 'aria-label': summary },
        days.map((d) => h('div', { class: 'bar-col' + (d.date === today ? ' today' : '') },
          h('span', { class: 'bar-val' }, d.hours ? U.fmtNum(d.hours) : ''),
          h('span', { class: 'bar', style: { height: barHeight(d.hours) + 'px' } }),
          h('span', { class: 'bar-lbl' }, d.label)))));
  }

  Views.home = function (ctx) {
    const today = U.today();
    const weekStart = U.weekStart(today);
    const weekEntries = Store.entries({ userId: ctx.user.id, from: weekStart, to: U.addDays(weekStart, 6) });
    const todaysEntries = weekEntries.filter((e) => e.datum === today);
    // "Zelfde als gisteren" heeft alleen zin zolang er vandaag nog niets staat.
    const copySource = todaysEntries.length === 0 ? Store.lastDayWithEntries() : null;

    return h('div', null,
      heroCard(ctx.user, today, weekStart, weekEntries),
      Store.openConfirmations().map(confirmationCard),
      actionsCard(today, copySource, Store.recentProjects()),
      todayCard(todaysEntries),
      weekCard(today, weekStart, weekEntries));
  };
})();
