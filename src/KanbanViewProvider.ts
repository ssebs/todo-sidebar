import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseMarkdown, Board, Task, Column } from './parser';
import { toggleTaskInContent, moveTaskInContent, moveTaskToParent, addTaskToSection, editTaskTextInContent, addSubtaskToParent, deleteTaskInContent } from './serializer';

export class KanbanViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'todoSidebar.kanbanView';

  private _view?: vscode.WebviewView;
  private _activeFileUri?: vscode.Uri;
  private _board?: Board;
  private _disposables: vscode.Disposable[] = [];
  private _pendingEditLine?: number;

  // History stack for undo/redo
  private _historyStack: string[] = [];
  private _historyIndex: number = -1;
  private _maxHistorySize: number = 50;
  private _isUndoRedo: boolean = false;

  // Periodic refresh timer
  private _periodicRefreshTimer?: NodeJS.Timeout;
  private _periodicRefreshInterval: number = 5000; // 5 seconds

  // Debounce timer for refresh
  private _refreshDebounceTimer?: NodeJS.Timeout;
  private _refreshDebounceMs: number = 100; // Debounce refresh calls by 100ms

  // Track if webview is in edit mode (to skip refreshes)
  private _isEditing: boolean = false;

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

    // Don't set HTML here - let _refresh() handle it based on whether activeFile is set
    // webviewView.webview.html will be set in the restoration logic or _refresh()

    // Handle visibility changes - refresh when panel becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._activeFileUri) {
        this._refresh();
        this._startPeriodicRefresh();
      } else {
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
    const savedPath = config.get<string>('activeFile');
    console.log('Attempting to restore activeFile from settings:', savedPath);
    if (savedPath) {
      try {
        // Support relative paths (e.g., "./README.md" or "docs/todo.md")
        if (savedPath.startsWith('./') || savedPath.startsWith('../') || !path.isAbsolute(savedPath)) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            this._activeFileUri = vscode.Uri.joinPath(workspaceFolder.uri, savedPath);
          }
        } else {
          this._activeFileUri = vscode.Uri.file(savedPath);
        }
        if (this._activeFileUri) {
          console.log('Restored activeFile:', this._activeFileUri.fsPath);
        }
      } catch (e) {
        console.error('Failed to restore saved file:', e);
      }
    }

    // Always refresh when view becomes visible (this will show wizard or board)
    this._refresh();
    if (this._activeFileUri) {
      this._startPeriodicRefresh();
    }
  }

  private _startPeriodicRefresh() {
    // Clear any existing timer
    this._stopPeriodicRefresh();

    // Only start if view is visible and a file is active
    if (this._view?.visible && this._activeFileUri) {
      this._periodicRefreshTimer = setInterval(() => {
        if (this._view?.visible && this._activeFileUri) {
          this._refresh();
        } else {
          this._stopPeriodicRefresh();
        }
      }, this._periodicRefreshInterval);
    }
  }

  private _stopPeriodicRefresh() {
    if (this._periodicRefreshTimer) {
      clearInterval(this._periodicRefreshTimer);
      this._periodicRefreshTimer = undefined;
    }
  }

  private _setupFileWatchers() {
    // Watch for text document changes - use debounced refresh to avoid rapid re-renders
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this._activeFileUri && e.document.uri.toString() === this._activeFileUri.toString()) {
          this._debouncedRefresh();
        }
      })
    );

    // Watch for file system changes - use debounced refresh
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    this._disposables.push(
      watcher.onDidChange((uri) => {
        if (this._activeFileUri && uri.toString() === this._activeFileUri.toString()) {
          this._debouncedRefresh();
        }
      })
    );
    this._disposables.push(watcher);

    // Watch for settings.json changes to pick up manual edits to activeFile
    const settingsWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/settings.json');
    this._disposables.push(
      settingsWatcher.onDidChange(() => {
        this._reloadActiveFileFromConfig();
      })
    );
    this._disposables.push(settingsWatcher);

    // Also watch for configuration changes (covers both file edits and UI changes)
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('todoSidebar.activeFile')) {
          this._reloadActiveFileFromConfig();
        }
        if (e.affectsConfiguration('todoSidebar.hiddenSections')) {
          this._refresh();
        }
      })
    );
  }

  private _reloadActiveFileFromConfig() {
    const config = vscode.workspace.getConfiguration('todoSidebar');
    const savedPath = config.get<string>('activeFile');
    console.log('Config changed, reloading activeFile:', savedPath);

    if (savedPath) {
      try {
        // Support relative paths (e.g., "./README.md" or "docs/todo.md")
        if (savedPath.startsWith('./') || savedPath.startsWith('../') || !path.isAbsolute(savedPath)) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            this._activeFileUri = vscode.Uri.joinPath(workspaceFolder.uri, savedPath);
          }
        } else {
          this._activeFileUri = vscode.Uri.file(savedPath);
        }
        if (this._activeFileUri) {
          console.log('Reloaded activeFile:', this._activeFileUri.fsPath);
          this._refresh();
        }
      } catch (e) {
        console.error('Failed to reload saved file:', e);
      }
    } else {
      this._activeFileUri = undefined;
      this._board = undefined;
      this._view?.webview.postMessage({ type: 'update', board: null });
    }
  }

  public async setActiveFile(uri: vscode.Uri) {
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

      // Read existing settings content
      let existingText = '';
      let fileExists = false;
      try {
        const content = await vscode.workspace.fs.readFile(settingsPath);
        existingText = Buffer.from(content).toString('utf-8');
        fileExists = true;
      } catch (e) {
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
      let newText: string;

      if (!fileExists || existingText.trim() === '') {
        // Create new settings file with default onDoneAction
        newText = `{\n    "todoSidebar.activeFile": ${escapedPath},\n    "todoSidebar.onDoneAction": "move"\n}`;
      } else {
        // Parse existing file to check for settings
        const hasActiveFile = activeFilePattern.test(existingText);
        const hasOnDoneAction = onDoneActionPattern.test(existingText);

        if (hasActiveFile) {
          // Update existing activeFile setting in place
          newText = existingText.replace(activeFilePattern, `"todoSidebar.activeFile": ${escapedPath}`);
        } else {
          // Insert activeFile setting after opening brace
          const insertMatch = existingText.match(/^\s*\{/);
          if (insertMatch) {
            const insertPos = insertMatch[0].length;
            const before = existingText.slice(0, insertPos);
            const after = existingText.slice(insertPos);
            const needsComma = after.trim().length > 0 && after.trim() !== '}';
            const newSetting = `\n    "todoSidebar.activeFile": ${escapedPath}${needsComma ? ',' : ''}`;
            newText = before + newSetting + after;
          } else {
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

    } catch (e) {
      console.error('Failed to save activeFile to settings:', e);
      vscode.window.showErrorMessage(`Failed to save todo file selection: ${e}`);
    }
    await this._refresh();
    this._startPeriodicRefresh();
  }

  public async refresh() {
    await this._refresh();
  }

  private async _readActiveFile(): Promise<string> {
    if (!this._activeFileUri) {
      return '';
    }
    const content = await vscode.workspace.fs.readFile(this._activeFileUri);
    return Buffer.from(content).toString('utf-8');
  }

  private async _writeActiveFile(text: string): Promise<void> {
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
      } else {
        this._historyIndex++;
      }
    }

    await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(text, 'utf-8'));
  }

  private async _handleUndo() {
    if (this._historyIndex <= 0 || !this._activeFileUri) {
      return;
    }

    this._historyIndex--;
    const previousContent = this._historyStack[this._historyIndex];

    this._isUndoRedo = true;
    try {
      await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(previousContent, 'utf-8'));
    } finally {
      this._isUndoRedo = false;
    }
  }

  private async _handleRedo() {
    if (this._historyIndex >= this._historyStack.length - 1 || !this._activeFileUri) {
      return;
    }

    this._historyIndex++;
    const nextContent = this._historyStack[this._historyIndex];

    this._isUndoRedo = true;
    try {
      await vscode.workspace.fs.writeFile(this._activeFileUri, Buffer.from(nextContent, 'utf-8'));
    } finally {
      this._isUndoRedo = false;
    }
  }

  private async _refresh(force: boolean = false) {
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

      this._board = parseMarkdown(text);

      // Filter out hidden sections based on configuration
      const config = vscode.workspace.getConfiguration('todoSidebar');
      const hiddenSections = config.get<string[]>('hiddenSections', []);

      const filteredBoard = {
        ...this._board,
        columns: this._board.columns.filter(col =>
          !this._isColumnHidden(col.title, hiddenSections)
        )
      };

      const editLine = this._pendingEditLine;
      this._pendingEditLine = undefined;
      this._view.webview.postMessage({ type: 'update', board: filteredBoard, editLine });
    } catch (error) {
      console.error('Error refreshing kanban board:', error);
    }
  }

  /**
   * Debounced refresh - prevents rapid re-renders from file watcher events
   */
  private _debouncedRefresh() {
    if (this._refreshDebounceTimer) {
      clearTimeout(this._refreshDebounceTimer);
    }
    this._refreshDebounceTimer = setTimeout(() => {
      this._refreshDebounceTimer = undefined;
      this._refresh();
    }, this._refreshDebounceMs);
  }

  private async _handleToggle(line: number, checked: boolean, targetColumn?: string) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      let text = await this._readActiveFile();

      // Re-parse the board from fresh content to get accurate line numbers
      const currentBoard = parseMarkdown(text);

      // Only move top-level tasks to Done column (not subtasks)
      const isTopLevel = this._isTopLevelTaskInBoard(line, currentBoard);

      // Get the onDoneAction configuration
      const config = vscode.workspace.getConfiguration('todoSidebar');
      const onDoneAction = config.get<string>('onDoneAction', 'move');

      if (checked && isTopLevel) {
        // Check configuration for what to do when a task is marked as done
        if (onDoneAction === 'delete') {
          // Delete the task and its children immediately without toggling
          text = deleteTaskInContent(text, line);
        } else {
          // Default behavior: toggle checkbox and move to Done column
          text = toggleTaskInContent(text, line, checked);

          // Move to Done column at TOP
          const doneColumn = currentBoard.columns.find((c) => c.isDoneColumn);
          if (doneColumn) {
            const currentColumn = this._findTaskColumnInBoard(line, currentBoard);
            if (currentColumn && !currentColumn.isDoneColumn) {
              text = moveTaskInContent(text, line, doneColumn.title, 'top');
            }
          }
        }
      } else if (targetColumn && isTopLevel) {
        // If unchecked and a target column is specified, move there at TOP
        text = toggleTaskInContent(text, line, checked);
        text = moveTaskInContent(text, line, targetColumn, 'top');
      } else {
        // For non-top-level tasks or other cases, just toggle the checkbox
        text = toggleTaskInContent(text, line, checked);
      }

      await this._writeActiveFile(text);
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  }

  private _isTopLevelTaskInBoard(line: number, board: Board): boolean {
    for (const column of board.columns) {
      for (const task of column.tasks) {
        if (task.line === line) {
          return true;
        }
      }
    }
    return false;
  }

  private _findTaskColumnInBoard(line: number, board: Board): Column | undefined {
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

    for (const column of board.columns) {
      if (findInTasks(column.tasks)) {
        return column;
      }
    }

    return undefined;
  }

  private _isColumnHidden(columnTitle: string, hiddenPatterns: string[]): boolean {
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
        } catch (e) {
          // Invalid regex, fall back to exact match
          if (lowerTitle === lowerPattern) {
            return true;
          }
        }
      } else if (lowerPattern.includes('*')) {
        // Simple wildcard pattern: convert * to .*
        const regexPattern = '^' + lowerPattern.replace(/\*/g, '.*') + '$';
        const regex = new RegExp(regexPattern);
        if (regex.test(lowerTitle)) {
          return true;
        }
      } else {
        // Exact match (case-insensitive)
        if (lowerTitle === lowerPattern) {
          return true;
        }
      }
    }

    return false;
  }

  private async _handleMove(taskLine: number, targetSection: string, position: 'top' | 'bottom' | 'after' = 'bottom', afterLine?: number) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      let text = await this._readActiveFile();
      text = moveTaskInContent(text, taskLine, targetSection, position, afterLine);
      await this._writeActiveFile(text);
    } catch (error) {
      console.error('Error moving task:', error);
    }
  }

  private async _handleMoveToParent(taskLine: number, parentLine: number, position: 'top' | 'bottom' | 'after' = 'bottom', afterLine?: number) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      let text = await this._readActiveFile();
      text = moveTaskToParent(text, taskLine, parentLine, position, afterLine);
      await this._writeActiveFile(text);
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
      const text = await this._readActiveFile();
      const result = addTaskToSection(text, section);

      if (result.line > 0) {
        this._pendingEditLine = result.line;
        await this._writeActiveFile(result.content);
        // Force immediate refresh to enter edit mode, don't wait for debounced file watcher
        await this._refresh(true);
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
      let text = await this._readActiveFile();
      text = editTaskTextInContent(text, line, newText);
      await this._writeActiveFile(text);
    } catch (error) {
      console.error('Error editing task text:', error);
    }
  }

  private async _handleAddSubtask(parentLine: number) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      const text = await this._readActiveFile();
      const result = addSubtaskToParent(text, parentLine);

      if (result.line > 0) {
        this._pendingEditLine = result.line;
        await this._writeActiveFile(result.content);
        // Force immediate refresh to enter edit mode, don't wait for debounced file watcher
        await this._refresh(true);
      }
    } catch (error) {
      console.error('Error adding subtask:', error);
    }
  }

  private async _handleDeleteTask(line: number) {
    if (!this._activeFileUri) {
      return;
    }

    try {
      let text = await this._readActiveFile();
      text = deleteTaskInContent(text, line);
      await this._writeActiveFile(text);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  }

  private async _handleHideSection(sectionTitle: string) {
    try {
      const config = vscode.workspace.getConfiguration('todoSidebar');
      const hiddenSections = config.get<string[]>('hiddenSections', []);

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
        } catch {
          await vscode.workspace.fs.createDirectory(vscodeDir);
        }

        // Read existing settings
        let existingText = '';
        let fileExists = false;
        try {
          const content = await vscode.workspace.fs.readFile(settingsPath);
          existingText = Buffer.from(content).toString('utf-8');
          fileExists = true;
        } catch (e) {
          // File doesn't exist
        }

        // Update or insert the hiddenSections setting
        const escapedArray = JSON.stringify(hiddenSections);
        const settingPattern = /"todoSidebar\.hiddenSections"\s*:\s*\[[^\]]*\]/;
        let newText: string;

        if (!fileExists || existingText.trim() === '') {
          // Create new settings file
          newText = `{\n    "todoSidebar.hiddenSections": ${escapedArray}\n}`;
        } else if (settingPattern.test(existingText)) {
          // Update existing setting
          newText = existingText.replace(settingPattern, `"todoSidebar.hiddenSections": ${escapedArray}`);
        } else {
          // Insert new setting after opening brace
          const insertMatch = existingText.match(/^\s*\{/);
          if (insertMatch) {
            const insertPos = insertMatch[0].length;
            const before = existingText.slice(0, insertPos);
            const after = existingText.slice(insertPos);
            const needsComma = after.trim().length > 0 && after.trim() !== '}';
            const newSetting = `\n    "todoSidebar.hiddenSections": ${escapedArray}${needsComma ? ',' : ''}`;
            newText = before + newSetting + after;
          } else {
            // Fallback: file is malformed, create new
            newText = `{\n    "todoSidebar.hiddenSections": ${escapedArray}\n}`;
          }
        }

        await vscode.workspace.fs.writeFile(settingsPath, Buffer.from(newText, 'utf-8'));
        console.log('Added section to hiddenSections:', sectionTitle);

        // Show a message to the user
        vscode.window.showInformationMessage(`Section "${sectionTitle}" is now hidden. Edit settings to unhide.`);
      }
    } catch (error) {
      console.error('Error hiding section:', error);
      vscode.window.showErrorMessage(`Failed to hide section: ${error}`);
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

  private _getWelcomeHtmlForWebview(webview: vscode.Webview): string {
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

  private async _handleSelectFile() {
    const options: vscode.OpenDialogOptions = {
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

  private async _handleSaveWizard(filePath: string, onDoneAction: string) {
    try {
      // Set the active file
      const uri = vscode.Uri.file(filePath);

      // Validate the file exists and is readable
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
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
      } catch {
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
      } catch (e) {
        // File doesn't exist
      }

      // Create or update settings
      const escapedPath = JSON.stringify(savePath);
      const escapedAction = JSON.stringify(onDoneAction);
      let newText: string;

      if (!fileExists || existingText.trim() === '') {
        // Create new settings file
        newText = `{\n    "todoSidebar.activeFile": ${escapedPath},\n    "todoSidebar.onDoneAction": ${escapedAction}\n}`;
      } else {
        // Update existing settings
        const activeFilePattern = /"todoSidebar\.activeFile"\s*:\s*"[^"]*"/;
        const onDoneActionPattern = /"todoSidebar\.onDoneAction"\s*:\s*"[^"]*"/;

        const hasActiveFile = activeFilePattern.test(existingText);
        const hasOnDoneAction = onDoneActionPattern.test(existingText);

        newText = existingText;

        if (hasActiveFile) {
          newText = newText.replace(activeFilePattern, `"todoSidebar.activeFile": ${escapedPath}`);
        } else {
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
        } else {
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
      this._view!.webview.html = this._getHtmlForWebview(this._view!.webview);
      await this._refresh();
      this._startPeriodicRefresh();

      vscode.window.showInformationMessage('Todo board setup complete!');
    } catch (error) {
      console.error('Error saving wizard settings:', error);
      this._view?.webview.postMessage({
        type: 'error',
        message: `Failed to save settings: ${error}`
      });
    }
  }

  private async _handleCancelWizard() {
    // User wants to skip the wizard - just close or show the "no file" message
    vscode.window.showInformationMessage(
      'You can open a markdown file anytime using the command "Todo Sidebar: Open Markdown File"'
    );
  }

  public dispose() {
    this._stopPeriodicRefresh();
    if (this._refreshDebounceTimer) {
      clearTimeout(this._refreshDebounceTimer);
    }
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
