import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseMarkdown, Board, Task, Column } from './parser';
import { toggleTaskInContent, moveTaskInContent, moveTaskToParent, addTaskToSection, editTaskTextInContent, addSubtaskToParent } from './serializer';

export class KanbanViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'todoSidebar.kanbanView';

  private _view?: vscode.WebviewView;
  private _activeFileUri?: vscode.Uri;
  private _board?: Board;
  private _disposables: vscode.Disposable[] = [];
  private _pendingEditLine?: number;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
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
    const savedPath = config.get<string>('activeFile');
    console.log('Attempting to restore activeFile from settings:', savedPath);
    if (savedPath) {
      try {
        this._activeFileUri = vscode.Uri.file(savedPath);
        console.log('Restored activeFile:', this._activeFileUri.fsPath);
      } catch (e) {
        console.error('Failed to restore saved file:', e);
      }
    }

    // Always refresh when view becomes visible
    if (this._activeFileUri) {
      this._refresh();
    }
  }

  private _setupFileWatchers() {
    // Watch for text document changes
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this._activeFileUri && e.document.uri.toString() === this._activeFileUri.toString()) {
          this._refresh();
        }
      })
    );

    // Watch for file system changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    this._disposables.push(
      watcher.onDidChange((uri) => {
        if (this._activeFileUri && uri.toString() === this._activeFileUri.toString()) {
          this._refresh();
        }
      })
    );
    this._disposables.push(watcher);
  }

  public async setActiveFile(uri: vscode.Uri) {
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

      const workspaceFolder = vscode.workspace.workspaceFolders![0];
      const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
      const settingsPath = vscode.Uri.joinPath(vscodeDir, 'settings.json');

      // Ensure .vscode directory exists
      try {
        await vscode.workspace.fs.stat(vscodeDir);
      } catch {
        await vscode.workspace.fs.createDirectory(vscodeDir);
        console.log('Created .vscode directory');
      }

      // Read existing settings or create new object
      let settings: any = {};
      let existingText = '';
      try {
        const content = await vscode.workspace.fs.readFile(settingsPath);
        existingText = Buffer.from(content).toString('utf-8');
        // Try to parse, stripping comments if needed
        const stripped = existingText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        settings = JSON.parse(stripped);
      } catch (e) {
        console.log('Creating new settings.json file (or couldn\'t parse existing)');
      }

      // Update the todoSidebar.activeFile setting
      settings['todoSidebar.activeFile'] = uri.fsPath;

      // Write back to settings.json with proper formatting
      const settingsText = JSON.stringify(settings, null, 4);
      await vscode.workspace.fs.writeFile(settingsPath, Buffer.from(settingsText, 'utf-8'));
      console.log('Saved activeFile to .vscode/settings.json:', uri.fsPath);

    } catch (e) {
      console.error('Failed to save activeFile to settings:', e);
      vscode.window.showErrorMessage(`Failed to save todo file selection: ${e}`);
    }
    await this._refresh();
  }

  public async refresh() {
    await this._refresh();
  }

  private async _refresh() {
    if (!this._activeFileUri || !this._view) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this._activeFileUri);
      const text = Buffer.from(content).toString('utf-8');
      this._board = parseMarkdown(text);
      const editLine = this._pendingEditLine;
      this._pendingEditLine = undefined;
      this._view.webview.postMessage({ type: 'update', board: this._board, editLine });
    } catch (error) {
      console.error('Error refreshing kanban board:', error);
    }
  }

  private async _handleToggle(line: number, checked: boolean, targetColumn?: string) {
    if (!this._activeFileUri || !this._board) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this._activeFileUri);
      let text = Buffer.from(content).toString('utf-8');

      // Toggle the checkbox
      text = toggleTaskInContent(text, line, checked);

      // Only move top-level tasks to Done column (not subtasks)
      const isTopLevel = this._isTopLevelTask(line);

      if (checked && isTopLevel) {
        // If checked and top-level, move to Done column at TOP
        const doneColumn = this._board.columns.find((c) => c.isDoneColumn);
        if (doneColumn) {
          const currentColumn = this._findTaskColumn(line);
          if (currentColumn && !currentColumn.isDoneColumn) {
            text = moveTaskInContent(text, line, doneColumn.title, 'top');
          }
        }
      } else if (targetColumn && isTopLevel) {
        // If unchecked and a target column is specified, move there at TOP
        text = moveTaskInContent(text, line, targetColumn, 'top');
      }

      await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  }

  private _isTopLevelTask(line: number): boolean {
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

  private _findTaskColumn(line: number): Column | undefined {
    if (!this._board) {
      return undefined;
    }

    const findInTasks = (tasks: Task[]): boolean => {
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

  private async _handleMove(taskLine: number, targetSection: string, position: 'top' | 'bottom' | 'after' = 'bottom', afterLine?: number) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this._activeFileUri);
      let text = Buffer.from(content).toString('utf-8');
      text = moveTaskInContent(text, taskLine, targetSection, position, afterLine);
      await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
    } catch (error) {
      console.error('Error moving task:', error);
    }
  }

  private async _handleMoveToParent(taskLine: number, parentLine: number, position: 'top' | 'bottom' | 'after' = 'bottom', afterLine?: number) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this._activeFileUri);
      let text = Buffer.from(content).toString('utf-8');
      text = moveTaskToParent(text, taskLine, parentLine, position, afterLine);
      await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
    } catch (error) {
      console.error('Error moving task to parent:', error);
    }
  }

  private async _handleOpenAtLine(line: number) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(this._activeFileUri);
      const editor = await vscode.window.showTextDocument(document);
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      console.error('Error opening file at line:', error);
    }
  }

  private async _handleAddTask(section: string) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this._activeFileUri);
      const text = Buffer.from(content).toString('utf-8');
      const result = addTaskToSection(text, section);

      if (result.line > 0) {
        this._pendingEditLine = result.line;
        await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(result.content, 'utf-8'));
      }
    } catch (error) {
      console.error('Error adding task:', error);
    }
  }

  private async _handleEditTaskText(line: number, newText: string) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this._activeFileUri);
      let text = Buffer.from(content).toString('utf-8');
      text = editTaskTextInContent(text, line, newText);
      await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
    } catch (error) {
      console.error('Error editing task text:', error);
    }
  }

  private async _handleAddSubtask(parentLine: number) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this._activeFileUri);
      const text = Buffer.from(content).toString('utf-8');
      const result = addSubtaskToParent(text, parentLine);

      if (result.line > 0) {
        this._pendingEditLine = result.line;
        await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(result.content, 'utf-8'));
      }
    } catch (error) {
      console.error('Error adding subtask:', error);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    // Read the HTML template file
    const htmlPath = path.join(this._context.extensionPath, 'src', 'webview.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    // Replace placeholders with actual values
    html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
    html = html.replace(/\{\{nonce\}\}/g, nonce);

    return html;
  }

  public dispose() {
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
