import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";
import { JsonStore } from "./store";
import type { MemoryBlock } from "./types";

interface Group {
  id: string;
  name: string;
}

interface Rule {
  id: string;
  groupId: string;
  title: string;
  content: string;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "hivemind.sidebar";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _memoryStore: JsonStore,
    private readonly _globalState: vscode.Memento,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      try {
        await this._handleMessage(message);
      } catch (err) {
        vscode.window.showErrorMessage(`HiveMind Error: ${err}`);
      }
    });

    // Notify webview of file changes in memory blocks
    const fsWatcher = vscode.workspace.createFileSystemWatcher("**/*.json");
    fsWatcher.onDidChange(() => this._sendState());
    fsWatcher.onDidCreate(() => this._sendState());
    fsWatcher.onDidDelete(() => this._sendState());
  }

  public refresh() {
    this._sendState();
  }

  private async _handleMessage(message: any) {
    switch (message.type) {
      case "ready":
        this._sendState();
        break;

      // ---- Memory Blocks ----
      case "addBlock":
        this._memoryStore.createBlock(message.topic, message.content, message.tags);
        this._sendState();
        break;
      case "updateBlock":
        this._memoryStore.updateBlock(message.id, message.topic, message.content, message.tags);
        this._sendState();
        break;
      case "deleteBlock":
        this._memoryStore.deleteBlock(message.id);
        this._sendState();
        break;

      // ---- Rules / Groups ----
      case "addGroup": {
        const groups = this._getGroups();
        groups.push({ id: uuidv4(), name: message.name });
        await this._saveGroups(groups);
        this._sendState();
        break;
      }
      case "deleteGroup": {
        const groups = this._getGroups().filter((g) => g.id !== message.id);
        await this._saveGroups(groups);
        const rules = this._getRules().filter((r) => r.groupId !== message.id);
        await this._saveRules(rules);
        this._sendState();
        break;
      }
      case "addRule": {
        const rules = this._getRules();
        rules.push({
          id: uuidv4(),
          groupId: message.groupId,
          title: message.title,
          content: message.content,
        });
        await this._saveRules(rules);
        this._sendState();
        break;
      }
      case "updateRule": {
        const rules = this._getRules();
        const rule = rules.find((r) => r.id === message.id);
        if (rule) {
          rule.title = message.title;
          rule.content = message.content;
          await this._saveRules(rules);
        }
        this._sendState();
        break;
      }
      case "deleteRule": {
        const rules = this._getRules().filter((r) => r.id !== message.id);
        await this._saveRules(rules);
        this._sendState();
        break;
      }
    }
  }

  private _getGroups(): Group[] {
    return this._globalState.get<Group[]>("hivemind.groups") || [];
  }
  private async _saveGroups(groups: Group[]) {
    await this._globalState.update("hivemind.groups", groups);
  }

  private _getRules(): Rule[] {
    return this._globalState.get<Rule[]>("hivemind.rules") || [];
  }
  private async _saveRules(rules: Rule[]) {
    await this._globalState.update("hivemind.rules", rules);
  }

  private _sendState() {
    if (!this._view) return;
    const blocks = this._memoryStore.listBlocks();
    const groups = this._getGroups();
    const rules = this._getRules();
    void this._view.webview.postMessage({ type: "state", blocks, groups, rules });
  }

  private _getHtmlForWebview() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HiveMind</title>
