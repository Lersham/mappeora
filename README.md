# MappAmi

App per creare **mappe concettuali** in modo semplice, pensata per bambini con DSA e per tutti gli studenti.
Legge le mappe ad alta voce e permette di crearle dettando.

Prima si chiamava **Mappeora**: cosa è cambiato e cosa resta col vecchio nome è in [Il nome](#il-nome-mappami-prima-mappeora).

Un'unica base di codice (React + TypeScript) viene pubblicata come:

- **Web / PWA**, installabile dal browser e utilizzabile offline;
- **Android** e **iOS**, come app native tramite [Capacitor](https://capacitorjs.com).

## Provare l'app

- **Web / PWA**: https://mapp-ami.vercel.app. Si aggiorna da solo a ogni push sul branch. Dal browser del tablet: menu → "Aggiungi a schermata Home".
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
| 🎨 Profili di leggibilità: font (Lexend, Atkinson Hyperlegible, OpenDyslexic), sfondi crema/azzurro/scuro, stampatello maiuscolo, spaziatura ampia, grandezza testo, velocità e voce | `src/features/accessibility` |
| 📄 **Mappe a misura di foglio A4**. Nelle mappe Libera e 5 W il concetto principale sta in alto e i rami sotto, affiancati; i concetti di ogni ramo scendono in colonna sotto il ramo, con le parole di collegamento sopra il concetto. Il numero di colonne è scelto in automatico per **riempire al meglio un A4 verticale**, e un ramo corto può stare sotto un altro (come i mattoni di un muro). La mappa si rimette in ordine da sola dopo ogni modifica; per cambiare l'ordine si trascina un concetto. Con ✋ **Sposta** i concetti restano dove li mette lo studente, uniti da linee dritte che li seguono; ✨ **Riordina** rimette la mappa sul foglio A4 (e «Annulla» torna indietro). Lettura e ripasso vanno ramo per ramo. Causa ed effetto, Confronto e Linea del tempo (verticale) usano ✨ Riordina, un albero dall'alto in basso (elkjs, caricato al primo utilizzo) | `src/lib/sheetLayout.ts`, `src/features/editor/BusEdge.tsx`, `src/features/editor/LadderEdge.tsx`, `src/features/editor/FreeEdge.tsx`, `src/services/layout.ts` |
| ↩️ Annulla/Ripeti fino a 200 passi (uno spostamento = un solo passo) | `src/store/mapStore.ts` |
| 💾 Salvataggio automatico, nessun account, funziona offline | `src/services/storage` |
| 📤 Esporta PNG: download sul web, menu "Condividi" nativo su Android/iOS | `src/services/export.ts` |

## Fase 2: contenuti

| Funzione | Dove |
|---|---|
| 🖼️ Immagini nei nodi, con colore e forma. Due schede: **✨ Illustrazioni** (Fluent Emoji di Microsoft, licenza MIT: circa 1.600 immagini cercabili in italiano **sul dispositivo** grazie ai nomi e alle parole chiave Unicode CLDR, es. «Vesuvio» → 🌋) e **📷 Foto**. La ricerca ignora articoli e preposizioni, cerca la frase e poi le singole parole e mette prima i risultati esatti. L'immagine scelta viene **salvata dentro la mappa**, quindi funziona offline e nel file `.mappami`; le mappe vecchie la salvano alla prima apertura con internet | `src/features/editor/NodeStyleDialog.tsx`, `src/services/illustrations.ts`, `src/lib/searchText.ts`, `src/services/embed.ts` |
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
| ✏️ **File modificabile `.mappami`** (i vecchi file `.mappeora`, di quando l'app si chiamava Mappeora, si aprono come prima): «Salva» → «File modificabile» (download sul web, «Condividi» su Android/iOS); «Apri file» nella schermata iniziale. Si apre sempre come copia nuova; foto e immagini viaggiano dentro il file. Il file viene controllato all'apertura: si accettano solo immagini incorporate, mai indirizzi web | `src/lib/mapFile.ts`, `src/services/openFile.ts` |
| 📚 **Mappe di esempio**: pulsante «Esempi» nella schermata iniziale; la prima è *La Rivoluzione francese* (37 concetti, colori per argomento, illustrazioni). Si apre una copia da modificare. I file sono in `public/esempi`, generati dagli script in `scripts/esempi` | `src/services/examples.ts`, `src/features/home/ExamplesDialog.tsx` |
| 🙋 **Interrogazione**: tutta la mappa a schermo intero, un concetto alla volta in evidenza (gli altri sbiaditi), testo grande in basso. Si va avanti con frecce, barra spaziatrice o PagSu/PagGiù (telecomandi per presentazioni sulla LIM), oppure toccando un concetto. L'app legge solo se si preme «Leggi»: a parlare è lo studente | `src/store/reviewStore.ts`, `src/features/editor/MapEditor.tsx` |
| 📷 **Foto e Google**: foto scattata o presa dalla galleria, oppure **«Cerca su Google»**, che apre Google Immagini (con SafeSearch) sul concetto: si copia l'immagine e si preme «Incolla immagine» (o Ctrl+V). Se l'app non può leggere gli appunti, compare un riquadro dove incollare a mano. Le immagini vengono ridotte a 480 px e salvate dentro la mappa. L'API di ricerca di Google non è più disponibile per i nuovi progetti, per questo la ricerca si fa nel browser | `src/features/editor/NodeStyleDialog.tsx`, `src/services/photo.ts`, `src/services/webImage.ts` |
| ➖ **Nodi comprimibili**: il pulsante sotto un concetto nasconde i concetti che dipendono da lui (resta il numero, es. «+3»). Lettura, ripasso, «Riordina» ed esportazione lavorano su ciò che si vede | `src/lib/collapse.ts` |
| 🖨️ **Stampa A4/A3** sempre in **verticale**, su 1, 2 o 4 fogli. Le mappe lunghe (scaletta) sono impaginate **in colonne, come un giornale** (fino a 3 per foglio), e i tagli cadono tra un concetto e l'altro, mai in mezzo; se non si può, i pezzi si sovrappongono un po'. Con 4 fogli una mappa larga può diventare un poster 2×2. Ogni foglio ha titolo, data e «pagina 1 di 2», scritti **con il carattere, la spaziatura e il maiuscolo scelti dallo studente** (disegnati come immagine, perché jsPDF conosce solo i suoi font; sotto restano le stesse parole come testo invisibile, così il PDF si può cercare e leggere ad alta voce). Sul web c'è anche «Stampa» diretta | `src/lib/pagePlan.ts`, `src/services/export.ts` |

### Indice delle illustrazioni

`src/data/illustrations.json` è generato da `node scripts/build-illustrations.mjs`, che scarica i metadati di Fluent Emoji (versione fissata da un commit) e le parole chiave italiane di Unicode CLDR. Il file generato è nel repo: la build dell'app non ha bisogno di rete. Se si cambia versione di Fluent, va aggiornato anche `FLUENT_COMMIT` in `src/services/illustrations.ts` (un test controlla che coincidano).

## Fase 5: più semplice da usare

| Funzione | Dove |
|---|---|
| 📝 **Scaletta**: la mappa come elenco puntato, un concetto per riga. Invio crea una riga, Tab (o il pulsante con la freccia a destra) la mette sotto quella di sopra, la freccia a sinistra la riporta indietro; si può anche dettare. «Fatto» ricostruisce la mappa tenendo colori, immagini e parole di collegamento, e si può annullare in un solo passo | `src/features/editor/OutlineDialog.tsx`, `src/lib/outline.ts` |
| 📱 **Barra del telefono**: in basso restano Concetto, Detta, Leggi, Ripassa e **«Altro»**, che apre gli altri strumenti (Scaletta, Dal libro, Immagine, Sposta/Riordina, Elimina, Salva, Aspetto). Il titolo della mappa usa tutta la larghezza | `src/features/editor/MapEditor.tsx` |
| 🔊 Il pulsante per ascoltare un concetto compare **solo sul concetto selezionato** (e nel ripasso), così la mappa resta pulita | `src/features/editor/ConceptNode.tsx` |
| 👋 **Benvenuto** al primo avvio: cinque pagine brevi, ognuna da ascoltare, con «Guarda un esempio» alla fine. Già la seconda pagina ha **«📷 Provalo adesso»**: crea una mappa nuova e apre subito «Dal libro». Le prime parole scelte diventano il concetto principale e il titolo. Si riapre con «❓ Come funziona» nella schermata iniziale | `src/features/home/WelcomeDialog.tsx`, `src/App.tsx` |
| 🎓 **Impara facendo**: pulsante nella schermata iniziale. Crea «La mia prima mappa» e una scheda sotto la mappa guida sette passi da fare davvero: idea principale, nuovo concetto, nome, parola di collegamento, «Leggi», «Detta». Il pulsante da premere è evidenziato. Ogni passo si può ascoltare o saltare, e appena è fatto compare «Avanti» | `src/features/tutorial/`, `src/features/editor/MapEditor.tsx` |
| 🖍️ **Evidenziatore in «Dal libro»**: invece di toccare le parole una per una, ci si passa sopra il dito come sul libro. Parole vicine diventano un solo concetto; passare su parole già scelte le toglie. Su e giù il testo scorre come sempre. Senza AI: le parole le sceglie lo studente | `src/features/ocr/PhotoTextDialog.tsx` |

## Fase 6: dopo l'assessment di ottobre 2026

| Funzione | Dove |
|---|---|
| 💾 **Salva tutte le mappe**: un solo file `.mappami` con tutte le mappe del dispositivo (formato interno `mappeora-archivio`). «Apri file» lo riconosce e rimette le mappe che mancano, senza doppioni e senza mai sovrascrivere: una mappa più nuova nel file torna accanto a quella che c'è, con «(dalla copia)». Un promemoria nella schermata iniziale chiede una copia quando le mappe sono almeno tre (o una ha una settimana) e poi ogni due settimane se qualcosa è cambiato; «Più tardi» lo rimanda di una settimana. Su iPhone e iPad, se MappAmi non è nella schermata Home, un avviso spiega come aggiungerla: Safari può cancellare i dati di un sito dopo 7 giorni senza visite | `src/services/backup.ts`, `src/lib/mapFile.ts`, `src/features/home/HomeScreen.tsx` |
| ✍️ **Concetto nuovo già pronto per scrivere**: dopo «Concetto» il riquadro è aperto, con il testo selezionato. Mentre si scrive, **Tab** crea un concetto sotto e **Maiusc+Tab** uno accanto (come nella Scaletta) | `src/features/editor/ConceptNode.tsx`, `src/features/editor/MapEditor.tsx` |
| 🗣️ **Lettura in frasi**: con le parole di collegamento si legge la proposizione intera («L'acqua è formata da idrogeno»), anche nella didascalia dell'Interrogazione | `src/lib/readingOrder.ts` |
| 🔊 **Evidenziazione anche senza eventi della voce**: alcune voci (le voci online «Google» di Chrome) non dicono a che parola sono; l'evidenziazione segue allora una stima del tempo di ogni parola, finché la voce non ne segnala una vera | `src/services/speech/web.ts` |
| 🔍 **Mappa leggibile sul telefono**: toccando un concetto il cui testo sullo schermo è sotto i 12 px, il suo ramo si avvicina (o il concetto stesso, se il ramo non ci sta). Aspetta un attimo, così il doppio tocco per rinominare funziona ancora. Anche un concetto nuovo si avvicina, per vedere cosa si scrive | `src/features/editor/MapEditor.tsx` |
| 🌈 **Ogni ramo il suo colore di linea** (mappe Libera e 5 W): un ramo messo sotto un altro per riempire il foglio resta riconoscibile. Nella versione per la verifica le linee tornano nere | `src/lib/sheetLayout.ts`, `src/features/editor/branchColor.ts`, `src/styles/theme.css` |
| 📝 **Approfondimenti**: una nota più lunga su un concetto (date, dettagli, esempi), da scrivere o dettare e da ascoltare. Il 📝 sul concetto la apre; all'Interrogazione è un «Suggerimento» da leggere. Nel PDF va in un foglio in fondo (si può togliere), mai nella versione per la verifica, scritta come l'intestazione **con il carattere, la spaziatura (anche tra le righe) e il maiuscolo dello studente**; gli a capo della nota restano | `src/features/editor/NoteDialog.tsx`, `src/services/export.ts` |
| 🔒 **Concetti bloccati sui touch screen**: su telefono e tablet un dito che parte da un concetto muove o ingrandisce la mappa e non trascina mai il concetto; un tocco lo seleziona comunque. Il pulsante con il lucchetto accanto allo zoom li libera per spostarli (e «Sposta» li libera da solo); la scelta resta sul dispositivo. Con i concetti bloccati anche le linee lasciano spostare la mappa su una fascia più ampia. Con il mouse si parte liberi, come prima | `src/features/editor/MapEditor.tsx` |
| 🧹 **Mappa più pulita**: i pallini per collegare compaiono sul concetto scelto (e sotto il mouse, e ovunque mentre si traccia una linea); il «+» delle parole di collegamento è pieno sulle linee del concetto scelto e tenue sulle altre | `src/styles/app.css`, `src/features/editor/LinkAdd.tsx` |
| 📷 **«Dal libro» più robusto (web)**: la foto viene raddrizzata prima della lettura (fino a ±20°); la prima lettura trova da sola colonne e titoli. Con 36 foto di prova (3 pagine × 12 condizioni) l'errore sui caratteri è sceso dal 23% a meno del 2% in 8 condizioni su 12; restano difficili le foto mosse | `src/lib/deskew.ts`, `src/services/ocr/web.ts` |
| ⚡ **Mappe grandi fluide**: le etichette delle linee non cercano più il loro contenitore nel DOM a ogni fotogramma. Con 316 concetti il trascinamento passa da circa 14 a oltre 50 fotogrammi al secondo | `src/features/editor/EdgeLabel.tsx`, `src/features/editor/MapEditor.tsx` |
| 🖊️ **Interfaccia più sobria**: il colore è della mappa. I comandi hanno icone a linea tutte della stessa famiglia (`lucide-react`, in `src/components/Icon.tsx`), le emoji restano solo come immagini dei concetti e delle scelte (modelli, modi di ripasso, benvenuto). Un solo pulsante pieno per schermata, in blu penna (`#2b54b0`, contrasto 7:1); gli altri senza cornice. Barre dell'editor più sottili (telefono: da 211 a 172 px in tutto) e barra di stato dello stesso colore della barra in alto. Nella schermata iniziale «Nuova mappa» è l'unico pulsante grande e le mappe si vedono subito | `src/components/Icon.tsx`, `src/components/BigButton.tsx`, `src/styles/` |
| 🖥️ **La mappa come una pagina sugli schermi larghi**: il foglio A4 è verticale, e su un computer, un Chromebook o un tablet tenuto in orizzontale la mappa intera stava in una colonna stretta, con due fasce vuote ai lati e i nomi troppo piccoli per leggerli (circa 7 px la mappa d'esempio). Ora, quando la mappa intera non si leggerebbe e lo schermo è molto più largo del foglio, si apre larga quanto lo schermo, dalla cima; la rotella e due dita sul touchpad la scorrono come una pagina (per ingrandire: Ctrl + rotella, il pizzico, i pulsanti + e −). Lo stesso dopo «Riordina», la Scaletta e il ripasso; il pulsante «tutta la mappa» la mostra ancora per intero. Sul telefono e sul tablet in verticale si apre tutta come prima, ma senza più i lati tagliati: la prima vista aspetta che le immagini abbiano preso il loro posto | `src/features/editor/MapEditor.tsx` |
| 👀 **Scelte e comandi più facili da leggere e trovare**: nelle schede di scelta (modelli, Ripassa, Salva, Esempi) l'immagine sta accanto al nome e la descrizione occupa tutta la larghezza: meno righe da leggere, e in «Nuova mappa» sul computer i cinque modelli si vedono senza scorrere. Sul telefono «Altro» e «Ripassa» salgono dal basso, vicino al pollice e alla barra da cui si aprono. Accanto al titolo della mappa una matita dice che si può cambiare (sul tablet non c'è il passaggio del mouse). Sul computer la barra degli strumenti è divisa in gruppi: i comandi della barra del telefono, poi quelli di «Altro». Nell'elenco delle mappe la data è «Oggi», «Ieri», «Martedì» o «3 ottobre» invece di 09/10/2026. Con il testo più grande «Nuova mappa» e «Ripassa» non escono più dallo schermo del telefono | `src/styles/app.css`, `src/components/Dialog.tsx`, `src/features/editor/MapEditor.tsx`, `src/lib/friendlyDate.ts` |
| Piccole correzioni: Esc chiude un dialogo anche quando il pulsante che aveva il focus è sparito; «Immagine» non va più a capo nel menu Altro; i cursori di «Aspetto» mostrano il valore; un file che non si riesce a leggere ora lo dice | `src/components/Dialog.tsx`, `src/features/accessibility/SettingsPanel.tsx`, `src/services/openFile.ts` |

La prova con studenti veri e le verifiche sui dispositivi sono in [docs/prova-con-studenti.md](docs/prova-con-studenti.md).

## Il nome: MappAmi (prima Mappeora)

Per chi usa l'app il nome è **MappAmi** ovunque: titolo, icona, schermata d'avvio, testi, permessi, file `.mappami`, pagina privacy.
Restano col vecchio nome solo cose che l'utente non vede e che, cambiate, farebbero danni:

- chiavi di salvataggio (`mappeora-settings`, `mappeora-welcome`…) e nome del database (`mappeora` in IndexedDB e SQLite): cambiarle **cancellerebbe le mappe** già salvate;
- il formato dentro il file (`"format": "mappeora"`): non si vede, e cambiarlo renderebbe i file nuovi illeggibili per chi non ha ancora aggiornato l'app;
- il plugin `MappeoraOcr` e i secret `MAPPEORA_*` di GitHub.

Cambiati invece prima della pubblicazione, quando non c'erano ancora utenti da perdere: l'identificativo dell'app è **`it.mappami.app`** (Android e iOS; dopo l'uscita su Google Play non si potrebbe più cambiare) e l'indirizzo web è **mapp-ami.vercel.app** (`mappami.vercel.app` era già preso). Le mappe salvate nel browser sul vecchio indirizzo non passano al nuovo: il browser le tiene separate per indirizzo.

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

In `e2e/` ci sono circa 90 test che usano l'app come farebbe uno studente: su un **computer** (1280×860) e su un **telefono** (Pixel 7), quindi circa 180 esecuzioni (alcuni test valgono solo per il computer o per il telefono). Ogni test riparte da un browser vuoto. Controllano:
- creare mappe da ogni modello, salvataggio automatico, cancellazione, mappe di esempio;
- aggiungere, rinominare, annullare ed eliminare concetti; parole di collegamento; rami comprimibili; disposizione a foglio A4 senza sovrapposizioni; trascinamento per riordinare;
- immagini: ricerca delle illustrazioni, Google Immagini, incolla, foto dalla galleria;
- Scaletta, menu «Altro» sul telefono, 🔊 sul concetto scelto, benvenuto al primo avvio;
- file `.mappami`, PNG, PDF su 1, 2 o 4 fogli A4/A3, stampa;
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

Il logo è la mascotte di MappAmi, che mostra la sua mappa sul tablet. Il disegno è uno solo, `resources/mascotte.png` (1024×1024, a tutto quadrato, senza angoli arrotondati: ogni sistema ritaglia la sua forma). `npm run icons` (`scripts/make-icons.mjs`) ne ricava tutto con il Chromium di Playwright:
- web e PWA: `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (`icon-192.png` è anche la favicon e il logo nella schermata iniziale);
- Android: icone del launcher (`mipmap-*`, anche adattive e rotonde, con il colore del cielo in `values/ic_launcher_background.xml`) e splash screen chiaro e scuro (`drawable-*` e `drawable-*-night-*`). Da Android 12 lo splash è l'icona sul colore di `values/splash.xml` (crema, o scuro con il telefono in modalità scura);
- iOS: icona dell'App Store (`AppIcon.appiconset`, senza trasparenza) e splash (`Splash.imageset`).

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
| `frontend-design` | anthropics/skills | Direzione visiva: scelte di colore, caratteri e impaginazione pensate per MappAmi, non quelle di default che fanno sembrare un'app «fatta in serie» |
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

MappAmi non raccoglie dati: le mappe restano sul dispositivo, non ci sono account, pubblicità o statistiche. L'informativa, scritta in modo semplice anche per i ragazzi, è in `public/privacy.html`: si apre dalla schermata iniziale («🔒 Privacy») ed è online su https://mapp-ami.vercel.app/privacy.html, l'indirizzo da dare a Google Play. Spiega anche le funzioni che usano servizi esterni: jsDelivr (illustrazioni e motore OCR sul web), Google Immagini, dettatura e alcune voci online del browser.

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
