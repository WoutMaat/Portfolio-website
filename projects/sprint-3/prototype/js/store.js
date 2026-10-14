/*
 * store.js – de datalaag. ALLE data-toegang en toegangsregels zitten hier.
 *
 * Nu: data in localStorage. Later: vervang de binnenkant door Supabase-aanroepen
 * (de tabelnamen zijn gelijk). De regels die hier in code staan ("een medewerker
 * ziet alleen eigen uren") worden dan Row Level Security-policies in de database.
 * De views praten nooit rechtstreeks met localStorage.
 *
 * Let op: de functies zijn hier synchroon; met Supabase worden ze async.
 *
 * Opbouw van dit bestand
 *   1. Constanten en opslag   : localStorage met geheugen-fallback, laden/opslaan van `db`
 *   2. Hulpfuncties           : id's, afronding, validatie, wie is ingelogd, rechtencontrole
 *   3. Store.*                : de publieke API, per onderdeel:
 *                               sessie · gebruikers · projecten · uren · meetings
 *
 * Afspraken
 *   - Elke functie die iets leest of wijzigt controleert zelf de rechten
 *     (requireMe / requireAdmin / eigenaarscontrole). Views vertrouwen daar op.
 *   - Fouten worden als Error met een Nederlandse, voor de gebruiker leesbare
 *     tekst gegooid; de view toont `err.message`.
 *   - Tabel- en veldnamen (time_entries, uurtarief, ...) zijn gelijk aan Supabase.
 *   - Het uurtarief wordt bij het schrijven van uren vastgelegd (snapshot) en
 *     verandert niet meer als het tarief van de rol later wijzigt.
 */
