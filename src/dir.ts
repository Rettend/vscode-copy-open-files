import type { Ignore } from 'ignore'
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
    const localIg = await loadIgnoreRules(localGitignoreUri)
    currentIg = ignore().add(ig).add(localIg)
  }
  catch {
    // No local .gitignore found, continue with parent rules
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

export async function copyDirectoryStructure(folderUri: vscode.Uri | undefined): Promise<void> {
  if (!folderUri) {
    if (vscode.window.activeTextEditor?.document.uri) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)
      if (workspaceFolder)
        folderUri = workspaceFolder.uri
    }

    if (!folderUri) {
      vscode.window.showErrorMessage('Could not determine the target folder. Please right-click on a folder in the Explorer.')
      return
    }
  }

  try {
    const stat = await vscode.workspace.fs.stat(folderUri)
    if (stat.type !== vscode.FileType.Directory) {
      vscode.window.showErrorMessage('Selected resource is not a folder.')
      return
    }
  }
  catch (err) {
    vscode.window.showErrorMessage(`Error accessing folder: ${err}`)
    return
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
}
