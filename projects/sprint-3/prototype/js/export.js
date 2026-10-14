/*
 * export.js – downloads, beschikbaar als `Exports`:
 *   - CSV van uren, voor de verantwoording;
 *   - PDF per meeting, als bewijslast voor de subsidie (A4, goed te printen).
 *
 * De CSV gebruikt ; als scheidingsteken en een komma als decimaalteken, met BOM, zodat
 * Excel (NL) hem direct goed opent. De PDF wordt met js/pdf.js gemaakt.
 */
(function () {
  'use strict';

  // ===================================================================
  // Bestand aanbieden
  // ===================================================================

  const OBJECT_URL_LIFETIME_MS = 4000;

  /** Laat de browser `blob` downloaden onder de naam `filename`. */
  function download(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
  }

  /** "Vergadering: Q&A!" -> "vergadering-q-a" (voor in bestandsnamen). */
  const slugify = (text) => text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accenten weg
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // ===================================================================
  // CSV
  // ===================================================================

  const CSV_SEPARATOR = ';';
  const CSV_BOM = '﻿'; // laat Excel de codering (UTF-8) herkennen

  /** Maak een waarde veilig voor in een CSV-cel. */
  function csvCell(value) {
    let text = String(value === null || value === undefined ? '' : value);
    // Een cel die met = + - @ begint kan Excel als formule uitvoeren: neutraliseren.
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return /[;"\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }
  const decimalComma = (n) => String(n).replace('.', ',');

  /**
   * Zet urenregels om naar CSV-tekst (oplopend op datum).
   * @param {object[]} entries urenregels (time_entries)
   */
  function toCsv(entries) {
    const header = ['Datum', 'Medewerker', 'Project', 'Rol', 'Uren', 'Uurtarief (EUR)', 'Bedrag (EUR)', 'Omschrijving', 'Meeting'];
    const rows = entries
      .slice()
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map((e) => [
        e.datum,
        Store.userName(e.user_id),
        Store.projectName(e.project_id),
        Store.roleName(e.project_role_id),
        decimalComma(e.uren),
        decimalComma(e.uurtarief.toFixed(2)),
        decimalComma(U.round2(e.uren * e.uurtarief).toFixed(2)),
        e.omschrijving,
        e.meeting_id ? 'Ja' : '',
      ]);
    return [header, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR)).join('\r\n');
  }

  function downloadCsv(filename, entries) {
    download(filename, new Blob([CSV_BOM + toCsv(entries)], { type: 'text/csv;charset=utf-8' }));
  }

  // ===================================================================
  // PDF per meeting
  // ===================================================================

  const COLOR = {
    navy: '#011049', green: '#00804A', muted: '#4A5270', text: '#000000',
    rule: '#CBD0DA', rowRule: '#DADDE5', tableHeader: '#EAECE6',
  };
  const RAINBOW = ['#4AABE1', '#006BA6', '#75BD7C', '#009F57', '#F8B000', '#EE7203', '#E52B12'];

  // Maten in punten (1/72 inch), van de linkerbovenhoek. A4 = 595 x 842.
  const MARGIN = 48;
  const RIGHT = PDF.PAGE_W - MARGIN;
  const ROW_HEIGHT = 26;
  const TABLE_HEADER_HEIGHT = 24;
  const LAST_ROW_BOTTOM = 760;     // daaronder begint een nieuwe pagina
  const FOOTER_RULE_Y = 790;
  // Kolommen van de deelnemerstabel (x-posities)
  const COL = { name: MARGIN + 8, role: 212, present: 330, confirmed: 402, hours: RIGHT - 8 };

  /** Regenboogstrook bovenaan de pagina (het logo in lijnvorm). */
  function drawBanner(page) {
    const width = PDF.PAGE_W / RAINBOW.length;
    RAINBOW.forEach((color, i) => page.rect(i * width, 0, width + 0.5, 10, { fill: color }));
  }

  /** Titel en ondertitel van het document. */
  function drawTitle(page) {
    page.text(MARGIN, 50, 'ICT Campus Foodvalley', { size: 11, bold: true, color: COLOR.green });
    page.text(MARGIN, 76, 'Aanwezigheids- en urenverklaring', { size: 20, bold: true, color: COLOR.navy });
    page.text(MARGIN, 94, 'Bewijsstuk bij de urenverantwoording van de subsidie', { size: 10, color: COLOR.muted });
    page.line(MARGIN, 108, RIGHT, 108, { color: COLOR.rule, lw: 1 });
  }

  /** Blokje met titel, project, datum, tijd en aanmaker. Geeft de volgende y-positie terug. */
  function drawMeetingFacts(page, meeting, startY) {
    const facts = [
      ['Meeting', meeting.titel],
      ['Project', Store.projectName(meeting.project_id)],
      ['Datum', U.fmtLong(meeting.datum)],
      ['Tijd', `${meeting.starttijd} – ${meeting.eindtijd} (${U.fmtHours(Store.meetingHours(meeting))})`],
      ['Aangemaakt door', Store.userName(meeting.aangemaakt_door)],
    ];
    const valueX = MARGIN + 120;
    let y = startY;
    facts.forEach(([label, value]) => {
      page.text(MARGIN, y, label, { size: 10, color: COLOR.muted });
      page.text(valueX, y, PDF.fit(value, RIGHT - valueX, 11, true), { size: 11, bold: true, color: COLOR.navy });
      y += 22;
    });
    return y;
  }

  function drawTableHeader(page, y) {
    const baseline = y + 16;
    const style = { size: 9, bold: true, color: COLOR.navy };
    page.rect(MARGIN, y, RIGHT - MARGIN, TABLE_HEADER_HEIGHT, { fill: COLOR.tableHeader });
    page.text(COL.name, baseline, 'Naam', style);
    page.text(COL.role, baseline, 'Projectrol', style);
    page.text(COL.present, baseline, 'Aanwezig', style);
    page.text(COL.confirmed, baseline, 'Bevestigd op', style);
    page.text(COL.hours, baseline, 'Uren', { ...style, align: 'right' });
  }

  /**
   * Eén deelnemer. Het selectievakje wordt getekend en krijgt ook een woord ("Ja",
   * "Nee", "Open"), zodat het ook in zwart-wit en voor schermlezers duidelijk is.
   */
  function drawAttendeeRow(page, attendee, y) {
    const baseline = y + 17;
    const present = attendee.status === 'aanwezig';
    const answer = { aanwezig: 'Ja', afwezig: 'Nee', uitgenodigd: 'Open' }[attendee.status];

    page.text(COL.name, baseline, PDF.fit(attendee.naam, 150, 10, false), { size: 10, color: COLOR.text });
    page.text(COL.role, baseline, PDF.fit(attendee.roleName, 108, 10, false), { size: 10, color: COLOR.text });

    page.rect(COL.present, baseline - 9, 11, 11, { stroke: COLOR.text, lw: 1 });
    if (present) { // vinkje in het vakje
      page.line(COL.present + 2, baseline - 3, COL.present + 5, baseline, { color: COLOR.text, lw: 1.6 });
      page.line(COL.present + 5, baseline, COL.present + 10, baseline - 8, { color: COLOR.text, lw: 1.6 });
    }
    page.text(COL.present + 17, baseline, answer, { size: 10 });

    page.text(COL.confirmed, baseline, attendee.bevestigd_op ? U.fmtDateTime(attendee.bevestigd_op) : '–', { size: 9 });
    page.text(COL.hours, baseline, present ? U.fmtNum(attendee.uren) : '–', { size: 10, align: 'right' });
    page.line(MARGIN, y + ROW_HEIGHT, RIGHT, y + ROW_HEIGHT, { color: COLOR.rowRule, lw: 0.7 });
  }

  /** Voettekst met uitleg, tijdstip, meeting-id en paginanummer op elke pagina. */
  function drawFooters(doc, meeting) {
    const user = Store.currentUser();
    const generated = `Gegenereerd op ${U.fmtDateTime(new Date().toISOString())} door ${user ? user.naam : 'onbekend'}`;
    doc.pages.forEach((page, i) => {
      page.line(MARGIN, FOOTER_RULE_Y, RIGHT, FOOTER_RULE_Y, { color: COLOR.rule, lw: 0.7 });
      page.text(MARGIN, 806, 'Het aanvinken in de app geldt als bevestiging (handtekening) van de deelnemer, met datum en tijd.',
        { size: 8, color: COLOR.muted });
      page.text(MARGIN, 818, `${generated} · Meeting-ID ${meeting.id}`, { size: 8, color: COLOR.muted });
      page.text(RIGHT, 818, `Pagina ${i + 1} van ${doc.pages.length}`, { size: 8, color: COLOR.muted, align: 'right' });
    });
  }

  /**
   * Maak de PDF van een meeting: gegevens, deelnemers met aanvinkmoment en uren, totalen.
   * @param {string} meetingId
   * @returns {Blob} application/pdf
   */
  function meetingPdf(meetingId) {
    const meeting = Store.meeting(meetingId); // controleert ook of je de meeting mag zien
    const attendees = Store.attendees(meetingId);
    const doc = new PDF.Doc();

    let page = doc.addPage();
    drawBanner(page);
    drawTitle(page);

    let y = drawMeetingFacts(page, meeting, 134) + 18;
    page.text(MARGIN, y, 'Deelnemers', { size: 13, bold: true, color: COLOR.navy });
    y += 14;
    drawTableHeader(page, y);
    y += TABLE_HEADER_HEIGHT;

    attendees.forEach((attendee) => {
      if (y > LAST_ROW_BOTTOM) { // nieuwe pagina, met opnieuw de kolomkoppen
        page = doc.addPage();
        drawBanner(page);
        y = 50;
        drawTableHeader(page, y);
        y += TABLE_HEADER_HEIGHT;
      }
      drawAttendeeRow(page, attendee, y);
      y += ROW_HEIGHT;
    });

    const present = attendees.filter((a) => a.status === 'aanwezig');
    const totalHours = U.round2(present.reduce((sum, a) => sum + a.uren, 0));
    y += 20;
    page.text(MARGIN, y, `Aanwezig: ${present.length} van ${attendees.length} deelnemers`, { size: 11, bold: true, color: COLOR.navy });
    page.text(RIGHT, y, `Totaal uren: ${U.fmtNum(totalHours)}`, { size: 11, bold: true, color: COLOR.navy, align: 'right' });

    drawFooters(doc, meeting);
    return doc.toBlob();
  }

  // ===================================================================
  // Publieke API
  // ===================================================================

  window.Exports = {
    csv: toCsv,
    downloadCsv,
    meetingPdf,

    /** Download de meeting-PDF als bestand. */
    downloadMeetingPdf(meetingId) {
      const meeting = Store.meeting(meetingId);
      download(`meeting-${meeting.datum}-${slugify(meeting.titel)}.pdf`, meetingPdf(meetingId));
    },

    /** Open de meeting-PDF in een nieuw tabblad (om af te drukken). */
    openMeetingPdf(meetingId) {
      const url = URL.createObjectURL(meetingPdf(meetingId));
      const tab = window.open(url, '_blank');
      if (!tab) download('meeting.pdf', meetingPdf(meetingId)); // pop-up geblokkeerd: dan gewoon downloaden
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
  };
})();
