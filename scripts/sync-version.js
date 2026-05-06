import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const paths = {
  package: resolve("package.json"),
  appVersion: resolve("src/version.ts"),
};

const pkg = JSON.parse(readFileSync(paths.package, "utf-8"));
const newVersion = pkg.version;

console.log(`Syncing version to ${newVersion}...`);

writeFileSync(paths.appVersion, `export const APP_VERSION = "${newVersion}";\n`);
console.log("Updated src/version.ts");
