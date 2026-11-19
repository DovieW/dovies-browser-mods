export function checkBundles(metadata, scripts) {
  const errors = [];
  for (const [name, output] of Object.entries(metadata.outputs)) {
    if (!name.endsWith(".js")) continue;
    const inputs = Object.keys(output.inputs);
    if (inputs.some((file) => /node_modules\/(react|react-dom)\//.test(file)))
      errors.push(`${name}: native React was bundled`);
    if (
      /\/(background|offscreen)\.js$/.test(name) &&
      inputs.some((file) => file.includes("@tanstack/redact"))
    )
      errors.push(`${name}: UI renderer in non-UI context`);
    if (inputs.some((file) => /^(tests|experiments)\//.test(file)))
      errors.push(`${name}: test or experiment code was bundled`);
    if (
      name.endsWith("/background.js") &&
      inputs.some(
        (file) => file.includes("/ui/") || file.includes("/offscreen/"),
      )
    )
      errors.push(`${name}: worker depends on a DOM/UI context`);
    if (
      /ModsTest|ModsUiFixture|globalThis\.runtime|importScripts\(/.test(
        scripts[name] ?? "",
      )
    )
      errors.push(`${name}: legacy or test runtime bridge was emitted`);
  }
  return errors;
}
