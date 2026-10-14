/*
 * login.js – inloggen en "wachtwoord vergeten" (gesimuleerd), plus de demo-schakelaar
 * waarmee je met één klik van gebruiker wisselt. Zelf registreren bestaat niet:
 * gebruikers komen binnen op uitnodiging van een beheerder.
 *
 * Routes: #/login · #/wachtwoord-vergeten
 */
(function () {
  'use strict';
  const { h } = U;

  /** Gedeelde omlijsting: logo bovenaan in een witte kaart op de gradient-achtergrond. */
  function authLayout(...content) {
    return h('main', { class: 'auth', id: 'main' },
      h('div', { class: 'auth-card' },
        h('div', { class: 'auth-brand' },
          U.logo('logo big'),
          h('p', { class: 'brand-name' }, 'ICT Campus Foodvalley')),
        ...content));
  }

  const pageTitle = (text) => h('h1', { id: 'page-title', tabindex: '-1' }, text);

  // ------------------------------------------------------------ inloggen

  /** Snel inloggen als een van de demo-gebruikers. Alleen in het prototype. */
  function demoSwitcher() {
    return h('section', { class: 'demo', 'aria-labelledby': 'demo-title' },
      h('h2', { id: 'demo-title' }, 'Demo: snel inloggen als'),
      h('div', { class: 'demo-list' }, Store.demoUsers().map((user) =>
        h('button', {
          class: 'btn secondary', type: 'button',
          onclick() { Store.loginAs(user.id); App.go('/home'); },
        }, `${user.naam} (${user.rol})`))),
      h('p', { class: 'hint' }, 'Alleen in het prototype. Er is geen registratie: gebruikers worden door een beheerder uitgenodigd.'));
  }

  Views.login = function () {
    const err = U.errorBox('login-error');
    const email = h('input', { id: 'email', type: 'email', autocomplete: 'username', required: true, inputmode: 'email' });
    const password = h('input', { id: 'password', type: 'password', autocomplete: 'current-password', required: true });

    /** Toon een fout bij het inlogformulier en zet de cursor in het veld dat aandacht nodig heeft. */
    function showProblem(message, field) {
      err.textContent = message;
      field.focus();
    }

    function onSubmit(ev) {
      ev.preventDefault();
      err.textContent = '';
      if (!email.value.trim()) return showProblem('Vul je e-mailadres in.', email);
      if (!password.value) return showProblem('Vul je wachtwoord in.', password);
      if (!Store.login(email.value, password.value)) {
        // Bewust één melding voor "onbekend adres" en "fout wachtwoord": zo is niet te raden wie een account heeft.
        return showProblem('Dit e-mailadres of wachtwoord klopt niet. Probeer het opnieuw of kies "Wachtwoord vergeten?".', password);
      }
      return App.go('/home');
    }

    const form = h('form', { novalidate: true, onsubmit: onSubmit },
      V.field('E-mailadres', email),
      V.field('Wachtwoord', password),
      err,
      h('button', { class: 'btn primary block', type: 'submit' }, 'Inloggen'),
      h('p', { class: 'center' }, h('a', { href: '#/wachtwoord-vergeten' }, 'Wachtwoord vergeten?')));

    return authLayout(
      pageTitle('Urenregistratie'),
      h('p', { class: 'muted' }, 'Log in om je uren te schrijven.'),
      form,
      demoSwitcher());
  };

  // ------------------------------------------------- wachtwoord vergeten

  Views.forgot = function () {
    const email = h('input', { id: 'reset-email', type: 'email', autocomplete: 'username', required: true });
    const result = h('div', { role: 'status', 'aria-live': 'polite' });

    function onSubmit(ev) {
      ev.preventDefault();
      if (!email.value.trim()) {
        result.replaceChildren(h('p', { class: 'error' }, 'Vul je e-mailadres in.'));
        email.focus();
        return;
      }
      // De uitkomst (bekend of niet) tonen we nooit: het antwoord is altijd hetzelfde.
      Store.requestPasswordReset(email.value);
      result.replaceChildren(h('div', { class: 'notice' },
        h('p', null, 'Als dit e-mailadres bij ons bekend is, hebben we een link gestuurd om een nieuw wachtwoord te kiezen.'),
        h('p', { class: 'hint' }, 'Prototype: er wordt geen e-mail verstuurd. In de echte app komt hier de resetlink via e-mail.')));
    }

    const form = h('form', { novalidate: true, onsubmit: onSubmit },
      V.field('E-mailadres', email, { hint: 'We sturen een link om een nieuw wachtwoord te kiezen.' }),
      h('button', { class: 'btn primary block', type: 'submit' }, 'Stuur resetlink'),
      result);

    return authLayout(
      V.back('#/login', 'Terug naar inloggen'),
      pageTitle('Wachtwoord vergeten'),
      form);
  };
})();
