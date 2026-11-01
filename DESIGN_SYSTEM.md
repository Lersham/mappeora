# Design system di MappAmi

Fotografia di come l'app è disegnata **oggi**, ricavata dal codice. Le fonti
restano quelle: questo file le riassume e dice quali regole seguono. Se un
valore cambia nel codice, va cambiato anche qui.

| Cosa | Dove vive |
|---|---|
| Token (colori, raggi, testo) e temi | `src/styles/theme.css` |
| Componenti e layout | `src/styles/app.css` |
| Colori dei concetti e delle parole | `src/lib/palette.ts` |
| Icone | `src/components/Icon.tsx` (lucide-react) |
| Pulsanti | `src/components/BigButton.tsx` |

## Per chi è

Bambini con DSA e studenti, su tablet, telefono, computer e LIM. Da qui
vengono tutte le regole: bersagli grandi, poco testo per volta, contrasto
WCAG AA, nessuna informazione affidata solo al colore, lettura ad alta voce
ovunque.

## Le impostazioni di leggibilità cambiano i token

Le scelte dello studente arrivano come attributi `data-*` su `<html>` e
cambiano le variabili CSS. Ogni componente deve quindi usare le variabili,
mai i valori fissi, altrimenti non segue le impostazioni.

| Attributo | Valori | Cosa cambia |
|---|---|---|
| `data-theme` | (bianco, predefinito), `crema`, `azzurro`, `scuro` | colori |
| `data-font` | (Lexend, predefinito), `atkinson`, `opendyslexic`, `sistema` | `--font-body` |
| `data-spacing` | (normale), `wide` | `--letter-spacing`, `--word-spacing`, `--line-height` |
| `data-uppercase` | `true` | stampatello sulle parole delle mappe |
| `--text-scale` | predefinito `1.15` | la dimensione base: `font-size: calc(16px * var(--text-scale))` su `:root` |

Conseguenza pratica: le misure dei testi sono in `rem`, così crescono con
`--text-scale`. Le larghezze delle finestre e dei concetti crescono anche loro
con `--text-scale` (es. `.overlay-card`, `.concept-node`), per tenere le stesse
parole per riga.

## Colori

### Interfaccia

Valori del tema bianco (predefinito) e del tema scuro. Crema e azzurro
cambiano solo `--bg`, `--surface` e `--border`.

| Token | Bianco | Scuro | Uso |
|---|---|---|---|
| `--bg` | `#ffffff` | `#1d2129` | sfondo della pagina, dei campi |
| `--surface` | `#ffffff` | `#282d38` | finestre, barre, card |
| `--text` | `#1f2430` | `#f1ede4` | testo |
| `--muted` | `#5b6270` | `#b5b9c2` | testo secondario, icone a riposo |
| `--border` | `#d0d4da` | `#444b59` | bordi decorativi |
| `--line` | mix di `--border` e `--surface` | idem | filo sottile tra barre e card |
| `--field-border` | `#857f6c` | `#828b9c` | bordo dei campi: 3:1 sullo sfondo (WCAG 1.4.11) |
| `--primary` | `#2b54b0` | `#7fb0e6` | azioni: «la penna blu» |
| `--primary-text` | `#ffffff` | `#10161f` | testo sul pulsante principale |
| `--danger` | `#b3412f` | `#ef8f7d` | ciò che cancella: «la penna rossa» |
| `--success` | `#2e7d32` | `#7bc47f` | conferme |
| `--highlight` | `#ffe066` | `#ffe066` | ciò da guardare: «l'evidenziatore» (lettura) |
| `--focus` | `#b35400` | `#e07a00` | anello del focus, 3:1 su ogni sfondo |
| `--edge` | `#556070` | `#aab2bf` | frecce della mappa |
| `--tint` / `--tint-strong` | mix di `--border` e `--surface` | idem | fondo dei pulsanti secondari / il loro hover |

Crema: `--bg #fdf8ec`, `--surface #fffdf7`, `--border #d9d1bd`.
Azzurro: `--bg #eaf3fb`, `--surface #f6fafe`, `--border #c3d5e6`.

Il tema scuro non è un'inversione: ogni token ha un valore suo, con il
contrasto verificato.

### Mappe

- **Linee dei rami** (`--branch-0` … `--branch-5`, in `theme.css`): sei
  colori a turno, con una versione chiara per il tema scuro.
- **Colori dei concetti** (`NODE_COLORS` in `palette.ts`): pastelli chiari,
  sempre con le parole scure `#1f2430`. Nello stesso ordine delle linee:
  «Riordina e colora» dà a ogni ramo il pastello vicino al colore della sua
  linea. Il concetto principale e i concetti nuovi sono bianchi.
- **Altri colori da scegliere a mano**: `MORE_COLORS`.
- **Colori di una singola parola**: `TEXT_COLORS`, scuri abbastanza da
  leggersi su ogni pastello.