(function () {
  'use strict';

  // ===================================================================
  // 1. Constanten en opslag
  // ===================================================================

  const DB_KEY = 'urenregistratie.db.v1';
  const SESSION_KEY = 'urenregistratie.sessie.v1';

  const ROLE_ADMIN = 'beheerder';
  const ROLE_EMPLOYEE = 'medewerker';

  const HOUR_STEP = 0.25;            // uren worden per kwartier vastgelegd
  const MAX_HOURS_PER_ENTRY = 24;    // meer dan een dag kan niet
  const MAX_DESCRIPTION_LENGTH = 200;
  const MAX_HOURLY_RATE = 1000;      // bovengrens om typfouten te vangen
  const COPY_LOOKBACK_DAYS = 7;      // "zelfde als gisteren" kijkt maximaal een week terug

  // localStorage kan geblokkeerd zijn (privévenster): val dan terug op geheugen.
  const memory = {};
  const storage = {
    get(key) {
      try { return localStorage.getItem(key); } catch (e) { return memory[key] === undefined ? null : memory[key]; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { memory[key] = value; }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { delete memory[key]; }
    },
  };

  /** Lees de database uit de opslag; bij ontbrekende of kapotte data: demo-data. */
  function loadDatabase() {
    const raw = storage.get(DB_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.profiles && parsed.time_entries) return parsed;
      } catch (e) {
        // kapotte data: hieronder opnieuw beginnen met de demo-data
      }
    }
    const fresh = Seed.create();
    storage.set(DB_KEY, JSON.stringify(fresh));
    return fresh;
  }

  let db = loadDatabase();
  const save = () => storage.set(DB_KEY, JSON.stringify(db));

  // ===================================================================
  // 2. Hulpfuncties
  // ===================================================================

  const newId = (prefix) => prefix + '_' + Math.random().toString(36).slice(2, 9);
  const fail = (message) => { throw new Error(message); };
  const roundToQuarter = (n) => Math.round(n / HOUR_STEP) * HOUR_STEP;
  const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(U.parse(s).getTime());
  const byName = (a, b) => a.naam.localeCompare(b.naam, 'nl');

  /** "HH:MM" naar minuten sinds middernacht. */
  function minutesOf(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function findProfileByEmail(email) {
    const wanted = String(email).trim().toLowerCase();
    return db.profiles.find((p) => p.email.toLowerCase() === wanted) || null;
  }

  // --- wie is er ingelogd, en wat mag diegene ---

  function currentUser() {
    const id = storage.get(SESSION_KEY);
    return db.profiles.find((p) => p.id === id) || null;
  }
  function requireMe() {
    return currentUser() || fail('Je bent niet ingelogd.');
  }
  function requireAdmin() {
    const user = requireMe();
    if (user.rol !== ROLE_ADMIN) fail('Alleen een beheerder mag dit.');
    return user;
  }
  const isMember = (projectId, userId) =>
    db.project_members.some((m) => m.project_id === projectId && m.user_id === userId);

  /** Projectrol (met uurtarief) van een persoon op een project, of null als geen lid. */
  function roleOf(projectId, userId) {
    const membership = db.project_members.find((m) => m.project_id === projectId && m.user_id === userId);
    if (!membership) return null;
    const role = db.project_roles.find((r) => r.id === membership.project_role_id);
    return role ? { role, uurtarief: role.uurtarief } : null;
  }

  // --- validatie die op meerdere plaatsen terugkomt ---

  function assertDate(date) {
    if (!isValidDate(date)) fail('Kies een geldige datum.');
  }
  function assertHours(hours) {
    if (!(hours > 0) || hours > MAX_HOURS_PER_ENTRY) fail('Vul tussen 0,25 en 24 uur in.');
  }
  const cleanDescription = (text) => String(text || '').trim().slice(0, MAX_DESCRIPTION_LENGTH);

  /** Een urenregel van de ingelogde gebruiker, of een fout met `message`. */
  function ownEntry(id, message) {
    const me = requireMe();
    const entry = db.time_entries.find((t) => t.id === id);
    if (!entry || entry.user_id !== me.id) fail(message);
    return entry;
  }

  // ===================================================================
  // 3. Publieke API
  // ===================================================================

  const Store = {

    // ----------------------------------------------------------- sessie

    /** De ingelogde gebruiker (profiel) of null. */
    currentUser,

    /** Alle profielen, voor de demo-schakelaar. Alleen in het prototype. */
    demoUsers: () => db.profiles.slice(),

    /** Inloggen met e-mail + wachtwoord. Geeft het profiel terug, of null bij een foute combinatie. */
    login(email, password) {
      const profile = findProfileByEmail(email);
      if (!profile || password !== Seed.DEMO_PASSWORD) return null;
      storage.set(SESSION_KEY, profile.id);
      return profile;
    },

    /** Demo: direct als deze gebruiker verder, zonder wachtwoord. */
    loginAs(userId) {
      const profile = db.profiles.find((p) => p.id === userId);
      if (!profile) return null;
      storage.set(SESSION_KEY, profile.id);
      return profile;
    },

    logout() { storage.remove(SESSION_KEY); },

    /**
     * Wachtwoord vergeten. Gesimuleerd: er wordt niets verstuurd. De aanroeper toont
     * altijd dezelfde tekst, zodat niet te achterhalen is welke adressen bekend zijn.
     */
    requestPasswordReset(email) {
      return findProfileByEmail(email) !== null;
    },

    /** Demo-data terugzetten naar het begin. */
    resetDemo() {
      db = Seed.create();
      save();
    },

    // ------------------------------------------------------- gebruikers

    /** Naam bij een user_id (alleen de naam, voor weergave). */
    userName(userId) {
      const profile = db.profiles.find((p) => p.id === userId);
      return profile ? profile.naam : 'Onbekend';
    },

    /** Beheerder: iedereen. Medewerker: zichzelf en collega's op dezelfde projecten. */
    users() {
      const me = requireMe();
      if (me.rol === ROLE_ADMIN) return db.profiles.slice();
      const myProjects = db.project_members.filter((m) => m.user_id === me.id).map((m) => m.project_id);
      const visible = new Set([me.id]);
      db.project_members.forEach((m) => { if (myProjects.includes(m.project_id)) visible.add(m.user_id); });
      return db.profiles.filter((p) => visible.has(p.id));
    },

    /** Beheerder: nodig iemand uit. In het prototype wordt er geen e-mail verstuurd. */
    inviteUser({ naam, email, rol }) {
      requireAdmin();
      naam = String(naam || '').trim();
      email = String(email || '').trim().toLowerCase();
      if (!naam) fail('Vul een naam in.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Vul een geldig e-mailadres in.');
      if (findProfileByEmail(email)) fail('Dit e-mailadres is al in gebruik.');
      if (rol !== ROLE_EMPLOYEE && rol !== ROLE_ADMIN) fail('Kies een rol.');
      const profile = { id: newId('u'), naam, email, rol, uitgenodigd: true };
      db.profiles.push(profile);
      save();
      return profile;
    },

    /** Beheerder: wijzig de rol van een gebruiker. Er blijft altijd minstens één beheerder. */
    setUserRole(userId, rol) {
      requireAdmin();
      const profile = db.profiles.find((p) => p.id === userId) || fail('Gebruiker niet gevonden.');
      const adminCount = db.profiles.filter((p) => p.rol === ROLE_ADMIN).length;
      if (profile.rol === ROLE_ADMIN && rol !== ROLE_ADMIN && adminCount < 2) {
        fail('Er moet minstens één beheerder overblijven.');
      }
      profile.rol = rol;
      save();
    },

    // -------------------------------------------------------- projecten

    /** Beheerder: alle projecten. Medewerker: alleen projecten waar hij lid van is. */
    projects({ includeArchived = false } = {}) {
      const me = requireMe();
      let list = db.projects;
      if (me.rol !== ROLE_ADMIN) list = list.filter((p) => isMember(p.id, me.id));
      if (!includeArchived) list = list.filter((p) => p.status === 'actief');
      return list.slice().sort(byName);
    },

    /** Eén project; fout als het niet bestaat of je er geen toegang toe hebt. */
    project(projectId) {
      const me = requireMe();
      const project = db.projects.find((p) => p.id === projectId) || fail('Project niet gevonden.');
      if (me.rol !== ROLE_ADMIN && !isMember(projectId, me.id)) fail('Geen toegang tot dit project.');
      return project;
    },

    /** Alleen de naam, voor weergave bij uren en meetings die je al mag zien. */
    projectName(projectId) {
      const project = db.projects.find((p) => p.id === projectId);
      return project ? project.naam : 'Onbekend project';
    },

    /** Idem voor de naam van een projectrol (gebruikt bij het exporteren van uren). */
    roleName(roleId) {
      const role = db.project_roles.find((r) => r.id === roleId);
      return role ? role.naam : '';
    },

    /** Beheerder: maak een project aan (zonder `id`) of wijzig het (met `id`). */
    saveProject(data) {
      requireAdmin();
      const naam = String(data.naam || '').trim();
      if (!naam) fail('Geef het project een naam.');
      if (!isValidDate(data.startdatum)) fail('Vul een geldige startdatum in.');
      if (!isValidDate(data.einddatum)) fail('Vul een geldige einddatum in.');
      if (data.einddatum < data.startdatum) fail('De einddatum ligt voor de startdatum.');

      let project = data.id ? db.projects.find((p) => p.id === data.id) : null;
      if (!project) {
        project = { id: newId('p'), status: 'actief' };
        db.projects.push(project);
      }
      Object.assign(project, {
        naam,
        omschrijving: String(data.omschrijving || '').trim(),
        startdatum: data.startdatum,
        einddatum: data.einddatum,
        status: data.status === 'gearchiveerd' ? 'gearchiveerd' : 'actief',
      });
      save();
      return project;
    },

    /** Rollen (met tarief) van een project; alleen voor wie het project mag zien. */
    roles(projectId) {
      Store.project(projectId); // toegangscontrole
      return db.project_roles.filter((r) => r.project_id === projectId);
    },

    /**
     * Beheerder: sla de rollen van een project op.
     * @param {string} projectId
     * @param {{id?: string, naam: string, uurtarief: number}[]} rows
     *   Rijen met `id` wijzigen een bestaande rol, rijen zonder `id` maken er een aan. Rollen
     *   die niet meer in de lijst staan worden verwijderd, tenzij ze nog in gebruik zijn.
     *   Bestaande urenregels houden hun vastgelegde tarief.
     */
    saveRoles(projectId, rows) {
      requireAdmin();
      Store.project(projectId);

      const wanted = rows.map((r) => ({ id: r.id, naam: String(r.naam || '').trim(), uurtarief: Number(r.uurtarief) }));
      for (const role of wanted) {
        if (!role.naam) fail('Elke rol heeft een naam nodig.');
        const validRate = Number.isFinite(role.uurtarief) && role.uurtarief >= 0 && role.uurtarief <= MAX_HOURLY_RATE;
        if (!validRate) fail(`Vul een geldig uurtarief in voor "${role.naam}".`);
      }
      const names = wanted.map((r) => r.naam.toLowerCase());
      if (new Set(names).size !== names.length) fail('Twee rollen hebben dezelfde naam.');

      // Rollen die verdwijnen mogen nergens meer aan hangen.
      const keptIds = new Set(wanted.filter((r) => r.id).map((r) => r.id));
      const removed = db.project_roles.filter((r) => r.project_id === projectId && !keptIds.has(r.id));
      for (const role of removed) {
        const inUse = db.project_members.some((m) => m.project_role_id === role.id)
          || db.time_entries.some((t) => t.project_role_id === role.id);
        if (inUse) fail(`De rol "${role.naam}" is nog in gebruik en kan niet worden verwijderd.`);
      }

      db.project_roles = db.project_roles.filter((r) => r.project_id !== projectId || keptIds.has(r.id));
      for (const role of wanted) {
        const existing = role.id ? db.project_roles.find((r) => r.id === role.id) : null;
        if (existing) {
          existing.naam = role.naam;
          existing.uurtarief = role.uurtarief;
        } else if (!role.id) {
          db.project_roles.push({ id: newId('r'), project_id: projectId, naam: role.naam, uurtarief: role.uurtarief });
        }
      }
      save();
    },

    /** Leden van een project, verrijkt met naam en rol. */
    members(projectId) {
      Store.project(projectId); // toegangscontrole
      return db.project_members.filter((m) => m.project_id === projectId).map((m) => ({
        ...m,
        naam: Store.userName(m.user_id),
        role: db.project_roles.find((r) => r.id === m.project_role_id),
      }));
    },

    /** Beheerder: voeg een lid toe of wijzig diens rol op het project. */
    setMember(projectId, userId, roleId) {
      requireAdmin();
      const role = db.project_roles.find((r) => r.id === roleId && r.project_id === projectId);
      if (!role) fail('Kies een rol van dit project.');
      if (!db.profiles.some((p) => p.id === userId)) fail('Gebruiker niet gevonden.');
      const existing = db.project_members.find((m) => m.project_id === projectId && m.user_id === userId);
      if (existing) existing.project_role_id = roleId;
      else db.project_members.push({ project_id: projectId, user_id: userId, project_role_id: roleId });
      save();
    },

    /** Beheerder: haal een lid van het project. Geschreven uren blijven bewaard. */
    removeMember(projectId, userId) {
      requireAdmin();
      db.project_members = db.project_members.filter((m) => !(m.project_id === projectId && m.user_id === userId));
      save();
    },

    /** Mijn rol en uurtarief op een project (voor het urenformulier), of null als ik geen lid ben. */
    myRate(projectId) {
      const found = roleOf(projectId, requireMe().id);
      return found ? { roleId: found.role.id, roleName: found.role.naam, uurtarief: found.uurtarief } : null;
    },

    /** Mijn actieve projecten, het laatst gebruikte bovenaan. */
    recentProjects() {
      const me = requireMe();
      const mine = db.projects.filter((p) => p.status === 'actief' && isMember(p.id, me.id));
      const lastUsed = {}; // project_id -> datum van de laatste urenregel
      db.time_entries.filter((t) => t.user_id === me.id).forEach((t) => {
        if (!lastUsed[t.project_id] || t.datum > lastUsed[t.project_id]) lastUsed[t.project_id] = t.datum;
      });
      return mine.sort((a, b) =>
        (lastUsed[b.id] || '').localeCompare(lastUsed[a.id] || '') || byName(a, b));
    },

    // ------------------------------------------------------------- uren

    /**
     * Urenregels, nieuwste eerst.
     * Medewerker: altijd alleen eigen uren (`userId` wordt genegeerd).
     * Beheerder: alle uren, optioneel gefilterd op persoon, project en periode.
     * @param {{userId?: string, projectId?: string, from?: string, to?: string}} [filter]
     *   `from` en `to` zijn datums (YYYY-MM-DD), beide inclusief.
     */
    entries({ userId, projectId, from, to } = {}) {
      const me = requireMe();
      let list = db.time_entries;
      if (me.rol !== ROLE_ADMIN) list = list.filter((t) => t.user_id === me.id);
      else if (userId) list = list.filter((t) => t.user_id === userId);
      if (projectId) list = list.filter((t) => t.project_id === projectId);
      if (from) list = list.filter((t) => t.datum >= from);
      if (to) list = list.filter((t) => t.datum <= to);
      return list.slice().sort((a, b) =>
        b.datum.localeCompare(a.datum) || b.aangemaakt_op.localeCompare(a.aangemaakt_op));
    },

    /** Eén eigen urenregel (ook voor beheerders alleen hun eigen regels). */
    entry(entryId) {
      return ownEntry(entryId, 'Urenregel niet gevonden.');
    },

    /**
     * Schrijf uren voor de ingelogde gebruiker. Rol en tarief volgen uit het projectlidmaatschap
     * en worden als snapshot op de regel vastgelegd.
     * @param {{project_id: string, datum: string, uren: number, omschrijving?: string, meeting_id?: string|null}} data
     */
    addEntry({ project_id, datum, uren, omschrijving, meeting_id = null }) {
      const me = requireMe();
      const found = roleOf(project_id, me.id) || fail('Je bent geen lid van dit project.');
      assertDate(datum);
      assertHours(uren);
      const entry = {
        id: newId('t'),
        user_id: me.id,
        project_id,
        project_role_id: found.role.id,
        datum,
        uren: roundToQuarter(uren),
        omschrijving: cleanDescription(omschrijving),
        uurtarief: found.uurtarief, // snapshot: verandert niet meer als het roltarief wijzigt
        meeting_id,
        aangemaakt_op: new Date().toISOString(),
      };
      db.time_entries.push(entry);
      save();
      return entry;
    },

    /**
     * Wijzig een eigen urenregel. Blijft het project gelijk, dan blijft ook het vastgelegde
     * tarief gelijk; bij een ander project geldt het tarief van de rol op dat project.
     */
    updateEntry(entryId, { project_id, datum, uren, omschrijving }) {
      const me = requireMe();
      const entry = ownEntry(entryId, 'Je kunt alleen je eigen uren aanpassen.');
      assertDate(datum);
      assertHours(uren);
      if (entry.meeting_id && project_id !== entry.project_id) {
        fail('Het project van een meeting-regel kun je niet wijzigen.');
      }
      if (project_id !== entry.project_id) {
        const found = roleOf(project_id, me.id) || fail('Je bent geen lid van dit project.');
        entry.project_id = project_id;
        entry.project_role_id = found.role.id;
        entry.uurtarief = found.uurtarief;
      }
      entry.datum = datum;
      entry.uren = roundToQuarter(uren);
      entry.omschrijving = cleanDescription(omschrijving);
      save();
      return entry;
    },

    /** Verwijder een eigen urenregel. Meeting-uren kunnen alleen via de meeting verdwijnen. */
    deleteEntry(entryId) {
      const entry = ownEntry(entryId, 'Je kunt alleen je eigen uren verwijderen.');
      if (entry.meeting_id) {
        fail('Deze uren horen bij een meeting. Zet je aanwezigheid op "Nee" in de meeting om ze te verwijderen.');
      }
      db.time_entries = db.time_entries.filter((t) => t.id !== entryId);
      save();
    },

    /**
     * De laatste dag vóór vandaag (maximaal een week terug) waarop ik handmatig uren schreef,
     * of null. Dit is de bron voor "Zelfde als gisteren".
     */
    lastDayWithEntries() {
      const me = requireMe();
      const today = U.today();
      const earliest = U.addDays(today, -COPY_LOOKBACK_DAYS);
      const days = db.time_entries
        .filter((t) => t.user_id === me.id && !t.meeting_id && t.datum < today && t.datum >= earliest)
        .map((t) => t.datum)
        .sort();
      return days.length ? days[days.length - 1] : null;
    },

    /**
     * Kopieer de handmatige uren van `lastDayWithEntries()` naar vandaag. Regels van projecten
     * waar je geen lid meer van bent of die gearchiveerd zijn worden overgeslagen.
     * @returns {{from: string, count: number}} de bron-dag en het aantal gekopieerde regels
     */
    copyLastDay() {
      const me = requireMe();
      const today = U.today();
      const source = Store.lastDayWithEntries() || fail('Geen uren om te kopiëren.');
      const rows = db.time_entries.filter((t) => t.user_id === me.id && t.datum === source && !t.meeting_id);
      let count = 0;
      for (const row of rows) {
        const project = db.projects.find((p) => p.id === row.project_id);
        if (!roleOf(row.project_id, me.id) || !project || project.status !== 'actief') continue;
        Store.addEntry({ project_id: row.project_id, datum: today, uren: row.uren, omschrijving: row.omschrijving });
        count++;
      }
      return { from: source, count };
    },

    // --------------------------------------------------------- meetings

    /** Duur van een meeting in uren, afgerond op een kwartier en minimaal 0,25. */
    meetingHours(meeting) {
      const hours = (minutesOf(meeting.eindtijd) - minutesOf(meeting.starttijd)) / 60;
      return Math.max(HOUR_STEP, roundToQuarter(hours));
    },

    /** Is de meeting begonnen? Pas dan kunnen deelnemers bevestigen. */
    hasStarted(meeting) {
      return new Date(`${meeting.datum}T${meeting.starttijd}`) <= new Date();
    },

    /** Beheerder: alle meetings. Medewerker: meetings waar hij deelnemer of aanmaker van is. Nieuwste eerst. */
    meetings() {
      const me = requireMe();
      let list = db.meetings;
      if (me.rol !== ROLE_ADMIN) {
        list = list.filter((m) => m.aangemaakt_door === me.id
          || db.meeting_attendees.some((a) => a.meeting_id === m.id && a.user_id === me.id));
      }
      return list.slice().sort((a, b) => (b.datum + b.starttijd).localeCompare(a.datum + a.starttijd));
    },

    /** Eén meeting; fout als hij niet bestaat of je hem niet mag zien. */
    meeting(meetingId) {
      return Store.meetings().find((m) => m.id === meetingId) || fail('Meeting niet gevonden.');
    },

    /** Deelnemers van een meeting, verrijkt met naam, projectrol en de geschreven uren. */
    attendees(meetingId) {
      const meeting = Store.meeting(meetingId); // controleert ook of je de meeting mag zien
      return db.meeting_attendees.filter((a) => a.meeting_id === meetingId).map((a) => {
        const found = roleOf(meeting.project_id, a.user_id);
        const entry = db.time_entries.find((t) => t.meeting_id === meetingId && t.user_id === a.user_id);
        return {
          ...a,
          naam: Store.userName(a.user_id),
          roleName: found ? found.role.naam : '–',
          uren: entry ? entry.uren : 0,
        };
      });
    },

    /**
     * Maak een meeting aan en nodig de deelnemers uit.
     * @param {{titel: string, project_id: string, datum: string, starttijd: string,
     *          eindtijd: string, participantIds: string[]}} data deelnemers moeten lid van het project zijn
     */
    createMeeting({ titel, project_id, datum, starttijd, eindtijd, participantIds }) {
      const me = requireMe();
      titel = String(titel || '').trim();
      if (!titel) fail('Geef de meeting een titel.');
      const project = db.projects.find((p) => p.id === project_id) || fail('Kies een project.');
      if (me.rol !== ROLE_ADMIN && !isMember(project_id, me.id)) fail('Je bent geen lid van dit project.');
      assertDate(datum);
      const isTime = (t) => /^\d{2}:\d{2}$/.test(t || '');
      if (!isTime(starttijd) || !isTime(eindtijd)) fail('Vul een start- en eindtijd in.');
      if (minutesOf(eindtijd) <= minutesOf(starttijd)) fail('De eindtijd moet na de starttijd liggen.');
      const attendeeIds = [...new Set(participantIds || [])];
      if (!attendeeIds.length) fail('Kies minstens één deelnemer.');
      if (!attendeeIds.every((id) => isMember(project.id, id))) fail('Alle deelnemers moeten lid van het project zijn.');

      const meeting = { id: newId('m'), project_id, titel, datum, starttijd, eindtijd, aangemaakt_door: me.id };
      db.meetings.push(meeting);
      attendeeIds.forEach((userId) => db.meeting_attendees.push({
        meeting_id: meeting.id, user_id: userId, status: 'uitgenodigd', bevestigd_op: null,
      }));
      save();
      return meeting;
    },

    /** Meetings waar ik nog "Was je erbij?" moet beantwoorden (alleen als de meeting is begonnen). */
    openConfirmations() {
      const me = requireMe();
      return db.meeting_attendees
        .filter((a) => a.user_id === me.id && a.status === 'uitgenodigd')
        .map((a) => db.meetings.find((m) => m.id === a.meeting_id))
        .filter((meeting) => meeting && Store.hasStarted(meeting))
        .sort((a, b) => (a.datum + a.starttijd).localeCompare(b.datum + b.starttijd));
    },

    /**
     * Beantwoord "Was je erbij?". "aanwezig" is de handtekening (wie, wanneer, welke meeting)
     * en maakt automatisch een urenregel met de duur van de meeting; "afwezig" verwijdert die
     * regel weer. Antwoorden kan opnieuw, bijvoorbeeld bij een vergissing.
     * @param {string} meetingId
     * @param {'aanwezig'|'afwezig'} status
     * @returns {object|null} de nieuw aangemaakte urenregel, of null als er geen is aangemaakt
     */
    respond(meetingId, status) {
      const me = requireMe();
      if (status !== 'aanwezig' && status !== 'afwezig') fail('Ongeldig antwoord.');
      const meeting = db.meetings.find((m) => m.id === meetingId) || fail('Meeting niet gevonden.');
      const attendance = db.meeting_attendees.find((a) => a.meeting_id === meetingId && a.user_id === me.id)
        || fail('Je bent niet uitgenodigd voor deze meeting.');
      if (!Store.hasStarted(meeting)) fail('Je kunt pas bevestigen nadat de meeting is begonnen.');

      const existingEntry = db.time_entries.find((t) => t.meeting_id === meetingId && t.user_id === me.id);
      let created = null;
      if (status === 'aanwezig') {
        if (!existingEntry) {
          created = Store.addEntry({
            project_id: meeting.project_id, datum: meeting.datum, uren: Store.meetingHours(meeting),
            omschrijving: meeting.titel, meeting_id: meeting.id,
          });
        }
      } else if (existingEntry) {
        db.time_entries = db.time_entries.filter((t) => t.id !== existingEntry.id);
      }
      attendance.status = status;
      attendance.bevestigd_op = new Date().toISOString();
      save();
      return created;
    },
  };

  window.Store = Store;
})();
