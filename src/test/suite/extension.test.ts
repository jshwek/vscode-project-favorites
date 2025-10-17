import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('jshwek.project-favorites'));
    });

    test('Should activate', async () => {
        const ext = vscode.extensions.getExtension('jshwek.project-favorites');
        if (ext) {
            await ext.activate();
            assert.ok(ext.isActive);
        }
    });

    test('Should register all commands', () => {
        const expectedCommands = [
            'projectFavorites.addToGroup',
            'projectFavorites.addToNewGroup',
            'projectFavorites.addCurrentFileToGroup',
            'projectFavorites.addFolderToGroup',
            'projectFavorites.createGroup',
            'projectFavorites.createSubgroup',
            'projectFavorites.deleteGroup',
            'projectFavorites.renameGroup',
            'projectFavorites.removeFile',
            'projectFavorites.openFile',
            'projectFavorites.openAllFiles',
            'projectFavorites.revealInExplorer',
            'projectFavorites.refresh',
            'projectFavorites.collapseAll',
            'projectFavorites.exportGroups',
            'projectFavorites.importGroups'
        ];

        return vscode.commands.getCommands(true).then((commands) => {
            const projectCommands = commands.filter(cmd => cmd.startsWith('projectFavorites.'));

            expectedCommands.forEach(cmd => {
                assert.ok(
                    projectCommands.includes(cmd),
                    `Command ${cmd} not found in registered commands`
                );
            });
        });
    });

    test('Should have Project Favorites view', () => {
        // Check if the tree view exists
        const extension = vscode.extensions.getExtension('jshwek.project-favorites');
        if (extension && extension.packageJSON) {
            const contributes = extension.packageJSON.contributes;
            assert.ok(contributes);
            assert.ok(contributes.views);
            assert.ok(contributes.views['project-favorites']);

            const views = contributes.views['project-favorites'];
            assert.ok(views.some((v: any) => v.id === 'projectFavoritesView'));
        }
    });

    test('Should have configuration properties', () => {
        const config = vscode.workspace.getConfiguration('projectFavorites');

        // Test that configuration properties exist
        assert.ok(config.has('storageLocation'));
        assert.ok(config.has('confirmDelete'));
        assert.ok(config.has('sortOrder'));
        assert.ok(config.has('showFileIcons'));
        assert.ok(config.has('openAllFilesLimit'));
        assert.ok(config.has('enableDragAndDrop'));
    });

    test('Default configuration values', () => {
        const config = vscode.workspace.getConfiguration('projectFavorites');

        // Check default values
        assert.strictEqual(config.get('storageLocation'), 'workspace');
        assert.strictEqual(config.get('confirmDelete'), true);
        assert.strictEqual(config.get('sortOrder'), 'dateCreated');
        assert.strictEqual(config.get('showFileIcons'), true);
        assert.strictEqual(config.get('openAllFilesLimit'), 10);
        assert.strictEqual(config.get('enableDragAndDrop'), true);
    });
});