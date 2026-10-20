# MappAmi

App per creare **mappe concettuali** in modo semplice, pensata per bambini con DSA e per tutti gli studenti.
Legge le mappe ad alta voce e permette di crearle dettando.

Prima si chiamava **Mappeora**: cosa è cambiato e cosa resta col vecchio nome è in [Il nome](#il-nome-mappami-prima-mappeora).

Un'unica base di codice (React + TypeScript) viene pubblicata come:

- **Web / PWA**, installabile dal browser e utilizzabile offline;
- **Android** e **iOS**, come app native tramite [Capacitor](https://capacitorjs.com).

Per ora si pubblica **solo la versione web** (decisione del 18/10/2026): le app Android e iOS non sono in pubblicazione sui negozi.

## Provare l'app

- **Web / PWA**: https://mapp-ami.vercel.app. Si aggiorna da solo a ogni push sul branch. Dal browser del tablet: menu → "Aggiungi a schermata Home". Come installarla su iPad, iPhone, Android, Chromebook, computer e LIM: `public/installa.html` (online su https://mapp-ami.vercel.app/installa.html).
- **Android** (per ora non in pubblicazione): APK di debug da installare a mano (sul dispositivo va permessa l'installazione da "origini sconosciute"). Per crearlo serve l'Android SDK con JDK 21:
  ```bash
  npm run setup:android  # una volta per macchina/sessione: SDK in /opt/android-sdk (~650 MB)
  npm run android:apk    # → android/app/build/outputs/apk/debug/app-debug.apk
  ```
  Oppure, senza installare nulla: su GitHub, scheda **Actions** → ultima esecuzione di **Controlli** → *Artifacts* → `mappami-android-…` (vedi [Controlli automatici](#controlli-automatici-github-actions)).
- **iOS** (per ora non in pubblicazione): serve un Mac con Xcode (`npm run ios`).

## Fase 1: MVP

| Funzione | Dove |
|---|---|
| Editor di mappe: nodi, collegamenti, parole di collegamento (un tocco sulla freccia) | `src/features/editor` |
| 👆 **Gesti sul concetto, niente doppio tocco**: un tocco lo sceglie; un altro tocco sul concetto scelto (col mouse anche il doppio clic) apre «Nome, colore e immagine»: in cima il nome da riscrivere o dettare, sotto colore, forma e immagine; **tenendolo premuto** mezzo secondo (il contorno tratteggiato dice «ora puoi alzare il dito») si apre il nome per riscriverlo. Da tastiera: Invio o F2 per rinominare | `src/features/editor/ConceptNode.tsx`, `src/features/editor/MapEditor.tsx` |
| 🔊 Lettura ad alta voce di un nodo o di tutta la mappa, con **evidenziazione parola per parola** | `src/hooks/useReadAloud.ts` |
| 🎤 Dettatura: si parla e nasce un nuovo concetto | `src/hooks/useDictation.ts` |
| 🎨 Profili di leggibilità: font (Lexend, Atkinson Hyperlegible, OpenDyslexic), sfondi bianco/crema/azzurro/scuro, stampatello maiuscolo, spaziatura ampia, grandezza testo, velocità e voce. Si parte con Lexend, sfondo bianco, testo al 115%, spaziatura normale e parole evidenziate durante la lettura | `src/features/accessibility` |
| 📄 **Mappe a misura di foglio A4**. Nelle mappe Libera e 5 W la mappa è **un organigramma**: il concetto principale sta in alto, **evidenziato** (bordo scuro e scritta più grande), e i rami principali sotto, **tutti in una riga**, evidenziati con un bordo spesso del colore del ramo. Più giù vale la stessa regola, a ogni livello: i concetti sotto un concetto si affiancano in una riga, lui sopra al centro. Solo un elenco di concetti senza altri sotto che verrebbe troppo largo (più di circa tre concetti brevi) scende in colonna, centrato sotto il suo concetto; anche un concetto unico va dritto sotto. Le parole di collegamento stanno sopra il concetto a cui portano. Comprimere un concetto non rimescola la sua riga. La mappa si rimette in ordine da sola dopo ogni modifica; per cambiare l'ordine si trascina un concetto. Con ✋ **Sposta** i concetti restano dove li mette lo studente, uniti da linee dritte che li seguono; il pulsante resta acceso (evidenziato) finché i concetti sono liberi, e premuto di nuovo li rimette sul foglio; ✨ **Riordina** apre una scelta: «Riordina» rimette la mappa sul foglio A4 lasciando i colori come sono, «Riordina e colora» dà anche a ogni ramo un colore pastello, uguale per il primo concetto del ramo e tutti quelli sotto, nell'ordine dei colori delle linee (il concetto principale resta bianco). «Annulla» torna indietro. I concetti nuovi nascono bianchi. Lettura e ripasso vanno ramo per ramo. Causa ed effetto, Confronto e Linea del tempo (verticale) usano ✨ Riordina, un albero dall'alto in basso (elkjs, caricato al primo utilizzo) | `src/lib/sheetLayout.ts`, `src/features/editor/BusEdge.tsx`, `src/features/editor/FreeEdge.tsx`, `src/services/layout.ts` |
| ↩️ Annulla/Ripeti fino a 200 passi (uno spostamento = un solo passo) | `src/store/mapStore.ts` |
| 💾 Salvataggio automatico, nessun account, funziona offline | `src/services/storage` |
| 📤 Esporta PNG: download sul web, menu "Condividi" nativo su Android/iOS | `src/services/export.ts` |

## Fase 2: contenuti

| Funzione | Dove |
|---|---|
| 🖼️ Immagini nei nodi, con colore e forma. Due schede: **✨ Illustrazioni** (Fluent Emoji di Microsoft, licenza MIT: circa 1.600 immagini cercabili in italiano **sul dispositivo** grazie ai nomi e alle parole chiave Unicode CLDR, es. «Vesuvio» → 🌋) e **📷 Foto**. La ricerca ignora articoli e preposizioni, cerca la frase e poi le singole parole e mette prima i risultati esatti. L'immagine scelta viene **salvata dentro la mappa**, quindi funziona offline e nel file `.mappami`; le mappe vecchie la salvano alla prima apertura con internet. Le illustrazioni si salvano a 224 px (prima 256) in WebP, con la trasparenza; dove il browser non scrive WebP (Safari) si salvano in PNG a 224 px, solo se pesano meno. Le mappe diventano molto più leggere su Android e sul web, solo un po' su iPhone e iPad. 224 px bastano per uno schermo con tre pixel per punto e per l'esportazione in PNG e PDF. Foto e vecchi simboli non cambiano. Si apre toccando ancora il concetto scelto (o da «Immagine» nella barra); **colore e forma stanno in cima**, la scelta dell'immagine sotto | `src/features/editor/NodeStyleDialog.tsx`, `src/services/illustrations.ts`, `src/lib/searchText.ts`, `src/services/embed.ts` |
| 🧩 Modelli pronti: Libera, 5 W, Causa ed effetto, Linea del tempo (verticale), Confronto | `src/lib/templates.ts`, `src/features/home/NewMapDialog.tsx` |
| 🧠 Ripasso "Un passo alla volta" e "Indovina" (concetto nascosto, poi «Scopri») | `src/store/reviewStore.ts`, `src/features/editor/ReviewBar.tsx` |
| ✅ **«Indovina» con autoverifica**: dopo «Scopri» compaiono due pulsanti grandi, «Lo sapevo» e «Non lo sapevo». Si può rispondere anche a voce: «A voce», poi «lo sapevo» o «non lo sapevo». Si capiscono solo le frasi intere, così «non sapevo» non diventa mai «sapevo». Ogni risposta porta al concetto dopo; «Avanti» salta senza contare. Alla fine c'è un riepilogo senza giudizi, letto ad alta voce, con la mappa intera e i concetti da rivedere cerchiati: «Ne sapevi 8 su 10. Da rivedere: …». «Ripassa solo questi» rifà il quiz con i soli concetti da rivedere (gli altri restano sulla mappa come indizi). Le risposte vivono solo durante il ripasso: niente viene salvato, niente notifiche | `src/store/reviewStore.ts`, `src/features/editor/QuizBar.tsx`, `src/lib/voiceCommands.ts` (`parseQuizAnswer`), `src/components/DictationOverlay.tsx` |
| 📤 Esporta PDF A4/A3 o PNG, con **versione per la verifica** (bianco e nero, immagini in grigio) | `src/services/export.ts`, `src/features/editor/ExportDialog.tsx` |
| 🔗 Parole di collegamento: si tocca la freccia e si sceglie tra i suggerimenti, si scrive o si detta | `src/features/editor/LinkWordDialog.tsx` |
| 🗣️ Comandi vocali: «leggi la mappa», «riordina», «annulla», «rifai», «nuovo concetto …» | `src/lib/voiceCommands.ts` |

## Fase 3a: dal libro alla mappa (OCR sul dispositivo)

| Funzione | Dove |
|---|---|
| 📷 Si fotografa una pagina (o si sceglie una foto) e il testo viene letto **sul dispositivo**: la foto non esce mai dal telefono | `src/features/ocr/PhotoTextDialog.tsx`, `src/services/ocr` |
| 🔊 Il testo si legge ad alta voce, frase per frase, con la parola evidenziata | `src/hooks/useReadLongText.ts` |
| 👆 Si toccano le parole importanti, o ci si passa sopra il dito come un evidenziatore (anche andando a capo; dal bordo del testo invece si scorre): quelle vicine diventano un unico concetto («luce» + «del» + «sole» → «Luce del sole») e si aggiungono alla mappa. Sotto il testo si vedono i concetti: la catena ne unisce due vicini, le forbici ne dividono uno in parole | `src/lib/ocrText.ts`, `src/features/ocr/PhotoTextDialog.tsx` |
| 📖 Ogni mappa ricorda l'ultima pagina fotografata: riaprendo «Dal libro» si riparte da lì, con le parole già aggiunte sottolineate a puntini | `src/lib/bookPage.ts` |
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
| 📚 **Mappe di esempio**: pulsante «Esempi» nella schermata iniziale; tre mappe di Storia, *La civiltà egizia* (48 concetti), *La nascita di Roma* (41, con la leggenda separata dalla storia vera) e *La Rivoluzione francese* (39): bianche come una mappa nuova, con foto e dipinti veri da Wikimedia Commons (crediti in `public/crediti.html`) e illustrazioni («Riordina e colora» dà un colore a ogni ramo). Si apre una copia da modificare. I file sono in `public/esempi`, generati dagli script in `scripts/esempi` | `src/services/examples.ts`, `src/features/home/ExamplesDialog.tsx` |
| 🙋 **Interrogazione**: tutta la mappa a schermo intero, un concetto alla volta in evidenza (gli altri sbiaditi), testo grande in basso. Si va avanti con frecce, barra spaziatrice o PagSu/PagGiù (telecomandi per presentazioni sulla LIM), oppure toccando un concetto. L'app legge solo se si preme «Leggi»: a parlare è lo studente | `src/store/reviewStore.ts`, `src/features/editor/MapEditor.tsx` |
| 📷 **Foto e Google**: foto scattata o presa dalla galleria, oppure **«Cerca su Google»**, che apre Google Immagini (con SafeSearch) sul concetto: si copia l'immagine e, tornando nell'app, **arriva da sola** (dove il browser lascia leggere gli appunti: Chrome, Chromebook, Edge); altrimenti «Incolla immagine», che si illumina, o Ctrl+V. Se l'app non può leggere gli appunti, compare un riquadro dove incollare a mano. Le immagini vengono ridotte a 480 px e salvate dentro la mappa. L'API di ricerca di Google non è più disponibile per i nuovi progetti, per questo la ricerca si fa nel browser | `src/features/editor/NodeStyleDialog.tsx`, `src/services/photo.ts`, `src/services/webImage.ts` |
| ➖ **Nodi comprimibili**: il pulsante sotto un concetto nasconde i concetti che dipendono da lui (resta il numero, es. «+3»). Lettura, ripasso, «Riordina» ed esportazione lavorano su ciò che si vede | `src/lib/collapse.ts` |
| 🖨️ **Stampa A4/A3** su 1, 2 o 4 fogli, in **verticale**, o in **orizzontale** quando così la mappa esce più grande (un organigramma largo). Le mappe lunghe (scaletta) sono impaginate **in colonne, come un giornale** (fino a 3 per foglio), e i tagli cadono tra un concetto e l'altro, mai in mezzo; se non si può, i pezzi si sovrappongono un po'. Con 4 fogli una mappa larga può diventare un poster 2×2. Ogni foglio ha titolo, data e «pagina 1 di 2», scritti **con il carattere, la spaziatura e il maiuscolo scelti dallo studente** (disegnati come immagine, perché jsPDF conosce solo i suoi font; sotto restano le stesse parole come testo invisibile, così il PDF si può cercare e leggere ad alta voce). Sul web con mouse e tastiera c'è anche «Stampa» diretta; su telefono e tablet no (Chrome Android non stampa un PDF da dentro la pagina): si scarica il PDF e si stampa da lì | `src/lib/pagePlan.ts`, `src/services/export.ts` |

### Indice delle illustrazioni

`src/data/illustrations.json` è generato da `node scripts/build-illustrations.mjs`, che scarica i metadati di Fluent Emoji (versione fissata da un commit) e le parole chiave italiane di Unicode CLDR. Il file generato è nel repo: la build dell'app non ha bisogno di rete. Se si cambia versione di Fluent, va aggiornato anche `FLUENT_COMMIT` in `src/services/illustrations.ts` (un test controlla che coincidano).

## Fase 5: più semplice da usare

| Funzione | Dove |
|---|---|
| 📱 **Barra del telefono**: in basso restano Concetto, Detta, Leggi, Ripassa e **«Altro»**, che apre gli altri strumenti (Dal libro, Sposta/Riordina, Salva, Aspetto). Immagine ed Elimina compaiono sopra la mappa quando si sceglie un concetto | `src/features/editor/MapEditor.tsx` |
| 🔊 Il pulsante per ascoltare un concetto compare **solo sul concetto selezionato** (e nel ripasso), così la mappa resta pulita | `src/features/editor/ConceptNode.tsx` |
| 👋 **Benvenuto** al primo avvio: cinque pagine brevi, ognuna da ascoltare, con «Guarda un esempio» alla fine. Già la seconda pagina ha **«📷 Provalo adesso»**: crea una mappa nuova e apre subito «Dal libro». Le prime parole scelte diventano il concetto principale e il titolo. Si riapre con «❓ Come funziona» nella schermata iniziale | `src/features/home/WelcomeDialog.tsx`, `src/App.tsx` |
| 🎓 **Impara facendo**: pulsante nella schermata iniziale. Crea «La mia prima mappa» e una scheda sotto la mappa guida passo per passo da fare davvero: idea principale, nuovo concetto, nome, parola di collegamento, «Leggi», «Detta», un'immagine (disegno oppure Google: «Copia immagine» e si torna), togliere una freccia («Togli freccia») e rimetterla con «Annulla». Poi ogni altro pulsante: «Cambia ramo», «Sposta», «Riordina» → «Riordina e colora» (la mappa nasce bianca e si colora; se sotto l'idea principale c'è un ramo solo, prima ne fa aggiungere un secondo), il colore di un solo concetto, «Elimina», «Dal libro», «Ripassa», «Salva», «Aspetto», «Solo la mappa»; in tutto 21 passi. Il pulsante da premere è evidenziato, e ogni passo dice dov'è: se è dentro «Altro» (telefono o barra piena) è evidenziato anche «Altro». Ogni passo si può ascoltare o saltare, e appena è fatto compare «Avanti». Alla fine («Fine» o «Chiudi») la mappa torna bianca, in un passo che «Annulla» può disfare | `src/features/tutorial/`, `src/features/editor/MapEditor.tsx` |
| 🖍️ **Evidenziatore in «Dal libro»**: invece di toccare le parole una per una, ci si passa sopra il dito come sul libro. Parole vicine diventano un solo concetto; passare su parole già scelte le toglie. Su e giù il testo scorre come sempre. Senza AI: le parole le sceglie lo studente | `src/features/ocr/PhotoTextDialog.tsx` |

## Fase 6: dopo l'assessment di ottobre 2026

| Funzione | Dove |
|---|---|
| 💾 **Salva tutte le mappe**: un solo file `.mappami` con tutte le mappe del dispositivo (formato interno `mappeora-archivio`). «Apri file» lo riconosce e rimette le mappe che mancano, senza doppioni e senza mai sovrascrivere: una mappa più nuova nel file torna accanto a quella che c'è, con «(dalla copia)». Un promemoria nella schermata iniziale chiede una copia quando le mappe sono almeno tre (o una ha una settimana) e poi ogni due settimane se qualcosa è cambiato; «Più tardi» lo rimanda di una settimana. Su iPhone e iPad, se MappAmi non è nella schermata Home, un avviso spiega come aggiungerla: Safari può cancellare i dati di un sito dopo 7 giorni senza visite | `src/services/backup.ts`, `src/lib/mapFile.ts`, `src/features/home/HomeScreen.tsx` |
| ✍️ **Concetto nuovo già pronto per scrivere**: dopo «Concetto» il riquadro è aperto, con il testo selezionato. Mentre si scrive, **Tab** crea un concetto sotto e **Maiusc+Tab** uno accanto | `src/features/editor/ConceptNode.tsx`, `src/features/editor/MapEditor.tsx` |
| 🗣️ **Lettura in frasi**: con le parole di collegamento si legge la proposizione intera («L'acqua è formata da idrogeno»), anche nella didascalia dell'Interrogazione | `src/lib/readingOrder.ts` |
| 🔊 **Evidenziazione anche senza eventi della voce**: alcune voci (le voci online «Google» di Chrome) non dicono a che parola sono; l'evidenziazione segue allora una stima del tempo di ogni parola, finché la voce non ne segnala una vera | `src/services/speech/web.ts` |
| 🔍 **Mappa leggibile sul telefono**: toccando un concetto il cui testo sullo schermo è sotto i 12 px, il suo ramo si avvicina (o il concetto stesso, se il ramo non ci sta). Aspetta un attimo, così un secondo tocco veloce (per cambiare immagine e colore) trova il concetto ancora al suo posto. Anche un concetto nuovo si avvicina, per vedere cosa si scrive | `src/features/editor/MapEditor.tsx` |
| 🌈 **Ogni ramo il suo colore** (mappe Libera e 5 W): le linee del ramo e il bordo del suo primo concetto hanno lo stesso colore, così il ramo si riconosce a colpo d'occhio. Nella versione per la verifica linee e bordi tornano neri | `src/lib/sheetLayout.ts`, `src/features/editor/branchColor.ts`, `src/features/editor/ConceptNode.tsx`, `src/styles/theme.css` |
| 🔒 **Concetti bloccati sui touch screen**: su telefono e tablet un dito che parte da un concetto muove o ingrandisce la mappa e non trascina il concetto; un tocco lo seleziona comunque. Sul foglio A4 restano al loro posto (niente più lucchetto); solo il concetto scelto, quello con la barra sotto, si trascina col dito per cambiargli posto nel ramo. Per metterli dove si vuole c'è «Sposta», che li libera. Non ci sono pallini da trascinare per disegnare linee: un concetto si sposta sotto un altro con «Cambia ramo». Con i concetti bloccati anche le linee lasciano spostare la mappa su una fascia più ampia. Con il mouse si trascina come prima | `src/features/editor/MapEditor.tsx` |
| 🧹 **Mappa più pulita**: niente pallini per collegare; il «+» delle parole di collegamento è pieno sulle linee del concetto scelto e tenue sulle altre | `src/styles/app.css`, `src/features/editor/LinkAdd.tsx` |
| 📷 **«Dal libro» più robusto (web)**: la foto viene raddrizzata prima della lettura (fino a ±20°); la prima lettura trova da sola colonne e titoli. Con 36 foto di prova (3 pagine × 12 condizioni) l'errore sui caratteri è sceso dal 23% a meno del 2% in 8 condizioni su 12; restano difficili le foto mosse | `src/lib/deskew.ts`, `src/services/ocr/web.ts` |
| ⚡ **Mappe grandi fluide**: le etichette delle linee non cercano più il loro contenitore nel DOM a ogni fotogramma. Ogni linea (foglio, albero, concetti liberi) si ridisegna solo quando cambia quello che disegna (estremi, lati, parole di collegamento, selezione, curve): prima ogni scelta di un concetto, ogni fotogramma di un trascinamento e ogni lettera del titolo ridisegnava tutte le linee, due volte. Con 300 concetti scegliere un concetto passa da 598 a 5 ridisegni di linee, trascinarlo da 23.621 a 195, scrivere il titolo da 5.980 a 0. Le linee curve condividono un solo ascoltatore dei font invece di uno ciascuna. Con 316 concetti il trascinamento passa da circa 14 a oltre 50 fotogrammi al secondo | `src/features/editor/EdgeLabel.tsx`, `src/features/editor/edgeMemo.ts`, `src/features/editor/BusEdge.tsx`, `src/features/editor/TreeEdge.tsx`, `src/features/editor/FreeEdge.tsx`, `src/features/editor/MapEditor.tsx` |
| 🔊 **Lettura ad alta voce senza scatti nelle mappe grandi**: le funzioni di lettura (`readNodeAloud`, `readMapAloud`, `readStepsAloud`, `readTextAloud`) stanno fuori dall'hook, quindi i concetti non si ridisegnano più quando la lettura parte o si ferma; `useReadAloud()` resta per chi vuole sapere se sta leggendo. La parola evidenziata non allarga più il concetto (prima aggiungeva 4 px a ogni parola e il foglio si rimetteva in ordine a ogni parola): con 300 concetti, 1,5 secondi di lettura passano da 4.485 a 18 ridisegni di linee e il tempo per fotogramma da 123 a 18 ms | `src/hooks/useReadAloud.ts`, `src/features/editor/ConceptNode.tsx` |
| 🖊️ **Interfaccia più sobria**: il colore è della mappa. I comandi hanno icone a linea tutte della stessa famiglia (`lucide-react`, in `src/components/Icon.tsx`), le emoji restano solo come immagini dei concetti e delle scelte (modelli, modi di ripasso, benvenuto). Un solo pulsante pieno per schermata, in blu penna (`#2b54b0`, contrasto 7:1); gli altri senza cornice. Barre dell'editor più sottili (telefono: da 211 a 172 px in tutto) e barra di stato dello stesso colore della barra in alto. Nella schermata iniziale «Nuova mappa» è l'unico pulsante grande e le mappe si vedono subito | `src/components/Icon.tsx`, `src/components/BigButton.tsx`, `src/styles/` |
| 🖥️ **La mappa come una pagina sugli schermi larghi**: il foglio A4 è verticale, e su un computer, un Chromebook o un tablet tenuto in orizzontale la mappa intera stava in una colonna stretta, con due fasce vuote ai lati e i nomi troppo piccoli per leggerli (circa 7 px la mappa d'esempio). Ora, quando la mappa intera non si leggerebbe e lo schermo è molto più largo del foglio, si apre larga quanto lo schermo, dalla cima; una mappa più larga dello schermo (l'organigramma con molti rami) si apre leggibile, dalla cima e centrata sul concetto principale; la rotella e due dita sul touchpad la scorrono come una pagina (per ingrandire: Ctrl + rotella, il pizzico, i pulsanti + e −). Lo stesso dopo «Riordina» e il ripasso; il pulsante «tutta la mappa» la mostra ancora per intero. Sul telefono e sul tablet in verticale si apre tutta come prima, ma senza più i lati tagliati: la prima vista aspetta che le immagini abbiano preso il loro posto. Anche la barra in alto è una riga sottile, con la parola accanto alla sua icona: sul tablet in orizzontale lascia alla mappa 15 px in più, 21 con il testo più grande (sul telefono resta com'era, con il titolo su una riga sua). | `src/features/editor/MapEditor.tsx`, `src/styles/app.css` |
| 👀 **Scelte e comandi più facili da leggere e trovare**: nelle schede di scelta (modelli, Ripassa, Salva, Esempi) l'immagine sta accanto al nome e la descrizione occupa tutta la larghezza: meno righe da leggere, e in «Nuova mappa» sul computer i cinque modelli si vedono senza scorrere. Sul telefono «Altro» e «Ripassa» salgono dal basso, vicino al pollice e alla barra da cui si aprono. Accanto al titolo della mappa una matita dice che si può cambiare (sul tablet non c'è il passaggio del mouse). Sul computer la barra degli strumenti è divisa in gruppi: i comandi della barra del telefono, poi quelli di «Altro». Nell'elenco delle mappe la data è «Oggi», «Ieri», «Martedì» o «3 ottobre» invece di 09/10/2026. Con il testo più grande «Nuova mappa» e «Ripassa» non escono più dallo schermo del telefono | `src/styles/app.css`, `src/components/Dialog.tsx`, `src/features/editor/MapEditor.tsx`, `src/lib/friendlyDate.ts` |
| ✂️ **Niente più parole tagliate, spezzate o fuori dallo schermo**, anche con il testo più grande, OpenDyslexic e la spaziatura ampia: il titolo della mappa finisce con «…» invece che a metà lettera; la barra degli strumenti mette in «Altro» quello che non ci sta (misurato, non più a 900 px fissi), invece di uscire dallo schermo; in «Altro», nelle schede di scelta e nell'elenco delle mappe una parola non si spezza più a metà («stampar-e», «RIVOLUZIO-NE»); i pulsanti della guida non finiscono uno sopra l'altro; il concetto che si sta scrivendo mostra tutte le sue parole; le lettere di OpenDyslexic non sono più tagliate in basso nelle barre. Le finestre crescono con il testo: con il testo grande su un tablet non sono più una colonna stretta in mezzo a uno schermo vuoto. Una mappa troppo grande per starci tutta, anche da lontano (testo grande sul telefono), si apre dalla cima con il concetto principale, invece che centrata e tagliata sopra e sotto; lo stesso con «Mostra tutta la mappa». I pulsanti dello zoom e il titolo sono grandi almeno 44 px, come gli altri. Un test end-to-end percorre tutte le schermate con il testo più grande e fallisce se ritrova uno di questi difetti | `src/styles/app.css`, `src/hooks/useCrowded.ts`, `e2e/helpers.ts` (`drawnBadly`) |
| 🧭 **Barre più leggere, stesse funzioni**: sul telefono la barra in alto è una riga sola (←, titolo, ↶ ↷: la mappa guadagna 50 px, le barre passano dal 21% al 15% dello schermo). Sugli schermi larghi la barra degli strumenti **galleggia sopra la mappa**, larga quanto i suoi pulsanti (da 940 a 600 px su un tablet in orizzontale), e la mappa continua sotto e ai lati; con il testo grande, quando non ci sta, torna la barra intera con «Altro». **Salva e Aspetto** passano in alto a destra, accanto ad Annulla e Ripeti: riguardano la mappa intera. **Immagine ed Elimina** compaiono in una piccola barra in basso solo quando si sceglie un concetto (sul telefono non più dentro «Altro»: un tocco invece di due). Sui touch screen spariscono «+» e «−» dello zoom: si ingrandisce con due dita. **«Solo la mappa»** (il pulsante con la lavagna, accanto allo zoom) nasconde tutti i pulsanti per studiare o mostrare la mappa sulla LIM; si torna con «Mostra i pulsanti», Esc o Indietro | `src/features/editor/MapEditor.tsx`, `src/styles/app.css` |
| 🎯 **La barra del concetto scelto**: toccando un concetto compare in basso tutto quello che lo riguarda, in 2–3 tocchi: **Nome** (riscrive il nome; tenere premuto funziona ancora), **Immagine**, **Cambia ramo** (poi si tocca il concetto sotto cui metterlo, con il suo ramo e le sue parole di collegamento; mai sotto il suo stesso ramo) ed **Elimina**. Se il concetto ha altri concetti sotto, «Elimina» chiede: **solo lui** (quelli sotto salgono di un livello, sotto il suo genitore, invece di restare staccati) oppure **tutto il ramo**; l'idea principale con concetti sotto non si elimina da sola. Durante «Cambia ramo» una riga in alto dice cosa toccare, con «Annulla» (anche Esc o un tocco sulla mappa vuota). Ogni azione è un solo passo di «Annulla». Se la barra copre il concetto scelto, la mappa sale quanto basta. Il lucchetto non c'è più (vedi «Concetti bloccati») | `src/features/editor/MapEditor.tsx`, `src/lib/branch.ts`, `src/store/mapStore.ts` |
| 🗑️ **Cancellare senza «Sei sicuro?», con «Annulla»**: il cestino nell'elenco delle mappe non apre più la conferma del browser (nel suo carattere, non in quello dello studente, e a cui si risponde «OK» senza leggere). La mappa sparisce subito e al suo posto resta un riquadro tratteggiato, «Hai cancellato «…»», con **«Annulla»** che la rimette dov'era; il fuoco va su «Annulla» e poi torna sulla mappa. Vale finché si resta nella schermata iniziale. **Il riquadro della copia dice a che punto si è** invece di avvisare: «Ultima copia di sicurezza: mercoledì. Da allora hai lavorato su 2 mappe» (oppure «È aggiornata»); senza copie, «Le tue mappe sono su questo dispositivo. Fanne una copia…». Il promemoria quando la copia serve davvero resta com'era | `src/features/home/HomeScreen.tsx`, `src/services/backup.ts` |
| 🔎 **Tante mappe, sempre a portata**: oltre le 6 mappe la schermata iniziale mostra **le 5 più recenti** (quasi sempre quelle che servono) e sotto **«Tutte le mie mappe (N)»**, che apre le altre portando il fuoco sulla prima che era nascosta; così «Altri modi per iniziare» e la copia di sicurezza non finiscono in fondo a una lista lunga. Sopra l'elenco compare **«Cerca una mappa»**, che cerca nei titoli di tutte le mappe come scrive un bambino: senza accenti, al singolare o al plurale, in qualsiasi ordine («vulcani» trova «Il vulcano», «perche» trova «Perché piove?»); si può anche **dettare** con il microfono. Il risultato è scritto e letto dallo screen reader («Ho trovato 2 mappe», «Non trovo mappe con «…» nel titolo»). Niente cartelle né etichette da tenere in ordine | `src/features/home/HomeScreen.tsx`, `src/lib/searchText.ts` |
| 🙂 **La mascotte dove l'app parla al bambino**: nel benvenuto mostra la sua mappa; nella schermata iniziale vuota («Non hai ancora mappe») e nella guida «Impara facendo» indica, ed esulta quando il passo è fatto; quando «Cerca una mappa» non trova niente cerca con la lente; nella schermata d'errore si gratta la testa. Nel resto dell'app non c'è, per non distrarre dalla mappa. È solo decorazione (testo alternativo vuoto): le parole accanto dicono già tutto | `src/components/Mascot.tsx`, `src/assets/mascotte/` |
| Piccole correzioni: Esc chiude un dialogo anche quando il pulsante che aveva il focus è sparito; «Immagine» non va più a capo nel menu Altro; i cursori di «Aspetto» mostrano il valore; un file che non si riesce a leggere ora lo dice | `src/components/Dialog.tsx`, `src/features/accessibility/SettingsPanel.tsx`, `src/services/openFile.ts` |

La prova con studenti veri e le verifiche sui dispositivi sono in [docs/prova-con-studenti.md](docs/prova-con-studenti.md).

## Fase 7: pronta per il lancio (ottobre 2026)

Il lancio è **solo web**, su https://mapp-ami.vercel.app. Questa fase prepara il sito a farsi trovare, ad aprirsi in fretta, a riprendersi da solo dopo un errore o un aggiornamento e a spiegare come si installa.

| Funzione | Dove |
|---|---|
| 🔎 **MappAmi si fa trovare e si condivide bene**: titolo e descrizione in italiano, indirizzo canonico, anteprima per chat e social (`og-image.png`, 1200×630, la mascotte con «Mappe concettuali che si ascoltano»), `robots.txt` e `sitemap.xml`. Una **pagina di presentazione**, «Mappe concettuali per bambini con DSA e per tutti gli studenti» (cosa fa, per genitori e insegnanti, privacy in breve, domande frequenti, dati strutturati JSON-LD `WebApplication`), su https://mapp-ami.vercel.app/mappe-concettuali-dsa.html. Senza JavaScript si vede un messaggio con i link alle pagine statiche | `index.html`, `public/mappe-concettuali-dsa.html`, `public/robots.txt`, `public/sitemap.xml`, `public/og-image.png` |
| 📲 **Come installare MappAmi**: una pagina statica con i passi per iPad e iPhone (Safari → Condividi → «Aggiungi alla schermata Home»: schermo intero vero e mappe al sicuro), tablet Android, Chromebook, computer e LIM («Solo la mappa» e «Interrogazione»). L'avviso «Schermo intero» di iPhone e iPad ha il link «Guarda come si fa», che la apre in un'altra scheda; dalla schermata iniziale quell'avviso si riduceva a una striscia di 60 px, ora è a tutto schermo | `public/installa.html`, `src/components/FullscreenButton.tsx` |
| 🖼️ **Schermate per la finestra «Installa» di Chrome**: quattro immagini WebP sotto i 150 KB (due da telefono 1080×1920, due da schermo largo 1920×1080) nel campo `screenshots` del manifest. Non finiscono nella cache del service worker: Chrome le scarica solo quando mostra la finestra. Si rifanno con `npm run screenshots` | `public/screenshots/`, `scripts/make-screenshots.mjs`, `vite.config.ts` |
| ⚡ **Apertura più veloce**: l'editor non è più nel file principale (da 729 KB a circa 447 KB, da 236 KB a circa 143 KB compressi) ma in un file a parte (circa 113 KB), scaricato da solo quando l'elenco è fermo (salvo «Risparmio dati»): la prima mappa si apre subito, e se il file tarda si vede «Apro la mappa…». `html-to-image`, `jsPDF` (per il PDF) ed `elkjs` (per «Riordina») si caricano solo quando servono; `@xyflow/react` (circa 187 KB, in un file a parte) arriva invece insieme all'editor | `src/App.tsx`, `src/services/export.ts`, `src/lib/mapFactory.ts` |
| 🎨 **Niente lampo bianco, barra del colore giusto**: `public/theme-init.js` (script classico di 1 KB prima del modulo, perché la CSP non ammette script inline) applica sfondo, grandezza del testo, spaziatura, maiuscolo e colore della barra salvati in `mappeora-settings` prima del primo disegno; in attesa dell'app si vede «MappAmi» e «Sto caricando…». Poi il colore della barra del browser (`theme-color`) segue lo sfondo scelto (bianco, che è quello di partenza, crema, azzurro, scuro). I quattro colori stanno in `src/lib/themeColor.ts` e vanno cambiati insieme a `public/theme-init.js` | `public/theme-init.js`, `index.html`, `src/App.tsx`, `src/lib/themeColor.ts` |
| 🎨 **Pagine statiche con l'aspetto del bambino**: la presentazione, i crediti e «Come installare» leggono da `mappeora-settings` (solo sul dispositivo, nulla viene inviato) sfondo, grandezza del testo, spaziatura e maiuscolo (`public/static-settings.js`, nella `<head>`, così non c'è lampo). I caratteri non si applicano: si usa quello di sistema. L'informativa privacy resta com'è | `public/static-settings.js`, `public/crediti.html`, `public/mappe-concettuali-dsa.html`, `public/installa.html` |
| 🩺 **Dettagli per chi ti aiuta, senza inviare nulla**: se qualcosa si rompe, gli ultimi 10 errori (ora, messaggio breve, poche righe di traccia, versione, sistema) restano **solo sul dispositivo** (`localStorage`, chiave `mappeora-errors`): mai il contenuto o il titolo di una mappa, niente statistiche. Nella schermata «Qualcosa è andato storto» e in fondo a «Aspetto» c'è «Copia i dettagli per chi ti aiuta»: il testo va negli appunti per incollarlo in un messaggio, oppure, se il browser non lascia copiare, si mostra da selezionare | `src/services/errorLog.ts`, `src/components/CopyDetails.tsx`, `src/components/ErrorBoundary.tsx`, `src/main.tsx` |
| 🛟 **Niente pagina bianca**: un secondo riquadro di sicurezza attorno a tutta l'app (solo «Riavvia l'app») prende anche gli errori di `App` stessa; quello interno resta con «Torna alle mappe» | `src/main.tsx`, `src/components/ErrorBoundary.tsx` |
| 🔄 **Ripresa dopo un aggiornamento**: se un pezzo dell'app caricato dopo (l'editor, Riordina, il PDF…) non arriva più perché è uscita una versione nuova, la pagina salva e carica la versione nuova, ma solo per quello che il bambino ha chiesto (un pezzo scaricato in anticipo che non arriva non ricarica niente), senza internet non ci prova e non lo rifà prima di un minuto (`sessionStorage`, chiave `mappeora-reloaded`), così un'app aperta per giorni si riprende senza ricaricamenti a ripetizione. Se il pezzo mancante fa comparire «Qualcosa è andato storto», «Torna alle mappe» ricarica la pagina | `src/main.tsx`, `src/services/preloadError.ts`, `src/components/ErrorBoundary.tsx` |
| ⬆️ **«Aggiorna» quando esce una versione nuova**: l'app scarica da sola la versione nuova e non ricarica mai la pagina sotto le mani del bambino. Nell'elenco e dentro una mappa compare «È uscita una nuova versione di MappAmi» con «Aggiorna» (nella mappa anche «Dopo»): «Aggiorna» salva e riapre la stessa mappa nella versione nuova. In fondo a «Aspetto», «Cerca aggiornamenti» controlla subito, senza aspettare il controllo automatico (all'apertura, ogni ora e a ogni ritorno nell'app) | `src/services/pwaUpdate.ts`, `src/features/editor/UpdateNotice.tsx`, `src/components/UpdateCheck.tsx` |
| 🔢 **Versione dell'app**: scritta in fondo a «Aspetto» e nei dettagli per chi aiuta. È la versione del `package.json` più i primi 7 caratteri del commit su Vercel (`+abc1234`); la variabile `MAPPEORA_VERSION_NAME` la sostituisce (per le build native). Definita a build con `define` come `__APP_VERSION__` | `vite.config.ts`, `src/types/globals.d.ts`, `src/features/accessibility/SettingsPanel.tsx` |
| ↩️ **«Ripristina» si può annullare**: resta a un tocco, ma subito dopo compare «Ho rimesso le impostazioni di partenza. Annulla», che rimette carattere, grandezza, sfondo, voce e il resto come prima, anche se si è premuto «Ripristina» due volte. Chiudendo la finestra, o cambiando un'altra impostazione, non resta niente da annullare | `src/features/accessibility/SettingsPanel.tsx` |
| 📍 **Si capisce dove si è**: il titolo della pagina diventa «Titolo – MappAmi» con una mappa aperta e torna quello di prima sull'elenco; una voce nascosta dice «Mappa aperta: …» o «Elenco delle mappe» solo quando la schermata cambia (non alla prima, non quando si rinomina). Il fuoco non si sposta, per non aprire la tastiera sul touch | `src/App.tsx` |
| 🧱 **Schermata iniziale ferma**: «Altri modi per iniziare» compare quando è arrivato l'elenco delle mappe, non prima: lo spostamento di layout (CLS) sul telefono con 6 mappe scende da 0,43–0,55 a circa 0,06 | `src/features/home/HomeScreen.tsx` |
| 📂 **«Apri file» rifiuta i file enormi** (oltre 100 MB) prima di leggerli: «Questo file è troppo grande per essere una mappa.» | `src/services/openFile.ts` |
| 🔊 **Gli errori si possono ascoltare**: accanto al messaggio d'errore (il microfono che non parte o non ha il permesso, «Esempi» senza internet, «Salva e manda» che non riesce, una foto o un'immagine incollata che non va, la dettatura, l'avviso «Questa mappa è stata cambiata in un'altra finestra») c'è un 🔊 **«Ascolta»** che lo legge ad alta voce. Si legge **solo se lo chiedi**: niente parte da solo e non c'è un'impostazione in più. Il 🔊 sta fuori dall'avviso, quindi il lettore di schermo non lo annuncia insieme al messaggio | `src/components/SpokenError.tsx`, `src/components/MicButton.tsx`, `src/components/DictationOverlay.tsx`, `src/features/editor/SaveProblemNotice.tsx`, `src/features/editor/ExportDialog.tsx`, `src/features/editor/NodeStyleDialog.tsx`, `src/features/home/ExamplesDialog.tsx` |
| 🎨 **Contrasto che si vede davvero (WCAG 1.4.11)**: l'anello del fuoco da tastiera era arancione chiaro (2,7–2,9:1 sulla carta) e il bordo dei campi quasi invisibile (1,4–1,5:1). Ora l'anello è arancione scuro sui fogli chiari (`--focus` #b35400, 4,5–5:1) e arancione vivo nel tema scuro, e i campi hanno il bordo `--field-border`, 3,5:1 o più su ogni sfondo. Con l'**alto contrasto di Windows** (colori forzati) la scelta fatta (carattere, sfondo, forma, colore, modello, concetto scelto) ha una cornice spessa nel colore «selezionato» di sistema e la parola scelta in «Dal libro» è sottolineata; prima sparivano | `src/styles/theme.css` |
| ⌨️ **Benvenuto da tastiera**: «Avanti» e «Inizia» sono lo stesso pulsante e tengono il fuoco da una pagina all'altra; «Indietro» sulla seconda pagina non lascia più il fuoco sulla pagina (si perdeva anche Esc). In «Dal libro» la barra di avanzamento («Sto leggendo la pagina…») ha un nome e dice a quanti per cento è | `src/features/home/WelcomeDialog.tsx`, `src/features/ocr/PhotoTextDialog.tsx` |
| 📦 **Service worker e cache**: `robots.txt`, `sitemap.xml`, `og-image.png` e le pagine statiche non ricevono mai la pagina dell'app al loro posto, anche con `?…` nell'indirizzo; `og-image.png` e le schermate non sono nel precache. `vercel.json` mette `Cache-Control: immutable` per un anno ai file di `/assets` (hanno l'impronta nel nome). Il manifest ha `id`, `categories`, `dir`, `prefer_related_applications` | `vite.config.ts`, `vercel.json` |
| 🤖 **Android** (per quando si pubblicherà): il microfono non è obbligatorio (`uses-feature … required=false`: senza, Google Play nasconde l'app ai dispositivi senza microfono, che possono usare tutto tranne la dettatura). `android.minWebViewVersion: 111` per ora scrive solo un avviso nel registro di sistema | `android/app/src/main/AndroidManifest.xml`, `capacitor.config.ts` |

Per pubblicare e per tornare indietro: [docs/rilascio.md](docs/rilascio.md) (lista prima e dopo il rilascio, Instant Rollback, regole su Dexie e `.mappami`, l'indirizzo come casa delle mappe). Dove si colloca MappAmi tra le altre app: [docs/mercato.md](docs/mercato.md). Come far conoscere il sito senza tracciare nessuno: [docs/lancio-web.md](docs/lancio-web.md).

## Il nome: MappAmi (prima Mappeora)

Per chi usa l'app il nome è **MappAmi** ovunque: titolo, icona, schermata d'avvio, testi, permessi, file `.mappami`, pagina privacy.
Restano col vecchio nome solo cose che l'utente non vede e che, cambiate, farebbero danni:

- chiavi di salvataggio (`mappeora-settings`, `mappeora-welcome`…) e nome del database (`mappeora` in IndexedDB e SQLite): cambiarle **cancellerebbe le mappe** già salvate;
- il formato dentro il file (`"format": "mappeora"`): non si vede, e cambiarlo renderebbe i file nuovi illeggibili per chi non ha ancora aggiornato l'app;
- il plugin `MappeoraOcr` e i secret `MAPPEORA_*` di GitHub.

Il nome del pacchetto npm (`package.json`) e quello dell'artifact della CI (`mappami-android-…`) sono invece già **mappami**: non toccano nessun dato salvato.

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
│  ├─ export.ts        # html-to-image + Filesystem/Share
│  ├─ errorLog.ts      # appunti locali sugli errori (mai inviati)
│  └─ preloadError.ts  # ripresa quando un pezzo dell'app non c'è più dopo un aggiornamento
├─ lib/                # modello dati, ordine di lettura, palette
└─ types/map.ts        # ConceptMap, MapNode, MapEdge
public/                # pagine statiche: presentazione (mappe-concettuali-dsa.html), installa.html,
                       # crediti.html, privacy.html; theme-init.js e static-settings.js per l'aspetto
android/  ios/         # progetti nativi generati da Capacitor (versionati)
```

`App.tsx` carica l'editor (`MapEditor`) solo quando si apre una mappa: la schermata iniziale arriva prima. Le frecce condividono i calcoli in `features/editor/edgeMemo.ts`, così una mappa grande non si ridisegna tutta a ogni movimento.

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
npm run test:e2e -- --project=desktop --project=telefono   # test end-to-end nel browser (Playwright), computer e telefono
npm run typecheck
npm run build        # build web + PWA in dist/
npm run test:csp     # la build con le intestazioni di produzione di vercel.json (Chromium)
npm run screenshots  # rifà le schermate per «Installa» (public/screenshots/)
npm run og-image     # rifà l'immagine di anteprima per i link condivisi
```

Prima di ogni push: `npm run typecheck && npm test && npm run test:e2e -- --project=desktop --project=telefono`. Dopo il push GitHub Actions rifà gli stessi controlli, più `npm run test:csp` (vedi sotto).

### Controlli automatici (GitHub Actions)

`.github/workflows/ci.yml` (**Controlli**, nella scheda Actions) parte a ogni push e a ogni pull request:

1. **Test**: controllo dei tipi, test unitari, test E2E su computer e telefono, poi `npm run test:csp` (intestazioni di produzione). Se un test E2E o il test CSP fallisce, il rapporto con screenshot e tracce si scarica dagli *Artifacts* (`rapporto-e2e`).
2. **Android** (solo sui push, e solo se i test passano): costruisce l'app.
   - Con le chiavi di firma nei secret del repository produce la **versione firmata**: `app-release.aab` per Google Play e `app-release.apk` da installare.
   - Senza chiavi produce l'APK di debug, come `npm run android:apk`.

La chiave di firma non è mai nel repository (che è pubblico): si crea con `bash scripts/create-release-key.sh` e va nei secret di GitHub. I passi sono in [docs/google-play.md](docs/google-play.md).

### Test end-to-end

In `e2e/` ci sono circa 240 test che usano l'app come farebbe uno studente: su un **computer** (1280×860) e su un **telefono** (Pixel 7), quindi circa 480 esecuzioni (alcuni test valgono solo per il computer o per il telefono). Con il motore di Safari (WebKit) si possono provare anche su **iPad** e **iPhone**, a mano: `--project=ipad --project=iphone` (serve `npx playwright install webkit`; non tutti passano ancora). `npm run test:e2e` senza `--project` li lancia tutti e quattro. Ogni test riparte da un browser vuoto. Controllano:
- creare mappe da ogni modello, salvataggio automatico, cancellazione, mappe di esempio;
- aggiungere, rinominare, annullare ed eliminare concetti; parole di collegamento; rami comprimibili; disposizione a foglio A4 senza sovrapposizioni; trascinamento per riordinare;
- immagini: ricerca delle illustrazioni, Google Immagini, incolla, foto dalla galleria;
- Menu «Altro» sul telefono, 🔊 sul concetto scelto, benvenuto al primo avvio (`welcome.spec.ts`), guscio dell'app mentre si carica e dopo un aggiornamento (`app-shell.spec.ts`), colori dei rami (`colors.spec.ts`);
- file `.mappami`, PNG, PDF su 1, 2 o 4 fogli A4/A3, stampa;
- lettura ad alta voce (ordine e parola evidenziata), ripasso, Indovina con «Lo sapevo» e «Non lo sapevo» (`quiz-selfcheck.spec.ts`), Interrogazione, dettatura con i comandi vocali; gli errori detti anche a voce (`spoken-errors.spec.ts`);
- aspetto (carattere, sfondo, maiuscolo), «Dal libro» senza internet, e la scelta delle parole (a tocchi e con l'evidenziatore) su un testo letto da un finto motore OCR;
- l'informativa privacy, raggiungibile dalla schermata iniziale; le pagine statiche, `robots.txt`, `sitemap.xml`, l'immagine di anteprima e il manifest (`web-presence.spec.ts`); la pagina «Come installare» e il suo collegamento dall'avviso dello schermo intero (`installa.spec.ts`);
- **prestazioni** dell'editor (`editor-perf.spec.ts`): quante volte React ridisegna linee e concetti scegliendo, trascinando, scrivendo il titolo e leggendo ad alta voce, e un'illustrazione da 256 px salvata a 224 px in WebP, trasparente;
- **accessibilità** con axe-core (WCAG 2.2 AA): nessun problema grave nelle schermate principali, nei dialoghi (anche il riepilogo di «Indovina»), nell'informativa privacy, nella presentazione, nei crediti e in «Come installare», col tema chiaro e con quello scuro.

Come funzionano:
- **Rete simulata:** le illustrazioni su jsDelivr e Google rispondono con dati finti (`e2e/fixtures.ts`). I test funzionano offline e danno sempre lo stesso risultato.
- **Voce simulata:** quello che l'app legge finisce in un elenco controllabile; quello che lo studente «dice» si imposta con `say()`.
- **Errori:** un errore JavaScript o in console fa fallire il test.
- **Server:** i test avviano da soli build e server (`vite preview` sulla porta 4173), oppure riusano quello già acceso.
- **Rapporto:** `npm run test:e2e:report` apre il rapporto HTML, con screenshot e tracce dei test falliti.
- **Browser:** Playwright è fissato alla versione 1.56.1, la stessa del Chromium preinstallato nelle sessioni cloud. Su un altro computer, la prima volta: `npx playwright install chromium`.

**Intestazioni di produzione:** i test sopra girano su `vite preview`, che non manda nessuna Content-Security-Policy. `npm run test:csp` (`playwright.csp.config.ts`, `e2e-csp/csp.spec.ts`) costruisce l'app e la serve da `dist/` con `scripts/serve-dist.mjs`, che applica le intestazioni di `vercel.json` (porta 4190, o `CSP_PORT`); cammina dall'elenco al PDF, all'immagine, alle illustrazioni, al service worker e a «Come installare», e fallisce a ogni violazione. La CI lo lancia a ogni push, dopo i test E2E.

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

### Le pose della mascotte

Cinque pose: `mappa`, `indica`, `esulta`, `cerca`, `ops`. Le immagini originali avevano uno sfondo a scacchi disegnato (non una trasparenza vera): sono state scontornate a mano e i bordi controllati sullo sfondo crema e su quello scuro. I master, ritagliati attorno al personaggio, sono in `resources/mascotte/*.png`. L'app usa `src/assets/mascotte/*.webp`, alte 360 px (circa 9 KB l'una), che il service worker tiene in cache (`globPatterns` in `vite.config.ts`): si vedono anche offline. Per rifarle da un master:

```bash
convert resources/mascotte/cerca.png -resize x360 -quality 82 -define webp:alpha-quality=90 src/assets/mascotte/cerca.webp
```

Una posa nuova va aggiunta anche in `src/components/Mascot.tsx`, con la sua larghezza e altezza.

### Immagine di anteprima (Open Graph)

Quando qualcuno condivide un link a MappAmi (WhatsApp, Telegram, email, social), compare `public/og-image.png`: 1200×630, sotto i 250 KB. `npm run og-image` (`scripts/make-og-image.mjs`) la ridisegna con il Chromium di Playwright a partire dalla mascotte e dallo slogan. Se lo slogan cambia, aggiorna anche `og:image:alt` nelle pagine che la usano.

### Schermate per «Installa»

Chrome mostra `public/screenshots/*.webp` nella finestra di installazione (`screenshots` nel manifest, in `vite.config.ts`). `npm run screenshots` (`scripts/make-screenshots.mjs`) le rifà dalla build, due per il telefono e due per lo schermo grande. Non entrano nella cache del service worker: servono solo a chi sta per installare.

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
| `shipping-and-launch`, `security-and-hardening` | addyosmani/agent-skills | Lista di controllo prima di andare in produzione, piano di ritorno indietro, intestazioni di sicurezza, dipendenze, dati dei minori |
| `seo`, `performance`, `core-web-vitals`, `best-practices`, `web-quality-audit` | addyosmani/web-quality-skills | Come si trova l'app sui motori di ricerca, velocità di caricamento (LCP, INP, CLS), buone pratiche web; stessa fonte di `accessibility` |
| `aso`, `competitor-profiling` | coreyhaines31/marketingskills | Scheda di Google Play (titolo, descrizione, parole chiave, screenshot) e confronto con le altre app di mappe concettuali |

`webapp-testing` usa Playwright per Python, che nelle sessioni cloud va reinstallato: `npm run setup:webapp-testing` (Playwright 1.56, compatibile con il Chromium preinstallato).

### Sessioni cloud di Claude Code

`.claude/hooks/session-start.sh` (registrato in `.claude/settings.json`) esegue `npm install` all'avvio di ogni sessione cloud, così typecheck, test e server di sviluppo funzionano subito. Su un computer locale non fa nulla. L'Android SDK e Playwright per Python **non** vengono installati in automatico (sono pesanti): si installano solo quando servono con `npm run setup:android` e `npm run setup:webapp-testing`. Per aggiornare le skill: `npx skills update`.

## Privacy

MappAmi non raccoglie dati: le mappe restano sul dispositivo, non ci sono account, pubblicità o statistiche. L'informativa, scritta in modo semplice anche per i ragazzi, è in `public/privacy.html`: si apre dalla schermata iniziale («🔒 Privacy») ed è online su https://mapp-ami.vercel.app/privacy.html, l'indirizzo da dare a Google Play. Spiega anche le funzioni che usano servizi esterni: jsDelivr (illustrazioni e motore OCR sul web), Google Immagini, dettatura e alcune voci online del browser.

Altre cose che restano sul dispositivo:
- **appunti sugli errori**: se qualcosa si rompe, l'app ne tiene un breve elenco in `mappeora-errors` (senza il contenuto delle mappe), che si può copiare a mano per chi aiuta. Non viene mai inviato;
- **aspetto delle pagine statiche**: presentazione, crediti e «Come installare» leggono le impostazioni del bambino (carattere, sfondo) dal dispositivo, senza mandarle a nessuno.

**Vercel Analytics e Speed Insights devono restare spenti** nel progetto Vercel: accenderli cambierebbe quello che dice l'informativa.

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
