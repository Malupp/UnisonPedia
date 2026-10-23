export class SpawnWorkerController {
  private worker: Worker | null = null;
  private reject: ((error: Error) => void) | null = null;
  private sequence = 0;
  run(payload: any) {
    this.cancel();
    const requestId = ++this.sequence;
    return new Promise<any>((resolve, reject) => {
      this.reject = reject;
      const worker = new Worker(
        new URL("../domain/spawn.worker", import.meta.url),
        { type: "module" },
      );
      this.worker = worker;
      worker.onmessage = ({ data }) => {
        if (data.requestId !== this.sequence) return;
        if (data.type === "result") {
          this.reject = null;
          worker.terminate();
          this.worker = null;
          resolve({ ...data.payload, requestId });
        } else if (data.type === "error") {
          this.reject = null;
          worker.terminate();
          this.worker = null;
          reject(new Error(data.payload));
        }
      };
      worker.onerror = () => {
        if (requestId !== this.sequence) return;
        this.reject = null;
        worker.terminate();
        this.worker = null;
        reject(new Error("La simulazione non è disponibile in questo browser"));
      };
      worker.postMessage({ type: "run", requestId, payload });
    });
  }
  cancel() {
    this.sequence++;
    this.worker?.terminate();
    this.worker = null;
    this.reject?.(new Error("Analisi annullata"));
    this.reject = null;
  }
}
