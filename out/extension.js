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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const KanbanViewProvider_1 = require("./KanbanViewProvider");
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
//# sourceMappingURL=extension.js.map