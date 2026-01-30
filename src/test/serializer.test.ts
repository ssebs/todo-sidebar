import * as assert from 'assert';
import { addTaskToSection, editTaskTextInContent, addSubtaskToParent, removeCheckboxFromTask } from '../serializer';

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
});
