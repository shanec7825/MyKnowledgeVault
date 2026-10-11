const { Plugin, FileView, Notice } = require('obsidian');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const VIEW = 'vault-html-webviewer-redirect';
const MIME = { '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.pdf': 'application/pdf' };

class HtmlRedirect extends FileView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW; }
  getDisplayText() { return this.file?.basename || 'HTML 网页'; }
  async onLoadFile(file) {
    this.contentEl.setText('正在用网页查看器打开…');
    // Finish FileView loading before replacing this view on the same leaf.
    const timer = setTimeout(() => {
      if (this.leaf.view === this && this.file === file) {
        this.plugin.openHtml(file, this.leaf).catch(error => {
          console.error('Vault HTML Web Viewer:', error);
          new Notice('HTML 打开失败：' + error.message);
        });
      }
    }, 0);
    this.register(() => clearTimeout(timer));
  }
}

module.exports = class VaultHtmlWebViewer extends Plugin {
  async onload() {
    if (!this.app.internalPlugins.getPluginById('webviewer')?.enabled) {
      new Notice('请先启用核心插件“网页查看器 / Web viewer”。');
      return;
    }
    this.root = await fs.realpath(this.app.vault.adapter.getBasePath());
    const saved = await this.loadData() || {};
    this.token = /^[a-f0-9]{48}$/.test(saved.token || '') ? saved.token : randomBytes(24).toString('hex');
    this.server = http.createServer((req, res) => {
      this.serve(req, res).catch(error => {
        console.error('Vault HTML Web Viewer request:', error);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });
    this.register(() => { this.server.close(); this.server.closeAllConnections?.(); });
    const listen = port => new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, '127.0.0.1', () => { this.server.removeListener('error', reject); resolve(); });
    });
    try { await listen(saved.port || 27189); }
    catch (error) { if (error.code !== 'EADDRINUSE') throw error; await listen(0); }
    this.port = this.server.address().port;
    await this.saveData({ port: this.port, token: this.token });
    this.registerView(VIEW, leaf => new HtmlRedirect(leaf, this));
    this.registerExtensions(['html', 'htm'], VIEW);
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (/^html?$/i.test(file.extension || '')) menu.addItem(item => item
        .setTitle('在自带网页查看器中打开').setIcon('globe')
        .onClick(() => this.openHtml(file, this.app.workspace.getLeaf('tab')).catch(error => new Notice(error.message))));
    }));
  }
  async openHtml(file, leaf) {
    const url = `http://127.0.0.1:${this.port}/${this.token}/` + file.path.split('/').map(encodeURIComponent).join('/');
    await leaf.setViewState({ type: 'webviewer', state: { url, title: file.basename, navigate: true }, active: true });
  }
  async serve(req, res) {
    const deny = status => { res.writeHead(status); res.end(); };
    if (req.headers.host !== `127.0.0.1:${this.port}`) return deny(403);
    if (req.method !== 'GET' && req.method !== 'HEAD') return deny(405);
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { return deny(400); }
    const prefix = `/${this.token}/`;
    if (!pathname.startsWith(prefix)) return deny(403);
    const relative = pathname.slice(prefix.length);
    if (!relative || relative.includes('\\') || relative.includes('\0') || relative.split('/').some(part => part.startsWith('.'))) return deny(403);
    let real;
    try { real = await fs.realpath(path.resolve(this.root, relative)); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return deny(404); throw error; }
    const inside = path.relative(this.root, real);
    if (inside.startsWith('..' + path.sep) || inside === '..' || path.isAbsolute(inside) || inside.split(path.sep).some(part => part.startsWith('.'))) return deny(403);
    const type = MIME[path.extname(real).toLowerCase()];
    if (!type) return deny(403);
    if (!(await fs.stat(real)).isFile()) return deny(404);
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method === 'HEAD') { res.writeHead(200); res.end(); return; }
    const body = await fs.readFile(real);
    res.writeHead(200);
    res.end(body);
  }
};
