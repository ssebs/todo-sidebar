# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Press F5 in VSCode to launch the extension development host. Click the "Todo Board" icon in the activity bar, then run command "Todo Sidebar: Open Markdown File" to select a markdown file.

## Architecture

This is a VSCode extension that renders a Kanban-style todo board in the sidebar, parsed from Markdown files.

### Core Components

- **extension.ts** - Entry point. Registers the webview provider and commands (`todoSidebar.openFile`, `todoSidebar.refresh`).

- **KanbanViewProvider.ts** - The main webview provider. Contains:
  - Inline HTML/CSS/JS for the webview UI (no separate frontend files)
  - Message handlers for webview-to-extension communication (`toggle`, `move`, `moveToParent`, `getColumns`, `openAtLine`)
  - File watchers to auto-refresh when the markdown file changes
  - Uses SortableJS (loaded from CDN: `cdn.jsdelivr.net`) for drag-and-drop with `group: 'shared'` allowing tasks to move between columns and in/out of parent tasks
  - CSP configured to allow scripts from jsdelivr CDN

- **parser.ts** - Parses markdown into a `Board` structure. Handles:
  - `# Title` for board title
  - `> Quote` for description
  - `## Section` for columns (columns with "done" in title are marked `isDoneColumn`)
  - `- [ ]` / `- [x]` for tasks with markdown checkboxes
  - `- ☐` / `- ☑` for unicode checkboxes
  - Indentation-based parent/child task hierarchy

- **serializer.ts** - Modifies markdown content:
  - `toggleTaskInContent()` - Toggle checkbox state at a line
  - `moveTaskInContent()` - Move task (with children) to a column at top or bottom
  - `moveTaskToParent()` - Nest a task under another task, handling re-indentation

### Data Flow

1. User opens markdown file via command
2. `parser.ts` converts markdown to `Board` (columns with tasks)
3. Webview renders the board
4. User interactions (check, drag) send messages to extension
5. `serializer.ts` modifies the raw markdown text
6. File is written back, triggering watcher to re-parse and update UI

### Key Types (parser.ts)

```typescript
interface Task { text: string; checked: boolean; line: number; children: Task[]; hasCheckbox: boolean; }
interface Column { title: string; line: number; isDoneColumn: boolean; tasks: Task[]; }
interface Board { title: string; description: string; columns: Column[]; }
```

### State Persistence

The selected markdown file URI is persisted via `context.workspaceState` under the key `todoSidebar.activeFile`, allowing the extension to restore the board on reload.

### Markdown Format

```md
# Board Title

> Description

## In Progress

- [ ] Task 1
  - [ ] Subtask
- [x] Completed task

## Done

- [x] Finished item
```
