// Caller supplies the element type from trusted extension markup.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw Error(`Missing UI element: ${id}`);
  return value as T;
}
let lifetime: AbortController | undefined;
const cleanup = new Set<() => void>();
export function onPageClose(dispose: () => void): void {
  pageLifetime();
  cleanup.add(dispose);
}
function pageLifetime(): AbortController {
  if (!lifetime) {
    const controller = new AbortController();
    lifetime = controller;
    window.addEventListener(
      "pagehide",
      () => {
        for (const dispose of cleanup) dispose();
        cleanup.clear();
        controller.abort();
      },
      { once: true },
    );
  }
  return lifetime;
}
export function listen(
  target: EventTarget | null,
  type: string,
  handler: (event: Event) => unknown,
): void {
  if (!target) return;
  target.addEventListener(
    type,
    (event) => {
      try {
        void Promise.resolve(handler(event)).catch(reportFailure);
      } catch {
        reportFailure();
      }
    },
    { signal: pageLifetime().signal },
  );
}
function reportFailure(): void {
  const status =
    document.getElementById("status") ??
    document.getElementById("tabSettingsStatus");
  if (status) {
    status.textContent = "The action could not finish. Please try again.";
    status.hidden = false;
  }
}
