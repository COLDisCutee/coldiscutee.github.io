# Short++

A C++ and Python code golf editor for the desktop, built with Electron.

## Run

```bash
npm install     # Node 20.19 or newer
npm start
```

If anything goes wrong, run `npm run doctor` — it checks the Node version, the files, the Electron binary, and the proxy settings that affect the download, and prints what to do. [INSTALL.md](INSTALL.md) has the full troubleshooting guide, including a no-install fallback: `renderer/index.html` opens in a plain browser with everything except disk access and Run.

## Build installers

```bash
npm run dist
```

This produces a `.dmg` and `.zip` on macOS, an NSIS installer and a portable `.exe` on Windows, and an AppImage on Linux, all in `dist/`. Build on the OS you are targeting. `npm run dist:dir` skips the installer and just lays out the app, which is quicker when checking the build settings.

## Structure

- `main.js`: window, custom title bar setup, file dialogs, and a JSON store in the user data folder.
- `preload.js`: the narrow `window.shortpp` bridge the renderer talks to.
- `tools/doctor.js`: the environment check behind `npm run doctor`.
- `renderer/`: the editor UI.
  - `core.js`: C++ lexer, minifier, name shortener, and suggestion rules.
  - `core-py.js`: the same for Python, with an indentation-aware minifier.
  - `app.js`, `index.html`, `styles.css`: the interface.

## Languages

The language comes from the file extension: `.py` and `.pyw` are Python, everything else is C++. Renaming a file to another extension switches the mode, including its minify options, suggestions, highlighting, and cheat sheet.

## Shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| New file | ⌘N | Ctrl+N |
| New folder | ⇧⌘N | Ctrl+Shift+N |
| Toggle explorer | ⌘B | Ctrl+B |
| Templates | ⇧Return | Shift+Enter |
| Run | ⌘Return | Ctrl+Enter |
| Undo | ⌘Z | Ctrl+Z |
| Redo | ⇧⌘Z | Ctrl+Shift+Z or Ctrl+Y |
| Arrow keys (home row) | Ctrl+Shift+L , . / | Ctrl+Shift+L , . / |
| Open | ⌘O | Ctrl+O |
| Save | ⌘S | Ctrl+S |
| Save as | ⇧⌘S | Ctrl+Shift+S |

## Completion and templates

Typing two or more letters opens a completion list: language keywords and standard names, identifiers already in the file, and (in C++) matching templates. Tab or Enter accepts, arrows move, Esc dismisses.

Shift+Enter opens the template palette. It ships with C++ templates for the things you write every round — a main skeleton, a test-case loop, reading n numbers into an array or vector, reading a grid, sorting, prefix sums, an adjacency list with BFS or DFS, a sieve.

Templates take parameters. In a body, `{{n}}` is a parameter and `{{n:10}}` also gives it a default; every occurrence of the same name changes together as you type in the palette, and the preview updates live. `$0` marks where the caret lands after inserting. Multi-line bodies are indented to match the line you insert on, and the whole insertion is a single undo step.

Press New in the palette to write your own. Parameters are detected from the body as you type it, and your templates are saved with the rest of your settings, marked "mine", and offered by the inline completion as well.

## Running code

Short++ does not ship a compiler. It uses the one already on your machine: `g++`, `clang++`, or `c++` for C++, and `python3` (or `py -3` on Windows) for Python. The status bar shows which one was found; if none is, Run explains how to install it.

Press Run (Ctrl+Enter) to build and run the current file with whatever is in the Input box. The panel reports build and run time, the exit code, and anything on stderr. Runs stop after 5 seconds, and Stop kills the process.

"Set as expected" saves the current output as the answer for that file. Every later run then says whether it still matches, and names the first line that differs. That is the point of the whole thing: shorten the code as hard as you like and see immediately if it still produces the right output. Input and expected output are stored per file.

## Undo

One history covers everything you do to a file: typing, Tab and Enter, Minify, and applied suggestions. A run of typing collapses into a single step, and pauses, newlines, and IME syllables end a run. Undo restores the caret and selection along with the text, and each file keeps its own history while you switch between them.

Deleting files and folders in the explorer is separate: those are undone from the toast that appears.

## Home-row arrows

Hold Ctrl+Shift and the `L , . /` cluster acts as the arrow keys, in the same inverted-T shape: `L` up, `,` left, `.` down, `/` right. It works in the editor, the file explorer, and the menus. In the editor, up and down follow wrapped lines and keep the column you started from, just like the real arrow keys.

## Explorer

The explorer lists every file you've worked on in Short++, not a folder on disk. Folders in it are only for organizing and don't exist on disk.

- Drafts (dashed icon) live only inside Short++. Save one to write it to disk.
- Files from disk (solid icon) show a dot when the editor has changes you haven't saved. Renaming one renames the real file.
- "Remove from list" and "Delete folder" can be undone from the toast. "Move to Trash" / "Delete from disk" asks first and moves the real file to the system trash.
- Drag rows to organize. Dropping on a folder puts the item inside it; dropping on a file puts it next to that file. The destination folder is outlined while you drag, and collapsed folders open if you hover over them. Files from your OS can be dropped the same way.
- File icons follow the extension: Python, C++, or a plain file. Drafts show a dimmed icon.
- Drag the explorer's right edge to resize it (double-click to reset, or focus it and use the arrow keys).
- Keyboard: arrows to move, Enter to open, F2 to rename, Delete to remove, Shift+F10 for the menu.

Every draft and unsaved change is kept between launches, so closing the app never loses work.
