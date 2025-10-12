import * as vscode from 'vscode';
import { EnhancedFavoritesProvider } from './providers/EnhancedFavoritesProvider';
import { StorageService } from './services/StorageService';
import { registerEnhancedCommands } from './commands/enhanced';
import { TreeNode } from './models/types';

export function activate(context: vscode.ExtensionContext) {
    console.log('Project Favorites extension is now active!');

    // Initialize storage service
    const storageService = new StorageService(context);

    // Create and register the enhanced tree data provider with drag and drop support
    const favoritesProvider = new EnhancedFavoritesProvider(storageService, context);

    const treeView = vscode.window.createTreeView<TreeNode>('projectFavoritesView', {
        treeDataProvider: favoritesProvider,
        showCollapseAll: true,
        canSelectMany: true,  // Enable multi-select for drag and drop
        dragAndDropController: favoritesProvider  // Enable drag and drop
    });

    // Register all enhanced commands
    registerEnhancedCommands(context, favoritesProvider, storageService, treeView);

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('projectFavorites.hasShownWelcome', false);
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'Welcome to Project Favorites! Right-click on any file to add it to a project group.',
            'Got it'
        ).then(() => {
            context.globalState.update('projectFavorites.hasShownWelcome', true);
        });
    }

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('projectFavorites')) {
                favoritesProvider.refresh();
            }
        })
    );

    // Listen for file deletions to clean up groups
    context.subscriptions.push(
        vscode.workspace.onDidDeleteFiles(e => {
            e.files.forEach(uri => {
                storageService.removeFileFromAllGroups(uri.fsPath);
            });
            favoritesProvider.refresh();
        })
    );

    context.subscriptions.push(treeView);
}

export function deactivate() {
    // Cleanup if needed
}