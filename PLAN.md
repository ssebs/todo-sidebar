# Add Tasks & Inline Edit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "+" button to column headers that creates new tasks, plus inline editing of task text via double-click.

**Architecture:** Two new serializer functions handle markdown manipulation. The webview gains edit mode UI (input fields) and sends new message types to the extension. File watcher triggers refresh after edits.

**Tech Stack:** TypeScript, VSCode Webview API, existing parser/serializer patterns

---

## Task 1: Add `addTaskToSection` Function

**Files:**
- Modify: `src/serializer.ts`
- Test: `src/test/serializer.test.ts` (create)

**Step 1: Create test file with first test**

Create `src/test/serializer.test.ts`:

```typescript
import * as assert from 'assert';
import { addTaskToSection } from '../serializer';

suite('Serializer Test Suite', () => {
  suite('addTaskToSection', () => {
    test('adds task after section header with existing tasks', () => {
      const content = `## Todo

- [ ] Existing task

## Done
`;
      const result = addTaskToSection(content, 'Todo');
      assert.ok(result.content.includes('- [ ] New task'));
      assert.strictEqual(result.line, 3); // Line after header + blank
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run compile-tests && npm run compile`
Expected: Compilation error - `addTaskToSection` not exported

**Step 3: Add minimal function to serializer.ts**

Add to `src/serializer.ts`:

```typescript
export function addTaskToSection(
  content: string,
  sectionTitle: string
): { content: string; line: number } {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);

  // Find the section header
  let sectionIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^##\s+(.+)$/);
    if (match && match[1].trim() === sectionTitle) {
      sectionIndex = i;
      break;
    }
  }

  if (sectionIndex === -1) {
    return { content, line: -1 };
  }

  // Find insertion point (skip blank lines after header)
  let insertIndex = sectionIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
    insertIndex++;
  }

  // Insert new task
  const newTask = '- [ ] New task';
  lines.splice(insertIndex, 0, newTask);

  return {
    content: lines.join(lineEnding),
    line: insertIndex + 1 // 1-indexed
  };
}
```

**Step 4: Run compile to verify it builds**

Run: `npm run compile-tests && npm run compile`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/serializer.ts src/test/serializer.test.ts
git commit -m "feat: add addTaskToSection function

Adds new task at top of specified section.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add `editTaskTextInContent` Function

**Files:**
- Modify: `src/serializer.ts`
- Test: `src/test/serializer.test.ts`

**Step 1: Add test for editTaskTextInContent**

Add to `src/test/serializer.test.ts`:

```typescript
import { addTaskToSection, editTaskTextInContent } from '../serializer';

// ... existing tests ...

suite('editTaskTextInContent', () => {
  test('edits markdown checkbox task text', () => {
    const content = `## Todo

- [ ] Old text
- [x] Done task
`;
    const result = editTaskTextInContent(content, 3, 'New text');
    assert.ok(result.includes('- [ ] New text'));
    assert.ok(result.includes('- [x] Done task'));
  });

  test('edits unicode checkbox task text', () => {
    const content = `## Todo

- ☐ Old text
`;
    const result = editTaskTextInContent(content, 3, 'New text');
    assert.ok(result.includes('- ☐ New text'));
  });

  test('preserves indentation', () => {
    const content = `## Todo

- [ ] Parent
  - [ ] Child text
`;
    const result = editTaskTextInContent(content, 4, 'New child');
    assert.ok(result.includes('  - [ ] New child'));
  });
});
```

**Step 2: Run compile to verify it fails**

Run: `npm run compile-tests`
Expected: Compilation error - `editTaskTextInContent` not exported

**Step 3: Add editTaskTextInContent function**

Add to `src/serializer.ts`:

```typescript
export function editTaskTextInContent(
  content: string,
  line: number,
  newText: string
): string {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const lineIndex = line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) {
    return content;
  }

  const currentLine = lines[lineIndex];

  // Match markdown checkbox: - [ ] text or - [x] text
  const mdMatch = currentLine.match(/^(\s*[-*]\s+\[[ xX]\]\s+)(.+)$/);
  if (mdMatch) {
    lines[lineIndex] = mdMatch[1] + newText;
    return lines.join(lineEnding);
  }

  // Match unicode checkbox: - ☐ text or - ☑ text
  const unicodeMatch = currentLine.match(/^(\s*[-*]\s+[☐☑✓✗]\s+)(.+)$/);
  if (unicodeMatch) {
    lines[lineIndex] = unicodeMatch[1] + newText;
    return lines.join(lineEnding);
  }

  return content;
}
```

