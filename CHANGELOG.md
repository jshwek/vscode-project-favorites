# Change Log

All notable changes to the "Project Favorites" extension will be documented in this file.

## [1.0.0] - 2026-06-30

First stable release. Focused on a data-loss fix in how favorites are persisted.

### Fixed

- **Critical: favorites no longer get silently wiped.** The storage layer read the
  `.vscode/project-favorites.json` file once at startup and every save overwrote the
  whole file from that in-memory snapshot. A second VS Code window (or any window left
  open while changes were made elsewhere) held a stale snapshot, so its next save —
  even just expanding/collapsing a group — clobbered everything added in the meantime.
  All mutations now reload the file from disk immediately before changing and saving it
  (read-modify-write), so a stale window can no longer overwrite newer data.
- **Atomic writes.** Saves now write to a temp file and rename into place, so a crash
  mid-write can't leave a truncated/corrupt JSON file.
- **Refresh button now reloads from disk** instead of only re-rendering the in-memory
  state, so it reflects changes made by other windows, manual edits, or `git` operations.
- **External-change detection.** A file watcher refreshes the view automatically when
  `.vscode/project-favorites.json` changes on disk.
- **Stale-read hardening.** Export, the add-to-group pickers, group rename's
  duplicate-name check, and reorder (buttons + drag-and-drop) all reload from disk before
  reading, so they act on current data rather than a stale snapshot.

## [0.0.1] - 2025-01-XX

### Initial Release

#### Features

- **Group Management**: Create and organize project groups
- **File Organization**: Add files to groups using context menus
- **Folder Support**: Add entire folders that expand to show contents
- **Subgroups**: Create nested hierarchical structures
- **Drag and Drop**: Reorder items and move between groups
- **Relative Paths**: All paths stored relative to workspace root for portability
- **Workspace Storage**: Share groups via Git (`.vscode/project-favorites.json`)
- **Import/Export**: Share configurations between workspaces
- **Open All Files**: Open all files in a group with configurable limit
- **Keyboard Shortcuts**:
  - `Ctrl+Alt+F` / `Cmd+Alt+F`: Add current file to group
  - `Ctrl+Alt+O` / `Cmd+Alt+O`: Open all files in group
  - `Ctrl+Alt+N` / `Cmd+Alt+N`: Create new group
- **Command Palette**: All commands accessible via Command Palette
- **Rich UI**: File icons, tooltips, and visual feedback
- **Sorting Options**: Date created (default), alphabetical, custom, or recent
- **Multi-select**: Bulk operations support
- **Context Menus**: Available in Explorer, Editor tabs, and Tree view

#### Configuration

- `projectFavorites.storageLocation`: Choose workspace or global storage
- `projectFavorites.sortOrder`: Control how items are sorted
- `projectFavorites.openAllFilesLimit`: Limit files opened at once (1-50)
- `projectFavorites.enableDragAndDrop`: Enable/disable drag and drop
- `projectFavorites.confirmDelete`: Show confirmation for deletions
- `projectFavorites.showFileIcons`: Toggle file type icons
