import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { Entry } from "../domain/contracts";
import {
  CropRect,
  rankVisualMatches,
  squareCrop,
  VisualSignature,
} from "../domain/visual-match";

interface VisualIndex {
  version: number;
  size: number;
  inset: number;
  items: VisualSignature[];
}

@Component({
  selector: "app-screenshot-import",
  standalone: true,
  styleUrl: "./screenshot-import.css",
  template: `<h2>Parti da uno screenshot</h2>
    <p>
      Scegli un’immagine dell’equipaggiamento, poi clicca un’icona o trascina un
      quadrato intorno ad essa. Confronta i suggerimenti e aggiungi l’oggetto
      corretto alla selezione.
    </p>
    <label class="screenshot-file"
      >Screenshot<input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        [disabled]="disabled() || loading()"
        (change)="load($event)"
    /></label>
    <p class="muted">
      L’immagine viene elaborata solo nel browser. Livelli, infusioni e
      potenziali vanno impostati nella selezione.
    </p>
    @if (error()) {
      <p class="message error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p role="status">Apertura immagine…</p>
    }
    @if (dimensions(); as dim) {
      <p id="screenshot-help">
        Inquadra una sola icona intera, senza il testo sottostante. Regola il
        quadrato con i campi o con le frecce della tastiera; premi Invio per
        cercare.
      </p>
      <div class="screenshot-stage">
        <canvas
          #screenshot
          [width]="dim.width"
          [height]="dim.height"
          tabindex="0"
          role="img"
          aria-label="Screenshot: seleziona l’icona da cercare"
          aria-describedby="screenshot-help"
          (pointerdown)="start($event)"
          (pointermove)="move($event)"
          (pointerup)="end($event)"
          (pointercancel)="cancelDrag()"
          (keydown)="keyboard($event)"
        ></canvas>
      </div>
      @if (crop(); as box) {
        <div class="crop-controls">
          <label
            >X<input
              type="number"
              min="0"
              [max]="dim.width - box.width"
              [value]="rounded(box.x)"
              [disabled]="disabled()"
              (change)="adjust('x', $event)" /></label
          ><label
            >Y<input
              type="number"
              min="0"
              [max]="dim.height - box.height"
              [value]="rounded(box.y)"
              [disabled]="disabled()"
              (change)="adjust('y', $event)" /></label
          ><label
            >Lato (px)<input
              type="number"
              min="8"
              [max]="minimum(dim.width, dim.height)"
              [value]="rounded(box.width)"
              [disabled]="disabled()"
              (change)="adjust('size', $event)" /></label
          ><button [disabled]="disabled() || matching()" (click)="analyze()">
            {{ matching() ? "Confronto…" : "Trova corrispondenze" }}
          </button>
        </div>
      }
    }
    @if (preview()) {
      <div class="crop-preview">
        <img
          [src]="preview()"
          alt="Ritaglio selezionato"
          width="80"
          height="80"
        />
        <p>
          Confronta le proposte con il ritaglio. Artwork e varianti possono
          essere simili: scegli il nome e la versione corretti.
        </p>
      </div>
    }
    @if (added()) {
      <p role="status" class="message">
        Oggetto aggiunto alla selezione. Puoi scegliere un’altra icona oppure
        caricare un altro screenshot.
      </p>
    }
    <div class="screenshot-candidates">
      @for (item of candidates(); track item.id) {
        <button
          class="screenshot-candidate"
          [disabled]="disabled() || matching() || added() === item.id"
          (click)="choose(item.id)"
        >
          <img
            [src]="item.iconPath || 'assets/fallback.svg'"
            alt=""
            width="56"
            height="56"
          /><span
            ><strong>{{ item.name }}</strong
            ><small
              >{{ item.gearType }} · {{ item.element }} · Cost
              {{ item.cost }}</small
            ><small class="candidate-action">{{
              added() === item.id ? "Aggiunto ✓" : "Aggiungi alla selezione +"
            }}</small></span
          >
        </button>
      }
    </div>
    @if (preview() && !candidates().length && !matching()) {
      <p>
        Nessuna proposta disponibile. Prova un ritaglio più preciso oppure cerca
        l’oggetto per nome.
      </p>
    }`,
})
export class ScreenshotImportComponent implements OnDestroy {
  entries = input.required<Entry[]>();
  disabled = input(false);
  pick = output<string>();
  dimensions = signal<{ width: number; height: number } | null>(null);
  crop = signal<CropRect | null>(null);
  preview = signal("");
  matches = signal<string[]>([]);
  error = signal("");
  loading = signal(false);
  matching = signal(false);
  added = signal("");
  canvas = viewChild<ElementRef<HTMLCanvasElement>>("screenshot");
  entryMap = computed(
    () => new Map(this.entries().map((entry) => [entry.id, entry])),
  );
  candidates = computed(() =>
    this.matches()
      .map((id) => this.entryMap().get(id))
      .filter((entry): entry is Entry => !!entry),
  );
  rounded = Math.round;
  minimum = Math.min;
  private bitmap: ImageBitmap | null = null;
  private index: Promise<VisualIndex> | null = null;
  private drag: { x: number; y: number; pointer: number } | null = null;
  private sequence = 0;
  private loadSequence = 0;

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      this.dimensions();
      const crop = this.crop();
      if (canvas) untracked(() => this.draw(canvas, crop));
    });
  }
  ngOnDestroy() {
    this.sequence++;
    this.loadSequence++;
    this.bitmap?.close();
  }
  async load(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    input.value = "";
    if (!file || this.disabled()) return;
    const request = ++this.loadSequence;
    this.error.set("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      this.error.set("Scegli un’immagine PNG, JPEG o WebP.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      this.error.set(
        "L’immagine supera 12 MB. Ritagliala o riducila prima di riprovare.",
      );
      return;
    }
    this.loading.set(true);
    try {
      const bitmap = await createImageBitmap(file);
      if (request !== this.loadSequence) {
        bitmap.close();
        return;
      }
      if (
        bitmap.width * bitmap.height > 32_000_000 ||
        Math.min(bitmap.width, bitmap.height) < 8
      ) {
        bitmap.close();
        throw Error("Usa un’immagine tra 8 pixel per lato e 32 megapixel.");
      }
      this.sequence++;
      this.bitmap?.close();
      this.bitmap = bitmap;
      this.dimensions.set({ width: bitmap.width, height: bitmap.height });
      this.clearResults();
      this.crop.set(
        squareCrop(
          bitmap.width / 2,
          bitmap.height / 2,
          Math.max(8, Math.round(bitmap.width / 6)),
          bitmap.width,
          bitmap.height,
        ),
      );
    } catch (error) {
      if (request === this.loadSequence)
        this.error.set(
          error instanceof Error
            ? error.message
            : "Impossibile aprire questa immagine.",
        );
    } finally {
      if (request === this.loadSequence) this.loading.set(false);
    }
  }
  private draw(canvas: HTMLCanvasElement, crop: CropRect | null) {
    const ctx = canvas.getContext("2d");
    if (!ctx || !this.bitmap) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.bitmap, 0, 0);
    if (crop) {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        this.bitmap,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
      );
      ctx.strokeStyle = "#55e8f1";
      ctx.lineWidth = Math.max(2, canvas.width / 350);
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
    }
  }
  private point(event: PointerEvent) {
    const canvas = this.canvas()!.nativeElement,
      rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          canvas.width,
          ((event.clientX - rect.left) * canvas.width) / rect.width,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          canvas.height,
          ((event.clientY - rect.top) * canvas.height) / rect.height,
        ),
      ),
    };
  }
  start(event: PointerEvent) {
    if (this.disabled() || event.button !== 0) return;
    event.preventDefault();
    const point = this.point(event);
    this.drag = { ...point, pointer: event.pointerId };
    this.canvas()!.nativeElement.setPointerCapture(event.pointerId);
  }
  move(event: PointerEvent) {
    if (!this.drag || this.drag.pointer !== event.pointerId || this.disabled())
      return;
    const point = this.point(event),
      side = Math.max(
        Math.abs(point.x - this.drag.x),
        Math.abs(point.y - this.drag.y),
      );
    if (side < 8) return;
    const dim = this.dimensions()!;
    this.setCrop(
      squareCrop(
        Math.min(point.x, this.drag.x) + side / 2,
        Math.min(point.y, this.drag.y) + side / 2,
        side,
        dim.width,
        dim.height,
      ),
    );
  }
  end(event: PointerEvent) {
    if (!this.drag || this.drag.pointer !== event.pointerId) return;
    const start = this.drag,
      point = this.point(event);
    this.cancelDrag();
    if (this.disabled()) return;
    const dim = this.dimensions()!;
    if (Math.hypot(point.x - start.x, point.y - start.y) < 8)
      this.setCrop(
        squareCrop(
          point.x,
          point.y,
          this.crop()?.width || dim.width / 6,
          dim.width,
          dim.height,
        ),
      );
    void this.analyze();
  }
  cancelDrag() {
    const pointer = this.drag?.pointer;
    this.drag = null;
    const canvas = this.canvas()?.nativeElement;
    if (pointer !== undefined && canvas?.hasPointerCapture(pointer))
      canvas.releasePointerCapture(pointer);
  }
  adjust(field: "x" | "y" | "size", event: Event) {
    const value = Number((event.target as HTMLInputElement).value),
      crop = this.crop(),
      dim = this.dimensions();
    if (this.disabled() || !crop || !dim || !Number.isFinite(value)) return;
    const side = field === "size" ? Math.max(8, value) : crop.width;
    this.setCrop(
      squareCrop(
        field === "x" ? value + side / 2 : crop.x + side / 2,
        field === "y" ? value + side / 2 : crop.y + side / 2,
        side,
        dim.width,
        dim.height,
      ),
    );
  }
  keyboard(event: KeyboardEvent) {
    if (this.disabled()) return;
    const crop = this.crop(),
      dim = this.dimensions();
    if (!crop || !dim) return;
    if (event.key === "Enter") {
      event.preventDefault();
      void this.analyze();
      return;
    }
    const delta = event.shiftKey ? 20 : 5;
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-delta, 0],
      ArrowRight: [delta, 0],
      ArrowUp: [0, -delta],
      ArrowDown: [0, delta],
    };
    const offset = offsets[event.key];
    if (offset) {
      event.preventDefault();
      this.setCrop(
        squareCrop(
          crop.x + crop.width / 2 + offset[0],
          crop.y + crop.height / 2 + offset[1],
          crop.width,
          dim.width,
          dim.height,
        ),
      );
    }
  }
  private clearResults() {
    this.sequence++;
    this.matches.set([]);
    this.preview.set("");
    this.added.set("");
    this.matching.set(false);
  }
  private setCrop(crop: CropRect) {
    this.clearResults();
    this.crop.set(crop);
  }
  async analyze() {
    const bitmap = this.bitmap,
      box = this.crop();
    if (!bitmap || !box || this.disabled() || this.matching()) return;
    const request = ++this.sequence;
    this.error.set("");
    this.added.set("");
    this.matching.set(true);
    try {
      if (!this.index)
        this.index = fetch("/data/catalogue/visual-index.json")
          .then(async (response) => {
            if (!response.ok) throw Error();
            const index = (await response.json()) as VisualIndex;
            if (
              index.version !== 1 ||
              index.size !== 8 ||
              index.inset !== 0.12 ||
              !Array.isArray(index.items)
            )
              throw Error();
            return index;
          })
          .catch(() => {
            this.index = null;
            throw Error(
              "Confronto immagini non disponibile. Riprova o usa la ricerca per nome.",
            );
          });
      // Snapshot the crop before awaiting the index: replacing an image closes its old bitmap.
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropCanvas.height = Math.max(8, Math.round(box.width));
      const ctx = cropCanvas.getContext("2d")!;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
      ctx.drawImage(
        bitmap,
        box.x,
        box.y,
        box.width,
        box.height,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height,
      );
      const preview = cropCanvas.toDataURL("image/png");
      const inner = document.createElement("canvas"),
        low = Math.round(cropCanvas.width * 0.12),
        high = Math.round(cropCanvas.width * 0.88);
      inner.width = inner.height = Math.max(1, high - low);
      inner
        .getContext("2d")!
        .drawImage(
          cropCanvas,
          low,
          low,
          inner.width,
          inner.height,
          0,
          0,
          inner.width,
          inner.height,
        );
      const sample = document.createElement("canvas");
      sample.width = sample.height = 8;
      const sampleCtx = sample.getContext("2d")!;
      sampleCtx.drawImage(inner, 0, 0, 8, 8);
      const rgba = sampleCtx.getImageData(0, 0, 8, 8).data,
        rgb = new Uint8Array(192);
      for (let i = 0; i < 64; i++)
        rgb.set(rgba.subarray(i * 4, i * 4 + 3), i * 3);
      const index = await this.index;
      if (request !== this.sequence) return;
      this.preview.set(preview);
      this.matches.set(
        rankVisualMatches(
          rgb,
          index.items.filter((item) => this.entryMap().has(item.id)),
          6,
        ).map((match) => match.id),
      );
    } catch (error) {
      if (request === this.sequence)
        this.error.set(
          error instanceof Error
            ? error.message
            : "Impossibile confrontare il ritaglio.",
        );
    } finally {
      if (request === this.sequence) this.matching.set(false);
    }
  }
  choose(id: string) {
    if (
      this.disabled() ||
      this.matching() ||
      this.added() === id ||
      !this.candidates().some((item) => item.id === id)
    )
      return;
    this.pick.emit(id);
    this.added.set(id);
  }
}
