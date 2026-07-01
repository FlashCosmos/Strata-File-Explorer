# Changelog

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
