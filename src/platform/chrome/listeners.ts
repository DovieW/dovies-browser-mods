export function listenerScope() {
  const disposers: (() => void)[] = [];
  function listen<T>(
    event: {
      addListener(listener: T): void;
      removeListener(listener: T): void;
    },
    listener: T,
  ): void {
    event.addListener(listener);
    disposers.push(() => {
      event.removeListener(listener);
    });
  }
  function dispose(): void {
    for (const remove of disposers.splice(0).reverse()) remove();
  }
  return { listen, dispose };
}
