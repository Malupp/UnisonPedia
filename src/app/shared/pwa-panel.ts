import { Component, inject } from '@angular/core';
import { PwaService } from '../core/pwa';

@Component({
  selector: 'app-pwa-panel', standalone: true, styleUrl: './pwa-panel.css',
  template: `<section class="pwa-panel" aria-label="Installazione e uso offline">
    <span class="eyebrow">SEMPRE A PORTATA DI MANO</span>
    <h2>UnisonPedia sul tuo telefono</h2>
    <p>Installa l’app e scarica il catalogo completo: immagini, schede, guida e META anche senza connessione.</p>
    @if (pwa.installed()) { <p class="pwa-success">App aperta in modalità installata.</p> }
    @else if (pwa.installPrompt()) { <button type="button" class="primary" (click)="pwa.install()">Installa UnisonPedia</button> }
    @else { <p class="pwa-instructions">Su Android apri il sito in <strong>Chrome</strong>, tocca <strong>⋮</strong> e scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>.</p> }
    <div class="pwa-download">
      @if (pwa.preparing()) { <p role="status">Prepariamo il download offline…</p> }
      @else if (!pwa.supported()) { <p>Il download offline è disponibile sul sito pubblicato in HTTPS con una versione recente di Chrome Android.</p> }
      @else {
        @if (!pwa.online()) { <p class="pwa-network" role="status">Sei offline. Accesso e sincronizzazione account richiedono una connessione.</p> }
        @if (pwa.localReady()) { <p class="pwa-success" role="status">Catalogo completo pronto offline.</p> }
        @if (pwa.index(); as index) {
          <p class="pwa-size">Download: circa <strong>{{pwa.mb(index.downloadBytes)}} MB</strong> · contenuti: {{pwa.mb(index.unpackedBytes)}} MB, più lo spazio usato dal browser.</p>
          @if (pwa.busy()) {
            <label class="pwa-progress">{{pwa.progress()}}% · {{pwa.done()}} di {{pwa.total()}} file
              <progress [value]="pwa.done()" [max]="pwa.total()" aria-label="Download del catalogo"></progress>
            </label>
            <button type="button" (click)="pwa.cancel()">Metti in pausa</button>
          } @else if (pwa.updateReady()) {
            <p>La nuova versione è pronta. Salva le modifiche in corso prima di ricaricare.</p>
            <button type="button" class="primary" (click)="pwa.applyUpdate()">Usa aggiornamento e ricarica</button>
          } @else if (!pwa.currentReady()) {
            <button type="button" class="primary" [disabled]="!pwa.online()" (click)="pwa.download()">{{pwa.done() > 0 ? 'Riprendi download offline' : pwa.localReady() ? 'Scarica aggiornamento offline' : 'Scarica tutto per usarlo offline'}}</button>
            <p class="pwa-note">Consigliato il Wi-Fi. Puoi mettere in pausa e riprendere il download.</p>
          }
        } @else { <p>Collegati a Internet per preparare il primo download.</p> }
        @if (!pwa.busy() && pwa.online()) { <button type="button" class="pwa-check" (click)="pwa.checkUpdates()">Controlla aggiornamenti</button> }
        @if (pwa.localReady() && !pwa.persistent()) { <p class="pwa-note">Il browser può liberare i dati offline se il telefono ha poco spazio. Conserva un backup dell’inventario.</p> }
      }
    </div>
    @if (pwa.message()) { <p role="status" class="pwa-note">{{pwa.message()}}</p> }
    @if (pwa.error()) { <p role="alert" class="message error">{{pwa.error()}}</p> }
  </section>`,
})
export class PwaPanelComponent { pwa = inject(PwaService); }
