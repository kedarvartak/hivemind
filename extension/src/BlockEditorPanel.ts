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

  /** Open or reveal an editor for the given block */
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
      `✏️ ${block.topic}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    new BlockEditorPanel(panel, block, store, onSaved);
  }

  /** Open a blank editor to create a new block */
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
      "✏️ New Block",
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
        const created = this._store.createBlock(
          msg.topic,
          msg.content,
          msg.tags,
        );
        BlockEditorPanel._panels.delete("__new__");
        this._block = created;
        BlockEditorPanel._panels.set(created.id, this);
        this._panel.title = `✏️ ${created.topic}`;
      } else {
        this._block = this._store.updateBlock(
          this._block.id,
          msg.topic,
          msg.content,
          msg.tags,
        );
        this._panel.title = `✏️ ${this._block.topic}`;
      }
      this._onSaved();
      void vscode.window
        .showInformationMessage(`Memory block saved: "${this._block.topic}"`)
        .then();
    } catch (err) {
      void vscode.window
        .showErrorMessage(
          `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
        )
        .then();
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

  // ---------------------------------------------------------------------------
  // HTML
  // ---------------------------------------------------------------------------

  private _buildHtml(): string {
    const { topic, content, tags } = this._block;
    const isNew = this._block.id === "__new__";
    const tagsStr = tags.join(", ");
    const escapedTopic = escapeHtml(topic);
    const escapedContent = escapeHtml(content);
    const escapedTags = escapeHtml(tagsStr);

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
/>
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

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 24px;
    color: var(--vscode-foreground);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge {
    font-size: 0.7rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
  }

  .field {
    margin-bottom: 20px;
  }

  label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 6px;
  }

  input, textarea {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
    padding: 8px 10px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    outline: none;
    transition: border-color 0.15s;
  }

  input:focus, textarea:focus {
    border-color: var(--vscode-focusBorder);
  }

  input.topic-input {
    font-size: 1.05rem;
    font-weight: 600;
  }

  textarea.content-input {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    resize: vertical;
    min-height: 360px;
    line-height: 1.6;
    tab-size: 2;
  }

  .hint {
    font-size: 0.75rem;
    color: var(--vscode-descriptionForeground);
    margin-top: 4px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 28px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 18px;
    border: none;
    border-radius: 4px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    cursor: pointer;
    transition: opacity 0.15s;
  }
  button:active { opacity: 0.8; }

  .btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .btn-primary:hover {
    background: var(--vscode-button-hoverBackground);
  }

  .save-hint {
    font-size: 0.75rem;
    color: var(--vscode-descriptionForeground);
  }

  .meta {
    font-size: 0.75rem;
    color: var(--vscode-descriptionForeground);
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .meta span strong { color: var(--vscode-foreground); }
</style>
</head>
<body>

<h1>
  ${isNew ? "New Memory Block" : "Edit Memory Block"}
  ${!isNew ? `<span class="badge">v${this._block.version}</span>` : ""}
</h1>

${!isNew ? `
<div class="meta">
  <span><strong>ID:</strong> ${escapeHtml(this._block.id)}</span>
  <span><strong>Created:</strong> ${new Date(this._block.createdAt).toLocaleString()}</span>
  <span><strong>Updated:</strong> ${new Date(this._block.updatedAt).toLocaleString()}</span>
</div>
` : ""}

<div class="field">
  <label for="topic">Topic</label>
  <input
    id="topic"
    class="topic-input"
    type="text"
    value="${escapedTopic}"
    placeholder="e.g. Auth design decisions"
    autocomplete="off"
  />
</div>

<div class="field">
  <label for="tags">Tags</label>
  <input
    id="tags"
    type="text"
    value="${escapedTags}"
    placeholder="auth, backend, decisions"
    autocomplete="off"
  />
  <div class="hint">Comma-separated. Used for search and retrieval.</div>
</div>

<div class="field">
  <label for="content">Content <span style="font-weight:400;text-transform:none">(Markdown)</span></label>
  <textarea id="content" class="content-input" placeholder="Write anything — decisions, context, summaries…">${escapedContent}</textarea>
</div>

<div class="actions">
  <button class="btn-primary" id="saveBtn">💾 Save</button>
  <span class="save-hint">or <kbd>Ctrl+S</kbd> / <kbd>⌘S</kbd></span>
</div>

<script>
  const vscode = acquireVsCodeApi();

  function save() {
    const topic = document.getElementById('topic').value.trim();
    const content = document.getElementById('content').value;
    const rawTags = document.getElementById('tags').value;
    const tags = rawTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (!topic) {
      document.getElementById('topic').focus();
      return;
    }

    vscode.postMessage({ type: 'save', topic, content, tags });
  }

  document.getElementById('saveBtn').addEventListener('click', save);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  });

  // Focus topic if new block
  ${isNew ? "document.getElementById('topic').focus();" : "document.getElementById('content').focus();"}
</script>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
