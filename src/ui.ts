import type { FileTreeNode } from './types'
import * as path from 'node:path'
import * as vscode from 'vscode'

export function buildOpenFilesTree(fileUris: vscode.Uri[], currentWorkspaceFolder?: vscode.WorkspaceFolder): string {
  function formatNodesRecursive(currentNode: FileTreeNode, currentIndent: string): string {
    let str = ''
    const keys = Object.keys(currentNode).sort((a, b) => {
      const aIsDir = currentNode[a] !== null
      const bIsDir = currentNode[b] !== null
      if (aIsDir && !bIsDir) {
        return -1
      }
      if (!aIsDir && bIsDir) {
        return 1
      }
      return a.localeCompare(b)
    })

    keys.forEach((key, index) => {
      const isLast = index === keys.length - 1
      const connector = isLast ? '└── ' : '├── '
      const isDir = currentNode[key] !== null

      str += `${currentIndent}${connector}${key}${isDir ? '/' : ''}\n`
      if (isDir) {
        str += formatNodesRecursive(currentNode[key] as FileTreeNode, `${currentIndent}${isLast ? '    ' : '│   '}`)
      }
    })
    return str
  }

  function buildTreeForPathsList(pathsList: string[], rootDisplayName?: string): string {
    if (pathsList.length === 0) {
      return ''
    }
    const localTree: FileTreeNode = {}
    pathsList.forEach((p) => {
      const parts = p.replace(/\\/g, '/').split('/')
      let currentLevel = localTree
      parts.forEach((part, index) => {
        if (part === '' && index === 0 && parts.length > 1 && parts[0] === '') {
          return
        }
        if (part === '' && index > 0 && parts.length > 1) {
          return
        }

        const isFile = index === parts.length - 1
        if (!currentLevel[part]) {
          currentLevel[part] = isFile ? null : {}
        }
        if (!isFile) {
          currentLevel = currentLevel[part] as FileTreeNode
        }
      })
    })

    let treeStr = rootDisplayName ? `${rootDisplayName}/\n` : ''
    treeStr += formatNodesRecursive(localTree, '')
    return treeStr
  }

  let overallStructureString = ''
  const workspaceFilePaths: string[] = []
  const nonWorkspaceFilePaths: string[] = []

  if (currentWorkspaceFolder) {
    fileUris.forEach((uri) => {
      if (uri.fsPath.startsWith(currentWorkspaceFolder.uri.fsPath)) {
        workspaceFilePaths.push(path.relative(currentWorkspaceFolder.uri.fsPath, uri.fsPath))
      }
      else {
        nonWorkspaceFilePaths.push(uri.fsPath)
      }
    })
  }
  else {
    fileUris.forEach(uri => nonWorkspaceFilePaths.push(uri.fsPath))
  }

  if (workspaceFilePaths.length > 0 && currentWorkspaceFolder) {
    overallStructureString += buildTreeForPathsList(workspaceFilePaths, path.basename(currentWorkspaceFolder.uri.fsPath))
  }

  if (nonWorkspaceFilePaths.length > 0) {
    if (overallStructureString.length > 0 && !overallStructureString.endsWith('\n\n') && !overallStructureString.endsWith('\n')) {
      overallStructureString += '\n'
    }
    else if (overallStructureString.length > 0 && !overallStructureString.endsWith('\n\n')) {
      overallStructureString += '\n'
    }
    overallStructureString += buildTreeForPathsList(nonWorkspaceFilePaths)
  }

  return overallStructureString
}

export async function copyOpenFilesHelper(copyContent: boolean, copyStructure: boolean): Promise<void> {
  const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs)
  const uniqueFileUris = new Set<string>()
  tabs.forEach((tab) => {
    if (tab.input instanceof vscode.TabInputText && tab.input.uri.scheme === 'file') {
      uniqueFileUris.add(tab.input.uri.toString())
    }
  })
  const fileUris = Array.from(uniqueFileUris).map(uriStr => vscode.Uri.parse(uriStr))
  if (fileUris.length === 0) {
    vscode.window.showWarningMessage('No open files found to copy.')
    return
  }
  let output = ''
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]

  if (copyStructure) {
    const structureString = buildOpenFilesTree(fileUris, workspaceFolder)
    if (structureString) {
      output += structureString
      if (copyContent && structureString.length > 0 && !structureString.endsWith('\n')) {
        output += '\n'
      }
      if (copyContent && structureString.length > 0 && !structureString.endsWith('\n\n') && structureString.endsWith('\n')) {
        output += '\n'
      }
    }
  }
  if (copyContent) {
    for (const uri of fileUris) {
      const document = await vscode.workspace.openTextDocument(uri)
      const content = document.getText()
      let displayPath = uri.fsPath
      if (workspaceFolder && uri.fsPath.startsWith(workspaceFolder.uri.fsPath)) {
        displayPath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath)
      }
      displayPath = displayPath.replace(/\\/g, '/')
      output += `--- ${displayPath}\n${content}\n\n`
    }
  }
  if (output.trim()) {
    await vscode.env.clipboard.writeText(output.trimEnd())
    vscode.window.showInformationMessage('Selected open file information copied to clipboard.')
  }
  else {
    vscode.window.showInformationMessage('Nothing to copy based on selected options.')
  }
}

export async function showCopyOptionsPanel(
  context: vscode.ExtensionContext,
  activeItemId?: 'toggleContent' | 'toggleStructure' | 'copyAndClose',
): Promise<void> {
  const currentCopyContent = context.globalState.get<boolean>('vscode-copy-open-files.copyContent', true)
  const currentCopyStructure = context.globalState.get<boolean>('vscode-copy-open-files.copyStructure', true)

  const qp = vscode.window.createQuickPick()
  qp.title = 'Configure & Copy Open Files'
  const items = [
    {
      label: '$(clippy) Copy & Close',
      description: `Content: ${currentCopyContent ? 'ON' : 'OFF'}, Structure: ${currentCopyStructure ? 'ON' : 'OFF'}`,
      id: 'copyAndClose',
    },
    {
      label: `${currentCopyContent ? '$(check)' : '$(circle-slash)'} Copy Content`,
      description: currentCopyContent ? 'Toggle to OFF' : 'Toggle to ON',
      id: 'toggleContent',
    },
    {
      label: `${currentCopyStructure ? '$(check)' : '$(circle-slash)'} Copy Structure`,
      description: currentCopyStructure ? 'Toggle to OFF' : 'Toggle to ON',
      id: 'toggleStructure',
    },
  ]
  qp.items = items

  if (activeItemId) {
    const activeItem = items.find(item => item.id === activeItemId)
    if (activeItem) {
      qp.activeItems = [activeItem as any]
    }
  }

  qp.onDidChangeSelection(async (selection) => {
    if (selection[0]) {
      const selectedItem = selection[0] as any

      if (selectedItem.id === 'toggleContent') {
        qp.hide()
        const newCopyContent = !currentCopyContent
        await context.globalState.update('vscode-copy-open-files.copyContent', newCopyContent)
        showCopyOptionsPanel(context, 'toggleContent')
      }
      else if (selectedItem.id === 'toggleStructure') {
        qp.hide()
        const newCopyStructure = !currentCopyStructure
        await context.globalState.update('vscode-copy-open-files.copyStructure', newCopyStructure)
        showCopyOptionsPanel(context, 'toggleStructure')
      }
      else if (selectedItem.id === 'copyAndClose') {
        qp.hide()
        await copyOpenFilesHelper(currentCopyContent, currentCopyStructure)
      }
    }
  })

  qp.onDidHide(() => {
    qp.dispose()
  })
  qp.show()
}