<style>
  :root {
    --fg: var(--vscode-foreground);
    --bg: var(--vscode-sideBar-background);
    --border: var(--vscode-sideBarSectionHeader-border);
    --header-bg: var(--vscode-sideBarSectionHeader-background);
    
    --input-bg: var(--vscode-input-background);
    --input-fg: var(--vscode-input-foreground);
    --input-border: var(--vscode-input-border);
    --focus-border: var(--vscode-focusBorder);
    
    --btn-bg: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
    
    --list-hover: var(--vscode-list-hoverBackground);
    --list-active: var(--vscode-list-activeSelectionBackground);
    --list-active-fg: var(--vscode-list-activeSelectionForeground);
    --desc-fg: var(--vscode-descriptionForeground);
  }

  /* Reset default font weights - no bold fonts allowed */
  * {
    box-sizing: border-box;
    font-weight: normal !important; 
  }

  body {
    background-color: var(--bg);
    color: var(--fg);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
  }

  input, textarea {
    background-color: var(--input-bg);
    color: var(--input-fg);
    border: 1px solid var(--input-border);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    padding: 4px 6px;
    width: 100%;
    outline: none;
    margin-bottom: 6px;
  }
  input:focus, textarea:focus {
    border-color: var(--focus-border);
  }
  textarea {
    resize: vertical;
    min-height: 50px;
    font-family: var(--vscode-editor-font-family, monospace);
  }

  button {
    background-color: var(--btn-bg);
    color: var(--btn-fg);
    border: none;
    padding: 4px 10px;
    cursor: pointer;
    text-align: center;
    width: 100%;
  }
  button:hover {
    background-color: var(--btn-hover);
  }
  button.secondary {
    background-color: transparent;
    color: var(--fg);
    border: 1px solid var(--border);
  }
  button.secondary:hover {
    background-color: var(--list-hover);
  }

  .btn-icon {
    background: transparent;
    color: var(--desc-fg);
    border: none;
    width: auto;
    padding: 0 4px;
    font-size: 14px;
    display: none;
  }
  .btn-icon:hover {
    color: var(--fg);
    background: var(--list-hover);
  }

  /* Section styles */
  .section {
    border-bottom: 1px solid var(--border);
  }
  .section-header {
    background-color: var(--header-bg);
    padding: 4px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.2px;
  }
  .section-header:hover {
    background-color: var(--list-hover);
  }

  /* List items */
  .item {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid transparent;
  }
  .item-row {
    display: flex;
    align-items: center;
    padding: 4px 12px 4px 20px;
    cursor: pointer;
    min-height: 24px;
  }
  .item-row:hover {
    background-color: var(--list-hover);
  }
  .item-row:hover .btn-icon {
    display: inline-block;
  }
  .item.active .item-row {
    background-color: var(--list-active);
    color: var(--list-active-fg);
  }
  .item.active .btn-icon {
    color: var(--list-active-fg);
  }
  
  .item-title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Rule groups specific */
  .group-row {
    padding-left: 12px;
  }
  .rule-row {
    padding-left: 28px;
  }

  /* Inline Editors */
  .editor {
    display: none;
    padding: 10px 16px;
    background-color: var(--vscode-editor-background);
    border-bottom: 1px solid var(--border);
  }
  .item.active .editor {
    display: block;
  }
  .actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .preview {
    font-size: 12px;
    color: var(--desc-fg);
    margin-top: 2px;
    white-space: pre-wrap;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
  }
  .item.active .preview {
    display: none;
  }
  
  .add-btn {
    padding: 6px 16px;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
  }
  .add-btn:hover {
    background-color: var(--list-hover);
  }
  
  .empty {
    padding: 12px 16px;
    text-align: center;
    color: var(--desc-fg);
    font-size: 12px;
  }
  
  .chevron {
    display: inline-block;
    width: 14px;
    text-align: center;
    font-family: var(--vscode-editor-font-family, monospace);
  }
</style>
</head>
<body>

<div id="content">Loading...</div>

