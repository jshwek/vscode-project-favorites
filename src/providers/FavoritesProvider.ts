import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectGroup, FileItem, TreeNode } from '../models/types';
import { StorageService } from '../services/StorageService';

export class FavoritesProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private storageService: StorageService,
        private context: vscode.ExtensionContext
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        if (element.type === 'group' && element.group) {
            return this.getGroupItem(element.group);
        } else if (element.type === 'file' && element.file && element.groupId) {
            return this.getFileItem(element.file, element.groupId);
        }
        throw new Error('Invalid tree node');
    }

    getChildren(element?: TreeNode): Thenable<TreeNode[]> {
        if (!element) {
            // Root level - return all groups
            return Promise.resolve(this.getGroups());
        } else if (element.type === 'group' && element.group) {
            // Group level - return files in the group
            return Promise.resolve(this.getFilesInGroup(element.group));
        }
        return Promise.resolve([]);
    }

    private getGroups(): TreeNode[] {
        const groups = this.storageService.getAllGroups();
        const sortOrder = vscode.workspace.getConfiguration('projectFavorites').get('sortOrder', 'alphabetical');

        // Sort groups based on configuration
        if (sortOrder === 'alphabetical') {
            groups.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortOrder === 'custom' && groups.every(g => g.sortIndex !== undefined)) {
            groups.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
        } else if (sortOrder === 'recent') {
            groups.sort((a, b) => b.updatedAt - a.updatedAt);
        }

        return groups.map(group => ({
            type: 'group' as const,
            group
        }));
    }

    private getFilesInGroup(group: ProjectGroup): TreeNode[] {
        return group.files.map(file => ({
            type: 'file' as const,
            file,
            groupId: group.id
        }));
    }

    private getGroupItem(group: ProjectGroup): vscode.TreeItem {
        const item = new vscode.TreeItem(
            group.name,
            vscode.TreeItemCollapsibleState.Expanded
        );

        item.contextValue = 'group';
        item.iconPath = new vscode.ThemeIcon('folder-library', new vscode.ThemeColor(group.color || 'charts.foreground'));
        item.tooltip = new vscode.MarkdownString();
        item.tooltip.appendMarkdown(`**${group.name}**\n\n`);

        if (group.description) {
            item.tooltip.appendMarkdown(`${group.description}\n\n`);
        }

        item.tooltip.appendMarkdown(`Files: ${group.files.length}\n\n`);
        item.tooltip.appendMarkdown(`Created: ${new Date(group.createdAt).toLocaleDateString()}`);

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
        item.tooltip.appendMarkdown(`Added: ${new Date(file.addedAt).toLocaleDateString()}`);

        // Add description to show the relative path
        item.description = file.relativePath !== fileName ? file.relativePath : undefined;

        return item;
    }

    // Helper methods for command handlers
    async addFileToGroup(fileUri: vscode.Uri, groupId?: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);

        if (groupId) {
            // Add to existing group
            this.storageService.addFileToGroup(groupId, relativePath);
        } else {
            // Show quick pick to select group
            const groups = this.storageService.getAllGroups();
            if (groups.length === 0) {
                vscode.window.showInformationMessage('No groups found. Create a group first.');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                groups.map(g => ({
                    label: g.name,
                    description: `${g.files.length} files`,
                    detail: g.description,
                    group: g
                })),
                { placeHolder: 'Select a group to add the file to' }
            );

            if (selected) {
                this.storageService.addFileToGroup(selected.group.id, relativePath);
            }
        }

        this.refresh();
    }

    async createNewGroup(fileUri?: vscode.Uri): Promise<void> {
        const groupName = await vscode.window.showInputBox({
            prompt: 'Enter group name',
            placeHolder: 'e.g., Sales, Authentication, Dashboard'
        });

        if (!groupName) {
            return;
        }

        const description = await vscode.window.showInputBox({
            prompt: 'Enter group description (optional)',
            placeHolder: 'e.g., All files related to the sales module'
        });

        const group = this.storageService.createGroup(groupName, description);

        if (fileUri) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
                this.storageService.addFileToGroup(group.id, relativePath);
            }
        }

        this.refresh();
        vscode.window.showInformationMessage(`Group '${groupName}' created successfully`);
    }
}