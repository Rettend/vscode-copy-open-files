import * as path from 'node:path'
import * as vscode from 'vscode'
import { buildOpenFilesTree } from './utils'

function _getOpenUniqueFileUris(): vscode.Uri[] {
  const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs)
  const uniqueFileUris = new Set<string>()
  tabs.forEach((tab) => {
    if (tab.input instanceof vscode.TabInputText && tab.input.uri.scheme === 'file') {
      uniqueFileUris.add(tab.input.uri.toString())
    }
  })
  return Array.from(uniqueFileUris).map(uriStr => vscode.Uri.parse(uriStr))
}

async function _formatFileContents(fileUris: vscode.Uri[], workspaceFolder?: vscode.WorkspaceFolder): Promise<string> {
  let contentOutput = ''
  for (const uri of fileUris) {
    const document = await vscode.workspace.openTextDocument(uri)
    const content = document.getText()
    let displayPath = uri.fsPath
    if (workspaceFolder && uri.fsPath.startsWith(workspaceFolder.uri.fsPath)) {
      displayPath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath)
    }
    displayPath = displayPath.replace(/\\/g, '/')
    contentOutput += `--- ${displayPath}\n${content}\n\n`
  }
  return contentOutput
}

export async function copyOpenFilesHelper(copyContent: boolean, copyStructure: boolean): Promise<void> {
  const fileUris = _getOpenUniqueFileUris()

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
    output += await _formatFileContents(fileUris, workspaceFolder)
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
