// Copies the Codicon font + stylesheet out of node_modules into media/ so the
// webview can load them locally (no CDN, works offline and over Remote-SSH).
// Runs on `postinstall` and again before packaging (`vscode:prepublish`).
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "node_modules", "@vscode", "codicons", "dist");
const outDir = path.join(root, "media");
const files = ["codicon.css", "codicon.ttf"];

try {
  if (!fs.existsSync(srcDir)) {
    // Dependencies not installed yet — nothing to copy. Not an error.
    console.log("[copy-codicons] @vscode/codicons not found; skipping.");
    process.exit(0);
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
  }
  console.log("[copy-codicons] Copied codicon assets into media/.");
} catch (err) {
  console.error("[copy-codicons] Failed:", err.message);
  process.exit(1);
}
