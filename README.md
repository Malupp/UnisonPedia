# UnisonPedia

Una wiki italiana per **Unison League**, pensata per aiutare i giocatori a scegliere equipaggiamenti, mostri e talenti e a costruire un personaggio adatto al contenuto che vogliono affrontare.

L'obiettivo è rendere comprensibili le scelte di build: quali proc cercare, come funzionano le loro condizioni, quali alternative usare e dove concentrare le proprie risorse. I nomi ufficiali degli oggetti e delle abilità restano in inglese per facilitarne il riconoscimento nel gioco.

## Cosa offre la wiki

- **Catalogo** di armi, difensivi e mostri UR, con ricerca, filtri, schede dettagliate e confronto degli oggetti.
- **Meta** organizzato in tre colonne: offensivi, difensivi e mostri. I talenti della stessa famiglia sono raggruppati, con le corrispondenze degli elementi e i collegamenti agli oggetti.
- **Guide** su classi, statistiche, proc, condizioni di attivazione e meccaniche, con descrizioni consultabili in italiano e inglese.
- **Inventario e build personali**, con copie degli oggetti, livelli, infusioni e configurazioni per PvE e PvP. PvP e GvG sono trattati come un'unica modalità.
- **Consigli sulle build e analisi delle spawn**, basati sui dati disponibili, sulle condizioni degli effetti e sul budget in gemme.
- **Backup dell'inventario** tramite esportazione e importazione JSON.

Le raccomandazioni distinguono le informazioni verificate da quelle ancora da confermare. Le indicazioni di meta dipendono dalle fonti e dalle date analizzate: non costituiscono una classifica aggiornata automaticamente a ogni modifica del gioco.

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

Puoi usare il sito come ospite con salvataggio IndexedDB oppure iscriverti con email e password. Ogni account ha un personaggio, inventario con copie distinte e più build PvE/PvP. Dalla pagina Account puoi unire esplicitamente l'inventario ospite al tuo account. Cache ospite e cache di ciascun account sono separate.

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
