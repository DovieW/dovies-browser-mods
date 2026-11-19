const esbuild = require("esbuild");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function bundle(source) {
  if (!cache.has(source))
    cache.set(
      source,
      esbuild.buildSync({
        stdin: { contents: source, resolveDir: root, loader: "ts" },
        bundle: true,
        write: false,
        format: "iife",
        globalName: "ModsTest",
        platform: "browser",
        target: "chrome127",
      }).outputFiles[0].text,
    );
  return cache.get(source);
}
function moduleCode(module) {
  return (
    bundle(`export * from './${module}';`) +
    "\nObject.assign(globalThis,ModsTest);"
  );
}
const workerSource = `import {createWorker} from './src/composition/worker';
import {createBrowserPort} from './src/platform/chrome/browser';
import {TAB_SETTINGS_DEFAULTS} from './src/features/tabs/domain/settings';
const runtime=createWorker(createBrowserPort(chrome));runtime.register();
export {runtime,TAB_SETTINGS_DEFAULTS};`;
const shim = `\nObject.assign(globalThis,ModsTest.runtime,{TAB_SETTINGS_DEFAULTS:ModsTest.TAB_SETTINGS_DEFAULTS,HISTORY_WALK_KEY:'tabHistoryWalk',HISTORY_KEY:'tabHistory'});
Object.defineProperty(globalThis,'historyQueue',{get:()=>ModsTest.runtime.getHistoryQueue()});
Object.defineProperty(globalThis,'commandQueue',{get:()=>ModsTest.runtime.getCommandQueue()});`;
module.exports = {
  bundle,
  moduleCode,
  workerCode: () => bundle(workerSource) + shim,
};
