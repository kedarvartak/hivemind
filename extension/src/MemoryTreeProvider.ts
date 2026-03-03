import * as vscode from "vscode";
import type { MemoryBlock } from "./types";
import type { JsonStore } from "./store";

export class BlockTreeItem extends vscode.TreeItem {
  constructor(public readonly block: MemoryBlock) {
    super(block.topic, vscode.TreeItemCollapsibleState.None);

    this.contextValue = "block";
    this.description = block.tags.length
      ? block.tags.map((t) => `#${t}`).join(" ")
      : `v${block.version}`;
    this.tooltip = new vscode.MarkdownString(
      [
        `**${block.topic}**`,
        ``,
        block.content.length > 200
          ? block.content.slice(0, 200) + "..."
          : block.content || "_empty_",
        ``,
        `---`,
        `**ID:** \`${block.id}\``,
        `**Tags:** ${block.tags.length ? block.tags.join(", ") : "none"}`,
        `**Version:** ${block.version}`,
        `**Updated:** ${new Date(block.updatedAt).toLocaleString()}`,
      ].join("\n"),
    );
    this.iconPath = new vscode.ThemeIcon(
      "note",
      new vscode.ThemeColor("charts.blue"),
    );

    this.command = {
      command: "memoree.editBlock",
      title: "Edit Block",
      arguments: [this],
    };
  }
}

export class MemoryTreeProvider
  implements vscode.TreeDataProvider<BlockTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    BlockTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _filter = "";

  constructor(private readonly store: JsonStore) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setFilter(query: string): void {
    this._filter = query;
    this.refresh();
  }

  getTreeItem(element: BlockTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): BlockTreeItem[] {
    const blocks = this._filter
      ? this.store.searchBlocks(this._filter)
      : this.store.listBlocks();

    if (blocks.length === 0) return [];

    return [...blocks]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .map((b) => new BlockTreeItem(b));
  }
}
