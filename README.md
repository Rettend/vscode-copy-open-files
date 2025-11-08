# VS Code Copy Open Files & Directory Structure

Simple extension that provides two main functionalities:

1. Copies the contents and/or directory structure of all currently open files in your VS Code window.
2. Copies the directory structure of a selected folder, respecting `.gitignore` rules.
3. Imports and opens files from a pasted Import List.

Perfect for sharing code context or project structure with LLMs or colleagues.

## Installation

1. Download the `.vsix` file from the [latest release](https://github.com/rettend/vscode-copy-open-files/releases)
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`), choose "Extensions: Install from VSIX..."
3. Select the downloaded `.vsix` file

## Features & Usage

### 1. Copy Information for All Open Files

This feature allows you to copy the content, the directory structure, or both, for all unique, open files (excluding non-file tabs like settings).

**How to use:**

* Click the files icon in the status bar (bottom right) to open a QuickPick.
* The first item, "Copy", immediately copies using the current settings.
* Toggle "Copy Content" and "Copy Structure" ON/OFF to configure.
* Use "Copy Import List" to copy a compact, single-line list for importing later.
* Use "Copy Compact" to copy an LLM-friendly directory listing (token-efficient).

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

### Compact Directory Output (LLM-Friendly)

When you only need the directory structure for LLMs, use one of the compact modes from the QuickPick:

* Copy Compact – Brace-grouped by top-level folders. Very compact while preserving hierarchy.

  Example:

  ```plaintext
  my-project/packages/pkg/{package.json,src/{core/{index.ts,util.ts},client/{index.tsx}}}
  ```

In most cases, this compact format offers the best token efficiency while staying clear for LLMs.

### 3. Import/Open Files from Import List

Use a concise, single-line Import List that is trivial to paste into the QuickPick input and to parse.

**How to use:**

* Use "Copy Import List" in the QuickPick to copy the Import List for your current tabs.
* Paste the line into the QuickPick input and press Enter to import.

**Format:**

* Single workspace root:

  ```plaintext
  root:my-project src/app.ts src/utils/math.ts
  ```

* Mixed/absolute-only:

  ```plaintext
  C:\code\proj\src\app.ts C:\code\proj\src\utils\math.ts
  ```

**Behavior:**

* Relative paths are resolved against the workspace named after `root:`.
* Absolute paths are opened directly.
* Non-existent files are skipped; focus is preserved.
