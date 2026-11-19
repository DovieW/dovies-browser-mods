import { commands, type CommandId } from "./catalog";
import type { CommandHandler, CommandContext } from "../../contracts/browser";
import { commandError } from "./errors";
export function actionRegistry(handlers: Record<CommandId, CommandHandler>) {
  const actions = Object.fromEntries(
    Object.entries(commands).map(([id, metadata]) => [
      id,
      { id, ...metadata, execute: handlers[id as CommandId] },
    ]),
  );
  function execute(
    id: string,
    context: CommandContext,
    granted?: boolean,
    invokedTab?: chrome.tabs.Tab,
  ): Promise<unknown> {
    const action = Object.hasOwn(actions, id) ? actions[id] : undefined;
    if (!action) throw commandError("unknown_command");
    return action.execute(context, granted, invokedTab);
  }
  return { execute };
}
