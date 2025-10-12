import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectGroup, FileItem, FolderItem, FavoritesData, StorageLocation } from '../models/types';

export class StorageService {
    private static readonly STORAGE_KEY = 'projectFavorites.data';
    private static readonly STORAGE_FILE = 'project-favorites.json';
    private data: FavoritesData;

    constructor(private context: vscode.ExtensionContext) {
        this.data = this.loadData();
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

    private loadData(): FavoritesData {
        const storageLocation = this.getStorageLocation();

        if (storageLocation === StorageLocation.Workspace) {
            const filePath = this.getStorageFilePath();
            if (filePath && fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    return JSON.parse(content);
                } catch (error) {
                    console.error('Error loading workspace storage:', error);
                }
            }
        } else {
            // Load from global storage
            const data = this.context.globalState.get<FavoritesData>(StorageService.STORAGE_KEY);
            if (data) {
                return data;
            }
        }

        // Return default empty data
        return {
            version: '1.0.0',
            groups: []
        };
    }

    private saveData(): void {
        const storageLocation = this.getStorageLocation();

        if (storageLocation === StorageLocation.Workspace) {
            const filePath = this.getStorageFilePath();
            if (filePath) {
                try {
                    fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2), 'utf-8');
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


    createGroup(name: string, description?: string, parentId?: string): ProjectGroup {
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
        const groupIndex = this.data.groups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) {
            return false;
        }

        this.data.groups[groupIndex] = {
            ...this.data.groups[groupIndex],
            ...updates,
            updatedAt: Date.now()
        };

        this.saveData();
        return true;
    }

    deleteGroup(groupId: string): boolean {
        const groupIndex = this.data.groups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) {
            return false;
        }

        this.data.groups.splice(groupIndex, 1);
        this.saveData();
        return true;
    }

    // File management methods
    addFileToGroup(groupId: string, relativePath: string, label?: string): boolean {
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
            addedAt: Date.now()
        };

        group.files.push(newFile);
        group.updatedAt = Date.now();
        this.saveData();
        return true;
    }

    removeFileFromGroup(groupId: string, fileId: string): boolean {
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
        this.saveData();
        return true;
    }

    removeFolderFromGroup(groupId: string, folderId: string): boolean {
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

        sourceGroup.updatedAt = Date.now();
        targetGroup.updatedAt = Date.now();
        this.saveData();
        return true;
    }

    // Utility methods
    exportData(): string {
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