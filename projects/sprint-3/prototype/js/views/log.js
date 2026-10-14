/*
 * log.js – uren schrijven en bewerken (één formulier voor beide).
 *
 * Doel: zo kort mogelijk. Het laatst gebruikte project staat al gekozen, de datum is
 * vandaag, en uren kies je met een snelknop of in stappen van een kwartier.
 * Het uurtarief volgt uit je projectrol en kan niet worden gekozen of aangepast.
 *
 * Route:  #/uren/nieuw[?project=ID&datum=YYYY-MM-DD]   en   #/uren/bewerk/<id>
 */
(function () {
  'use strict';
  const { h } = U;

  const QUICK_HOURS = [0.5, 1, 2, 4, 6, 8]; // snelknoppen onder het urenveld
  const STEP = 0.25;                         // uren worden per kwartier vastgelegd
  const MAX_HOURS = 24;                      // meer dan een dag kan niet

  /** Rond af op een kwartier en begrens tussen 0,25 en 24. */
  const clampHours = (v) => Math.min(MAX_HOURS, Math.max(STEP, Math.round(v / STEP) * STEP));

  Views.logForm = function (ctx) {
    // --- Wat gaan we tonen: nieuw of bestaande regel bewerken? ---
    const editId = ctx.params[0];
    let existing = null;
    if (editId) {
      try {
        existing = Store.entry(editId); // gooit een fout als de regel niet van jou is
      } catch (e) {
        return V.notFound('Deze urenregel bestaat niet of is niet van jou.');
      }
    }

    // Projecten waar je uren op mag schrijven, laatst gebruikte bovenaan.
    // Bij bewerken kan het project inmiddels gearchiveerd zijn: toon het dan toch.
    let projects = Store.recentProjects();
    if (existing && !projects.some((p) => p.id === existing.project_id)) {
      const name = Store.projectName(existing.project_id) + ' (niet meer actief)';
      projects = [{ id: existing.project_id, naam: name }, ...projects];
    }
    if (!projects.length) {
      return h('div', null, V.header('Uren schrijven'),
        V.empty('Je bent nog niet aan een project gekoppeld. Vraag een beheerder om je toe te voegen.'));
    }

    // --- Formulierstatus ---
    // `st` is de enige bron van waarheid; de invoervelden schrijven erin en de
    // sync-functies hieronder zetten de knoppen en de infoteksten erop gelijk.
    const queryProject = ctx.query.get('project');
    const queryDate = ctx.query.get('datum');
    const st = {
      project_id: existing ? existing.project_id
        : (projects.some((p) => p.id === queryProject) ? queryProject : projects[0].id),
      datum: existing ? existing.datum
        : (/^\d{4}-\d{2}-\d{2}$/.test(queryDate || '') ? queryDate : U.today()),
      uren: existing ? existing.uren : null, // null = nog niet gekozen
    };
    // Een regel die uit een meeting komt, hoort bij dat project: niet te wijzigen.
    const lockedProject = !!(existing && existing.meeting_id);

    // --- Tariefregel ("Jouw rol: Developer · € 70,00 per uur · Totaal …") ---
    const infoLine = h('p', { class: 'info', 'aria-live': 'polite' });

    /**
     * Rol en tarief dat bij dit project hoort. Bij een bestaande regel op hetzelfde
     * project tonen we het VASTGELEGDE tarief van die regel, niet het huidige.
     */
    function rateInfo(projectId) {
      if (existing && projectId === existing.project_id) {
        let roleName = '';
        try {
          const role = Store.roles(projectId).find((r) => r.id === existing.project_role_id);
          roleName = role ? role.naam : '';
        } catch (e) {
          // Je bent geen lid meer van dit project: dan kennen we de rolnaam niet. Het
          // vastgelegde tarief tonen we nog wel.
        }
        return { roleName, uurtarief: existing.uurtarief, fixed: true };
      }
      const mine = Store.myRate(projectId);
      return mine ? { roleName: mine.roleName, uurtarief: mine.uurtarief } : null;
    }

    function updateInfo() {
      const rate = rateInfo(st.project_id);
      if (!rate) { infoLine.textContent = ''; return; }
      let text = `Jouw rol: ${rate.roleName || '–'} · ${U.fmtMoney(rate.uurtarief)} per uur${rate.fixed ? ' (vastgelegd)' : ''}`;
      if (st.uren > 0) text += ` · Totaal ${U.fmtMoney(U.round2(st.uren * rate.uurtarief))}`;
      infoLine.textContent = text;
    }

    // --- Project (radiokeuze) ---
    const projectGroup = h('fieldset', { class: 'field' },
      h('legend', null, 'Project'),
      h('div', { class: 'choices' }, projects.map((p) => {
        const rate = rateInfo(p.id) || {};
        return h('label', { class: 'choice' },
          h('input', {
            type: 'radio', name: 'project', value: p.id, checked: p.id === st.project_id,
            disabled: lockedProject && p.id !== st.project_id,
            onchange() { st.project_id = p.id; updateInfo(); },
          }),
          U.dot(p.id),
          h('span', { class: 'choice-text' }, p.naam, rate.roleName ? h('small', null, rate.roleName) : null));
      })),
      lockedProject ? h('p', { class: 'hint' }, 'Dit is een regel van een meeting; het project kun je niet wijzigen.') : null);

    // --- Datum (+ snelknoppen Vandaag/Gisteren) ---
    const dateInput = h('input', {
      id: 'datum', type: 'date', value: st.datum, required: true,
      onchange() { st.datum = dateInput.value; syncDateChips(); },
    });
    const dateChips = [['Vandaag', U.today()], ['Gisteren', U.addDays(U.today(), -1)]].map(([label, date]) =>
      h('button', {
        type: 'button', class: 'chip btn-chip', 'aria-pressed': 'false', 'data-d': date,
        onclick() { st.datum = date; dateInput.value = date; syncDateChips(); },
      }, label));
    function syncDateChips() {
      dateChips.forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-d') === st.datum)));
    }

    // --- Uren (invoerveld, kwartier-stappen en snelknoppen) ---
    const hoursInput = h('input', {
      id: 'uren', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-describedby': 'uren-hint',
      value: st.uren ? U.fmtNum(st.uren) : '',
      onchange() { readHours(true); },  // klaar met typen: netjes afronden en tonen
      oninput() { readHours(false); },  // tijdens het typen: alleen de status bijhouden
    });
    const quickButtons = QUICK_HOURS.map((q) => h('button', {
      type: 'button', class: 'chip btn-chip', 'aria-pressed': 'false', onclick() { setHours(q); },
    }, U.fmtNum(q)));

    function syncQuick() {
      quickButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(st.uren === QUICK_HOURS[i])));
    }
    /** Zet uren (afgerond/begrensd), werk het veld, de snelknoppen en de infotekst bij. */
    function setHours(value) {
      st.uren = clampHours(value);
      hoursInput.value = U.fmtNum(st.uren);
      syncQuick();
      updateInfo();
    }
    /** Lees wat de gebruiker typde. `normalize` rondt af en schrijft het terug in het veld. */
    function readHours(normalize) {
      const n = U.parseNum(hoursInput.value);
      if (Number.isFinite(n) && n > 0) {
        st.uren = n;
        if (normalize) setHours(n);
      } else {
        st.uren = null;
      }
      syncQuick();
      updateInfo();
    }
    const stepper = h('div', { class: 'stepper' },
      h('button', { type: 'button', class: 'btn secondary icon-btn', 'aria-label': 'Kwartier minder',
        onclick() { setHours((st.uren || 0.5) - STEP); } }, U.icon('minus')),
      hoursInput,
      h('button', { type: 'button', class: 'btn secondary icon-btn', 'aria-label': 'Kwartier meer',
        onclick() { setHours((st.uren || 0) + STEP); } }, U.icon('plus')));

    // --- Omschrijving ---
    const descInput = h('input', {
      id: 'omschrijving', type: 'text', maxlength: '200', autocomplete: 'off',
      placeholder: 'Waar heb je aan gewerkt?', value: existing ? existing.omschrijving : '',
    });

    // --- Opslaan ---
    const err = U.errorBox('form-error');

    /** Eerste fout in het formulier (met het veld om naar te springen), of null. */
    function firstProblem() {
      if (!st.project_id) return { message: 'Kies een project.' };
      if (!st.datum) return { message: 'Kies een datum.', focus: dateInput };
      if (!st.uren) return { message: 'Kies het aantal uren, bijvoorbeeld 4.', focus: hoursInput };
      if (st.uren > MAX_HOURS) return { message: 'Een dag heeft maar 24 uur.', focus: hoursInput };
      return null;
    }

    function onSubmit(ev) {
      ev.preventDefault();
      readHours(true);
      err.textContent = '';
      const problem = firstProblem();
      if (problem) {
        err.textContent = problem.message;
        if (problem.focus) problem.focus.focus();
        return;
      }
      const data = { project_id: st.project_id, datum: st.datum, uren: st.uren, omschrijving: descInput.value };
      try {
        if (existing) Store.updateEntry(existing.id, data);
        else Store.addEntry(data);
      } catch (e) {
        err.textContent = e.message; // bijv. "Je bent geen lid van dit project."
        return;
      }
      U.toast(existing ? 'Wijziging opgeslagen.' : `Opgeslagen: ${U.fmtHours(st.uren)}.`);
      App.go('/uren?d=' + st.datum);
    }

    const form = h('form', { novalidate: true, onsubmit: onSubmit },
      projectGroup,
      h('div', { class: 'field' },
        h('label', { for: 'datum' }, 'Datum'),
        dateInput,
        h('div', { class: 'chips' }, dateChips)),
      h('div', { class: 'field' },
        h('label', { for: 'uren' }, 'Aantal uren'),
        stepper,
        h('div', { class: 'chips chips-fill' }, quickButtons),
        h('p', { class: 'hint', id: 'uren-hint' }, 'Stappen van een kwartier (0,25).')),
      V.field('Omschrijving', descInput, { optional: true }),
      infoLine,
      err,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary big', type: 'submit' }, 'Opslaan'),
        h('a', { class: 'btn ghost', href: '#/uren' }, 'Annuleren')));

    // Verwijderen kan alleen voor handmatige regels; meeting-uren verdwijnen
    // door je aanwezigheid in de meeting op "Nee" te zetten.
    if (existing && !existing.meeting_id) {
      form.appendChild(h('div', { class: 'danger-zone' },
        h('button', {
          class: 'btn danger', type: 'button',
          onclick() {
            if (!confirm('Deze urenregel verwijderen?')) return;
            V.attempt(() => {
              Store.deleteEntry(existing.id);
              U.toast('Urenregel verwijderd.');
              App.go('/uren?d=' + existing.datum);
            });
          },
        }, U.icon('trash', 20), 'Verwijderen')));
    }

    // Beginstand van knoppen en infotekst op de status zetten.
    syncDateChips();
    syncQuick();
    updateInfo();

    return h('div', null,
      V.back('#/uren', 'Mijn uren'),
      V.header(existing ? 'Uren bewerken' : 'Uren schrijven'),
      h('div', { class: 'card' }, form));
  };
})();