<script>
  const vscode = acquireVsCodeApi();
  
  let state = {
    blocks: [],
    groups: [],
    rules: [],
    
    // UI State
    sectionMemExpanded: true,
    sectionRulesExpanded: true,
    
    activeBlock: null,
    addingBlock: false,
    
    expandedGroup: null,
    activeRule: null,
    addingGroup: false,
    addingRuleToGroup: null
  };

  window.addEventListener('message', (e) => {
    if (e.data.type === 'state') {
      state.blocks = e.data.blocks;
      state.groups = e.data.groups;
      state.rules = e.data.rules;
      render();
    }
  });

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function post(msg) {
    vscode.postMessage(msg);
  }

  // --- Render ---
  function render() {
    let html = '';

    // --- MEMORY BLOCKS SECTION ---
    html += \`
      <div class="section-header" onclick="state.sectionMemExpanded = !state.sectionMemExpanded; render()">
        <span>\${state.sectionMemExpanded ? 'v' : '>'} Memory Blocks</span>
      </div>
    \`;

    if (state.sectionMemExpanded) {
      if (state.addingBlock) {
        html += \`
          <div class="editor" style="display:block">
            <input type="text" id="new-block-topic" placeholder="Topic">
            <input type="text" id="new-block-tags" placeholder="Tags (comma separated)">
            <textarea id="new-block-content" placeholder="Content"></textarea>
            <div class="actions">
              <button onclick="saveNewBlock()">Save</button>
              <button class="secondary" onclick="state.addingBlock = false; render()">Cancel</button>
            </div>
          </div>
        \`;
      }

      state.blocks.forEach(b => {
        const isActive = state.activeBlock === b.id;
        html += \`
          <div class="item \${isActive ? 'active' : ''}" id="block-\${b.id}">
            <div class="item-row" onclick="state.activeBlock = '\${b.id}'; render()">
              <div class="item-title">\${esc(b.topic)}</div>
              <button class="btn-icon" onclick="deleteBlock('\${b.id}', event)">x</button>
            </div>
            \${!isActive ? \`<div class="preview" style="padding: 0 12px 6px 20px;">\${esc(b.content)}</div>\` : ''}
            <div class="editor">
              <input type="text" id="edit-block-topic-\${b.id}" value="\${esc(b.topic)}">
              <input type="text" id="edit-block-tags-\${b.id}" value="\${esc(b.tags.join(','))}">
              <textarea id="edit-block-content-\${b.id}">\${esc(b.content)}</textarea>
              <div class="actions">
                <button onclick="updateBlock('\${b.id}')">Save</button>
                <button class="secondary" onclick="state.activeBlock = null; render()">Cancel</button>
              </div>
            </div>
          </div>
        \`;
      });

      if (state.blocks.length === 0 && !state.addingBlock) {
        html += \`<div class="empty">No memory blocks yet.</div>\`;
      }
      
      html += \`
        <div class="add-btn" onclick="state.addingBlock = true; state.activeBlock = null; render()">+ add memory block</div>
      \`;
    }

    // --- TEAM RULES SECTION ---
    html += \`
      <div class="section-header" style="margin-top: 8px" onclick="state.sectionRulesExpanded = !state.sectionRulesExpanded; render()">
        <span>\${state.sectionRulesExpanded ? 'v' : '>'} Team Rules</span>
      </div>
    \`;

    if (state.sectionRulesExpanded) {
      if (state.addingGroup) {
        html += \`
          <div class="editor" style="display:block">
            <input type="text" id="new-group-name" placeholder="Group Name">
            <div class="actions">
              <button onclick="saveNewGroup()">Add Group</button>
              <button class="secondary" onclick="state.addingGroup = false; render()">Cancel</button>
            </div>
          </div>
        \`;
      }

      state.groups.forEach(g => {
        const isGroupExpanded = state.expandedGroup === g.id;
        const groupRules = state.rules.filter(r => r.groupId === g.id);

        html += \`
          <div class="item">
            <div class="item-row group-row" onclick="state.expandedGroup = '\${g.id}'; render()">
              <span class="chevron">\${isGroupExpanded ? 'v' : '>'}</span>
              <div class="item-title">\${esc(g.name)}</div>
              <button class="btn-icon" onclick="state.addingRuleToGroup = '\${g.id}'; state.expandedGroup = '\${g.id}'; render(); event.stopPropagation()">+</button>
              <button class="btn-icon" onclick="deleteGroup('\${g.id}', event)">x</button>
            </div>
          </div>
        \`;

        if (isGroupExpanded) {
          if (state.addingRuleToGroup === g.id) {
            html += \`
              <div class="editor" style="display:block; padding-left: 28px;">
                <input type="text" id="new-rule-title" placeholder="Rule Title">
                <textarea id="new-rule-content" placeholder="Rule Content"></textarea>
                <div class="actions">
                  <button onclick="saveNewRule('\${g.id}')">Save</button>
                  <button class="secondary" onclick="state.addingRuleToGroup = null; render()">Cancel</button>
                </div>
              </div>
            \`;
          }

          groupRules.forEach(r => {
            const isRuleActive = state.activeRule === r.id;
            html += \`
              <div class="item \${isRuleActive ? 'active' : ''}" style="padding-left: 8px;">
                <div class="item-row rule-row" onclick="state.activeRule = '\${r.id}'; render()">
                  <div class="item-title">\${esc(r.title)}</div>
                  <button class="btn-icon" onclick="deleteRule('\${r.id}', event)">x</button>
                </div>
                \${!isRuleActive ? \`<div class="preview" style="padding: 0 12px 6px 28px;">\${esc(r.content)}</div>\` : ''}
                <div class="editor" style="padding-left: 28px;">
                  <input type="text" id="edit-rule-title-\${r.id}" value="\${esc(r.title)}">
                  <textarea id="edit-rule-content-\${r.id}">\${esc(r.content)}</textarea>
                  <div class="actions">
                    <button onclick="updateRule('\${r.id}')">Save</button>
                    <button class="secondary" onclick="state.activeRule = null; render()">Cancel</button>
                  </div>
                </div>
              </div>
            \`;
          });
          
          if (groupRules.length === 0 && state.addingRuleToGroup !== g.id) {
            html += \`<div class="empty" style="text-align:left; padding-left:28px">No rules in this group.</div>\`;
          }
        }
      });

      if (state.groups.length === 0 && !state.addingGroup) {
        html += \`<div class="empty">No rule groups yet.</div>\`;
      }
      
      html += \`
        <div class="add-btn" onclick="state.addingGroup = true; state.expandedGroup = null; render()">+ add group</div>
      \`;
    }

    document.getElementById('content').innerHTML = html;
  }

  // --- Handlers ---
  window.saveNewBlock = function() {
    const topic = document.getElementById('new-block-topic').value;
    const content = document.getElementById('new-block-content').value;
    const tags = document.getElementById('new-block-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
    if (!topic) return;
    post({ type: 'addBlock', topic, content, tags });
    state.addingBlock = false;
  };

  window.updateBlock = function(id) {
    const topic = document.getElementById('edit-block-topic-' + id).value;
    const content = document.getElementById('edit-block-content-' + id).value;
    const tags = document.getElementById('edit-block-tags-' + id).value.split(',').map(t=>t.trim()).filter(Boolean);
    if (!topic) return;
    post({ type: 'updateBlock', id, topic, content, tags });
    state.activeBlock = null;
  };

  window.deleteBlock = function(id, e) {
    e.stopPropagation();
    post({ type: 'deleteBlock', id });
  };

  window.saveNewGroup = function() {
    const name = document.getElementById('new-group-name').value;
    if (!name) return;
    post({ type: 'addGroup', name });
    state.addingGroup = false;
  };

  window.deleteGroup = function(id, e) {
    e.stopPropagation();
    post({ type: 'deleteGroup', id });
  };

  window.saveNewRule = function(groupId) {
    const title = document.getElementById('new-rule-title').value;
    const content = document.getElementById('new-rule-content').value;
    if (!title) return;
    post({ type: 'addRule', groupId, title, content });
    state.addingRuleToGroup = null;
  };

  window.updateRule = function(id) {
    const title = document.getElementById('edit-rule-title-' + id).value;
    const content = document.getElementById('edit-rule-content-' + id).value;
    if (!title) return;
    post({ type: 'updateRule', id, title, content });
    state.activeRule = null;
  };

  window.deleteRule = function(id, e) {
    e.stopPropagation();
    post({ type: 'deleteRule', id });
  };

  // Init
  post({ type: 'ready' });
</script>
</body>
</html>`;
  }
}
