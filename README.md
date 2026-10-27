# UnisonPedia

Una wiki italiana per **Unison League**, pensata per aiutare i giocatori a scegliere equipaggiamenti, mostri e talenti e a costruire un personaggio adatto al contenuto che vogliono affrontare.

L'obiettivo è rendere comprensibili le scelte di build: quali proc cercare, come funzionano le loro condizioni, quali alternative usare e dove concentrare le proprie risorse. I nomi ufficiali degli oggetti e delle abilità restano in inglese per facilitarne il riconoscimento nel gioco.

## Cosa offre la wiki

- **Catalogo** di armi, difensivi e mostri UR, con ricerca, filtri, schede dettagliate e confronto degli oggetti. La classe selezionata nel contesto mostra e filtra automaticamente le famiglie di armi in catalogo, META e ricerca per l’importazione; un’opzione permette di includere anche le armi fuori classe.
- **Meta** organizzato in tre colonne: offensivi, difensivi e mostri. I talenti della stessa famiglia sono raggruppati, con le corrispondenze degli elementi e i collegamenti agli oggetti.
- **Guida unica** con 75 argomenti su classi, statistiche, proc e meccaniche, ricerca nei contenuti e atlante Aura e Bubble con 21 immagini. Spiegazioni consultabili in italiano e inglese.
- **Caricamento rapido** con selezione multipla dal catalogo e suggerimenti dalle icone negli screenshot, elaborati nel browser e confermati manualmente.
- **Inventario e build personali**, con copie degli oggetti, livelli, infusioni e configurazioni per PvE e PvP. PvP e GvG sono trattati come un'unica modalità.
- **Consigli sulle build e analisi delle spawn**, basati sui dati disponibili, sulle condizioni degli effetti e sul budget in gemme.
- **Backup dell'inventario** tramite esportazione e importazione JSON.

I talenti delle armi riportano un orientamento PvE/PvP motivato dalle descrizioni delle skill, con condizioni e casi da verificare. La modalità ordina le priorità senza nascondere i proc versatili; un bonus contro le protezioni avversarie resta utilizzabile anche contro boss con le stesse difese.

Le raccomandazioni distinguono le informazioni verificate da quelle ancora da confermare. Le indicazioni di meta dipendono dalle fonti e dalle date analizzate: non costituiscono una classifica aggiornata automaticamente a ogni modifica del gioco.

## Caricare il proprio equipaggiamento

Da **Inventario → Carica equipaggiamento** puoi usare entrambi i metodi nello stesso elenco:

1. **Cerca e aggiungi**: filtra per nome, tipo o elemento, seleziona più oggetti e imposta quantità e livelli.
2. **Da screenshot**: apri un PNG, JPEG o WebP (massimo 12 MB), clicca un’icona o ritaglia un quadrato e scegli tra le proposte del catalogo. Regola il ritaglio se le proposte non corrispondono. Il confronto avviene localmente; lo screenshot non viene caricato su un server.
3. Controlla **La tua selezione**, apri **Livelli e statistiche** e conferma il riepilogo. Ogni oggetto viene aggiunto come nuova copia; l’inventario esistente e le build rimangono conservati. Il limite è 200 copie per aggiunta.

I suggerimenti visivi confrontano le icone: richiedono sempre una scelta manuale e non leggono livelli o potenziali. Artwork simili e screenshot piccoli possono produrre proposte ambigue; la ricerca per nome resta disponibile.

## Dati e fonti

Il catalogo include **6.921 oggetti UR**: 3.129 armi, 2.435 difensivi e 1.357 mostri. Lo snapshot riporta l'aggiornamento dichiarato dalla fonte del 25 agosto 2026, acquisito il 9 ottobre 2026. La selezione Meta include le osservazioni analizzate fino al 22 ottobre 2026 e alternative simili individuate nel catalogo.

Le schede conservano descrizioni, condizioni e riferimenti alle fonti. Effetti non riconosciuti o requisiti non verificati possono impedire una valutazione completa. Le probabilità delle spawn richiedono condizioni documentate; non vengono ricavate dalle percentuali dei proc.

