const { app, BrowserWindow, ipcMain, dialog, Menu, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const isMac = process.platform === 'darwin';
const STORE = () => path.join(app.getPath('userData'), 'store.json');
const BOUNDS = () => path.join(app.getPath('userData'), 'window.json');
const FILTERS = [
  { name: 'Source files', extensions: ['cpp', 'cc', 'cxx', 'c', 'h', 'hpp', 'py'] },
  { name: 'C/C++ source', extensions: ['cpp', 'cc', 'cxx', 'c', 'h', 'hpp'] },
  { name: 'Python source', extensions: ['py'] },
  { name: 'All files', extensions: ['*'] },
];

/* ---------- small JSON store ---------- */
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}
let store = null;
const getStore = () => (store ??= readJSON(STORE(), {}));

/* ---------- window ---------- */
let win = null;

// Paths the renderer may rename, trash, or reveal: ones the user picked, dropped, or saved, plus ones already in the library.
const sessionPaths = new Set();
function isKnown(p) {
  if (typeof p !== 'string' || !p) return false;
  if (sessionPaths.has(p)) return true;
  const nodes = (getStore().library || {}).nodes || {};
  return Object.values(nodes).some((n) => n && n.path === p);
}

function createWindow() {
  const saved = readJSON(BOUNDS(), {});
  win = new BrowserWindow({
    width: saved.width || 1440,
    height: saved.height || 880,
    x: saved.x,
    y: saved.y,
    minWidth: 960,
    minHeight: 560,
    show: false,
    backgroundColor: '#1b1b1c',
    title: 'Short++',
    ...(isMac
      ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 13 } }
      : { frame: false }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (saved.maximized) win.maximize();
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => win.show());

  const sendState = () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('win:state', { maximized: win.isMaximized(), fullscreen: win.isFullScreen() });
    }
  };
  ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'].forEach((e) => win.on(e, sendState));
  win.webContents.on('did-finish-load', sendState);

  // links never open inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.on('close', () => {
    try {
      const b = win.getNormalBounds();
      writeJSON(BOUNDS(), { ...b, maximized: win.isMaximized() });
    } catch {}
  });
  win.on('closed', () => { win = null; killJob(); });
}

