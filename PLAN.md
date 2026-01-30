# Todo Sidebar Bug Fixes - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three bugs: file persistence across sessions, nested checkbox promotion with de-indentation, and restrict non-checkbox items from leaving parent.

**Architecture:** Minimal changes to existing parser/serializer/provider pattern. Add `hasCheckbox` to Task, fix de-indent logic in `moveTaskInContent`, add `onMove` restriction in SortableJS, and use VSCode workspaceState for persistence.

**Tech Stack:** TypeScript, VSCode Extension API, SortableJS

---

## Task 1: Add `hasCheckbox` to Task Interface

**Files:**
- Modify: `src/parser.ts:1-6`

**Step 1: Update Task interface**

Add `hasCheckbox: boolean` field:

```typescript
export interface Task {
  text: string;
  checked: boolean;
  line: number;
  children: Task[];
  hasCheckbox: boolean;
}
```

**Step 2: Update markdown checkbox parser (lines 76-103)**

Set `hasCheckbox: true` when creating Task from `- [ ]` or `- [x]`:

```typescript
const task: Task = {
  text,
  checked,
  line: lineNumber,
  children: [],
  hasCheckbox: true
};
```

**Step 3: Update unicode checkbox parser (lines 107-132)**

Set `hasCheckbox: true` when creating Task from `☐` or `☑`:

```typescript
const task: Task = {
  text,
  checked,
  line: lineNumber,
  children: [],
  hasCheckbox: true
};
```

**Step 4: Update nested quote parser (lines 136-149)**

Set `hasCheckbox: false` for `- > text` items:

```typescript
const childTask: Task = {
  text,
  checked: false,
  line: lineNumber,
  children: [],
  hasCheckbox: false
};
```

**Step 5: Update bullet parser (lines 153-178)**

Set `hasCheckbox: false` for plain `- item` bullets:

```typescript
const childTask: Task = {
  text,
  checked: false,
  line: lineNumber,
  children: [],
  hasCheckbox: false
};
```

**Step 6: Run build to verify no type errors**

Run: `npm run compile`
Expected: Build succeeds with no errors

**Step 7: Commit**

```bash
git add src/parser.ts
git commit -m "$(cat <<'EOF'
feat: add hasCheckbox field to Task interface

Distinguishes checkbox tasks (- [ ], - [x], ☐, ☑) from plain bullets.
This enables restricting plain bullets from being promoted out of parent.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix De-indent When Promoting Nested Tasks

**Files:**
- Modify: `src/serializer.ts:78-177`

**Step 1: Add de-indent logic in `moveTaskInContent`**

After extracting taskLines (around line 112), strip the base indentation:

```typescript
// De-indent the task block to become top-level
const deindentedLines = taskLines.map(line => {
  if (line.startsWith(' '.repeat(taskIndent))) {
    return line.slice(taskIndent);
  }
  return line;
});
```

**Step 2: Use deindentedLines when inserting**

Replace `...taskLines` with `...deindentedLines` in the result array (around line 157-161):

```typescript
const result = [
  ...newLines.slice(0, targetInsertIndex),
  ...deindentedLines,
  '',
  ...newLines.slice(targetInsertIndex)
];
```

**Step 3: Run build**

Run: `npm run compile`
Expected: Build succeeds

**Step 4: Manual test**

Test in VSCode (F5): Drag a nested checkbox `  - [ ] Child` to a column. It should become `- [ ] Child` (no leading spaces).

**Step 5: Commit**

```bash
git add src/serializer.ts
git commit -m "$(cat <<'EOF'
fix: de-indent nested tasks when promoted to column level

Previously, dragging a nested task to a column kept its indentation,
making it appear as a broken top-level task. Now strips base indent.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Restrict Non-Checkbox Items from Leaving Parent

**Files:**
- Modify: `src/KanbanViewProvider.ts:445-454, 569-629`

**Step 1: Add data attribute to child task render**

In `renderChildTask` function (~line 446), add `data-has-checkbox`:

```javascript
function renderChildTask(child, isDoneColumn) {
  return \`
    <div class="child-task" draggable="true" data-line="\${child.line}" data-in-done="\${isDoneColumn}" data-has-checkbox="\${child.hasCheckbox}">
      <div class="task-header">
        <input type="checkbox" class="task-checkbox" \${child.checked ? 'checked' : ''} data-line="\${child.line}" data-in-done="\${isDoneColumn}">
        <span class="task-text \${child.checked ? 'checked' : ''}">\${escapeHtml(child.text)}</span>
        <button class="open-btn" data-line="\${child.line}" title="Open in editor">↗</button>
      </div>
    </div>
  \`;
}
```

