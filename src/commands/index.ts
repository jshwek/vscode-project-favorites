import * as vscode from 'vscode';
import * as path from 'path';
import { FavoritesProvider } from '../providers/FavoritesProvider';
import { StorageService } from '../services/StorageService';
import { TreeNode } from '../models/types';

export function registerCommands(
    context: vscode.ExtensionContext,
    provider: FavoritesProvider,
    storageService: StorageService,
    treeView: vscode.TreeView<TreeNode>
) {
    // Add file to existing group
    const addToGroup = vscode.commands.registerCommand(
        'projectFavorites.addToGroup',
        async (uri?: vscode.Uri) => {
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (!fileUri) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            const groups = storageService.getAllGroups();
            if (groups.length === 0) {
                const create = await vscode.window.showInformationMessage(
                    'No groups found. Would you like to create one?',
                    'Yes',
                    'No'
                );
                if (create === 'Yes') {
                    vscode.commands.executeCommand('projectFavorites.addToNewGroup', fileUri);
                }
                return;
            }

            const selected = await vscode.window.showQuickPick(
                groups.map(g => ({
                    label: g.name,
                    description: `${g.files.length} files`,
                    detail: g.description,
                    group: g
                })),
                {
                    placeHolder: 'Select a group to add the file to',
                    canPickMany: false
                }
            );

            if (selected) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
                    const success = storageService.addFileToGroup(selected.group.id, relativePath);

                    if (success) {
                        provider.refresh();
                        vscode.window.showInformationMessage(`Added to group '${selected.group.name}'`);
                    }
                }
            }
        }
    );

    // Add file to new group
    const addToNewGroup = vscode.commands.registerCommand(
        'projectFavorites.addToNewGroup',
        async (uri?: vscode.Uri) => {
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;

            const groupName = await vscode.window.showInputBox({
                prompt: 'Enter group name',
                placeHolder: 'e.g., Sales, Authentication, Dashboard',
                validateInput: (value) => {
                    if (!value) return 'Group name is required';
                    if (storageService.getAllGroups().some(g => g.name === value)) {
                        return 'A group with this name already exists';
                    }
                    return undefined;
                }
            });

            if (!groupName) return;

            const description = await vscode.window.showInputBox({
                prompt: 'Enter group description (optional)',
                placeHolder: 'e.g., All files related to the sales module'
            });

            const group = storageService.createGroup(groupName, description);

            if (fileUri) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
                    storageService.addFileToGroup(group.id, relativePath);
                }
            }

            provider.refresh();
            vscode.window.showInformationMessage(`Group '${groupName}' created successfully`);
        }
    );

    // Create new group (without file)
    const createGroup = vscode.commands.registerCommand(
        'projectFavorites.createGroup',
        async () => {
            await vscode.commands.executeCommand('projectFavorites.addToNewGroup');
        }
    );

    // Delete group
    const deleteGroup = vscode.commands.registerCommand(
        'projectFavorites.deleteGroup',
        async (node: TreeNode) => {
            if (node.type !== 'group' || !node.group) return;

            const confirmDelete = vscode.workspace.getConfiguration('projectFavorites').get('confirmDelete', true);

            if (confirmDelete) {
                const action = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete the group '${node.group.name}'?`,
                    'Yes',
                    'No'
                );

                if (action !== 'Yes') return;
            }

            storageService.deleteGroup(node.group.id);
            provider.refresh();
            vscode.window.showInformationMessage(`Group '${node.group.name}' deleted`);
        }
    );

    // Rename group
    const renameGroup = vscode.commands.registerCommand(
        'projectFavorites.renameGroup',
        async (node: TreeNode) => {
            if (node.type !== 'group' || !node.group) return;

            const newName = await vscode.window.showInputBox({
                prompt: 'Enter new group name',
                value: node.group.name,
                validateInput: (value) => {
                    if (!value) return 'Group name is required';
                    if (value !== node.group!.name && storageService.getAllGroups().some(g => g.name === value)) {
                        return 'A group with this name already exists';
                    }
                    return undefined;
                }
            });

            if (newName && newName !== node.group.name) {
                storageService.updateGroup(node.group.id, { name: newName });
                provider.refresh();
                vscode.window.showInformationMessage(`Group renamed to '${newName}'`);
            }
        }
    );

    // Remove file from group
    const removeFile = vscode.commands.registerCommand(
        'projectFavorites.removeFile',
        async (node: TreeNode) => {
            if (node.type !== 'file' || !node.file || !node.groupId) return;

            const group = storageService.getGroup(node.groupId);
            if (!group) return;

            storageService.removeFileFromGroup(node.groupId, node.file.id);
            provider.refresh();
            vscode.window.showInformationMessage(`Removed '${path.basename(node.file.relativePath)}' from '${group.name}'`);
        }
    );

    // Open file
    const openFile = vscode.commands.registerCommand(
        'projectFavorites.openFile',
        async (node: TreeNode) => {
            if (node.type !== 'file' || !node.file) return;

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const absolutePath = path.join(workspaceFolder.uri.fsPath, node.file.relativePath);
                const document = await vscode.workspace.openTextDocument(absolutePath);
                await vscode.window.showTextDocument(document);
            }
        }
    );

    // Open all files in group
    const openAllFiles = vscode.commands.registerCommand(
        'projectFavorites.openAllFiles',
        async (node: TreeNode) => {
            if (node.type !== 'group' || !node.group) return;

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const openCount = Math.min(node.group.files.length, 10); // Limit to 10 files

            if (node.group.files.length > 10) {
                const action = await vscode.window.showWarningMessage(
                    `This group contains ${node.group.files.length} files. Only the first 10 will be opened. Continue?`,
                    'Yes',
                    'No'
                );
                if (action !== 'Yes') return;
            }

            for (let i = 0; i < openCount; i++) {
                const file = node.group.files[i];
                const absolutePath = path.join(workspaceFolder.uri.fsPath, file.relativePath);

                try {
                    const document = await vscode.workspace.openTextDocument(absolutePath);
                    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: i > 0 });
                } catch (error) {
                    console.error(`Failed to open file: ${file.relativePath}`, error);
                }
            }

            vscode.window.showInformationMessage(`Opened ${openCount} files from '${node.group.name}'`);
        }
    );

    // Reveal file in explorer
    const revealInExplorer = vscode.commands.registerCommand(
        'projectFavorites.revealInExplorer',
        async (node: TreeNode) => {
            if (node.type !== 'file' || !node.file) return;

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const absolutePath = path.join(workspaceFolder.uri.fsPath, node.file.relativePath);
                const uri = vscode.Uri.file(absolutePath);
                await vscode.commands.executeCommand('revealInExplorer', uri);
            }
        }
    );

    // Refresh view
    const refresh = vscode.commands.registerCommand(
        'projectFavorites.refresh',
        () => provider.refresh()
    );

    // Collapse all
    const collapseAll = vscode.commands.registerCommand(
        'projectFavorites.collapseAll',
        () => {
            vscode.commands.executeCommand('workbench.actions.treeView.projectFavoritesView.collapseAll');
        }
    );

    // Register all commands
    context.subscriptions.push(
        addToGroup,
        addToNewGroup,
        createGroup,
        deleteGroup,
        renameGroup,
        removeFile,
        openFile,
        openAllFiles,
        revealInExplorer,
        refresh,
        collapseAll
    );
}