/* ---------- menu (macOS keeps a native app menu; other platforms use the custom topbar) ---------- */
function buildMenu() {
  if (!isMac) { Menu.setApplicationMenu(null); return; }
  const send = (cmd) => () => win && win.webContents.send('menu', cmd);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        { label: 'New File', accelerator: 'Cmd+N', click: send('new') },
        { label: 'New C++ File', click: send('newCpp') },
        { label: 'New Python File', click: send('newPy') },
        { label: 'New Folder', accelerator: 'Shift+Cmd+N', click: send('newFolder') },
        { label: 'Open…', accelerator: 'Cmd+O', click: send('open') },
        { label: 'Open C++ Example', click: send('exampleCpp') },
        { label: 'Open Python Example', click: send('examplePy') },
        { type: 'separator' },
        { label: 'Templates…', accelerator: 'Shift+Return', click: send('templates') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'Cmd+S', click: send('save') },
        { label: 'Save As…', accelerator: 'Shift+Cmd+S', click: send('saveAs') },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Cmd+Z', click: send('undo') },
        { label: 'Redo', accelerator: 'Shift+Cmd+Z', click: send('redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    { label: 'Run', submenu: [{ label: 'Run', accelerator: 'Cmd+Return', click: send('run') }, { label: 'Stop', accelerator: 'Cmd+.', click: send('stop') }] },
    { label: 'View', submenu: [{ label: 'Toggle Explorer', accelerator: 'Cmd+B', click: send('toggleSidebar') }, { type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ]));
}

/* ---------- IPC ---------- */
ipcMain.handle('store:get', (_e, key) => getStore()[key] ?? null);
ipcMain.handle('store:set', (_e, key, value) => {
  getStore()[key] = value;
  writeJSON(STORE(), store);
  return true;
});

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: FILTERS });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  sessionPaths.add(p);
  return { path: p, content: fs.readFileSync(p, 'utf8') };
});
ipcMain.handle('file:read', (_e, p) => {
  if (typeof p !== 'string' || !p) return null;
  try {
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > 2 * 1024 * 1024) return null;
    sessionPaths.add(p);
    return { path: p, content: fs.readFileSync(p, 'utf8') };
  } catch { return null; }
});
ipcMain.handle('file:save', async (_e, { path: p, content, as, name }) => {
  let target = p;
  if (!target || as) {
    const r = await dialog.showSaveDialog(win, { defaultPath: p || name || 'main.cpp', filters: FILTERS });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  if (!as && p && !isKnown(p)) return null;
  fs.writeFileSync(target, content, 'utf8');
  sessionPaths.add(target);
  return target;
});
ipcMain.handle('file:rename', (_e, p, name) => {
  if (!isKnown(p)) return { error: 'This file isn’t in the list' };
  name = String(name || '').trim();
  if (!name || /[\\/]/.test(name) || name === '.' || name === '..') return { error: 'That name can’t be used' };
  const next = path.join(path.dirname(p), name);
  if (next === p) return { path: p };
  if (fs.existsSync(next) && next.toLowerCase() !== p.toLowerCase()) return { error: `${name} already exists in that folder` };
  try { fs.renameSync(p, next); } catch (err) { return { error: err.code === 'ENOENT' ? 'The file is missing on disk' : 'Rename failed' }; }
  sessionPaths.add(next);
  return { path: next };
});
ipcMain.handle('file:trash', async (_e, p) => {
  if (!isKnown(p)) return false;
  try { await shell.trashItem(p); return true; } catch { return false; }
});
ipcMain.on('file:reveal', (_e, p) => { if (isKnown(p)) shell.showItemInFolder(p); });
ipcMain.handle('file:exists', (_e, paths) => (Array.isArray(paths) ? paths.map((p) => typeof p === 'string' && fs.existsSync(p)) : []));
ipcMain.handle('dialog:ask', async (_e, o = {}) => {
  const r = await dialog.showMessageBox(win, {
    type: o.type || 'question',
    message: String(o.message || ''),
    detail: o.detail ? String(o.detail) : undefined,
    buttons: Array.isArray(o.buttons) ? o.buttons.map(String) : ['OK', 'Cancel'],
    defaultId: o.defaultId ?? 0,
    cancelId: o.cancelId ?? 1,
  });
  return r.response;
});

ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:toggle-maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('win:dirty', (_e, v) => { if (isMac && win) win.setDocumentEdited(!!v); });
ipcMain.on('app:devtools', () => { if (win && !app.isPackaged) win.webContents.toggleDevTools(); });
ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text)); return true; });


/* ---------- running code with the toolchain already on the machine ---------- */
const RUN_DIR = path.join(os.tmpdir(), 'shortpp-run');
const OUT_CAP = 256 * 1024;
const COMPILE_MS = 30000;

function probe(cmd, args) {
  return new Promise((res) => {
    let p;
    try { p = spawn(cmd, args, { windowsHide: true }); } catch { return res(null); }
    let out = '';
    const done = (ok) => res(ok ? { cmd, version: out.split('\n')[0].trim() } : null);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('error', () => done(false));
    p.on('close', (code) => done(code === 0));
    setTimeout(() => { try { p.kill(); } catch {} done(false); }, 4000);
  });
}
let toolchain = null;
async function detectToolchain(force) {
  if (toolchain && !force) return toolchain;
  const first = async (list) => { for (const [cmd, ...args] of list) { const r = await probe(cmd, args); if (r) return r; } return null; };
  const [cpp, py] = await Promise.all([
    first([['g++', '--version'], ['clang++', '--version'], ['c++', '--version']]),
    first(isMac || process.platform === 'linux'
      ? [['python3', '--version'], ['python', '--version']]
      : [['py', '-3', '--version'], ['python', '--version'], ['python3', '--version']]),
  ]);
  toolchain = { cpp, py, platform: process.platform };
  return toolchain;
}

