# Piano di remediation: review OpenCodeReview di `src/`

Data: 2026-10-12. Fonte: `ocr scan` su `src/` con DeepSeek v4.1 flash (306 commenti, 77/93 file).
Sei agenti hanno poi verificato ogni finding sul codice, seguendo i chiamanti reali.

## Esito della verifica

- La maggior parte dei finding "critical/high" è **falsa**. DeepSeek leggeva i file isolati e non vedeva che
  la UI serializza già le operazioni o che i chiamanti filtrano già i dati.
- Non c'è nessun bug di sicurezza reale. L'SSRF su `webImage.ts` e l'XSS su `embed.ts` sono falsi.
- C'è **un solo rischio di perdita dati**: `flushAutosave` con `onReset`.
- La regola "niente ternari annidati", citata più volte dalla review, **non esiste** nel progetto.
- Android e iOS sono fuori target: i finding solo-nativi vanno nella sezione dei rinviati.

Cause comuni dei bug veri:

1. il valore di ritorno di `flushAutosave` viene ignorato;
2. le action dello store che non cambiano niente creano comunque un passo di undo;
3. si tengono in cache promise già fallite (illustrations);
4. i dialog async non hanno uno stato busy (doppio tap);
5. le risorse si liberano solo nel percorso felice (blob URL, iframe, classi CSS dell'export);
6. mancano controlli sul formato e sulla dimensione delle immagini.

Effort: S = meno di 30 minuti, M = circa 1-2 ore.

---

## P1: perdita dati (fare subito)

| # | Dove | Problema | Fix minimo | Effort |
|---|---|---|---|---|
| 1 | `services/autosave.ts:131-140` | ~~Dopo 5 giri `flushAutosave` restituisce `false` anche quando `problem === null`.~~ Dopo la verifica non è un bug: c'è ancora un `pending`, quindi «non tutto salvato» è la risposta giusta. | Nessuno. | — |
| 2 | `App.tsx` (`onReset` dell'ErrorBoundary) | Ignora il risultato di `flushAutosave`: `showMap(null)` scarta il `pending` e le ultime modifiche si perdono. | Se il salvataggio non riesce, si riavvia la pagina: `pagehide` mette le modifiche nello slot e `recovered` le salva alla ripartenza. | S |
| 3 | `services/autosave.ts`, nessun test | Il cuore del salvataggio non ha nessun test. | Un `autosave.test.ts` con uno storage finto: flush con pending, conflitto, recovery. | M |

Falsi in quest'area: "ErrorBoundary critical" (`flushAutosave` non rigetta mai) e `autosave.ts:29-31` (nessun passaggio A→B).

## P2: bug che l'utente vede

### Store e persistenza

| # | Dove | Problema | Fix minimo | Effort |
|---|---|---|---|---|
| 4 | `store/mapStore.ts:143-146, 237-240` | `updateNode` e `updateEdge` con una patch identica creano un passo di undo vuoto: Ctrl+Z sembra non fare niente. | `return {}` se tutte le chiavi sono uguali (per `position` confrontare x e y). Test in `mapStore.test.ts`. | S |
| 5 | `App.tsx:30-44` | Il pause/resume di temporal intorno al caricamento è fragile. | Usare `untracked()`, che c'è già (`mapStore.ts:318`). | S |
| 6 | `saveAsCopy` | Il confronto su `updatedAt` avviene prima dell'await. | Confrontare dopo l'await. | S |
| 7 | recovery in autosave | Se la recovery fallisce, lo slot resta valorizzato. | `recovery = undefined` nel catch. | S |

### Voce

| # | Dove | Problema | Fix minimo | Effort |
|---|---|---|---|---|
| 8 | `services/speech/web.ts:102-111` | Il fallback offline scatta solo con la voce automatica. Con una voce di rete scelta e la connessione assente, la lettura resta muta senza errore. | Condizione `voice?.localService === false`. Gli altri errori: `reject(new SpeakError(e.error, false))`, esclusi `interrupted` e `canceled`. | S |
| 9 | `lib/spokenMatch.ts:15-16` | Il ramo `common >= 4 && …` accetta coppie sbagliate (piano/pianeta, carta/cartello). | Eliminare il ramo e tenere `common >= 5`. Test negativi. | S |
| 10 | `features/.../NewMapDialog` | La lettura ad alta voce continua dopo la chiusura; un doppio tap su «Crea» crea due mappe. | `stop()` su close/create e un flag `creating`. | S |

### OCR, immagini, export

| # | Dove | Problema | Fix minimo | Effort |
|---|---|---|---|---|
| 11 | `services/embed.ts:29` | Una risposta 200 non-immagine (login del wifi della scuola) viene salvata come `data:text/html`: l'illustrazione resta rotta per sempre e non viene riscaricata. | `const type = header.startsWith('image/') ? header : sniffImage(bytes) ?? (header ? undefined : 'image/png'); if (!type) return undefined;` Test con content-type HTML. | S |
| 12 | `services/illustrations.ts:38-52` | `index ??=` tiene in cache la promise fallita: il picker resta vuoto fino al reload. In NodeStyleDialog:83/88 diventa una unhandled rejection. | `.catch(e => { index = undefined; throw e; })` e `.catch(() => [])` nei chiamanti. | S |
| 13 | `services/photo.ts:79-87` | Un'immagine 0×0 (SVG senza width/height) viene salvata come `'data:,'` senza errore. | `if (!img.naturalWidth \|\| !img.naturalHeight) throw new Error('photo-load')`. | S |
| 14 | `features/ocr/PhotoTextDialog.tsx:125-130` | Offline con una foto HEIC/rotta compare «serve internet» invece dell'errore sulla foto. | Controllare `PhotoDecodeError` per primo. | S |
| 15 | `services/export.ts:137-139` | Annullando e riesportando subito, il `finally` del render vecchio toglie le classi d'export mentre il nuovo sta clonando il DOM, e il file può includere la UI. | Contatore dei render attivi: si tolgono le classi solo quando arriva a 0. | S |

### Editor e componenti

| # | Dove | Problema | Fix minimo | Effort |
|---|---|---|---|---|
| 16 | `TreeEdge.tsx:21-26` | Misura le etichette una volta sola; con OpenDyslexic le misure restano sbagliate. | Deps `[look]` e rimisura dopo `fonts.ready`. | S |
| 17 | `SaveProblemNotice.tsx` | Si può premere «Riprova» più volte e `failed` non si azzera. | Guard busy e reset di `failed`. | S |
| 18 | `ExamplesDialog` | Se l'apertura fallisce resta su «Apro la mappa…». | `setLoading(null)` in `finally` e un testo neutro. | S |
| 19 | `NodeStyleDialog` | `awayAtGoogle` non si azzera allo smontaggio; `'#ffffff'` è scritto a mano. | Reset nel cleanup; `DEFAULT_COLOR` alla riga 229. | S |
| 20 | `WidthGrip` | Il drag non si chiude se il componente si smonta a metà. | `useEffect(() => end, [])`. | S |

## P3: accessibilità

| # | Dove | Problema | Fix minimo | Effort |
|---|---|---|---|---|
| 21 | `DictationOverlay.tsx:17` | Il `key={…}` rimonta il nodo e lo screen reader rilegge tutto. | Togliere il `key`. | S |
| 22 | `ReviewBar.tsx:18-20` | `aria-label` su uno `span` viene ignorato. | Testo `sr-only`. | S |
| 23 | ErrorBoundary | `role="alert"` su tutto il `<main>`. | Spostarlo sul `<p>` del messaggio. | S |
| 24 | `Dialog.tsx:176` | Tab in un dialog senza elementi focusabili fa uscire il focus. | Guard: `preventDefault` se la lista è vuota. | S |
| 25 | `voiceCommands` hints | «rifai» funziona ma non è tra i suggerimenti. | Aggiungerlo. | S |

## P4: robustezza a basso rischio (si fanno in blocco)

- `reviewStore.ts:67,72,90,102` e `voiceCommands.ts:32`: usare `Object.hasOwn` invece di `in` o dell'accesso diretto. Test `total === 0` per `ripetimiSummary`.
- `HomeScreen.tsx:114`: `CSS.escape(focusId)`.
- `backup.ts:25-31`: guard `s && typeof s === 'object' ? s : {}`.
- `useCrowded`: osservare anche `childList`, perché i pulsanti aggiunti dopo non vengono contati.
- `export.ts:359`: aggiungere il credito ARASAAC anche nel PNG. Riguarda solo le mappe vecchie con pittogrammi; è un obbligo di licenza, non un danno per l'utente. Effort S/M.
- `export.ts:316`: calcolare il titolo sulla larghezza verticale e togliere il ciclo dell'header, che oscilla e copre 1-2 mm della mappa.
- `export.ts:372-374`: `setTimeout(cleanup, 60_000)` prima di `appendChild`.
- `photo.ts:58`: revocare il blob URL dopo l'uso (NodeStyleDialog:129, PhotoTextDialog).
- `PhotoTextDialog.tsx:332`: `key={g.first}`.
- `ocrImage.ts:41-42`: `Math.min(quantile(rel, 0.005), 0.95)` e un test sulla pagina bianca.
- `illustrations.ts:39`: nel dialog, il catch che mostra l'errore all'utente (si fa insieme al punto 12).

## Rinviati

- **Solo nativo** (Android/iOS demo): la race tra `useDictation` e `speech/native.ts`, `sqlite.ts:56`, `photo.ts:42`, `ocr/native.ts`, `export.ts:402`.
- **Opzionali**: la deduplica di `bottomObstruction` in MapEditor; la maschera a raggio fisso in `ocrImage.ts:36-38` (euristica: si interviene se capita sul campo); `searchText` con sola punteggiatura (comportamento voluto).
- **Manutenibilità** (costanti magiche, `'it-IT'`, codice morto): non ora.

## Falsi positivi principali (da non riaprire)

- Gli `splice(-1)` di Dialog, l'OCR concorrente sul singleton (l'abort è sincrono prima del nuovo job) e `used` non aggiornato in PhotoTextDialog (il dialog si smonta).
- `setState` dopo lo smontaggio (è un no-op in React 19), l'SSRF in webImage e `fromCharCode` con 0x8000 argomenti.
- I casi degeneri di `pagePlan` e `readingOrder` (sono già esclusi a monte).
- Tutti i finding sui "ternari annidati": la regola non esiste.
- I 13 falsi dello store e i finding high della voce che riguardano solo il nativo.

## Ordine consigliato

1. Una PR **P1** (1-3), con il test di autosave.
2. Una PR **P2 store e voce** (4-10).
3. Una PR **P2 media e editor** (11-20).
4. Una PR **P3 e P4** insieme: sono fix da una riga.

Totale stimato: circa una giornata di lavoro. Nessun fix richiede refactoring.

Non coperti dalla review: 16 file di `src/` non hanno risultato (errori del tool), e `scripts/` e `public/`
non sono stati analizzati. Si possono rilanciare se servono.
