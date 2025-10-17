import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EnhancedFavoritesProvider } from '../providers/EnhancedFavoritesProvider';
import { StorageService } from '../services/StorageService';
import { TreeNode } from '../models/types';

export function registerEnhancedCommands(
    context: vscode.ExtensionContext,
    provider: EnhancedFavoritesProvider,
    storageService: StorageService,
    treeView: vscode.TreeView<TreeNode>
) {
    // Add current file to group (keyboard shortcut compatible)
    const addCurrentFileToGroup = vscode.commands.registerCommand(
        'projectFavorites.addCurrentFileToGroup',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active file to add');
                return;
            }

            await addFileToGroupWithPicker(editor.document.uri, storageService, provider);
        }
    );

    // Add file to existing group
    const addToGroup = vscode.commands.registerCommand(
        'projectFavorites.addToGroup',
        async (uri?: vscode.Uri) => {
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (!fileUri) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            await addFileToGroupWithPicker(fileUri, storageService, provider);
        }
    );

    // Add file to new group
    const addToNewGroup = vscode.commands.registerCommand(
        'projectFavorites.addToNewGroup',
        async (uri?: vscode.Uri) => {
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
            await createNewGroupWithFile(fileUri, storageService, provider);
        }
    );

    // Add folder to group
    const addFolderToGroup = vscode.commands.registerCommand(
        'projectFavorites.addFolderToGroup',
        async (uri?: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('No folder selected');
                return;
            }

            const groups = storageService.getAllGroups();
            if (groups.length === 0) {
                const create = await vscode.window.showInformationMessage(
                    'No groups found. Would you like to create one?',
                    'Yes', 'No'
                );
                if (create === 'Yes') {
                    await createNewGroupWithFolder(uri, storageService, provider);
                }
                return;
            }

            const selected = await selectGroup(groups, 'Select a group to add the folder to');
            if (selected) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
                    const success = storageService.addFolderToGroup(selected.id, relativePath);

                    if (success) {
                        provider.refresh();
                        vscode.window.showInformationMessage(`Added folder to group '${selected.name}'`);
                    }
                }
            }
        }
    );

    // Create new group
    const createGroup = vscode.commands.registerCommand(
        'projectFavorites.createGroup',
        async () => {
            await createNewGroupWithFile(undefined, storageService, provider);
        }
    );

    // Create subgroup
    const createSubgroup = vscode.commands.registerCommand(
        'projectFavorites.createSubgroup',
        async (node: TreeNode) => {
            if (!node.group) return;

            const name = await vscode.window.showInputBox({
                prompt: 'Enter subgroup name',
                placeHolder: 'e.g., Frontend, Backend, Tests',
                validateInput: validateGroupName
            });

            if (!name) return;

            const description = await vscode.window.showInputBox({
                prompt: 'Enter subgroup description (optional)',
                placeHolder: 'Optional description for the subgroup'
            });

            storageService.createGroup(name, description, node.group.id);
            provider.refresh();
            vscode.window.showInformationMessage(`Subgroup '${name}' created`);
        }
    );

    // Delete group
    const deleteGroup = vscode.commands.registerCommand(
        'projectFavorites.deleteGroup',
        async (node: TreeNode) => {
            if (!node.group) return;

            const confirmDelete = vscode.workspace.getConfiguration('projectFavorites').get('confirmDelete', true);

            if (confirmDelete) {
                const hasSubgroups = node.group.subgroups && node.group.subgroups.length > 0;
                const message = hasSubgroups
                    ? `Delete group '${node.group.name}' and all its subgroups?`
                    : `Delete group '${node.group.name}'?`;

                const action = await vscode.window.showWarningMessage(message, 'Yes', 'No');
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
            if (!node.group) return;

            const newName = await vscode.window.showInputBox({
                prompt: 'Enter new group name',
                value: node.group.name,
                validateInput: (value) => {
                    if (!value) return 'Group name is required';
                    if (value !== node.group!.name) {
                        const groups = storageService.getAllGroups();
                        if (groups.some(g => g.name === value && g.id !== node.group!.id)) {
                            return 'A group with this name already exists';
                        }
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
            if (!node.file || !node.groupId) return;

            const group = storageService.getGroup(node.groupId);
            if (!group) return;

            storageService.removeFileFromGroup(node.groupId, node.file.id);
            provider.refresh();

            const fileName = path.basename(node.file.relativePath);
            vscode.window.showInformationMessage(`Removed '${fileName}' from '${group.name}'`);
        }
    );

    // Edit file line number
    const editFileLineNumber = vscode.commands.registerCommand(
        'projectFavorites.editFileLineNumber',
        async (node: TreeNode) => {
            if (!node.file || !node.groupId) return;

            const currentLine = node.file.lineNumber || 1;
            const input = await vscode.window.showInputBox({
                prompt: 'Enter line number to jump to when opening this file',
                value: currentLine.toString(),
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1) {
                        return 'Please enter a valid line number (must be >= 1)';
                    }
                    return undefined;
                }
            });

            if (input) {
                const lineNumber = parseInt(input);
                storageService.updateFileLineNumber(node.groupId, node.file.id, lineNumber);
                provider.refresh();
                vscode.window.showInformationMessage(`Line number set to ${lineNumber}`);
            }
        }
    );

    // Open file
    const openFile = vscode.commands.registerCommand(
        'projectFavorites.openFile',
        async (node: TreeNode) => {
            if (!node.file) return;

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const absolutePath = path.join(workspaceFolder.uri.fsPath, node.file.relativePath);
                try {
                    const document = await vscode.workspace.openTextDocument(absolutePath);
                    const lineNumber = node.file.lineNumber || 1;
                    const position = new vscode.Position(lineNumber - 1, 0);
                    const selection = new vscode.Range(position, position);

                    await vscode.window.showTextDocument(document, {
                        selection: selection
                    });
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to open file: ${node.file.relativePath}`);
                }
            }
        }
    );

    // Open all files in group (enhanced with limit)
    const openAllFiles = vscode.commands.registerCommand(
        'projectFavorites.openAllFiles',
        async (node: TreeNode) => {
            if (!node.group) return;

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            // Get all files including those in folders
            const allFiles = await getAllFilesInGroup(node.group, workspaceFolder.uri.fsPath);
            const limit = vscode.workspace.getConfiguration('projectFavorites')
                .get('openAllFilesLimit', 10) as number;

            if (allFiles.length === 0) {
                vscode.window.showInformationMessage(`No files in group '${node.group.name}'`);
                return;
            }

            if (allFiles.length > limit) {
                const action = await vscode.window.showWarningMessage(
                    `This group contains ${allFiles.length} files. Only the first ${limit} will be opened. Continue?`,
                    'Yes', 'No', 'Change Limit'
                );

                if (action === 'No') return;
                if (action === 'Change Limit') {
                    await vscode.commands.executeCommand('workbench.action.openSettings', 'projectFavorites.openAllFilesLimit');
                    return;
                }
            }

            const openCount = Math.min(allFiles.length, limit);
            let successCount = 0;

            for (let i = 0; i < openCount; i++) {
                try {
                    const document = await vscode.workspace.openTextDocument(allFiles[i]);
                    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: i > 0 });
                    successCount++;
                } catch (error) {
                    console.error(`Failed to open file:`, error);
                }
            }

            vscode.window.showInformationMessage(
                `Opened ${successCount} of ${openCount} files from '${node.group.name}'`
            );
        }
    );

    // Export groups
    const exportGroups = vscode.commands.registerCommand(
        'projectFavorites.exportGroups',
        async () => {
            const options: vscode.SaveDialogOptions = {
                defaultUri: vscode.Uri.file('project-favorites-export.json'),
                filters: {
                    'JSON files': ['json'],
                    'All files': ['*']
                },
                saveLabel: 'Export'
            };

            const uri = await vscode.window.showSaveDialog(options);
            if (uri) {
                try {
                    const data = storageService.exportData();
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(data));
                    vscode.window.showInformationMessage('Groups exported successfully');
                } catch (error) {
                    vscode.window.showErrorMessage(`Export failed: ${error}`);
                }
            }
        }
    );

    // Import groups
    const importGroups = vscode.commands.registerCommand(
        'projectFavorites.importGroups',
        async () => {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Import',
                filters: {
                    'JSON files': ['json'],
                    'All files': ['*']
                }
            };

            const fileUri = await vscode.window.showOpenDialog(options);
            if (fileUri && fileUri[0]) {
                try {
                    const content = await vscode.workspace.fs.readFile(fileUri[0]);
                    const jsonData = Buffer.from(content).toString('utf8');

                    if (storageService.importData(jsonData)) {
                        provider.refresh();
                        vscode.window.showInformationMessage('Groups imported successfully');
                    } else {
                        vscode.window.showErrorMessage('Import failed: Invalid data format');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Import failed: ${error}`);
                }
            }
        }
    );

    // Reveal in explorer
    const revealInExplorer = vscode.commands.registerCommand(
        'projectFavorites.revealInExplorer',
        async (node: TreeNode) => {
            if (!node.file) return;

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

    // Move group up
    const moveGroupUp = vscode.commands.registerCommand(
        'projectFavorites.moveGroupUp',
        async (node: TreeNode) => {
            if (!node.group) return;

            // Only allow moving top-level groups
            if (node.group.parentId) {
                vscode.window.showInformationMessage('Only top-level groups can be reordered');
                return;
            }

            const groups = storageService.getAllGroups();
            const currentIndex = groups.findIndex(g => g.id === node.group!.id);

            if (currentIndex <= 0) {
                vscode.window.showInformationMessage('Group is already at the top');
                return;
            }

            // Check if sort order is custom, if not, switch to custom
            const config = vscode.workspace.getConfiguration('projectFavorites');
            const currentSort = config.get<string>('sortOrder', 'dateCreated');

            if (currentSort !== 'custom') {
                await config.update('sortOrder', 'custom', vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage('Sort order changed to "custom" to allow manual reordering');
            }

            storageService.reorderGroups(node.group.id, currentIndex - 1);
            provider.refresh();
        }
    );

    // Move group down
    const moveGroupDown = vscode.commands.registerCommand(
        'projectFavorites.moveGroupDown',
        async (node: TreeNode) => {
            if (!node.group) return;

            // Only allow moving top-level groups
            if (node.group.parentId) {
                vscode.window.showInformationMessage('Only top-level groups can be reordered');
                return;
            }

            const groups = storageService.getAllGroups();
            const currentIndex = groups.findIndex(g => g.id === node.group!.id);

            if (currentIndex === -1 || currentIndex >= groups.length - 1) {
                vscode.window.showInformationMessage('Group is already at the bottom');
                return;
            }

            // Check if sort order is custom, if not, switch to custom
            const config = vscode.workspace.getConfiguration('projectFavorites');
            const currentSort = config.get<string>('sortOrder', 'dateCreated');

            if (currentSort !== 'custom') {
                await config.update('sortOrder', 'custom', vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage('Sort order changed to "custom" to allow manual reordering');
            }

            storageService.reorderGroups(node.group.id, currentIndex + 1);
            provider.refresh();
        }
    );

    // Register all commands
    context.subscriptions.push(
        addCurrentFileToGroup,
        addToGroup,
        addToNewGroup,
        addFolderToGroup,
        createGroup,
        createSubgroup,
        deleteGroup,
        renameGroup,
        removeFile,
        editFileLineNumber,
        openFile,
        openAllFiles,
        exportGroups,
        importGroups,
        revealInExplorer,
        refresh,
        collapseAll,
        moveGroupUp,
        moveGroupDown
    );
}

// Helper functions
async function addFileToGroupWithPicker(
    fileUri: vscode.Uri,
    storageService: StorageService,
    provider: EnhancedFavoritesProvider
): Promise<void> {
    const groups = storageService.getAllGroups();
    if (groups.length === 0) {
        const create = await vscode.window.showInformationMessage(
            'No groups found. Would you like to create one?',
            'Yes', 'No'
        );
        if (create === 'Yes') {
            await createNewGroupWithFile(fileUri, storageService, provider);
        }
        return;
    }

    const selected = await selectGroup(groups, 'Select a group to add the file to');
    if (selected) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
            const success = storageService.addFileToGroup(selected.id, relativePath);

            if (success) {
                provider.refresh();
                vscode.window.showInformationMessage(`Added to group '${selected.name}'`);
            }
        }
    }
}

async function createNewGroupWithFile(
    fileUri: vscode.Uri | undefined,
    storageService: StorageService,
    provider: EnhancedFavoritesProvider
): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: 'Enter group name',
        placeHolder: 'e.g., Sales, Authentication, Dashboard',
        validateInput: validateGroupName
    });

    if (!name) return;

    const description = await vscode.window.showInputBox({
        prompt: 'Enter group description (optional)',
        placeHolder: 'e.g., All files related to the sales module'
    });

    const group = storageService.createGroup(name, description);

    if (fileUri) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
            storageService.addFileToGroup(group.id, relativePath);
        }
    }

    provider.refresh();
    vscode.window.showInformationMessage(`Group '${name}' created successfully`);
}

