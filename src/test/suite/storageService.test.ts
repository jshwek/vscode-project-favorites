import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { StorageService } from '../../services/StorageService';
import { ProjectGroup, FileItem, FolderItem, StorageLocation } from '../../models/types';

suite('StorageService Test Suite', () => {
    let storageService: StorageService;
    let context: vscode.ExtensionContext;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Mock extension context
        context = {
            globalState: {
                get: sandbox.stub(),
                update: sandbox.stub().resolves(),
                keys: () => [],
                setKeysForSync: () => {}
            },
            workspaceState: {
                get: sandbox.stub(),
                update: sandbox.stub().resolves(),
                keys: () => []
            },
            subscriptions: [],
            extensionPath: '',
            extensionUri: vscode.Uri.file(''),
            storageUri: vscode.Uri.file(''),
            globalStorageUri: vscode.Uri.file(''),
            logUri: vscode.Uri.file(''),
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            asAbsolutePath: (path: string) => path,
            environmentVariableCollection: {} as any,
            extensionMode: vscode.ExtensionMode.Test,
            secrets: {} as any,
            extension: {} as any,
            languageModelAccessInformation: {} as any
        } as unknown as vscode.ExtensionContext;

        storageService = new StorageService(context);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Create group', () => {
        const group = storageService.createGroup('Test Group', 'Test description');

        assert.strictEqual(group.name, 'Test Group');
        assert.strictEqual(group.description, 'Test description');
        assert.strictEqual(group.files.length, 0);
        assert.strictEqual(group.folders.length, 0);
        assert.ok(group.id);
        assert.ok(group.createdAt);
        assert.ok(group.updatedAt);
    });

    test('Create subgroup', () => {
        const parentGroup = storageService.createGroup('Parent Group');
        const subgroup = storageService.createGroup('Subgroup', 'Sub description', parentGroup.id);

        assert.strictEqual(subgroup.name, 'Subgroup');
        assert.strictEqual(subgroup.parentId, parentGroup.id);
    });

    test('Add file to group', () => {
        const group = storageService.createGroup('Test Group');
        const success = storageService.addFileToGroup(group.id, 'src/test.ts', 'Test File');

        assert.strictEqual(success, true);

        const updatedGroup = storageService.getGroup(group.id);
        assert.strictEqual(updatedGroup?.files.length, 1);
        assert.strictEqual(updatedGroup?.files[0].relativePath, 'src/test.ts');
        assert.strictEqual(updatedGroup?.files[0].label, 'Test File');
    });

    test('Add duplicate file to group should fail', () => {
        const group = storageService.createGroup('Test Group');
        storageService.addFileToGroup(group.id, 'src/test.ts');

        const success = storageService.addFileToGroup(group.id, 'src/test.ts');
        assert.strictEqual(success, false);

        const updatedGroup = storageService.getGroup(group.id);
        assert.strictEqual(updatedGroup?.files.length, 1);
    });

    test('Add folder to group', () => {
        const group = storageService.createGroup('Test Group');
        const success = storageService.addFolderToGroup(group.id, 'src/components', 'Components');

        assert.strictEqual(success, true);

        const updatedGroup = storageService.getGroup(group.id);
        assert.strictEqual(updatedGroup?.folders?.length, 1);
        assert.strictEqual(updatedGroup?.folders[0].relativePath, 'src/components');
        assert.strictEqual(updatedGroup?.folders[0].label, 'Components');
    });

    test('Remove file from group', () => {
        const group = storageService.createGroup('Test Group');
        storageService.addFileToGroup(group.id, 'src/test.ts');

        const updatedGroup = storageService.getGroup(group.id);
        const fileId = updatedGroup?.files[0].id;

        const success = storageService.removeFileFromGroup(group.id, fileId!);
        assert.strictEqual(success, true);

        const finalGroup = storageService.getGroup(group.id);
        assert.strictEqual(finalGroup?.files.length, 0);
    });

    test('Remove folder from group', () => {
        const group = storageService.createGroup('Test Group');
        storageService.addFolderToGroup(group.id, 'src/components');

        const updatedGroup = storageService.getGroup(group.id);
        const folderId = updatedGroup?.folders?.[0].id;

        const success = storageService.removeFolderFromGroup(group.id, folderId!);
        assert.strictEqual(success, true);

        const finalGroup = storageService.getGroup(group.id);
        assert.strictEqual(finalGroup?.folders?.length, 0);
    });

    test('Update group', () => {
        const group = storageService.createGroup('Original Name');
        const success = storageService.updateGroup(group.id, {
            name: 'Updated Name',
            description: 'Updated description'
        });

        assert.strictEqual(success, true);

        const updatedGroup = storageService.getGroup(group.id);
        assert.strictEqual(updatedGroup?.name, 'Updated Name');
        assert.strictEqual(updatedGroup?.description, 'Updated description');
    });

    test('Delete group', () => {
        const group = storageService.createGroup('Test Group');
        const success = storageService.deleteGroup(group.id);

        assert.strictEqual(success, true);

        const deletedGroup = storageService.getGroup(group.id);
        assert.strictEqual(deletedGroup, undefined);
    });

    test('Get all groups', () => {
        storageService.createGroup('Group 1');
        storageService.createGroup('Group 2');
        storageService.createGroup('Group 3');

        const groups = storageService.getAllGroups();
        assert.strictEqual(groups.length, 3);
    });

    test('Reorder items within group', () => {
        const group = storageService.createGroup('Test Group');
        storageService.addFileToGroup(group.id, 'file1.ts');
        storageService.addFileToGroup(group.id, 'file2.ts');
        storageService.addFileToGroup(group.id, 'file3.ts');

        const updatedGroup = storageService.getGroup(group.id);
        const secondFileId = updatedGroup?.files[1].id;

        // Move second file to first position
        const success = storageService.reorderItems(group.id, secondFileId!, 0, 'file');
        assert.strictEqual(success, true);

        const reorderedGroup = storageService.getGroup(group.id);
        assert.strictEqual(reorderedGroup?.files[0].relativePath, 'file2.ts');
        assert.strictEqual(reorderedGroup?.files[1].relativePath, 'file1.ts');
    });

    test('Move item between groups', () => {
        const group1 = storageService.createGroup('Group 1');
        const group2 = storageService.createGroup('Group 2');

        storageService.addFileToGroup(group1.id, 'test.ts');
        const fileId = storageService.getGroup(group1.id)?.files[0].id;

        const success = storageService.moveItemBetweenGroups(
            group1.id,
            group2.id,
            fileId!,
            'file'
        );

        assert.strictEqual(success, true);

        const updatedGroup1 = storageService.getGroup(group1.id);
        const updatedGroup2 = storageService.getGroup(group2.id);

        assert.strictEqual(updatedGroup1?.files.length, 0);
        assert.strictEqual(updatedGroup2?.files.length, 1);
        assert.strictEqual(updatedGroup2?.files[0].relativePath, 'test.ts');
    });

    test('Export and import data', () => {
        // Create some test data
        const group1 = storageService.createGroup('Export Test Group 1');
        const group2 = storageService.createGroup('Export Test Group 2');
        storageService.addFileToGroup(group1.id, 'file1.ts');
        storageService.addFileToGroup(group2.id, 'file2.ts');

        // Export data
        const exportedData = storageService.exportData();
        assert.ok(exportedData);

        const parsedData = JSON.parse(exportedData);
        assert.strictEqual(parsedData.groups.length, 2);
        assert.strictEqual(parsedData.version, '1.0.0');
    });

    test('Check if file exists in any group', () => {
        const group1 = storageService.createGroup('Group 1');
        const group2 = storageService.createGroup('Group 2');

        storageService.addFileToGroup(group1.id, 'shared.ts');
        storageService.addFileToGroup(group2.id, 'unique.ts');

        assert.strictEqual(storageService.isFileInAnyGroup('shared.ts'), true);
        assert.strictEqual(storageService.isFileInAnyGroup('unique.ts'), true);
        assert.strictEqual(storageService.isFileInAnyGroup('nonexistent.ts'), false);
    });

    test('Get groups containing file', () => {
        const group1 = storageService.createGroup('Group 1');
        const group2 = storageService.createGroup('Group 2');
        const group3 = storageService.createGroup('Group 3');

        storageService.addFileToGroup(group1.id, 'shared.ts');
        storageService.addFileToGroup(group2.id, 'shared.ts');
        storageService.addFileToGroup(group3.id, 'unique.ts');

        const groups = storageService.getGroupsContainingFile('shared.ts');
        assert.strictEqual(groups.length, 2);
        assert.ok(groups.some(g => g.id === group1.id));
        assert.ok(groups.some(g => g.id === group2.id));
        assert.ok(!groups.some(g => g.id === group3.id));
    });
});