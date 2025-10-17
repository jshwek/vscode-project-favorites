# Change Log

All notable changes to the "Project Favorites" extension will be documented in this file.

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
