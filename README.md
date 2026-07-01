# Strata – File Explorer

A premium, native-feeling file explorer for VS Code. Strata shows your workspace as a
clean, sortable table with **file sizes**, **modified dates**, and **recursive folder
sizes** — the columns the built-in Explorer can't display — styled to look like it
shipped with the editor.

Because it reads file metadata through the extension host, it works transparently over
**Remote-SSH**, Dev Containers, and WSL: connect to a remote machine and browse it with
full size/date columns, as if you were local.

## Why Strata exists

VS Code's built-in Explorer can't show extra columns. The only inline text an extension
can add there is a **2-character badge**, which is too small for a real file size. Strata
sidesteps that limitation with its own view rendered to match your theme exactly, so you
get a true "details" layout without giving up the native feel.

## Features

- 📏 **Sizes for files and folders** — folder sizes are computed recursively in the
  background and stream in as they finish.
- 🗓️ **Modified date** column.
- ↕️ **Sortable columns** — click a header to sort by name, size, or date.
- 🎨 **Native look** — uses VS Code theme variables and Codicons, so it matches light,
  dark, and high-contrast themes automatically.
- 🌐 **Remote-friendly** — works over Remote-SSH / Dev Containers / WSL out of the box.
- 🔒 **Self-contained** — zero runtime dependencies, no network calls, no telemetry;
  fonts and styles are bundled (no CDN).

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `strata.computeFolderSizes` | `true` | Recursively compute folder sizes in the background. |
| `strata.foldersFirst` | `true` | Sort folders before files. |
| `strata.excludeHidden` | `false` | Hide dot-files and dot-folders. |
| `strata.sizeUnits` | `binary` | `binary` (1 KB = 1024 B) or `decimal` (1 KB = 1000 B). |

## Development

```bash
npm install        # also copies Codicon assets into media/
npm run compile    # or: npm run watch
# Press F5 in VS Code to launch an Extension Development Host
```

Package a VSIX and install it locally:

```bash
npm run package
code --install-extension strata-file-explorer-0.1.0.vsix
```

## Credits

File-type icons are from the [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme)
(MIT) by Philipp Kief. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## License

[MIT](LICENSE) © FlashCosmos
