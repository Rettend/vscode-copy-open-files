# VS Code Copy Open Files

Simple extension that copies the contents of all currently open files in your VS Code window.
Perfect for sharing code context with LLMs.

## Installation

1. Download the `.vsix` file from the [latest release](https://github.com/rettend/vscode-copy-open-files/releases)
2. In VS Code, open the Command Palette (Ctrl+Shift+P)
3. Type "Install from VSIX" and select the command
4. Choose the downloaded `.vsix` file

## Usage

You can copy all open files in three ways:

1. Click the files icon (📄) down in the status bar
2. Use the keyboard shortcut:
   - Windows/Linux: `Ctrl+K Ctrl+C`
   - Mac: `Cmd+K Cmd+C`
3. Open the Command Palette and run "Copy All Open Files"

The extension will copy the contents of all open files to your clipboard, with each file prefixed by its path:

```txt
>>> src/file1.ts
content of file1...

>>> src/file2.ts
content of file2...
```
