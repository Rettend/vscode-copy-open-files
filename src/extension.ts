import * as vscode from 'vscode'
import { copyDirectoryStructure } from './dir'
import { copyOpenFilesHelper, showCopyOptionsPanel } from './ui'

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.command = 'vscode-copy-open-files.showCopyOptionsPanel'
  statusBarItem.text = '$(files)'
  statusBarItem.tooltip = 'Configure & Copy Open Files...'
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  const showPanelDisposable = vscode.commands.registerCommand('vscode-copy-open-files.showCopyOptionsPanel', () => {
    showCopyOptionsPanel(context)
  })
  context.subscriptions.push(showPanelDisposable)

  const copyAllDisposable = vscode.commands.registerCommand('vscode-copy-open-files.copyAllOpenFiles', async () => {
    const copyContent = context.globalState.get<boolean>('vscode-copy-open-files.copyContent', true)
    const copyStructure = context.globalState.get<boolean>('vscode-copy-open-files.copyStructure', true)
    await copyOpenFilesHelper(copyContent, copyStructure)
  })
  context.subscriptions.push(copyAllDisposable)

  const copyStructureDisposable = vscode.commands.registerCommand('vscode-copy-open-files.copyDirectoryStructure', async (folderUri?: vscode.Uri) => {
    await copyDirectoryStructure(folderUri)
  })
  context.subscriptions.push(copyStructureDisposable)
}

export function deactivate() {}
