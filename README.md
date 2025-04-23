# VS Code Copy Open Files & Directory Structure

Simple extension that provides two main functionalities:

1. Copies the contents of all currently open files in your VS Code window.
2. Copies the directory structure of a selected folder, respecting `.gitignore` rules.

Perfect for sharing code context or project structure with LLMs or colleagues.

## Installation

1. Download the `.vsix` file from the [latest release](https://github.com/rettend/vscode-copy-open-files/releases)
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Type "Install from VSIX" and select the command
4. Choose the downloaded `.vsix` file

## Features & Usage

### 1. Copy All Open Files

Copies the content of all unique, open files (excluding non-file tabs like settings).

**How to use:**

* Click the files icon (`$(files)`) in the status bar (bottom right).
* Use the keyboard shortcut:
  * Windows/Linux: `Ctrl+K Ctrl+C`
  * Mac: `Cmd+K Cmd+C`
* Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run "Copy All Open Files".

**Output Format:**

The extension copies the contents to your clipboard, prefixed by their relative path (if in a workspace) or full path:

```plaintext
--- src/file1.ts
content of file1...

--- components/button.tsx
content of button...

--- /abs/path/to/other/file.js
content of other file...

```

### 2. Copy Directory Structure

Copies a nicely formatted tree structure of a selected folder in the Explorer, automatically ignoring files and directories specified in relevant `.gitignore` files (including nested ones).

**How to use:**

* Right-click on a folder in the VS Code Explorer view.
* Select "Copy Directory Structure" from the context menu.

**Output Format:**

The directory structure is copied to your clipboard like this:

```plaintext
my-project/
├── src/
│   ├── index.ts
│   └── utils/
│       └── helpers.ts
├── components/
│   └── button.tsx
├── package.json
└── README.md
```
