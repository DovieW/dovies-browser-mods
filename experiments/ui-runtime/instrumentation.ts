export interface Sample {
  query: string;
  commitMs: number;
  twoFramesMs?: number;
}
interface Fixture {
  mount(): void;
  unmount(): void;
  samples: Sample[];
  readyMs?: number;
  mountCount: number;
  cleanupCount: number;
}
declare global {
  var ModsUiFixture: Fixture;
}
let pending: { query: string; start: number } | undefined;
export function initialize(mount: () => void, unmount: () => void) {
  globalThis.ModsUiFixture = {
    mount,
    unmount,
    samples: [],
    mountCount: 0,
    cleanupCount: 0,
  };
  document.addEventListener(
    "input",
    (event) => {
      if (
        event.target instanceof HTMLInputElement &&
        event.target.id === "search"
      )
        pending = { query: event.target.value, start: performance.now() };
    },
    true,
  );
}
export function committed(query: string) {
  const root = document.querySelector<HTMLElement>("#screen");
  if (!root) throw Error("Missing screen");
  root.dataset.query = query;
  const measurement = pending;
  if (measurement && measurement.query === query) {
    pending = undefined;
    const sample: Sample = {
      query,
      commitMs: performance.now() - measurement.start,
    };
    globalThis.ModsUiFixture.samples.push(sample);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        sample.twoFramesMs = performance.now() - measurement.start;
      }),
    );
  }
  if (!root.dataset.ready)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        root.dataset.ready = "true";
        globalThis.ModsUiFixture.readyMs ??= performance.now();
      }),
    );
}
