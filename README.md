# Todo Sidebar

A VSCode extension that renders a Kanban-style todo board in the sidebar, parsed directly from Markdown files.

> Sorry, this is a vibe-coded app. I just wanted the feature 🤷‍♀️

## Features

- **Markdown-powered** - Your todos live in plain `.md` files, not a proprietary format
- **Kanban board view** - Visualize tasks across columns defined by `## Headers`
- **Live sync** - Changes in the editor instantly update the board and vice versa
- **Drag and drop** - Move tasks between columns or nest them under parent tasks
- **Nested tasks** - Support for subtasks
- **Add tasks** - Click "+" to add tasks to columns or subtasks to existing tasks
- **Inline editing** - Double-click any task to edit its text
- **Checkbox support** - Works with `- [ ]`/`- [x]` and unicode `☐`/`☑` checkboxes
- **Auto-move to Done** - Checking a task automatically moves it to your Done column

## Usage

- Open the **Todo Board panel** in the sidebar
- Run command: **Todo Sidebar: Open Markdown File**
- Select your markdown file
- Drag tasks between columns, check/uncheck to toggle status
- You can move this panel to the right by dragging it over

## TODO

- delete button on rows
- cleanup the code

## Markdown Format

```md
# Board Title

> Optional description

## In Progress

- [ ] Task 1
- [ ] Task 2
  - [ ] Subtask 1
  - [ ] Subtask 2

## Backlog

- [ ] Task 3
  - [ ] Subtask 1
  - [ ] Subtask 2
- [ ] Task 4

## Done

- [x] Finished item
- [x] Another thing
  - [x] Sub other thing

```

## LICENSE

[Apache v2](./LICENSE)
