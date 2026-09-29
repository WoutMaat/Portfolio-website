# Portfolio — Minor Future-proof met AI!

Simpele, statische portfolio-website (HTML/CSS/JS, geen build-tools nodig).

## Openen

Dubbelklik op `index.html` — opent direct in je browser. Geen server nodig.

## Bestanden

```
portfolio-website/
├── index.html            → homepage met projecttegels
├── style.css             → styling (dark theme)
├── script.js             → interacties (menu, scroll, animaties)
├── projects/
│   ├── _template.html    → kopieer dit bestand voor een nieuwe sprint
│   ├── sprint-1/
│   │   ├── index.html    → onepager van sprint 1
│   │   ├── cover.jpg     → tegelfoto op de homepage (optioneel)
│   │   └── photo-1.jpg … photo-4.jpg → foto's in de onepager (optioneel)
│   └── sprint-2/ …
├── downloads/             → PDF's / bestanden per project
├── assets/                → profielfoto (assets/profile.jpg)
└── README.md
```

## Profielfoto toevoegen

Zet een foto in `assets/` met de naam `profile.jpg`. Staat er geen foto,
dan toont de hero automatisch je initialen als fallback — nooit een kapot plaatje.

## Een nieuw project (sprint) toevoegen (elke twee weken)

1. **Maak een map** `projects/sprint-X/` (X = het volgnummer).
2. **Foto's toevoegen (optioneel).** Zet een `cover.jpg` (16:10) in die map voor de tegel op
   de homepage, en/of `photo-1.jpg` t/m `photo-4.jpg` voor de foto-galerij op de onepager.
   Geen foto? Dan verdwijnt die plek vanzelf — je hoeft niets in de code aan te passen.
3. **Onepager maken.** Kopieer `projects/_template.html` naar `projects/sprint-X/index.html`
   en vul de tekst tussen `[haakjes]` in: titel, week, tag, uitleg over de aanpak.
4. **Leeruitkomsten aangeven.** In de onepager staan 5 `lu-pill` blokjes (LU1 t/m LU5). Zet
   `lu-pill--done` op de class van elke leeruitkomst die je die sprint hebt aangetoond, en
   laat 'm weg bij een leeruitkomst die niet aan bod kwam. Heeft een docent een leeruitkomst
   goedgekeurd? Zet dan ook `lu-pill--approved` op diezelfde pil (naast `lu-pill--done`) —
   daar verschijnt automatisch een groen vinkje op.
5. **Link of bestand (optioneel).** Onderaan de onepager staat een `project-links`-sectie voor
   een link naar een prototype of een download. Geen bestand? Zet het in `downloads/` en
   verwijs ernaar met `href="../../downloads/jouw-bestand.pdf"`. Niets te linken? Verwijder
   de hele sectie.
6. **Tegel toevoegen op de homepage.** Open `index.html`, kopieer een bestaand
   `<a class="project-card">`-blok in de `#projecten`-sectie, en pas de `href`, week, tag,
   titel en beschrijving aan.

## Bestanden klein houden

Zware bestanden (PDF's, video's) horen in `downloads/`, niet in de hoofdpagina zelf.
Zo blijft de site licht en snel, ook als je opslag beperkt is.
