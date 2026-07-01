# Changelog

## 0.4.1

- First Marketplace release: extension icon, gallery metadata, and refreshed
  documentation. No functional changes.

## 0.4.0

- Lazy folder sizing: a folder's recursive size is computed when you expand it, or
  after briefly hovering it — so heavy trees like `node_modules` never run until you
  ask. Workspace roots are never auto-sized.
- Resizable Size and Modified columns (drag the header dividers); widths persist
  across reloads.

## 0.3.0

- Relative "Modified" column (`5m`, `3h`, `2d`, then `Jun 8` / `Jun 8, 2024`); full
  timestamp still on hover.
- Right-aligned Size/Modified column headers so labels sit over their values.
- Faint indent guides connecting nested items, matching the native tree.

## 0.2.0

- Colorful, type-aware file and folder icons via the bundled Material Icon Theme
  (MIT), replacing the generic monochrome Codicons. Falls back to Codicons if the
  icon mapping can't be loaded.

## 0.1.0

- Initial build.
- Strata sidebar view: workspace shown as a sortable table with Name, Size, and Modified columns.
- Recursive folder sizes computed in the background.
- Native theming via VS Code theme variables + bundled Codicons.
- Works over Remote-SSH / Dev Containers / WSL.
- Settings: `computeFolderSizes`, `foldersFirst`, `excludeHidden`, `sizeUnits`.
