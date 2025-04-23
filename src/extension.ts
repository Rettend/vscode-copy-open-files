import type { Ignore } from 'ignore'
import * as path from 'node:path'
import ignore from 'ignore'
import * as vscode from 'vscode'

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
  statusBarItem.command = 'vscode-copy-open-files.copyAllOpenFiles'
  statusBarItem.text = '$(files)'
  statusBarItem.tooltip = 'Copy contents of all open files'
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  const copyAllDisposable = vscode.commands.registerCommand('vscode-copy-open-files.copyAllOpenFiles', async () => {
    const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs)
    const uniqueFileEditors = new Set(
      tabs
        .filter(tab => tab.input instanceof vscode.TabInputText)
        .map(tab => (tab.input as vscode.TabInputText).uri)
        .filter(uri => uri.scheme === 'file')
        .map(uri => uri.toString(),
        ),
    )

    const fileEditors = Array.from(uniqueFileEditors).map(uriStr => vscode.Uri.parse(uriStr))

    if (!fileEditors.length) {
      return vscode.window.showWarningMessage('No open files found.')
    }

    let output = ''
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

    for (const uri of fileEditors) {
      const document = await vscode.workspace.openTextDocument(uri)
      const fileName = document.fileName
      const content = document.getText()

      let displayPath = fileName
      if (workspaceFolder && fileName.startsWith(workspaceFolder)) {
        displayPath = path.relative(workspaceFolder, fileName)
      }

      output += `--- ${displayPath}\n${content}\n\n`
    }

    try {
      await vscode.env.clipboard.writeText(output)
    }
    catch (err) {
      vscode.window.showErrorMessage(`Error copying to clipboard: ${err}`)
    }
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

export function deactivate() {
}
