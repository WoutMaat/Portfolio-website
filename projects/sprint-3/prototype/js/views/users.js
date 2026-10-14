/*
 * users.js – gebruikersbeheer (alleen beheerder): lijst, uitnodigen (gesimuleerd),
 * rol wijzigen. Zelf registreren bestaat niet: gebruikers komen binnen op uitnodiging.
 *
 * Route: #/gebruikers
 */
(function () {
  'use strict';
  const { h } = U;

  const roleOptions = () => [
    h('option', { value: 'medewerker' }, 'Medewerker'),
    h('option', { value: 'beheerder' }, 'Beheerder'),
  ];

  /** Formulier "Iemand uitnodigen". In het prototype wordt er geen e-mail verstuurd. */
  function inviteCard() {
    const name = h('input', { id: 'inv-naam', type: 'text', required: true, autocomplete: 'off' });
    const email = h('input', { id: 'inv-email', type: 'email', required: true, autocomplete: 'off', inputmode: 'email' });
    const role = h('select', { id: 'inv-rol', value: 'medewerker' }, roleOptions());
    const err = U.errorBox('inv-error');

    const form = h('form', {
      novalidate: true,
      onsubmit: V.onSubmit(err, () => {
        const user = Store.inviteUser({ naam: name.value, email: email.value, rol: role.value });
        U.toast(`Uitnodiging voor ${user.naam} is "verstuurd" (gesimuleerd, er gaat geen e-mail weg).`);
        App.refresh();
      }),
    },
      V.field('Naam', name),
      V.field('E-mailadres', email),
      V.field('Rol', role),
      err,
      h('button', { class: 'btn primary', type: 'submit' }, U.icon('plus', 20), 'Uitnodiging versturen'));

    return h('section', { class: 'card' },
      h('h2', null, 'Iemand uitnodigen'),
      h('p', { class: 'hint' }, 'De persoon krijgt een e-mail om een wachtwoord te kiezen. Zelf registreren kan niet.'),
      form);
  }

  /** Eén regel in de lijst: naam, e-mail, status en een keuzelijst voor de rol. */
  function userRow(user) {
    const roleSelect = h('select', {
      'aria-label': `Rol van ${user.naam}`, value: user.rol,
      onchange() {
        try {
          Store.setUserRole(user.id, roleSelect.value);
          U.toast('Rol bijgewerkt.');
          App.refresh();
        } catch (e) {
          U.toast(e.message, 'error');
          roleSelect.value = user.rol; // zet de keuzelijst terug naar de echte waarde
        }
      },
    }, roleOptions());

    return h('div', { class: 'member-row' },
      h('span', { class: 'member-name' }, user.naam, h('small', null, user.email),
        user.uitgenodigd ? V.chip('Uitgenodigd', 'warn') : null),
      roleSelect);
  }

  Views.users = function () {
    const users = Store.users();
    return h('div', null,
      V.header('Gebruikers', `${users.length} gebruikers`),
      h('section', { class: 'card' }, h('h2', null, 'Iedereen'), h('div', { class: 'list' }, users.map(userRow))),
      inviteCard());
  };
})();
