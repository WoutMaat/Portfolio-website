/*
 * pdf.js – minimale PDF-generator zonder externe library, beschikbaar als `PDF`.
 * Kan: A4-pagina's met tekst, lijnen en gevulde vlakken. Genoeg voor de meeting-PDF.
 *
 * Gebruik:
 *   const doc = new PDF.Doc();
 *   const page = doc.addPage();
 *   page.text(48, 76, 'Titel', { size: 20, bold: true, color: '#011049' });
 *   const blob = doc.toBlob();
 *
 * Coördinaten zijn in punten (1/72 inch) vanaf de LINKERBOVENHOEK van de pagina; PDF zelf
 * rekent vanaf linksonder, dat rekenen we hier om.
 * Lettertype: Helvetica (zit in elke PDF-lezer), WinAnsi-codering (é, ë en € werken).
 */
(function () {
  'use strict';

  const PAGE_W = 595; // A4 in punten
  const PAGE_H = 842;

  // Helvetica-letterbreedtes voor ASCII 32..126, in duizendsten van de lettergrootte.
  // Nodig om tekst rechts of gecentreerd uit te lijnen en af te kappen.
  const CHAR_WIDTHS = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,                 // spatie t/m /
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,           // 0-9 : ; < = > ? @
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,                                // A-M
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,                                // N-Z
    278, 278, 278, 469, 556, 333,                                                                   // [ \ ] ^ _ `
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833,                                // a-m
    556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,                                // n-z
    334, 260, 334, 584,                                                                             // { | } ~
  ];
  const DEFAULT_CHAR_WIDTH = 556;  // accenten, euroteken en andere tekens
  const BOLD_FACTOR = 1.06;        // vette tekst is iets breder (benadering)

  /** Breedte van een tekst in punten bij een lettergrootte. */
  function textWidth(text, size, bold) {
    let units = 0;
    for (const ch of String(text)) {
      // "é" meet als "e": haal het accent eraf.
      const code = ch.normalize('NFD').charCodeAt(0);
      units += code >= 32 && code <= 126 ? CHAR_WIDTHS[code - 32] : DEFAULT_CHAR_WIDTH;
    }
    return (units * size / 1000) * (bold ? BOLD_FACTOR : 1);
  }

  /** Kort een tekst in met "…" zodat hij binnen `maxWidth` punten past. */
  function fit(text, maxWidth, size, bold) {
    let result = String(text);
    if (textWidth(result, size, bold) <= maxWidth) return result;
    while (result.length > 1 && textWidth(result + '…', size, bold) > maxWidth) result = result.slice(0, -1);
    return result + '…';
  }

  // Tekens die in WinAnsi op een andere plek staan dan in Unicode.
  const WIN_ANSI_SPECIAL = { '€': 0x80, '–': 0x96, '—': 0x97, '‘': 0x27, '’': 0x27, '“': 0x22, '”': 0x22 };

  /** Unicode-tekst -> string met één teken per byte (WinAnsi). Onbekende tekens worden "?". */
  function toWinAnsi(text) {
    let out = '';
    for (const ch of String(text)) {
      const code = ch.charCodeAt(0);
      let byte;
      if (code < 128) byte = code;
      else if (ch in WIN_ANSI_SPECIAL) byte = WIN_ANSI_SPECIAL[ch];
      else if (code >= 160 && code <= 255) byte = code; // Latin-1 komt overeen met WinAnsi
      else byte = 63; // '?'
      out += String.fromCharCode(byte);
    }
    return out;
  }
  /** Maak een tekst veilig voor tussen haakjes in een PDF-string. */
  const escapePdfString = (text) => text.replace(/[\\()]/g, (m) => '\\' + m).replace(/[\r\n]+/g, ' ');

  /** '#RRGGBB' of [r, g, b] (0–1) -> [r, g, b] (0–1). */
  function toRgb(color) {
    if (Array.isArray(color)) return color;
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  /** Getal met maximaal twee decimalen, voor in de PDF-opdrachten. */
  const fmt = (n) => (Math.round(n * 100) / 100).toString();

  /** PDF-opdracht om een kleur te kiezen: operator 'rg' (vullen/tekst) of 'RG' (lijnen). */
  function colorOp(color, operator) {
    const [r, g, b] = toRgb(color);
    return `${fmt(r)} ${fmt(g)} ${fmt(b)} ${operator}`;
  }

  /** Eén pagina. De tekenopdrachten worden verzameld en bij `toBytes` in de PDF gezet. */
  class Page {
    constructor() { this.ops = []; }

    /**
     * Tekst met de basislijn op `y`.
     * @param {{size?: number, bold?: boolean, color?: string|number[], align?: 'left'|'right'|'center'}} [options]
     *   Bij `align: 'right'` is `x` de rechterkant van de tekst, bij 'center' het midden.
     */
    text(x, y, text, options = {}) {
      const { size = 10, bold = false, color = [0, 0, 0], align = 'left' } = options;
      const width = textWidth(text, size, bold);
      const startX = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
      const font = bold ? 'F2' : 'F1'; // F1 = Helvetica, F2 = Helvetica-Bold (zie Doc.toBytes)
      this.ops.push(`BT /${font} ${size} Tf ${colorOp(color, 'rg')} ${fmt(startX)} ${fmt(PAGE_H - y)} Td `
        + `(${escapePdfString(toWinAnsi(text))}) Tj ET`);
    }

    /** Rechthoek met bovenkant op `y`. `fill` en/of `stroke` (kleur), `lw` = lijndikte. */
    rect(x, y, width, height, { fill, stroke, lw = 1 } = {}) {
      const ops = [];
      if (fill) ops.push(colorOp(fill, 'rg'));
      if (stroke) ops.push(`${colorOp(stroke, 'RG')} ${fmt(lw)} w`);
      const paint = fill && stroke ? 'B' : fill ? 'f' : 'S'; // B = vullen + rand, f = vullen, S = rand
      ops.push(`${fmt(x)} ${fmt(PAGE_H - y - height)} ${fmt(width)} ${fmt(height)} re ${paint}`);
      this.ops.push(ops.join(' '));
    }

    line(x1, y1, x2, y2, { color = [0, 0, 0], lw = 1 } = {}) {
      this.ops.push(`${colorOp(color, 'RG')} ${fmt(lw)} w ${fmt(x1)} ${fmt(PAGE_H - y1)} m ${fmt(x2)} ${fmt(PAGE_H - y2)} l S`);
    }
  }

  /** Een document met één of meer pagina's. */
  class Doc {
    constructor() { this.pages = []; }

    addPage() {
      const page = new Page();
      this.pages.push(page);
      return page;
    }

    /**
     * Schrijf het document als bytes. Structuur van een PDF: genummerde objecten
     * (catalogus, paginalijst, lettertypen, per pagina een pagina- en een inhoudsobject),
     * gevolgd door een tabel met de byte-positie van elk object (xref).
     * Objectnummers: 1 catalogus · 2 paginalijst · 3 en 4 lettertypen · daarna per pagina twee.
     */
    toBytes() {
      const FIRST_PAGE_OBJECT = 5;
      const objects = [];
      objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
      const pageRefs = this.pages.map((_, i) => `${FIRST_PAGE_OBJECT + 2 * i} 0 R`).join(' ');
      objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${this.pages.length} >>`;
      objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
      objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

      this.pages.forEach((page, i) => {
        const pageObject = FIRST_PAGE_OBJECT + 2 * i;
        const contentObject = pageObject + 1;
        const content = page.ops.join('\n');
        objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] `
          + `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
        objects[contentObject] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
      });

      let out = '%PDF-1.4\n';
      const offsets = [];
      for (let i = 1; i < objects.length; i++) {
        offsets[i] = out.length;
        out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
      }
      const xrefStart = out.length;
      out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
      for (let i = 1; i < objects.length; i++) out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
      out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
      return bytes;
    }

    toBlob() {
      return new Blob([this.toBytes()], { type: 'application/pdf' });
    }
  }

  window.PDF = { Doc, textWidth, fit, PAGE_W, PAGE_H };
})();
