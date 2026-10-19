# Rilascio del sito (solo web)

MappAmi esce **solo come sito e PWA**, su https://mapp-ami.vercel.app (decisione del 18/10/2026): niente Google Play, niente App Store per ora. Questa pagina è la lista da seguire a ogni rilascio. Le cose che solo il proprietario può fare sono in [Impostazioni da fare una volta](#impostazioni-da-fare-una-volta).

## 1. Prima del rilascio

Dalla cartella del progetto, in quest'ordine. Tutto deve passare.

```bash
npm run typecheck
npm test
npm run test:e2e -- --project=desktop --project=telefono   # su iPad e iPhone (WebKit), a mano: --project=ipad --project=iphone
npm audit --omit=dev                                       # nessun problema «high» o «critical» nelle dipendenze dell'app
npm run build
npm run test:csp                                           # il sito con le intestazioni di produzione (vedi sotto)
```

- `npm run test:csp` costruisce l'app e la serve da `dist/` con le intestazioni di `vercel.json` (`scripts/serve-dist.mjs`, porta 4190, o `CSP_PORT=…`). Cammina nelle funzioni che una Content-Security-Policy può bloccare (nuova mappa, concetto, PDF, immagine, illustrazioni, service worker, «Come installare») e **fallisce a ogni violazione**. `vite preview`, che usano gli altri test, non manda nessuna intestazione: una funzione bloccata dalla policy passerebbe tutto e si romperebbe solo sul sito vero.
- **La CI lo fa a ogni push**: è il passo «Test CSP (intestazioni di produzione)» del job `test` in `.github/workflows/ci.yml`, dopo i test E2E. Se fallisce, il «Rapporto dei test E2E» contiene anche le sue tracce (`e2e/results/csp`).
- Le schermate per la finestra «Installa» di Chrome (`public/screenshots/*.webp`) si rifanno con `npm run screenshots` (serve un `npx vite preview --port 4182` acceso; `--url` per un altro indirizzo) quando l'aspetto dell'app cambia molto. Guardarle una per una: niente finestra di benvenuto, niente parole tagliate. Ognuna sotto i 150 KB. Sono elencate in `screenshots` del manifest in `vite.config.ts` (nome, misura, etichetta) e lasciate fuori dalla cache del service worker con `globIgnores: ['screenshots/**']`: le scarica solo Chrome quando mostra la finestra «Installa». Se cambiano nome o misura, aggiornare anche quell'elenco; dopo `npm run build`, `dist/sw.js` non deve nominarle.
- Cambiato `vercel.json` (policy, intestazioni)? Rilanciare sempre `npm run test:csp`. Aggiunto un servizio esterno o una funzione che usa internet? Aggiornare anche la policy, la pagina `public/privacy.html` e il test.

## 2. Dopo la pubblicazione: prova di fumo

Subito dopo che Vercel ha messo online la versione (Production, «Ready»). Dieci minuti.

**Le intestazioni** (dal terminale):

```bash
curl -sI https://mapp-ami.vercel.app/ | grep -iE 'content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cache-control'
curl -sI https://mapp-ami.vercel.app/sw.js | grep -iE 'cache-control|content-type'
ASSET=$(curl -s https://mapp-ami.vercel.app/ | grep -o '/assets/[^"]*\.js' | head -1)
curl -sI "https://mapp-ami.vercel.app$ASSET" | grep -iE 'cache-control|content-type'
for p in manifest.webmanifest installa.html privacy.html crediti.html; do curl -s -o /dev/null -w "$p %{http_code}\n" https://mapp-ami.vercel.app/$p; done
```

- La `Content-Security-Policy` è uguale a quella di `vercel.json` (`default-src 'self'; script-src 'self' …`), insieme alle altre quattro intestazioni.
- **`Cache-Control` su `/assets/…`**: i file hanno l'impronta nel nome, quindi può essere lungo. `vercel.json` imposta `public, max-age=31536000, immutable` su `/assets/(.*)`: il curl sul file deve mostrare esattamente questo valore; se mostra `max-age=0` la regola non è stata applicata.
- **`Cache-Control` su `/sw.js` e su `/` (index.html) non deve mai essere lungo né `immutable`**: se il service worker restasse in cache, nessuno vedrebbe più gli aggiornamenti. Deve essere `max-age=0` o `must-revalidate`.
- Le quattro pagine rispondono 200.

