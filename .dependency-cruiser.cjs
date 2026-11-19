const { readdirSync, existsSync } = require("node:fs");
const features = existsSync("src/features")
  ? readdirSync("src/features", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : [];
module.exports = {
  forbidden: [
    { name: "no-cycles", severity: "error", from: {}, to: { circular: true } },
    {
      name: "core-is-independent",
      severity: "error",
      from: { path: "^src/core/" },
      to: { path: "^src/(platform|features|ui|composition|entrypoints)/" },
    },
    {
      name: "contracts-are-independent",
      severity: "error",
      from: { path: "^src/contracts/" },
      to: { path: "^src/(core|platform|features|ui|composition|entrypoints)/" },
    },
    {
      name: "platform-has-no-ui-or-features",
      severity: "error",
      from: { path: "^src/platform/" },
      to: { path: "^src/(features|ui|composition|entrypoints)/" },
    },
    {
      name: "shared-ui-has-no-features",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { path: "^src/(features|composition|entrypoints)/" },
    },
    {
      name: "domain-is-pure",
      severity: "error",
      from: { path: "/domain/" },
      to: { path: "/(platform|entrypoints|adapters|ui|composition)/" },
    },
    {
      name: "features-do-not-compose",
      severity: "error",
      from: { path: "^src/features/" },
      to: { path: "^src/(composition|entrypoints)/" },
    },
    ...features.map((name) => ({
      name: `${name}-uses-public-contracts`,
      severity: "error",
      from: { path: `^src/features/${name}/` },
      to: {
        path: "^src/features/",
        pathNot: [
          `^src/features/${name}/`,
          "^src/features/[^/]+/public(?:-ui|-options)?\\.ts$",
        ],
      },
    })),
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
};
