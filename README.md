# UnisonPedia

Una wiki italiana per **Unison League WW**, pensata per aiutare i giocatori a scegliere equipaggiamenti, mostri e talenti e a costruire un personaggio adatto al contenuto che vogliono affrontare.

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

Il fallback SPA permette di aprire direttamente le pagine interne, come `/meta`. La versione attuale della wiki non richiede un database o variabili d'ambiente.

Il repository contiene i sorgenti, gli asset e i JSON utilizzati dalla webapp, la configurazione di build e questo README. Test, documenti di analisi, video, screenshot personali, cache e strumenti locali di acquisizione restano esclusi. `.vercelignore` protegge anche gli upload eseguiti tramite CLI.

## Salvataggio e prossimi sviluppi

Oggi profilo, inventario e build sono salvati **nel browser tramite IndexedDB**, senza account. Prima di cambiare browser o dominio, esporta un backup e importalo nella nuova destinazione: i dati non vengono trasferiti automaticamente.

L'evoluzione prevista comprende account e salvataggio su Supabase, personaggi accessibili da più dispositivi, build PvE contro i diversi elementi e build PvP, consigli personalizzati e obiettivi di miglioramento basati sull'inventario. Queste funzioni cloud sono ancora da implementare.
