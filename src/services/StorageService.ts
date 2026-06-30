import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectGroup, FileItem, FolderItem, FavoritesData, StorageLocation } from '../models/types';

export class StorageService {
    private static readonly STORAGE_KEY = 'projectFavorites.data';
    private static readonly STORAGE_FILE = 'project-favorites.json';
    private data: FavoritesData;

    constructor(private context: vscode.ExtensionContext) {
        // Start from an empty default, then pull the authoritative copy off disk.
        this.data = { version: '1.0.0', groups: [] };
        this.reloadFromDisk();
    }

    private getStorageLocation(): StorageLocation {
        return vscode.workspace.getConfiguration('projectFavorites').get('storageLocation', StorageLocation.Workspace);
    }

    private getStorageFilePath(): string | undefined {
        const storageLocation = this.getStorageLocation();

        if (storageLocation === StorageLocation.Workspace) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return undefined;
            }
            const vscodePath = path.join(workspaceFolder.uri.fsPath, '.vscode');

            // Ensure .vscode directory exists
            if (!fs.existsSync(vscodePath)) {
                fs.mkdirSync(vscodePath, { recursive: true });
            }

            return path.join(vscodePath, StorageService.STORAGE_FILE);
        }

        return undefined; // Will use global storage
    }

    /**
     * Re-read the authoritative copy from disk (workspace mode) or global state
     * into `this.data`. This is the core of the read-modify-write discipline:
     * every mutation calls this FIRST so it operates on the freshest state, which
     * prevents a stale in-memory snapshot (e.g. from a second VS Code window left
     * open) from clobbering changes another window already wrote.
     *
     * On any read/parse failure the existing in-memory copy is kept intact — we
     * never wipe good in-memory data because of a transient read error.
     */
    private reloadFromDisk(): void {
        const storageLocation = this.getStorageLocation();

        if (storageLocation === StorageLocation.Workspace) {
            const filePath = this.getStorageFilePath();
            if (filePath && fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const parsed = JSON.parse(content) as FavoritesData;
                    // Only adopt the disk copy if it is structurally valid.
                    if (parsed && Array.isArray(parsed.groups)) {
                        this.data = parsed;
                    }
                } catch (error) {
                    console.error('Error reloading workspace storage (keeping in-memory copy):', error);
                }
            }
        } else {
            const data = this.context.globalState.get<FavoritesData>(StorageService.STORAGE_KEY);
            if (data && Array.isArray(data.groups)) {
                this.data = data;
            }
        }
    }

    /**
     * Public hook for the file watcher: pull external changes (made by another
     * window) into memory so the tree view can re-render the current state.
     */
    refreshFromDisk(): void {
        this.reloadFromDisk();
    }

    /**
     * Create a watcher for the on-disk storage file so external edits (another
     * window, manual edit, git checkout) can refresh this instance. Returns
     * undefined in global-storage mode (no file to watch).
     */
    createStorageWatcher(): vscode.FileSystemWatcher | undefined {
        if (this.getStorageLocation() !== StorageLocation.Workspace) {
            return undefined;
        }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return undefined;
        }
        const pattern = new vscode.RelativePattern(workspaceFolder, '.vscode/' + StorageService.STORAGE_FILE);
        return vscode.workspace.createFileSystemWatcher(pattern);
    }

    private saveData(): void {
        const storageLocation = this.getStorageLocation();

        if (storageLocation === StorageLocation.Workspace) {
            const filePath = this.getStorageFilePath();
            if (filePath) {
                try {
                    // Atomic write: write to a temp file, then rename over the
                    // target so a crash mid-write can't leave a truncated/corrupt
                    // JSON file. rename is atomic on the same filesystem.
                    //
                    // The temp name is unique per process (pid) so that when the
                    // same project is open in multiple windows, two windows saving
                    // at once (e.g. each cleaning up after a deleted favorited
                    // file) can never write the same temp file and publish a
                    // corrupt mix. Each window owns its own scratch file.
                    const tmpPath = `${filePath}.${process.pid}.tmp`;
                    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
                    fs.renameSync(tmpPath, filePath);
                } catch (error) {
                    console.error('Error saving workspace storage:', error);
                    vscode.window.showErrorMessage('Failed to save project favorites to workspace');
                }
            }
        } else {
            // Save to global storage
            this.context.globalState.update(StorageService.STORAGE_KEY, this.data);
        }
    }

    // Group management methods
    getAllGroups(): ProjectGroup[] {
        return this.data.groups;
    }

    // The group most recently added to. Used to add new items without prompting
    // for a group. Persisted in the storage file so it syncs across machines.
    getLastUsedGroupId(): string | undefined {
        return this.data.lastUsedGroupId;
    }


    createGroup(name: string, description?: string, parentId?: string): ProjectGroup {
        this.reloadFromDisk();
        const newGroup: ProjectGroup = {
            id: uuidv4(),
            name,
            description,
            files: [],
            folders: [],
            subgroups: [],
            parentId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isExpanded: true
        };

        if (parentId) {
            // If it's a subgroup, add it to the parent's subgroups
            const parent = this.findGroupRecursive(parentId);
            if (parent) {
                if (!parent.subgroups) {
                    parent.subgroups = [];
                }
                parent.subgroups.push(newGroup);
                parent.updatedAt = Date.now();
            }
        } else {
            // Top-level group
            this.data.groups.push(newGroup);
        }

        this.saveData();
        return newGroup;
    }

    // Helper to find a group recursively (including subgroups)
    private findGroupRecursive(groupId: string, groups?: ProjectGroup[]): ProjectGroup | undefined {
        const searchGroups = groups || this.data.groups;

        for (const group of searchGroups) {
            if (group.id === groupId) {
                return group;
            }
            if (group.subgroups && group.subgroups.length > 0) {
                const found = this.findGroupRecursive(groupId, group.subgroups);
                if (found) {
                    return found;
                }
            }
        }

        return undefined;
    }

    getGroup(groupId: string): ProjectGroup | undefined {
        return this.findGroupRecursive(groupId);
    }

    updateGroup(groupId: string, updates: Partial<ProjectGroup>): boolean {
        this.reloadFromDisk();
        const group = this.findGroupRecursive(groupId);
        if (!group) {
            return false;
        }

        // Update the group object directly (since findGroupRecursive returns a reference)
        Object.assign(group, updates);
        group.updatedAt = Date.now();

        this.saveData();
        return true;
    }

    updateGroupExpansionState(groupId: string, isExpanded: boolean): boolean {
        this.reloadFromDisk();
        const group = this.findGroupRecursive(groupId);
        if (!group) {
            return false;
        }

        group.isExpanded = isExpanded;
        // Don't update updatedAt for expansion state changes
        this.saveData();
        return true;
    }

    updateFolderExpansionState(groupId: string, folderId: string, isExpanded: boolean): boolean {
        this.reloadFromDisk();
        const group = this.findGroupRecursive(groupId);
        if (!group || !group.folders) {
            return false;
        }

        const folder = group.folders.find(f => f.id === folderId);
        if (!folder) {
            return false;
        }

        folder.expanded = isExpanded;
        // Don't update updatedAt for expansion state changes
        this.saveData();
        return true;
    }

    deleteGroup(groupId: string): boolean {
        this.reloadFromDisk();
        // Clear the "last used" pointer if it referenced the group being removed.
        if (this.data.lastUsedGroupId === groupId) {
            this.data.lastUsedGroupId = undefined;
        }
        // Try to delete from top-level groups first
        const groupIndex = this.data.groups.findIndex(g => g.id === groupId);
        if (groupIndex !== -1) {
            this.data.groups.splice(groupIndex, 1);
            this.saveData();
            return true;
        }

        // If not found at top level, search for subgroup
        const deleted = this.deleteSubgroupRecursive(groupId, this.data.groups);
        if (deleted) {
            this.saveData();
        }
        return deleted;
    }

    private deleteSubgroupRecursive(groupId: string, groups: ProjectGroup[]): boolean {
        for (const group of groups) {
            if (group.subgroups && group.subgroups.length > 0) {
                const subgroupIndex = group.subgroups.findIndex(sg => sg.id === groupId);
                if (subgroupIndex !== -1) {
                    group.subgroups.splice(subgroupIndex, 1);
                    group.updatedAt = Date.now();
                    return true;
                }
                // Recursively search in nested subgroups
                if (this.deleteSubgroupRecursive(groupId, group.subgroups)) {
                    return true;
                }
            }
        }
        return false;
    }

    // File management methods
    addFileToGroup(groupId: string, relativePath: string, label?: string): boolean {
        this.reloadFromDisk();
        const group = this.getGroup(groupId);
        if (!group) {
            return false;
        }

        // Check if file already exists in group
        if (group.files.some(f => f.relativePath === relativePath)) {
            vscode.window.showInformationMessage(`File already exists in group '${group.name}'`);
            return false;
        }

        const newFile: FileItem = {
            id: uuidv4(),
            relativePath,
            label,
            addedAt: Date.now(),
            lineNumber: 1
        };

        group.files.push(newFile);
        group.updatedAt = Date.now();
        this.data.lastUsedGroupId = group.id;
        this.saveData();
        return true;
    }

    updateFileLineNumber(groupId: string, fileId: string, lineNumber: number): boolean {
        this.reloadFromDisk();
        const group = this.getGroup(groupId);
        if (!group) {
            return false;
        }

        const file = group.files.find(f => f.id === fileId);
        if (!file) {
            return false;
        }

        file.lineNumber = lineNumber;
        group.updatedAt = Date.now();
        this.saveData();
        return true;
    }

    removeFileFromGroup(groupId: string, fileId: string): boolean {
        this.reloadFromDisk();
        const group = this.getGroup(groupId);
        if (!group) {
            return false;
        }

        const fileIndex = group.files.findIndex(f => f.id === fileId);
        if (fileIndex === -1) {
            return false;
        }

        group.files.splice(fileIndex, 1);
        group.updatedAt = Date.now();
        this.saveData();
        return true;
    }

    removeFileFromAllGroups(absolutePath: string): void {
        this.reloadFromDisk();
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const relativePath = path.relative(workspaceFolder.uri.fsPath, absolutePath);

        this.data.groups.forEach(group => {
            const fileIndex = group.files.findIndex(f => f.relativePath === relativePath);
            if (fileIndex !== -1) {
                group.files.splice(fileIndex, 1);
                group.updatedAt = Date.now();
            }
        });

        this.saveData();
    }

    // Folder management methods
    addFolderToGroup(groupId: string, relativePath: string, label?: string): boolean {
        this.reloadFromDisk();
        const group = this.getGroup(groupId);
        if (!group) {
            return false;
        }

        // Initialize folders array if not exists
        if (!group.folders) {
            group.folders = [];
        }

        // Check if folder already exists in group
        if (group.folders.some(f => f.relativePath === relativePath)) {
            vscode.window.showInformationMessage(`Folder already exists in group '${group.name}'`);
            return false;
        }

        const newFolder: FolderItem = {
            id: uuidv4(),
            relativePath,
            label,
            addedAt: Date.now(),
            expanded: true
        };

        group.folders.push(newFolder);
        group.updatedAt = Date.now();
        this.data.lastUsedGroupId = group.id;
        this.saveData();
        return true;
    }

    removeFolderFromGroup(groupId: string, folderId: string): boolean {
        this.reloadFromDisk();
        const group = this.getGroup(groupId);
        if (!group || !group.folders) {
            return false;
        }

        const folderIndex = group.folders.findIndex(f => f.id === folderId);
        if (folderIndex === -1) {
            return false;
        }

        group.folders.splice(folderIndex, 1);
        group.updatedAt = Date.now();
        this.saveData();
        return true;
    }

    // Drag and drop support - reorder items
    reorderItems(groupId: string, itemId: string, newIndex: number, itemType: 'file' | 'folder' | 'subgroup'): boolean {
        this.reloadFromDisk();
        const group = this.getGroup(groupId);
        if (!group) {
            return false;
        }

        let items: any[];
        if (itemType === 'file') {
            items = group.files;
        } else if (itemType === 'folder') {
            items = group.folders || [];
        } else {
            items = group.subgroups || [];
        }

        const oldIndex = items.findIndex((item: any) => item.id === itemId);
        if (oldIndex === -1 || oldIndex === newIndex) {
            return false;
        }

        const [movedItem] = items.splice(oldIndex, 1);
        items.splice(newIndex, 0, movedItem);

        // Update sort indices
        items.forEach((item: any, index: number) => {
            item.sortIndex = index;
        });

        group.updatedAt = Date.now();
        this.saveData();
        return true;
    }

    // Reorder top-level groups
    reorderGroups(groupId: string, newIndex: number): boolean {
        this.reloadFromDisk();
        const oldIndex = this.data.groups.findIndex(g => g.id === groupId);
        if (oldIndex === -1 || oldIndex === newIndex) {
            return false;
        }

        const [movedGroup] = this.data.groups.splice(oldIndex, 1);
        this.data.groups.splice(newIndex, 0, movedGroup);

        // Update sort indices for all groups
        this.data.groups.forEach((group, index) => {
            group.sortIndex = index;
        });

        this.saveData();
        return true;
    }

    // Move item between groups
    moveItemBetweenGroups(
        sourceGroupId: string,
        targetGroupId: string,
        itemId: string,
        itemType: 'file' | 'folder' | 'subgroup'
    ): boolean {
        this.reloadFromDisk();
        const sourceGroup = this.getGroup(sourceGroupId);
        const targetGroup = this.getGroup(targetGroupId);

        if (!sourceGroup || !targetGroup || sourceGroupId === targetGroupId) {
            return false;
        }

        let item: any;
        let sourceItems: any[];
        let targetItems: any[];

        if (itemType === 'file') {
            sourceItems = sourceGroup.files;
            targetItems = targetGroup.files;
        } else if (itemType === 'folder') {
            sourceItems = sourceGroup.folders || [];
            targetItems = targetGroup.folders || (targetGroup.folders = []);
        } else {
            sourceItems = sourceGroup.subgroups || [];
            targetItems = targetGroup.subgroups || (targetGroup.subgroups = []);
        }

        const itemIndex = sourceItems.findIndex((i: any) => i.id === itemId);
        if (itemIndex === -1) {
            return false;
        }

        [item] = sourceItems.splice(itemIndex, 1);

        // Update parent ID for subgroups
        if (itemType === 'subgroup') {
            item.parentId = targetGroupId;
        }

        targetItems.push(item);

        // Moving a file/folder into a group makes that group the "last used"
        // target, keeping the add-without-choosing default in sync with where
        // items most recently landed (a subgroup reorg shouldn't hijack it).
        if (itemType === 'file' || itemType === 'folder') {
            this.data.lastUsedGroupId = targetGroupId;
        }

        sourceGroup.updatedAt = Date.now();
        targetGroup.updatedAt = Date.now();
        this.saveData();
        return true;
    }

    // Utility methods
    exportData(): string {
        // Export is a "give me a correct backup" operation — guarantee it
        // reflects the on-disk truth, not a possibly-stale in-memory snapshot.
        this.reloadFromDisk();
        return JSON.stringify(this.data, null, 2);
    }

    importData(jsonData: string): boolean {
        try {
            const importedData = JSON.parse(jsonData) as FavoritesData;

            // Validate the imported data structure
            if (!importedData.version || !Array.isArray(importedData.groups)) {
                throw new Error('Invalid data format');
            }

            // Merge or replace based on user preference
            const action = vscode.window.showQuickPick(
                ['Replace existing groups', 'Merge with existing groups'],
                { placeHolder: 'How should the imported data be handled?' }
            );

            action.then(selected => {
                // Reload right before mutating: the user may have taken a while at
                // the prompt, during which another window could have written.
                this.reloadFromDisk();
                if (selected === 'Replace existing groups') {
                    this.data = importedData;
                } else if (selected === 'Merge with existing groups') {
                    // Avoid duplicate groups by checking names
                    const existingNames = new Set(this.data.groups.map(g => g.name));
                    importedData.groups.forEach(group => {
                        if (!existingNames.has(group.name)) {
                            this.data.groups.push(group);
                        }
                    });
                }
                this.saveData();
            });

            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    // Check if a file exists in any group
    isFileInAnyGroup(relativePath: string): boolean {
        return this.data.groups.some(group =>
            group.files.some(file => file.relativePath === relativePath)
        );
    }

    // Get all groups containing a specific file
    getGroupsContainingFile(relativePath: string): ProjectGroup[] {
        return this.data.groups.filter(group =>
            group.files.some(file => file.relativePath === relativePath)
        );
    }
}

// Note: Since uuid is not available by default, we'll create a simple implementation
function uuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}