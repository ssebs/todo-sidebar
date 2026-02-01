# Refactoring Plan for Todo Sidebar Extension

This document outlines a detailed refactoring plan to improve code quality, reduce duplication, and enhance maintainability.

## Current Codebase Summary

| File | Lines | Purpose |
|------|-------|---------|
| `src/extension.ts` | 48 | Entry point, registers commands |
| `src/KanbanViewProvider.ts` | 926 | Main webview provider (god class) |
| `src/parser.ts` | 187 | Markdown → Board parsing |
| `src/serializer.ts` | 449 | Board → Markdown mutations |
| `src/test/extension.test.ts` | 15 | Minimal placeholder test |
| `src/test/serializer.test.ts` | 109 | Serializer unit tests |
| **Total** | **1,734** | |

**Inline Webview Breakdown (within KanbanViewProvider.ts):**
- Lines 318-567: CSS styles (250 lines)
- Lines 569-909: Webview HTML and JavaScript (341 lines)
- Total inline webview code: **595 lines**

---

## Phase 1: Extract Utility Functions

**Goal:** Eliminate duplicate code patterns by creating a shared utilities module.

### Task 1.1: Create `src/utils.ts`

Create a new utility module with the following functions:

```typescript
// Line processing utilities
export function detectLineEnding(content: string): string;
export function splitLines(content: string): string[];
export function joinLines(lines: string[], ending: string): string;

// Indentation utilities
export function getIndentLevel(line: string): number;
export function getIndentString(line: string): string;
export function reindentLine(line: string, newIndent: number, indentChar?: string): string;
export function reindentLines(lines: string[], baseIndent: number, indentChar?: string): string[];

// Line classification utilities
export function isEmptyLine(line: string): boolean;
export function isTaskLine(line: string): boolean;
export function cleanConsecutiveEmptyLines(lines: string[]): string[];

// Regex pattern constants
export const MD_UNCHECKED_PATTERN: RegExp;    // Matches - [ ]
export const MD_CHECKED_PATTERN: RegExp;      // Matches - [x] or - [X]
export const UNICODE_UNCHECKED_PATTERN: RegExp; // Matches - ☐
export const UNICODE_CHECKED_PATTERN: RegExp;   // Matches - ☑ or - ✓
export const ANY_CHECKBOX_PATTERN: RegExp;    // Matches any checkbox format
export const TASK_LINE_PATTERN: RegExp;       // Matches full task line with capture groups
```

### Task 1.2: Refactor `serializer.ts` to use utilities

Replace all duplicate patterns in `serializer.ts`:

1. **Lines 3, 35, 169, 314, 352, 383, 424** (7 occurrences): Replace inline line ending detection with `detectLineEnding()` and `splitLines()`
2. **Lines 11, 13, 17, 19, 363, 370, 435, 442**: Replace checkbox regex patterns with constants
3. **Lines 41, 50, 104, 109, 159, 193, 207, 244, 257, 261, 276, 392, 399**: Replace indentation detection with `getIndentLevel()`
4. **Lines 53, 56, 110, 150, 209, 278, 401**: Replace empty line checks with `isEmptyLine()`
5. **Lines 147-156 and 296-305**: Replace cleanup logic with `cleanConsecutiveEmptyLines()`

### Task 1.3: Refactor `parser.ts` to use utilities

Replace duplicate patterns in `parser.ts`:
1. Use shared checkbox patterns instead of inline regex
2. Use `getIndentLevel()` for indentation-based hierarchy detection

---

## Phase 2: Add Type Definitions for Messages

**Goal:** Improve type safety for webview-extension communication.

### Task 2.1: Create `src/types.ts`

Define message types for all webview communications:

```typescript
// Messages FROM webview TO extension
export type WebviewToExtensionMessage =
  | { type: 'toggle'; line: number; checked: boolean }
  | { type: 'move'; line: number; targetColumn: string; position: 'top' | 'bottom' | 'after'; afterLine?: number }
  | { type: 'moveToParent'; line: number; parentLine: number }
  | { type: 'getColumns'; line: number }
  | { type: 'openAtLine'; line: number }
  | { type: 'addTask'; column: string; text: string }
  | { type: 'editTaskText'; line: number; newText: string }
  | { type: 'addSubtask'; parentLine: number; text: string };

// Messages FROM extension TO webview
export type ExtensionToWebviewMessage =
  | { type: 'update'; board: Board; editLine?: number }
  | { type: 'columnsForPicker'; columns: ColumnInfo[]; taskLine: number };

export interface ColumnInfo {
  title: string;
  isDoneColumn: boolean;
}
```

