# To-Do Sidebar VSCode Extension - Implementation Plan

## Overview
A VSCode extension that displays a Kanban-style todo board in the sidebar, parsed from a Markdown file.

## Core Requirements
- WebviewViewProvider for sidebar display
- Parse markdown with `## Section` headers as columns
- `- [ ]` / `- [x]` checklists as tasks
- Nested items (sublists, bullets) always visible under parent
- Drag & drop tasks between sections
- Auto-move to "Done" section when checkbox is checked
- "Open in editor" button on each task (jumps to line)
- Minimal styling - functional POC

---

## File Structure

```
todo-sidebar/
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript config
├── src/
│   ├── extension.ts          # Activation & command registration
│   ├── KanbanViewProvider.ts # WebviewViewProvider
│   ├── parser.ts             # Markdown → data model
│   └── serializer.ts         # Data model → markdown
└── media/
    └── kanban.js             # Webview drag & drop logic
```

---

## Implementation Steps

### Step 1: Scaffold Extension
Create:
- `package.json` - extension manifest with:
  - `viewsContainers.activitybar` contribution
  - `views` with type "webview"
  - Commands: `openFile`, `refresh`
- `tsconfig.json` - target ES2020, module commonjs

### Step 2: Data Model (`src/parser.ts`)
```typescript
interface Task {
  text: string;
  checked: boolean;
  line: number;
  children: Task[];  // Nested items
}

interface Column {
  title: string;
  line: number;
  isDoneColumn: boolean;  // title.toLowerCase().includes('done')
  tasks: Task[];
}

interface Board {
  title: string;       // From # heading
  description: string; // From > blockquote
  columns: Column[];
}
```

Parser logic:
- Line-by-line scan
- `# Title` → board title
- `> text` → description
- `## Section` → new column, check if "done" in name
- `- [ ]` / `- [x]` → task with line number
- Indented lines → children of previous task

### Step 3: Serializer (`src/serializer.ts`)
- Reconstruct markdown from Board model
- Preserve line structure for minimal diffs
- Handle task moves by removing from source, inserting at target

### Step 4: WebviewViewProvider (`src/KanbanViewProvider.ts`)
- `resolveWebviewView()`:
  - Set webview options (enableScripts)
  - Generate HTML with columns and tasks
  - Set up message handler
- File watching:
  - `workspace.onDidChangeTextDocument` for open file
  - `workspace.createFileSystemWatcher` for external changes
- Message handlers:
  - `toggle` → update checkbox, auto-move if done
  - `move` → reorder task in markdown
  - `openAtLine` → open editor at line

### Step 5: Webview UI (inline HTML + `media/kanban.js`)

HTML structure:
```html
<div class="board">
  <div class="column" data-section="In Progress">
    <h3>In Progress</h3>
    <div class="task" draggable="true" data-line="5">
      <input type="checkbox">
      <span class="text">Task text</span>
      <button class="open-btn">Open</button>
      <div class="children">
        <!-- nested items here, always visible -->
      </div>
    </div>
  </div>
</div>
```

Minimal CSS:
- Flexbox row for columns
- Basic card styling (border, padding)
- Drag feedback (opacity)

JavaScript (`kanban.js`):
- HTML5 drag/drop: `dragstart`, `dragover`, `drop`
- Checkbox change → post `toggle` message
- Open button click → post `openAtLine` message
- Receive `update` message → re-render

### Step 6: Extension Entry (`src/extension.ts`)
- Register `KanbanViewProvider`
- Register commands:
  - `todoSidebar.openFile` → file picker, set active file
  - `todoSidebar.refresh` → trigger re-parse

---

## Message Protocol

### Webview → Extension
| Message | Payload | Action |
|---------|---------|--------|
| `toggle` | `{ line: number, checked: boolean }` | Toggle checkbox, move if done |
| `move` | `{ taskLine: number, targetSection: string }` | Move task to section |
| `openAtLine` | `{ line: number }` | Open file at line in editor |

### Extension → Webview
| Message | Payload | Action |
|---------|---------|--------|
| `update` | `{ board: Board }` | Re-render entire board |

---

## Key Behaviors

1. **Checkbox toggle**
   - Update `[ ]` ↔ `[x]` in file
   - If checked → find column with "done" in title (case-insensitive) → move task there
   - Save file

2. **Drag & drop**
   - Drag task card to another column
   - On drop: update markdown (remove from source, append to target)
   - Children move with parent

3. **Nested items**
   - Always visible below parent task
   - Indented visually
   - Move as a block with parent

4. **Open in editor**
   - `vscode.window.showTextDocument(uri, { selection: new Range(line, 0, line, 0) })`

---

## Dependencies
- None beyond VSCode API
- No external markdown parser (simple line-by-line parsing)
