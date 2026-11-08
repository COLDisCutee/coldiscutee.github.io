#!/usr/bin/env node
/* Prints what Short++ needs and what this machine has. Plain Node, no dependencies.
   Run it with: npm run doctor  */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const ok = (s) => '  ok    ' + s;
const bad = (s) => '  FAIL  ' + s;
const warn = (s) => '  note  ' + s;
const out = [];
let problems = 0;
const fail = (s) => { problems++; out.push(bad(s)); };

function version(cmd, args) {
  try { return String(execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })).split('\n')[0].trim(); }
  catch { return null; }
}

out.push('Short++ doctor');
out.push(`  ${os.platform()} ${os.arch()} · node ${process.version} · ${new Date().toISOString().slice(0, 10)}`);
out.push('');

out.push('Node');
const major = Number(process.versions.node.split('.')[0]);
const minor = Number(process.versions.node.split('.')[1]);
if (major > 20 || (major === 20 && minor >= 19)) out.push(ok(`node ${process.version}`));
else fail(`node ${process.version} is too old. Install Node 20.19 or newer (22 LTS is a good pick): https://nodejs.org`);
const npmV = version(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['-v']);
out.push(npmV ? ok('npm ' + npmV) : bad('npm was not found on PATH'));
if (!npmV) problems++;

out.push('');
out.push('Project files');
for (const f of ['package.json', 'package-lock.json', 'main.js', 'preload.js', 'renderer/index.html', 'renderer/app.js', 'renderer/core.js', 'renderer/core-py.js', 'renderer/complete.js', 'renderer/styles.css']) {
  fs.existsSync(path.join(root, f)) ? out.push(ok(f)) : fail(`${f} is missing — unzip the whole folder, keeping its structure`);
}

out.push('');
out.push('Dependencies');
const nm = path.join(root, 'node_modules');
if (!fs.existsSync(nm)) fail('node_modules is missing — run: npm install');
else {
  out.push(ok('node_modules'));
  const eDir = path.join(nm, 'electron');
  if (!fs.existsSync(eDir)) fail('the electron package is missing — run: npm install');
  else {
    const pathTxt = path.join(eDir, 'path.txt');
    if (!fs.existsSync(pathTxt)) {
      fail('the Electron binary was never downloaded (node_modules/electron/path.txt is missing).');
      out.push(warn('This is the usual failure. See "Electron binary" in INSTALL.md.'));
      out.push(warn('Most common fix, for restricted or slow networks:'));
      out.push(warn('  npm config set electron_mirror https://npmmirror.com/mirrors/electron/'));
      out.push(warn('  npm install'));
    } else {
      const exe = path.join(eDir, 'dist', String(fs.readFileSync(pathTxt)).trim());
      fs.existsSync(exe) ? out.push(ok('Electron binary ' + require(path.join(eDir, 'package.json')).version))
        : fail('node_modules/electron/dist is incomplete — delete node_modules and run npm install again');
    }
  }
}

out.push('');
out.push('Compilers used by Run (optional, not needed to install)');
const cpp = ['g++', 'clang++', 'c++'].map((c) => [c, version(c, ['--version'])]).find((x) => x[1]);
out.push(cpp ? ok(cpp[1]) : warn('no C++ compiler on PATH — the editor still works, Run does not'));
const pyCmds = process.platform === 'win32' ? [['py', ['-3', '--version']], ['python', ['--version']]] : [['python3', ['--version']], ['python', ['--version']]];
const py = pyCmds.map(([c, a]) => version(c, a)).find(Boolean);
out.push(py ? ok(py) : warn('no Python on PATH — the editor still works, Run does not'));

out.push('');
out.push('Network settings that affect the download');
const envs = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ELECTRON_MIRROR', 'electron_mirror', 'ELECTRON_CUSTOM_DIR', 'npm_config_proxy', 'npm_config_https_proxy', 'npm_config_registry'];
const set = envs.filter((k) => process.env[k]);
out.push(set.length ? set.map((k) => warn(`${k}=${process.env[k]}`)).join('\n') : warn('none set'));
const cacheDir = process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Local', 'electron', 'Cache')
  : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Caches', 'electron')
    : path.join(os.homedir(), '.cache', 'electron');
out.push(warn(`Electron cache: ${cacheDir}${fs.existsSync(cacheDir) ? '' : ' (not created yet)'}`));

out.push('');
out.push(problems ? `${problems} problem(s) found. Fix the FAIL lines above, or paste this whole output when asking for help.`
  : 'No problems found. Start the app with: npm start');
console.log(out.join('\n'));
process.exit(problems ? 1 : 0);
