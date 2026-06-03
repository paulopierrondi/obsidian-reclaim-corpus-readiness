/* RECLAIM Corpus Readiness Obsidian Plugin */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ReclaimPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/scanner.ts
var SHINGLE_SIZE = 8;
var NUM_HASHES = 32;
var LSH_BANDS = 8;
var NEAR_DUP_THRESHOLD = 0.72;
function fnv1a32(s) {
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function buildHashCoeffs(count) {
  const coeffs = [];
  let state = 88172645463325250;
  for (let i = 0; i < count; i++) {
    state ^= state << 13;
    state ^= state >>> 7;
    state ^= state << 17;
    const a = state >>> 0 | 1;
    state ^= state << 13;
    state ^= state >>> 7;
    state ^= state << 17;
    const b = state >>> 0;
    coeffs.push([a, b]);
  }
  return coeffs;
}
function tokenize(normalized) {
  if (!normalized)
    return [];
  return normalized.split(/\s+/).filter((w) => w.length > 0);
}
function shingleSet(tokens, size) {
  const set = /* @__PURE__ */ new Set();
  if (tokens.length === 0)
    return set;
  if (tokens.length < size) {
    set.add(tokens.join(" "));
    return set;
  }
  for (let i = 0; i + size <= tokens.length; i++) {
    set.add(tokens.slice(i, i + size).join(" "));
  }
  return set;
}
function minhashSignature(shingles, coeffs) {
  const sig = new Array(coeffs.length).fill(4294967295);
  for (const shingle of shingles) {
    const base = fnv1a32(shingle);
    for (let i = 0; i < coeffs.length; i++) {
      const [a, b] = coeffs[i];
      const h = Math.imul(base, a) + b;
      const uh = h >>> 0;
      if (uh < sig[i])
        sig[i] = uh;
    }
  }
  return sig;
}
function estimateJaccard(a, b) {
  if (a.length === 0 || a.length !== b.length)
    return 0;
  let equal = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i])
      equal++;
  }
  return equal / a.length;
}
function findNearDuplicates(docs) {
  const withSigs = docs.filter((d) => d.signature !== null && !d.isEmpty);
  if (withSigs.length < 2)
    return [];
  const coeffs = buildHashCoeffs(NUM_HASHES);
  const signatures = [];
  for (const d of withSigs) {
    const tokens = tokenize(d.body.replace(/\s+/g, " ").trim().toLowerCase());
    const shingles = shingleSet(tokens, SHINGLE_SIZE);
    if (shingles.size === 0) {
      signatures.push([]);
    } else {
      signatures.push(minhashSignature(shingles, coeffs));
    }
  }
  const rows = Math.max(1, Math.floor(NUM_HASHES / LSH_BANDS));
  const buckets = /* @__PURE__ */ new Map();
  for (let di = 0; di < withSigs.length; di++) {
    const sig = signatures[di];
    if (sig.length === 0)
      continue;
    for (let band = 0; band < LSH_BANDS; band++) {
      const start = band * rows;
      if (start >= sig.length)
        break;
      const slice = sig.slice(start, Math.min(start + rows, sig.length)).join(",");
      const key = `${band}:${slice}`;
      const arr = buckets.get(key) || [];
      arr.push(di);
      buckets.set(key, arr);
    }
  }
  const candidatePairs = /* @__PURE__ */ new Set();
  for (const [, idxs] of buckets) {
    if (idxs.length < 2)
      continue;
    for (let i = 0; i < idxs.length; i++) {
      for (let j = i + 1; j < idxs.length; j++) {
        const a = Math.min(idxs[i], idxs[j]);
        const b = Math.max(idxs[i], idxs[j]);
        candidatePairs.add(`${a}|${b}`);
      }
    }
  }
  const near = [];
  for (const key of candidatePairs) {
    const [aiStr, biStr] = key.split("|");
    const ai = parseInt(aiStr, 10);
    const bi = parseInt(biStr, 10);
    const docA = withSigs[ai];
    const docB = withSigs[bi];
    if (!docA || !docB)
      continue;
    if (docA.hash === docB.hash)
      continue;
    const sigA = signatures[ai];
    const sigB = signatures[bi];
    if (sigA.length === 0 || sigB.length === 0)
      continue;
    const sim = estimateJaccard(sigA, sigB);
    if (sim >= NEAR_DUP_THRESHOLD) {
      near.push({ similarity: Math.round(sim * 100), a: docA.path, b: docB.path });
    }
  }
  return near.sort((a, b) => b.similarity - a.similarity);
}
function sha256Hex(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
function stripFrontmatter(content) {
  if (!content.startsWith("---"))
    return { body: content, hasFrontmatter: false };
  const end = content.indexOf("---", 3);
  if (end === -1)
    return { body: content, hasFrontmatter: false };
  return { body: content.slice(end + 3).trimStart(), hasFrontmatter: true };
}
function baseTitle(name) {
  return name.replace(/\.md$/i, "").replace(/\s+v\d+.*$/i, "").trim().toLowerCase();
}
function looksUntitled(name) {
  const base = baseTitle(name);
  const weak = ["untitled", "note", "new file", "document", "page", "draft"];
  return weak.some((w) => base === w || base.startsWith(w + " "));
}
function isStale(mtime) {
  return Date.now() - mtime > 365 * 24 * 60 * 60 * 1e3;
}
function exportMarkdownReport(result, vaultName) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push("# RECLAIM Corpus Readiness Audit");
  lines.push("");
  lines.push(`- **Vault:** ${vaultName}`);
  lines.push(`- **Generated:** ${now}`);
  lines.push(`- **Score:** ${result.score}/100`);
  lines.push(`- **Grade:** ${result.grade}`);
  lines.push("");
  lines.push("## Dimensions");
  lines.push("");
  lines.push("| Dimension | Status |");
  lines.push("|---|---|");
  lines.push(`| Documents | ${result.documents} |`);
  lines.push(`| Empty | ${result.emptyCount} |`);
  lines.push(`| Thin | ${result.thinCount} |`);
  lines.push(`| No frontmatter | ${result.noFrontmatterCount} |`);
  lines.push(`| Weak titles | ${result.weakTitleCount} |`);
  lines.push(`| Stale | ${result.staleCount} |`);
  lines.push(`| Exact duplicate groups | ${result.duplicateGroups.length} |`);
  lines.push(`| Near-duplicate pairs | ${result.nearDuplicates.length} |`);
  lines.push(`| Basename conflicts | ${result.conflictCount} |`);
  lines.push("");
  if (result.duplicateGroups.length > 0) {
    lines.push("## Exact Duplicates");
    lines.push("");
    for (const g of result.duplicateGroups) {
      lines.push(`- **${g.count} files:** ${g.files.join(", ")}`);
    }
    lines.push("");
  }
  if (result.nearDuplicates.length > 0) {
    lines.push("## Near Duplicates");
    lines.push("");
    for (const nd of result.nearDuplicates.slice(0, 50)) {
      lines.push(`- **${nd.similarity}%** \xB7 \`${nd.a}\` \u2194 \`${nd.b}\``);
    }
    if (result.nearDuplicates.length > 50) {
      lines.push(`- *\u2026 and ${result.nearDuplicates.length - 50} more*`);
    }
    lines.push("");
  }
  if (result.conflictCount > 0) {
    lines.push("## Basename Conflicts");
    lines.push(`\`${result.conflictCount}\` titles appear with different content.`);
    lines.push("");
  }
  lines.push("---");
  lines.push("*Generated by RECLAIM Corpus Readiness plugin*");
  return lines.join("\n");
}
async function scanVault(vault) {
  var _a;
  const files = vault.getMarkdownFiles();
  const docs = [];
  for (const file of files) {
    const content = await vault.read(file);
    const { body, hasFrontmatter } = stripFrontmatter(content);
    const normalized = body.replace(/\s+/g, " ").trim().toLowerCase();
    const bytes = new Blob([content]).size;
    const stat = await vault.adapter.stat(file.path);
    const mtime = (_a = stat == null ? void 0 : stat.mtime) != null ? _a : Date.now();
    const tokens = tokenize(normalized);
    const shingles = shingleSet(tokens, SHINGLE_SIZE);
    const signature = shingles.size > 0 ? minhashSignature(shingles, buildHashCoeffs(NUM_HASHES)) : null;
    docs.push({
      path: file.path,
      name: file.name,
      base: baseTitle(file.name),
      content,
      body,
      hasFrontmatter,
      bytes,
      isEmpty: normalized.length === 0,
      isThin: normalized.length > 0 && normalized.length < 200,
      isStale: isStale(mtime),
      weakTitle: looksUntitled(file.name),
      hash: sha256Hex(normalized),
      signature
    });
  }
  const hashMap = /* @__PURE__ */ new Map();
  for (const d of docs) {
    if (d.isEmpty)
      continue;
    hashMap.set(d.hash, [...hashMap.get(d.hash) || [], d.path]);
  }
  const duplicateGroups = [];
  for (const [, paths] of hashMap) {
    if (paths.length > 1) {
      duplicateGroups.push({ count: paths.length, files: paths });
    }
  }
  duplicateGroups.sort((a, b) => b.count - a.count);
  const baseMap = /* @__PURE__ */ new Map();
  for (const d of docs) {
    baseMap.set(d.base, [...baseMap.get(d.base) || [], d.hash]);
  }
  let conflictCount = 0;
  for (const [, hashes] of baseMap) {
    const unique = new Set(hashes);
    if (unique.size > 1)
      conflictCount++;
  }
  const nearDuplicates = findNearDuplicates(docs);
  const emptyCount = docs.filter((d) => d.isEmpty).length;
  const thinCount = docs.filter((d) => d.isThin).length;
  const noFrontmatterCount = docs.filter((d) => !d.hasFrontmatter).length;
  const staleCount = docs.filter((d) => d.isStale).length;
  const weakTitleCount = docs.filter((d) => d.weakTitle).length;
  const total = Math.max(1, docs.length);
  const exactDupFiles = duplicateGroups.reduce((sum, g) => sum + g.count, 0);
  const exactDupRedundant = exactDupFiles - duplicateGroups.length;
  const uniqueness = Math.max(0, 100 - exactDupRedundant / total * 100 - nearDuplicates.length / Math.max(1, total * 0.5) * 20);
  const structure = Math.max(0, 100 - noFrontmatterCount / total * 40);
  const density = Math.max(0, 100 - thinCount / total * 60 - emptyCount / total * 80);
  const titleQuality = Math.max(0, 100 - weakTitleCount / total * 40);
  const freshness = Math.max(0, 100 - staleCount / total * 30);
  const score = Math.round(uniqueness * 0.3 + structure * 0.25 + density * 0.2 + titleQuality * 0.15 + freshness * 0.1);
  let grade = "F";
  if (score >= 90)
    grade = "A";
  else if (score >= 80)
    grade = "B";
  else if (score >= 65)
    grade = "C";
  else if (score >= 50)
    grade = "D";
  return {
    documents: docs.length,
    emptyCount,
    thinCount,
    noFrontmatterCount,
    duplicateGroups,
    nearDuplicates,
    conflictCount,
    staleCount,
    weakTitleCount,
    score,
    grade
  };
}

