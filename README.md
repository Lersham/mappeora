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
  npm run android:apk   # → android/app/build/outputs/apk/debug/app-debug.apk
  ```
- **iOS**: serve un Mac con Xcode (`npm run ios`).

## Fase 1: MVP

| Funzione | Dove |
|---|---|
| Editor di mappe: nodi, collegamenti, parole di collegamento (doppio clic sulla freccia) | `src/features/editor` |
| 🔊 Lettura ad alta voce di un nodo o di tutta la mappa, con **evidenziazione parola per parola** | `src/hooks/useReadAloud.ts` |
| 🎤 Dettatura: si parla e nasce un nuovo concetto | `src/hooks/useDictation.ts` |
| 🎨 Profili di leggibilità: font (Lexend, Atkinson Hyperlegible), sfondi crema/azzurro/scuro, stampatello maiuscolo, spaziatura ampia, grandezza testo, velocità e voce | `src/features/accessibility` |
| ✨ Riordina: disposizione automatica ad albero (elkjs, caricato solo al primo utilizzo) | `src/services/layout.ts` |
| ↩️ Annulla/Ripeti illimitati (uno spostamento = un solo passo) | `src/store/mapStore.ts` |
| 💾 Salvataggio automatico, nessun account, funziona offline | `src/services/storage` |
| 📤 Esporta PNG: download sul web, menu "Condividi" nativo su Android/iOS | `src/services/export.ts` |

## Fase 2: contenuti

| Funzione | Dove |
|---|---|
| 🖼️ Pittogrammi ARASAAC (ricerca in italiano, anche a voce) ed emoji nei nodi, con colore e forma | `src/features/editor/NodeStyleDialog.tsx`, `src/services/pictograms.ts` |
| 🧩 Modelli pronti: Libera, 5 W, Causa ed effetto, Linea del tempo (orizzontale), Confronto | `src/lib/templates.ts`, `src/features/home/NewMapDialog.tsx` |
| 🧠 Ripasso "Un passo alla volta" e "Indovina" (concetto nascosto, poi «Scopri») | `src/store/reviewStore.ts`, `src/features/editor/ReviewBar.tsx` |
| 📤 Esporta PDF A4/A3 o PNG, con **versione per la verifica** (bianco e nero, senza decorazioni) | `src/services/export.ts`, `src/features/editor/ExportDialog.tsx` |
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
- **ARASAAC**: licenza CC BY-NC-SA, quindi i crediti compaiono nella finestra di ricerca e in fondo ai PDF, e l'app deve restare non commerciale. I pittogrammi segnati come violenti o sessuali sono esclusi. Sul web il service worker li mette in cache, così restano visibili anche offline.
- **`html-to-image` è bloccato alla 1.11.11**: le versioni successive perdono gli stili delle frecce (SVG) nell'esportazione.
- **Le impostazioni di accessibilità appartengono all'utente, non alla mappa**: una mappa condivisa da un docente si vede con il font e i colori del bambino.
- Si usa `@capgo/capacitor-speech-recognition` al posto di `@capacitor-community/speech-recognition`, che non supporta ancora Swift Package Manager (richiesto da Capacitor 8 su iOS).

## Comandi

Requisiti: Node 22+.

```bash
npm install
npm run dev          # sviluppo web su http://localhost:5173
npm test             # test (Vitest)
npm run typecheck
npm run build        # build web + PWA in dist/
```

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
| `webapp-testing` | anthropics/skills | Test dell'app nel browser con Playwright (Python) |

`webapp-testing` usa Playwright per Python, che nelle sessioni cloud va reinstallato: `pip install playwright==1.56.0` (versione compatibile con il Chromium preinstallato). Per aggiornare le skill: `npx skills update`.

## Prossimi passi

**Rifiniture della fase 2**
- [ ] Android/iOS: salvare in locale i pittogrammi usati (nelle app non c'è il service worker, quindi senza internet non si caricano)
- [ ] Note di approfondimento nei nodi, nascoste nella versione per la verifica

**Fase 3b: AI (rinviata, dopo l'MVP)**
- L'AI che crea l'intera mappa **per ora non serve**.
- Funzioni AI avanzate da progettare in seguito, con un modello economico: **Gemini Flash** (la versione indicata è "3.8": da verificare quando si implementa) oppure il piano token **Alibaba Cloud** già disponibile.
- Vincolo di costo: **tetto di 1 $ al giorno**, applicato sul server (Edge Function) con un contatore giornaliero. Raggiunto il tetto, le funzioni AI si disattivano fino al giorno dopo e l'app continua a funzionare senza.
- La chiave API va solo sul server, mai nell'app. Per i minori servono consenso dei genitori e attivazione da parte di un adulto.
- [ ] Scrittura a mano (appunti sul quaderno)
- [ ] Account docente/genitore e sincronizzazione (Supabase); consenso dei genitori per gli under 14
- [ ] TTS cloud per voci più naturali ed esportazione MP3

**Pubblicazione sugli store**
- [ ] Icone e splash screen (`@capacitor/assets`)
- [ ] Build di release firmata (AAB per Google Play: scarica solo le librerie del processore del dispositivo, molto più leggera dell'APK di debug da 64 MB)
- [ ] Apple, categoria Kids: niente analytics di terze parti, parental gate per link esterni
- [ ] Google Play, programma Families: dichiarazione del pubblico di destinazione e informativa privacy
