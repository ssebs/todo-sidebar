# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication style for user
- Be concise, not verbose when telling the user something.

- Ask clarifying questions if you need to make an ambiguous choice.

## Build Commands

```bash
npm run compile        # Build with webpack
npm run watch          # Build and watch for changes
npm run lint           # Run ESLint on src/
npm run compile-tests  # Compile tests to out/ directory
npm run test           # Run tests (runs compile-tests, compile, lint first via pretest)
npm run package        # Production build
```

## Testing the Extension

Press F5 in VSCode to launch the extension development host (uses `.vscode/launch.json` configuration). Click the "Todo Board" icon in the activity bar, then run command "Todo Sidebar: Open Markdown File" to select a markdown file.

Tests are located in `src/test/` and use the Mocha framework with `@vscode/test-cli`.

## Architecture

This is a VSCode extension that renders a Kanban-style todo board in the sidebar, parsed from Markdown files.

### Core Components

- **extension.ts** - Entry point. Registers the webview provider and commands (`todoSidebar.openFile`, `todoSidebar.refresh`).

- **KanbanViewProvider.ts** - The main webview provider. Contains:
  - Loads HTML/CSS/JS from `webview.html` template file (or `welcome.html` when no file is configured)
  - Welcome wizard shown on first launch when `todoSidebar.activeFile` is not set
  - Message handlers for webview-to-extension communication (`toggle`, `move`, `moveToParent`, `getColumns`, `openAtLine`, `addTask`, `editTaskText`, `addSubtask`, `addTaskToSubCategory`, `undo`, `redo`, `deleteTask`, `hideSection`, `editStart`/`editEnd`, `selectFile`, `saveWizard`, `cancelWizard`)
  - File watchers to auto-refresh when the markdown file changes (set up only once to avoid duplicates). Watches the active markdown file, `.vscode/settings.json`, and listens to `onDidChangeConfiguration` for `todoSidebar.activeFile` and `todoSidebar.hiddenSections`.
  - Drag-and-drop supports precise positioning with 'top', 'bottom', and 'after' positions using `afterLine` parameter
  - Periodic refresh every 5 seconds while the panel is visible (catches external edits); paused when hidden
  - Debounced (100ms) refresh on file watcher events; an `_ignoreNextFileChange` flag suppresses the watcher event triggered by our own writes
  - `_isEditing` flag (set via `editStart`/`editEnd` messages) skips refreshes while the user is inline-editing a task, unless forced or a `_pendingEditLine` is set
  - Serialized writes via `_isWriting` mutex + `_writeQueue` to prevent concurrent file modifications
  - In-memory undo/redo history stack (max 50 entries) tracking full file content; cleared when switching files. `_isUndoRedo` flag prevents undo/redo writes from being pushed back onto the stack.

- **webview.html** - Webview UI template containing:
  - HTML structure and CSS styles for the Kanban board interface
  - JavaScript for rendering and user interactions
  - Uses SortableJS (loaded from CDN: `cdn.jsdelivr.net`) for drag-and-drop with `group: 'shared'` allowing tasks to move between columns and in/out of parent tasks
  - CSP configured to allow scripts from jsdelivr CDN
  - Template placeholders `{{cspSource}}` and `{{nonce}}` are replaced at runtime by KanbanViewProvider

- **parser.ts** - Parses markdown into a `Board` structure. Handles:
  - `# Title` for board title
  - `> Quote` for board description (before first column)
  - `## Section` for columns (columns with "done" in title are marked `isDoneColumn`)
  - `> Quote` after `## Section` for column description (before any tasks or subcategories)
  - `### Subheading` for subcategories within a column (tasks following a `###` are attached to that subcategory rather than the column root)
  - `- [ ]` / `- [x]` for tasks with markdown checkboxes (also `*` bullets)
  - `- ☐` / `- ☑` / `- ✓` / `- ✗` for unicode checkboxes
  - `- text` plain bullets without checkboxes (rendered as items with `hasCheckbox: false`)
  - `  - > text` nested quote items become non-checkbox children of the most recent task
  - Indentation-based parent/child task hierarchy (recursive, supports deep nesting)
  - Normalizes CRLF/CR to LF before parsing

- **serializer.ts** - Modifies markdown content:
  - `toggleTaskInContent()` - Toggle checkbox state at a line (handles both markdown and unicode checkboxes)
  - `moveTaskInContent()` - Move task (with children) to a column at top, bottom, or after a specific line
  - `moveTaskToParent()` - Nest a task under another task, handling re-indentation
  - `addTaskToSection()` - Add a new task to a section, returns `{ content, line }`
  - `addTaskToSubCategory()` - Add a new task under a `###` subcategory within a section
  - `addSubtaskToParent()` - Add a subtask under a parent task, returns `{ content, line }`
  - `editTaskTextInContent()` - Edit task text in place (works for md checkbox, unicode checkbox, or plain bullet)
  - `deleteTaskInContent()` - Delete a task and all its indented children
  - `removeCheckboxFromTask()` - Strip the checkbox marker from a task line, leaving a plain bullet
  - All functions preserve line ending style (CRLF vs LF) from the original file