// src/main.ts
var VIEW_TYPE = "reclaim-readiness-view";
var DEFAULT_SETTINGS = {
  autoScanOnOpen: true,
  showStatusBar: true
};
var ReclaimPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.statusBarItem = null;
    this.lastResult = null;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE, (leaf) => new ReclaimReadinessView(leaf, this));
    this.addRibbonIcon("shield-check", "RECLAIM: Scan vault readiness", async () => {
      await this.runScan();
    });
    this.addCommand({
      id: "scan-vault-readiness",
      name: "Scan vault readiness",
      callback: async () => await this.runScan()
    });
    this.addCommand({
      id: "open-readiness-panel",
      name: "Open readiness panel",
      callback: async () => await this.openReadinessView()
    });
    this.addCommand({
      id: "export-readiness-report",
      name: "Export readiness report (Markdown)",
      callback: async () => await this.exportReport()
    });
    if (this.settings.showStatusBar) {
      this.statusBarItem = this.addStatusBarItem();
      this.statusBarItem.setText("RECLAIM \u2014");
      this.statusBarItem.addClass("reclaim-status-bar");
    }
    if (this.settings.autoScanOnOpen) {
      this.app.workspace.onLayoutReady(async () => {
        await this.runScan();
      });
    }
    this.addSettingTab(new ReclaimSettingTab(this.app, this));
    let debounceTimer;
    this.registerEvent(
      this.app.vault.on("modify", () => {
        window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => this.runScan(), 5e3);
      })
    );
    this.registerEvent(
      this.app.vault.on("create", () => {
        window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => this.runScan(), 5e3);
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", () => {
        window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => this.runScan(), 5e3);
      })
    );
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async runScan() {
    new import_obsidian.Notice("RECLAIM: Scanning vault\u2026", 2e3);
    const result = await scanVault(this.app.vault);
    this.lastResult = result;
    this.updateStatusBar(result);
    new import_obsidian.Notice(`RECLAIM: Score ${result.score}/100 \xB7 Grade ${result.grade}`, 4e3);
    this.updateReadinessView();
  }
  updateStatusBar(result) {
    if (!this.statusBarItem)
      return;
    const color = result.score >= 80 ? "var(--text-success)" : result.score >= 65 ? "var(--text-warning)" : "var(--text-error)";
    this.statusBarItem.setText(`RECLAIM ${result.score} \xB7 ${result.grade}`);
    this.statusBarItem.style.color = color;
  }
  async openReadinessView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf)
        return;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  updateReadinessView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      view.update(this.lastResult);
    }
  }
  async exportReport() {
    if (!this.lastResult) {
      new import_obsidian.Notice("RECLAIM: Run a scan first before exporting.", 3e3);
      return;
    }
    const vaultName = this.app.vault.getName();
    const markdown = exportMarkdownReport(this.lastResult, vaultName);
    const fileName = `RECLAIM-Audit-${new Date().toISOString().slice(0, 10)}.md`;
    await this.app.vault.create(fileName, markdown);
    new import_obsidian.Notice(`RECLAIM: Report exported to ${fileName}`, 4e3);
  }
};
var ReclaimReadinessView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.result = null;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "RECLAIM Readiness";
  }
  update(result) {
    this.result = result;
    this.render();
  }
  render() {
    const container = this.contentEl;
    container.empty();
    container.addClass("reclaim-panel");
    if (!this.result) {
      container.createEl("p", { text: "Run a scan to see readiness details." });
      return;
    }
    const r = this.result;
    const header = container.createDiv("reclaim-score-header");
    header.createEl("h2", { text: `${r.score}/100` });
    header.createEl("span", { text: `Grade ${r.grade}`, cls: "reclaim-grade" });
    const grid = container.createDiv("reclaim-stats-grid");
    const stats = [
      { label: "Documents", value: r.documents },
      { label: "No frontmatter", value: r.noFrontmatterCount },
      { label: "Thin", value: r.thinCount },
      { label: "Empty", value: r.emptyCount },
      { label: "Stale", value: r.staleCount },
      { label: "Weak titles", value: r.weakTitleCount },
      { label: "Dup groups", value: r.duplicateGroups.length },
      { label: "Near-dups", value: r.nearDuplicates.length },
      { label: "Conflicts", value: r.conflictCount }
    ];
    for (const s of stats) {
      const cell = grid.createDiv("reclaim-stat-cell");
      cell.createEl("span", { text: String(s.value), cls: "reclaim-stat-value" });
      cell.createEl("span", { text: s.label, cls: "reclaim-stat-label" });
    }
    if (r.duplicateGroups.length > 0) {
      container.createEl("h3", { text: "Exact duplicates" });
      const list = container.createEl("ul");
      for (const g of r.duplicateGroups.slice(0, 10)) {
        const li = list.createEl("li");
        li.createEl("span", { text: `${g.count} files: `, cls: "reclaim-dup-count" });
        li.createEl("span", { text: g.files.slice(0, 3).join(", ") });
        if (g.files.length > 3)
          li.createEl("span", { text: ` +${g.files.length - 3} more` });
      }
    }
    if (r.nearDuplicates.length > 0) {
      container.createEl("h3", { text: `Near duplicates (${r.nearDuplicates.length})` });
      const list = container.createEl("ul");
      for (const nd of r.nearDuplicates.slice(0, 15)) {
        const li = list.createEl("li");
        li.createEl("span", { text: `${nd.similarity}% \xB7 `, cls: "reclaim-dup-count" });
        li.createEl("span", { text: `${nd.a} \u2194 ${nd.b}` });
      }
      if (r.nearDuplicates.length > 15) {
        list.createEl("li", { text: `\u2026 and ${r.nearDuplicates.length - 15} more` });
      }
    }
  }
};
var ReclaimSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Auto-scan on open").setDesc("Automatically scan vault when Obsidian opens.").addToggle((t) => t.setValue(this.plugin.settings.autoScanOnOpen).onChange(async (v) => {
      this.plugin.settings.autoScanOnOpen = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Show status bar").setDesc("Display readiness score in the status bar.").addToggle((t) => t.setValue(this.plugin.settings.showStatusBar).onChange(async (v) => {
      this.plugin.settings.showStatusBar = v;
      await this.plugin.saveSettings();
    }));
  }
};
