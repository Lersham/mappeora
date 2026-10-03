# Mappeora

App per creare **mappe concettuali** in modo semplice, pensata per bambini con DSA e per tutti gli studenti.
Legge le mappe ad alta voce e permette di crearle dettando.

Un'unica base di codice (React + TypeScript) viene pubblicata come:

- **Web / PWA**, installabile dal browser e utilizzabile offline;
- **Android** e **iOS**, come app native tramite [Capacitor](https://capacitorjs.com).

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

- **Android** (`android/app/src/main/AndroidManifest.xml`): `RECORD_AUDIO` e `<queries>` per i servizi di riconoscimento e sintesi vocale (Android 11+).
- **iOS** (`ios/App/App/Info.plist`): `NSMicrophoneUsageDescription` e `NSSpeechRecognitionUsageDescription` con testi in italiano; lingua di sviluppo `it`.

## Prossimi passi

**Rifiniture della fase 2**
- [ ] Android/iOS: salvare in locale i pittogrammi usati (nelle app non c'è il service worker, quindi senza internet non si caricano)
- [ ] Note di approfondimento nei nodi, nascoste nella versione per la verifica

**Fase 3: AI e cloud**
- [ ] Dal testo alla mappa (LLM chiamato da una Edge Function: chiavi API mai nel client)
- [ ] Foto della pagina → OCR → mappa
- [ ] Account docente/genitore e sincronizzazione (Supabase); consenso dei genitori per gli under 14
- [ ] TTS cloud per voci più naturali ed esportazione MP3

**Pubblicazione sugli store**
- [ ] Icone e splash screen (`@capacitor/assets`)
- [ ] Apple, categoria Kids: niente analytics di terze parti, parental gate per link esterni
- [ ] Google Play, programma Families: dichiarazione del pubblico di destinazione e informativa privacy
