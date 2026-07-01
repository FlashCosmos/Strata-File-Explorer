import * as vscode from "vscode";
import { StrataViewProvider } from "./StrataViewProvider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new StrataViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      StrataViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.commands.registerCommand("strata.refresh", () => provider.refresh()),
    vscode.commands.registerCommand("strata.collapseAll", () =>
      provider.collapseAll(),
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("strata")) {
        provider.onConfigChanged();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()),
  );

  // Refresh loaded directories when files change on disk (debounced).
  const watcher = vscode.workspace.createFileSystemWatcher("**/*");
  let timer: NodeJS.Timeout | undefined;
  const ping = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => provider.notifyFsChanged(), 300);
  };
  watcher.onDidCreate(ping);
  watcher.onDidDelete(ping);
  watcher.onDidChange(ping);
  context.subscriptions.push(watcher);
}

export function deactivate(): void {
  // nothing to clean up
}
