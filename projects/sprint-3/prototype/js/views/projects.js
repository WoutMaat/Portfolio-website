/*
 * projects.js – projectbeheer (alleen beheerder): lijst, aanmaken, bewerken,
 * tarieven per rol en leden met hun projectrol.
 *
 * Belangrijk: een tariefwijziging geldt alleen voor NIEUWE uren. Bestaande urenregels
 * houden het tarief dat bij het schrijven is vastgelegd (zie store.js: time_entries.uurtarief).
 *
 * Routes: #/projecten · #/projecten/nieuw · #/projecten/<id>
 */
(function () {
  'use strict';
  const { h } = U;

  /**
   * Bewerkbare lijst van rollen met uurtarief ("Developer — € 70 per uur").
   * Rollen met een `id` bestaan al; rijen zonder id worden bij opslaan aangemaakt.
   * @param {{id?: string, naam?: string, uurtarief?: number}[]} initial
   * @returns {{el: HTMLElement, values: () => {id?: string, naam: string, uurtarief: number}[]}}
   *   `el` zet je in het formulier; `values()` geeft de huidige invoer (lege rijen weggelaten).
   */
  function roleEditor(initial) {
    const rows = []; // { id, nameInput, rateInput }
    const rowsBox = h('div', { class: 'role-rows' });

    function addRow(role) {
      const nameInput = h('input', {
        type: 'text', 'aria-label': 'Naam van de rol', placeholder: 'Bijv. Developer',
        value: role.naam || '', maxlength: '60',
      });
      const rateInput = h('input', {
        type: 'text', 'aria-label': 'Uurtarief in euro', inputmode: 'decimal', placeholder: '70',
        value: role.uurtarief === undefined || role.uurtarief === null ? '' : U.fmtNum(role.uurtarief),
      });
      const row = { id: role.id, nameInput, rateInput };
      const rowEl = h('div', { class: 'role-row' },
        nameInput,
        h('span', { class: 'prefix', 'aria-hidden': 'true' }, '€'),
        rateInput,
        h('span', { class: 'suffix' }, 'per uur'),
        h('button', {
          type: 'button', class: 'btn ghost icon-btn', 'aria-label': 'Rol verwijderen',
          onclick() { rows.splice(rows.indexOf(row), 1); rowEl.remove(); },
        }, U.icon('trash', 20)));
      rows.push(row);
      rowsBox.appendChild(rowEl);
    }

    initial.forEach(addRow);
    return {
      el: h('div', null, rowsBox,
        h('button', { type: 'button', class: 'btn secondary', onclick() { addRow({}); } }, U.icon('plus', 20), 'Rol toevoegen')),
      values: () => rows
        .filter((r) => r.nameInput.value.trim() || r.rateInput.value.trim())
        .map((r) => ({ id: r.id, naam: r.nameInput.value, uurtarief: U.parseNum(r.rateInput.value) })),
    };
  }

  /** Invoervelden voor naam, omschrijving en periode; gedeeld door "nieuw" en "bewerken". */
  function projectFields(project) {
    const name = h('input', { id: 'naam', type: 'text', required: true, maxlength: '120', value: project.naam || '' });
    const description = h('textarea', { id: 'oms', rows: '3', maxlength: '500', value: project.omschrijving || '' });
    const start = h('input', { id: 'start', type: 'date', required: true, value: project.startdatum });
    const end = h('input', { id: 'eind', type: 'date', required: true, value: project.einddatum });
    return {
      name, description, start, end,
      nodes: [
        V.field('Naam', name),
        V.field('Omschrijving', description, { optional: true }),
        h('div', { class: 'two-col' }, V.field('Startdatum', start), V.field('Einddatum', end)),
      ],
    };
  }

  // ---------------------------------------------------------------- lijst

  Views.projects = function (ctx) {
    const showArchived = ctx.query.get('arch') === '1';
    const projects = Store.projects({ includeArchived: showArchived });

    const row = (p) => {
      const period = `${U.fmtShort(p.startdatum)} – ${U.fmtDate(p.einddatum)}`;
      const counts = `${Store.members(p.id).length} leden · ${Store.roles(p.id).length} rollen`;
      return h('a', { class: 'row', href: '#/projecten/' + p.id },
        U.dot(p.id),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, p.naam),
          h('span', { class: 'row-sub' }, `${period} · ${counts}`)),
        h('span', { class: 'row-end' }, V.statusChip(p)));
    };

    return h('div', null,
      V.header('Projecten', null,
        h('a', { class: 'btn primary', href: '#/projecten/nieuw' }, U.icon('plus', 20), 'Nieuw project')),
      h('label', { class: 'check' },
        h('input', {
          type: 'checkbox', checked: showArchived,
          onchange(e) { App.go('/projecten' + (e.target.checked ? '?arch=1' : '')); },
        }),
        h('span', null, 'Toon gearchiveerde projecten')),
      projects.length
        ? h('div', { class: 'card' }, h('div', { class: 'list' }, projects.map(row)))
        : V.empty('Geen projecten.'));
  };

  // ------------------------------------------------------------- aanmaken

  Views.projectNew = function () {
    const fields = projectFields({ startdatum: U.today(), einddatum: U.addDays(U.today(), 365) });
    // Handige beginstand; lege rijen worden niet aangemaakt.
    const roles = roleEditor([{ naam: 'Projectleider' }, { naam: 'Developer' }, { naam: 'Ontwerper' }]);
    const err = U.errorBox('form-error');

    const form = h('form', {
      novalidate: true,
      onsubmit: V.onSubmit(err, () => {
        const project = Store.saveProject({
          naam: fields.name.value, omschrijving: fields.description.value,
          startdatum: fields.start.value, einddatum: fields.end.value, status: 'actief',
        });
        // Het project bestaat nu. Mislukken alleen de tarieven, ga dan toch naar het
        // project zodat de beheerder ze daar kan herstellen (en voorkom een dubbel project).
        try {
          Store.saveRoles(project.id, roles.values());
          U.toast('Project aangemaakt. Voeg nu de leden toe.');
        } catch (e) {
          U.toast('Project is aangemaakt, maar de tarieven niet: ' + e.message, 'error');
        }
        App.go('/projecten/' + project.id);
      }),
    },
      fields.nodes,
      h('fieldset', { class: 'field' },
        h('legend', null, 'Tarieven per rol'),
        h('p', { class: 'hint' }, 'Het tarief geldt voor iedereen met die rol op dit project. Rollen die je leeg laat worden niet aangemaakt.'),
        roles.el),
      err,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary big', type: 'submit' }, 'Project aanmaken'),
        h('a', { class: 'btn ghost', href: '#/projecten' }, 'Annuleren')));

    return h('div', null, V.back('#/projecten', 'Projecten'), V.header('Nieuw project'), h('div', { class: 'card' }, form));
  };

  // --------------------------------------------------------------- detail

  /** Kaart "Gegevens": naam, omschrijving, periode en status. */
  function detailsCard(project) {
    const fields = projectFields(project);
    const status = h('select', { id: 'status', value: project.status },
      h('option', { value: 'actief' }, 'Actief'),
      h('option', { value: 'gearchiveerd' }, 'Gearchiveerd'));
    const err = U.errorBox('error-gegevens');

    const form = h('form', {
      novalidate: true,
      onsubmit: V.onSubmit(err, () => {
        Store.saveProject({
          id: project.id, naam: fields.name.value, omschrijving: fields.description.value,
          startdatum: fields.start.value, einddatum: fields.end.value, status: status.value,
        });
        U.toast('Gegevens opgeslagen.');
        App.refresh();
      }),
    },
      fields.nodes,
      V.field('Status', status, { hint: 'Gearchiveerde projecten verdwijnen uit het urenformulier; bestaande uren blijven bewaard.' }),
      err,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Gegevens opslaan')));

    return h('section', { class: 'card' }, h('h2', null, 'Gegevens'), form);
  }

  /** Kaart "Tarieven per rol". */
  function ratesCard(project) {
    const roles = roleEditor(Store.roles(project.id));
    const err = U.errorBox('error-tarieven');

    const form = h('form', {
      novalidate: true,
      onsubmit: V.onSubmit(err, () => {
        Store.saveRoles(project.id, roles.values());
        U.toast('Tarieven opgeslagen. Ze gelden voor nieuwe uren.');
        App.refresh();
      }),
    },
      h('p', { class: 'hint' }, 'Een nieuw tarief geldt voor uren die vanaf nu worden geschreven. Al geschreven uren behouden hun eigen tarief.'),
      roles.el,
      err,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Tarieven opslaan')));

    return h('section', { class: 'card' }, h('h2', null, 'Tarieven per rol'), form);
  }

  /** Kaart "Leden": rol wijzigen, lid verwijderen en een lid toevoegen. */
  function membersCard(project) {
    const roles = Store.roles(project.id);
    const members = Store.members(project.id);
    const memberIds = members.map((m) => m.user_id);
    const candidates = Store.users().filter((u) => !memberIds.includes(u.id));
    const roleOption = (r) => h('option', { value: r.id }, `${r.naam} – ${U.fmtMoney(r.uurtarief)}`);

    const memberRow = (m) => {
      const roleSelect = h('select', {
        'aria-label': `Rol van ${m.naam}`, value: m.project_role_id,
        onchange() {
          V.attempt(() => { Store.setMember(project.id, m.user_id, roleSelect.value); U.toast('Rol bijgewerkt.'); });
        },
      }, roles.map(roleOption));
      return h('div', { class: 'member-row' },
        h('span', { class: 'member-name' }, m.naam),
        roleSelect,
        h('button', {
          type: 'button', class: 'btn ghost icon-btn', 'aria-label': `${m.naam} verwijderen van project`,
          onclick() {
            if (!confirm(`${m.naam} van dit project halen? Bestaande uren blijven bewaard.`)) return;
            V.attempt(() => { Store.removeMember(project.id, m.user_id); App.refresh(); });
          },
        }, U.icon('trash', 20)));
    };

    let addBox;
    if (!roles.length) {
      addBox = h('p', { class: 'muted' }, 'Maak eerst minstens één rol met tarief aan.');
    } else if (!candidates.length) {
      addBox = h('p', { class: 'muted' }, 'Alle gebruikers zitten al in dit project.');
    } else {
      const personSelect = h('select', { id: 'add-user' }, candidates.map((u) => h('option', { value: u.id }, u.naam)));
      const roleSelect = h('select', { id: 'add-role' }, roles.map(roleOption));
      addBox = h('div', { class: 'add-member' },
        h('h3', null, 'Lid toevoegen'),
        h('p', { class: 'hint' }, 'Kies een gebruiker die nog niet in dit project zit en de rol die diegene hier krijgt. Het uurtarief volgt uit die rol.'),
        h('div', { class: 'two-col' }, V.field('Persoon', personSelect), V.field('Projectrol', roleSelect)),
        h('button', {
          class: 'btn secondary', type: 'button',
          onclick() {
            V.attempt(() => {
              Store.setMember(project.id, personSelect.value, roleSelect.value);
              U.toast('Lid toegevoegd.');
              App.refresh();
            });
          },
        }, U.icon('plus', 20), 'Toevoegen'));
    }

    return h('section', { class: 'card' },
      h('h2', null, `Leden (${members.length})`),
      members.length ? members.map(memberRow) : h('p', { class: 'muted' }, 'Nog geen leden.'),
      h('hr'),
      addBox);
  }

  Views.projectDetail = function (ctx) {
    let project;
    try {
      project = Store.project(ctx.params[0]);
    } catch (e) {
      return V.notFound('Dit project bestaat niet.');
    }
    return h('div', null,
      V.back('#/projecten', 'Projecten'),
      V.header(project.naam, null, V.statusChip(project)),
      detailsCard(project),
      ratesCard(project),
      membersCard(project));
  };
})();
