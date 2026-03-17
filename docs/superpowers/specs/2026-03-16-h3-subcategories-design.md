# H3 Sub-Categories Design

## Summary

Add `### Header` support within `## Columns` as visual grouping dividers. Tasks under a `###` are visually grouped together. Tasks can also exist ungrouped (before any `###` in a column). Collapsing is out of scope for now.

## Markdown Format

```md
## In Progress

- [ ] Ungrouped task

### Frontend
- [ ] Build login page
- [ ] Style navbar

### Backend
- [ ] Add auth endpoint
```

## Data Model

New type in `parser.ts`:

```typescript
interface SubCategory {
  title: string;
  line: number;
  tasks: Task[];
}
```

Extend `Column`:

```typescript
interface Column {
  title: string;
  description: string;
  line: number;
  isDoneColumn: boolean;
  tasks: Task[];                // ungrouped tasks (not under any ###)
  subCategories: SubCategory[]; // ### groups with their tasks
}
```

## Changes by File

### parser.ts

- Add `SubCategory` interface and export it.
- Add regex: `const SUBCATEGORY_HEADER_REGEX = /^###\s+(.+)$/;`
- Recognize `### Header` lines within a column (after `##`, before next `##`).
- When a `###` is encountered, reset `taskStack` (same as when `##` is hit) to prevent incorrect parent/child associations.
- Tasks after a `###` go into that subcategory's `tasks` array instead of `column.tasks`.
- Tasks before any `###` stay in `column.tasks` as today.
- Column description parsing (`> text` after `##`) must also check that no subcategories have been added yet (not just `tasks.length === 0`).
- `>` lines after a `###` header are NOT treated as descriptions (SubCategory has no description field); they would be ignored or treated as regular content.

### webview.html

- New `renderSubCategory(subCategory, isDoneColumn)` function that renders a styled header and a `.tasks` sortable container.
- `renderColumn()` interleaves ungrouped tasks and subcategories by line number using a merged array: `{type: 'task', item: Task} | {type: 'subCategory', item: SubCategory}`, sorted by `line`/`item.line`.
- Each subcategory's task container gets `data-section` matching the parent column and a `data-subcategory` attribute for identification.
- "+" button on subcategory headers to add tasks within that subcategory.
- Subcategory headers have NO right-click context menu (no hide behavior for now).
- Empty subcategories render the header and an empty drop zone (min-height from `.tasks` CSS).
- Styling: subcategory header as a smaller, lighter divider label within the column.
- Dragging between subcategories within the same column works via `group: 'shared'` on all SortableJS containers.

### serializer.ts

- **Fix `SECTION_HEADER_REGEX`**: Change from `/^##\s+(.+)$/` to `/^##\s+(?!#)(.+)$/` (negative lookahead). Without this, `###` lines would be matched as section headers, causing `moveTaskInContent` to terminate early at `###` boundaries when scanning for section ends.
- Add `addTaskToSubCategory(content, sectionTitle, subCategoryTitle)` function. Finds the `###` header within the `##` section and inserts a new task right after it and any blank lines (top of subcategory, consistent with `addTaskToSection` behavior).
- Existing `moveTaskInContent`, `toggleTaskInContent`, `moveTaskToParent`, `editTaskTextInContent`, `deleteTaskInContent` are unchanged since they operate on line numbers.

### KanbanViewProvider.ts

- Handle new `addTaskToSubCategory` message type from webview with `section` and `subCategory` parameters.
- **Update `_isTopLevelTaskInBoard()`**: Must also search through `column.subCategories[].tasks` since tasks inside subcategories are still top-level (not children of other tasks).
- **Update `_findTaskColumnInBoard()`**: Must also search through `column.subCategories[].tasks` and their children.
- Pass subcategories through in the board data sent to webview (already included via parser output).

## Drag-and-Drop Behavior

- Dragging a task within a subcategory reorders using `afterLine` (existing logic).
- Dragging a task into a subcategory's container works via `afterLine` positioning.
- Dragging between subcategories within the same column works (all containers share `group: 'shared'`).
- Dragging a task to the ungrouped area of a column works via existing `move` with `position: 'top'` or `afterLine`.
- No special serializer changes needed since all moves are line-number based.

## Rendering Order

Within a column, items are rendered in document order by creating a merged array of `{type: 'task', item}` and `{type: 'subCategory', item}` entries, sorted by their `line` property. This preserves the author's intended layout.

## Edge Cases

- Column "+" button adds an ungrouped task at the top of the column (before any `###` headers), same as current behavior.
- "Move to top" of a section places the task above the first `###` header (as an ungrouped task).
- "Move to bottom" places after the last `###` group's tasks (end of section).

## Out of Scope

- Collapsible subcategories (planned for later)
- Drag-and-drop of subcategory headers to reorder groups
- `### Done` semantics (no special behavior for subcategories with "done" in name)
- Hiding individual subcategories via `hiddenSections`
- Subcategory descriptions (`>` lines after `###`)
