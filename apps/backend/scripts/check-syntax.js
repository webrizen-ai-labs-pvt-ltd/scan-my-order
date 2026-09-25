// Syntax-checks every backend source file (replaces a hand-maintained list of `node --check` calls)
const { readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");

const root = join(__dirname, "..", "src");
const skip = new Set(["generated"]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (skip.has(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : name.endsWith(".js") ? [full] : [];
  });
}

const files = walk(root);
for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
console.log(`Syntax OK: ${files.length} files`);
