# Todo Sidebar

A VSCode extension that renders a Kanban-style todo board in the sidebar, parsed directly from Markdown files.

> Sorry, this is a vibe-coded app. I just wanted the feature 🤷‍♀️

## Install

- [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=SebastianSafari.todo-sidebar-md)
- [Open-VSX Marketplace](https://open-vsx.org/extension/SebastianSafari/todo-sidebar-md)

## Features

- **Markdown-powered** - Your todos live in plain `.md` files, not a proprietary format
- **Kanban board view** - Visualize tasks across columns defined by `## Headers`
- **Live sync** - Changes in the editor instantly update the board and vice versa
- **Drag and drop** - Move tasks between columns or nest them under parent tasks
- **Right-click to move** - Right-click any task to quickly move it to a different section
- **Nested tasks** - Support for subtasks
- **Add tasks** - Click "+" to add tasks to columns or subtasks to existing tasks
- **Inline editing** - Double-click any task to edit its text
- **Checkbox support** - Works with `- [ ]`/`- [x]` and unicode `☐`/`☑` checkboxes
- **Auto-move to Done** - Checking a task automatically moves it to your Done column
- **Keep the rest of your MD file untouched** - Only tasks you drag / interact with will move, other markdown will stay.
- **History support** (ctrl+z, ctrl+y)

## Usage

### Initial Setup

- Create H2 sections in your MD file
  - **IMPORTANT:** Make sure to create a "Done" section
  - Just include the word "done", and only have 1
- Run VSCode command: **Todo Sidebar: Open Markdown File**
  - Select your markdown file
  - Note: you can also use a relative path to the workspace. (e.g. `./TODO.md`)
- Toggle VSCode Secondary Sidebar (CTRL + ALT + B) (or CMD + ALT + B on Mac)
  - Drag the Todo Sidebar icon from the left bar to the right (see gif)

### Using it

- Click the + to add a task, or the arrow to open in the editor
- Drag tasks between columns, check/uncheck to toggle status
- Right-click a task to move it to any section
- Check the boxes to mark tasks as done

## Screenshot / gif

![Usage vid](https://raw.githubusercontent.com/ssebs/todo-sidebar/main/img/usage.webp)

## TODO
- Cleanup main file - split into:
  - filesystem
  - parser + file parsing code is regex hell
  - handlers
  - existing provider lifecycle
- Add option to delete completed tasks instead of moving to done. (or move to separate file?)
- Can't move childtask to a grandchild task by dragging
- option to hide h2 sections & save the name to the settings json as an array
- When you open the extension without any file saved, pick a file automatically

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
> This is a sub-description

- [ ] Task 3
  - [ ] Subtask 1
  - [ ] Subtask 2
- [ ] Task 4

## Done

- [x] Finished item
- [x] Another thing
  - [x] Sub other thing
```

## Building

## Local

- `npm install`
- `npm watch`
  - Then, hit F5 to debug.

### Publishing

- Confirm everything is working & compiles
- Update version in [package.json](./package.json) (e.g. "0.0.3")
- `vsce package`
- `git add -A; git commit -m 'v0.0.3 release'; git push; git tag v0.0.3; git push origin v0.0.3`
- [Github Actions](./.github/workflows/main.yml) are configured to build & publish when a new tag is created, so on sucess it will auto publish
  - These use auth token repo secrets to push to both extension galleries.

## LICENSE

[Apache v2](https://raw.githubusercontent.com/ssebs/todo-sidebar/main/LICENSE)
