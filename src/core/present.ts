export function present<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw Error("Required state is unavailable");
  return value;
}
