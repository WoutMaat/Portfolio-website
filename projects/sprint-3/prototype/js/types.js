/*
 * types.js – het datamodel van de app, als JSDoc-types.
 * Namen komen overeen met de latere Supabase-tabellen (zie README, "Naar productie").
 * Dit bestand bevat alleen documentatie; het voert niets uit.
 *
 * @typedef {'medewerker'|'beheerder'} Rol
 *
 * @typedef {Object} Profile            // tabel: profiles
 * @property {string} id
 * @property {string} naam
 * @property {string} email
 * @property {Rol}    rol
 * @property {boolean} [uitgenodigd]    // alleen prototype: uitnodiging verstuurd, nog niet geaccepteerd
 *
 * @typedef {Object} Project            // tabel: projects
 * @property {string} id
 * @property {string} naam
 * @property {string} omschrijving
 * @property {string} startdatum        // YYYY-MM-DD
 * @property {string} einddatum         // YYYY-MM-DD
 * @property {'actief'|'gearchiveerd'} status
 *
 * @typedef {Object} ProjectRole        // tabel: project_roles
 * @property {string} id
 * @property {string} project_id
 * @property {string} naam              // bijv. Developer
 * @property {number} uurtarief         // euro per uur
 *
 * @typedef {Object} ProjectMember      // tabel: project_members
 * @property {string} project_id
 * @property {string} user_id
 * @property {string} project_role_id
 *
 * @typedef {Object} TimeEntry          // tabel: time_entries
 * @property {string} id
 * @property {string} user_id
 * @property {string} project_id
 * @property {string} project_role_id
 * @property {string} datum             // YYYY-MM-DD
 * @property {number} uren              // stappen van 0,25
 * @property {string} omschrijving
 * @property {number} uurtarief         // SNAPSHOT op het moment van schrijven
 * @property {string|null} meeting_id
 * @property {string} aangemaakt_op     // ISO-tijdstip
 *
 * @typedef {Object} Meeting            // tabel: meetings
 * @property {string} id
 * @property {string} project_id
 * @property {string} titel
 * @property {string} datum             // YYYY-MM-DD
 * @property {string} starttijd         // HH:MM
 * @property {string} eindtijd          // HH:MM
 * @property {string} aangemaakt_door
 *
 * @typedef {Object} MeetingAttendee    // tabel: meeting_attendees
 * @property {string} meeting_id
 * @property {string} user_id
 * @property {'uitgenodigd'|'aanwezig'|'afwezig'} status
 * @property {string|null} bevestigd_op // ISO-tijdstip van de "handtekening"
 */
