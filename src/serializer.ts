export function toggleTaskInContent(content: string, line: number, checked: boolean): string {
  // Detect line ending style
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const lineIndex = line - 1; // Convert to 0-indexed

  if (lineIndex >= 0 && lineIndex < lines.length) {
    const currentLine = lines[lineIndex];
    if (checked) {
      // Handle markdown checkboxes: - [ ] or * [ ]
      let newLine = currentLine.replace(/([-*]\s+)\[ \]/, '$1[x]');
      // Handle unicode checkboxes: ☐ -> ☑
      newLine = newLine.replace(/([-*]\s+)☐/, '$1☑');
      lines[lineIndex] = newLine;
    } else {
      // Handle markdown checkboxes: - [x] or * [x]
      let newLine = currentLine.replace(/([-*]\s+)\[[xX]\]/, '$1[ ]');
      // Handle unicode checkboxes: ☑ or ✓ -> ☐
      newLine = newLine.replace(/([-*]\s+)[☑✓]/, '$1☐');
      lines[lineIndex] = newLine;
    }
  }

  return lines.join(lineEnding);
}

export function moveTaskInContent(
  content: string,
  taskLine: number,
  targetSectionTitle: string,
  position: 'top' | 'bottom' | 'after' = 'bottom',
  afterLine?: number
): string {
  // Detect line ending style
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const lineIndex = taskLine - 1;

  // Find the task and all its children (indented lines below it)
  const taskLines: string[] = [];
  const taskIndent = lines[lineIndex]?.match(/^(\s*)/)?.[1].length ?? 0;

  // Add the task line
  taskLines.push(lines[lineIndex]);

  // Add all children (lines with greater indentation following the task)
  let i = lineIndex + 1;
  while (i < lines.length) {
    const currentLine = lines[i];
    const currentIndent = currentLine.match(/^(\s*)/)?.[1].length ?? 0;

    // Empty line or line with content at same/less indentation ends the block
    if (currentLine.trim() === '') {
      break;
    }
    if (currentIndent <= taskIndent && currentLine.trim() !== '') {
      break;
    }

    taskLines.push(currentLine);
    i++;
  }

  // De-indent the task block to become top-level
  const deindentedLines = taskLines.map(line => {
    if (line.startsWith(' '.repeat(taskIndent))) {
      return line.slice(taskIndent);
    }
    return line;
  });

  // Remove the task block from original position
  const beforeTask = lines.slice(0, lineIndex);
  const afterTask = lines.slice(lineIndex + taskLines.length);
  const newLines = [...beforeTask, ...afterTask];

  // Find the target section and insert position
  let targetInsertIndex = -1;

  // If position is 'after', we need to find the line to insert after
  // The afterLine was given in original line numbers, but we need to adjust for removed lines
  let adjustedAfterLine = afterLine;
  if (afterLine !== undefined && taskLine < afterLine) {
    // Task was removed from before afterLine, so adjust
    adjustedAfterLine = afterLine - taskLines.length;
  }

  for (let j = 0; j < newLines.length; j++) {
    const sectionMatch = newLines[j].match(/^##\s+(.+)$/);
    if (sectionMatch) {
      const sectionTitle = sectionMatch[1].trim();
      if (sectionTitle === targetSectionTitle || sectionTitle.startsWith(targetSectionTitle)) {
        if (position === 'top') {
          // Insert right after the section header (skip empty lines)
          let insertAfterHeader = j + 1;
          while (insertAfterHeader < newLines.length && newLines[insertAfterHeader].trim() === '') {
            insertAfterHeader++;
          }
          targetInsertIndex = insertAfterHeader;
        } else if (position === 'after' && adjustedAfterLine !== undefined) {
          // Find the task at adjustedAfterLine and insert after it and its children
          const afterIndex = adjustedAfterLine - 1; // Convert to 0-indexed
          if (afterIndex >= 0 && afterIndex < newLines.length) {
            const afterTaskIndent = newLines[afterIndex]?.match(/^(\s*)/)?.[1].length ?? 0;
            let insertAfter = afterIndex + 1;
            // Skip over children of the after task
            while (insertAfter < newLines.length) {
              const currentLine = newLines[insertAfter];
              const currentIndent = currentLine.match(/^(\s*)/)?.[1].length ?? 0;
              if (currentLine.trim() === '' || currentIndent <= afterTaskIndent) {
                break;
              }
              insertAfter++;
            }
            targetInsertIndex = insertAfter;
          }
        } else {
          // 'bottom' - Find the end of this section
          let endOfSection = j + 1;
          while (endOfSection < newLines.length) {
            if (newLines[endOfSection].match(/^##\s+/)) {
              break;
            }
            endOfSection++;
          }
          targetInsertIndex = endOfSection;
        }
        break;
      }
    }
  }

  if (targetInsertIndex === -1) {
    // Target section not found, return unchanged
    return content;
  }

  // Insert task lines at the target position
  const result = [
    ...newLines.slice(0, targetInsertIndex),
    ...deindentedLines,
    '',
    ...newLines.slice(targetInsertIndex)
  ];

  // Clean up multiple consecutive empty lines
  const cleaned: string[] = [];
  let lastWasEmpty = false;
  for (const resultLine of result) {
    const isEmpty = resultLine.trim() === '';
    if (isEmpty && lastWasEmpty) {
      continue;
    }
    cleaned.push(resultLine);
    lastWasEmpty = isEmpty;
  }

  return cleaned.join(lineEnding);
}

export function moveTaskToParent(
  content: string,
  taskLine: number,
  parentLine: number,
  position: 'top' | 'bottom' | 'after' = 'bottom',
  afterLine?: number
): string {
  // Detect line ending style
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const taskIndex = taskLine - 1;
  const parentIndex = parentLine - 1;

  // Get the task line content
  const taskContent = lines[taskIndex];
  if (!taskContent) {
    return content;
  }

  // Extract task text (remove leading whitespace, bullet, and checkbox)
  const taskMatch = taskContent.match(/^\s*[-*]\s+(\[[ xX]\]|[☐☑✓✗])?\s*(.+)$/);
  if (!taskMatch) {
    return content;
  }
  const checkboxPart = taskMatch[1] || '[ ]';
  const taskText = taskMatch[2];

  // Get the parent's indentation level
  const parentContent = lines[parentIndex];
  if (!parentContent) {
    return content;
  }
  const parentIndent = parentContent.match(/^(\s*)/)?.[1].length ?? 0;
  const childIndent = ' '.repeat(parentIndent + 2);

  // Find all children of the task being moved (to move them too)
  const taskLines: string[] = [];
  const originalTaskIndent = taskContent.match(/^(\s*)/)?.[1].length ?? 0;

  // The task itself, re-indented as a child
  taskLines.push(`${childIndent}- ${checkboxPart} ${taskText}`);

  // Find and re-indent any children of the moved task
  let i = taskIndex + 1;
  while (i < lines.length) {
    const currentLine = lines[i];
    const currentIndent = currentLine.match(/^(\s*)/)?.[1].length ?? 0;

    if (currentLine.trim() === '') {
      break;
    }
    if (currentIndent <= originalTaskIndent && currentLine.trim() !== '') {
      break;
    }

    // Re-indent the child line
    const childMatch = currentLine.match(/^(\s*)(.+)$/);
    if (childMatch) {
      const relativeIndent = currentIndent - originalTaskIndent;
      const newIndent = ' '.repeat(parentIndent + 2 + relativeIndent);
      taskLines.push(`${newIndent}${childMatch[2]}`);
    }
    i++;
  }

  // Remove the task (and its children) from original position
  const originalTaskBlockLength = i - taskIndex;

  // Calculate adjusted parent index after removal
  let adjustedParentIndex = parentIndex;
  if (taskIndex < parentIndex) {
    adjustedParentIndex = parentIndex - originalTaskBlockLength;
  }

  // Remove task block
  const beforeTask = lines.slice(0, taskIndex);
  const afterTask = lines.slice(taskIndex + originalTaskBlockLength);
  const newLines = [...beforeTask, ...afterTask];

  // Find insertion point - right after the parent or at end of parent's children
  let insertIndex: number;
  const adjustedParentContent = newLines[adjustedParentIndex];
  const adjustedParentIndent = adjustedParentContent?.match(/^(\s*)/)?.[1].length ?? 0;

  if (position === 'top') {
    // Insert right after parent line
    insertIndex = adjustedParentIndex + 1;
  } else if (position === 'after' && afterLine !== undefined) {
    // Calculate adjusted afterLine
    let adjustedAfterLine = afterLine;
    if (taskIndex < afterLine) {
      adjustedAfterLine = afterLine - originalTaskBlockLength;
    }
    const afterIndex = adjustedAfterLine - 1; // Convert to 0-indexed
    if (afterIndex >= 0 && afterIndex < newLines.length) {
      // Find end of the "after" task's children
      const afterTaskIndent = newLines[afterIndex]?.match(/^(\s*)/)?.[1].length ?? 0;
      insertIndex = afterIndex + 1;
      while (insertIndex < newLines.length) {
        const currentLine = newLines[insertIndex];
        const currentIndent = currentLine.match(/^(\s*)/)?.[1].length ?? 0;
        if (currentLine.trim() === '' || currentIndent <= afterTaskIndent) {
          break;
        }
        insertIndex++;
      }
    } else {
      // Fallback to end of parent's children
      insertIndex = adjustedParentIndex + 1;
    }
  } else {
    // 'bottom' - Find end of parent's children
    insertIndex = adjustedParentIndex + 1;
    while (insertIndex < newLines.length) {
      const currentLine = newLines[insertIndex];
      const currentIndent = currentLine.match(/^(\s*)/)?.[1].length ?? 0;

      if (currentLine.trim() === '') {
        break;
      }
      if (currentIndent <= adjustedParentIndent) {
        break;
      }
      insertIndex++;
    }
  }

  // Insert the task lines
  const result = [
    ...newLines.slice(0, insertIndex),
    ...taskLines,
    ...newLines.slice(insertIndex)
  ];

  // Clean up multiple consecutive empty lines
  const cleaned: string[] = [];
  let lastWasEmpty = false;
  for (const resultLine of result) {
    const isEmpty = resultLine.trim() === '';
    if (isEmpty && lastWasEmpty) {
      continue;
    }
    cleaned.push(resultLine);
    lastWasEmpty = isEmpty;
  }

  return cleaned.join(lineEnding);
}

export function addTaskToSection(
  content: string,
  sectionTitle: string
): { content: string; line: number } {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);

  // Find the section header
  let sectionIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^##\s+(.+)$/);
    if (match && match[1].trim() === sectionTitle) {
      sectionIndex = i;
      break;
    }
  }

  if (sectionIndex === -1) {
    return { content, line: -1 };
  }

  // Find insertion point (skip blank lines after header)
  let insertIndex = sectionIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
    insertIndex++;
  }

  // Insert new task
  const newTask = '- [ ] New task';
  lines.splice(insertIndex, 0, newTask);

  return {
    content: lines.join(lineEnding),
    line: insertIndex + 1 // 1-indexed
  };
}

