# To-Do Sidebar

A vscode extension to have Markdown/todo file in secondary side bar

## Problem

The secondary sidebar needs to have a specific "View" in it to be used.

You can't just drag a text file to that panel.

## POC

- Render a text file
- or, use existing editor

## To Test code
Press F5 to launch the extension development host
Click the "Todo Board" icon in the activity bar (checklist icon)
Run command "Todo Sidebar: Open Markdown File" and select a markdown file with ## Section headers and - [ ] tasks


## MVP

Kanban todo / planner tool

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