**Step 4: Run compile to verify it builds**

Run: `npm run compile-tests && npm run compile`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/serializer.ts src/test/serializer.test.ts
git commit -m "feat: add editTaskTextInContent function

Edits task text while preserving checkbox state and indentation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Message Handlers in KanbanViewProvider

**Files:**
- Modify: `src/KanbanViewProvider.ts`

**Step 1: Import new functions**

Update import in `src/KanbanViewProvider.ts`:

```typescript
import { toggleTaskInContent, moveTaskInContent, moveTaskToParent, addTaskToSection, editTaskTextInContent } from './serializer';
```

**Step 2: Add addTask handler**

Add new case in the `switch (message.type)` block around line 31:

```typescript
case 'addTask':
  await this._handleAddTask(message.section);
  break;
case 'editTaskText':
  await this._handleEditTaskText(message.line, message.newText);
  break;
```

**Step 3: Add handler methods**

Add after `_handleOpenAtLine` method (around line 219):

```typescript
private async _handleAddTask(section: string) {
  if (!this._activeFileUri) {
    return;
  }

  try {
    const content = await vscode.workspace.fs.readFile(this._activeFileUri);
    const text = Buffer.from(content).toString('utf-8');
    const result = addTaskToSection(text, section);

    if (result.line > 0) {
      await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(result.content, 'utf-8'));
      // Tell webview to enter edit mode on the new task
      this._view?.webview.postMessage({ type: 'editTask', line: result.line });
    }
  } catch (error) {
    console.error('Error adding task:', error);
  }
}

private async _handleEditTaskText(line: number, newText: string) {
  if (!this._activeFileUri) {
    return;
  }

  try {
    const content = await vscode.workspace.fs.readFile(this._activeFileUri);
    let text = Buffer.from(content).toString('utf-8');
    text = editTaskTextInContent(text, line, newText);
    await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
  } catch (error) {
    console.error('Error editing task text:', error);
  }
}
```

**Step 4: Run compile**

Run: `npm run compile`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/KanbanViewProvider.ts
git commit -m "feat: add addTask and editTaskText message handlers

Handles webview messages for adding new tasks and editing task text.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update Webview HTML - Add Button

**Files:**
- Modify: `src/KanbanViewProvider.ts` (webview HTML/CSS)

**Step 1: Update column-header CSS**

Find the `.column-header` style (around line 269) and replace with:

```css
.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--vscode-panel-border);
}
```

**Step 2: Add button CSS**

Add after `.column-header` styles:

```css
.add-task-btn {
  background: none;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: 1.2em;
  opacity: 0.5;
  padding: 0 4px;
  line-height: 1;
}
.add-task-btn:hover {
  opacity: 1;
}
```

**Step 3: Update renderColumn function**

Find the `renderColumn` function (around line 482) and replace the column-header line:

```javascript
return \`
  <div class="column" data-section="\${escapeHtml(column.title)}" data-is-done="\${column.isDoneColumn}">
    <div class="column-header">
      <span class="column-title">\${escapeHtml(column.title)}</span>
      <button class="add-task-btn" data-section="\${escapeHtml(column.title)}" title="Add task">+</button>
    </div>
    <div class="tasks" data-section="\${escapeHtml(column.title)}">\${tasks}</div>
  </div>
\`;
```

**Step 4: Run compile and test manually**

Run: `npm run compile`
Then press F5 to test the extension - verify "+" button appears

**Step 5: Commit**

```bash
git add src/KanbanViewProvider.ts
git commit -m "feat: add '+' button to column headers

Button appears on right side of each column header.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Button Click Handler

**Files:**
- Modify: `src/KanbanViewProvider.ts` (webview JS)

**Step 1: Add click handler in setupEventListeners**

Find `setupEventListeners()` function and add after the open buttons handler (around line 576):

```javascript
// Add task buttons
document.querySelectorAll('.add-task-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const section = e.target.dataset.section;
    vscode.postMessage({ type: 'addTask', section });
  });
});
```

**Step 2: Run compile and test**

Run: `npm run compile`
Press F5 - click "+" should add task (UI won't refresh yet until file watcher triggers)

**Step 3: Commit**

```bash
git add src/KanbanViewProvider.ts
git commit -m "feat: wire up add task button click handler

