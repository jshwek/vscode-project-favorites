<div align="center">

<img src="logo-128.png" alt="Project Favorites Logo" width="128" height="128">

# Project Favorites

### Organize your codebase with smart file groups

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/jshwek.project-favorites?style=for-the-badge&logo=visual-studio-code&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=jshwek.project-favorites)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/jshwek.project-favorites?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=jshwek.project-favorites)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/jshwek.project-favorites?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=jshwek.project-favorites)
[![License](https://img.shields.io/github/license/jshwek/vscode-project-favorites?style=for-the-badge)](LICENSE)

**Stop hunting for files.** Create smart groups that organize your project by features, modules, or any logical structure that makes sense for your workflow.

[Get Started](#-installation) • [Features](#-features) • [Documentation](#-usage) • [Examples](#-use-cases)

</div>

---

## ✨ Why Project Favorites?

Working on a large project? Constantly switching between the same set of files? **Project Favorites** lets you organize your files into logical groups so you can:

- 🎯 **Jump to relevant files instantly** - No more searching through deep folder structures
- 🔄 **Switch contexts quickly** - Open all files for a feature with one click
- 👥 **Share with your team** - Commit groups to Git and everyone gets the same organization
- 🌍 **Work anywhere** - Relative paths work across different machines and operating systems
- 📁 **Stay organized** - Create hierarchical structures with subgroups

Perfect for:

- Full-stack features (frontend + backend + tests + docs)
- Microservices architectures
- Monorepos with multiple packages
- Legacy codebases with scattered files
- Any project where you need to work on related files together

---

## 🚀 Features

### 📂 Smart File Organization

- **Create Groups & Subgroups** - Organize files hierarchically by feature, module, or any structure
- **Add Files & Folders** - Include entire folders that expand to show their contents
- **Drag & Drop** - Reorder items and move files between groups effortlessly
- **Relative Paths** - Works across different machines and operating systems

### ⚡ Productivity Boosters

- **Open All Files** - Open all files in a group with one click (configurable limit)
- **Quick Add** - Right-click any file or use `Ctrl+Alt+F` to add to a group
- **Context Menus** - Available in Explorer, Editor tabs, and Tree view
- **Keyboard Shortcuts** - Speed up your workflow with customizable shortcuts

### 🔧 Flexible & Powerful

- **Workspace Storage** - Share groups with your team via Git (`.vscode/project-favorites.json`)
- **Import/Export** - Share configurations between projects
- **Multiple Sort Options** - Date created, alphabetical, custom, or recent
- **Rich UI** - File icons, tooltips, and visual feedback
- **Multi-select** - Bulk operations support

---

## 📦 Installation

### From VS Code Marketplace

1. Open **Extensions** in VS Code (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for **"Project Favorites"**
3. Click **Install**
4. Restart VS Code if prompted

### From Command Line

```bash
code --install-extension jshwek.project-favorites
```

### From VSIX

Download the latest `.vsix` file from [Releases](https://github.com/jshwek/vscode-project-favorites/releases) and install manually.

---

## 📖 Usage

### Quick Start

1. **Open Project Favorites** - Click the star icon in the Activity Bar
2. **Create a Group** - Click the `+` icon or press `Ctrl+Alt+N`
3. **Add Files** - Right-click any file → "Add to Project Group"

### Adding Files to Groups

<table>
<tr>
<td width="50%">

**From Explorer**

1. Right-click any file
2. Select "Add to Project Group"
3. Choose existing group or create new

</td>
<td width="50%">

**From Editor**

1. Press `Ctrl+Alt+F` / `Cmd+Alt+F`
2. Select group from quick picker
3. File is added instantly

</td>
</tr>
</table>

### Managing Groups

| Action | Method |
|--------|--------|
| **Create Group** | Click `+` icon or `Ctrl+Alt+N` |
| **Create Subgroup** | Right-click group → "Create Subgroup" |
| **Rename Group** | Click edit icon or right-click → "Rename" |
| **Delete Group** | Click trash icon or right-click → "Delete" |
| **Add Folder** | Right-click folder in Explorer → "Add Folder to Group" |
| **Open All Files** | Click files icon or `Ctrl+Alt+O` |
| **Drag & Drop** | Drag files/folders to reorder or move between groups |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+F` / `Cmd+Alt+F` | Add current file to group |
| `Ctrl+Alt+O` / `Cmd+Alt+O` | Open all files in selected group |
| `Ctrl+Alt+N` / `Cmd+Alt+N` | Create new group |

> **Tip:** Customize shortcuts in Keyboard Shortcuts (`Ctrl+K Ctrl+S`)

---

## 🎯 Use Cases

### 🏗️ Full-Stack Feature Development

Organize all files related to a feature in one place:

```filesystem
📁 Sales Feature
  ├── 📁 Frontend
  │   ├── SalesPage.tsx
  │   ├── SalesForm.tsx
  │   └── sales.css
  ├── 📁 Backend
  │   ├── salesRoutes.ts
  │   ├── salesController.ts
  │   └── salesModel.ts
  ├── 📁 Database
  │   └── sales-queries.sql
  └── 📁 Tests
      ├── sales.test.ts
      └── sales-integration.test.ts
```

**One click** opens all files. **One commit** shares with your team.

### 🔧 Microservices Navigation

Working across multiple services?

```filesystem
📁 User Service
  ├── user-service/src/index.ts
  ├── user-service/src/handlers.ts
  └── user-service/tests/

📁 Auth Service
  ├── auth-service/src/index.ts
  ├── auth-service/src/middleware.ts
  └── auth-service/tests/
```

### 🐛 Bug Investigation

Group all files related to a bug:

```filesystem
📁 Bug #123: Login Issue
  ├── components/LoginForm.tsx
  ├── services/authService.ts
  ├── utils/validation.ts
  └── tests/login.test.ts
```

When done, delete the group or keep it for future reference.

### 📚 Documentation & Config

Keep important files accessible:

```filesystem
📁 Project Setup
  ├── package.json
  ├── tsconfig.json
  ├── .env.example
  ├── README.md
  └── docker-compose.yml
```

---

## ⚙️ Configuration

Access settings via `Ctrl+,` / `Cmd+,` and search for "Project Favorites":

### Storage Location

```json
"projectFavorites.storageLocation": "workspace"  // or "global"
```

- **`workspace`** (default): Stored in `.vscode/project-favorites.json`
  - ✅ Share with team via Git
  - ✅ Different groups per project
  - ❌ Not available in other workspaces

- **`global`**: Stored in VS Code's global storage
  - ✅ Available across all projects
  - ❌ Cannot share with team

### Sort Order

```json
"projectFavorites.sortOrder": "dateCreated"  // alphabetical, custom, recent
```

- **`dateCreated`** (default): Files shown in the order they were added
- **`alphabetical`**: Sorted by filename
- **`custom`**: Manual ordering via drag & drop
- **`recent`**: Most recently added first

### Other Settings

```json
{
  "projectFavorites.openAllFilesLimit": 10,        // Max files to open at once (1-50)
  "projectFavorites.confirmDelete": true,          // Show delete confirmation
  "projectFavorites.showFileIcons": true,          // Show file type icons
  "projectFavorites.enableDragAndDrop": true       // Enable drag & drop
}
```

---

## 💡 Tips & Tricks

### 🔗 Share with Your Team

Commit `.vscode/project-favorites.json` to Git:

```bash
git add .vscode/project-favorites.json
git commit -m "Add project favorites for Sales feature"
git push
```

Team members pull and get the same organization!

### 🎨 Color-Code Groups (Coming Soon)

While not yet available, we're working on custom colors for groups.

### 🔍 Quick File Switching

Use VS Code's Quick Open (`Ctrl+P`) in combination with groups for maximum productivity.

### 📦 Export/Import Groups

Transfer your group configurations between projects or share templates with your team.

#### Exporting Groups

1. Click the **Export** icon (📤) in the Project Favorites toolbar
   - Or right-click in the Project Favorites view → **Export Groups**
2. Choose where to save the JSON file (e.g., `my-favorites.json`)
3. The exported file contains all your groups, subgroups, and file references

**What's Exported:**

```json
{
  "version": "1.0.0",
  "groups": [
    {
      "id": "...",
      "name": "My Feature",
      "files": [...],
      "folders": [...],
      "subgroups": [...],
      "description": "...",
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ]
}
```

#### Importing Groups

1. Click the **Import** icon (📥) in the Project Favorites toolbar
   - Or right-click in the Project Favorites view → **Import Groups**
2. Select a previously exported JSON file
3. Choose how to handle the import:
   - **Merge with existing groups**: Keeps your current groups and adds new ones
   - **Replace existing groups**: Removes all current groups and uses imported ones

**Common Use Cases:**

- 📋 **Template Sharing**: Export a standardized project structure for your team
- 🔄 **Project Migration**: Move your favorite groups to a new project
- 💾 **Backup**: Save your configuration before major changes
- 🎯 **Feature Templates**: Create reusable group structures for common features

> **Note:** Imported file paths are relative, so they work best when importing to projects with similar structures.

---

## 🤝 Contributing

We love contributions! Here's how you can help:

- 🐛 [Report bugs](https://github.com/jshwek/vscode-project-favorites/issues)
- 💡 [Suggest features](https://github.com/jshwek/vscode-project-favorites/issues)
- 📝 [Improve documentation](https://github.com/jshwek/vscode-project-favorites/pulls)
- 🔧 [Submit pull requests](https://github.com/jshwek/vscode-project-favorites/pulls)

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

---

## 🗺️ Roadmap

### ✅ Version 0.0.1 (Current)

- [x] Group management with subgroups
- [x] File and folder support
- [x] Drag and drop reordering
- [x] Import/Export functionality
- [x] Keyboard shortcuts
- [x] Context menu integration
- [x] Multiple sort options
- [x] Workspace storage for team sharing

### 🔜 Upcoming Features

- [ ] Custom group colors and icons
- [ ] File search within groups
- [ ] Group templates
- [ ] Smart suggestions based on file relationships
- [ ] Activity bar badges showing file counts
- [ ] Recent groups quick access
- [ ] Group descriptions with markdown support

[Vote on features](https://github.com/jshwek/vscode-project-favorites/issues) or suggest your own!

---

## 🐛 Troubleshooting

### Files Not Opening

**Problem:** Files don't open when clicked

- ✅ Verify files exist at their original locations
- ✅ Check you have read permissions
- ✅ Try "Refresh" in the Project Favorites view

### Groups Not Saving

**Problem:** Changes aren't persisting

- ✅ Check storage location setting
- ✅ Ensure `.vscode` folder isn't read-only
- ✅ Try switching to global storage temporarily

### Performance Issues

**Problem:** Extension feels slow

- ✅ Reduce `openAllFilesLimit` setting
- ✅ Avoid adding very large folders
- ✅ Disable drag & drop if not needed

Still having issues? [Open an issue](https://github.com/jshwek/vscode-project-favorites/issues) and we'll help!

---

## 📄 License

[MIT License](LICENSE) - feel free to use in personal and commercial projects.

---

## 📊 Stats

![GitHub stars](https://img.shields.io/github/stars/jshwek/vscode-project-favorites?style=social)
![GitHub issues](https://img.shields.io/github/issues/jshwek/vscode-project-favorites)
![GitHub pull requests](https://img.shields.io/github/issues-pr/jshwek/vscode-project-favorites)

---

<div align="center">

**[⬆ Back to Top](#project-favorites)**

Made with ☕, Claude Code and TypeScript

</div>