## Avvio locale

Il progetto usa Angular 21 e TypeScript. Richiede Node.js 22.12 o una versione successiva compatibile con Angular 21.

Esegui dalla radice del repository:

```sh
npm ci
npm start
```

Apri <http://127.0.0.1:4200>. Anche `npm run dev` avvia il server di sviluppo. Su Windows PowerShell, se l'esecuzione di `npm.ps1` è bloccata, usa `npm.cmd` al posto di `npm`.

Per generare la versione di produzione:

```sh
npm run build
```

I file del sito vengono generati in `dist/unisonpedia/browser`.

## Pubblicazione su Vercel

Importa questo repository in Vercel e usa queste impostazioni, già definite in `vercel.json`:

| Impostazione | Valore |
| --- | --- |
| Framework | Angular |
| Root Directory | Radice del repository (`.`) |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist/unisonpedia/browser` |

Il fallback SPA permette di aprire direttamente le pagine interne, come `/meta`. Il catalogo resta pubblico. Account e persistenza cloud usano Supabase; le variabili di collegamento sono descritte sotto.

Il repository contiene i sorgenti, gli asset e i JSON utilizzati dalla webapp, la configurazione di build e questo README. Test, documenti di analisi, video, screenshot personali, cache e strumenti locali di acquisizione restano esclusi. `.vercelignore` protegge anche gli upload eseguiti tramite CLI.

## Account, salvataggio e obiettivi

All’apertura trovi una breve presentazione di UnisonPedia e puoi accedere, creare un account oppure scegliere **Entra come ospite**. La wiki si apre dopo questa scelta; chi ha già una sessione valida entra direttamente. La scelta ospite viene ricordata per due ore anche aprendo altre schede dello stesso browser, con salvataggio dell’inventario in IndexedDB. L’uscita da un account riporta alla schermata iniziale. Ogni account ha un personaggio, inventario con copie distinte e più build PvE/PvP. Dalla pagina Account puoi unire esplicitamente l'inventario ospite al tuo account. Cache ospite e cache di ciascun account sono separate.

Le modifiche vengono conservate localmente e inviate a Supabase. Lo stato distingue salvataggio online, modifiche in attesa e conflitti tra dispositivi. Un conflitto conserva la versione locale e permette di esportare entrambe le versioni prima di scegliere. I backup JSON v1 vengono migrati automaticamente alla versione 2, che include gli obiettivi.

La pagina Consigli permette di selezionare una build, seguire obiettivi suggeriti dal META e controllare il progresso. Gli obiettivi coprono acquisizione, potenziali e requisiti elementali documentati. Il progresso è calcolato dall'inventario; rimuovere un oggetto può rendere incompleto un traguardo. Date, fonti e condizioni restano consultabili; la selezione META non si aggiorna automaticamente dal gioco.

## Configurazione Supabase e Vercel

1. Crea o collega un progetto Supabase dedicato. Applica una volta `supabase/schema.sql` nel SQL Editor del progetto: crea la tabella privata per utente, le policy RLS e la funzione atomica di salvataggio con controllo della revisione.
2. In Vercel configura le variabili di **Production**:

| Variabile | Valore |
| --- | --- |
| SUPABASE_URL | URL del progetto Supabase |
| SUPABASE_PUBLISHABLE_KEY | Chiave pubblicabile con prefisso sb_publishable_ |
| APP_URL | Origin HTTPS del sito pubblicato, senza percorsi |

Non inserire mai service_role, chiavi sb_secret o password nelle variabili destinate al browser. La build genera public/app-config.json esclusivamente dai tre valori pubblici previsti. Il file generato resta escluso da Git. Configurare una sola parte dei valori causa un errore di build; senza URL e chiave il sito funziona in modalità locale e l'iscrizione è disabilitata.

3. In Supabase → Authentication → URL Configuration imposta **Site URL** all'origin di APP_URL e aggiungi **Redirect URL** `https://TUO-DOMINIO/auth/callback`. Mantieni attiva la conferma email. Conferma e recupero password usano questo percorso; senza questa configurazione i link email possono tornare al sito predefinito di Supabase.
4. Pubblica su Vercel con la configurazione Angular già presente. Il fallback SPA supporta anche l'apertura diretta di /auth/callback. Preview e Development richiedono variabili e redirect espliciti; evita di collegare automaticamente preview non attendibili ai dati di produzione.