async function createNewGroupWithFolder(
    folderUri: vscode.Uri,
    storageService: StorageService,
    provider: EnhancedFavoritesProvider
): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: 'Enter group name',
        placeHolder: 'e.g., Sales, Authentication, Dashboard',
        validateInput: validateGroupName
    });

    if (!name) return;

    const group = storageService.createGroup(name);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (workspaceFolder) {
        const relativePath = path.relative(workspaceFolder.uri.fsPath, folderUri.fsPath);
        storageService.addFolderToGroup(group.id, relativePath);
    }

    provider.refresh();
    vscode.window.showInformationMessage(`Group '${name}' created with folder`);
}

async function selectGroup(groups: any[], placeHolder: string): Promise<any> {
    const flatGroups = flattenGroups(groups);
    const items = flatGroups.map(({ group, level }) => ({
        label: '  '.repeat(level) + group.name,
        description: `${group.files.length + (group.folders?.length || 0)} items`,
        detail: group.description,
        group
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder,
        canPickMany: false
    });

    return selected?.group;
}

function flattenGroups(groups: any[], level = 0): Array<{ group: any; level: number }> {
    const result: Array<{ group: any; level: number }> = [];

    for (const group of groups) {
        result.push({ group, level });
        if (group.subgroups && group.subgroups.length > 0) {
            result.push(...flattenGroups(group.subgroups, level + 1));
        }
    }

    return result;
}

function validateGroupName(value: string): string | undefined {
    if (!value) return 'Group name is required';
    if (value.length > 50) return 'Group name must be less than 50 characters';
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(value)) {
        return 'Group name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    return undefined;
}

async function getAllFilesInGroup(group: any, workspaceRoot: string): Promise<string[]> {
    const files: string[] = [];

    // Add direct files
    for (const file of group.files) {
        files.push(path.join(workspaceRoot, file.relativePath));
    }

    // Add files from folders
    if (group.folders) {
        for (const folder of group.folders) {
            const folderPath = path.join(workspaceRoot, folder.relativePath);
            try {
                const folderFiles = await getFilesInFolder(folderPath);
                files.push(...folderFiles);
            } catch (error) {
                console.error(`Error reading folder ${folderPath}:`, error);
            }
        }
    }

    // Recursively add files from subgroups
    if (group.subgroups) {
        for (const subgroup of group.subgroups) {
            const subgroupFiles = await getAllFilesInGroup(subgroup, workspaceRoot);
            files.push(...subgroupFiles);
        }
    }

    return files;
}

async function getFilesInFolder(folderPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        if (entry.isFile()) {
            files.push(fullPath);
        } else if (entry.isDirectory()) {
            // Optionally recurse into subdirectories
            // const subFiles = await getFilesInFolder(fullPath);
            // files.push(...subFiles);
        }
    }

    return files;
}