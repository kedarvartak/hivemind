import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { JsonStore } from "./store";
import { SidebarProvider } from "./SidebarProvider";

function resolveMemoryDir(): string {
  const config = vscode.workspace
    .getConfiguration("memoree")
    .get<string>("memoryDir");

  if (config && config.trim()) return config.trim();

  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return path.join(folders[0].uri.fsPath, ".memoree");
  }

  return path.join(os.homedir(), ".memoree");
}

function getTursoCredentials(): { url: string; token: string } {
  const cfg = vscode.workspace.getConfiguration("hivemind");
  return {
    url: cfg.get<string>("tursoUrl") ?? "",
    token: cfg.get<string>("tursoToken") ?? "",
  };
}

export function activate(context: vscode.ExtensionContext): void {
  const memoryDir = resolveMemoryDir();
  const store = new JsonStore(memoryDir);
  store.init();

  const { url, token } = getTursoCredentials();

  const provider = new SidebarProvider(
    context.extensionUri,
    store,
    url,
    token,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("memoree.refresh", () => {
      provider.refresh();
    }),
  );

  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration("memoree.memoryDir") ||
      e.affectsConfiguration("hivemind.tursoUrl") ||
      e.affectsConfiguration("hivemind.tursoToken")
    ) {
      void vscode.window
        .showInformationMessage(
          "HiveMind: settings changed. Reload window to apply.",
          "Reload",
        )
        .then((v) => {
          if (v === "Reload") {
            void vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
    }
  });

  context.subscriptions.push(onConfigChange);

  if (!url || !token) {
    void vscode.window.showWarningMessage(
      "HiveMind: Turso credentials not set. Open Settings and add hivemind.tursoUrl and hivemind.tursoToken to enable cloud sync.",
    );
  }
}

export function deactivate(): void {
  // no-op
}
