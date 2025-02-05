import * as path from 'node:path'
import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.command = 'vscode-copy-open-files.copyAllOpenFiles'
  statusBarItem.text = '$(files)'
  statusBarItem.tooltip = 'Copy contents of all open files'
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  const disposable = vscode.commands.registerCommand('vscode-copy-open-files.copyAllOpenFiles', async () => {
    const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs)

    const uniqueFileEditors = new Set(
      tabs
        .filter(tab => tab.input instanceof vscode.TabInputText)
        .map(tab => (tab.input as vscode.TabInputText).uri)
        .filter(uri => uri.scheme === 'file')
        .map(uri => uri.toString()),
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

      output += `>>> ${displayPath}\n${content}\n\n`
    }

    try {
      await vscode.env.clipboard.writeText(output)
    }
    catch (err) {
      vscode.window.showErrorMessage(`Error copying to clipboard: ${err}`)
    }
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {
}