**Senza internet:** aprire il sito con internet, aspettare qualche secondo (DevTools → Application → Service Workers: «activated»), poi spegnere la rete (DevTools → Network → Offline, oppure modalità aereo) e ricaricare. La schermata iniziale si apre. Con la rete spenta: nuova mappa, un concetto, «Salva e manda» → PDF. «Dal libro» ha bisogno di internet la prima volta (scarica il motore di lettura, circa 6 MB da jsDelivr): provarlo prima con internet, poi senza.

**Creare, salvare, riaprire una mappa:** «Nuova mappa» → titolo → «Crea» → «Concetto» → scrivere un nome → tornare con «Mappe» → la mappa è nell'elenco → riaprirla: il concetto c'è → ricaricare la pagina (F5): è ancora lì. «Salva tutte le mappe» scarica il file.

**Aggiornamento della PWA, su un telefono e su un iPad aggiunto alla schermata Home** (è il caso che conta di più):

1. *Prima* del rilascio, con la versione vecchia, installare la PWA (telefono: menu ⋮ → «Installa app»; iPad: Condividi → «Aggiungi alla schermata Home») e aprirla almeno una volta con internet. Fare una mappa di prova.
2. Pubblicare la versione nuova.
3. Riaprire l'app dall'icona (o tornarci dopo averla lasciata in secondo piano: il controllo parte da solo a ogni ritorno e ogni ora).
4. Nell'elenco delle mappe deve comparire **«È uscita una nuova versione di MappAmi»** con **«Aggiorna»**. Toccarlo: l'app si ricarica e si vede la novità. Le mappe di prova ci sono ancora.
5. Su iPad: se dopo un minuto l'avviso non compare, chiudere l'app del tutto (scorrerla via dal selettore delle app) e riaprirla: deve comparire. *Da verificare su un iPad vero: è il caso peggiore.*

## 3. Se qualcosa va storto: tornare indietro

**Vercel, Instant Rollback.** Vercel → progetto → Deployments → l'ultima versione buona (in produzione) → ⋯ → **Instant Rollback** → conferma. Non ricostruisce niente: l'indirizzo punta subito alla versione vecchia. Sul piano gratuito (Hobby) si può tornare solo alla versione di produzione *precedente*: *da verificare sul piano usato*. Dopo un rollback Vercel smette di pubblicare da solo i nuovi push in produzione finché non si promuove una versione (Promote) o si annulla il rollback: *controllare l'avviso nel pannello*. Per una correzione definitiva: `git revert <commit>`, push, e lasciar fare a Vercel.

**Cosa vedono le persone** (dal codice: `vite.config.ts` con `registerType: 'autoUpdate'`, `src/main.tsx`, `src/services/pwaUpdate.ts`):

- Il service worker nuovo si installa e prende il posto del vecchio da solo (`skipWaiting` e `clientsClaim`). Il browser lo cerca quando si apre l'app, ogni ora e a ogni ritorno nell'app (`registration.update()` in `main.tsx`); scatta a **qualsiasi differenza** nel file `sw.js`, quindi una versione vecchia rimessa da un rollback arriva come un aggiornamento qualsiasi.
- Il codice **non ricarica la pagina da solo mentre si lavora**, salvo il caso della parte mancante qui sotto: segna «pronta» una nuova versione (`updateReady`). Nell'elenco compare «È uscita una nuova versione di MappAmi» con «Aggiorna»; se la pagina esce dallo schermo mentre si è nell'elenco, senza finestre aperte, si ricarica in silenzio (`reloadIfSafe`). Dentro una mappa non succede niente finché non si torna all'elenco.
- Se una parte caricata più tardi (Riordina, PDF…) appartiene alla versione sostituita e non esiste più, `vite:preloadError` salva la mappa e ricarica la pagina, al massimo una volta al minuto (`sessionStorage`, chiave `mappeora-reloaded`), solo se il bambino ha chiesto proprio quella parte e c'è la rete (`main.tsx`, `src/services/preloadError.ts`). Un'app lasciata aperta per giorni può quindi ricaricarsi, al massimo una volta dopo ogni nuova versione uscita (la mappa è già salvata).
- Chi non apre l'app non cambia versione; chi è senza internet aggiorna alla prima visita con la rete.
- Quindi dopo un rollback i bambini tornano alla versione buona entro un'ora di uso o al prossimo ritorno nell'app, e l'avviso dice «nuova versione» anche se è quella vecchia. I dati non si toccano: un rollback cambia solo il codice.

**Mai cambiare il formato dei dati senza un piano per tornare indietro.** Il rollback rimette codice vecchio davanti a dati che quello nuovo può aver scritto:

- **Database dell'app (Dexie, `src/services/storage/dexie.ts`)**: si chiama `mappeora`, versione 2 (la 2 ha aggiunto la tabella `summaries`). **Non alzare la versione** senza un piano. Aprire un database *più nuovo* di quello che il codice conosce dà `VersionError` nel browser; Dexie 4.4.6 riprova senza numero di versione e lo apre lo stesso (visto nel suo codice), ma il codice vecchio non conosce le tabelle e gli indici nuovi: non è una garanzia. Si aggiunge, non si cambia né si toglie; una versione nuova prima si prepara con una release che sa leggere sia l'una sia l'altra.
- **File `.mappami` (`src/lib/mapFile.ts`)**: `VERSION = 1` (uguale per `mappeora` e `mappeora-archivio`). Un file con una versione *più alta* di quella dell'app **viene rifiutato** con «Questa mappa è stata fatta con una versione più nuova di MappAmi. Aggiorna l'app.». Alzarla fa rifiutare i file nuovi a chi non ha ancora aggiornato, e a tutti dopo un rollback. Meglio campi nuovi *facoltativi* (il lettore è tollerante): la versione si alza solo dopo una release che già la legge, e si comincia a scriverla settimane dopo.
- Non si rinominano mai le chiavi di salvataggio (`mappeora-settings`, `mappeora-welcome`, `mappeora-copia`…), il nome del database e il campo `format` dei file (vedi il README, «Il nome»).

## 4. L'indirizzo è dove stanno le mappe dei bambini

Il browser tiene le mappe (IndexedDB) **per indirizzo**: quelle fatte su `mapp-ami.vercel.app` non esistono su nessun altro indirizzo, e non c'è sincronizzazione (non c'è un server, è una scelta). Se più avanti l'indirizzo cambia (un dominio proprio, per esempio), chi era sul vecchio **perde le mappe** a meno che non faccia prima **«Salva tutte le mappe»** e poi «Apri file» sul nuovo. Un reindirizzamento non basta: il nuovo indirizzo parte vuoto.

Perciò: **decidere il dominio prima di promuovere il sito** (condivisione, QR, newsletter, Search Console), non dopo.

- Se si vuole un dominio proprio, comprarlo e collegarlo a Vercel (Settings → Domains) **ora**, scegliere *un solo* indirizzo come principale e usare solo quello ovunque.
- Dove compare l'indirizzo e va cambiato con il dominio: cercarli tutti con `grep -rn mapp-ami.vercel.app --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .` e cambiarli tutti. Sono, tra gli altri: `index.html` (canonical, `og:url`, `og:image`), le pagine `public/*.html` (in `installa.html` anche il testo visibile, non solo il canonical; `privacy.html` e `crediti.html` compresi), `public/sitemap.xml` e `public/robots.txt`, `src/lib/staticPages.test.ts`, `e2e/installa.spec.ts`, `e2e/web-presence.spec.ts`, `README.md`, `docs/*.md` e la proprietà in Google Search Console. In `src/components/ErrorBoundary.test.tsx` l'indirizzo è solo dentro un messaggio d'errore di prova: non serve cambiarlo. Dopo, `npm test` e `npm run test:e2e -- --project=desktop --project=telefono` devono passare: controllano l'indirizzo nei tag `canonical`, `og:url` e `og:image`, nella sitemap e in `robots.txt`, ma non il testo visibile di `installa.html` e `privacy.html`.
- Se l'indirizzo cambia lo stesso: avvisare le famiglie *prima*, con «Salva tutte le mappe» e «Apri file», e lasciare il vecchio indirizzo online con un avviso.

## Impostazioni da fare una volta

Solo il proprietario ha i permessi.

**GitHub** (Settings → Branches → regola per `main`):
- richiedere una pull request prima di unire;
- richiedere il controllo **Test** (il job «Test» del workflow «Controlli»); prima con una pull request di prova, per vedere che compaia e che, sulle pull request dello stesso repository, sia il controllo del push sullo stesso commit a contare (`ci.yml` salta la prova sul pull request stesso);
- vietare i push forzati e la cancellazione del ramo.

**Vercel** (progetto → Settings): collegare il controllo di GitHub alla produzione, così una versione che non passa i test non va online (Settings → Git, o l'integrazione «Deployment Checks»: *i nomi dei menu cambiano, da verificare*). Tenere la produzione sul ramo `main` e le anteprime per tutti gli altri.

**Versioni:** nessuna è automatica. A ogni rilascio, a mano, un tag con la data nel messaggio (`git tag -a v0.1.0 -m "Primo rilascio, 18 ottobre 2026"` poi `git push origin v0.1.0`) e, se serve, una nota di rilascio su GitHub in italiano semplice. Il tag dice quale codice c'era online e serve da punto di ritorno.