### Task 2.2: Update `KanbanViewProvider.ts`

1. Import and use the new message types
2. Add type guards or type assertions in message handler
3. Update `postMessage` calls to use typed messages

---

## Phase 3: Split KanbanViewProvider

**Goal:** Reduce the 927-line god class into focused, single-responsibility classes.

### Task 3.1: Extract `src/FileManager.ts`

Handle all file I/O operations:

```typescript
export class FileManager {
  constructor(private context: vscode.ExtensionContext);

  // Persistence
  getActiveFilePath(): string | undefined;
  setActiveFilePath(path: string): void;

  // File operations
  async readFile(path: string): Promise<string>;
  async writeFile(path: string, content: string): Promise<void>;

  // File watching
  createWatcher(path: string, onChange: () => void): vscode.FileSystemWatcher;
}
```

### Task 3.2: Extract `src/TaskOperations.ts`

Handle task manipulation logic (thin wrapper around serializer):

```typescript
export class TaskOperations {
  constructor(private fileManager: FileManager);

  async toggleTask(filePath: string, line: number, checked: boolean): Promise<void>;
  async moveTask(filePath: string, line: number, targetColumn: string, position: string, afterLine?: number): Promise<void>;
  async moveTaskToParent(filePath: string, line: number, parentLine: number): Promise<void>;
  async addTask(filePath: string, column: string, text: string): Promise<void>;
  async editTaskText(filePath: string, line: number, newText: string): Promise<void>;
  async addSubtask(filePath: string, parentLine: number, text: string): Promise<void>;
}
```

### Task 3.3: Extract `src/WebviewRenderer.ts`

Handle HTML generation (currently 595 lines inline in `_getHtmlForWebview()`):

```typescript
export class WebviewRenderer {
  constructor(private webview: vscode.Webview, private extensionUri: vscode.Uri);

  getHtml(board: Board, nonce: string): string;

  // Private helpers
  private getStyles(): string;          // ~250 lines of CSS
  private getScripts(nonce: string): string;  // ~341 lines of JS
  private renderBoard(board: Board): string;
}
```

**Current inline structure (KanbanViewProvider.ts lines 315-909):**
- Lines 318-567: CSS styles in `<style>` block
- Lines 569-750: HTML template with board rendering
- Lines 751-909: JavaScript with SortableJS initialization and event handlers

### Task 3.4: Simplify `KanbanViewProvider.ts`

After extraction, the provider should only:
- Implement `WebviewViewProvider` interface
- Coordinate between FileManager, TaskOperations, and WebviewRenderer
- Handle webview lifecycle (resolveWebviewView, visibility changes)
- Route messages to appropriate handlers

Target: Reduce from 927 lines to ~200 lines.

---

## Phase 4: Consolidate Move Functions

**Goal:** Reduce duplication between `moveTaskInContent()` and `moveTaskToParent()`.

**Current State:**
- `moveTaskInContent()`: 133 lines (lines 27-159)
- `moveTaskToParent()`: 148 lines (lines 161-308)
- **~70% code overlap** in task extraction, indentation handling, and cleanup logic

### Task 4.1: Extract shared task extraction logic

Create helper functions in `serializer.ts`:

```typescript
// Extract a task and all its children as a block
function extractTaskBlock(lines: string[], taskLineIndex: number): {
  taskLines: string[];
  startIndex: number;
  endIndex: number;
};

// Remove a block of lines and clean up empty lines
function removeAndCleanup(lines: string[], startIndex: number, endIndex: number): string[];

// Find insertion point for a column
function findColumnInsertionPoint(lines: string[], columnTitle: string, position: 'top' | 'bottom' | 'after', afterLine?: number): number;
```

### Task 4.2: Refactor `moveTaskInContent()`

Rewrite using the extracted helpers. Target: Reduce from 133 lines to ~50 lines.

### Task 4.3: Refactor `moveTaskToParent()`

Rewrite using the extracted helpers. Target: Reduce from 148 lines to ~50 lines.

---

## Phase 5: Remove Dead Code and Fix Bugs

**Goal:** Clean up unused code and fix identified issues.

### Task 5.1: Remove or use `removeCheckboxFromTask()`

The function at `serializer.ts:420-449` is exported but never imported. Either:
- Remove it if not needed
- Add it to exports and use it where appropriate

### Task 5.2: Fix `pendingUncheckLine` bug

In the webview JavaScript (inside `_getHtmlForWebview` at line 764), `pendingUncheckLine` is used but never declared. Add proper declaration:

