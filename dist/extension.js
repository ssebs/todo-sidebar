/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(1));
const KanbanViewProvider_1 = __webpack_require__(2);
let kanbanProvider;
function activate(context) {
    console.log('Todo Sidebar extension is now active!');
    // Create and register the webview provider
    kanbanProvider = new KanbanViewProvider_1.KanbanViewProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(KanbanViewProvider_1.KanbanViewProvider.viewType, kanbanProvider));
    // Register open file command
    const openFileCommand = vscode.commands.registerCommand('todoSidebar.openFile', async () => {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Markdown': ['md']
            },
            title: 'Select a Markdown file for the Todo Board'
        });
        if (fileUri && fileUri[0]) {
            await kanbanProvider.setActiveFile(fileUri[0]);
            vscode.window.showInformationMessage(`Loaded: ${fileUri[0].fsPath}`);
        }
    });
    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand('todoSidebar.refresh', async () => {
        await kanbanProvider.refresh();
    });
    context.subscriptions.push(openFileCommand, refreshCommand);
}
function deactivate() {
    if (kanbanProvider) {
        kanbanProvider.dispose();
    }
}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.KanbanViewProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(3));
const fs = __importStar(__webpack_require__(4));
const parser_1 = __webpack_require__(5);
const serializer_1 = __webpack_require__(6);
class KanbanViewProvider {
    _context;
    static viewType = 'todoSidebar.kanbanView';
    _view;
    _activeFileUri;
    _board;
    _disposables = [];
    _pendingEditLine;
    constructor(_context) {
        this._context = _context;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Handle visibility changes - refresh when panel becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && this._activeFileUri) {
                this._refresh();
            }
        });
        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'toggle':
                    await this._handleToggle(message.line, message.checked, message.targetColumn);
                    break;
                case 'move':
                    await this._handleMove(message.taskLine, message.targetSection, message.position, message.afterLine);
                    break;
                case 'openAtLine':
                    await this._handleOpenAtLine(message.line);
                    break;
                case 'getColumns':
                    // Send column list back to webview for the picker
                    if (this._board) {
                        this._view?.webview.postMessage({
                            type: 'columnsForPicker',
                            columns: this._board.columns.map(c => ({ title: c.title, isDoneColumn: c.isDoneColumn })),
                            taskLine: message.line
                        });
                    }
                    break;
                case 'moveToParent':
                    await this._handleMoveToParent(message.taskLine, message.parentLine, message.position, message.afterLine);
                    break;
                case 'addTask':
                    await this._handleAddTask(message.section);
                    break;
                case 'editTaskText':
                    await this._handleEditTaskText(message.line, message.newText);
                    break;
                case 'addSubtask':
                    await this._handleAddSubtask(message.parentLine);
                    break;
            }
        });
        // Set up file watchers only once
        if (this._disposables.length === 0) {
            this._setupFileWatchers();
        }
        // Restore file from workspace settings
        const config = vscode.workspace.getConfiguration('todoSidebar');
        const savedPath = config.get('activeFile');
        console.log('Attempting to restore activeFile from settings:', savedPath);
        if (savedPath) {
            try {
                this._activeFileUri = vscode.Uri.file(savedPath);
                console.log('Restored activeFile:', this._activeFileUri.fsPath);
            }
            catch (e) {
                console.error('Failed to restore saved file:', e);
            }
        }
        // Always refresh when view becomes visible
        if (this._activeFileUri) {
            this._refresh();
        }
    }
    _setupFileWatchers() {
        // Watch for text document changes
        this._disposables.push(vscode.workspace.onDidChangeTextDocument((e) => {
            if (this._activeFileUri && e.document.uri.toString() === this._activeFileUri.toString()) {
                this._refresh();
            }
        }));
        // Watch for file system changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
        this._disposables.push(watcher.onDidChange((uri) => {
            if (this._activeFileUri && uri.toString() === this._activeFileUri.toString()) {
                this._refresh();
            }
        }));
        this._disposables.push(watcher);
    }
    async setActiveFile(uri) {
        this._activeFileUri = uri;
        // Store in workspace settings by directly writing to .vscode/settings.json
        try {
            const hasWorkspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
            if (!hasWorkspaceFolder) {
                console.error('No workspace folder open - cannot save to workspace settings');
                vscode.window.showWarningMessage('Please open a folder/workspace to persist the todo file selection');
                await this._refresh();
                return;
            }
            const workspaceFolder = vscode.workspace.workspaceFolders[0];
            const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
            const settingsPath = vscode.Uri.joinPath(vscodeDir, 'settings.json');
            // Ensure .vscode directory exists
            try {
                await vscode.workspace.fs.stat(vscodeDir);
            }
            catch {
                await vscode.workspace.fs.createDirectory(vscodeDir);
                console.log('Created .vscode directory');
            }
            // Read existing settings or create new object
            let settings = {};
            let existingText = '';
            try {
                const content = await vscode.workspace.fs.readFile(settingsPath);
                existingText = Buffer.from(content).toString('utf-8');
                // Try to parse, stripping comments if needed
                const stripped = existingText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
                settings = JSON.parse(stripped);
            }
            catch (e) {
                console.log('Creating new settings.json file (or couldn\'t parse existing)');
            }
            // Update the todoSidebar.activeFile setting
            settings['todoSidebar.activeFile'] = uri.fsPath;
            // Write back to settings.json with proper formatting
            const settingsText = JSON.stringify(settings, null, 4);
            await vscode.workspace.fs.writeFile(settingsPath, Buffer.from(settingsText, 'utf-8'));
            console.log('Saved activeFile to .vscode/settings.json:', uri.fsPath);
        }
        catch (e) {
            console.error('Failed to save activeFile to settings:', e);
            vscode.window.showErrorMessage(`Failed to save todo file selection: ${e}`);
        }
        await this._refresh();
    }
    async refresh() {
        await this._refresh();
    }
    async _refresh() {
        if (!this._activeFileUri || !this._view) {
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this._activeFileUri);
            const text = Buffer.from(content).toString('utf-8');
            this._board = (0, parser_1.parseMarkdown)(text);
            const editLine = this._pendingEditLine;
            this._pendingEditLine = undefined;
            this._view.webview.postMessage({ type: 'update', board: this._board, editLine });
        }
        catch (error) {
            console.error('Error refreshing kanban board:', error);
        }
    }
    async _handleToggle(line, checked, targetColumn) {
        if (!this._activeFileUri || !this._board) {
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this._activeFileUri);
            let text = Buffer.from(content).toString('utf-8');
            // Toggle the checkbox
            text = (0, serializer_1.toggleTaskInContent)(text, line, checked);
            // Only move top-level tasks to Done column (not subtasks)
            const isTopLevel = this._isTopLevelTask(line);
            if (checked && isTopLevel) {
                // If checked and top-level, move to Done column at TOP
                const doneColumn = this._board.columns.find((c) => c.isDoneColumn);
                if (doneColumn) {
                    const currentColumn = this._findTaskColumn(line);
                    if (currentColumn && !currentColumn.isDoneColumn) {
                        text = (0, serializer_1.moveTaskInContent)(text, line, doneColumn.title, 'top');
                    }
                }
            }
            else if (targetColumn && isTopLevel) {
                // If unchecked and a target column is specified, move there at TOP
                text = (0, serializer_1.moveTaskInContent)(text, line, targetColumn, 'top');
            }
            await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
        }
        catch (error) {
            console.error('Error toggling task:', error);
        }
    }
    _isTopLevelTask(line) {
        if (!this._board) {
            return false;
        }
        for (const column of this._board.columns) {
            for (const task of column.tasks) {
                if (task.line === line) {
                    return true;
                }
            }
        }
        return false;
    }
    _findTaskColumn(line) {
        if (!this._board) {
            return undefined;
        }
        const findInTasks = (tasks) => {
            for (const task of tasks) {
                if (task.line === line) {
                    return true;
                }
                if (findInTasks(task.children)) {
                    return true;
                }
            }
            return false;
        };
        for (const column of this._board.columns) {
            if (findInTasks(column.tasks)) {
                return column;
            }
        }
        return undefined;
    }
    async _handleMove(taskLine, targetSection, position = 'bottom', afterLine) {
        if (!this._activeFileUri) {
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this._activeFileUri);
            let text = Buffer.from(content).toString('utf-8');
            text = (0, serializer_1.moveTaskInContent)(text, taskLine, targetSection, position, afterLine);
            await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
        }
        catch (error) {
            console.error('Error moving task:', error);
        }
    }
    async _handleMoveToParent(taskLine, parentLine, position = 'bottom', afterLine) {
        if (!this._activeFileUri) {
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this._activeFileUri);
            let text = Buffer.from(content).toString('utf-8');
            text = (0, serializer_1.moveTaskToParent)(text, taskLine, parentLine, position, afterLine);
            await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
        }
        catch (error) {
            console.error('Error moving task to parent:', error);
        }
    }
    async _handleOpenAtLine(line) {
        if (!this._activeFileUri) {
            return;
        }
        try {
            const document = await vscode.workspace.openTextDocument(this._activeFileUri);
            const editor = await vscode.window.showTextDocument(document);
            const position = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
        catch (error) {
            console.error('Error opening file at line:', error);
        }
    }
    async _handleAddTask(section) {
        if (!this._activeFileUri) {
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this._activeFileUri);
            const text = Buffer.from(content).toString('utf-8');
            const result = (0, serializer_1.addTaskToSection)(text, section);
            if (result.line > 0) {
                this._pendingEditLine = result.line;
                await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(result.content, 'utf-8'));
            }
        }
        catch (error) {
            console.error('Error adding task:', error);
        }
    }
    async _handleEditTaskText(line, newText) {
        if (!this._activeFileUri) {
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this._activeFileUri);
            let text = Buffer.from(content).toString('utf-8');
            text = (0, serializer_1.editTaskTextInContent)(text, line, newText);
            await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
        }
        catch (error) {
            console.error('Error editing task text:', error);
        }
    }
    async _handleAddSubtask(parentLine) {
        if (!this._activeFileUri) {
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this._activeFileUri);
            const text = Buffer.from(content).toString('utf-8');
            const result = (0, serializer_1.addSubtaskToParent)(text, parentLine);
            if (result.line > 0) {
                this._pendingEditLine = result.line;
                await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(result.content, 'utf-8'));
            }
        }
        catch (error) {
            console.error('Error adding subtask:', error);
        }
    }
    _getHtmlForWebview(webview) {
        const nonce = getNonce();
        // Read the HTML template file
        const htmlPath = path.join(this._context.extensionPath, 'src', 'webview.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');
        // Replace placeholders with actual values
        html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
        html = html.replace(/\{\{nonce\}\}/g, nonce);
        return html;
    }
    dispose() {
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
    }
}
exports.KanbanViewProvider = KanbanViewProvider;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseMarkdown = parseMarkdown;
function parseMarkdown(content) {
    // Normalize line endings (handle Windows \r\n and Mac \r)
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');
    const board = {
        title: '',
        description: '',
        columns: []
    };
    let currentColumn = null;
    let taskStack = [];
    let foundFirstColumn = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1; // 1-indexed for editor navigation
        // Board title: # Title (only before first column)
        if (!foundFirstColumn) {
            const titleMatch = line.match(/^#\s+([^#].*)$/);
            if (titleMatch) {
                board.title = titleMatch[1].trim();
                continue;
            }
            // Description: > text (only before first column, not indented)
            const descMatch = line.match(/^>\s*(.*)$/);
            if (descMatch) {
                if (board.description) {
                    board.description += '\n' + descMatch[1];
                }
                else {
                    board.description = descMatch[1];
                }
                continue;
            }
        }
        // Column header: ## Section
        const columnMatch = line.match(/^##\s+(.+)$/);
        if (columnMatch) {
            foundFirstColumn = true;
            const title = columnMatch[1].trim();
            currentColumn = {
                title,
                line: lineNumber,
                isDoneColumn: title.toLowerCase().includes('done'),
                tasks: []
            };
            board.columns.push(currentColumn);
            taskStack = [];
            continue;
        }
        // Task with markdown checkbox: - [ ] or - [x] or * [ ] or * [x]
        const taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/);
        if (taskMatch && currentColumn) {
            const indent = taskMatch[1].length;
            const checked = taskMatch[2].toLowerCase() === 'x';
            const text = taskMatch[3].trim();
            const task = {
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
            }
            else {
                // Add as top-level task
                currentColumn.tasks.push(task);
            }
            taskStack.push({ task, indent });
            continue;
        }
        // Task with unicode checkbox: * ☐ or * ☑ or - ☐ or - ☑
        const unicodeTaskMatch = line.match(/^(\s*)[-*]\s+([☐☑✓✗])\s+(.+)$/);
        if (unicodeTaskMatch && currentColumn) {
            const indent = unicodeTaskMatch[1].length;
            const checkChar = unicodeTaskMatch[2];
            const checked = checkChar === '☑' || checkChar === '✓';
            const text = unicodeTaskMatch[3].trim();
            const task = {
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
            }
            else {
                currentColumn.tasks.push(task);
            }
            taskStack.push({ task, indent });
            continue;
        }
        // Nested item with > prefix (like "  * > really good")
        const nestedQuoteMatch = line.match(/^(\s*)[-*]\s+>\s*(.+)$/);
        if (nestedQuoteMatch && taskStack.length > 0) {
            const text = nestedQuoteMatch[2].trim();
            const childTask = {
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
        const bulletMatch = line.match(/^(\s+)[-*]\s+(.+)$/);
        if (bulletMatch && taskStack.length > 0) {
            const indent = bulletMatch[1].length;
            const text = bulletMatch[2].trim();
            // Skip if it looks like a checkbox we didn't match
            if (text.match(/^\[[ xX]\]/) || text.match(/^[☐☑✓✗]/)) {
                continue;
            }
            const childTask = {
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


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toggleTaskInContent = toggleTaskInContent;
exports.moveTaskInContent = moveTaskInContent;
exports.moveTaskToParent = moveTaskToParent;
exports.addTaskToSection = addTaskToSection;
exports.editTaskTextInContent = editTaskTextInContent;
exports.addSubtaskToParent = addSubtaskToParent;
exports.removeCheckboxFromTask = removeCheckboxFromTask;
function toggleTaskInContent(content, line, checked) {
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
        }
        else {
            // Handle markdown checkboxes: - [x] or * [x]
            let newLine = currentLine.replace(/([-*]\s+)\[[xX]\]/, '$1[ ]');
            // Handle unicode checkboxes: ☑ or ✓ -> ☐
            newLine = newLine.replace(/([-*]\s+)[☑✓]/, '$1☐');
            lines[lineIndex] = newLine;
        }
    }
    return lines.join(lineEnding);
}
function moveTaskInContent(content, taskLine, targetSectionTitle, position = 'bottom', afterLine) {
    // Detect line ending style
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    const lineIndex = taskLine - 1;
    // Find the task and all its children (indented lines below it)
    const taskLines = [];
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
                }
                else if (position === 'after' && adjustedAfterLine !== undefined) {
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
                }
                else {
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
    const cleaned = [];
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
function moveTaskToParent(content, taskLine, parentLine, position = 'bottom', afterLine) {
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
    const taskLines = [];
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
    let insertIndex;
    const adjustedParentContent = newLines[adjustedParentIndex];
    const adjustedParentIndent = adjustedParentContent?.match(/^(\s*)/)?.[1].length ?? 0;
    if (position === 'top') {
        // Insert right after parent line
        insertIndex = adjustedParentIndex + 1;
    }
    else if (position === 'after' && afterLine !== undefined) {
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
        }
        else {
            // Fallback to end of parent's children
            insertIndex = adjustedParentIndex + 1;
        }
    }
    else {
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
    const cleaned = [];
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
function addTaskToSection(content, sectionTitle) {
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
function editTaskTextInContent(content, line, newText) {
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
function addSubtaskToParent(content, parentLine) {
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
function removeCheckboxFromTask(content, line) {
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


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map