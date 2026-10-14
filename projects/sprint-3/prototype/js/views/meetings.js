/*
 * meetings.js – meetings: lijst, aanmaken en detail.
 *
 * Werkwijze: de maker kiest project, tijd en deelnemers. Elke deelnemer krijgt in de
 * app de vraag "Was je erbij?". "Ja" is de handtekening (wie, wanneer, welke meeting)
 * en maakt automatisch een urenregel. Per meeting is een PDF te downloaden of af te
 * drukken als bewijslast voor de subsidie.
 *
 * Routes: #/meetings · #/meetings/nieuw · #/meetings/<id>
 */
(function () {
  'use strict';
  const { h } = U;

  /** Statuslabel van één deelnemer. */
  function attendeeChip(attendee) {
    if (attendee.status === 'aanwezig') return V.chip('Aanwezig', 'ok');
    if (attendee.status === 'afwezig') return V.chip('Niet aanwezig', 'muted');
    return V.chip('Nog niet bevestigd', 'warn');
  }

  /** Eén regel in de meetinglijst, met "x van y bevestigd". */
  function meetingRow(meeting, myUserId) {
    const attendees = Store.attendees(meeting.id);
    const answered = attendees.filter((a) => a.status !== 'uitgenodigd').length;
    const mine = attendees.find((a) => a.user_id === myUserId);
    const iMustAnswer = mine && mine.status === 'uitgenodigd' && Store.hasStarted(meeting);
    const subtitle = `${Store.projectName(meeting.project_id)} · ${U.fmtDay(meeting.datum)} · ${meeting.starttijd}–${meeting.eindtijd}`;

    return h('a', { class: 'row', href: '#/meetings/' + meeting.id },
      U.dot(meeting.project_id),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, meeting.titel),
        h('span', { class: 'row-sub' }, subtitle)),
      h('span', { class: 'row-end' },
        iMustAnswer ? V.chip('Jij bevestigt nog', 'warn') : null,
        h('span', { class: 'row-sub' }, `${answered} van ${attendees.length} bevestigd`)));
  }

  // ---------------------------------------------------------------- lijst

  Views.meetings = function (ctx) {
    const all = Store.meetings();
    const waitingIds = Store.openConfirmations().map((m) => m.id);

    const section = (title, list) => (list.length
      ? h('section', { class: 'card' }, h('h2', null, title),
        h('div', { class: 'list' }, list.map((m) => meetingRow(m, ctx.user.id))))
      : null);

    return h('div', null,
      V.header('Meetings', null,
        h('a', { class: 'btn primary', href: '#/meetings/nieuw' }, U.icon('plus', 20), 'Nieuwe meeting')),
      all.length
        ? [
          section('Wacht op jouw bevestiging', all.filter((m) => waitingIds.includes(m.id))),
          section('Gepland', all.filter((m) => !Store.hasStarted(m))),
          section('Eerder', all.filter((m) => Store.hasStarted(m) && !waitingIds.includes(m.id))),
        ]
        : V.empty('Er zijn nog geen meetings.'));
  };

  // ------------------------------------------------------------- aanmaken

  Views.meetingNew = function () {
    const projects = Store.projects();
    if (!projects.length) {
      return h('div', null, V.header('Nieuwe meeting'), V.empty('Je bent nog niet aan een project gekoppeld.'));
    }

    // Aangevinkte deelnemers (user_id's). Wordt gevuld vanuit de leden van het project.
    let participants = new Set();

    const titleInput = h('input', {
      id: 'titel', type: 'text', required: true, maxlength: '120', autocomplete: 'off', placeholder: 'Bijv. Sprintplanning',
    });
    const projectSelect = h('select', {
      id: 'project', value: projects[0].id, onchange() { renderParticipants(true); },
    }, projects.map((p) => h('option', { value: p.id }, p.naam)));
    const dateInput = h('input', { id: 'datum', type: 'date', required: true, value: U.today() });
    const startInput = h('input', { id: 'start', type: 'time', required: true, value: '09:00' });
    const endInput = h('input', { id: 'eind', type: 'time', required: true, value: '10:00' });
    const participantsBox = h('fieldset', { class: 'field' });
    const durationInfo = h('p', { class: 'info', 'aria-live': 'polite' });

    /** Toon de duur (dit wordt het standaard aantal uren per deelnemer). */
    function updateDuration() {
      // "HH:MM" sorteert als tekst correct, dus een vergelijking volstaat.
      const valid = startInput.value && endInput.value && endInput.value > startInput.value;
      if (!valid) {
        durationInfo.textContent = '';
        return;
      }
      const hours = Store.meetingHours({ starttijd: startInput.value, eindtijd: endInput.value });
      durationInfo.textContent = `Duur: ${U.fmtHours(hours)} — dit wordt de standaard in de urenregel van elke deelnemer.`;
    }
    startInput.addEventListener('input', updateDuration);
    endInput.addEventListener('input', updateDuration);

    /** (Her)teken de deelnemerslijst. `selectAll` = bij een ander project iedereen aanvinken. */
    function renderParticipants(selectAll) {
      const members = Store.members(projectSelect.value);
      if (selectAll) participants = new Set(members.map((m) => m.user_id));

      const list = members.length
        ? h('div', { class: 'choices' }, members.map((m) => h('label', { class: 'choice' },
          h('input', {
            type: 'checkbox', value: m.user_id, checked: participants.has(m.user_id),
            onchange(e) { if (e.target.checked) participants.add(m.user_id); else participants.delete(m.user_id); },
          }),
          h('span', { class: 'choice-text' }, m.naam, m.role ? h('small', null, m.role.naam) : null))))
        : h('p', { class: 'muted' }, 'Dit project heeft nog geen leden.');
      participantsBox.replaceChildren(h('legend', null, 'Deelnemers'), list);
    }
    renderParticipants(true);
    updateDuration();

    const err = U.errorBox('form-error');
    const form = h('form', {
      novalidate: true,
      onsubmit: V.onSubmit(err, () => {
        const meeting = Store.createMeeting({
          titel: titleInput.value, project_id: projectSelect.value, datum: dateInput.value,
          starttijd: startInput.value, eindtijd: endInput.value, participantIds: [...participants],
        });
        U.toast('Meeting aangemaakt. Deelnemers krijgen een melding in de app.');
        App.go('/meetings/' + meeting.id);
      }),
    },
      V.field('Titel', titleInput),
      V.field('Project', projectSelect),
      V.field('Datum', dateInput),
      h('div', { class: 'two-col' }, V.field('Starttijd', startInput), V.field('Eindtijd', endInput)),
      durationInfo,
      participantsBox,
      err,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary big', type: 'submit' }, 'Meeting aanmaken'),
        h('a', { class: 'btn ghost', href: '#/meetings' }, 'Annuleren')));

    return h('div', null, V.back('#/meetings', 'Meetings'), V.header('Nieuwe meeting'), h('div', { class: 'card' }, form));
  };

  // --------------------------------------------------------------- detail

  /**
   * Inhoud van de kaart "Jouw bevestiging". Er zijn vier toestanden:
   * meeting nog niet begonnen · nog niet beantwoord · bevestigd · afgemeld.
   */
  function confirmationContent(meeting, mine, started, answer) {
    if (!started) {
      return h('p', { class: 'muted' },
        `Je kunt bevestigen zodra de meeting is begonnen (${U.fmtDay(meeting.datum)} ${meeting.starttijd}).`);
    }
    if (mine.status === 'uitgenodigd') {
      return [
        h('p', null, h('strong', null, 'Was je erbij?')),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => answer('aanwezig') }, U.icon('check', 20), 'Ja, ik was erbij'),
          h('button', { class: 'btn secondary', type: 'button', onclick: () => answer('afwezig') }, 'Nee')),
      ];
    }
    const present = mine.status === 'aanwezig';
    const when = U.fmtDateTime(mine.bevestigd_op);
    return [
      h('p', null, present
        ? `Je hebt bevestigd dat je erbij was (${when}).`
        : `Je hebt aangegeven dat je er niet bij was (${when}).`),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => answer(present ? 'afwezig' : 'aanwezig') },
        present ? 'Toch niet aanwezig' : 'Toch aanwezig'),
    ];
  }

  Views.meetingDetail = function (ctx) {
    let meeting;
    try {
      meeting = Store.meeting(ctx.params[0]);
    } catch (e) {
      return V.notFound('Deze meeting bestaat niet of je hebt er geen toegang toe.');
    }

    const attendees = Store.attendees(meeting.id);
    const mine = attendees.find((a) => a.user_id === ctx.user.id);
    const present = attendees.filter((a) => a.status === 'aanwezig');
    const totalHours = U.round2(present.reduce((sum, a) => sum + a.uren, 0));

    const answer = (status) => V.attempt(() => {
      const created = Store.respond(meeting.id, status);
      if (status === 'aanwezig') {
        U.toast(created ? `Bevestigd. ${U.fmtHours(created.uren)} toegevoegd aan je uren.` : 'Je aanwezigheid is bevestigd.');
      } else {
        U.toast('Je bent als niet aanwezig genoteerd; de urenregel is verwijderd.');
      }
      App.refresh();
    });

    const fact = (label, value) => h('div', null, h('dt', null, label), h('dd', null, value));
    const headers = ['Naam', 'Rol', 'Status', 'Bevestigd op', 'Uren'];

    return h('div', null,
      V.back('#/meetings', 'Meetings'),
      V.header(meeting.titel, `${Store.projectName(meeting.project_id)} · ${U.fmtLong(meeting.datum)}`),

      h('section', { class: 'card' },
        h('dl', { class: 'facts' },
          fact('Tijd', `${meeting.starttijd} – ${meeting.eindtijd} (${U.fmtHours(Store.meetingHours(meeting))})`),
          fact('Aangemaakt door', Store.userName(meeting.aangemaakt_door)),
          fact('Aanwezig', `${present.length} van ${attendees.length} deelnemers · ${U.fmtHours(totalHours)} totaal`))),

      mine
        ? h('section', { class: 'card alert-card' }, h('h2', null, 'Jouw bevestiging'),
          confirmationContent(meeting, mine, Store.hasStarted(meeting), answer))
        : null,

      h('section', { class: 'card' },
        h('h2', null, 'Deelnemers'),
        h('div', { class: 'table-wrap' },
          h('table', null,
            h('thead', null, h('tr', null, headers.map((t, i) => h('th', { class: i === headers.length - 1 ? 'num' : '' }, t)))),
            h('tbody', null, attendees.map((a) => h('tr', null,
              h('td', null, a.naam),
              h('td', null, a.roleName),
              h('td', null, attendeeChip(a)),
              h('td', null, a.bevestigd_op ? U.fmtDateTime(a.bevestigd_op) : '–'),
              h('td', { class: 'num' }, a.status === 'aanwezig' ? U.fmtNum(a.uren) : '–'))))))),

      h('section', { class: 'card' },
        h('h2', null, 'Bewijsstuk'),
        h('p', { class: 'muted' }, 'PDF met deelnemers, aanvinkmoment en uren, bedoeld als bewijslast voor de subsidie (A4, geschikt om af te drukken).'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => V.attempt(() => Exports.downloadMeetingPdf(meeting.id)) },
            U.icon('download', 20), 'PDF downloaden'),
          h('button', { class: 'btn secondary', type: 'button', onclick: () => V.attempt(() => Exports.openMeetingPdf(meeting.id)) },
            U.icon('print', 20), 'Openen om af te drukken'))));
  };
})();
