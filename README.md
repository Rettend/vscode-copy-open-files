# VS Code Copy Open Files & Directory Structure

Simple extension that provides two main functionalities:

1. Copies the contents and/or directory structure of all currently open files in your VS Code window.
2. Copies the directory structure of a selected folder, respecting `.gitignore` rules.

Perfect for sharing code context or project structure with LLMs or colleagues.

## Installation

1. Download the `.vsix` file from the [latest release](https://github.com/rettend/vscode-copy-open-files/releases)
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Type "Install from VSIX" and select the command
4. Choose the downloaded `.vsix` file

## Features & Usage

### 1. Copy Information for All Open Files

This feature allows you to copy the content, the directory structure, or both, for all unique, open files (excluding non-file tabs like settings).

**How to use:**

* **Configure and Copy via Status Bar:**
  * Click the files icon in the status bar (bottom right). This will open a QuickPick menu.
  * The first item, "Copy & Close", immediately copies using the current settings (shown in its description) and closes the menu. You can select this by pressing `Enter`.
  * The other items allow you to toggle "Copy Content" and "Copy Structure" ON or OFF. Selecting one of these will update the setting and refresh the menu, keeping the selected toggle option active.
  * Your choices are saved for future use.
* **Direct Copy (using last saved configuration):**
  * Use the keyboard shortcut:
    * Windows/Linux: `Ctrl+K Ctrl+C`
    * Mac: `Cmd+K Cmd+C`
  * Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run "Copy All Open Files". This will use the settings last configured via the status bar QuickPick menu.

**Output Format:**

The extension copies the information to your clipboard.

* If **Copy Structure** is enabled, the directory structure of the open files is copied first:

    ```plaintext
    my-project/
    ├── src/
    │   └── file1.ts
    └── components/
        └── button.tsx
    other-file.js
    ```

* If **Copy Content** is enabled, the contents of the files are copied, prefixed by their relative path (if in a workspace) or full path. If structure was also copied, this will appear after the structure.

    ```plaintext
    --- src/file1.ts
    content of file1...

    --- components/button.tsx
    content of button...

    --- /abs/path/to/other/file.js
    content of other file...
    ```

* If **both** are enabled, the structure appears first, followed by a blank line, then the content of each file.

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
