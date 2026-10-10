# Prova con studenti e verifiche sui dispositivi

I test automatici (`npm test`, `npm run test:e2e`) usano una voce e un microfono simulati, su Chromium. Questa pagina copre quello che solo una persona, un bambino o un dispositivo vero possono dire. Si fa prima di ogni versione importante e prima della pubblicazione su Google Play (issue #14).

## 1. Prova con 4–5 studenti (45 minuti ciascuno)

Bastano 4 o 5 persone per trovare la maggior parte dei problemi di uso. È meglio farne due giri da 5 che uno da 10.

**Chi.** Studenti con DSA tra la 4ª primaria e la 2ª media, con il consenso dei genitori. Se si può, almeno uno che usa già SuperMappe o Algor. Un adulto conduce, un altro prende appunti.

**Come.**
- Si usa il dispositivo dello studente, o uno uguale a quelli della sua scuola. Mai il telefono dello sviluppatore.
- Si dice: «Non stiamo provando te, stiamo provando l'app. Se qualcosa non va, è colpa dell'app.»
- Si chiede di pensare ad alta voce.
- Non si aiuta. Dopo 2 minuti bloccato su un compito, lo si segna come fallito e si passa al successivo.

**Compiti** (dati a voce, uno alla volta, con un brano del suo libro):

| # | Compito | Cosa osservare | Riuscito se |
|---|---|---|---|
| 1 | «Fai una mappa sul brano, partendo da una foto della pagina.» | Trova «Dal libro»? Capisce l'evidenziatore? | Almeno 4 concetti in 5 minuti |
| 2 | «Aggiungi un concetto sotto quello principale e scrivigli un nome.» | Scrive subito nel riquadro aperto? | Fatto senza aiuto |
| 3 | «Scrivi sulla freccia come sono legati.» | Trova il «+» o la linea? | Parola di collegamento messa |
| 4 | «Fatti leggere la mappa.» | Segue la parola illuminata? La voce è comprensibile? | Ascolta fino alla fine |
| 4b | «Muovi la mappa con un dito e ingrandiscila con due, anche partendo da sopra un riquadro.» | Si sposta qualche concetto per sbaglio? Trova 🔒/🔓 quando vuole spostarne uno? | Nessun concetto spostato per sbaglio |
| 5 | «Guarda questa mappa grande sul telefono e dimmi cosa c'è sotto "Le cause".» (esempio della Rivoluzione francese) | Tocca il concetto? Il ramo si avvicina? Capisce da che ramo viene un ramo sotto l'altro (colori delle linee)? | Risponde correttamente |
| 6 | «Ripassa la mappa come se fossi interrogato.» | Trova «Ripassa» → «Interrogazione»? Usa le frecce? | Arriva al quinto concetto |
| 7 | «Stampala per portarla alla verifica.» | Trova «Salva» → PDF → «Versione per la verifica»? | PDF salvato |
| 8 | «Fai in modo di non perdere le tue mappe se cambi telefono.» | Trova «Salva tutte le mappe»? | File salvato |

**Da annotare per ogni compito:** riuscito sì/no, tempo, dove si è bloccato, frasi testuali («non capisco cosa vuol dire…»).

**Alla fine** (scala di faccine 1–5):
- Ti è piaciuto?
- È stato facile?
- La useresti per studiare?
- Cosa cambieresti?

**Cosa farne.** Un compito fallito da 2 studenti su 5 diventa una issue con l'etichetta `da verificare`. Le frasi testuali vanno nella issue.

## 2. Dispositivi veri: voce, dettatura, foto

| Dispositivo | Voce (Leggi) | Parola illuminata | Dettatura | «Dal libro» |
|---|---|---|---|---|
| Android economico (2–3 GB di RAM), app | | | | |
| Android, Chrome (PWA) | | | | |
| iPad, Safari aggiunto alla Home | | | | |
| Chromebook della scuola (Chrome, voce «Google italiano») | | | | |
| PC Windows, Edge | | | | |

Per ogni casella: ✅, ❌ con una nota, oppure «lenta» con i secondi misurati.

**Cosa controllare:**
- **Parola illuminata con la voce «Google italiano» (Chrome, Chromebook).**
  - Quella voce di solito non segnala le parole. Da ottobre 2026 l'app le stima dal tempo.
  - Controllare che l'evidenziazione non vada troppo avanti o indietro alle velocità 0,7× e 1×.
  - Se sbaglia di più di una parola, correggere `wordMs()` in `src/services/speech/web.ts`.
- **Dettatura:**
  - in classe con rumore;
  - senza internet (su Android si usa il riconoscimento sul dispositivo, se c'è l'italiano offline);
  - con un permesso negato.
- **«Dal libro»** con foto vere: un libro sul banco con la luce della finestra, una fotocopia, un quaderno a righe (la scrittura a mano non è supportata: deve dirlo con chiarezza).
- **Prestazioni:**
  - sul telefono economico, la mappa d'esempio (37 concetti) e una da 130 concetti;
  - trascinare, aggiungere, leggere;
  - annotare se qualcosa si ferma per più di mezzo secondo.
- **Copia di sicurezza:**
  - «Salva tutte le mappe» su Android (si apre «Condividi»: salvare su Drive);
  - poi disinstallare, reinstallare e riaprire il file.

## 3. Cosa dicono già le prove automatiche

| Cosa | Dove |
|---|---|
| Robustezza di «Dal libro» sul web: 36 foto (3 pagine × 12 condizioni: storta, prospettiva, ombra, poca luce, sfocata, mossa, JPEG, rilegatura). Errore sui caratteri sotto il 2% in 8 condizioni su 12, 6% sulla rilegatura, 12% con l'ombra; le foto mosse restano difficili (39%) | assessment di ottobre 2026 |
| Tempi con CPU rallentata 4× e 6× (simula un telefono economico), con rete Slow 4G al primo avvio | assessment di ottobre 2026 |
| Voce senza eventi delle parole: l'evidenziazione stimata | `e2e/review.spec.ts` |