export function editTaskTextInContent(
  content: string,
  line: number,
  newText: string
): string {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const lineIndex = line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) {
    return content;
  }

  const currentLine = lines[lineIndex];

  // Match markdown checkbox: - [ ] text or - [x] text
  const mdMatch = currentLine.match(/^(\s*[-*]\s+\[[ xX]\]\s+)(.+)$/);
  if (mdMatch) {
    lines[lineIndex] = mdMatch[1] + newText;
    return lines.join(lineEnding);
  }

  // Match unicode checkbox: - ☐ text or - ☑ text
  const unicodeMatch = currentLine.match(/^(\s*[-*]\s+[☐☑✓✗]\s+)(.+)$/);
  if (unicodeMatch) {
    lines[lineIndex] = unicodeMatch[1] + newText;
    return lines.join(lineEnding);
  }

  return content;
}

export function addSubtaskToParent(
  content: string,
  parentLine: number
): { content: string; line: number } {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const parentIndex = parentLine - 1;

  if (parentIndex < 0 || parentIndex >= lines.length) {
    return { content, line: -1 };
  }

  const parentContent = lines[parentIndex];
  const parentIndent = parentContent.match(/^(\s*)/)?.[1].length ?? 0;
  const childIndent = ' '.repeat(parentIndent + 2);

  // Find insertion point: after parent and all its existing children
  let insertIndex = parentIndex + 1;
  while (insertIndex < lines.length) {
    const currentLine = lines[insertIndex];
    const currentIndent = currentLine.match(/^(\s*)/)?.[1].length ?? 0;

    if (currentLine.trim() === '') {
      break;
    }
    if (currentIndent <= parentIndent) {
      break;
    }
    insertIndex++;
  }

  // Insert new subtask
  const newTask = `${childIndent}- [ ] New task`;
  lines.splice(insertIndex, 0, newTask);

  return {
    content: lines.join(lineEnding),
    line: insertIndex + 1 // 1-indexed
  };
}

export function removeCheckboxFromTask(
  content: string,
  line: number
): string {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const lineIndex = line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) {
    return content;
  }

  const currentLine = lines[lineIndex];

  // Match markdown checkbox: - [ ] text or - [x] text and convert to - text
  const mdMatch = currentLine.match(/^(\s*[-*]\s+)\[[ xX]\]\s+(.+)$/);
  if (mdMatch) {
    lines[lineIndex] = mdMatch[1] + mdMatch[2];
    return lines.join(lineEnding);
  }

  // Match unicode checkbox: - ☐ text or - ☑ text and convert to - text
  const unicodeMatch = currentLine.match(/^(\s*[-*]\s+)[☐☑✓✗]\s+(.+)$/);
  if (unicodeMatch) {
    lines[lineIndex] = unicodeMatch[1] + unicodeMatch[2];
    return lines.join(lineEnding);
  }

  return content;
}