```javascript
let pendingUncheckLine = null;
```

**Location:** KanbanViewProvider.ts line 764 inside the inline `<script>` block.

### Task 5.3: Audit and remove any other dead code

Search for unused exports and remove them.

### Task 5.4: Fix MD file persistence - Use workspace settings.json (CRITICAL)

**Problem:** The active markdown file path is stored using `workspaceState` which is unreliable and doesn't persist properly when:
- The panel is closed and reopened
- VSCode is restarted
- The workspace is reloaded

**Current behavior (broken):**
```typescript
// In KanbanViewProvider.ts
const savedPath = this._context.workspaceState.get<string>('todoSidebar.activeFile');
await this._context.workspaceState.update('todoSidebar.activeFile', uri.fsPath);
```

**Solution:** Save the file path to `.vscode/settings.json` using VSCode's configuration API:

1. **Register configuration in `package.json`:**
```json
"contributes": {
  "configuration": {
    "title": "Todo Sidebar",
    "properties": {
      "todoSidebar.activeFile": {
        "type": "string",
        "default": "",
        "description": "Path to the active markdown file for the todo board"
      }
    }
  }
}
```

2. **Update `KanbanViewProvider.ts` to use workspace configuration:**
```typescript
// Reading the saved path
private _getActiveFilePath(): string | undefined {
  const config = vscode.workspace.getConfiguration('todoSidebar');
  return config.get<string>('activeFile');
}

// Saving the path
private async _setActiveFilePath(filePath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('todoSidebar');
  await config.update('activeFile', filePath, vscode.ConfigurationTarget.Workspace);
}
```

3. **Benefits of this approach:**
   - Path is stored in `.vscode/settings.json` (visible, version-controllable)
   - Persists reliably across sessions
   - Uses standard VSCode configuration patterns
   - Can be manually edited by users if needed

### Task 5.5: Ensure file restoration on panel reopen

**Problem:** When the sidebar panel is closed and reopened, the board doesn't restore.

**Root cause:** The `_activeFileUri` is only restored in `resolveWebviewView()` but may not trigger a refresh properly if the webview HTML isn't ready.

**Solution:**

1. **Add visibility change handler:**
```typescript
webviewView.onDidChangeVisibility(() => {
  if (webviewView.visible && this._activeFileUri) {
    this._refresh();
  }
});
```

2. **Ensure configuration is read on each resolveWebviewView call:**
```typescript
public resolveWebviewView(...) {
  // Always try to restore from settings if no active file
  if (!this._activeFileUri) {
    const savedPath = this._getActiveFilePath();
    if (savedPath && fs.existsSync(savedPath)) {
      this._activeFileUri = vscode.Uri.file(savedPath);
    }
  }

  // Refresh after webview is set up
  if (this._activeFileUri) {
    // Use setImmediate or setTimeout to ensure webview is ready
    setTimeout(() => this._refresh(), 0);
  }
}
```

3. **Add file existence validation:**
   - Check if the saved file still exists before trying to load it
   - Clear the saved path if the file no longer exists
   - Show a user-friendly message if the file is missing

---

## Phase 6: Add Missing Tests

**Goal:** Improve test coverage for critical functionality.

### Task 6.1: Add parser tests in `src/test/parser.test.ts`

Test cases:
- Parse board title and description
- Parse columns (regular and done columns)
- Parse tasks with markdown checkboxes
- Parse tasks with unicode checkboxes
- Parse nested tasks (multiple levels)
- Handle edge cases (empty file, no columns, malformed markdown)

### Task 6.2: Expand serializer tests

Add tests for:
- `moveTaskInContent()` - all position modes (top, bottom, after)
- `moveTaskToParent()` - various nesting scenarios
- `toggleTaskInContent()` - both checkbox formats
- Edge cases (first/last task, deeply nested)

### Task 6.3: Add utility function tests

Test all functions in the new `utils.ts` module.

---

## Phase 7: (Optional) Extract Webview Assets

**Goal:** Improve maintainability of frontend code.

### Task 7.1: Create `webview/` directory structure

```
src/
  webview/
    index.html
    styles.css
    app.js
```

### Task 7.2: Update build process

Modify `webpack.config.js` to:
- Bundle webview assets separately
- Copy HTML/CSS to dist folder

### Task 7.3: Update `WebviewRenderer.ts`

Load external assets instead of inline strings.

---

## Execution Order

Execute phases in order. Each phase should:
1. Make changes
2. Run `npm run compile` to verify no TypeScript errors
3. Run `npm run lint` to check code style
4. Run `npm run test` to verify existing tests pass
5. Test manually in VSCode (F5) to verify functionality

