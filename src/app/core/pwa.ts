import { Injectable, DestroyRef, computed, inject, isDevMode, signal } from '@angular/core';
import { OfflineDownload, OfflineIndex, activeVersion, validateIndex } from '../domain/offline';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaService {
  supported = signal(false);
  preparing = signal(true);
  online = signal(navigator.onLine);
  installed = signal(matchMedia('(display-mode: standalone)').matches);
  installPrompt = signal<InstallPrompt | null>(null);
  index = signal<OfflineIndex | null>(null);
  localVersion = signal<string | null>(null);
  localReady = signal(false);
  candidateReady = signal(false);
  busy = signal(false);
  done = signal(0);
  total = signal(0);
  error = signal('');
  message = signal('');
  persistent = signal(false);
  progress = computed(() => this.total() ? Math.floor(this.done() / this.total() * 100) : 0);
  updateReady = computed(() => this.candidateReady() && !!this.localVersion() && this.index()?.version !== this.localVersion());
  currentReady = computed(() => this.localReady() && this.index()?.version === this.localVersion());
  private engine?: OfflineDownload;
  private controller?: AbortController;

  constructor() {
    const destroy = inject(DestroyRef);
    const prompt = (event: Event) => { event.preventDefault(); this.installPrompt.set(event as InstallPrompt); };
    const installed = () => { this.installed.set(true); this.installPrompt.set(null); };
    const connection = () => { this.online.set(navigator.onLine); if (navigator.onLine && !this.busy()) void this.checkUpdates(); };
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    destroy.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', prompt); window.removeEventListener('appinstalled', installed);
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection); this.controller?.abort();
    });
    void this.initialize();
  }
  private async initialize() {
    if (isDevMode() || !isSecureContext || !('serviceWorker' in navigator) || !('caches' in window) || !('DecompressionStream' in window)) {
      this.preparing.set(false); return;
    }
    try {
      this.engine = new OfflineDownload({ storage: caches, fetchPack: (url, init) => fetch(url, init) });
      await navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' });
      await this.refreshStatus();
      this.supported.set(true);
      this.persistent.set(await navigator.storage?.persisted?.() ?? false);
      // Let the worker validate and cache public config, including on the first visit.
      try {
        await this.waitForWorker();
        await fetch('/app-config.json', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      } catch { /* Keep the previous public config while offline. */ }
    } catch { this.error.set('La preparazione offline non è riuscita. Ricarica la pagina per riprovare.'); }
    finally { this.preparing.set(false); }
  }
  private async waitForWorker() {
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve, reject) => {
      const finish = () => { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', changed); };
      const changed = () => { if (navigator.serviceWorker.controller) { finish(); resolve(); } };
      const timer = setTimeout(() => { finish(); reject(Error('Service worker not ready')); }, 10000);
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      changed();
    });
  }
  async refreshStatus() {
    if (!this.engine) return;
    const version = await activeVersion(caches); this.localVersion.set(version);
    const local = version ? await this.engine.cachedIndex(version) : null;
    this.localReady.set(!!local && await this.engine.isComplete(local));
    let index = local;
    try {
      const response = await fetch('/offline/index.json', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (response.ok) index = validateIndex(await response.json());
    } catch { /* The installed release is sufficient to inspect status offline. */ }
    this.index.set(index);
    this.total.set(index?.totalFiles ?? 0);
    this.candidateReady.set(!!index && await this.engine.isComplete(index));
    if (index) this.done.set(index.totalFiles - (await this.engine.remaining(index)).files);
  }
  async checkUpdates() {
    if (this.busy() || !this.engine) return;
    try { await this.refreshStatus(); }
    catch { this.error.set('Non riesco a verificare i dati conservati. Ricarica e riprova.'); }
  }
  async install() {
    const prompt = this.installPrompt(); if (!prompt) return;
    this.installPrompt.set(null);
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === 'accepted') this.message.set('Completa l’installazione nella finestra di Android.');
    } catch { this.message.set('Puoi installare UnisonPedia dal menu di Chrome.'); }
  }
  private async lock<T>(signal: AbortSignal, action: () => Promise<T>): Promise<T> {
    return navigator.locks ? navigator.locks.request('unison-offline-download', { signal }, action) : action();
  }
  async download() {
    const index = this.index(), engine = this.engine;
    if (!index || !engine || this.busy()) return;
    this.controller = new AbortController(); const signal = this.controller.signal;
    this.busy.set(true); this.error.set(''); this.message.set('Tieni aperta questa pagina. Se il download si interrompe, puoi riprenderlo.');
    try {
      await this.lock(signal, async () => {
        const estimate = await navigator.storage?.estimate?.();
        // Include per-entry overhead; an update keeps the installed release usable.
        const remaining = await engine.remaining(index);
        const largestFile = Math.max(0, ...index.packs.flatMap(pack => pack.files.map(file => file.bytes)));
        const required = remaining.bytes * 1.2 + remaining.files * 1024 + largestFile * 2;
        if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < required && !(await engine.isComplete(index))) throw Error('Lo spazio disponibile potrebbe non bastare. Libera spazio sul telefono e riprova.');
        this.persistent.set(await navigator.storage?.persist?.() ?? false);
        await engine.download(index, signal, state => { this.done.set(state.done); this.total.set(state.total); });
      });
      this.message.set('');
      await this.refreshStatus();
    } catch (error) {
      if (signal.aborted) this.message.set('Download in pausa. I pacchetti verificati restano salvati: puoi riprenderlo.');
      else if (error instanceof DOMException && error.name === 'QuotaExceededError') this.error.set('Spazio esaurito. Libera spazio sul telefono e riprendi il download.');
      else this.error.set(error instanceof Error ? error.message : 'Download non riuscito. Riprova.');
    } finally { this.busy.set(false); this.controller = undefined; }
  }
  cancel() { this.controller?.abort(); }
  async applyUpdate() {
    const index = this.index(); if (!index || !this.engine || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.lock(new AbortController().signal, () => this.engine!.activate(index));
      location.reload();
    } catch { this.error.set('Non è stato possibile attivare questa versione. Riprova il download.'); this.busy.set(false); }
  }
  mb(bytes: number) { return (bytes / 1e6).toLocaleString('it-IT', { maximumFractionDigits: 1 }); }
}
