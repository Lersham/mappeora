# Mappeora

App per creare **mappe concettuali** in modo semplice, pensata per bambini con DSA e per tutti gli studenti.
Legge le mappe ad alta voce e permette di crearle dettando.

Un'unica base di codice (React + TypeScript) viene pubblicata come:

- **Web / PWA**, installabile dal browser e utilizzabile offline;
- **Android** e **iOS**, come app native tramite [Capacitor](https://capacitorjs.com).

## Provare l'app

- **Web / PWA**: https://mappeora.vercel.app. Si aggiorna da solo a ogni push sul branch. Dal browser del tablet: menu → "Aggiungi a schermata Home".
- **Android**: APK di debug da installare a mano (sul dispositivo va permessa l'installazione da "origini sconosciute"). Per crearlo serve l'Android SDK con JDK 21:
  ```bash
  npm run setup:android  # una volta per macchina/sessione: SDK in /opt/android-sdk (~650 MB)
  npm run android:apk    # → android/app/build/outputs/apk/debug/app-debug.apk
  ```
  Oppure, senza installare nulla: su GitHub, scheda **Actions** → ultima esecuzione di **Controlli** → *Artifacts* → `mappeora-android-…` (vedi [Controlli automatici](#controlli-automatici-github-actions)).
- **iOS**: serve un Mac con Xcode (`npm run ios`).

## Fase 1: MVP

| Funzione | Dove |
|---|---|
| Editor di mappe: nodi, collegamenti, parole di collegamento (doppio clic sulla freccia) | `src/features/editor` |
| 🔊 Lettura ad alta voce di un nodo o di tutta la mappa, con **evidenziazione parola per parola** | `src/hooks/useReadAloud.ts` |
| 🎤 Dettatura: si parla e nasce un nuovo concetto | `src/hooks/useDictation.ts` |
| 🎨 Profili di leggibilità: font (Lexend, Atkinson Hyperlegible), sfondi crema/azzurro/scuro, stampatello maiuscolo, spaziatura ampia, grandezza testo, velocità e voce | `src/features/accessibility` |
| 📄 **Mappe a misura di foglio A4**. Nelle mappe Libera e 5 W il concetto principale sta in alto e i rami sotto, affiancati; i concetti di ogni ramo scendono in colonna sotto il ramo, con le parole di collegamento sopra il concetto. Il numero di colonne è scelto in automatico per **riempire al meglio un A4 verticale**, e un ramo corto può stare sotto un altro (come i mattoni di un muro). La mappa si rimette in ordine da sola dopo ogni modifica; per cambiare l'ordine si trascina un concetto. Con ✋ **Sposta** i concetti restano dove li mette lo studente, uniti da linee dritte che li seguono; ✨ **Riordina** rimette la mappa sul foglio A4 (e «Annulla» torna indietro). Lettura e ripasso vanno ramo per ramo. Causa ed effetto, Confronto e Linea del tempo (verticale) usano ✨ Riordina, un albero dall'alto in basso (elkjs, caricato al primo utilizzo) | `src/lib/sheetLayout.ts`, `src/features/editor/BusEdge.tsx`, `src/features/editor/LadderEdge.tsx`, `src/features/editor/FreeEdge.tsx`, `src/services/layout.ts` |
| ↩️ Annulla/Ripeti fino a 200 passi (uno spostamento = un solo passo) | `src/store/mapStore.ts` |
| 💾 Salvataggio automatico, nessun account, funziona offline | `src/services/storage` |
| 📤 Esporta PNG: download sul web, menu "Condividi" nativo su Android/iOS | `src/services/export.ts` |

## Fase 2: contenuti

| Funzione | Dove |
|---|---|
| 🖼️ Immagini nei nodi, con colore e forma. Due schede: **✨ Illustrazioni** (Fluent Emoji di Microsoft, licenza MIT: circa 1.600 immagini cercabili in italiano **sul dispositivo** grazie ai nomi e alle parole chiave Unicode CLDR, es. «Vesuvio» → 🌋) e **📷 Foto**. La ricerca ignora articoli e preposizioni, cerca la frase e poi le singole parole e mette prima i risultati esatti. L'immagine scelta viene **salvata dentro la mappa**, quindi funziona offline e nel file `.mappeora`; le mappe vecchie la salvano alla prima apertura con internet | `src/features/editor/NodeStyleDialog.tsx`, `src/services/illustrations.ts`, `src/lib/searchText.ts`, `src/services/embed.ts` |
| 🧩 Modelli pronti: Libera, 5 W, Causa ed effetto, Linea del tempo (verticale), Confronto | `src/lib/templates.ts`, `src/features/home/NewMapDialog.tsx` |
| 🧠 Ripasso "Un passo alla volta" e "Indovina" (concetto nascosto, poi «Scopri») | `src/store/reviewStore.ts`, `src/features/editor/ReviewBar.tsx` |
| 📤 Esporta PDF A4/A3 o PNG, con **versione per la verifica** (bianco e nero, immagini in grigio) | `src/services/export.ts`, `src/features/editor/ExportDialog.tsx` |
| 🔗 Parole di collegamento: si tocca la freccia e si sceglie tra i suggerimenti, si scrive o si detta | `src/features/editor/LinkWordDialog.tsx` |
| 🗣️ Comandi vocali: «leggi la mappa», «riordina», «annulla», «rifai», «nuovo concetto …» | `src/lib/voiceCommands.ts` |

## Fase 3a: dal libro alla mappa (OCR sul dispositivo)

| Funzione | Dove |
|---|---|
| 📷 Si fotografa una pagina (o si sceglie una foto) e il testo viene letto **sul dispositivo**: la foto non esce mai dal telefono | `src/features/ocr/PhotoTextDialog.tsx`, `src/services/ocr` |
| 🔊 Il testo si legge ad alta voce, frase per frase, con la parola evidenziata | `src/hooks/useReadLongText.ts` |
| 👆 Si toccano le parole importanti: quelle vicine diventano un unico concetto («luce» + «del» + «sole» → «Luce del sole») e si aggiungono alla mappa | `src/lib/ocrText.ts` |
| ✏️ Il testo si può correggere a mano prima di scegliere le parole | |

| | Motore OCR |
|---|---|
| Web / PWA | Tesseract.js (WebAssembly). Al primo uso scarica da jsDelivr il motore e il modello italiano (circa 6 MB in tutto), poi resta in cache |
| Android | Google ML Kit (`@capacitor-mlkit/text-recognition`), modello incluso nell'app |
| iOS | Apple Vision, con un plugin nostro: `ios/App/App/OcrPlugin.swift`, registrato in `MainViewController.swift` |

Il plugin ML Kit su iOS funziona solo con CocoaPods, mentre il progetto usa Swift Package Manager. Per questo `capacitor.config.ts` lo esclude da iOS con `ios.includePlugins`: **quando si aggiunge un nuovo plugin nativo va aggiunto anche lì**.

Limite: l'OCR sul dispositivo legge bene il testo stampato, male la scrittura a mano. Per quella servirà l'AI (fase 3b).

## Fase 4: mappe concettuali complete

| Funzione | Dove |
|---|---|
| ✏️ **File modificabile `.mappeora`**: «Salva» → «File modificabile» (download sul web, «Condividi» su Android/iOS); «Apri file» nella schermata iniziale. Si apre sempre come copia nuova; foto e immagini viaggiano dentro il file. Il file viene controllato all'apertura: si accettano solo immagini incorporate, mai indirizzi web | `src/lib/mapFile.ts`, `src/services/openFile.ts` |
| 📚 **Mappe di esempio**: pulsante «Esempi» nella schermata iniziale; la prima è *La Rivoluzione francese* (37 concetti, colori per argomento, illustrazioni). Si apre una copia da modificare. I file sono in `public/esempi`, generati dagli script in `scripts/esempi` | `src/services/examples.ts`, `src/features/home/ExamplesDialog.tsx` |
| 🙋 **Interrogazione**: tutta la mappa a schermo intero, un concetto alla volta in evidenza (gli altri sbiaditi), testo grande in basso. Si va avanti con frecce, barra spaziatrice o PagSu/PagGiù (telecomandi per presentazioni sulla LIM), oppure toccando un concetto. L'app legge solo se si preme «Leggi»: a parlare è lo studente | `src/store/reviewStore.ts`, `src/features/editor/MapEditor.tsx` |
| 📷 **Foto e Google**: foto scattata o presa dalla galleria, oppure **«Cerca su Google»**, che apre Google Immagini (con SafeSearch) sul concetto: si copia l'immagine e si preme «Incolla immagine» (o Ctrl+V). Se l'app non può leggere gli appunti, compare un riquadro dove incollare a mano. Le immagini vengono ridotte a 480 px e salvate dentro la mappa. L'API di ricerca di Google non è più disponibile per i nuovi progetti, per questo la ricerca si fa nel browser | `src/features/editor/NodeStyleDialog.tsx`, `src/services/photo.ts`, `src/services/webImage.ts` |
| ➖ **Nodi comprimibili**: il pulsante sotto un concetto nasconde i concetti che dipendono da lui (resta il numero, es. «+3»). Lettura, ripasso, «Riordina» ed esportazione lavorano su ciò che si vede | `src/lib/collapse.ts` |
| 🖨️ **Stampa A4/A3** sempre in **verticale**, su 1, 2 o 4 fogli. Le mappe lunghe (scaletta) sono impaginate **in colonne, come un giornale** (fino a 3 per foglio), e i tagli cadono tra un concetto e l'altro, mai in mezzo; se non si può, i pezzi si sovrappongono un po'. Con 4 fogli una mappa larga può diventare un poster 2×2. Ogni foglio ha titolo, data e «pagina 1 di 2». Sul web c'è anche «Stampa» diretta | `src/lib/pagePlan.ts`, `src/services/export.ts` |

### Indice delle illustrazioni

`src/data/illustrations.json` è generato da `node scripts/build-illustrations.mjs`, che scarica i metadati di Fluent Emoji (versione fissata da un commit) e le parole chiave italiane di Unicode CLDR. Il file generato è nel repo: la build dell'app non ha bisogno di rete. Se si cambia versione di Fluent, va aggiornato anche `FLUENT_COMMIT` in `src/services/illustrations.ts` (un test controlla che coincidano).

## Fase 5: più semplice da usare

| Funzione | Dove |
|---|---|
| 📝 **Scaletta**: la mappa come elenco puntato, un concetto per riga. Invio crea una riga, Tab (o ➡️) la mette sotto quella di sopra, ⬅️ la riporta indietro; si può anche dettare. «Fatto» ricostruisce la mappa tenendo colori, immagini e parole di collegamento, e si può annullare in un solo passo | `src/features/editor/OutlineDialog.tsx`, `src/lib/outline.ts` |
| 📱 **Barra del telefono**: in basso restano Concetto, Detta, Leggi, Ripassa e **«Altro»**, che apre gli altri strumenti (Scaletta, Dal libro, Immagine, Sposta/Riordina, Elimina, Salva, Aspetto). Il titolo della mappa usa tutta la larghezza | `src/features/editor/MapEditor.tsx` |
| 🔊 Il pulsante per ascoltare un concetto compare **solo sul concetto selezionato** (e nel ripasso), così la mappa resta pulita | `src/features/editor/ConceptNode.tsx` |
| 👋 **Benvenuto** al primo avvio: cinque pagine brevi, ognuna da ascoltare, con «Guarda un esempio» alla fine. Già la seconda pagina ha **«📷 Provalo adesso»**: crea una mappa nuova e apre subito «Dal libro». Le prime parole scelte diventano il concetto principale e il titolo. Si riapre con «❓ Come funziona» nella schermata iniziale | `src/features/home/WelcomeDialog.tsx`, `src/App.tsx` |
| 🎓 **Impara facendo**: pulsante nella schermata iniziale. Crea «La mia prima mappa» e una scheda sotto la mappa guida sette passi da fare davvero: idea principale, nuovo concetto, nome, parola di collegamento, «Leggi», «Detta». Il pulsante da premere è evidenziato. Ogni passo si può ascoltare o saltare, e appena è fatto compare «Avanti» | `src/features/tutorial/`, `src/features/editor/MapEditor.tsx` |
| 🖍️ **Evidenziatore in «Dal libro»**: invece di toccare le parole una per una, ci si passa sopra il dito come sul libro. Parole vicine diventano un solo concetto; passare su parole già scelte le toglie. Su e giù il testo scorre come sempre. Senza AI: le parole le sceglie lo studente | `src/features/ocr/PhotoTextDialog.tsx` |

## Architettura

```
src/
├─ features/           # schermate: home, editor, accessibility
├─ components/         # pulsanti grandi, overlay dettatura
├─ hooks/              # lettura ad alta voce, dettatura, salvataggio automatico
├─ store/              # Zustand: mappa (+ undo con zundo), impostazioni, stato lettura
├─ services/
│  ├─ speech/          # SpeechService → web.ts (Web Speech API) | native.ts (plugin nativi)
│  ├─ storage/         # StorageService → dexie.ts (IndexedDB) | sqlite.ts (SQLite nativo)
│  ├─ layout.ts        # elkjs
│  └─ export.ts        # html-to-image + Filesystem/Share
├─ lib/                # modello dati, ordine di lettura, palette
└─ types/map.ts        # ConceptMap, MapNode, MapEdge
android/  ios/         # progetti nativi generati da Capacitor (versionati)
```

**Principio:** i servizi che dipendono dalla piattaforma (voce e archiviazione) sono interfacce.
L'implementazione viene scelta all'avvio con `Capacitor.isNativePlatform()`, mentre il resto dell'app è identico ovunque.

| | Web / PWA | Android / iOS |
|---|---|---|
| Testo → voce | `speechSynthesis` | `@capacitor-community/text-to-speech` (evento `onRangeStart` per l'evidenziazione) |
| Voce → testo | `SpeechRecognition` (Chrome, Edge, Safari; **non Firefox**) | `@capgo/capacitor-speech-recognition`, **sul dispositivo** quando possibile |
| Archivio | IndexedDB (Dexie) con `navigator.storage.persist()` | SQLite (`@capacitor-community/sqlite`) |
| Esporta | download | `Filesystem` + `Share` |
| Foto | `<input type="file" capture>` | `@capacitor/camera` |
| OCR | Tesseract.js | ML Kit (Android), Vision (iOS) |

Scelte importanti:

- **Il riconoscimento vocale nativo è obbligatorio nelle app**: le WebView di Android e iOS non supportano la Web Speech API per la dettatura.
- **Si usa SQLite su mobile** perché iOS può cancellare i dati IndexedDB di una WebView quando lo spazio scarseggia.
- **La voce resta sul dispositivo, se possibile**: gli utenti sono spesso minorenni, quindi si usa `useOnDeviceRecognition` quando il sistema riconosce l'italiano offline.
- **Niente simboli ARASAAC**: la loro licenza (CC BY-NC-SA) vieta l'uso commerciale, quindi sono stati tolti. Le illustrazioni sono Fluent Emoji (MIT). Nelle mappe vecchie un simbolo già salvato dentro la mappa resta visibile; gli altri non compaiono più.
- **`html-to-image` è bloccato alla 1.11.11**: le versioni successive perdono gli stili delle frecce (SVG) nell'esportazione.
- **Le impostazioni di accessibilità appartengono all'utente, non alla mappa**: una mappa condivisa da un docente si vede con il font e i colori del bambino.
- Si usa `@capgo/capacitor-speech-recognition` al posto di `@capacitor-community/speech-recognition`, che non supporta ancora Swift Package Manager (richiesto da Capacitor 8 su iOS).

## Comandi

Requisiti: Node 22+.

```bash
npm install
npm run dev          # sviluppo web su http://localhost:5173
npm test             # test unitari (Vitest)
npm run test:e2e     # test end-to-end nel browser (Playwright), computer e telefono
npm run typecheck
npm run build        # build web + PWA in dist/
```

Prima di ogni push: `npm run typecheck && npm test && npm run test:e2e`. Dopo il push GitHub Actions rifà gli stessi controlli (vedi sotto).

### Controlli automatici (GitHub Actions)

`.github/workflows/ci.yml` (**Controlli**, nella scheda Actions) parte a ogni push e a ogni pull request:

1. **Test**: controllo dei tipi, test unitari, test E2E su computer e telefono. Se un test E2E fallisce, il rapporto con screenshot e tracce si scarica dagli *Artifacts* (`rapporto-e2e`).
2. **Android** (solo sui push, e solo se i test passano): costruisce l'app.
   - Con le chiavi di firma nei secret del repository produce la **versione firmata**: `app-release.aab` per Google Play e `app-release.apk` da installare.
   - Senza chiavi produce l'APK di debug, come `npm run android:apk`.

La chiave di firma non è mai nel repository (che è pubblico): si crea con `bash scripts/create-release-key.sh` e va nei secret di GitHub. I passi sono in [docs/google-play.md](docs/google-play.md).

### Test end-to-end

In `e2e/` ci sono 51 test che usano l'app come farebbe uno studente: su un **computer** (1280×860) e su un **telefono** (Pixel 7), quindi poco più di 100 esecuzioni (alcuni test valgono solo per il telefono). Ogni test riparte da un browser vuoto. Controllano:
- creare mappe da ogni modello, salvataggio automatico, cancellazione, mappe di esempio;
- aggiungere, rinominare, annullare ed eliminare concetti; parole di collegamento; rami comprimibili; disposizione a foglio A4 senza sovrapposizioni; trascinamento per riordinare;
- immagini: ricerca delle illustrazioni, Google Immagini, incolla, foto dalla galleria;
- Scaletta, menu «Altro» sul telefono, 🔊 sul concetto scelto, benvenuto al primo avvio;
- file `.mappeora`, PNG, PDF su 1, 2 o 4 fogli A4/A3, stampa;
- lettura ad alta voce (ordine e parola evidenziata), ripasso, Indovina, Interrogazione, dettatura con i comandi vocali;
- aspetto (carattere, sfondo, maiuscolo), «Dal libro» senza internet, e la scelta delle parole (a tocchi e con l'evidenziatore) su un testo letto da un finto motore OCR;
- l'informativa privacy, raggiungibile dalla schermata iniziale;
- **accessibilità** con axe-core (WCAG 2.2 AA): nessun problema grave nelle schermate principali e nell'informativa privacy.

Come funzionano:
- **Rete simulata:** le illustrazioni su jsDelivr e Google rispondono con dati finti (`e2e/fixtures.ts`). I test funzionano offline e danno sempre lo stesso risultato.
- **Voce simulata:** quello che l'app legge finisce in un elenco controllabile; quello che lo studente «dice» si imposta con `say()`.
- **Errori:** un errore JavaScript o in console fa fallire il test.
- **Server:** i test avviano da soli build e server (`vite preview` sulla porta 4173), oppure riusano quello già acceso.
- **Rapporto:** `npm run test:e2e:report` apre il rapporto HTML, con screenshot e tracce dei test falliti.
- **Browser:** Playwright è fissato alla versione 1.56.1, la stessa del Chromium preinstallato nelle sessioni cloud. Su un altro computer, la prima volta: `npx playwright install chromium`.

### App Android

Richiede Android Studio (con Android SDK).

```bash
npm run android      # build web, cap sync, apre Android Studio
```

### App iOS

Richiede un **Mac con Xcode**, oppure un servizio di build nel cloud (Codemagic, Ionic Appflow).

```bash
npm run ios          # build web, cap sync, apre Xcode
```

Dopo ogni modifica al codice web: `npm run cap:sync`.

### Logo, icone e splash screen

Il logo (una piccola mappa: il concetto principale in giallo, collegato a tre concetti) è disegnato una volta sola in `scripts/make-icons.mjs`. `npm run icons` rigenera tutto con il Chromium di Playwright:
- web e PWA: `public/icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`;
- Android: icone del launcher (`mipmap-*`, anche adattive e rotonde, sfondo blu in `values/ic_launcher_background.xml`) e splash screen chiaro e scuro (`drawable-*` e `drawable-*-night-*`). Da Android 12 lo splash è l'icona sul colore di `values/splash.xml` (crema, o scuro con il telefono in modalità scura).

### Permessi già configurati

- **Android** (`android/app/src/main/AndroidManifest.xml`): `RECORD_AUDIO` e `<queries>` per i servizi di riconoscimento e sintesi vocale (Android 11+). La fotocamera non richiede permessi (usa il selettore di sistema).
- **iOS** (`ios/App/App/Info.plist`): microfono, riconoscimento vocale, fotocamera e libreria foto, con testi in italiano; lingua di sviluppo `it`.

## Skill per l'agente di sviluppo (Claude Code)

In `.claude/skills/` ci sono skill installate con `npx skills add … -a claude-code --copy` (le sorgenti sono registrate in `skills-lock.json`):

| Skill | Da | Uso |
|---|---|---|
| `find-skills` | vercel-labs/skills | Cerca e propone altre skill (`npx skills find …`) |
| `vercel-react-best-practices` | vercel-labs/agent-skills | Prestazioni e buone pratiche React |
| `web-design-guidelines` | vercel-labs/agent-skills | Revisione dell'interfaccia (scarica le regole aggiornate da GitHub a ogni uso) |
| `accessibility` | addyosmani/web-quality-skills | Accessibilità WCAG 2.2: utile a tutti gli studenti, indispensabile per chi ha un DSA |
| `capacitor-best-practices`, `debugging-capacitor` | cap-go/capgo-skills | App native con Capacitor |
| `capacitor-react` | capawesome-team/skills | Capacitor dentro React: hook, plugin, stato |
| `capacitor-app-development` | capawesome-team/skills | Icone e splash screen, bordi dello schermo (safe area, edge-to-edge), SPM su iOS, risoluzione problemi Android/iOS |
| `webapp-testing` | anthropics/skills | Test dell'app nel browser con Playwright (Python) |
| `playwright-best-practices` | currents-dev/playwright-best-practices-skill | Come scrivere e mantenere la suite `e2e/`: struttura, attese, test instabili, accessibilità, mock |
| `playwright-cli` | microsoft/playwright-cli | Comandare il browser da terminale per prove veloci a mano (richiede `npm i -g @playwright/cli`) |

`webapp-testing` usa Playwright per Python, che nelle sessioni cloud va reinstallato: `npm run setup:webapp-testing` (Playwright 1.56, compatibile con il Chromium preinstallato).

### Sessioni cloud di Claude Code

`.claude/hooks/session-start.sh` (registrato in `.claude/settings.json`) esegue `npm install` all'avvio di ogni sessione cloud, così typecheck, test e server di sviluppo funzionano subito. Su un computer locale non fa nulla. L'Android SDK e Playwright per Python **non** vengono installati in automatico (sono pesanti): si installano solo quando servono con `npm run setup:android` e `npm run setup:webapp-testing`. Per aggiornare le skill: `npx skills update`.

## Privacy

Mappeora non raccoglie dati: le mappe restano sul dispositivo, non ci sono account, pubblicità o statistiche. L'informativa, scritta in modo semplice anche per i ragazzi, è in `public/privacy.html`: si apre dalla schermata iniziale («🔒 Privacy») ed è online su https://mappeora.vercel.app/privacy.html, l'indirizzo da dare a Google Play. Spiega anche le funzioni che usano servizi esterni: jsDelivr (illustrazioni e motore OCR sul web), Google Immagini, dettatura e alcune voci online del browser.

Chi aggiunge una funzione che usa internet o un nuovo permesso deve aggiornare l'informativa e la data in alto. Le risposte proposte per i moduli di Google Play (Sicurezza dei dati, Famiglie, classificazione) sono in [docs/google-play.md](docs/google-play.md).

## Sviluppi da fare

L'elenco degli sviluppi, delle idee e delle verifiche da fare è nelle **[issue di GitHub](https://github.com/Lersham/mappeora/issues)**. Le etichette aiutano a filtrare:

| Etichetta | Significato |
|---|---|
| `idea` | Possibilità da valutare, non ancora decisa (es. sincronizzazione con Google Drive) |
| `rinviata` | Decisa ma rimandata a dopo l'MVP (es. funzioni AI con tetto di 1 $ al giorno) |
| `da verificare` | Funzioni da provare su dispositivi o browser reali |
| `sincronizzazione`, `monetizzazione`, `editor`, `voce`, `ai` | Area dell'app |
| `android`, `ios`, `pubblicazione` | Piattaforme e store (iOS è in pausa) |
