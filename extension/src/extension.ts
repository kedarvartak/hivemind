import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { JsonStore } from "./store";
import { SidebarProvider } from "./SidebarProvider";

function resolveMemoryDir(): string {
  const config = vscode.workspace
    .getConfiguration("memoree")
    .get<string>("memoryDir");

  if (config && config.trim()) {
    return config.trim();
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return path.join(folders[0].uri.fsPath, ".memoree");
  }

  return path.join(os.homedir(), ".memoree");
}

export function activate(context: vscode.ExtensionContext): void {
  const memoryDir = resolveMemoryDir();
  const store = new JsonStore(memoryDir);
  store.init();

  const provider = new SidebarProvider(context.extensionUri, store, context.globalState);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider)
  );
  
  // Expose a command to refresh the sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand("memoree.refresh", () => {
      provider.refresh();
    })
  );

  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("memoree.memoryDir")) {
      void vscode.window
        .showInformationMessage("Memoree: memory directory changed. Reload window?", "Reload")
        .then((v) => {
          if (v === "Reload") {
            void vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
    }
  });
  
  context.subscriptions.push(onConfigChange);

  vscode.window.showInformationMessage(
    `HiveMind Sidebar UI ready — memory dir: ${memoryDir}`,
  );
}

export function deactivate(): void {
  // no-op
}