**Step 2: Add `onMove` callback to column SortableJS**

In the SortableJS init for `.tasks` (~line 571-598), add `onMove`:

```javascript
new Sortable(taskList, {
  group: 'shared',
  animation: 150,
  ghostClass: 'task-ghost',
  chosenClass: 'task-chosen',
  dragClass: 'task-drag',
  onMove: (evt) => {
    const hasCheckbox = evt.dragged.dataset.hasCheckbox;
    // Non-checkbox items can only reorder within same container
    if (hasCheckbox === 'false' && evt.from !== evt.to) {
      return false;
    }
    return true;
  },
  onEnd: (evt) => {
    // ... existing onEnd code unchanged
  }
});
```

**Step 3: Add `onMove` callback to children SortableJS**

In the SortableJS init for `.children` (~line 601-629), add the same `onMove`:

```javascript
new Sortable(childList, {
  group: 'shared',
  animation: 150,
  ghostClass: 'task-ghost',
  chosenClass: 'task-chosen',
  dragClass: 'task-drag',
  onMove: (evt) => {
    const hasCheckbox = evt.dragged.dataset.hasCheckbox;
    if (hasCheckbox === 'false' && evt.from !== evt.to) {
      return false;
    }
    return true;
  },
  onEnd: (evt) => {
    // ... existing onEnd code unchanged
  }
});
```

**Step 4: Run build**

Run: `npm run compile`
Expected: Build succeeds

**Step 5: Manual test**

Test in VSCode (F5):
- Drag a plain bullet child → should NOT move to column (blocked)
- Drag a checkbox child → should move to column (allowed)
- Reorder plain bullet within same parent → should work

**Step 6: Commit**

```bash
git add src/KanbanViewProvider.ts
git commit -m "$(cat <<'EOF'
fix: restrict plain bullets from leaving parent task

Non-checkbox items (plain bullets) can now only reorder within their
parent container. Only checkbox tasks can be promoted to column level.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Persist Selected File Across Sessions

**Files:**
- Modify: `src/extension.ts:6-16`
- Modify: `src/KanbanViewProvider.ts:5-59, 83-86`

**Step 4a: Update KanbanViewProvider constructor**

**Step 1: Change constructor to accept ExtensionContext**

```typescript
constructor(private readonly _context: vscode.ExtensionContext) {}
```

**Step 2: Update `_extensionUri` references to use `_context.extensionUri`**

In `resolveWebviewView` (~line 24):
```typescript
localResourceRoots: [this._context.extensionUri]
```

**Step 3: Save file in `setActiveFile`**

```typescript
public async setActiveFile(uri: vscode.Uri) {
  this._activeFileUri = uri;
  this._context.workspaceState.update('todoSidebar.activeFile', uri.toString());
  await this._refresh();
}
```

**Step 4: Restore file in `resolveWebviewView`**

Add after setting up message handlers (~line 56):

```typescript
// Restore previously selected file
const savedUri = this._context.workspaceState.get<string>('todoSidebar.activeFile');
if (savedUri) {
  this._activeFileUri = vscode.Uri.parse(savedUri);
  this._refresh();
}
```

**Step 5: Run build**

Run: `npm run compile`
Expected: Build fails - extension.ts still passes extensionUri

**Step 4b: Update extension.ts**

**Step 6: Pass full context to provider**

In `extension.ts` line 10, change:
```typescript
kanbanProvider = new KanbanViewProvider(context);
```

**Step 7: Run build**

Run: `npm run compile`
Expected: Build succeeds

**Step 8: Manual test**

- Open VSCode with extension (F5)
- Select a markdown file via command
- Close extension dev host
- Re-launch (F5) → same file should auto-load

**Step 9: Commit**

```bash
git add src/extension.ts src/KanbanViewProvider.ts
git commit -m "$(cat <<'EOF'
feat: persist selected file across VSCode sessions

Uses workspaceState to save the active file URI. On webview load,
restores the previously selected file automatically.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Testing Checklist

- [ ] Pick a markdown file via command → board loads
- [ ] Close/reopen VSCode → same file auto-loads
- [ ] Pick different file → new file becomes active and persists
- [ ] Drag nested checkbox task to column → becomes top-level (no indent)
- [ ] Drag nested checkbox task to different parent → works
- [ ] Drag plain bullet item to column → blocked (stays in parent)
- [ ] Drag plain bullet item within same parent → reorders correctly
- [ ] Build passes: `npm run compile`
- [ ] Lint passes: `npm run lint`
