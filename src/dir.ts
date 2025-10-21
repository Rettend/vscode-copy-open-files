import * as path from 'node:path'
import * as vscode from 'vscode'
import { buildDirectoryStructure, findGitignore, loadIgnoreRules } from './utils'

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
