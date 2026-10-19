# Lancio del sito, senza raccogliere niente

MappAmi esce solo sul web: https://mapp-ami.vercel.app (decisione del 18/10/2026; niente negozi di app per ora). Il principio non cambia con il lancio: **nessuna statistica, nessun tracciamento**, nemmeno sulle pagine di presentazione. Si capisce se funziona parlando con le persone, non contandole.

Prima di diffondere l'indirizzo (testi, QR, locandine) leggere [«L'indirizzo è dove stanno le mappe dei bambini»](rilascio.md#4-lindirizzo-è-dove-stanno-le-mappe-dei-bambini): se si vuole un dominio proprio, si sceglie **prima**, perché un indirizzo stampato non si richiama.

## 1. Una riga

> **MappAmi: mappe concettuali gratuite, senza account, che ti leggono, ti ascoltano e lasciano a te costruire la mappa.**

Variante breve, per un titolo: *MappAmi, le mappe concettuali per DSA che ti leggono e non chiedono un account.* Non scrivere «approvata da», «certificata», «terapia» o «dispositivo medico»: MappAmi è uno strumento di studio.

## 2. Tre testi pronti

Da incollare così o da accorciare. Il nome del mittente e l'indirizzo email (vedi [Come ricevere pareri](#4-come-ricevere-pareri-senza-tracciare-nessuno)) vanno messi dal proprietario: `[…]`.

**Per i genitori** (gruppi, chat di classe, passaparola)

> Se vostro figlio ha un DSA e fa fatica con le mappe concettuali, forse vi può essere utile MappAmi: è gratuita, non vuole account né email e si apre dal browser del tablet, del Chromebook o del computer, senza scaricare niente. Legge la mappa ad alta voce evidenziando la parola, scrive quello che il bambino detta, ha tre caratteri per la dislessia (Lexend, Atkinson, OpenDyslexic) e può leggere il testo da una foto della pagina del libro: la foto resta sul dispositivo. La mappa però la costruisce lui, scegliendo le parole importanti: l'app non la fa al posto suo.
> Le mappe restano sul dispositivo e non viene raccolto nessun dato. Sul tablet va messa nella schermata Home (qui c'è come: https://mapp-ami.vercel.app/installa.html). Provatela e ditemi cosa ne pensate: [email].

**Per gli insegnanti, anche di sostegno**

> Una proposta per la classe: MappAmi (https://mapp-ami.vercel.app) è un'app gratuita per fare mappe concettuali, pensata per studenti con DSA e utile a tutti. Funziona nel browser di tablet, Chromebook e computer della scuola, anche senza internet, e non richiede account né dati degli alunni. Legge la mappa con la parola evidenziata, accetta la dettatura, ha caratteri e sfondi per la dislessia e dal libro di testo (una foto della pagina) fa partire una mappa: lo studente sceglie le parole, quindi la costruisce lui.
> Per la lezione: «Interrogazione» mostra la mappa a schermo intero, un concetto alla volta, anche sulla LIM (si va avanti con le frecce o il telecomando delle presentazioni); «Versione per la verifica» stampa la mappa in bianco e nero. Può servire come strumento compensativo se lo prevede il PDP: la scelta è della scuola. C'è una mappa di esempio (La Rivoluzione francese) e una guida passo passo, «Impara facendo». Come metterla sui dispositivi: https://mapp-ami.vercel.app/installa.html. Mi farebbe piacere un vostro parere: [email].

**Per le associazioni** (sezioni AID, gruppi di genitori DSA)

> Vi presento MappAmi, un'app gratuita per fare mappe concettuali, nata per i ragazzi con DSA: https://mapp-ami.vercel.app. Non ha account, pubblicità né statistiche, e le mappe restano sul dispositivo (gli utenti sono spesso minorenni). Legge con la parola evidenziata, ascolta la dettatura, ha tre caratteri ad alta leggibilità, legge il testo da una foto del libro sul dispositivo e stampa una versione in bianco e nero per la verifica. Non genera le mappe con l'intelligenza artificiale: le costruisce il ragazzo, con le sue parole.
> Funziona nel browser di iPad, Chromebook, tablet Android e computer; la guida all'installazione è su https://mapp-ami.vercel.app/installa.html. Se vi sembra utile, potete segnalarla ai soci o a una serata sugli strumenti compensativi. Accetto volentieri critiche e consigli da chi la usa ogni giorno: [email].

Non servono nomi di concorrenti, né confronti nei testi ([docs/mercato.md](mercato.md) è per noi).

## 3. Dove farla conoscere

Nessuna di queste cose richiede di mettere un codice di tracciamento sul sito.

- **Le persone che già la usano**: gli studenti e i genitori della [prova con studenti](prova-con-studenti.md), i loro insegnanti. Il passaparola conta più di tutto il resto.
- **Associazioni**: le sezioni locali dell'**AID** (Associazione Italiana Dislessia), i gruppi di genitori DSA della propria zona (cercare nei social: sono gruppi chiusi, si entra chiedendo e si presenta l'app solo dove le regole lo permettono).
- **Scuola**: insegnanti di sostegno e referenti DSA/BES della scuola, l'animatore digitale; i **CTS** (Centri Territoriali di Supporto) che consigliano ausili alle scuole.
- **Stampa e siti per la scuola**: *Orizzonte Scuola*, *Studentville* e *Greenme* hanno già raccontato un servizio simile (DSA Study Maps); un comunicato breve con «gratis, senza account, la mappa la fa il bambino» ha un precedente.
- **Da evitare**: pubblicità a pagamento, accorciatori di indirizzi con statistiche (tipo bit.ly), QR «dinamici» che passano da un servizio, pagine con il pulsante «Mi piace» o altri pezzi di social: sono tutti modi di tracciare.

La pagina di presentazione per i motori di ricerca (`public/mappe-concettuali-dsa.html`), `robots.txt` e `sitemap.xml` sono un lavoro a parte: quando ci sono, la sitemap deve elencare anche `/installa.html` e la pagina di presentazione deve rimandarci.

### Un QR per le scuole

Un foglio A4 da appendere vicino alla LIM, in aula insegnanti o alla riunione dei genitori: il titolo, la riga di presentazione, il QR e sotto, **a parole, l'indirizzo** (un bambino lo può anche scrivere).

- Un QR **statico**, che porta diritto all'indirizzo: nessun servizio in mezzo, quindi nessun conteggio e nessuna scadenza. Si crea sul proprio computer, per esempio `npx qrcode -o qr.svg "https://mapp-ami.vercel.app/installa.html"` oppure `qrencode -t SVG -o qr.svg "…"` *(da provare)*. Evitare i generatori online che chiedono un account: spesso fanno QR dinamici.
- Verso quale pagina: `/installa.html` (le istruzioni per ogni dispositivo) per una LIM o un'aula di informatica; `/installa.html#ipad` per un foglio dedicato all'iPad; `/` per chi vuole solo provare.
- Grande almeno 3×3 cm, con bordo bianco intorno, nero su bianco, correzione degli errori «M» o «Q». Provarlo con due telefoni diversi, da un metro, prima di stampare 30 copie.
- Stamparlo in una versione per ogni indirizzo: se l'indirizzo cambia, i fogli vanno rifatti.

## 4. Come ricevere pareri senza tracciare nessuno

Niente moduli dentro l'app (la usano bambini) e niente cookie. Per i pareri **degli adulti** (genitori, insegnanti) basta un indirizzo email: nei testi sopra è `[email]`.

- **Scelta del proprietario, da fare:** un indirizzo email dedicato, `[INDIRIZZO EMAIL: da scegliere]` (lo stesso che manca nell'informativa, `public/privacy.html`). Un link che apre la posta già scritta: `mailto:[INDIRIZZO EMAIL]?subject=MappAmi%3A%20il%20mio%20parere&body=Dispositivo%20e%20browser%3A%0AQuello%20che%20ho%20fatto%3A%0AQuello%20che%20è%20successo%3A%0AQuello%20che%20mi%20aspettavo%3A`.
- **Un modulo**, se un giorno serve: lo sceglie il proprietario, che deve poi dirlo nell'informativa (un modulo ospitato da altri riceve le risposte di chi lo usa). Mai nelle schermate dei bambini, mai con domande sul bambino.
- Cosa chiedere, con parole semplici: *Che dispositivo e che browser usate? Cosa stavate facendo? Cosa è successo e cosa vi aspettavate? Cosa cambiereste?* E: *Non scrivete il nome del bambino.*
- Chi è sviluppatore può anche aprire una issue su GitHub, ma serve un account GitHub: non è per le famiglie.
- Per sapere se le cose funzionano **si fa la prova con gli studenti** ([docs/prova-con-studenti.md](prova-con-studenti.md)), quattro o cinque per volta, dal vivo.

## 5. Che dispositivo e che browser

| Dispositivo | Cosa fare | Dove spiegarlo |
|---|---|---|
| **iPad** e iPhone | **Safari** → Condividi → «Aggiungi alla schermata Home» → aprirla dall'icona. È il solo modo per lo schermo intero vero (il gesto verso il basso in Safari è del sistema e nessun sito può spegnerlo) e per non perdere le mappe (Safari può cancellare i dati di un sito dopo 7 giorni senza visite). Ricordare «Salva tutte le mappe» | `/installa.html#ipad` |
| **Tablet e telefono Android** | **Chrome** → ⋮ → «Installa app» | `/installa.html#android` |
| **Chromebook** | Chrome → «Installa» nella barra dell'indirizzo; se la scuola blocca l'installazione, funziona nel browser | `/installa.html#chromebook` |
| **Computer** | Chrome o Edge → «Installa MappAmi». Su Mac anche Safari → File → «Aggiungi al Dock». Firefox funziona ma **non ha la dettatura** | `/installa.html#computer` |
| **LIM** | Niente da installare: si apre nel browser; «Solo la mappa» e «Interrogazione» | `/installa.html#lim` |

Per tutti: aprirla **una volta con internet** (dopo si apre anche senza); «Dal libro» scarica la prima volta il motore che legge le foto (circa 6 MB, da jsDelivr). Per le scuole: se la rete ha un filtro, `cdn.jsdelivr.net` deve poter passare, altrimenti «Dal libro» non parte e le illustrazioni mostrano solo l'emoji.

## 6. Google Search Console (ricerca su Google, senza codice sul sito)

Dice come Google vede il sito: pagine trovate, ricerche da cui si arriva, errori. Non mette niente nelle pagine e non osserva i visitatori.

1. Entrare con l'account Google del proprietario su https://search.google.com/search-console e scegliere **«Prefisso dell'URL»**, con `https://mapp-ami.vercel.app/` (la proprietà «Dominio» chiede di modificare il DNS, cosa che per un indirizzo `vercel.app` non si può; con un dominio proprio, sì).
2. Verifica: scegliere **«File HTML»**, scaricare il file `google….html` e metterlo in `public/` (finisce alla radice del sito dopo la pubblicazione); poi «Verifica». Non usare il metodo del tag nella pagina né Google Analytics: il file basta.
3. In **Sitemap** inserire `sitemap.xml` e «Invia». Prima aprire `https://mapp-ami.vercel.app/sitemap.xml` e controllare che risponda e che elenchi `/`, la pagina di presentazione e `/installa.html`.
4. Con **«Controllo URL»**: incollare `/`, la pagina di presentazione e `/installa.html`, e «Richiedi l'indicizzazione» per ognuna.
5. Dopo qualche giorno guardare **Pagine** (quali sono nell'indice, quali no e perché) e **Rendimento** (con quali ricerche si arriva). Non aspettarsi nulla subito: l'indicizzazione di un sito nuovo richiede giorni o settimane.
6. Se si cambia dominio, la proprietà nuova va creata di nuovo.

Facoltativo: Bing Webmaster Tools (si può importare la proprietà da Google).

**Controllare che restino spenti**: in Vercel, Analytics e Speed Insights (Project → Analytics / Speed Insights) devono restare *disattivati*.
