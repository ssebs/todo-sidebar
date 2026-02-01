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
- **Keep the rest of your MD file untouched** - Only tasks you drag / interact with will move, other markdown will stay.


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

- option to hide h2 sections & save the name to the settings json as an array
- When you open the extension without any file saved, pick a file automatically
- add delete task button, delete that whole line
- don't shrink text on grandchild tasks, keep at same size as child tasks

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
