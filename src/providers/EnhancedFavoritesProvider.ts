import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectGroup, FileItem, FolderItem, TreeNode, SortOrder } from '../models/types';
import { StorageService } from '../services/StorageService';

export class EnhancedFavoritesProvider implements vscode.TreeDataProvider<TreeNode>, vscode.TreeDragAndDropController<TreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> = this._onDidChangeTreeData.event;

    dropMimeTypes = ['application/vnd.code.tree.projectFavoritesView', 'text/uri-list'];
    dragMimeTypes = ['text/uri-list'];

    constructor(
        private storageService: StorageService,
        private context: vscode.ExtensionContext
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        switch (element.type) {
            case 'group':
            case 'subgroup':
                return this.getGroupItem(element.group!);
            case 'file':
                return this.getFileItem(element.file!, element.groupId!);
            case 'folder':
                return this.getFolderItem(element.folder!, element.groupId!);
            default:
                throw new Error('Invalid tree node type');
        }
    }

    getChildren(element?: TreeNode): Thenable<TreeNode[]> {
        if (!element) {
            // Root level - return all top-level groups
            return Promise.resolve(this.getGroups());
        } else if ((element.type === 'group' || element.type === 'subgroup') && element.group) {
            // Group level - return subgroups, folders, and files
            return Promise.resolve(this.getGroupChildren(element.group));
        } else if (element.type === 'folder' && element.folder) {
            // Folder level - return files in the folder
            return Promise.resolve(this.getFolderChildren(element.folder, element.groupId!));
        }
        return Promise.resolve([]);
    }

    private getGroups(): TreeNode[] {
        const groups = this.storageService.getAllGroups();
        return this.sortAndMapGroups(groups, 'group');
    }

    private sortAndMapGroups(groups: ProjectGroup[], nodeType: 'group' | 'subgroup'): TreeNode[] {
        const sortOrder = vscode.workspace.getConfiguration('projectFavorites').get<string>('sortOrder', 'dateCreated');

        // Sort groups based on configuration
        const sorted = [...groups];
        switch (sortOrder) {
            case 'alphabetical':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'custom':
                sorted.sort((a, b) => (a.sortIndex ?? 999) - (b.sortIndex ?? 999));
                break;
            case 'recent':
                sorted.sort((a, b) => b.updatedAt - a.updatedAt);
                break;
            case 'dateCreated':
            default:
                sorted.sort((a, b) => a.createdAt - b.createdAt);
                break;
        }

        return sorted.map(group => ({
            type: nodeType,
            group,
            canMove: true
        }));
    }

    private getGroupChildren(group: ProjectGroup): TreeNode[] {
        const children: TreeNode[] = [];
        const sortOrder = vscode.workspace.getConfiguration('projectFavorites').get<string>('sortOrder', 'dateCreated');

        // Add subgroups
        if (group.subgroups && group.subgroups.length > 0) {
            children.push(...this.sortAndMapGroups(group.subgroups, 'subgroup'));
        }

        // Add folders
        if (group.folders && group.folders.length > 0) {
            const sortedFolders = this.sortItems(group.folders, sortOrder);
            children.push(...sortedFolders.map(folder => ({
                type: 'folder' as const,
                folder,
                groupId: group.id,
                canMove: true
            })));
        }

        // Add files
        const sortedFiles = this.sortItems(group.files, sortOrder);
        children.push(...sortedFiles.map(file => ({
            type: 'file' as const,
            file,
            groupId: group.id,
            canMove: true
        })));

        return children;
    }

    private getFolderChildren(folder: FolderItem, groupId: string): TreeNode[] {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const folderPath = path.join(workspaceFolder.uri.fsPath, folder.relativePath);

        try {
            const files = fs.readdirSync(folderPath);
            const fileNodes: TreeNode[] = [];

            for (const file of files) {
                const filePath = path.join(folderPath, file);
                const stat = fs.statSync(filePath);

                if (stat.isFile()) {
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
                    fileNodes.push({
                        type: 'file',
                        file: {
                            id: `folder-file-${relativePath}`,
                            relativePath,
                            addedAt: stat.birthtimeMs
                        },
                        groupId,
                        canMove: false // Files inside folders can't be moved individually
                    });
                }
            }

            return fileNodes;
        } catch (error) {
            console.error(`Error reading folder ${folderPath}:`, error);
            return [];
        }
    }

    private sortItems<T extends { addedAt: number; sortIndex?: number }>(items: T[], sortOrder: string): T[] {
        const sorted = [...items];

        switch (sortOrder) {
            case 'alphabetical':
                sorted.sort((a, b) => {
                    const aPath = (a as any).relativePath || '';
                    const bPath = (b as any).relativePath || '';
                    return path.basename(aPath).localeCompare(path.basename(bPath));
                });
                break;
            case 'custom':
                sorted.sort((a, b) => (a.sortIndex ?? 999) - (b.sortIndex ?? 999));
                break;
            case 'recent':
                sorted.sort((a, b) => b.addedAt - a.addedAt);
                break;
            case 'dateCreated':
            default:
                sorted.sort((a, b) => a.addedAt - b.addedAt);
                break;
        }

        return sorted;
    }

    private getGroupItem(group: ProjectGroup): vscode.TreeItem {
        const item = new vscode.TreeItem(
            group.name,
            group.isExpanded !== false ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
        );

        item.contextValue = group.parentId ? 'subgroup' : 'group';
        item.iconPath = new vscode.ThemeIcon(
            'folder-library',
            new vscode.ThemeColor(group.color || 'charts.foreground')
        );

        // Create rich tooltip
        item.tooltip = new vscode.MarkdownString();
        item.tooltip.appendMarkdown(`**${group.name}**\n\n`);

        if (group.description) {
            item.tooltip.appendMarkdown(`${group.description}\n\n`);
        }

        let itemCount = group.files.length;
        if (group.folders) itemCount += group.folders.length;
        if (group.subgroups) itemCount += group.subgroups.length;

        item.tooltip.appendMarkdown(`Items: ${itemCount}\n\n`);
        item.tooltip.appendMarkdown(`Created: ${new Date(group.createdAt).toLocaleDateString()}\n\n`);
        item.tooltip.appendMarkdown(`Updated: ${new Date(group.updatedAt).toLocaleDateString()}`);

        return item;
    }

    private getFileItem(file: FileItem, groupId: string): vscode.TreeItem {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const absolutePath = workspaceFolder
            ? path.join(workspaceFolder.uri.fsPath, file.relativePath)
            : file.relativePath;

        const fileName = file.label || path.basename(file.relativePath);
        const item = new vscode.TreeItem(fileName, vscode.TreeItemCollapsibleState.None);

        item.contextValue = 'file';
        item.resourceUri = vscode.Uri.file(absolutePath);
        item.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(absolutePath)]
        };

        // Show file icons if enabled
        const showIcons = vscode.workspace.getConfiguration('projectFavorites').get('showFileIcons', true);
        if (showIcons) {
            item.iconPath = vscode.ThemeIcon.File;
        }

        // Create detailed tooltip
        item.tooltip = new vscode.MarkdownString();
        item.tooltip.appendMarkdown(`**${fileName}**\n\n`);
        item.tooltip.appendMarkdown(`Path: \`${file.relativePath}\`\n\n`);
        item.tooltip.appendMarkdown(`Added: ${new Date(file.addedAt).toLocaleString()}`);

        // Add description to show the relative path if different from filename
        const dirPath = path.dirname(file.relativePath);
        if (dirPath !== '.' && dirPath !== '') {
            item.description = dirPath;
        }

        return item;
    }

    private getFolderItem(folder: FolderItem, groupId: string): vscode.TreeItem {
        const folderName = folder.label || path.basename(folder.relativePath);
        const item = new vscode.TreeItem(
            folderName,
            folder.expanded !== false ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
        );

        item.contextValue = 'folder';
        item.iconPath = vscode.ThemeIcon.Folder;

        // Create tooltip
        item.tooltip = new vscode.MarkdownString();
        item.tooltip.appendMarkdown(`**${folderName}**\n\n`);
        item.tooltip.appendMarkdown(`Path: \`${folder.relativePath}\`\n\n`);
        item.tooltip.appendMarkdown(`Added: ${new Date(folder.addedAt).toLocaleString()}`);

        // Add description to show the relative path if different from folder name
        if (folder.relativePath !== folderName) {
            item.description = folder.relativePath;
        }

        return item;
    }

    // Drag and Drop implementation
    async handleDrag(source: readonly TreeNode[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        const dragData = source.map(node => {
            const type = node.type;
            const id = node.type === 'file' ? node.file?.id :
                       node.type === 'folder' ? node.folder?.id :
                       node.group?.id;
            const groupId = node.groupId || (node.group?.parentId ? 'subgroup' : 'root');

            return { type, id, groupId };
        });

        dataTransfer.set('application/vnd.code.tree.projectFavoritesView',
            new vscode.DataTransferItem(dragData));
    }

    async handleDrop(target: TreeNode | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        const enableDragDrop = vscode.workspace.getConfiguration('projectFavorites').get('enableDragAndDrop', true);
        if (!enableDragDrop) {
            return;
        }

        const transferItem = dataTransfer.get('application/vnd.code.tree.projectFavoritesView');
        if (!transferItem) {
            // Handle external file drops
            const uriList = await dataTransfer.get('text/uri-list')?.asString();
            if (uriList && (target?.type === 'group' || target?.type === 'subgroup')) {
                await this.handleExternalDrop(target.group!, uriList);
            }
            return;
        }

        const dragData = transferItem.value as Array<{ type: string; id: string; groupId: string }>;

        // Only handle single item drag for now
        if (dragData.length !== 1) {
            return;
        }

        const draggedItem = dragData[0];

        // Case 1: Dropping onto a file or folder in the same group - reorder within group
        if ((target?.type === 'file' || target?.type === 'folder') && target.groupId === draggedItem.groupId) {
            // Only allow reordering within the same type (file-to-file, folder-to-folder)
            if (target.type !== draggedItem.type) {
                return;
            }

            const group = this.storageService.getGroup(target.groupId);
            if (!group) return;

            // Get target item ID
            const targetId = target.type === 'file' ? target.file?.id : target.folder?.id;
            if (!targetId) return;

            // Find the index of the target item
            let targetIndex = -1;
            if (draggedItem.type === 'file' && target.type === 'file') {
                targetIndex = group.files.findIndex(f => f.id === targetId);
            } else if (draggedItem.type === 'folder' && target.type === 'folder') {
                targetIndex = group.folders?.findIndex(f => f.id === targetId) ?? -1;
            }

            if (targetIndex !== -1) {
                // Check if sort order is custom, if not, switch to custom
                const config = vscode.workspace.getConfiguration('projectFavorites');
                const currentSort = config.get<string>('sortOrder', 'dateCreated');

                if (currentSort !== 'custom') {
                    await config.update('sortOrder', 'custom', vscode.ConfigurationTarget.Workspace);
                    vscode.window.showInformationMessage('Sort order changed to "custom" to allow manual reordering');
                }

                this.storageService.reorderItems(
                    target.groupId,
                    draggedItem.id,
                    targetIndex,
                    draggedItem.type as 'file' | 'folder'
                );
                this.refresh();
            }
            return;
        }

        // Case 2: Dropping onto a group - move items to this group
        if (target?.type === 'group' || target?.type === 'subgroup') {
            for (const item of dragData) {
                if (item.groupId !== 'root' && target.group) {
                    // If dropping on the same group, don't do anything
                    if (item.groupId === target.group.id) {
                        return;
                    }

                    this.storageService.moveItemBetweenGroups(
                        item.groupId,
                        target.group.id,
                        item.id,
                        item.type as 'file' | 'folder' | 'subgroup'
                    );
                }
            }
            this.refresh();
        }
    }

    private async handleExternalDrop(group: ProjectGroup, uriList: string): Promise<void> {
        const uris = uriList.split('\n').filter(uri => uri.length > 0);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            return;
        }

        for (const uriString of uris) {
            try {
                const uri = vscode.Uri.parse(uriString);
                const stat = await vscode.workspace.fs.stat(uri);
                const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);

                if (stat.type === vscode.FileType.Directory) {
                    this.storageService.addFolderToGroup(group.id, relativePath);
                } else {
                    this.storageService.addFileToGroup(group.id, relativePath);
                }
            } catch (error) {
                console.error('Error handling drop:', error);
            }
        }

        this.refresh();
    }
}