"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const serializer_1 = require("../serializer");
suite('Serializer Test Suite', () => {
    suite('addTaskToSection', () => {
        test('adds task after section header with existing tasks', () => {
            const content = `## Todo

- [ ] Existing task

## Done
`;
            const result = (0, serializer_1.addTaskToSection)(content, 'Todo');
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
            const result = (0, serializer_1.editTaskTextInContent)(content, 3, 'New text');
            assert.ok(result.includes('- [ ] New text'));
            assert.ok(result.includes('- [x] Done task'));
        });
        test('edits unicode checkbox task text', () => {
            const content = `## Todo

- ☐ Old text
`;
            const result = (0, serializer_1.editTaskTextInContent)(content, 3, 'New text');
            assert.ok(result.includes('- ☐ New text'));
        });
        test('preserves indentation', () => {
            const content = `## Todo

- [ ] Parent
  - [ ] Child text
`;
            const result = (0, serializer_1.editTaskTextInContent)(content, 4, 'New child');
            assert.ok(result.includes('  - [ ] New child'));
        });
    });
    suite('addSubtaskToParent', () => {
        test('adds subtask under parent with correct indentation', () => {
            const content = `## Todo

- [ ] Parent task

## Done
`;
            const result = (0, serializer_1.addSubtaskToParent)(content, 3);
            assert.ok(result.content.includes('  - [ ] New task'));
            assert.strictEqual(result.line, 4);
        });
        test('adds subtask after existing children', () => {
            const content = `## Todo

- [ ] Parent task
  - [ ] Existing child

## Done
`;
            const result = (0, serializer_1.addSubtaskToParent)(content, 3);
            assert.ok(result.content.includes('  - [ ] New task'));
            assert.strictEqual(result.line, 5);
        });
    });
    suite('removeCheckboxFromTask', () => {
        test('removes markdown checkbox from task', () => {
            const content = `## Todo

- [ ] Task with checkbox
`;
            const result = (0, serializer_1.removeCheckboxFromTask)(content, 3);
            assert.ok(result.includes('- Task with checkbox'));
            assert.ok(!result.includes('[ ]'));
        });
        test('removes checked markdown checkbox', () => {
            const content = `## Todo

- [x] Done task
`;
            const result = (0, serializer_1.removeCheckboxFromTask)(content, 3);
            assert.ok(result.includes('- Done task'));
            assert.ok(!result.includes('[x]'));
        });
        test('removes unicode checkbox', () => {
            const content = `## Todo

  - ☐ Subtask
`;
            const result = (0, serializer_1.removeCheckboxFromTask)(content, 3);
            assert.ok(result.includes('  - Subtask'));
            assert.ok(!result.includes('☐'));
        });
    });
});
//# sourceMappingURL=serializer.test.js.map