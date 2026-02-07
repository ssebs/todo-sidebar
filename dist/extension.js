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
    // History stack for undo/redo
    _historyStack = [];
    _historyIndex = -1;
    _maxHistorySize = 50;
    _isUndoRedo = false;
    // Periodic refresh timer
    _periodicRefreshTimer;
    _periodicRefreshInterval = 5000; // 5 seconds
    // Debounce timer for refresh
    _refreshDebounceTimer;
    _refreshDebounceMs = 100; // Debounce refresh calls by 100ms
    // Track if webview is in edit mode (to skip refreshes)
    _isEditing = false;
    constructor(_context) {
        this._context = _context;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };
        // Don't set HTML here - let _refresh() handle it based on whether activeFile is set
        // webviewView.webview.html will be set in the restoration logic or _refresh()
        // Handle visibility changes - refresh when panel becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && this._activeFileUri) {
                this._refresh();
                this._startPeriodicRefresh();
            }
            else {
                this._stopPeriodicRefresh();
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
                case 'undo':
                    await this._handleUndo();
                    break;
                case 'redo':
                    await this._handleRedo();
                    break;
                case 'deleteTask':
                    await this._handleDeleteTask(message.line);
                    break;
                case 'hideSection':
                    await this._handleHideSection(message.sectionTitle);
                    break;
                case 'editStart':
                    this._isEditing = true;
                    break;
                case 'editEnd':
                    this._isEditing = false;
                    break;
                case 'selectFile':
                    await this._handleSelectFile();
                    break;
                case 'saveWizard':
                    await this._handleSaveWizard(message.filePath, message.onDoneAction);
                    break;
                case 'cancelWizard':
                    await this._handleCancelWizard();
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
                // Support relative paths (e.g., "./README.md" or "docs/todo.md")
                if (savedPath.startsWith('./') || savedPath.startsWith('../') || !path.isAbsolute(savedPath)) {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        this._activeFileUri = vscode.Uri.joinPath(workspaceFolder.uri, savedPath);
                    }
                }
                else {
                    this._activeFileUri = vscode.Uri.file(savedPath);
                }
                if (this._activeFileUri) {
                    console.log('Restored activeFile:', this._activeFileUri.fsPath);
                }
            }
            catch (e) {
                console.error('Failed to restore saved file:', e);
            }
        }
        // Always refresh when view becomes visible (this will show wizard or board)
        this._refresh();
        if (this._activeFileUri) {
            this._startPeriodicRefresh();
        }
    }
    _startPeriodicRefresh() {
        // Clear any existing timer
        this._stopPeriodicRefresh();
        // Only start if view is visible and a file is active
        if (this._view?.visible && this._activeFileUri) {
            this._periodicRefreshTimer = setInterval(() => {
                if (this._view?.visible && this._activeFileUri) {
                    this._refresh();
                }
                else {
                    this._stopPeriodicRefresh();
                }
            }, this._periodicRefreshInterval);
        }
    }
    _stopPeriodicRefresh() {
        if (this._periodicRefreshTimer) {
            clearInterval(this._periodicRefreshTimer);
            this._periodicRefreshTimer = undefined;
        }
    }
    _setupFileWatchers() {
        // Watch for text document changes - use debounced refresh to avoid rapid re-renders
        this._disposables.push(vscode.workspace.onDidChangeTextDocument((e) => {
            if (this._activeFileUri && e.document.uri.toString() === this._activeFileUri.toString()) {
                this._debouncedRefresh();
            }
        }));
        // Watch for file system changes - use debounced refresh
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
        this._disposables.push(watcher.onDidChange((uri) => {
            if (this._activeFileUri && uri.toString() === this._activeFileUri.toString()) {
                this._debouncedRefresh();
            }
        }));
        this._disposables.push(watcher);
        // Watch for settings.json changes to pick up manual edits to activeFile
        const settingsWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/settings.json');
        this._disposables.push(settingsWatcher.onDidChange(() => {
            this._reloadActiveFileFromConfig();
        }));
        this._disposables.push(settingsWatcher);
        // Also watch for configuration changes (covers both file edits and UI changes)
        this._disposables.push(vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('todoSidebar.activeFile')) {
                this._reloadActiveFileFromConfig();
            }
            if (e.affectsConfiguration('todoSidebar.hiddenSections')) {
                this._refresh();
            }
        }));
    }
    _reloadActiveFileFromConfig() {
        const config = vscode.workspace.getConfiguration('todoSidebar');
        const savedPath = config.get('activeFile');
        console.log('Config changed, reloading activeFile:', savedPath);
        if (savedPath) {
            try {
                // Support relative paths (e.g., "./README.md" or "docs/todo.md")
                if (savedPath.startsWith('./') || savedPath.startsWith('../') || !path.isAbsolute(savedPath)) {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        this._activeFileUri = vscode.Uri.joinPath(workspaceFolder.uri, savedPath);
                    }
                }
                else {
                    this._activeFileUri = vscode.Uri.file(savedPath);
                }
                if (this._activeFileUri) {
                    console.log('Reloaded activeFile:', this._activeFileUri.fsPath);
                    this._refresh();
                }
            }
            catch (e) {
                console.error('Failed to reload saved file:', e);
            }
        }
        else {
            this._activeFileUri = undefined;
            this._board = undefined;
            this._view?.webview.postMessage({ type: 'update', board: null });
        }
    }
    async setActiveFile(uri) {
        this._activeFileUri = uri;
        // Clear history when switching files
        this._historyStack = [];
        this._historyIndex = -1;
        // Restart periodic refresh with new file
        this._stopPeriodicRefresh();
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
            // Read existing settings content
            let existingText = '';
            let fileExists = false;
            try {
                const content = await vscode.workspace.fs.readFile(settingsPath);
                existingText = Buffer.from(content).toString('utf-8');
                fileExists = true;
            }
            catch (e) {
                // File doesn't exist
            }
            // Convert to relative path if within workspace
            let savePath = uri.fsPath;
            if (workspaceFolder) {
                const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
                // Use relative path if it doesn't start with ".." (i.e., file is within workspace)
                if (!relativePath.startsWith('..')) {
                    savePath = './' + relativePath.replace(/\\/g, '/');
                }
            }
            // Update or insert the setting while preserving existing content
            const escapedPath = JSON.stringify(savePath);
            const activeFilePattern = /"todoSidebar\.activeFile"\s*:\s*"[^"]*"/;
            const onDoneActionPattern = /"todoSidebar\.onDoneAction"\s*:\s*"[^"]*"/;
            let newText;
            if (!fileExists || existingText.trim() === '') {
                // Create new settings file with default onDoneAction
                newText = `{\n    "todoSidebar.activeFile": ${escapedPath},\n    "todoSidebar.onDoneAction": "move"\n}`;
            }
            else {
                // Parse existing file to check for settings
                const hasActiveFile = activeFilePattern.test(existingText);
                const hasOnDoneAction = onDoneActionPattern.test(existingText);
                if (hasActiveFile) {
                    // Update existing activeFile setting in place
                    newText = existingText.replace(activeFilePattern, `"todoSidebar.activeFile": ${escapedPath}`);
                }
                else {
                    // Insert activeFile setting after opening brace
                    const insertMatch = existingText.match(/^\s*\{/);
                    if (insertMatch) {
                        const insertPos = insertMatch[0].length;
                        const before = existingText.slice(0, insertPos);
                        const after = existingText.slice(insertPos);
                        const needsComma = after.trim().length > 0 && after.trim() !== '}';
                        const newSetting = `\n    "todoSidebar.activeFile": ${escapedPath}${needsComma ? ',' : ''}`;
                        newText = before + newSetting + after;
                    }
                    else {
                        // Fallback: file is malformed, create new
                        newText = `{\n    "todoSidebar.activeFile": ${escapedPath},\n    "todoSidebar.onDoneAction": "move"\n}`;
                    }
                }
                // Now check if onDoneAction needs to be added
                if (!hasOnDoneAction) {
                    // Insert onDoneAction setting after opening brace (or after activeFile if just added)
                    const insertMatch = newText.match(/^\s*\{/);
                    if (insertMatch) {
                        const insertPos = insertMatch[0].length;
                        const before = newText.slice(0, insertPos);
                        const after = newText.slice(insertPos);
                        const needsComma = after.trim().length > 0 && after.trim() !== '}';
                        const onDoneSetting = `\n    "todoSidebar.onDoneAction": "move"${needsComma ? ',' : ''}`;
                        newText = before + onDoneSetting + after;
                    }
                }
            }
            await vscode.workspace.fs.writeFile(settingsPath, Buffer.from(newText, 'utf-8'));
            console.log('Saved activeFile to .vscode/settings.json:', uri.fsPath);
        }
        catch (e) {
            console.error('Failed to save activeFile to settings:', e);
            vscode.window.showErrorMessage(`Failed to save todo file selection: ${e}`);
        }
        await this._refresh();
        this._startPeriodicRefresh();
    }
    async refresh() {
        await this._refresh();
    }
    async _readActiveFile() {
        if (!this._activeFileUri) {
            return '';
        }
        const content = await vscode.workspace.fs.readFile(this._activeFileUri);
        return Buffer.from(content).toString('utf-8');
    }
    async _writeActiveFile(text) {
        if (!this._activeFileUri) {
            return;
        }
        // Track history for undo/redo (skip if this is an undo/redo operation)
        if (!this._isUndoRedo) {
            // If we're not at the end of the stack, truncate forward history
            if (this._historyIndex < this._historyStack.length - 1) {
                this._historyStack = this._historyStack.slice(0, this._historyIndex + 1);
            }
            // Add current state to history
            this._historyStack.push(text);
            // Limit history size
            if (this._historyStack.length > this._maxHistorySize) {
                this._historyStack.shift();
            }
            else {
                this._historyIndex++;
            }
        }
        await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
    }
    async _handleUndo() {
        if (this._historyIndex <= 0 || !this._activeFileUri) {
            return;
        }
        this._historyIndex--;
        const previousContent = this._historyStack[this._historyIndex];
        this._isUndoRedo = true;
        try {
            await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(previousContent, 'utf-8'));
        }
        finally {
            this._isUndoRedo = false;
        }
    }
    async _handleRedo() {
        if (this._historyIndex >= this._historyStack.length - 1 || !this._activeFileUri) {
            return;
        }
        this._historyIndex++;
        const nextContent = this._historyStack[this._historyIndex];
        this._isUndoRedo = true;
        try {
            await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(nextContent, 'utf-8'));
        }
        finally {
            this._isUndoRedo = false;
        }
    }
    async _refresh(force = false) {
        if (!this._view) {
            return;
        }
        // Skip refresh if user is actively editing (unless forced or there's a pending edit line)
        if (this._isEditing && !force && !this._pendingEditLine) {
            return;
        }
        // Show welcome wizard if no active file
        if (!this._activeFileUri) {
            this._view.webview.html = this._getWelcomeHtmlForWebview(this._view.webview);
            return;
        }
        // Ensure the webview has the correct HTML template for the board
        // (needed on first load when restoring from settings)
        if (!this._view.webview.html.includes('id="content"')) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
        try {
            const text = await this._readActiveFile();
            // Initialize history with first state if empty
            if (this._historyStack.length === 0) {
                this._historyStack.push(text);
                this._historyIndex = 0;
            }
            this._board = (0, parser_1.parseMarkdown)(text);
            // Filter out hidden sections based on configuration
            const config = vscode.workspace.getConfiguration('todoSidebar');
            const hiddenSections = config.get('hiddenSections', []);
            const filteredBoard = {
                ...this._board,
                columns: this._board.columns.filter(col => !this._isColumnHidden(col.title, hiddenSections))
            };
            const editLine = this._pendingEditLine;
            this._pendingEditLine = undefined;
            this._view.webview.postMessage({ type: 'update', board: filteredBoard, editLine });
        }
        catch (error) {
            console.error('Error refreshing kanban board:', error);
        }
    }
    /**
     * Debounced refresh - prevents rapid re-renders from file watcher events
     */
    _debouncedRefresh() {
        if (this._refreshDebounceTimer) {
            clearTimeout(this._refreshDebounceTimer);
        }
        this._refreshDebounceTimer = setTimeout(() => {
            this._refreshDebounceTimer = undefined;
            this._refresh();
        }, this._refreshDebounceMs);
    }
    async _handleToggle(line, checked, targetColumn) {
        if (!this._activeFileUri) {
            return;
        }
        try {
            let text = await this._readActiveFile();
            // Re-parse the board from fresh content to get accurate line numbers
            const currentBoard = (0, parser_1.parseMarkdown)(text);
            // Only move top-level tasks to Done column (not subtasks)
            const isTopLevel = this._isTopLevelTaskInBoard(line, currentBoard);
            // Get the onDoneAction configuration
            const config = vscode.workspace.getConfiguration('todoSidebar');
            const onDoneAction = config.get('onDoneAction', 'move');
            if (checked && isTopLevel) {
                // Check configuration for what to do when a task is marked as done
                if (onDoneAction === 'delete') {
                    // Delete the task and its children immediately without toggling
                    text = (0, serializer_1.deleteTaskInContent)(text, line);
                }
                else {
                    // Default behavior: toggle checkbox and move to Done column
                    text = (0, serializer_1.toggleTaskInContent)(text, line, checked);
                    // Move to Done column at TOP
                    const doneColumn = currentBoard.columns.find((c) => c.isDoneColumn);
                    if (doneColumn) {
                        const currentColumn = this._findTaskColumnInBoard(line, currentBoard);
                        if (currentColumn && !currentColumn.isDoneColumn) {
                            text = (0, serializer_1.moveTaskInContent)(text, line, doneColumn.title, 'top');
                        }
                    }
                }
            }
            else if (targetColumn && isTopLevel) {
                // If unchecked and a target column is specified, move there at TOP
                text = (0, serializer_1.toggleTaskInContent)(text, line, checked);
                text = (0, serializer_1.moveTaskInContent)(text, line, targetColumn, 'top');
            }
            else {
                // For non-top-level tasks or other cases, just toggle the checkbox
                text = (0, serializer_1.toggleTaskInContent)(text, line, checked);
            }
            await this._writeActiveFile(text);
        }
        catch (error) {
            console.error('Error toggling task:', error);
        }
    }
    _isTopLevelTaskInBoard(line, board) {
        for (const column of board.columns) {
            for (const task of column.tasks) {
                if (task.line === line) {
                    return true;
                }
            }
        }
        return false;
    }
    _findTaskColumnInBoard(line, board) {
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
        for (const column of board.columns) {
            if (findInTasks(column.tasks)) {
                return column;
            }
        }
        return undefined;
    }
    _isColumnHidden(columnTitle, hiddenPatterns) {
        const lowerTitle = columnTitle.toLowerCase();
        for (const pattern of hiddenPatterns) {
            const lowerPattern = pattern.toLowerCase();
            // Check if pattern contains regex special characters (besides *)
            if (/[.+?^${}()|[\]\\]/.test(pattern)) {
                // Treat as regex pattern
                try {
                    const regex = new RegExp(pattern, 'i'); // case-insensitive
                    if (regex.test(columnTitle)) {
                        return true;
                    }
                }
                catch (e) {
                    // Invalid regex, fall back to exact match
                    if (lowerTitle === lowerPattern) {
                        return true;
                    }
                }
            }
            else if (lowerPattern.includes('*')) {
                // Simple wildcard pattern: convert * to .*
                const regexPattern = '^' + lowerPattern.replace(/\*/g, '.*') + '$';
                const regex = new RegExp(regexPattern);
                if (regex.test(lowerTitle)) {
                    return true;
                }
            }
            else {
                // Exact match (case-insensitive)
                if (lowerTitle === lowerPattern) {
                    return true;
                }
            }
        }
        return false;
    }
    async _handleMove(taskLine, targetSection, position = 'bottom', afterLine) {
        if (!this._activeFileUri) {
            return;
        }
        try {
            let text = await this._readActiveFile();
            text = (0, serializer_1.moveTaskInContent)(text, taskLine, targetSection, position, afterLine);
            await this._writeActiveFile(text);
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
            let text = await this._readActiveFile();
            text = (0, serializer_1.moveTaskToParent)(text, taskLine, parentLine, position, afterLine);
            await this._writeActiveFile(text);
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
            const text = await this._readActiveFile();
            const result = (0, serializer_1.addTaskToSection)(text, section);
            if (result.line > 0) {
                this._pendingEditLine = result.line;
                await this._writeActiveFile(result.content);
                // Force immediate refresh to enter edit mode, don't wait for debounced file watcher
                await this._refresh(true);
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
            let text = await this._readActiveFile();
            text = (0, serializer_1.editTaskTextInContent)(text, line, newText);
            await this._writeActiveFile(text);
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
            const text = await this._readActiveFile();
            const result = (0, serializer_1.addSubtaskToParent)(text, parentLine);
            if (result.line > 0) {
                this._pendingEditLine = result.line;
                await this._writeActiveFile(result.content);
                // Force immediate refresh to enter edit mode, don't wait for debounced file watcher
                await this._refresh(true);
            }
        }
        catch (error) {
            console.error('Error adding subtask:', error);
        }
    }
    async _handleDeleteTask(line) {
        if (!this._activeFileUri) {
            return;
        }
        try {
            let text = await this._readActiveFile();
            text = (0, serializer_1.deleteTaskInContent)(text, line);
            await this._writeActiveFile(text);
        }
        catch (error) {
            console.error('Error deleting task:', error);
        }
    }
    async _handleHideSection(sectionTitle) {
        try {
            const config = vscode.workspace.getConfiguration('todoSidebar');
            const hiddenSections = config.get('hiddenSections', []);
            // Add the section if it's not already in the list
            if (!hiddenSections.includes(sectionTitle)) {
                hiddenSections.push(sectionTitle);
                // Update the configuration in workspace settings
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    vscode.window.showWarningMessage('No workspace folder open - cannot save hidden sections');
                    return;
                }
                const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
                const settingsPath = vscode.Uri.joinPath(vscodeDir, 'settings.json');
                // Ensure .vscode directory exists
                try {
                    await vscode.workspace.fs.stat(vscodeDir);
                }
                catch {
                    await vscode.workspace.fs.createDirectory(vscodeDir);
                }
                // Read existing settings
                let existingText = '';
                let fileExists = false;
                try {
                    const content = await vscode.workspace.fs.readFile(settingsPath);
                    existingText = Buffer.from(content).toString('utf-8');
                    fileExists = true;
                }
                catch (e) {
                    // File doesn't exist
                }
                // Update or insert the hiddenSections setting
                const escapedArray = JSON.stringify(hiddenSections);
                const settingPattern = /"todoSidebar\.hiddenSections"\s*:\s*\[[^\]]*\]/;
                let newText;
                if (!fileExists || existingText.trim() === '') {
                    // Create new settings file
                    newText = `{\n    "todoSidebar.hiddenSections": ${escapedArray}\n}`;
                }
                else if (settingPattern.test(existingText)) {
                    // Update existing setting
                    newText = existingText.replace(settingPattern, `"todoSidebar.hiddenSections": ${escapedArray}`);
                }
                else {
                    // Insert new setting after opening brace
                    const insertMatch = existingText.match(/^\s*\{/);
                    if (insertMatch) {
                        const insertPos = insertMatch[0].length;
                        const before = existingText.slice(0, insertPos);
                        const after = existingText.slice(insertPos);
                        const needsComma = after.trim().length > 0 && after.trim() !== '}';
                        const newSetting = `\n    "todoSidebar.hiddenSections": ${escapedArray}${needsComma ? ',' : ''}`;
                        newText = before + newSetting + after;
                    }
                    else {
                        // Fallback: file is malformed, create new
                        newText = `{\n    "todoSidebar.hiddenSections": ${escapedArray}\n}`;
                    }
                }
                await vscode.workspace.fs.writeFile(settingsPath, Buffer.from(newText, 'utf-8'));
                console.log('Added section to hiddenSections:', sectionTitle);
                // Show a message to the user
                vscode.window.showInformationMessage(`Section "${sectionTitle}" is now hidden. Edit settings to unhide.`);
            }
        }
        catch (error) {
            console.error('Error hiding section:', error);
            vscode.window.showErrorMessage(`Failed to hide section: ${error}`);
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
    _getWelcomeHtmlForWebview(webview) {
        const nonce = getNonce();
        // Read the welcome wizard template
        const welcomePath = path.join(this._context.extensionPath, 'src', 'welcome.html');
        let html = fs.readFileSync(welcomePath, 'utf-8');
        // Read the tips content
        const tipsPath = path.join(this._context.extensionPath, 'src', 'tips.html');
        const tipsContent = fs.readFileSync(tipsPath, 'utf-8');
        // Replace placeholders
        html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
        html = html.replace(/\{\{nonce\}\}/g, nonce);
        html = html.replace(/\{\{TIPS_CONTENT\}\}/g, tipsContent);
        return html;
    }
    async _handleSelectFile() {
        const options = {
            canSelectMany: false,
            filters: {
                'Markdown files': ['md', 'markdown']
            },
            title: 'Select a markdown file for your todo board'
        };
        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            // Send the selected file path back to the webview
            this._view?.webview.postMessage({
                type: 'fileSelected',
                filePath: fileUri[0].fsPath
            });
        }
    }
    async _handleSaveWizard(filePath, onDoneAction) {
        try {
            // Set the active file
            const uri = vscode.Uri.file(filePath);
            // Validate the file exists and is readable
            try {
                await vscode.workspace.fs.stat(uri);
            }
            catch {
                this._view?.webview.postMessage({
                    type: 'error',
                    message: 'Selected file does not exist or is not accessible'
                });
                return;
            }
            // Save the settings to workspace
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showWarningMessage('Please open a folder/workspace to save settings');
                return;
            }
            const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
            const settingsPath = vscode.Uri.joinPath(vscodeDir, 'settings.json');
            // Ensure .vscode directory exists
            try {
                await vscode.workspace.fs.stat(vscodeDir);
            }
            catch {
                await vscode.workspace.fs.createDirectory(vscodeDir);
            }
            // Convert to relative path if within workspace
            let savePath = filePath;
            const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
            if (!relativePath.startsWith('..')) {
                savePath = './' + relativePath.replace(/\\/g, '/');
            }
            // Read existing settings
            let existingText = '';
            let fileExists = false;
            try {
                const content = await vscode.workspace.fs.readFile(settingsPath);
                existingText = Buffer.from(content).toString('utf-8');
                fileExists = true;
            }
            catch (e) {
                // File doesn't exist
            }
            // Create or update settings
            const escapedPath = JSON.stringify(savePath);
            const escapedAction = JSON.stringify(onDoneAction);
            let newText;
            if (!fileExists || existingText.trim() === '') {
                // Create new settings file
                newText = `{\n    "todoSidebar.activeFile": ${escapedPath},\n    "todoSidebar.onDoneAction": ${escapedAction}\n}`;
            }
            else {
                // Update existing settings
                const activeFilePattern = /"todoSidebar\.activeFile"\s*:\s*"[^"]*"/;
                const onDoneActionPattern = /"todoSidebar\.onDoneAction"\s*:\s*"[^"]*"/;
                const hasActiveFile = activeFilePattern.test(existingText);
                const hasOnDoneAction = onDoneActionPattern.test(existingText);
                newText = existingText;
                if (hasActiveFile) {
                    newText = newText.replace(activeFilePattern, `"todoSidebar.activeFile": ${escapedPath}`);
                }
                else {
                    // Insert activeFile
                    const insertMatch = newText.match(/^\s*\{/);
                    if (insertMatch) {
                        const insertPos = insertMatch[0].length;
                        const before = newText.slice(0, insertPos);
                        const after = newText.slice(insertPos);
                        const needsComma = after.trim().length > 0 && after.trim() !== '}';
                        newText = before + `\n    "todoSidebar.activeFile": ${escapedPath}${needsComma ? ',' : ''}` + after;
                    }
                }
                if (hasOnDoneAction) {
                    newText = newText.replace(onDoneActionPattern, `"todoSidebar.onDoneAction": ${escapedAction}`);
                }
                else {
                    // Insert onDoneAction
                    const insertMatch = newText.match(/^\s*\{/);
                    if (insertMatch) {
                        const insertPos = insertMatch[0].length;
                        const before = newText.slice(0, insertPos);
                        const after = newText.slice(insertPos);
                        const needsComma = after.trim().length > 0 && after.trim() !== '}';
                        newText = before + `\n    "todoSidebar.onDoneAction": ${escapedAction}${needsComma ? ',' : ''}` + after;
                    }
                }
            }
            await vscode.workspace.fs.writeFile(settingsPath, Buffer.from(newText, 'utf-8'));
            // Set the active file and refresh to show the board
            this._activeFileUri = uri;
            // Clear history when switching files
            this._historyStack = [];
            this._historyIndex = -1;
            // Update the webview to show the board
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
            await this._refresh();
            this._startPeriodicRefresh();
            vscode.window.showInformationMessage('Todo board setup complete!');
        }
        catch (error) {
            console.error('Error saving wizard settings:', error);
            this._view?.webview.postMessage({
                type: 'error',
                message: `Failed to save settings: ${error}`
            });
        }
    }
    async _handleCancelWizard() {
        // User wants to skip the wizard - just close or show the "no file" message
        vscode.window.showInformationMessage('You can open a markdown file anytime using the command "Todo Sidebar: Open Markdown File"');
    }
    dispose() {
        this._stopPeriodicRefresh();
        if (this._refreshDebounceTimer) {
            clearTimeout(this._refreshDebounceTimer);
        }
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
// Regex constants for parsing markdown patterns
const TITLE_REGEX = /^#\s+([^#].*)$/;
const DESCRIPTION_REGEX = /^>\s*(.*)$/;
const COLUMN_HEADER_REGEX = /^##\s+(.+)$/;
const MD_TASK_REGEX = /^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/;
const UNICODE_TASK_REGEX = /^(\s*)[-*]\s+([☐☑✓✗])\s+(.+)$/;
const NESTED_QUOTE_REGEX = /^(\s*)[-*]\s+>\s*(.+)$/;
const BULLET_REGEX = /^(\s+)[-*]\s+(.+)$/;
const CHECKBOX_PREFIX_REGEX = /^\[[ xX]\]|^[☐☑✓✗]/;
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
                }
                else {
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
                }
                else {
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
        const unicodeTaskMatch = line.match(UNICODE_TASK_REGEX);
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
        const nestedQuoteMatch = line.match(NESTED_QUOTE_REGEX);
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
        const bulletMatch = line.match(BULLET_REGEX);
        if (bulletMatch && taskStack.length > 0) {
            const indent = bulletMatch[1].length;
            const text = bulletMatch[2].trim();
            // Skip if it looks like a checkbox we didn't match
            if (text.match(CHECKBOX_PREFIX_REGEX)) {
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
exports.deleteTaskInContent = deleteTaskInContent;
// Regex constants for checkbox and indentation patterns
const INDENT_REGEX = /^(\s*)/;
const MD_CHECKBOX_UNCHECKED_REGEX = /([-*]\s+)\[ \]/;
const MD_CHECKBOX_CHECKED_REGEX = /([-*]\s+)\[[xX]\]/;
const UNICODE_CHECKBOX_UNCHECKED_REGEX = /([-*]\s+)☐/;
const UNICODE_CHECKBOX_CHECKED_REGEX = /([-*]\s+)[☑✓]/;
const TASK_WITH_MD_CHECKBOX_REGEX = /^\s*[-*]\s+(\[[ xX]\]|[☐☑✓✗])?\s*(.+)$/;
const TASK_TEXT_MD_CHECKBOX_REGEX = /^(\s*[-*]\s+\[[ xX]\]\s+)(.+)$/;
const TASK_TEXT_UNICODE_CHECKBOX_REGEX = /^(\s*[-*]\s+[☐☑✓✗]\s+)(.+)$/;
const SECTION_HEADER_REGEX = /^##\s+(.+)$/;
/**
 * Helper function to parse content into lines while preserving line ending style
 */
function parseContentLines(content) {
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    return { lines, lineEnding };
}
function toggleTaskInContent(content, line, checked) {
    const { lines, lineEnding } = parseContentLines(content);
    const lineIndex = line - 1; // Convert to 0-indexed
    if (lineIndex >= 0 && lineIndex < lines.length) {
        const currentLine = lines[lineIndex];
        if (checked) {
            // Handle markdown checkboxes: - [ ] or * [ ]
            let newLine = currentLine.replace(MD_CHECKBOX_UNCHECKED_REGEX, '$1[x]');
            // Handle unicode checkboxes: ☐ -> ☑
            newLine = newLine.replace(UNICODE_CHECKBOX_UNCHECKED_REGEX, '$1☑');
            lines[lineIndex] = newLine;
        }
        else {
            // Handle markdown checkboxes: - [x] or * [x]
            let newLine = currentLine.replace(MD_CHECKBOX_CHECKED_REGEX, '$1[ ]');
            // Handle unicode checkboxes: ☑ or ✓ -> ☐
            newLine = newLine.replace(UNICODE_CHECKBOX_CHECKED_REGEX, '$1☐');
            lines[lineIndex] = newLine;
        }
    }
    return lines.join(lineEnding);
}
function moveTaskInContent(content, taskLine, targetSectionTitle, position = 'bottom', afterLine) {
    const { lines, lineEnding } = parseContentLines(content);
    const lineIndex = taskLine - 1;
    // Find the task and all its children (indented lines below it)
    const taskLines = [];
    const taskIndent = lines[lineIndex]?.match(INDENT_REGEX)?.[1].length ?? 0;
    // Add the task line
    taskLines.push(lines[lineIndex]);
    // Add all children (lines with greater indentation following the task)
    let i = lineIndex + 1;
    while (i < lines.length) {
        const currentLine = lines[i];
        const currentIndent = currentLine.match(INDENT_REGEX)?.[1].length ?? 0;
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
        const sectionMatch = newLines[j].match(SECTION_HEADER_REGEX);
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
                        const afterTaskIndent = newLines[afterIndex]?.match(INDENT_REGEX)?.[1].length ?? 0;
                        let insertAfter = afterIndex + 1;
                        // Skip over children of the after task
                        while (insertAfter < newLines.length) {
                            const currentLine = newLines[insertAfter];
                            const currentIndent = currentLine.match(INDENT_REGEX)?.[1].length ?? 0;
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
                        if (newLines[endOfSection].match(SECTION_HEADER_REGEX)) {
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
/**
 * Helper function to check if a line is a descendant of another line
 */
function isDescendantOf(lines, descendantLine, ancestorLine) {
    const ancestorIndex = ancestorLine - 1;
    const descendantIndex = descendantLine - 1;
    if (ancestorIndex < 0 || ancestorIndex >= lines.length) {
        return false;
    }
    if (descendantIndex < 0 || descendantIndex >= lines.length) {
        return false;
    }
    // Get the ancestor's indentation
    const ancestorIndent = lines[ancestorIndex]?.match(INDENT_REGEX)?.[1].length ?? 0;
    // Check all lines after the ancestor until we find a line at same or lower indentation
    let i = ancestorIndex + 1;
    while (i < lines.length) {
        const currentLine = lines[i];
        const currentIndent = currentLine.match(INDENT_REGEX)?.[1].length ?? 0;
        // If we hit a line at same/lower indentation, we've left the ancestor's descendants
        if (currentLine.trim() !== '' && currentIndent <= ancestorIndent) {
            break;
        }
        // If we found the descendant line, it's a descendant of ancestor
        if (i === descendantIndex) {
            return true;
        }
        i++;
    }
    return false;
}
function moveTaskToParent(content, taskLine, parentLine, position = 'bottom', afterLine) {
    const { lines, lineEnding } = parseContentLines(content);
    const taskIndex = taskLine - 1;
    const parentIndex = parentLine - 1;
    // Prevent moving a task into itself
    if (taskLine === parentLine) {
        return content;
    }
    // Prevent creating circular references (moving a parent into its own descendant)
    if (isDescendantOf(lines, parentLine, taskLine)) {
        return content;
    }
    // Get the task line content
    const taskContent = lines[taskIndex];
    if (!taskContent) {
        return content;
    }
    // Extract task text (remove leading whitespace, bullet, and checkbox)
    const taskMatch = taskContent.match(TASK_WITH_MD_CHECKBOX_REGEX);
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
    const parentIndent = parentContent.match(INDENT_REGEX)?.[1].length ?? 0;
    const childIndent = ' '.repeat(parentIndent + 2);
    // Find all children of the task being moved (to move them too)
    const taskLines = [];
    const originalTaskIndent = taskContent.match(INDENT_REGEX)?.[1].length ?? 0;
    // The task itself, re-indented as a child
    taskLines.push(`${childIndent}- ${checkboxPart} ${taskText}`);
    // Find and re-indent any children of the moved task
    let i = taskIndex + 1;
    while (i < lines.length) {
        const currentLine = lines[i];
        const currentIndent = currentLine.match(INDENT_REGEX)?.[1].length ?? 0;
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
    const adjustedParentIndent = adjustedParentContent?.match(INDENT_REGEX)?.[1].length ?? 0;
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
            const afterTaskIndent = newLines[afterIndex]?.match(INDENT_REGEX)?.[1].length ?? 0;
            insertIndex = afterIndex + 1;
            while (insertIndex < newLines.length) {
                const currentLine = newLines[insertIndex];
                const currentIndent = currentLine.match(INDENT_REGEX)?.[1].length ?? 0;
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
            const currentIndent = currentLine.match(INDENT_REGEX)?.[1].length ?? 0;
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
    const { lines, lineEnding } = parseContentLines(content);
    // Find the section header
    let sectionIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(SECTION_HEADER_REGEX);
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
    const { lines, lineEnding } = parseContentLines(content);
    const lineIndex = line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) {
        return content;
    }
    const currentLine = lines[lineIndex];
    // Match markdown checkbox: - [ ] text or - [x] text
    const mdMatch = currentLine.match(TASK_TEXT_MD_CHECKBOX_REGEX);
    if (mdMatch) {
        lines[lineIndex] = mdMatch[1] + newText;
        return lines.join(lineEnding);
    }
    // Match unicode checkbox: - ☐ text or - ☑ text
    const unicodeMatch = currentLine.match(TASK_TEXT_UNICODE_CHECKBOX_REGEX);
    if (unicodeMatch) {
        lines[lineIndex] = unicodeMatch[1] + newText;
        return lines.join(lineEnding);
    }
    return content;
}
function addSubtaskToParent(content, parentLine) {
    const { lines, lineEnding } = parseContentLines(content);
    const parentIndex = parentLine - 1;
    if (parentIndex < 0 || parentIndex >= lines.length) {
        return { content, line: -1 };
    }
    const parentContent = lines[parentIndex];
    const parentIndent = parentContent.match(INDENT_REGEX)?.[1].length ?? 0;
    const childIndent = ' '.repeat(parentIndent + 2);
    // Find insertion point: after parent and all its existing children
    let insertIndex = parentIndex + 1;
    while (insertIndex < lines.length) {
        const currentLine = lines[insertIndex];
        const currentIndent = currentLine.match(INDENT_REGEX)?.[1].length ?? 0;
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
    const { lines, lineEnding } = parseContentLines(content);
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
function deleteTaskInContent(content, taskLine) {
    const { lines, lineEnding } = parseContentLines(content);
    const lineIndex = taskLine - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) {
        return content;
    }
    // Find the task and all its children (indented lines below it)
    const taskIndent = lines[lineIndex]?.match(INDENT_REGEX)?.[1].length ?? 0;
    // Count lines to remove (task + all children)
    let linesToRemove = 1;
    let i = lineIndex + 1;
    while (i < lines.length) {
        const currentLine = lines[i];
        const currentIndent = currentLine.match(INDENT_REGEX)?.[1].length ?? 0;
        // Empty line or line with content at same/less indentation ends the block
        if (currentLine.trim() === '') {
            break;
        }
        if (currentIndent <= taskIndent && currentLine.trim() !== '') {
            break;
        }
        linesToRemove++;
        i++;
    }
    // Remove the task block
    lines.splice(lineIndex, linesToRemove);
    // Clean up multiple consecutive empty lines
    const cleaned = [];
    let lastWasEmpty = false;
    for (const resultLine of lines) {
        const isEmpty = resultLine.trim() === '';
        if (isEmpty && lastWasEmpty) {
            continue;
        }
        cleaned.push(resultLine);
        lastWasEmpty = isEmpty;
    }
    return cleaned.join(lineEnding);
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