**Do not proceed to the next phase if any step fails.**

---

## Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| `src/utils.ts` | 1 | Shared utility functions |
| `src/types.ts` | 2 | Message type definitions |
| `src/FileManager.ts` | 3 | File I/O operations |
| `src/TaskOperations.ts` | 3 | Task manipulation |
| `src/WebviewRenderer.ts` | 3 | HTML generation |
| `src/test/parser.test.ts` | 6 | Parser tests |
| `src/test/utils.test.ts` | 6 | Utility tests |

## Files to Modify

| File | Phases | Changes |
|------|--------|---------|
| `src/serializer.ts` | 1, 4, 5 | Use utilities, consolidate move functions, remove dead code |
| `src/parser.ts` | 1 | Use shared utilities |
| `src/KanbanViewProvider.ts` | 2, 3, 5 | Use types, delegate to extracted classes, fix bugs, fix persistence |
| `src/extension.ts` | 3 | Update provider instantiation |
| `src/test/serializer.test.ts` | 6 | Add more test cases |
| `package.json` | 5 | Add `todoSidebar.activeFile` configuration property |

---

## Success Criteria

After completing all phases:

- [ ] No duplicate regex patterns across files
- [ ] No duplicate utility logic (indentation, line processing)
- [ ] `KanbanViewProvider.ts` under 250 lines
- [ ] All message passing is type-safe
- [ ] `moveTaskInContent()` under 60 lines
- [ ] `moveTaskToParent()` under 60 lines
- [ ] No dead code exports
- [ ] Parser has test coverage
- [ ] All existing functionality works correctly
- [ ] `npm run compile` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] **MD file path persists in `.vscode/settings.json`**
- [ ] **Board restores correctly when panel is closed and reopened**
- [ ] **Board restores correctly when VSCode is restarted**

---

## Appendix: Key Code Patterns Reference

### Current Checkbox Regex Patterns (to consolidate)

| Location | Pattern | Purpose |
|----------|---------|---------|
| serializer.ts:11 | `/([-*]\s+)\[ \]/` | Match unchecked markdown |
| serializer.ts:13 | `/([-*]\s+)\[[xX]\]/` | Match checked markdown |
| serializer.ts:17 | `/([-*]\s+)☐/` | Match unchecked unicode |
| serializer.ts:19 | `/([-*]\s+)[☑✓]/` | Match checked unicode |
| parser.ts:77 | `^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$` | Full markdown task line |
| parser.ts:109 | `^(\s*)[-*]\s+([☐☑✓✗])\s+(.+)$` | Full unicode task line |
| serializer.ts:363,370 | `(\s*[-*]\s+\[[ xX]\]\s+)` | Edit task pattern |
| serializer.ts:435,442 | `\[[ xX]\]` / `[☐☑✓✗]` | Remove checkbox pattern |

### Current Indentation Pattern (14+ occurrences)

```typescript
const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
```

### Current Line Ending Pattern (7 occurrences)

```typescript
const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
const lines = content.split(/\r?\n/);
```

### Current Empty Line Cleanup (duplicate at lines 147-156 and 296-305)

```typescript
const cleaned: string[] = [];
let lastWasEmpty = false;
for (const resultLine of result) {
  const isEmpty = resultLine.trim() === '';
  if (isEmpty && lastWasEmpty) {
    continue;
  }
  cleaned.push(resultLine);
  lastWasEmpty = isEmpty;
}
```

---

## Appendix: Existing Test Coverage

| Function | Tests | Notes |
|----------|-------|-------|
| `addTaskToSection()` | 1 | Basic case only |
| `editTaskTextInContent()` | 3 | Markdown + Unicode |
| `addSubtaskToParent()` | 2 | Basic nesting |
| `removeCheckboxFromTask()` | 3 | Markdown + Unicode |
| `toggleTaskInContent()` | 0 | **Missing** |
| `moveTaskInContent()` | 0 | **Missing** - most complex function |
| `moveTaskToParent()` | 0 | **Missing** - second most complex function |
| `parseMarkdown()` | 0 | **Missing** - no parser tests |

### Priority Test Cases to Add

1. **moveTaskInContent()**: position='top', position='bottom', position='after' with afterLine
2. **moveTaskToParent()**: nested indentation, multi-level hierarchy
3. **toggleTaskInContent()**: check/uncheck markdown, check/uncheck unicode
4. **parseMarkdown()**: board title, description, columns, tasks, nested tasks, edge cases
