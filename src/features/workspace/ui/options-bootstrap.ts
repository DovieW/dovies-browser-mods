import { Options } from "./options";
import { mountWorkspace } from "./app";
export function mountOptions() {
  mountWorkspace("options", false, Options);
}
