import { readFileSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src");
const i18nDir = join(root, "i18n");

// 1. Scan source for all i18n["..."] keys
const grep = execSync(
  `rg -o 'i18n\\["([^"]+)"\\]' --no-filename -r '$1' "${src}"`,
  { encoding: "utf8", cwd: root }
);
const codeKeys = new Set(
  grep.trim().split("\n").filter(Boolean)
);

// 2. Load JSON files
const jsonFiles = readdirSync(i18nDir).filter(f => f.endsWith(".json"));
let allOk = true;

for (const file of jsonFiles) {
  const content = JSON.parse(readFileSync(join(i18nDir, file), "utf8"));
  const jsonKeys = new Set(Object.keys(content));
  const missing = [...codeKeys].filter(k => !jsonKeys.has(k));
  const extra = [...jsonKeys].filter(k => !codeKeys.has(k));

  if (missing.length > 0) {
    console.error(`❌ ${file}: ${missing.length} key(s) used in code but missing from JSON`);
    for (const k of missing) console.error(`   MISSING  ${k}`);
    allOk = false;
  }
  if (extra.length > 0) {
    console.warn(`⚠️  ${file}: ${extra.length} key(s) in JSON but never referenced in code`);
    for (const k of extra.slice(0, 10))
      console.warn(`   UNUSED  ${k}`);
    if (extra.length > 10) console.warn(`   ... and ${extra.length - 10} more`);
  }
}

if (allOk) {
  console.log("✅ All i18n keys in source are present in every JSON file.");
  process.exit(0);
} else {
  process.exit(1);
}
