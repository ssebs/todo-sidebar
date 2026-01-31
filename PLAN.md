# Refactoring Plan for Todo Sidebar Extension

This document outlines a detailed refactoring plan to improve code quality, reduce duplication, and enhance maintainability.

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

1. **Line 3, 35, 169, 314, 352, 383**: Replace inline line ending detection with `detectLineEnding()` and `splitLines()`
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

Handle HTML generation:

```typescript
export class WebviewRenderer {
  constructor(private webview: vscode.Webview, private extensionUri: vscode.Uri);

  getHtml(board: Board, nonce: string): string;

  // Private helpers
  private getStyles(): string;
  private getScripts(nonce: string): string;
  private renderBoard(board: Board): string;
}
```

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

In the webview JavaScript (inside `_getHtmlForWebview`), `pendingUncheckLine` is used but never declared. Add proper declaration:

```javascript
let pendingUncheckLine = null;
```

### Task 5.3: Audit and remove any other dead code

Search for unused exports and remove them.

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
| `src/KanbanViewProvider.ts` | 2, 3, 5 | Use types, delegate to extracted classes, fix bugs |
| `src/extension.ts` | 3 | Update provider instantiation |
| `src/test/serializer.test.ts` | 6 | Add more test cases |

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
