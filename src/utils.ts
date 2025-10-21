import type { Ignore } from 'ignore'
import type { FileTreeNode } from './types'
import * as path from 'node:path'
import ignore from 'ignore'
import * as vscode from 'vscode'

export async function findGitignore(startDirUri: vscode.Uri): Promise<vscode.Uri | null> {
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

export async function loadIgnoreRules(gitignoreUri: vscode.Uri | null): Promise<Ignore> {
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

async function _getFilteredAndSortedEntries(
  dirUri: vscode.Uri,
  rootFolderUri: vscode.Uri,
  ig: Ignore,
): Promise<[string, vscode.FileType][]> {
  const entries = await vscode.workspace.fs.readDirectory(dirUri)

  const filteredEntries = entries.filter(([name, type]) => {
    const relativePath = path.relative(rootFolderUri.fsPath, vscode.Uri.joinPath(dirUri, name).fsPath).replace(/\\/g, '/')
    const shouldIgnore = ig.ignores(relativePath) || ig.ignores(`${relativePath}${type === vscode.FileType.Directory ? '/' : ''}`)
    return !shouldIgnore
  })

  filteredEntries.sort((a, b) => {
    if (a[1] === vscode.FileType.Directory && b[1] !== vscode.FileType.Directory)
      return -1
    if (a[1] !== vscode.FileType.Directory && b[1] === vscode.FileType.Directory)
      return 1
    return a[0].localeCompare(b[0])
  })

  return filteredEntries
}

export async function buildDirectoryStructure(
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
    const localIgRules = await vscode.workspace.fs.readFile(localGitignoreUri)
    const localIgContent = new TextDecoder().decode(localIgRules)
    const localIgInstance = ignore().add(localIgContent)
    currentIg = ignore().add(ig).add(localIgInstance)
  }
  catch {
  }

  try {
    const filteredEntries = await _getFilteredAndSortedEntries(dirUri, rootFolderUri, currentIg)

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

interface CategorizedPaths {
  workspaceFilePaths: string[]
  nonWorkspaceFilePaths: string[]
}

function _categorizeFileUris(fileUris: vscode.Uri[], currentWorkspaceFolder?: vscode.WorkspaceFolder): CategorizedPaths {
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
  return { workspaceFilePaths, nonWorkspaceFilePaths }
}

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
  const { workspaceFilePaths, nonWorkspaceFilePaths } = _categorizeFileUris(fileUris, currentWorkspaceFolder)

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
