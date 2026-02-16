import * as assert from 'assert';
import { addTaskToSection, editTaskTextInContent, addSubtaskToParent, removeCheckboxFromTask, moveTaskInContent, moveTaskToParent, deleteTaskInContent } from '../serializer';

suite('Serializer Test Suite', () => {
  suite('addTaskToSection', () => {
    test('adds task after section header with existing tasks', () => {
      const content = `## Todo

- [ ] Existing task

## Done
`;
      const result = addTaskToSection(content, 'Todo');
      assert.ok(result.content.includes('- [ ] New task'));
      assert.strictEqual(result.line, 3); // Line after header + blank
    });
  });

  suite('editTaskTextInContent', () => {
    test('edits markdown checkbox task text', () => {
      const content = `## Todo

- [ ] Old text
- [x] Done task
`;
      const result = editTaskTextInContent(content, 3, 'New text');
      assert.ok(result.includes('- [ ] New text'));
      assert.ok(result.includes('- [x] Done task'));
    });

    test('edits unicode checkbox task text', () => {
      const content = `## Todo

- ☐ Old text
`;
      const result = editTaskTextInContent(content, 3, 'New text');
      assert.ok(result.includes('- ☐ New text'));
    });

    test('preserves indentation', () => {
      const content = `## Todo

- [ ] Parent
  - [ ] Child text
`;
      const result = editTaskTextInContent(content, 4, 'New child');
      assert.ok(result.includes('  - [ ] New child'));
    });
  });

  suite('addSubtaskToParent', () => {
    test('adds subtask under parent with correct indentation', () => {
      const content = `## Todo

- [ ] Parent task

## Done
`;
      const result = addSubtaskToParent(content, 3);
      assert.ok(result.content.includes('  - [ ] New task'));
      assert.strictEqual(result.line, 4);
    });

    test('adds subtask after existing children', () => {
      const content = `## Todo

- [ ] Parent task
  - [ ] Existing child

## Done
`;
      const result = addSubtaskToParent(content, 3);
      assert.ok(result.content.includes('  - [ ] New task'));
      assert.strictEqual(result.line, 5);
    });
  });

  suite('removeCheckboxFromTask', () => {
    test('removes markdown checkbox from task', () => {
      const content = `## Todo

- [ ] Task with checkbox
`;
      const result = removeCheckboxFromTask(content, 3);
      assert.ok(result.includes('- Task with checkbox'));
      assert.ok(!result.includes('[ ]'));
    });

    test('removes checked markdown checkbox', () => {
      const content = `## Todo

- [x] Done task
`;
      const result = removeCheckboxFromTask(content, 3);
      assert.ok(result.includes('- Done task'));
      assert.ok(!result.includes('[x]'));
    });

    test('removes unicode checkbox', () => {
      const content = `## Todo

  - ☐ Subtask
`;
      const result = removeCheckboxFromTask(content, 3);
      assert.ok(result.includes('  - Subtask'));
      assert.ok(!result.includes('☐'));
    });
  });

  suite('moveTaskInContent', () => {
    test('moves task with children to another section', () => {
      const content = `## Todo

- [ ] Parent task
  - [ ] Child 1
  - [ ] Child 2

## Done
`;
      const result = moveTaskInContent(content, 3, 'Done', 'top');
      // Parent and both children should be moved to Done section
      const lines = result.split('\n');
      const doneIndex = lines.findIndex(l => l.startsWith('## Done'));
      // Find content after Done header (skip blank lines)
      const afterDone = lines.slice(doneIndex + 1);
      const firstTaskIndex = afterDone.findIndex(l => l.trim() !== '');
      assert.ok(afterDone[firstTaskIndex].includes('Parent task'), 'Parent should be in Done section');
      assert.ok(afterDone[firstTaskIndex + 1].includes('Child 1'), 'Child 1 should follow parent');
      assert.ok(afterDone[firstTaskIndex + 2].includes('Child 2'), 'Child 2 should follow Child 1');
      // Todo section should be empty (no tasks)
      const todoIndex = lines.findIndex(l => l.startsWith('## Todo'));
      const afterTodo = lines.slice(todoIndex + 1).find(l => l.trim() !== '');
      assert.ok(!afterTodo || afterTodo.startsWith('## Done'), 'Todo section should be empty');
    });

    test('moves task with deeply nested children', () => {
      const content = `## Todo

- [ ] Parent task
  - [ ] Child 1
    - [ ] Grandchild 1
  - [ ] Child 2

## Done
`;
      const result = moveTaskInContent(content, 3, 'Done', 'top');
      const lines = result.split('\n');
      const doneIndex = lines.findIndex(l => l.startsWith('## Done'));
      // Find content after Done header (skip blank lines)
      const afterDone = lines.slice(doneIndex + 1);
      const firstTaskIndex = afterDone.findIndex(l => l.trim() !== '');
      assert.ok(afterDone[firstTaskIndex].includes('Parent task'), 'Parent should be moved');
      assert.ok(afterDone[firstTaskIndex + 1].includes('Child 1'), 'Child 1 should be moved');
      assert.ok(afterDone[firstTaskIndex + 2].includes('Grandchild 1'), 'Grandchild should be moved');
      assert.ok(afterDone[firstTaskIndex + 3].includes('Child 2'), 'Child 2 should be moved');
    });

    test('moves task with blank lines between parent and children', () => {
      const content = `## Todo

- [ ] Parent task

  - [ ] Child 1

    - [ ] Grandchild 1

  - [ ] Child 2

## Done
`;
      const result = moveTaskInContent(content, 3, 'Done', 'top');
      const lines = result.split('\n');
      const doneIndex = lines.findIndex(l => l.startsWith('## Done'));
      // All children should be moved with the parent
      assert.ok(result.includes('Child 1'), 'Child 1 should be in result');
      assert.ok(result.includes('Grandchild 1'), 'Grandchild should be in result');
      assert.ok(result.includes('Child 2'), 'Child 2 should be in result');
      // Todo section should not have these tasks anymore
      const todoSection = content.substring(0, content.indexOf('## Done'));
      const resultTodoSection = result.substring(0, result.indexOf('## Done'));
      assert.ok(!resultTodoSection.includes('Parent task'), 'Parent should not be in Todo');
    });
  });

  suite('moveTaskToParent', () => {
    test('moves task with children to another parent', () => {
      const content = `## Todo

- [ ] Parent A
  - [ ] Child A1
- [ ] Parent B
`;
      // Move Parent A (with Child A1) under Parent B
      const result = moveTaskToParent(content, 3, 5);
      const lines = result.split('\n');
      // Parent B should now have Parent A as a child
      const parentBIndex = lines.findIndex(l => l.includes('Parent B'));
      assert.ok(parentBIndex >= 0, 'Parent B should exist');
      // After Parent B should be Parent A (indented) and then Child A1 (more indented)
      assert.ok(lines[parentBIndex + 1].includes('Parent A'), 'Parent A should be child of Parent B');
      assert.ok(lines[parentBIndex + 2].includes('Child A1'), 'Child A1 should be moved with Parent A');
    });

    test('moves task with blank lines between parent and children', () => {
      const content = `## Todo

- [ ] Parent A

  - [ ] Child A1

    - [ ] Grandchild

- [ ] Parent B
`;
      // Move Parent A (with all children) under Parent B (line 9)
      const result = moveTaskToParent(content, 3, 9);
      // All children should be moved with the parent
      assert.ok(result.includes('Child A1'), 'Child A1 should be in result');
      assert.ok(result.includes('Grandchild'), 'Grandchild should be in result');
      // Parent A should be nested under Parent B
      const lines = result.split('\n');
      const parentBIndex = lines.findIndex(l => l.includes('Parent B'));
      assert.ok(parentBIndex >= 0, 'Parent B should exist');
      // Find first non-empty line after Parent B
      let afterParentB = parentBIndex + 1;
      while (afterParentB < lines.length && lines[afterParentB].trim() === '') {
        afterParentB++;
      }
      assert.ok(lines[afterParentB].includes('Parent A'), 'Parent A should be child of Parent B');
    });
  });

  suite('deleteTaskInContent', () => {
    test('deletes task with children', () => {
      const content = `## Todo

- [ ] Parent task
  - [ ] Child 1
  - [ ] Child 2
- [ ] Other task

## Done
`;
      const result = deleteTaskInContent(content, 3);
      assert.ok(!result.includes('Parent task'), 'Parent should be deleted');
      assert.ok(!result.includes('Child 1'), 'Child 1 should be deleted');
      assert.ok(!result.includes('Child 2'), 'Child 2 should be deleted');
      assert.ok(result.includes('Other task'), 'Other task should remain');
    });

    test('deletes task with blank lines between parent and children', () => {
      const content = `## Todo

- [ ] Parent task

  - [ ] Child 1

    - [ ] Grandchild

  - [ ] Child 2

- [ ] Other task

## Done
`;
      const result = deleteTaskInContent(content, 3);
      assert.ok(!result.includes('Parent task'), 'Parent should be deleted');
      assert.ok(!result.includes('Child 1'), 'Child 1 should be deleted');
      assert.ok(!result.includes('Grandchild'), 'Grandchild should be deleted');
      assert.ok(!result.includes('Child 2'), 'Child 2 should be deleted');
      assert.ok(result.includes('Other task'), 'Other task should remain');
    });
  });
});
