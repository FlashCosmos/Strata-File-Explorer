// @ts-check
(function () {
  "use strict";

  const vscodeApi = acquireVsCodeApi();

  const headerEl = document.getElementById("header");
  const rowsEl = document.getElementById("rows");
  const emptyEl = document.getElementById("empty");

  /** @type {Map<string, any>} */
  const nodes = new Map();
  /** @type {string[]} */
  let rootIds = [];
  /** @type {string[]} */
  let visibleOrder = [];
  let selectedId = null;
  let iconsBase = "";

  let config = {
    computeFolderSizes: true,
    foldersFirst: true,
    excludeHidden: false,
    sizeUnits: "binary",
  };

  const sort = { key: "name", dir: 1 };

  const monthDayFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  const monthDayYearFmt = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const fullFmt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // --- Formatting ---------------------------------------------------------

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => {
      switch (c) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        default: return "&#39;";
      }
    });
  }

  function formatSize(bytes) {
    if (bytes == null || bytes < 0) {
      return "";
    }
    const base = config.sizeUnits === "decimal" ? 1000 : 1024;
    if (bytes < base) {
      return bytes + " B";
    }
    const units = ["KB", "MB", "GB", "TB", "PB"];
    let v = bytes / base;
    let i = 0;
    while (v >= base && i < units.length - 1) {
      v /= base;
      i++;
    }
    const val = v >= 100 ? Math.round(v).toString() : v.toFixed(1);
    return val + " " + units[i];
  }

  function formatDate(ms) {
    if (!ms) {
      return "";
    }
    const now = Date.now();
    const diff = now - ms;
    if (diff >= 0) {
      if (diff < 60000) {
        return "now";
      }
      if (diff < 3600000) {
        return Math.floor(diff / 60000) + "m";
      }
      if (diff < 86400000) {
        return Math.floor(diff / 3600000) + "h";
      }
      if (diff < 604800000) {
        return Math.floor(diff / 86400000) + "d";
      }
    }
    const d = new Date(ms);
    return d.getFullYear() === new Date(now).getFullYear()
      ? monthDayFmt.format(d)
      : monthDayYearFmt.format(d);
  }

  // --- Node helpers -------------------------------------------------------

  function mkNode(entry, depth, parentId) {
    return {
      id: entry.id,
      name: entry.name,
      isDir: entry.isDir,
      size: entry.size,
      mtime: entry.mtime,
      icon: entry.icon,
      iconOpen: entry.iconOpen,
      depth,
      parentId,
      expanded: false,
      loaded: false,
      loading: false,
      childrenIds: null,
    };
  }

  function pruneNode(id) {
    const n = nodes.get(id);
    if (!n) {
      return;
    }
    if (n.childrenIds) {
      for (const c of n.childrenIds) {
        pruneNode(c);
      }
    }
    nodes.delete(id);
  }

  function sortIds(ids) {
    const arr = ids.slice();
    const key = sort.key;
    const dir = sort.dir;
    arr.sort((a, b) => {
      const na = nodes.get(a);
      const nb = nodes.get(b);
      if (config.foldersFirst && na.isDir !== nb.isDir) {
        return na.isDir ? -1 : 1;
      }
      let r = 0;
      if (key === "size") {
        const sa = na.size == null ? -1 : na.size;
        const sb = nb.size == null ? -1 : nb.size;
        r = sa - sb;
      } else if (key === "mtime") {
        r = na.mtime - nb.mtime;
      }
      if (r === 0) {
        r = na.name.localeCompare(nb.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return key === "name" ? r * dir : r;
      }
      return r * dir;
    });
    return arr;
  }

  // --- Rendering ----------------------------------------------------------

  function rowHtml(n) {
    let indent = "";
    for (let i = 0; i < n.depth; i++) {
      indent += '<span class="indent"></span>';
    }
    const sel = n.id === selectedId ? " selected" : "";
    const exp = n.isDir && n.expanded ? " expanded" : "";
    const twisty = n.isDir ? "twisty codicon codicon-chevron-right" : "twisty";
    const iconFile = n.isDir ? (n.expanded ? n.iconOpen : n.icon) : n.icon;
    let iconHtml;
    if (iconsBase && iconFile) {
      iconHtml =
        '<img class="ficon" src="' + iconsBase + "/" + iconFile + '" alt="" />';
    } else {
      const cic = n.isDir
        ? n.expanded
          ? "codicon-folder-opened"
          : "codicon-folder"
        : "codicon-file";
      iconHtml = '<span class="ficon codicon ' + cic + '"></span>';
    }
    const sizeText = n.isDir
      ? n.size == null
        ? ""
        : formatSize(n.size)
      : formatSize(n.size);
    const pending =
      n.isDir && n.size == null && config.computeFolderSizes ? " pending" : "";
    const dtitle = n.mtime ? fullFmt.format(new Date(n.mtime)) : "";
    return (
      `<div class="row${exp}${sel}" role="treeitem" data-id="${escapeHtml(n.id)}" data-dir="${n.isDir}">` +
      `<div class="cell name">${indent}<span class="${twisty}"></span>` +
      iconHtml +
      `<span class="label">${escapeHtml(n.name)}</span></div>` +
      `<div class="cell size${pending}">${sizeText}</div>` +
      `<div class="cell date" title="${escapeHtml(dtitle)}">${formatDate(n.mtime)}</div>` +
      `</div>`
    );
  }

  function render() {
    const order = [];
    let html = "";
    const walk = (ids) => {
      for (const id of sortIds(ids)) {
        const n = nodes.get(id);
        order.push(id);
        html += rowHtml(n);
        if (n.isDir && n.expanded && n.childrenIds) {
          walk(n.childrenIds);
        }
      }
    };
    walk(rootIds);
    rowsEl.innerHTML = html;
    visibleOrder = order;
    updateSortIndicators();
  }

  function updateSortIndicators() {
    const cells = headerEl.querySelectorAll(".cell[data-sort]");
    cells.forEach((cell) => {
      const ind = cell.querySelector(".sort-ind");
      const active = cell.getAttribute("data-sort") === sort.key;
      ind.className =
        "sort-ind codicon" +
        (active
          ? sort.dir === 1
            ? " codicon-chevron-up"
            : " codicon-chevron-down"
          : "");
    });
  }

  function updateSizeCell(id) {
    const n = nodes.get(id);
    if (!n) {
      return;
    }
    const row = rowsEl.querySelector('.row[data-id="' + CSS.escape(id) + '"]');
    if (!row) {
      return;
    }
    const cell = row.querySelector(".cell.size");
    cell.textContent = formatSize(n.size);
    cell.classList.remove("pending");
  }

  function select(id) {
    if (id === selectedId) {
      return;
    }
    if (selectedId) {
      const prev = rowsEl.querySelector(
        '.row[data-id="' + CSS.escape(selectedId) + '"]',
      );
      if (prev) {
        prev.classList.remove("selected");
      }
    }
    selectedId = id;
    const cur = rowsEl.querySelector('.row[data-id="' + CSS.escape(id) + '"]');
    if (cur) {
      cur.classList.add("selected");
      cur.scrollIntoView({ block: "nearest" });
    }
  }

  // --- Actions ------------------------------------------------------------

  function requestList(id) {
    const n = nodes.get(id);
    if (!n || n.loading) {
      return;
    }
    n.loading = true;
    vscodeApi.postMessage({ type: "list", id });
  }

  function toggleExpand(id) {
    const n = nodes.get(id);
    if (!n || !n.isDir) {
      return;
    }
    n.expanded = !n.expanded;
    if (n.expanded && !n.loaded && !n.loading) {
      requestList(id);
    }
    render();
  }

  function openFile(id) {
    vscodeApi.postMessage({ type: "open", id });
  }

  // --- Incoming messages --------------------------------------------------

  function onRoots(roots) {
    nodes.clear();
    rootIds = [];
    selectedId = null;
    for (const r of roots) {
      nodes.set(r.id, mkNode(r, 0, null));
      rootIds.push(r.id);
    }
    showTree();
    render();
    if (rootIds.length === 1) {
      toggleExpand(rootIds[0]);
    }
  }

  function onChildren(id, entries) {
    const parent = nodes.get(id);
    if (!parent) {
      return;
    }
    parent.loading = false;
    parent.loaded = true;
    const newIds = [];
    const keep = new Set();
    for (const e of entries) {
      keep.add(e.id);
      newIds.push(e.id);
      const existing = nodes.get(e.id);
      if (existing) {
        existing.name = e.name;
        existing.isDir = e.isDir;
        existing.mtime = e.mtime;
        existing.icon = e.icon;
        existing.iconOpen = e.iconOpen;
        existing.depth = parent.depth + 1;
        existing.parentId = id;
        // keep a previously computed folder size if the fresh listing has none
        if (!(existing.isDir && e.size == null && existing.size != null)) {
          existing.size = e.size;
        }
      } else {
        nodes.set(e.id, mkNode(e, parent.depth + 1, id));
      }
    }
    if (parent.childrenIds) {
      for (const oldId of parent.childrenIds) {
        if (!keep.has(oldId)) {
          pruneNode(oldId);
        }
      }
    }
    parent.childrenIds = newIds;
    render();
  }

  function onFsChanged() {
    const toReload = [];
    for (const [id, n] of nodes) {
      if (n.isDir && n.expanded && n.loaded) {
        toReload.push(id);
      }
    }
    for (const id of toReload) {
      const n = nodes.get(id);
      if (n) {
        n.loading = false;
      }
      requestList(id);
    }
  }

  function onCollapseAll() {
    for (const n of nodes.values()) {
      n.expanded = false;
    }
    render();
  }

  function showTree() {
    headerEl.hidden = false;
    rowsEl.hidden = false;
    emptyEl.hidden = true;
  }

  function onNoWorkspace() {
    nodes.clear();
    rootIds = [];
    selectedId = null;
    rowsEl.innerHTML = "";
    headerEl.hidden = true;
    rowsEl.hidden = true;
    emptyEl.hidden = false;
  }

  window.addEventListener("message", (event) => {
    const m = event.data;
    switch (m.type) {
      case "config":
        config = m.config;
        if (config.iconsBase) {
          iconsBase = config.iconsBase;
        }
        render();
        break;
      case "roots":
        onRoots(m.roots);
        break;
      case "children":
        onChildren(m.id, m.entries);
        break;
      case "folderSize": {
        const n = nodes.get(m.id);
        if (n) {
          n.size = m.size;
          updateSizeCell(m.id);
        }
        break;
      }
      case "fsChanged":
        onFsChanged();
        break;
      case "collapseAll":
        onCollapseAll();
        break;
      case "noWorkspace":
        onNoWorkspace();
        break;
      case "error":
        console.error("Strata:", m.message);
        break;
    }
  });

  // --- Input handling -----------------------------------------------------

  rowsEl.addEventListener("click", (e) => {
    const row = e.target.closest(".row");
    if (!row) {
      return;
    }
    const id = row.dataset.id;
    select(id);
    if (row.dataset.dir === "true") {
      toggleExpand(id);
    } else {
      openFile(id);
    }
  });

  headerEl.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell[data-sort]");
    if (!cell) {
      return;
    }
    const key = cell.getAttribute("data-sort");
    if (sort.key === key) {
      sort.dir = -sort.dir;
    } else {
      sort.key = key;
      sort.dir = key === "name" ? 1 : -1;
    }
    render();
  });

  rowsEl.addEventListener("keydown", (e) => {
    if (!visibleOrder.length) {
      return;
    }
    let idx = selectedId ? visibleOrder.indexOf(selectedId) : -1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        idx = Math.min(visibleOrder.length - 1, idx + 1);
        select(visibleOrder[Math.max(0, idx)]);
        break;
      case "ArrowUp":
        e.preventDefault();
        idx = idx <= 0 ? 0 : idx - 1;
        select(visibleOrder[idx]);
        break;
      case "ArrowRight": {
        e.preventDefault();
        if (!selectedId) {
          break;
        }
        const n = nodes.get(selectedId);
        if (n && n.isDir) {
          if (!n.expanded) {
            toggleExpand(selectedId);
          } else if (n.childrenIds && n.childrenIds.length) {
            select(sortIds(n.childrenIds)[0]);
          }
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (!selectedId) {
          break;
        }
        const n = nodes.get(selectedId);
        if (n && n.isDir && n.expanded) {
          toggleExpand(selectedId);
        } else if (n && n.parentId) {
          select(n.parentId);
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (!selectedId) {
          break;
        }
        const n = nodes.get(selectedId);
        if (!n) {
          break;
        }
        if (n.isDir) {
          toggleExpand(selectedId);
        } else {
          openFile(selectedId);
        }
        break;
      }
    }
  });

  // --- Boot ---------------------------------------------------------------

  vscodeApi.postMessage({ type: "ready" });
})();