Per lo sviluppo locale copia .env.example in .env.local e compila i tre valori pubblici usando localhost per APP_URL; aggiungi anche quel callback ai redirect consentiti. Gli script npm caricano .env.local con la funzione nativa di Node. Senza configurazione cloud puoi continuare a usare l'inventario locale.

La registrazione richiede la conferma email prevista da Supabase Auth. L'indirizzo viene usato per accesso e recupero password; nessuna password è salvata nelle tabelle applicative.

## Registrazione e reinvio della conferma

Il form controlla email, password di almeno 8 caratteri e corrispondenza della conferma password. Se un account è già confermato, ripetere l’iscrizione può restituire una risposta generica senza inviare un’altra email: usa Accedi o Recupera password. La schermata non verifica pubblicamente l’esistenza di un indirizzo.

Apri **Non hai ricevuto la conferma email?**, inserisci l’indirizzo nel campo email e scegli **Reinvia conferma email**. Il reinvio funziona anche senza compilare la password. Dopo una richiesta accettata viene mostrata un’attesa di 60 secondi; i limiti e gli errori del servizio email sono distinti dagli errori di accesso. Controlla anche lo spam e apri il link nello stesso browser della richiesta, come previsto dal flusso PKCE.

Per l’invio pubblico delle email configura un servizio SMTP personalizzato in Supabase Authentication. Il servizio email predefinito è destinato ai test, limita i destinatari ai membri dell’organizzazione e applica un limite orario ridotto. Le credenziali SMTP vanno salvate nel dashboard Supabase, senza inserirle nel frontend o nelle variabili pubbliche. Mantieni attiva la conferma email. Vedi la [documentazione SMTP](https://supabase.com/docs/guides/auth/auth-smtp) e i [limiti Auth](https://supabase.com/docs/guides/auth/rate-limits).

## Attivare Continua con Google

L’integrazione è pronta: il pulsante compare in Accedi e Crea account quando Google risulta abilitato nelle impostazioni pubbliche del progetto Supabase. Non occorre cambiare il codice o aggiungere segreti a Vercel.

1. In [Google Auth Platform](https://console.cloud.google.com/auth/overview) crea o seleziona il progetto per UnisonPedia. Configura nome, email di assistenza e pubblico; per utenti esterni durante i test aggiungi gli indirizzi autorizzati in Test users. Usa soltanto gli ambiti standard openid, email e profile.
2. In **Clients → Create client**, scegli **Web application** e imposta:

| Campo in Google Cloud | Valore per questo progetto |
| --- | --- |
| Authorized JavaScript origins | https://unisonpedia-warlup.vercel.app |
| Authorized redirect URIs | https://eszcqlmuobgdfdtburde.supabase.co/auth/v1/callback |

3. Copia Client ID e Client Secret in **Supabase → Authentication → Sign In / Providers → Google**, abilita il provider e salva. Le credenziali devono restare in Supabase.
4. In **Supabase → Authentication → URL Configuration**, imposta Site URL a https://unisonpedia-warlup.vercel.app e autorizza il redirect https://unisonpedia-warlup.vercel.app/auth/callback. Il callback Supabase configurato in Google Cloud e quello della webapp hanno ruoli differenti e servono entrambi.
5. Ricarica la webapp e scegli **Continua con Google**. L’SDK usa PKCE e il ritorno viene gestito da /auth/callback. Se l’app Google è ancora in Testing, prova con un indirizzo aggiunto fra i test users; per aprire l’accesso al pubblico completa la configurazione Audience richiesta da Google.

Riferimento: [Sign in with Google — Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google). Gli URL sopra corrispondono alla configurazione pubblica di produzione verificata; aggiornali se cambi dominio o progetto Supabase.
