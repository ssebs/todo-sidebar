# Todo Sidebar

A VSCode extension that renders a Kanban-style todo board in the sidebar, parsed directly from Markdown files.

## Features

- **Markdown-powered** - Your todos live in plain `.md` files, not a proprietary format
- **Kanban board view** - Visualize tasks across columns defined by `## Headers`
- **Drag and drop** - Move tasks between columns or nest them under parent tasks
- **Checkbox support** - Works with `- [ ]`/`- [x]` and unicode `☐`/`☑` checkboxes
- **Auto-move to Done** - Checking a task automatically moves it to your Done column
- **Nested tasks** - Support for subtasks and plain bullet children
- **Live sync** - Changes in the editor instantly update the board and vice versa

## Usage
- Open the **Todo Board panel** in the sidebar
- Run command: **Todo Sidebar: Open Markdown File**
- Select your markdown file
- Drag tasks between columns, check/uncheck to toggle status
- You can move this panel to the right by dragging it over


## TODO
- Add tasks to section from editor
- Edit text from tasks & save/sync

## Markdown Format

```md
# Board Title

> Optional description

## In Progress

- [ ] Task 1
  - [ ] Subtask
  - Plain bullet note
- [x] Completed task

## Done

- [x] Finished item



## TODO
- Add new task from extension
- Edit text on text click

### Kanban planning format

```md
# TODO

> Description

## In Progress 🚀

- [ ] start the readme
- [ ] create the extension
  - [ ] do the mvp

## Backlog 📋

- [ ] Make it good

## Done ✅

- [x] Create this example MD
- [x] A second thing
```
