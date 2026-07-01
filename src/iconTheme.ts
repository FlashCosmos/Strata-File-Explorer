import * as fs from "fs";
import * as path from "path";

interface IconThemeJson {
  iconDefinitions: Record<string, { iconPath?: string }>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  file: string;
  folder: string;
  folderExpanded: string;
}

function has(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Resolves file / folder names to Material Icon Theme SVG filenames using the
 * vendored `material-icons.json` mapping. Returns just the basename (e.g.
 * "typescript.svg"); the webview joins it with the icons base URI.
 *
 * If the mapping can't be loaded, every lookup returns null and the webview
 * falls back to monochrome Codicons.
 */
export class IconTheme {
  private theme?: IconThemeJson;

  constructor(jsonFsPath: string) {
    try {
      this.theme = JSON.parse(fs.readFileSync(jsonFsPath, "utf8"));
    } catch {
      this.theme = undefined;
    }
  }

  public get available(): boolean {
    return this.theme !== undefined;
  }

  private iconFile(key: string | undefined): string | null {
    if (!this.theme || !key) {
      return null;
    }
    const def = this.theme.iconDefinitions[key];
    if (!def || !def.iconPath) {
      return null;
    }
    return path.posix.basename(def.iconPath);
  }

  public fileIcon(name: string): string | null {
    if (!this.theme) {
      return null;
    }
    const lower = name.toLowerCase();
    if (has(this.theme.fileNames, lower)) {
      const f = this.iconFile(this.theme.fileNames[lower]);
      if (f) {
        return f;
      }
    }
    // Longest-first extension match (e.g. "d.ts" before "ts").
    const parts = lower.split(".");
    for (let i = 1; i < parts.length; i++) {
      const ext = parts.slice(i).join(".");
      if (has(this.theme.fileExtensions, ext)) {
        const f = this.iconFile(this.theme.fileExtensions[ext]);
        if (f) {
          return f;
        }
      }
    }
    return this.iconFile(this.theme.file);
  }

  public folderIcon(name: string, expanded: boolean): string | null {
    if (!this.theme) {
      return null;
    }
    const lower = name.toLowerCase();
    const map = expanded
      ? this.theme.folderNamesExpanded
      : this.theme.folderNames;
    if (has(map, lower)) {
      const f = this.iconFile(map[lower]);
      if (f) {
        return f;
      }
    }
    return this.iconFile(expanded ? this.theme.folderExpanded : this.theme.folder);
  }
}
