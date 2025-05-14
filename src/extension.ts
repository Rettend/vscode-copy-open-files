import type { Ignore } from 'ignore'
import * as path from 'node:path'
import ignore from 'ignore'
import * as vscode from 'vscode'

interface FileTreeNode { [key: string]: FileTreeNode | null }

// Helper function to build and format the tree structure for open files
function buildOpenFilesTree(fileUris: vscode.Uri[], currentWorkspaceFolder?: vscode.WorkspaceFolder): string {
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

// Add helper to copy open files based on selected options
async function copyOpenFilesHelper(copyContent: boolean, copyStructure: boolean) {
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

// Show the QuickPick dropdown for copy options
async function showCopyOptionsPanel(context: vscode.ExtensionContext, activeItemId?: 'toggleContent' | 'toggleStructure' | 'copyAndClose') {
  interface ConfigQuickPickItem extends vscode.QuickPickItem {
    id: 'toggleContent' | 'toggleStructure' | 'copyAndClose'
  }

  const currentCopyContent = context.globalState.get<boolean>('vscode-copy-open-files.copyContent', true)
  const currentCopyStructure = context.globalState.get<boolean>('vscode-copy-open-files.copyStructure', true)

  const qp = vscode.window.createQuickPick<ConfigQuickPickItem>()
  qp.title = 'Configure & Copy Open Files'
  const items: ConfigQuickPickItem[] = [
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
      qp.activeItems = [activeItem]
    }
  }

  qp.onDidChangeSelection(async (selection) => {
    if (selection[0]) {
      const selectedItem = selection[0]
      // For toggle actions, we don't hide immediately, but re-show with the item active.
      // For copyAndClose, we hide.

      if (selectedItem.id === 'toggleContent') {
        qp.hide() // Hide current picker before showing the new one
        const newCopyContent = !currentCopyContent
        await context.globalState.update('vscode-copy-open-files.copyContent', newCopyContent)
        showCopyOptionsPanel(context, 'toggleContent') // Recursive call to refresh, pass active item ID
      }
      else if (selectedItem.id === 'toggleStructure') {
        qp.hide() // Hide current picker before showing the new one
        const newCopyStructure = !currentCopyStructure
        await context.globalState.update('vscode-copy-open-files.copyStructure', newCopyStructure)
        showCopyOptionsPanel(context, 'toggleStructure') // Recursive call to refresh, pass active item ID
      }
      else if (selectedItem.id === 'copyAndClose') {
        qp.hide() // Hide picker
        await copyOpenFilesHelper(currentCopyContent, currentCopyStructure)
      }
    }
  })

  qp.onDidHide(() => {
    qp.dispose()
  })
  qp.show()
}

async function findGitignore(startDirUri: vscode.Uri): Promise<vscode.Uri | null> {
  let currentUri = startDirUri
  while (true) {
    const gitignoreUri = vscode.Uri.joinPath(currentUri, '.gitignore')
    try {
      await vscode.workspace.fs.stat(gitignoreUri)
      return gitignoreUri
    }
    catch {
      const parentUri = vscode.Uri.joinPath(currentUri, '..')
      if (parentUri.fsPath === currentUri.fsPath) {
        return null
      }
      currentUri = parentUri
    }
  }
}

async function loadIgnoreRules(gitignoreUri: vscode.Uri | null): Promise<Ignore> {
  const ig = ignore()
  if (gitignoreUri) {
    try {
      const contentBytes = await vscode.workspace.fs.readFile(gitignoreUri)
      const content = new TextDecoder().decode(contentBytes)
      ig.add(content)
    }
    catch (err) {
      console.warn(`Error reading gitignore file ${gitignoreUri.fsPath}: ${err}`)
    }
  }
  ig.add('.git')
  return ig
}

async function buildDirectoryStructure(
  dirUri: vscode.Uri,
  rootFolderUri: vscode.Uri,
  ig: Ignore,
  prefix = '',
): Promise<string> {
  let structure = ''
  let currentIg = ig
  const localGitignoreUri = vscode.Uri.joinPath(dirUri, '.gitignore')

  try {
    await vscode.workspace.fs.stat(localGitignoreUri)
    const localIg = await loadIgnoreRules(localGitignoreUri)
    currentIg = ignore().add(ig).add(localIg)
  }
  catch {
  }

  try {
    const entries = await vscode.workspace.fs.readDirectory(dirUri)

    const filteredEntries = entries.filter(([name, type]) => {
      const relativePath = path.relative(rootFolderUri.fsPath, vscode.Uri.joinPath(dirUri, name).fsPath).replace(/\\/g, '/')
      const shouldIgnore = currentIg.ignores(relativePath) || currentIg.ignores(`${relativePath}${type === vscode.FileType.Directory ? '/' : ''}`)

      return !shouldIgnore
    })

    filteredEntries.sort((a, b) => {
      if (a[1] === vscode.FileType.Directory && b[1] !== vscode.FileType.Directory)
        return -1
      if (a[1] !== vscode.FileType.Directory && b[1] === vscode.FileType.Directory)
        return 1
      return a[0].localeCompare(b[0])
    })

    for (let i = 0; i < filteredEntries.length; i++) {
      const [name, type] = filteredEntries[i]
      const isLast = i === filteredEntries.length - 1
      const connector = isLast ? '└── ' : '├── '
      const newPrefix = prefix + (isLast ? '    ' : '│   ')

      structure += `${prefix}${connector}${name}${type === vscode.FileType.Directory ? '/' : ''}\n`

      if (type === vscode.FileType.Directory) {
        const subDirUri = vscode.Uri.joinPath(dirUri, name)
        structure += await buildDirectoryStructure(subDirUri, rootFolderUri, currentIg, newPrefix)
      }
    }
  }
  catch (err) {
    vscode.window.showErrorMessage(`Error reading directory ${dirUri.fsPath}: ${err}`)
    return `${prefix}└── ERROR reading directory\n`
  }
  return structure
}

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.command = 'vscode-copy-open-files.showCopyOptionsPanel'
  statusBarItem.text = '$(files)'
  statusBarItem.tooltip = 'Configure & Copy Open Files...'
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  const showPanelDisposable = vscode.commands.registerCommand('vscode-copy-open-files.showCopyOptionsPanel', () => {
    showCopyOptionsPanel(context) // Initial call doesn't specify an active item
  })
  context.subscriptions.push(showPanelDisposable)

  const copyAllDisposable = vscode.commands.registerCommand('vscode-copy-open-files.copyAllOpenFiles', async () => {
    const copyContent = context.globalState.get<boolean>('vscode-copy-open-files.copyContent', true)
    const copyStructure = context.globalState.get<boolean>('vscode-copy-open-files.copyStructure', true)
    await copyOpenFilesHelper(copyContent, copyStructure)
  })
  context.subscriptions.push(copyAllDisposable)

  const copyStructureDisposable = vscode.commands.registerCommand('vscode-copy-open-files.copyDirectoryStructure', async (folderUri?: vscode.Uri) => {
    if (!folderUri) {
      if (vscode.window.activeTextEditor?.document.uri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)
        if (workspaceFolder)
          folderUri = workspaceFolder.uri
      }

      if (!folderUri)
        return vscode.window.showErrorMessage('Could not determine the target folder. Please right-click on a folder in the Explorer.')
    }

    try {
      const stat = await vscode.workspace.fs.stat(folderUri)
      if (stat.type !== vscode.FileType.Directory)
        return vscode.window.showErrorMessage('Selected resource is not a folder.')
    }
    catch (err) {
      return vscode.window.showErrorMessage(`Error accessing folder: ${err}`)
    }

    const folderName = path.basename(folderUri.fsPath)
    let output = `${folderName}/\n`

    try {
      const rootGitignoreUri = await findGitignore(folderUri)
      const initialIg = await loadIgnoreRules(rootGitignoreUri)

      output += await buildDirectoryStructure(folderUri, folderUri, initialIg)
      await vscode.env.clipboard.writeText(output.trim())
      vscode.window.showInformationMessage(`Directory structure of "${folderName}" copied to clipboard.`)
    }
    catch (err) {
      vscode.window.showErrorMessage(`Error copying directory structure: ${err}`)
    }
  })
  context.subscriptions.push(copyStructureDisposable)
}

export function deactivate() {}
