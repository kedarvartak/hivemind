import * as vscode from "vscode";
import type { MemoryBlock } from "./types";
import type { JsonStore } from "./store";

interface SaveMessage {
  type: "save";
  topic: string;
  content: string;
  tags: string[];
}

interface ReadyMessage {
  type: "ready";
}

type WebviewMessage = SaveMessage | ReadyMessage;

export class BlockEditorPanel {
  static readonly viewType = "memoree.blockEditor";

  private static _panels = new Map<string, BlockEditorPanel>();

  private readonly _panel: vscode.WebviewPanel;
  private _block: MemoryBlock;
  private readonly _store: JsonStore;
  private readonly _onSaved: () => void;
  private _disposables: vscode.Disposable[] = [];

  static open(
    block: MemoryBlock,
    store: JsonStore,
    onSaved: () => void,
    extensionUri: vscode.Uri,
  ): void {
    const existing = BlockEditorPanel._panels.get(block.id);
    if (existing) {
      existing._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      BlockEditorPanel.viewType,
      block.topic,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    new BlockEditorPanel(panel, block, store, onSaved);
  }

  static openNew(
    store: JsonStore,
    onSaved: () => void,
    extensionUri: vscode.Uri,
  ): void {
    const blank: MemoryBlock = {
      id: "__new__",
      topic: "",
      content: "",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 0,
      metadata: {},
    };

    const panel = vscode.window.createWebviewPanel(
      BlockEditorPanel.viewType,
      "New Block",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    new BlockEditorPanel(panel, blank, store, onSaved);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    block: MemoryBlock,
    store: JsonStore,
    onSaved: () => void,
  ) {
    this._panel = panel;
    this._block = block;
    this._store = store;
    this._onSaved = onSaved;

    BlockEditorPanel._panels.set(block.id, this);

    this._panel.webview.html = this._buildHtml();

    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        if (message.type === "save") {
          this._handleSave(message);
        }
      },
      null,
      this._disposables,
    );

    this._panel.onDidDispose(
      () => this._dispose(),
      null,
      this._disposables,
    );
  }

  private _handleSave(msg: SaveMessage): void {
    try {
      if (this._block.id === "__new__") {
        const created = this._store.createBlock(msg.topic, msg.content, msg.tags);
        BlockEditorPanel._panels.delete("__new__");
        this._block = created;
        BlockEditorPanel._panels.set(created.id, this);
        this._panel.title = created.topic;
      } else {
        this._block = this._store.updateBlock(
          this._block.id,
          msg.topic,
          msg.content,
          msg.tags,
        );
        this._panel.title = this._block.topic;
      }
      this._onSaved();
      void vscode.window.showInformationMessage(`Saved: "${this._block.topic}"`);
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private _dispose(): void {
    BlockEditorPanel._panels.delete(this._block.id);
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }

  private _buildHtml(): string {
    const { topic, content, tags } = this._block;
    const isNew = this._block.id === "__new__";
    const tagsStr = tags.join(", ");

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<title>Memory Block</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
    padding: 24px 32px 40px;
    max-width: 860px;
  }
  h1 { font-size: 1.1rem; margin: 0 0 20px; }
  .field { margin-bottom: 16px; }
  label {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 5px;
  }
  input, textarea {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    padding: 6px 9px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    outline: none;
  }
  input:focus, textarea:focus { border-color: var(--vscode-focusBorder); }
  textarea {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    resize: vertical;
    min-height: 340px;
    line-height: 1.6;
  }
  .actions { display: flex; gap: 10px; margin-top: 20px; align-items: center; }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 5px 14px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    cursor: pointer;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  .hint { font-size: 12px; color: var(--vscode-descriptionForeground); }
</style>
</head>
<body>
<h1>${isNew ? "New Memory Block" : "Edit Memory Block"}</h1>
<div class="field">
  <label for="topic">topic</label>
  <input id="topic" type="text" value="${esc(topic)}" placeholder="e.g. Auth design decisions" autocomplete="off" />
</div>
<div class="field">
  <label for="tags">tags</label>
  <input id="tags" type="text" value="${esc(tagsStr)}" placeholder="comma-separated" autocomplete="off" />
</div>
<div class="field">
  <label for="content">content (markdown)</label>
  <textarea id="content">${esc(content)}</textarea>
</div>
<div class="actions">
  <button id="saveBtn">save</button>
  <span class="hint">or Ctrl+S</span>
</div>
<script>
const vscode = acquireVsCodeApi();
function save() {
  const topic = document.getElementById('topic').value.trim();
  if (!topic) { document.getElementById('topic').focus(); return; }
  const content = document.getElementById('content').value;
  const rawTags = document.getElementById('tags').value;
  const tags = rawTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
  vscode.postMessage({ type: 'save', topic, content, tags });
}
document.getElementById('saveBtn').addEventListener('click', save);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
});
${isNew ? "document.getElementById('topic').focus();" : "document.getElementById('content').focus();"}
</script>
</body>
</html>`;
  }
}
