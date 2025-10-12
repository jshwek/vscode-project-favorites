export interface FileItem {
    id: string;
    relativePath: string;  // Relative path from workspace root
    label?: string;        // Optional custom label for display
    addedAt: number;       // Timestamp when added
    sortIndex?: number;    // For manual ordering
}

export interface FolderItem {
    id: string;
    relativePath: string;  // Relative path from workspace root
    label?: string;        // Optional custom label for display
    addedAt: number;       // Timestamp when added
    expanded?: boolean;    // Whether the folder is expanded in the tree
    sortIndex?: number;    // For manual ordering
}

export interface ProjectGroup {
    id: string;
    name: string;
    files: FileItem[];
    folders: FolderItem[];  // Support for folders
    subgroups?: ProjectGroup[];  // Support for nested groups
    parentId?: string;     // Parent group ID for nested groups
    createdAt: number;
    updatedAt: number;
    color?: string;        // Optional color for visual distinction
    description?: string;  // Optional description for the group
    sortIndex?: number;    // For manual ordering
    isExpanded?: boolean;  // Whether the group is expanded in the tree
    position?: number;     // Runtime position in the list (not persisted)
    totalCount?: number;   // Runtime total count (not persisted)
}

export interface FavoritesData {
    version: string;
    groups: ProjectGroup[];
}

export enum SortOrder {
    Alphabetical = 'alphabetical',
    Custom = 'custom',
    Recent = 'recent',
    DateCreated = 'dateCreated'
}

export enum StorageLocation {
    Workspace = 'workspace',
    Global = 'global'
}

export interface TreeNode {
    type: 'group' | 'file' | 'folder' | 'subgroup';
    group?: ProjectGroup;
    file?: FileItem;
    folder?: FolderItem;
    groupId?: string;
    canMove?: boolean;  // For drag and drop support
}