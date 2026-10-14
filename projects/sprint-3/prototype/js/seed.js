/*
 * seed.js – nepdata voor het prototype, beschikbaar als `Seed`.
 *
 * Inhoud: 1 beheerder, 4 medewerkers, 3 projecten met tarieven per rol, urenregels
 * van de afgelopen drie weken en 2 meetings (waarvan 1 met een openstaande bevestiging
 * voor Jan Bakker). Datums zijn relatief aan vandaag, zodat het scherm altijd gevuld is.
 *
 * De vorm van de data komt overeen met de Supabase-tabellen (zie js/types.js).
 */
(function () {
  'use strict';

  /** Alle demo-accounts gebruiken dit wachtwoord. Alleen voor het prototype! */
  const DEMO_PASSWORD = 'welkom123';

  const HOURS_PATTERN = [4, 6, 7.5, 8, 3.5, 6.5];    // wisselende dagen, deterministisch
  const WORK_NOTES = [
    'Ontwikkeling', 'Overleg en afstemming', 'Onderzoek', 'Ontwerp schermen',
    'Testen en bugfixes', 'Documentatie', 'Voorbereiding workshop', 'Data opschonen',
  ];
  const HISTORY_DAYS = 21;                           // zoveel dagen terug krijgen medewerkers uren

  const profiles = () => [
    { id: 'u_anna', naam: 'Anna de Vries', email: 'anna@voorbeeld.nl', rol: 'beheerder' },
    { id: 'u_jan', naam: 'Jan Bakker', email: 'jan@voorbeeld.nl', rol: 'medewerker' },
    { id: 'u_sara', naam: 'Sara El Amrani', email: 'sara@voorbeeld.nl', rol: 'medewerker' },
    { id: 'u_pieter', naam: 'Pieter Smit', email: 'pieter@voorbeeld.nl', rol: 'medewerker' },
    { id: 'u_lisa', naam: 'Lisa van Dijk', email: 'lisa@voorbeeld.nl', rol: 'medewerker' },
  ];

  const projects = (today) => [
    {
      id: 'p_twin', naam: 'Digital Twin Voedselketen',
      omschrijving: 'Digitale tweeling van de keten van boer tot bord.',
      startdatum: U.addDays(today, -120), einddatum: U.addDays(today, 240), status: 'actief',
    },
    {
      id: 'p_data', naam: 'Data-platform Foodvalley',
      omschrijving: 'Gedeeld dataplatform voor aangesloten bedrijven.',
      startdatum: U.addDays(today, -90), einddatum: U.addDays(today, 300), status: 'actief',
    },
    {
      id: 'p_hub', naam: 'Kennishub & Events',
      omschrijving: 'Kennisdeling, workshops en netwerkbijeenkomsten.',
      startdatum: U.addDays(today, -60), einddatum: U.addDays(today, 180), status: 'actief',
    },
  ];

  const projectRoles = () => [
    { id: 'r_twin_pl', project_id: 'p_twin', naam: 'Projectleider', uurtarief: 85 },
    { id: 'r_twin_dev', project_id: 'p_twin', naam: 'Developer', uurtarief: 70 },
    { id: 'r_twin_ont', project_id: 'p_twin', naam: 'Ontwerper', uurtarief: 65 },
    { id: 'r_data_pl', project_id: 'p_data', naam: 'Projectleider', uurtarief: 90 },
    { id: 'r_data_ana', project_id: 'p_data', naam: 'Data-analist', uurtarief: 75 },
    { id: 'r_data_dev', project_id: 'p_data', naam: 'Developer', uurtarief: 70 },
    { id: 'r_hub_pl', project_id: 'p_hub', naam: 'Projectleider', uurtarief: 80 },
    { id: 'r_hub_com', project_id: 'p_hub', naam: 'Communicatie', uurtarief: 60 },
    { id: 'r_hub_ont', project_id: 'p_hub', naam: 'Ontwerper', uurtarief: 65 },
  ];

  const projectMembers = () => [
    { project_id: 'p_twin', user_id: 'u_anna', project_role_id: 'r_twin_pl' },
    { project_id: 'p_twin', user_id: 'u_jan', project_role_id: 'r_twin_dev' },
    { project_id: 'p_twin', user_id: 'u_sara', project_role_id: 'r_twin_ont' },
    { project_id: 'p_twin', user_id: 'u_pieter', project_role_id: 'r_twin_dev' },
    { project_id: 'p_data', user_id: 'u_anna', project_role_id: 'r_data_pl' },
    { project_id: 'p_data', user_id: 'u_pieter', project_role_id: 'r_data_ana' },
    { project_id: 'p_data', user_id: 'u_lisa', project_role_id: 'r_data_ana' },
    { project_id: 'p_data', user_id: 'u_jan', project_role_id: 'r_data_dev' },
    { project_id: 'p_hub', user_id: 'u_anna', project_role_id: 'r_hub_pl' },
    { project_id: 'p_hub', user_id: 'u_sara', project_role_id: 'r_hub_com' },
    { project_id: 'p_hub', user_id: 'u_lisa', project_role_id: 'r_hub_ont' },
  ];

  /** Hoeveel uur duurt een meeting? Zelfde afronding op een kwartier als in de app. */
  function meetingHours(meeting) {
    const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const hours = (toMinutes(meeting.eindtijd) - toMinutes(meeting.starttijd)) / 60;
    return Math.round(hours * 4) / 4;
  }

  /** Maak een volledige, samenhangende dataset. */
  function create() {
    const today = U.today();
    const data = {
      profiles: profiles(),
      projects: projects(today),
      project_roles: projectRoles(),
      project_members: projectMembers(),
      time_entries: [],
      meetings: [],
      meeting_attendees: [],
    };

    /** Rol en tarief van een persoon op een project, zoals de app dat bij het schrijven vastlegt. */
    const roleOf = (projectId, userId) => {
      const membership = data.project_members.find((m) => m.project_id === projectId && m.user_id === userId);
      return data.project_roles.find((r) => r.id === membership.project_role_id);
    };

    // Urenregels: elke werkdag van de afgelopen weken, verdeeld over de projecten van de medewerker.
    const employees = data.profiles.filter((p) => p.rol === 'medewerker');
    employees.forEach((user, userIndex) => {
      const memberships = data.project_members.filter((m) => m.user_id === user.id);
      for (let daysAgo = 1; daysAgo <= HISTORY_DAYS; daysAgo++) {
        const datum = U.addDays(today, -daysAgo);
        const isWeekend = (U.parse(datum).getDay() + 6) % 7 > 4;
        if (isWeekend) continue;
        const membership = memberships[(daysAgo + userIndex) % memberships.length];
        const role = roleOf(membership.project_id, user.id);
        data.time_entries.push({
          id: `t_${user.id}_${daysAgo}`,
          user_id: user.id,
          project_id: membership.project_id,
          project_role_id: role.id,
          datum,
          uren: HOURS_PATTERN[(daysAgo * 3 + userIndex) % HOURS_PATTERN.length],
          omschrijving: WORK_NOTES[(daysAgo + userIndex * 2) % WORK_NOTES.length],
          uurtarief: role.uurtarief,
          meeting_id: null,
          aangemaakt_op: `${datum}T17:00:00.000Z`,
        });
      }
    });

    // Meetings: gisteren (Jan moet nog bevestigen) en vorige week (iedereen bevestigd).
    const yesterday = U.addDays(today, -1);
    const lastWeek = U.addDays(today, -8);
    data.meetings.push(
      { id: 'm_kickoff', project_id: 'p_twin', titel: 'Kick-off werkpakket 2', datum: yesterday, starttijd: '10:00', eindtijd: '11:30', aangemaakt_door: 'u_anna' },
      { id: 'm_voortgang', project_id: 'p_data', titel: 'Voortgangsoverleg data-platform', datum: lastWeek, starttijd: '13:00', eindtijd: '14:00', aangemaakt_door: 'u_anna' });

    const attendance = (meetingId, userId, status, confirmedOn) => ({
      meeting_id: meetingId,
      user_id: userId,
      status,
      bevestigd_op: confirmedOn ? `${confirmedOn}T15:00:00.000Z` : null,
    });
    data.meeting_attendees.push(
      attendance('m_kickoff', 'u_anna', 'aanwezig', yesterday),
      attendance('m_kickoff', 'u_jan', 'uitgenodigd', null), // <- openstaande bevestiging voor Jan
      attendance('m_kickoff', 'u_sara', 'aanwezig', yesterday),
      attendance('m_kickoff', 'u_pieter', 'afwezig', yesterday),
      attendance('m_voortgang', 'u_anna', 'aanwezig', lastWeek),
      attendance('m_voortgang', 'u_pieter', 'aanwezig', lastWeek),
      attendance('m_voortgang', 'u_lisa', 'aanwezig', lastWeek),
      attendance('m_voortgang', 'u_jan', 'aanwezig', lastWeek));

    // Bij elke bevestiging "aanwezig" hoort een urenregel (zoals de app die ook aanmaakt).
    data.meeting_attendees.filter((a) => a.status === 'aanwezig').forEach((a) => {
      const meeting = data.meetings.find((m) => m.id === a.meeting_id);
      const role = roleOf(meeting.project_id, a.user_id);
      data.time_entries.push({
        id: `t_${meeting.id}_${a.user_id}`,
        user_id: a.user_id,
        project_id: meeting.project_id,
        project_role_id: role.id,
        datum: meeting.datum,
        uren: meetingHours(meeting),
        omschrijving: meeting.titel,
        uurtarief: role.uurtarief,
        meeting_id: meeting.id,
        aangemaakt_op: a.bevestigd_op,
      });
    });

    return data;
  }

  window.Seed = { create, DEMO_PASSWORD };
})();