- Ogni colore ha un nome italiano (`COLOR_NAMES`) letto dallo screen reader.

Una mappa si stampa ed esporta sempre sul foglio bianco (`.export-paper`),
qualunque sia il tema dello schermo.

## Tipografia

- **Font**: Lexend (predefinito), Atkinson Hyperlegible, OpenDyslexic, font
  di sistema. Tutti via `--font-body`; nessun componente ne fissa uno suo
  (fanno eccezione solo i campioni nella scelta del font).
- **Pesi**: `600` per etichette e pulsanti, `700` per titoli, `800` solo per i
  nomi del concetto principale e dei primi concetti dei rami.
- **Interlinea**: `--line-height`, 1.4 (1.6 con spaziatura ampia).
- **Campi**: mai sotto i 16px (`font-size: max(16px, 1em)`), altrimenti
  l'iPhone ingrandisce la pagina al tocco.
- **Testi su schermi stretti**: dove una parola lunga con testo grande può
  uscire dalla finestra si usa `min(<rem>, <vw>)`, es. il titolo delle
  finestre `min(1.4rem, 6vw)`.

Scala in uso, dalla più frequente:

| Ruolo | Valore |
|---|---|
| etichetta sotto l'icona di un pulsante | `0.8rem` |
| testo secondario, didascalie | `0.85rem` – `0.95rem` |
| testo normale | `1rem` |
| enfasi, primi concetti dei rami | `1.1rem` |
| concetto principale | `1.3rem` |
| icona di un pulsante grande, icon-button | `1.35rem` – `1.5rem` |
| titolo di una finestra | `min(1.4rem, 8vw)`: sempre più grande delle sezioni (`1rem`), anche col testo al 180% |
| emoji di un concetto | `2rem` |

## Spaziature

Non ci sono token di spaziatura: i valori sono in px, quasi tutti su una
scala di 2 e 4.

- `gap`: `4`, `8` (il più usato), `12`; meno spesso `2`, `6`, `10`, `14`.
- `padding`: `16` per pagine e finestre su telefono, `24` per le finestre
  (`--card-pad`, che scende a 16 sotto i 560px).
- Barre (`.topbar`, `.toolbar`): padding `2`–`8px`, gap `4px`, e i margini
  sicuri del dispositivo (`env(safe-area-inset-*)`).

## Raggi

| Token | Valore | Uso |
|---|---|---|
| `--radius-sm` | `10px` | pulsanti, campi, scelte, chip |
| `--radius-md` | `16px` | finestre, card, concetti |
| `999px` | — | pillole |
| `50%` | — | elementi tondi (microfono, campioni di colore) |

Forme dei concetti: rettangolo (`--radius-md`), ellisse (`40px / 50%`),
nuvola (`40px 32px 44px 28px`).

## Ombre

Poche e morbide, per staccare ciò che galleggia:

