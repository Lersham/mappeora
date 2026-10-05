# Pubblicare Mappeora su Google Play

Promemoria per la pubblicazione (issue #11, #12, #13). Le risposte ai moduli sono **proposte**: le hanno scritte gli sviluppatori dopo aver
controllato il codice, ma chi pubblica deve rileggerle in Play Console prima di inviarle.

## 1. Prima di iniziare

- [ ] Account sviluppatore Google Play (25 $, una volta sola). Un account **personale** nuovo deve fare un test chiuso con almeno 12 tester per
      14 giorni prima di poter pubblicare in produzione. Un account **organizzazione** (serve il numero D-U-N-S) non ha questo obbligo.
- [ ] Completare il titolare e l'email nell'informativa: `public/privacy.html`, le due parti evidenziate in giallo «da completare».
- [ ] Icone e schermata d'avvio definitive (issue #12).
- [ ] Prove su telefoni reali (issue #14).

## 2. Chiave di firma e build

1. Sul proprio computer (serve Java): `bash scripts/create-release-key.sh ~/mappeora-chiave`.
2. Su GitHub: **Settings → Secrets and variables → Actions → New repository secret**, i quattro secret che lo script elenca:
   `MAPPEORA_KEYSTORE_BASE64`, `MAPPEORA_KEYSTORE_PASSWORD`, `MAPPEORA_KEY_PASSWORD`, `MAPPEORA_KEY_ALIAS`.
3. Da quel momento ogni push fa partire **Controlli** (scheda Actions): se i test passano, il job «Android» produce il file
   `app-release.aab`, firmato, tra gli *Artifacts* dell'esecuzione. Il numero di versione (`versionCode`) è il numero dell'esecuzione, quindi
   cresce sempre come vuole Google Play.
4. In Play Console attivare **Firma dell'app di Google Play** (Play App Signing). La chiave creata al punto 1 diventa la «chiave di caricamento»:
   se si perde, Google la può sostituire.
5. Il primo `.aab` si carica a mano (Test → Test interno). In seguito si potrà automatizzare il caricamento con un account di servizio.

## 3. Informativa privacy

URL da inserire in Play Console (Contenuti dell'app → Norme sulla privacy) e nella scheda dello store:

**https://mappeora.vercel.app/privacy.html**

La stessa pagina è dentro l'app: schermata iniziale → «🔒 Privacy».

## 4. Sicurezza dei dati (Data safety): risposte proposte

| Domanda | Risposta | Perché |
|---|---|---|
| L'app raccoglie o condivide dati utente? | **Sì, solo dati tecnici di ML Kit** | Mappe, immagini e impostazioni restano sul dispositivo (SQLite). Non ci sono account, statistiche o pubblicità. La lettura del testo dalle foto (ML Kit) avviene sul dispositivo, ma [ML Kit invia a Google dati tecnici](https://developers.google.com/ml-kit/android-data-disclosure) e Google chiede di dichiararli (vedi la riga sotto). |
| Dati tecnici di ML Kit | **Raccolti, non condivisi**: «Informazioni e prestazioni dell'app → Diagnostica» e «Dispositivo o altri ID» | Scopo: funzionalità dell'app. Non collegati all'identità, cifrati in transito, obbligatori (non si possono spegnere). Mai la foto né il testo letto. |
| Dettatura | Nessun dato raccolto dall'app | Mappeora usa il riconoscimento vocale di sistema di Android (`SpeechRecognizer`) e preferisce quello senza internet. Quando non c'è, è il servizio di sistema (di solito Google) a ricevere l'audio, non Mappeora. Se Google in revisione chiede diversamente, dichiarare «Audio → Registrazioni vocali», *non conservato, trattato in modo temporaneo, obbligatorio solo per la dettatura*. |
| Illustrazioni da jsDelivr | Nessun dato raccolto | È il download di un'immagine pubblica: non contiene dati dell'utente. Lo stesso vale per il programma di lettura Tesseract, che l'app scarica da jsDelivr solo se ML Kit non funziona sul telefono. |
| Dati cifrati in transito | Sì | Tutte le connessioni sono HTTPS. |
| Si possono cancellare i dati? | Sì | Si cancella la mappa nell'app, oppure si disinstalla l'app. |

## 5. Pubblico di destinazione e Famiglie

- **Fasce d'età**: 6-8, 9-12, 13-15, 16-17 e 18+ (l'app è «anche per DSA, non solo»: ragazzi, genitori, insegnanti). Includendo i bambini si
  applicano le [norme per le famiglie](https://support.google.com/googleplay/android-developer/answer/9893335).
- Requisiti delle norme per le famiglie già rispettati:
  - niente pubblicità, niente acquisti, niente account, niente chat o contenuti di altri utenti;
  - nessun SDK di terze parti per statistiche o pubblicità (ML Kit invia a Google solo dati tecnici di diagnostica, dichiarati sopra);
  - permessi minimi (microfono solo per la dettatura; i permessi per l'impronta digitale aggiunti dal plugin SQLite sono tolti);
  - informativa privacy pubblica.
- **Da valutare**: «Cerca su Google Immagini» apre il browser su Google (con SafeSearch). Le norme per le famiglie chiedono attenzione ai link
  che portano fuori dall'app. Se Google lo segnala in revisione: chiedere conferma a un adulto prima di aprire il browser, oppure nascondere
  il pulsante nella versione Android.

## 6. Classificazione dei contenuti (questionario IARC)

Categoria: **Formazione** (Education). Nessuna violenza, linguaggio volgare, contenuti sessuali, gioco d'azzardo o acquisti. Nessuna
interazione tra utenti e nessuna condivisione della posizione. Si possono condividere file (mappe esportate) solo tramite le app scelte
dall'utente. Risultato atteso: PEGI 3 / Tutti.

## 7. Scheda dello store

- [ ] Nome: «Mappeora – mappe concettuali».
- [ ] Descrizione breve (max 80 caratteri), ad esempio: «Mappe concettuali con la voce, anche per DSA. Dal libro alla mappa con una foto.»
- [ ] Descrizione lunga, icona 512×512, immagine in evidenza 1024×500.
- [ ] Almeno 2 screenshot del telefono (meglio anche del tablet da 7" e 10").
- [ ] Email di contatto dello sviluppatore (sarà pubblica).