- **welcome.html** - Welcome wizard UI shown on first launch. Contains:
  - File selection step (prompts user to select a markdown file)
  - onDoneAction setting selection with descriptions of each option
  - Tips section loaded from `tips.html` for easy editing
  - Save/Cancel buttons to complete or skip setup

- **tips.html** - Easily editable tips content shown in the welcome wizard. Can be customized to show different tips to users on first launch.

### Data Flow

1. User opens markdown file via command
2. `parser.ts` converts markdown to `Board` (columns with tasks)
3. Webview renders the board (with recursive `renderChildTask` for nested children)
4. User interactions (check, drag, edit, add) send messages to extension
5. `serializer.ts` modifies the raw markdown text
6. File is written back, triggering watcher to re-parse and update UI

### Key Types (parser.ts)

```typescript
interface Task { text: string; checked: boolean; line: number; children: Task[]; hasCheckbox: boolean; }
interface SubCategory { title: string; line: number; tasks: Task[]; }
interface Column { title: string; description: string; line: number; isDoneColumn: boolean; tasks: Task[]; subCategories: SubCategory[]; }
interface Board { title: string; description: string; columns: Column[]; }
```

Top-level tasks under a column live in `Column.tasks`. Tasks under a `### Subheading` live in the matching `SubCategory.tasks` (and are NOT also in `Column.tasks`). The "is this a top-level task" check used by toggle/done-handling considers both `Column.tasks` and `SubCategory.tasks` to be top-level.

### State Persistence

The selected markdown file path is persisted to `.vscode/settings.json` via the workspace configuration setting `todoSidebar.activeFile`. The file path is saved when a user selects a markdown file via the "Todo Sidebar: Open Markdown File" command, and is automatically restored when the extension loads or the panel becomes visible.

### Configuration

- **todoSidebar.activeFile** (string): Path to the currently active markdown file for the todo board. Stored in `.vscode/settings.json` and can be relative (e.g., `./README.md`) or absolute.

- **todoSidebar.onDoneAction** (string: "move" | "delete"): Action to perform when a top-level task is marked as complete (checkbox checked). Defaults to "move".
  - `"move"` (default): Toggles checkbox to `[x]` and moves task to Done column at top
  - `"delete"`: Immediately deletes task and all its children without toggling checkbox. No confirmation dialog - relies on VSCode's undo (Ctrl+Z) for recovery.
  - Only affects top-level tasks; subtasks always just toggle in place regardless of this setting.

- **todoSidebar.hiddenSections** (array of strings): List of section names (H2 headers) to hide from the board view. Defaults to [] (empty array, all sections visible). Stored in `.vscode/settings.json`.
  - Example: `["Done", "Archive"]` will hide sections titled "Done" and "Archive"
  - Supports wildcard patterns: `["*Done*"]` matches any section with "Done" in the name (converted to regex `.*Done.*`)
  - Supports regex patterns: `["^Done$", "Archive.*"]` for complex matching (case-insensitive)
  - Section matching is case-insensitive for exact and wildcard matches
  - Hidden sections remain in the markdown file and are only filtered from the webview display
  - Changes to this setting trigger a board refresh automatically
  - Users can right-click a section header in the webview to hide it instantly (updates settings.json)

### UI Features

- **Toggle checkbox**: Click checkbox to toggle. Behavior for top-level tasks depends on `todoSidebar.onDoneAction` setting: either move to Done column (default) or delete entirely. Subtasks always just toggle in place.
- **Drag and drop**: Reorder tasks within columns, move between columns, or nest under parent tasks.
- **Right-click task to move**: Right-click a task to show a context menu for moving it to any section (moves to top of target section).
- **Right-click section to hide**: Right-click a section header to hide it from the board view (adds it to `hiddenSections` setting).
- **Double-click to edit**: Double-click anywhere on a task box (not just the text) to enter inline edit mode. The webview sends `editStart`/`editEnd` so the extension can pause refreshes while editing.
- **Add task**: Click "+" button next to column header to add a new task. Subcategories (`###`) get their own "+" to add tasks within that subcategory.
- **Add subtask**: Click "+" button on a task to add a subtask beneath it.
- **Delete task**: Sends `deleteTask` message; removes the task and all its indented children.
- **Undo / Redo**: `undo` / `redo` messages walk the in-memory history stack of file contents (max 50 entries, cleared on file switch). This is independent of VSCode's editor undo.
- **Open in editor**: Click arrow button to jump to task's line in the markdown file.

### Markdown Format

```md
# Board Title

> Description

## In Progress

> Tasks currently being worked on

- [ ] Task 1
  - [ ] Subtask
- [x] Completed task

## Done

> Completed tasks

- [x] Finished item
```


# IF ASKED TO "USE GOOD STANDARDS" OR "FOLLOW @Claude.md", USE THE FOLLOWING

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
