# Portfolio — Minor Future-proof met AI!

Simpele, statische portfolio-website (HTML/CSS/JS, geen build-tools nodig).

## Openen

Dubbelklik op `index.html` — opent direct in je browser. Geen server nodig.

## Bestanden

```
portfolio-website/
├── index.html      → inhoud van de pagina
├── style.css        → styling (dark theme)
├── script.js        → interacties (menu, scroll, animaties)
├── downloads/        → PDF's / bestanden per project
├── assets/           → profielfoto (assets/profile.jpg)
└── README.md
```

## Profielfoto toevoegen

Zet een foto in `assets/` met de naam `profile.jpg`. Staat er geen foto,
dan toont de hero automatisch je initialen als fallback — nooit een kapot plaatje.

## Een nieuw project toevoegen (elke paar weken)

1. Open `index.html`.
2. Zoek de sectie `<!-- ===== PROJECT TEMPLATE ... ===== -->` in de `#projecten` sectie.
3. Kopieer het hele `<article class="project-card"> ... </article>` blok.
4. Plak het blok vlak vóór het `project-card--placeholder` blok (die staat er als "volgend project" plaatshouder).
5. Pas aan:
   - `Week 1–2` → juiste weeknummer
   - `Onderzoek` → type project (bv. Prototype, Onderzoek, Concept)
   - Titel en beschrijving
   - Als je een bestand hebt: zet het in `downloads/` en verwijs ernaar via `href="downloads/jouw-bestand.pdf"`
   - Geen bestand? Verwijder dan de hele `<div class="project-card__actions">...</div>` regel.

## Placeholders invullen

Zoek in `index.html` naar tekst tussen `[haakjes]`, bijvoorbeeld `[JOUW NAAM]`,
`[jouw.email@voorbeeld.nl]`, `[Skill 1]` — en vervang die door je eigen tekst.

## Bestanden klein houden

Zware bestanden (PDF's, video's) horen in `downloads/`, niet in de hoofdpagina zelf.
Zo blijft de site licht en snel, ook als je opslag beperkt is.
