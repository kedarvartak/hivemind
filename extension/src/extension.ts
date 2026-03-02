import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { JsonStore } from "./store";
import { MemoryTreeProvider, BlockTreeItem } from "./MemoryTreeProvider";
import { BlockEditorPanel } from "./BlockEditorPanel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveMemoryDir(): string {
  const config = vscode.workspace
    .getConfiguration("memoree")
    .get<string>("memoryDir");

  if (config && config.trim()) {
    return config.trim();
  }

  // Default: first workspace folder → .memoree/, else home dir
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return path.join(folders[0].uri.fsPath, ".memoree");
  }

  return path.join(os.homedir(), ".memoree");
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  const memoryDir = resolveMemoryDir();
  const store = new JsonStore(memoryDir);

  try {
    store.init();
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Memoree: failed to initialise memory store at ${memoryDir}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return;
  }

  const treeProvider = new MemoryTreeProvider(store);

  // ── Tree view ──────────────────────────────────────────────────────────────
  const treeView = vscode.window.createTreeView("memoree.blocksView", {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

  // ── Commands ───────────────────────────────────────────────────────────────

  const refresh = vscode.commands.registerCommand("memoree.refresh", () => {
    treeProvider.refresh();
  });

  const newBlock = vscode.commands.registerCommand("memoree.newBlock", () => {
    BlockEditorPanel.openNew(
      store,
      () => treeProvider.refresh(),
      context.extensionUri,
    );
  });

  const editBlock = vscode.commands.registerCommand(
    "memoree.editBlock",
    (item?: BlockTreeItem) => {
      if (!item) {
        vscode.window.showWarningMessage("Select a block to edit.");
        return;
      }
      BlockEditorPanel.open(
        item.block,
        store,
        () => treeProvider.refresh(),
        context.extensionUri,
      );
    },
  );

  const deleteBlock = vscode.commands.registerCommand(
    "memoree.deleteBlock",
    async (item?: BlockTreeItem) => {
      if (!item) {
        return;
      }
      const answer = await vscode.window.showWarningMessage(
        `Delete "${item.block.topic}"? This cannot be undone.`,
        { modal: true },
        "Delete",
      );
      if (answer === "Delete") {
        try {
          store.deleteBlock(item.block.id);
          treeProvider.refresh();
          void vscode.window.showInformationMessage(
            `Deleted: "${item.block.topic}"`,
          );
        } catch (err) {
          void vscode.window.showErrorMessage(
            `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    },
  );

  const copyId = vscode.commands.registerCommand(
    "memoree.copyId",
    (item?: BlockTreeItem) => {
      if (!item) {
        return;
      }
      void vscode.env.clipboard.writeText(item.block.id);
      vscode.window.showInformationMessage(`Copied ID: ${item.block.id}`);
    },
  );

  // ── File system watcher (auto-refresh when MCP server or another agent writes) ──
  const indexUri = vscode.Uri.file(path.join(memoryDir, "index.json"));
  const fsWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(memoryDir), "*.json"),
  );
  fsWatcher.onDidChange(() => treeProvider.refresh());
  fsWatcher.onDidCreate(() => treeProvider.refresh());
  fsWatcher.onDidDelete(() => treeProvider.refresh());
  context.subscriptions.push(fsWatcher);
  void indexUri; // used indirectly via watcher pattern above

  // ── Search box in the view title bar ──────────────────────────────────────
  const onChangedTitle = treeView.onDidChangeVisibility(() => {
    treeProvider.refresh();
  });

  // Quick-pick filter command (palette: "Memoree: Search Blocks")
  const searchBlocks = vscode.commands.registerCommand(
    "memoree.search",
    async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search memory blocks",
        placeHolder: "topic, tag, or keyword…",
      });
      if (query !== undefined) {
        treeProvider.setFilter(query);
      }
    },
  );

  // Also re-run filter on workspace config change (user changes memoryDir)
  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("memoree.memoryDir")) {
      const newDir = resolveMemoryDir();
      // Re-init is not possible without re-creating, so prompt user
      vscode.window
        .showInformationMessage(
          `Memoree: memory directory changed to ${newDir}. Reload window?`,
          "Reload",
        )
        .then((v) => {
          if (v === "Reload") {
            void vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
    }
  });

  // ── Status bar ─────────────────────────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    50,
  );
  statusBar.command = "memoree.newBlock";
  statusBar.tooltip = "Memoree: click to add a new memory block";

  const updateStatusBar = () => {
    try {
      const count = store.listBlocks().length;
      statusBar.text = `$(note) ${count} block${count === 1 ? "" : "s"}`;
    } catch {
      statusBar.text = `$(note) ??`;
    }
    statusBar.show();
  };

  updateStatusBar();

  // Rebuild status bar count whenever tree refreshes
  treeProvider.onDidChangeTreeData(() => updateStatusBar());

  // ── Dispose ────────────────────────────────────────────────────────────────
  context.subscriptions.push(
    refresh,
    newBlock,
    editBlock,
    deleteBlock,
    copyId,
    searchBlocks,
    onChangedTitle,
    onConfigChange,
    statusBar,
    treeView,
  );

  vscode.window.showInformationMessage(
    `Memoree ready — memory dir: ${memoryDir}`,
  );
}

export function deactivate(): void {
  // nothing to clean up
}
