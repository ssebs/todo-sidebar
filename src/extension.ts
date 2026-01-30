import * as vscode from 'vscode';
import { KanbanViewProvider } from './KanbanViewProvider';

let kanbanProvider: KanbanViewProvider;

export function activate(context: vscode.ExtensionContext) {
	console.log('Todo Sidebar extension is now active!');

	// Create and register the webview provider
	kanbanProvider = new KanbanViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			KanbanViewProvider.viewType,
			kanbanProvider
		)
	);

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

export function deactivate() {
	if (kanbanProvider) {
		kanbanProvider.dispose();
	}
}
