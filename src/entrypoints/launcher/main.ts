import { mountWorkspace } from "../../features/workspace/public-ui";
import { checkLauncher } from "../../platform/chrome/palette";
void checkLauncher().then((ok) => {
  if (ok) mountWorkspace("launcher");
});
