import * as fs from "fs";
import * as path from "path";

export interface Entry {
  /** URI string (uri.toString()) — stable id used by the webview. */
  id: string;
  name: string;
  isDir: boolean;
  /** Bytes for files; null for directories until a size has been computed. */
  size: number | null;
  /** Last-modified time in epoch milliseconds (0 if unknown). */
  mtime: number;
}

/**
 * Lists the immediate children of a directory with size + mtime metadata.
 * Unreadable entries (permission denied, broken symlinks) are skipped rather
 * than aborting the whole listing.
 */
export async function listDirectory(
  dirFsPath: string,
  uriFor: (name: string) => string,
  excludeHidden: boolean,
): Promise<Entry[]> {
  const dirents = await fs.promises.readdir(dirFsPath, { withFileTypes: true });
  const entries: Entry[] = [];
  await Promise.all(
    dirents.map(async (d) => {
      if (excludeHidden && d.name.startsWith(".")) {
        return;
      }
      const full = path.join(dirFsPath, d.name);
      try {
        const st = await fs.promises.stat(full);
        const isDir = st.isDirectory();
        entries.push({
          id: uriFor(d.name),
          name: d.name,
          isDir,
          size: isDir ? null : st.size,
          mtime: st.mtimeMs,
        });
      } catch {
        // Unreadable entry — skip it.
      }
    }),
  );
  return entries;
}

/**
 * Recursively sums the size of every regular file under `dirFsPath`.
 * Symlinks are not followed (avoids cycles and double-counting). Errors on
 * individual entries are ignored. `isCancelled` lets callers abort stale work.
 */
export async function directorySize(
  dirFsPath: string,
  isCancelled: () => boolean,
): Promise<number> {
  let total = 0;
  let dirents: fs.Dirent[];
  try {
    dirents = await fs.promises.readdir(dirFsPath, { withFileTypes: true });
  } catch {
    return total;
  }
  for (const d of dirents) {
    if (isCancelled()) {
      return total;
    }
    if (d.isSymbolicLink()) {
      continue;
    }
    const full = path.join(dirFsPath, d.name);
    if (d.isDirectory()) {
      total += await directorySize(full, isCancelled);
    } else if (d.isFile()) {
      try {
        const st = await fs.promises.stat(full);
        total += st.size;
      } catch {
        // skip
      }
    }
  }
  return total;
}
