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
    kanbanProvider = new KanbanViewProvider_1.KanbanViewProvider(context.extensionUri);
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
const parser_1 = __webpack_require__(3);
const serializer_1 = __webpack_require__(4);
class KanbanViewProvider {
    _extensionUri;
    static viewType = 'todoSidebar.kanbanView';
    _view;
    _activeFileUri;
    _board;
    _disposables = [];
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'toggle':
                    await this._handleToggle(message.line, message.checked, message.targetColumn);
                    break;
                case 'move':
                    await this._handleMove(message.taskLine, message.targetSection, message.position);
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
                    await this._handleMoveToParent(message.taskLine, message.parentLine, message.position);
                    break;
            }
        });
        // Set up file watchers
        this._setupFileWatchers();
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
            this._view.webview.postMessage({ type: 'update', board: this._board });
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
            if (checked) {
                // If checked, move to Done column at TOP
                const doneColumn = this._board.columns.find((c) => c.isDoneColumn);
                if (doneColumn) {
                    const currentColumn = this._findTaskColumn(line);
                    if (currentColumn && !currentColumn.isDoneColumn) {
                        text = (0, serializer_1.moveTaskInContent)(text, line, doneColumn.title, 'top');
                    }
                }
            }
            else if (targetColumn) {
                // If unchecked and a target column is specified, move there at TOP
                text = (0, serializer_1.moveTaskInContent)(text, line, targetColumn, 'top');
            }
            await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
        }
        catch (error) {
            console.error('Error toggling task:', error);
        }
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
    async _handleMove(taskLine, targetSection, position = 'bottom') {
        if (!this._activeFileUri) {
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this._activeFileUri);
            let text = Buffer.from(content).toString('utf-8');
            text = (0, serializer_1.moveTaskInContent)(text, taskLine, targetSection, position);
            await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
        }
        catch (error) {
            console.error('Error moving task:', error);
        }
    }
    async _handleMoveToParent(taskLine, parentLine, position = 'bottom') {
        if (!this._activeFileUri) {
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this._activeFileUri);
            let text = Buffer.from(content).toString('utf-8');
            text = (0, serializer_1.moveTaskToParent)(text, taskLine, parentLine, position);
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
    _getHtmlForWebview(webview) {
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kanban Board</title>
  <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
  <style>
    body {
      padding: 8px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    .no-file {
      text-align: center;
      padding: 20px;
      color: var(--vscode-descriptionForeground);
    }
    .board {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .board-header {
      margin-bottom: 8px;
    }
    .board-title {
      font-size: 1.2em;
      font-weight: bold;
      margin: 0 0 4px 0;
    }
    .board-description {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      margin: 0;
    }
    .column {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 8px;
    }
    .column-header {
      font-weight: bold;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .column.drag-over {
      background: var(--vscode-list-hoverBackground);
    }
    .task {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 6px 8px;
      margin-bottom: 6px;
      cursor: grab;
    }
    .task:last-child {
      margin-bottom: 0;
    }
    .task.dragging {
      opacity: 0.5;
    }
    .task-header {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    .task-checkbox {
      margin-top: 2px;
      cursor: pointer;
    }
    .task-text {
      flex: 1;
      word-break: break-word;
    }
    .task-text.checked {
      text-decoration: line-through;
      opacity: 0.7;
    }
    .open-btn {
      background: none;
      border: none;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 0.85em;
      opacity: 0.7;
    }
    .open-btn:hover {
      opacity: 1;
    }
    .children {
      margin-left: 20px;
      margin-top: 4px;
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
    }
    .child-item {
      margin: 2px 0;
    }
    .children {
      min-height: 10px;
    }
    .child-task {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 4px 6px;
      margin: 4px 0;
      cursor: grab;
      font-size: 0.9em;
    }
    .child-task .task-header {
      display: flex;
      align-items: flex-start;
      gap: 4px;
    }
    .child-task .task-checkbox {
      margin-top: 1px;
    }
    .child-task .open-btn {
      font-size: 0.8em;
      padding: 1px 3px;
    }
    .child-task.task-ghost {
      opacity: 0.4;
      background: var(--vscode-list-activeSelectionBackground);
      border: 2px dashed var(--vscode-focusBorder);
    }
    /* SortableJS styles */
    .task-ghost {
      opacity: 0.4;
      background: var(--vscode-list-activeSelectionBackground);
      border: 2px dashed var(--vscode-focusBorder);
    }
    .task-chosen {
      background: var(--vscode-list-activeSelectionBackground);
      border-color: var(--vscode-focusBorder);
    }
    .task-drag {
      opacity: 1;
      background: var(--vscode-list-activeSelectionBackground);
    }
    .tasks {
      min-height: 20px;
    }
    .sortable-placeholder {
      height: 40px;
      background: var(--vscode-list-hoverBackground);
      border: 2px dashed var(--vscode-focusBorder);
      border-radius: 3px;
      margin-bottom: 6px;
    }
    /* Column picker modal */
    .column-picker-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .column-picker {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      min-width: 200px;
      max-width: 300px;
    }
    .column-picker-title {
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .column-picker-option {
      display: block;
      width: 100%;
      padding: 8px 12px;
      margin: 4px 0;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      color: var(--vscode-foreground);
      cursor: pointer;
      text-align: left;
    }
    .column-picker-option:hover {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }
    .column-picker-cancel {
      display: block;
      width: 100%;
      padding: 8px 12px;
      margin-top: 8px;
      background: transparent;
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      text-align: center;
    }
    .column-picker-cancel:hover {
      background: var(--vscode-list-hoverBackground);
    }
  </style>
</head>
<body>
  <div id="content">
    <div class="no-file">
      Open a markdown file to view your todo board.<br>
      Use the command "Todo Sidebar: Open Markdown File"
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let board = null;

    function renderChildTask(child, isDoneColumn) {
      return \`
        <div class="child-task" draggable="true" data-line="\${child.line}" data-in-done="\${isDoneColumn}">
          <div class="task-header">
            <input type="checkbox" class="task-checkbox" \${child.checked ? 'checked' : ''} data-line="\${child.line}" data-in-done="\${isDoneColumn}">
            <span class="task-text \${child.checked ? 'checked' : ''}">\${escapeHtml(child.text)}</span>
            <button class="open-btn" data-line="\${child.line}" title="Open in editor">↗</button>
          </div>
        </div>
      \`;
    }

    function renderTask(task, isDoneColumn = false) {
      const children = task.children.map(child => renderChildTask(child, isDoneColumn)).join('');

      return \`
        <div class="task" draggable="true" data-line="\${task.line}" data-in-done="\${isDoneColumn}">
          <div class="task-header">
            <input type="checkbox" class="task-checkbox" \${task.checked ? 'checked' : ''} data-line="\${task.line}" data-in-done="\${isDoneColumn}">
            <span class="task-text \${task.checked ? 'checked' : ''}">\${escapeHtml(task.text)}</span>
            <button class="open-btn" data-line="\${task.line}" title="Open in editor">↗</button>
          </div>
          <div class="children" data-parent-line="\${task.line}">\${children}</div>
        </div>
      \`;
    }

    function renderColumn(column) {
      const tasks = column.tasks.map(task => renderTask(task, column.isDoneColumn)).join('');
      return \`
        <div class="column" data-section="\${escapeHtml(column.title)}" data-is-done="\${column.isDoneColumn}">
          <div class="column-header">\${escapeHtml(column.title)}</div>
          <div class="tasks" data-section="\${escapeHtml(column.title)}">\${tasks}</div>
        </div>
      \`;
    }

    function renderBoard(board) {
      if (!board || !board.columns || board.columns.length === 0) {
        return '<div class="no-file">No columns found in the markdown file.</div>';
      }

      const columns = board.columns.map(col => renderColumn(col)).join('');
      return \`
        <div class="board-header">
          \${board.title ? '<h2 class="board-title">' + escapeHtml(board.title) + '</h2>' : ''}
          \${board.description ? '<p class="board-description">' + escapeHtml(board.description) + '</p>' : ''}
        </div>
        <div class="board">\${columns}</div>
      \`;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function updateUI() {
      document.getElementById('content').innerHTML = renderBoard(board);
      setupEventListeners();
    }

    let pendingUncheckLine = null;

    function showColumnPicker(columns, taskLine) {
      // Filter out the Done column - user shouldn't move back to Done
      const availableColumns = columns.filter(c => !c.isDoneColumn);

      const overlay = document.createElement('div');
      overlay.className = 'column-picker-overlay';
      overlay.innerHTML = \`
        <div class="column-picker">
          <div class="column-picker-title">Move task to:</div>
          \${availableColumns.map(c => \`
            <button class="column-picker-option" data-column="\${escapeHtml(c.title)}">\${escapeHtml(c.title)}</button>
          \`).join('')}
          <button class="column-picker-cancel">Cancel</button>
        </div>
      \`;

      overlay.addEventListener('click', (e) => {
        if (e.target.classList.contains('column-picker-option')) {
          const targetColumn = e.target.dataset.column;
          vscode.postMessage({ type: 'toggle', line: taskLine, checked: false, targetColumn });
          overlay.remove();
        } else if (e.target.classList.contains('column-picker-cancel') || e.target === overlay) {
          // Cancel - revert the checkbox
          const checkbox = document.querySelector(\`.task-checkbox[data-line="\${taskLine}"]\`);
          if (checkbox) checkbox.checked = true;
          overlay.remove();
        }
      });

      document.body.appendChild(overlay);
    }

    function setupEventListeners() {
      // Checkboxes
      document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const line = parseInt(e.target.dataset.line);
          const checked = e.target.checked;
          const inDone = e.target.dataset.inDone === 'true';

          if (!checked && inDone) {
            // Unchecking in Done column - show column picker
            pendingUncheckLine = line;
            vscode.postMessage({ type: 'getColumns', line });
          } else {
            // Normal toggle
            vscode.postMessage({ type: 'toggle', line, checked });
          }
        });
      });

      // Open buttons
      document.querySelectorAll('.open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const line = parseInt(e.target.dataset.line);
          vscode.postMessage({ type: 'openAtLine', line });
        });
      });

      // SortableJS for column-level tasks
      document.querySelectorAll('.tasks').forEach(taskList => {
        new Sortable(taskList, {
          group: 'shared',
          animation: 150,
          ghostClass: 'task-ghost',
          chosenClass: 'task-chosen',
          dragClass: 'task-drag',
          onEnd: (evt) => {
            const taskLine = parseInt(evt.item.dataset.line);
            const targetSection = evt.to.dataset.section;
            const targetParentLine = evt.to.dataset.parentLine;
            const newIndex = evt.newIndex;

            if (targetParentLine) {
              // Dropped into a parent task's children area
              vscode.postMessage({
                type: 'moveToParent',
                taskLine,
                parentLine: parseInt(targetParentLine),
                position: newIndex === 0 ? 'top' : 'bottom'
              });
            } else if (targetSection) {
              // Dropped into a column
              const position = newIndex === 0 ? 'top' : 'bottom';
              vscode.postMessage({ type: 'move', taskLine, targetSection, position });
            }
          }
        });
      });

      // SortableJS for child tasks within parent tasks
      document.querySelectorAll('.children').forEach(childList => {
        new Sortable(childList, {
          group: 'shared',
          animation: 150,
          ghostClass: 'task-ghost',
          chosenClass: 'task-chosen',
          dragClass: 'task-drag',
          onEnd: (evt) => {
            const taskLine = parseInt(evt.item.dataset.line);
            const targetSection = evt.to.dataset.section;
            const targetParentLine = evt.to.dataset.parentLine;
            const newIndex = evt.newIndex;

            if (targetParentLine) {
              // Dropped into a parent task's children area
              vscode.postMessage({
                type: 'moveToParent',
                taskLine,
                parentLine: parseInt(targetParentLine),
                position: newIndex === 0 ? 'top' : 'bottom'
              });
            } else if (targetSection) {
              // Promoted to column level (dragged out of parent)
              const position = newIndex === 0 ? 'top' : 'bottom';
              vscode.postMessage({ type: 'move', taskLine, targetSection, position });
            }
          }
        });
      });
    }

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'update') {
        board = message.board;
        updateUI();
      } else if (message.type === 'columnsForPicker') {
        showColumnPicker(message.columns, message.taskLine);
      }
    });
  </script>
</body>
</html>`;
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
/* 4 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.serializeBoard = serializeBoard;
exports.toggleTaskInContent = toggleTaskInContent;
exports.moveTaskInContent = moveTaskInContent;
exports.moveTaskToParent = moveTaskToParent;
function serializeTask(task, indent = 0) {
    const lines = [];
    const prefix = ' '.repeat(indent);
    const checkbox = task.checked ? '[x]' : '[ ]';
    lines.push(`${prefix}- ${checkbox} ${task.text}`);
    for (const child of task.children) {
        lines.push(...serializeTask(child, indent + 2));
    }
    return lines;
}
function serializeColumn(column) {
    const lines = [];
    lines.push(`## ${column.title}`);
    lines.push('');
    for (const task of column.tasks) {
        lines.push(...serializeTask(task));
    }
    lines.push('');
    return lines;
}
function serializeBoard(board) {
    const lines = [];
    if (board.title) {
        lines.push(`# ${board.title}`);
        lines.push('');
    }
    if (board.description) {
        const descLines = board.description.split('\n');
        for (const descLine of descLines) {
            lines.push(`> ${descLine}`);
        }
        lines.push('');
    }
    for (const column of board.columns) {
        lines.push(...serializeColumn(column));
    }
    return lines.join('\n');
}
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
function moveTaskInContent(content, taskLine, targetSectionTitle, position = 'bottom') {
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
    // Find the target section and insert at top or bottom
    let targetInsertIndex = -1;
    for (let j = 0; j < newLines.length; j++) {
        const sectionMatch = newLines[j].match(/^##\s+(.+)$/);
        if (sectionMatch) {
            // Compare section titles (normalize by trimming)
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
                else {
                    // Find the end of this section (next ## or end of file)
                    let endOfSection = j + 1;
                    while (endOfSection < newLines.length) {
                        if (newLines[endOfSection].match(/^##\s+/)) {
                            break;
                        }
                        endOfSection++;
                    }
                    // Insert before the next section or at end
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
function moveTaskToParent(content, taskLine, parentLine, position = 'bottom') {
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
    else {
        // Find end of parent's children
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