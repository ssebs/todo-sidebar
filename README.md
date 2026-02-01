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

### Initial Setup
- Create H2 sections in your MD file
  - **IMPORTANT:** Make sure to create a "Done" section
  - Just include the word "done", and only have 1
- Run VSCode command: **Todo Sidebar: Open Markdown File**
  - Select your markdown file
- Toggle VSCode Secondary Sidebar (CTRL + ALT + B) (or CMD + ALT + B on Mac)
  - Drag the Todo Sidebar icon from the left bar to the right (see gif)

### Using it
- Click the + to add a task, or the arrow to open in the editor
- Drag tasks between columns, check/uncheck to toggle status
- Check the boxes to mark tasks as done

## Screenshot / gif

![Usage vid](https://raw.githubusercontent.com/ssebs/todo-sidebar/main/img/usage.webp)

## TODO
- ensure that other MD in the file is left alone.
- When you open the extension without any file saved, pick a file automatically
- Cleanup the code
- delete button on rows
- GH action to build / run tests / publish

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

[Apache v2](https://raw.githubusercontent.com/ssebs/todo-sidebar/main/LICENSE)
