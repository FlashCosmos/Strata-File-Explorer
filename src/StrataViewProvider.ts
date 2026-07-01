import * as vscode from "vscode";
import * as path from "path";
import { Entry, listDirectory, directorySize } from "./fsUtils";
import { IconTheme } from "./iconTheme";
import { getNonce } from "./util";

interface StrataConfig {
  computeFolderSizes: boolean;
  foldersFirst: boolean;
  excludeHidden: boolean;
  sizeUnits: "binary" | "decimal";
}

export class StrataViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "strata.explorer";
  private static readonly SIZE_CONCURRENCY = 4;

  private view?: vscode.WebviewView;

  /** Bumped whenever the tree resets, so stale folder-size work is discarded. */
  private generation = 0;

  private sizeQueue: Array<() => Promise<void>> = [];
  private activeSizeTasks = 0;

  /** URI strings of the workspace-folder roots (never auto-sized). */
  private rootIds = new Set<string>();

  private readonly theme: IconTheme;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.theme = new IconTheme(
      path.join(extensionUri.fsPath, "media", "material-icons.json"),
    );
  }

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    };
    view.webview.html = this.getHtml(view.webview);
    view.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
  }

  // --- Commands / external triggers ---------------------------------------

  public refresh(): void {
    this.generation++;
    this.sizeQueue = [];
    this.postConfig();
    this.sendRoots();
  }

  public collapseAll(): void {
    this.post({ type: "collapseAll" });
  }

  public onConfigChanged(): void {
    // Hidden filter / size toggle / units can all change output — reset cleanly.
    this.refresh();
  }

  public notifyFsChanged(): void {
    this.post({ type: "fsChanged" });
  }

  // --- Messaging ----------------------------------------------------------

  private post(msg: unknown): void {
    this.view?.webview.postMessage(msg);
  }

  private config(): StrataConfig {
    const c = vscode.workspace.getConfiguration("strata");
    return {
      computeFolderSizes: c.get<boolean>("computeFolderSizes", true),
      foldersFirst: c.get<boolean>("foldersFirst", true),
      excludeHidden: c.get<boolean>("excludeHidden", false),
      sizeUnits: c.get<"binary" | "decimal">("sizeUnits", "binary"),
    };
  }

  private iconsBaseUri(): string {
    if (!this.view) {
      return "";
    }
    return this.view.webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "icons"))
      .toString();
  }

  private postConfig(): void {
    this.post({
      type: "config",
      config: { ...this.config(), iconsBase: this.iconsBaseUri() },
    });
  }

  /** Attaches icon-theme SVG filenames to entries in place. */
  private decorate(entries: Entry[]): void {
    for (const e of entries) {
      if (e.isDir) {
        e.icon = this.theme.folderIcon(e.name, false);
        e.iconOpen = this.theme.folderIcon(e.name, true);
      } else {
        e.icon = this.theme.fileIcon(e.name);
      }
    }
  }

  private async onMessage(msg: any): Promise<void> {
    switch (msg?.type) {
      case "ready":
        this.postConfig();
        this.sendRoots();
        break;
      case "list":
        await this.sendChildren(String(msg.id));
        break;
      case "sizeRequest":
        // Hover-triggered size peek for a collapsed folder.
        if (!this.rootIds.has(String(msg.id))) {
          this.enqueueSize(String(msg.id), this.generation);
        }
        break;
      case "open":
        try {
          await vscode.window.showTextDocument(vscode.Uri.parse(String(msg.id)), {
            preview: true,
          });
        } catch (e) {
          vscode.window.showErrorMessage(
            `Strata: could not open file. ${e instanceof Error ? e.message : ""}`,
          );
        }
        break;
    }
  }

  private sendRoots(): void {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.rootIds.clear();
      this.post({ type: "noWorkspace" });
      return;
    }
    this.rootIds = new Set(folders.map((f) => f.uri.toString()));
    const roots: Entry[] = folders.map((f) => ({
      id: f.uri.toString(),
      name: f.name,
      isDir: true,
      size: null,
      mtime: 0,
      icon: this.theme.folderIcon(f.name, false),
      iconOpen: this.theme.folderIcon(f.name, true),
    }));
    this.post({ type: "roots", roots });
  }

  private async sendChildren(id: string): Promise<void> {
    const gen = this.generation;
    const uri = vscode.Uri.parse(id);
    const cfg = this.config();
    let entries: Entry[];
    try {
      entries = await listDirectory(
        uri.fsPath,
        (name) => vscode.Uri.joinPath(uri, name).toString(),
        cfg.excludeHidden,
      );
    } catch (e) {
      this.post({
        type: "error",
        id,
        message: e instanceof Error ? e.message : String(e),
      });
      return;
    }
    if (gen !== this.generation) {
      return;
    }
    this.decorate(entries);
    this.post({ type: "children", id, entries });

    // Lazy sizing: compute a folder's own recursive size when it is expanded
    // (i.e. listed). Never size workspace roots — that would walk everything.
    if (cfg.computeFolderSizes && !this.rootIds.has(id)) {
      this.enqueueSize(id, gen);
    }
  }

  // --- Background folder-size computation ----------------------------------

  private enqueueSize(id: string, gen: number): void {
    this.sizeQueue.push(async () => {
      if (gen !== this.generation) {
        return;
      }
      const uri = vscode.Uri.parse(id);
      const size = await directorySize(uri.fsPath, () => gen !== this.generation);
      if (gen !== this.generation) {
        return;
      }
      this.post({ type: "folderSize", id, size });
    });
    this.pumpSizeQueue();
  }

  private pumpSizeQueue(): void {
    while (
      this.activeSizeTasks < StrataViewProvider.SIZE_CONCURRENCY &&
      this.sizeQueue.length > 0
    ) {
      const task = this.sizeQueue.shift()!;
      this.activeSizeTasks++;
      void task().finally(() => {
        this.activeSizeTasks--;
        this.pumpSizeQueue();
      });
    }
  }

  // --- HTML ----------------------------------------------------------------

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const asset = (f: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", f));
    const styleUri = asset("main.css");
    const codiconUri = asset("codicon.css");
    const scriptUri = asset("main.js");

    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${codiconUri}" rel="stylesheet" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Strata</title>
</head>
<body>
  <div id="header" class="header">
    <div class="cell name" data-sort="name">Name<span class="sort-ind codicon"></span></div>
    <div class="cell size" data-sort="size"><span class="resizer" data-col="size"></span>Size<span class="sort-ind codicon"></span></div>
    <div class="cell date" data-sort="mtime"><span class="resizer" data-col="date"></span>Modified<span class="sort-ind codicon"></span></div>
  </div>
  <div id="rows" role="tree" tabindex="0"></div>
  <div id="empty" class="empty" hidden>Open a folder to see file details.</div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
