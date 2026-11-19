export interface Command {
  name: string;
  description: string;
  shortcut?: string | undefined;
}
export interface Snapshot {
  version: 1;
  platform: string;
  savedAt: number;
  bindings: Record<string, string>;
}