Sends addTask message to extension when clicked.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Edit Mode CSS

**Files:**
- Modify: `src/KanbanViewProvider.ts` (webview CSS)

**Step 1: Add input styles**

Add to the CSS section:

```css
.task-edit-input {
  flex: 1;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-focusBorder);
  color: var(--vscode-foreground);
  font-family: inherit;
  font-size: inherit;
  padding: 2px 4px;
  border-radius: 2px;
  min-width: 0;
}
.task-edit-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}
```

**Step 2: Run compile**

Run: `npm run compile`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/KanbanViewProvider.ts
git commit -m "feat: add CSS for task edit input field

Styles match VSCode input appearance.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Edit Mode JavaScript Functions

**Files:**
- Modify: `src/KanbanViewProvider.ts` (webview JS)

**Step 1: Add edit mode functions**

Add before `setupEventListeners()`:

```javascript
function enterEditMode(taskElement) {
  const textSpan = taskElement.querySelector('.task-text');
  if (!textSpan || taskElement.querySelector('.task-edit-input')) {
    return; // Already in edit mode
  }

  const line = parseInt(taskElement.dataset.line);
  const originalText = textSpan.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input';
  input.value = originalText;
  input.dataset.line = line;
  input.dataset.originalText = originalText;

  textSpan.replaceWith(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', handleEditKeydown);
  input.addEventListener('blur', handleEditBlur);
}

function handleEditKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveEdit(e.target);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelEdit(e.target);
  }
}

function handleEditBlur(e) {
  // Small delay to allow cancel via Escape
  setTimeout(() => {
    if (document.body.contains(e.target)) {
      saveEdit(e.target);
    }
  }, 0);
}

function saveEdit(input) {
  const line = parseInt(input.dataset.line);
  const newText = input.value.trim();
  const originalText = input.dataset.originalText;

  if (newText && newText !== originalText) {
    vscode.postMessage({ type: 'editTaskText', line, newText });
  }
  // Restore span (UI will fully refresh from file watcher)
  restoreTextSpan(input, newText || originalText);
}

function cancelEdit(input) {
  const originalText = input.dataset.originalText;
  restoreTextSpan(input, originalText);
}

function restoreTextSpan(input, text) {
  const span = document.createElement('span');
  span.className = 'task-text';
  span.textContent = text;
  input.replaceWith(span);
}
```

**Step 2: Run compile**

Run: `npm run compile`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/KanbanViewProvider.ts
git commit -m "feat: add edit mode JavaScript functions

Enter/exit edit mode, save/cancel handlers.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Double-Click Handler and editTask Message Handler

**Files:**
- Modify: `src/KanbanViewProvider.ts` (webview JS)

**Step 1: Add double-click handler in setupEventListeners**

Add in `setupEventListeners()`:

```javascript
// Double-click to edit
document.querySelectorAll('.task-text').forEach(textSpan => {
  textSpan.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const taskElement = e.target.closest('.task, .child-task');
    if (taskElement) {
      enterEditMode(taskElement);
    }
  });
});
```

**Step 2: Add editTask message handler**

Find the message handler (around line 643) and add new case:

```javascript
} else if (message.type === 'editTask') {
  // Enter edit mode on newly added task after refresh
  setTimeout(() => {
    const taskElement = document.querySelector(\`[data-line="\${message.line}"]\`);
    if (taskElement) {
      enterEditMode(taskElement);
    }
  }, 100);
}
```

**Step 3: Run compile and full manual test**

Run: `npm run compile`
Press F5 and test:
- Click "+" adds task and enters edit mode
- Double-click existing task enters edit mode
- Enter saves
- Escape cancels
- Click outside (blur) saves

**Step 4: Commit**

```bash
git add src/KanbanViewProvider.ts
git commit -m "feat: add double-click edit and editTask message handler

Complete edit mode functionality.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Testing Checklist

- [ ] Click "+" adds task to correct column
- [ ] New task immediately enters edit mode
- [ ] Double-click existing task enters edit mode
- [ ] Enter key saves edit
- [ ] Escape key cancels edit
- [ ] Clicking outside (blur) saves edit
- [ ] Empty text on save keeps original text
- [ ] Subtasks can also be edited
- [ ] Unicode checkboxes (☐/☑) preserved during edit
- [ ] Indentation preserved during edit
- [ ] Build passes: `npm run compile`
- [ ] Lint passes: `npm run lint`
