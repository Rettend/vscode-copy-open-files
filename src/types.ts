import type * as vscode from 'vscode'

export interface FileTreeNode {
  [key: string]: FileTreeNode | null
}

export interface ConfigQuickPickItem extends vscode.QuickPickItem {
  id: 'toggleContent' | 'toggleStructure' | 'copyAndClose' | 'importFromInput' | 'copyImportList'
}