let job = null;
function killJob() {
  if (!job) return;
  const p = job;
  job = null;
  try { process.platform === 'win32' ? spawn('taskkill', ['/pid', p.pid, '/f', '/t']) : process.kill(-p.pid, 'SIGKILL'); }
  catch { try { p.kill('SIGKILL'); } catch {} }
}
// Runs one child to completion. Always resolves; partial output is kept on timeout.
function once(cmd, args, { input, timeout, cwd }) {
  return new Promise((res) => {
    let p;
    const opts = { cwd, windowsHide: true, detached: process.platform !== 'win32' };
    try { p = spawn(cmd, args, opts); } catch (err) { return res({ error: err.message, code: null }); }
    job = p;
    let out = '', err = '', capped = false, timedOut = false;
    const add = (which, d) => {
      const room = OUT_CAP - (out.length + err.length);
      if (room <= 0) { capped = true; return; }
      const s = d.length > room ? (capped = true, d.slice(0, room)) : d;
      which === 1 ? (out += s) : (err += s);
    };
    p.stdout.on('data', (d) => add(1, String(d)));
    p.stderr.on('data', (d) => add(2, String(d)));
    p.on('error', (e) => { if (job === p) job = null; clearTimeout(t); res({ error: e.code === 'ENOENT' ? `${cmd} not found` : e.message, code: null }); });
    const started = Date.now();
    const t = setTimeout(() => { timedOut = true; killJob(); }, timeout);
    p.on('close', (code, signal) => {
      if (job === p) job = null;
      clearTimeout(t);
      res({ out, err, code, signal, capped, timedOut, ms: Date.now() - started });
    });
    if (p.stdin) {
      p.stdin.on('error', () => {}); // the program may exit without reading stdin
      p.stdin.end(input == null ? '' : String(input));
    }
  });
}
ipcMain.handle('run:toolchain', (_e, force) => detectToolchain(force));
ipcMain.on('run:stop', killJob);
ipcMain.handle('run:code', async (_e, { lang, code, input, timeout } = {}) => {
  killJob();
  const tc = await detectToolchain();
  const limit = Math.min(Math.max(Number(timeout) || 5000, 1000), 60000);
  fs.mkdirSync(RUN_DIR, { recursive: true });
  try {
    if (lang === 'py') {
      if (!tc.py) return { stage: 'missing', tool: 'python' };
      const file = path.join(RUN_DIR, 'main.py');
      fs.writeFileSync(file, String(code ?? ''), 'utf8');
      const args = tc.py.cmd === 'py' ? ['-3', '-I', file] : ['-I', file];
      const r = await once(tc.py.cmd, args, { input, timeout: limit, cwd: RUN_DIR });
      return { stage: 'run', ...r };
    }
    if (!tc.cpp) return { stage: 'missing', tool: 'c++' };
    const srcFile = path.join(RUN_DIR, 'main.cpp');
    const exe = path.join(RUN_DIR, process.platform === 'win32' ? 'main.exe' : 'main.out');
    fs.writeFileSync(srcFile, String(code ?? ''), 'utf8');
    try { fs.rmSync(exe, { force: true }); } catch {}
    const c = await once(tc.cpp.cmd, ['-std=gnu++17', '-O2', '-w', '-o', exe, srcFile], { timeout: COMPILE_MS, cwd: RUN_DIR });
    if (c.error) return { stage: 'compile', ...c };
    if (c.code !== 0 || !fs.existsSync(exe)) return { stage: 'compile', ...c };
    const r = await once(exe, [], { input, timeout: limit, cwd: RUN_DIR });
    return { stage: 'run', compileMs: c.ms, ...r };
  } catch (err) {
    return { stage: 'error', error: String(err && err.message || err) };
  }
});

/* ---------- lifecycle ---------- */
app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', killJob);
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
