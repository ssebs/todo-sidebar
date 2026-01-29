# To-Do Sidebar

A vscode extension to have Markdown/todo file in secondary side bar

## Problem

The secondary sidebar needs to have a specific "View" in it to be used.

You can't just drag a text file to that panel.

# Bugs

- Open file once, and load/save it
- nested items cant be moved out (almost works but not)
  - nested checkboxes only should be movable out of the nesting

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
