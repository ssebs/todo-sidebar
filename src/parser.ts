export interface Task {
  text: string;
  checked: boolean;
  line: number;
  children: Task[];
  hasCheckbox: boolean;
}

export interface Column {
  title: string;
  description: string;
  line: number;
  isDoneColumn: boolean;
  tasks: Task[];
}

export interface Board {
  title: string;
  description: string;
  columns: Column[];
}

// Regex constants for parsing markdown patterns
const TITLE_REGEX = /^#\s+([^#].*)$/;
const DESCRIPTION_REGEX = /^>\s*(.*)$/;
const COLUMN_HEADER_REGEX = /^##\s+(.+)$/;
const MD_TASK_REGEX = /^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/;
const UNICODE_TASK_REGEX = /^(\s*)[-*]\s+([☐☑✓✗])\s+(.+)$/;
const NESTED_QUOTE_REGEX = /^(\s*)[-*]\s+>\s*(.+)$/;
const BULLET_REGEX = /^(\s+)[-*]\s+(.+)$/;
const CHECKBOX_PREFIX_REGEX = /^\[[ xX]\]|^[☐☑✓✗]/;

export function parseMarkdown(content: string): Board {
  // Normalize line endings (handle Windows \r\n and Mac \r)
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n');
  const board: Board = {
    title: '',
    description: '',
    columns: []
  };

  let currentColumn: Column | null = null;
  let taskStack: { task: Task; indent: number }[] = [];
  let foundFirstColumn = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1; // 1-indexed for editor navigation

    // Board title: # Title (only before first column)
    if (!foundFirstColumn) {
      const titleMatch = line.match(TITLE_REGEX);
      if (titleMatch) {
        board.title = titleMatch[1].trim();
        continue;
      }

      // Description: > text (only before first column, not indented)
      const descMatch = line.match(DESCRIPTION_REGEX);
      if (descMatch) {
        if (board.description) {
          board.description += '\n' + descMatch[1];
        } else {
          board.description = descMatch[1];
        }
        continue;
      }
    }

    // Column header: ## Section
    const columnMatch = line.match(COLUMN_HEADER_REGEX);
    if (columnMatch) {
      foundFirstColumn = true;
      const title = columnMatch[1].trim();
      currentColumn = {
        title,
        description: '',
        line: lineNumber,
        isDoneColumn: title.toLowerCase().includes('done'),
        tasks: []
      };
      board.columns.push(currentColumn);
      taskStack = [];
      continue;
    }

    // Column description: > text (after column header, before any tasks)
    if (currentColumn && currentColumn.tasks.length === 0) {
      const descMatch = line.match(DESCRIPTION_REGEX);
      if (descMatch) {
        if (currentColumn.description) {
          currentColumn.description += '\n' + descMatch[1];
        } else {
          currentColumn.description = descMatch[1];
        }
        continue;
      }
    }

    // Task with markdown checkbox: - [ ] or - [x] or * [ ] or * [x]
    const taskMatch = line.match(MD_TASK_REGEX);
    if (taskMatch && currentColumn) {
      const indent = taskMatch[1].length;
      const checked = taskMatch[2].toLowerCase() === 'x';
      const text = taskMatch[3].trim();

      const task: Task = {
        text,
        checked,
        line: lineNumber,
        children: [],
        hasCheckbox: true
      };

      // Find parent based on indentation
      while (taskStack.length > 0 && taskStack[taskStack.length - 1].indent >= indent) {
        taskStack.pop();
      }

      if (taskStack.length > 0) {
        // Add as child to parent
        taskStack[taskStack.length - 1].task.children.push(task);
      } else {
        // Add as top-level task
        currentColumn.tasks.push(task);
      }

      taskStack.push({ task, indent });
      continue;
    }

    // Task with unicode checkbox: * ☐ or * ☑ or - ☐ or - ☑
    const unicodeTaskMatch = line.match(UNICODE_TASK_REGEX);
    if (unicodeTaskMatch && currentColumn) {
      const indent = unicodeTaskMatch[1].length;
      const checkChar = unicodeTaskMatch[2];
      const checked = checkChar === '☑' || checkChar === '✓';
      const text = unicodeTaskMatch[3].trim();

      const task: Task = {
        text,
        checked,
        line: lineNumber,
        children: [],
        hasCheckbox: true
      };

      while (taskStack.length > 0 && taskStack[taskStack.length - 1].indent >= indent) {
        taskStack.pop();
      }

      if (taskStack.length > 0) {
        taskStack[taskStack.length - 1].task.children.push(task);
      } else {
        currentColumn.tasks.push(task);
      }

      taskStack.push({ task, indent });
      continue;
    }

    // Nested item with > prefix (like "  * > really good")
    const nestedQuoteMatch = line.match(NESTED_QUOTE_REGEX);
    if (nestedQuoteMatch && taskStack.length > 0) {
      const text = nestedQuoteMatch[2].trim();

      const childTask: Task = {
        text,
        checked: false,
        line: lineNumber,
        children: [],
        hasCheckbox: false
      };

      // Add to most recent task
      taskStack[taskStack.length - 1].task.children.push(childTask);
      continue;
    }

    // Nested bullet point: - item or * item (without checkbox, indented)
    const bulletMatch = line.match(BULLET_REGEX);
    if (bulletMatch && taskStack.length > 0) {
      const indent = bulletMatch[1].length;
      const text = bulletMatch[2].trim();

      // Skip if it looks like a checkbox we didn't match
      if (text.match(CHECKBOX_PREFIX_REGEX)) {
        continue;
      }

      const childTask: Task = {
        text,
        checked: false,
        line: lineNumber,
        children: [],
        hasCheckbox: false
      };

      // Find appropriate parent based on indentation
      while (taskStack.length > 1 && taskStack[taskStack.length - 1].indent >= indent) {
        taskStack.pop();
      }

      if (taskStack.length > 0) {
        taskStack[taskStack.length - 1].task.children.push(childTask);
      }
    }
  }

  return board;
}
