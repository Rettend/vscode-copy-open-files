import type { ConfigQuickPickItem } from './types'
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

function _allUnderSingleWorkspace(fileUris: vscode.Uri[], workspaceFolder?: vscode.WorkspaceFolder): boolean {
  if (!workspaceFolder || fileUris.length === 0)
    return false
  return fileUris.every(uri => uri.fsPath.startsWith(workspaceFolder.uri.fsPath))
}

function _toForwardSlashPath(p: string): string {
  return p.replace(/\\/g, '/')
}

export function buildImportListLine(fileUris: vscode.Uri[], workspaceFolder?: vscode.WorkspaceFolder): string {
  const unique = Array.from(new Set(fileUris.map(u => u.toString()))).map(s => vscode.Uri.parse(s))
  const underSingle = _allUnderSingleWorkspace(unique, workspaceFolder)

  if (underSingle && workspaceFolder) {
    const rels = unique
      .map(u => _toForwardSlashPath(path.relative(workspaceFolder.uri.fsPath, u.fsPath)))
    return `root:${workspaceFolder.name}\t${rels.join('\t')}`
  }

  const abss = unique.map(u => u.fsPath)
  return abss.join('\t')
}

export async function copyImportListForOpenFiles(): Promise<void> {
  const fileUris = _getOpenUniqueFileUris()
  if (fileUris.length === 0) {
    vscode.window.showWarningMessage('No open files found to copy.')
    return
  }
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  const line = buildImportListLine(fileUris, workspaceFolder)
  await vscode.env.clipboard.writeText(line)
  vscode.window.showInformationMessage('Import List copied to clipboard.')
}

function parseImportList(text: string): { rootName?: string, paths: string[] } {
  const trimmed = text.trim()
  if (!trimmed)
    return { paths: [] }

  const hasTab = /\t/.test(trimmed)
  const tokens = hasTab ? trimmed.split(/\t+/) : trimmed.split(/\s{2,}/)
  const parts = tokens.map(t => t.trim()).filter(Boolean)
  if (parts.length === 0)
    return { paths: [] }

  let rootName: string | undefined
  if (parts[0].toLowerCase().startsWith('root:')) {
    rootName = parts[0].slice(5).trim()
    parts.shift()
  }
  return { rootName, paths: parts }
}

async function importFromImportList(text: string): Promise<void> {
  const { rootName, paths } = parseImportList(text)
  if (paths.length === 0) {
    vscode.window.showWarningMessage('No files found in the pasted Import List.')
    return
  }

  const workspaceFolders = vscode.workspace.workspaceFolders ?? []
  const resolveWorkspaceFolder = (name: string | undefined): vscode.WorkspaceFolder | undefined => {
    if (!name)
      return undefined
    return workspaceFolders.find(wf => wf && wf.name === name)
  }

  const uris: vscode.Uri[] = []
  for (const raw of paths) {
    try {
      let targetFsPath: string | undefined
      if (rootName) {
        const wf = resolveWorkspaceFolder(rootName)
        if (!wf)
          continue
        const rel = raw.replace(/\\/g, '/').replace(/\//g, path.sep)
        targetFsPath = path.join(wf.uri.fsPath, rel)
      }
      else {
        targetFsPath = raw
      }
      if (!targetFsPath)
        continue
      const uri = vscode.Uri.file(targetFsPath)
      try {
        const stat = await vscode.workspace.fs.stat(uri)
        if (stat.type === vscode.FileType.File)
          uris.push(uri)
      }
      catch {}
    }
    catch {}
  }

  if (uris.length === 0) {
    vscode.window.showInformationMessage('No existing files found to open from the Import List.')
    return
  }

  const activeEditor = vscode.window.activeTextEditor
  let opened = 0
  for (const uri of uris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri)
      await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true })
      opened++
    }
    catch {}
  }
  if (activeEditor) {
    try {
      await vscode.window.showTextDocument(activeEditor.document, { preview: false, preserveFocus: true })
    }
    catch {}
  }
  vscode.window.showInformationMessage(`Opened ${opened} file(s) from Import List${opened < paths.length ? ' (some were missing and skipped)' : ''}.`)
}

export async function showCopyOptionsPanel(
  context: vscode.ExtensionContext,
  activeItemId?: 'toggleContent' | 'toggleStructure' | 'copyAndClose',
): Promise<void> {
  const currentCopyContent = context.globalState.get<boolean>('vscode-copy-open-files.copyContent', true)
  const currentCopyStructure = context.globalState.get<boolean>('vscode-copy-open-files.copyStructure', true)

  const qp = vscode.window.createQuickPick<ConfigQuickPickItem>()
  qp.title = 'Configure & Copy Open Files'
  qp.placeholder = 'Paste a tree here and press Enter to import, or configure copy options'
  qp.matchOnDescription = true
  qp.matchOnDetail = true
  const makeConfigItems = (): ConfigQuickPickItem[] => ([
    {
      label: '$(clippy) Copy & Close',
      description: `Content: ${currentCopyContent ? 'ON' : 'OFF'}, Structure: ${currentCopyStructure ? 'ON' : 'OFF'}`,
      id: 'copyAndClose',
    },
    {
      label: '$(clippy) Copy Import List',
      description: 'Copy open files to import them later',
      id: 'copyImportList',
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
  ])
  qp.items = makeConfigItems()

  if (activeItemId) {
    const activeItem = qp.items.find(item => item.id === activeItemId)
    if (activeItem) {
      qp.activeItems = [activeItem]
    }
  }

  qp.onDidChangeSelection(async (selection) => {
    if (selection[0]) {
      const selectedItem = selection[0]

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
      else if (selectedItem.id === 'copyImportList') {
        qp.hide()
        await copyImportListForOpenFiles()
      }
      else if (selectedItem.id === 'importFromInput') {
        qp.hide()
        await importFromImportList(qp.value)
      }
      else if (selectedItem.id === 'copyAndClose') {
        qp.hide()
        await copyOpenFilesHelper(currentCopyContent, currentCopyStructure)
      }
    }
  })

  qp.onDidAccept(async () => {
    const trimmed = qp.value.trim()
    if (trimmed.length > 0) {
      qp.hide()
      await importFromImportList(qp.value)
    }
  })

  qp.onDidChangeValue((val) => {
    const trimmed = val.trim()
    if (trimmed.length > 0) {
      const importItem: ConfigQuickPickItem = {
        label: '$(clippy) Import from input',
        description: 'Paste Import List, then press Enter',
        detail: val,
        id: 'importFromInput',
      }
      qp.items = [importItem]
      qp.activeItems = [importItem]
    }
    else {
      qp.items = makeConfigItems()
    }
  })

  qp.onDidHide(() => {
    qp.dispose()
  })
  qp.show()
}

export async function importOpenFilesFromClipboard(): Promise<void> {
  try {
    const clipboardText = await vscode.env.clipboard.readText()
    if (!clipboardText || !clipboardText.trim()) {
      vscode.window.showWarningMessage('Clipboard is empty or has no Import List to import.')
      return
    }
    await importFromImportList(clipboardText)
  }
  catch (err) {
    vscode.window.showErrorMessage(`Failed to import from clipboard: ${err}`)
  }
}