Due token, in `theme.css`, fatti di nero e non di `--text` (nel tema scuro
un'ombra di `--text` diventava un alone chiaro); il tema scuro ne mette di più:

| Token | Bianco, crema, azzurro | Scuro | Uso |
|---|---|---|---|
| `--shadow-raised` | `0 4px 14px` nero 13% | nero 40% | barre sospese, avvisi, card sotto il mouse, logo |
| `--shadow-dialog` | `0 12px 40px` nero 25% | nero 55% | finestre |

Poi due anelli, che non sono ombre ma segnali:

- concetto scelto: anello `0 0 0 4px` di `--primary` al 30%;
- concetto letto ad alta voce: anello `0 0 0 6px var(--highlight)`.

## Componenti

### Pulsanti

- **`BigButton`** (`.big-button`): icona **e** parola, mai solo icona;
  minimo 64×56px. Fondo `--tint`, icona in `--primary`.
  - `primary`: pieno di `--primary`. **Uno solo per schermata o finestra.**
  - `danger`: testo `--danger`, senza fondo pieno.
  - Disabilitato: `opacity: 0.4`.
- **In riga** (`.is-row`, e sempre in `.dialog-actions`): icona accanto
  alla parola, alto 48px, largo almeno 96px. Nelle finestre l'azione
  principale deve vedersi più delle card sopra; e col testo grande una riga
  di pulsanti non deve mangiare la finestra.
- **`.icon-button`**: solo icona, 56×56px, trasparente, `--muted` a riposo e
  `--primary` all'hover. Ha sempre un'etichetta accessibile.
- Nelle barre i pulsanti secondari non hanno fondo né cornice; quello
  premuto (`aria-pressed`) si vede.

### Scelte, campi, chip

- **`.choice`**: alta almeno 48px, bordo 2px `--border`; scelta = bordo
  `--primary`. Con colori forzati (Windows) si aggiunge un contorno spesso.
- **`.text-field`**: alto almeno 52px, bordo 2px `--field-border`, fondo `--bg`.
- **`.chip`**: pillola alta almeno 44px, bordo 2px `--border`, per i
  suggerimenti da toccare (parole di collegamento, ricerche).

### Finestre

- **`.overlay` + `.overlay-card`**: velo `rgba(15, 20, 30, 0.45)`, card
  larga `min(520px × scala testo, 100%)`, padding `--card-pad`.
- Su telefono (≤ 560px) diventano un **foglio dal basso** (`.is-sheet`) che
  sale con un'animazione breve.
- I pulsanti in fondo (`.dialog-actions`) restano sempre visibili: è il
  testo sopra che scorre. **Pochi**: chiudere o confermare. Un'azione che
  riguarda una parte del contenuto (es. «Prova la voce») sta accanto a
  quella parte.
- Il titolo è sempre più grande delle sezioni interne, a ogni grandezza del
  testo.
- Chi non ha niente da annullare si chiude con **«Chiudi»**; «Annulla» solo
  dove si rinuncia a qualcosa (creare, salvare, eliminare).

### Concetti della mappa (`.concept-node`)

- Bordo 3px, raggio `--radius-md`, padding `14px 18px`, parole `#1f2430`
  (i fondi sono sempre pastelli chiari).
- Concetto principale: bordo 4px scuro, nome a `1.3rem`/`800`.
- Primo concetto di un ramo: bordo 4px del colore della sua linea, nome a
  `1.1rem`/`800`.
- Scelto: bordo `--primary` e anello. Pressione lunga riconosciuta: contorno
  tratteggiato `--primary`.
- **I controlli attorno a un concetto stanno fuori dal suo bordo**: non
  coprono mai le parole.
- Il «−» per nascondere i concetti sotto compare solo sul concetto scelto,
  sotto il mouse o col focus; un ramo già chiuso mostra sempre il suo «+N».
- I campioni di colore hanno il bordo `--field-border` (3:1 su ogni sfondo).

### Icone

Solo **lucide-react**, tramite `<Icon name="…" />`, con tratto `2.25`. Sono
grandi quanto il testo vicino (`1em`) e decorative (`aria-hidden`): il
significato lo dà sempre la parola accanto.

## Accessibilità e interazione

- **Bersagli**: almeno 44px; 48–56px per le azioni frequenti.
- **Focus**: `outline: 3px solid var(--focus)` con `outline-offset: 2px` su
  `:focus-visible`, ovunque.
- **Contrasto**: testo AA; bordi dei campi e anello del focus almeno 3:1.
- **Colori forzati** (`forced-colors: active`): ciò che è scelto si
  riconosce da una cornice spessa nel colore `Highlight` del sistema.
- **Niente doppio tocco** e **pressione lunga** al posto del menu
  contestuale; `touch-action: manipulation` sui pulsanti.

## Movimento

- Transizioni brevi: `0.12s` per hover, pressione e scelta.
- Animazioni solo dove spiegano qualcosa: il foglio che sale, il microfono
  che pulsa mentre ascolta, l'ingresso della home.
- Con `prefers-reduced-motion: reduce` ogni animazione si spegne.

## Breakpoint

Non c'è una scala fissa: i punti sono scelti dove il contenuto si rompe.

| Larghezza | Cosa cambia |
|---|---|
| ≤ 520px | intestazione della home più stretta |
| ≤ 560px | finestre a foglio dal basso, `--card-pad` 16px, barra in alto più bassa |
| ≥ 640px | riquadri «Inizia» della home su due colonne |
| < 700 / ≥ 700px | barra della selezione a tutta larghezza / barra dei comandi centrata e sospesa |
| ≤ 760px | pulsanti della barra in alto più stretti |
| ≤ 900px | scheda del tutorial più bassa |
| altezza ≤ 480px | telefono orizzontale: scorre tutta la finestra |
| `pointer: coarse` | spariti i pulsanti dello zoom (si usano due dita) |

La barra degli strumenti si accorcia anche da sola quando non c'è spazio
(`.toolbar.is-crowded`, vedi `useCrowded`): i comandi meno usati vanno in
«Altro».

## Incoerenze note

Da sapere prima di un audit. Non sono errori da correggere subito, ma i
primi candidati se si vuole un sistema più rigido:

1. **Spaziature senza token**: valori in px sparsi; quasi tutti sulla scala
   4/8/12/16/24, con alcune eccezioni (`6`, `10`, `14`).
2. **Scala dei testi lunga**: circa venti valori diversi tra `0.75rem` e
   `2rem`, alcuni vicinissimi (`1.3`, `1.35`, `1.4rem`).
3. **Breakpoint vicini ma diversi**: `520`/`560`, `640`/`700`, `760`/`900`,
   ognuno usato una o due volte.
4. **`#1f2430` scritto a mano** nei concetti invece di un token: voluto
   (i fondi dei concetti sono sempre chiari, anche nel tema scuro), ma si
   ripete in più punti.
