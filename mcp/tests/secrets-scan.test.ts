import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SECRET_PATTERNS: RegExp[] = [
  /sk_live_[A-Za-z0-9]+/,
  /sk_test_[A-Za-z0-9]+/,
  /AKIA[0-9A-Z]{16}/,
  /BEGIN [A-Z ]*PRIVATE KEY/,
  /Bearer mirai-[a-z0-9]{8,}/i,
  /MIRAI_API_KEY\s*=\s*["'][^"']{8,}["']/,
  /mirai-dev/,
];

const SCAN_ROOTS = ["src", "scripts", "tests/helpers"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      out.push(...walk(full));
      continue;
    }
    if (/\.(ts|js|json|sh|md)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("credential scan", () => {
  it("finds no embedded keys, tokens, or credential URLs in mcp package files", () => {
    const files = [
      ...SCAN_ROOTS.flatMap((rel) => walk(path.join(ROOT, rel))),
      path.join(ROOT, "manifest.json"),
      path.join(ROOT, "Dockerfile"),
      path.join(ROOT, "README.md"),
      path.join(ROOT, "package.json"),
    ].filter((f) => {
      try {
        statSync(f);
        return true;
      } catch {
        return false;
      }
    });

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of SECRET_PATTERNS) {
        expect(text, `${path.relative(ROOT, file)} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
