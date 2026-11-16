// Abre o portal (repo irmão ../bar-do-tiao, ou PORTAL_DIR) só com o jogo "uno", usando ESTA pasta.
// Uso: npm run dev   (clone o bar-do-tiao ao lado e rode "npm install" nele antes)
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portal = path.resolve(process.env.PORTAL_DIR || path.join(here, '..', 'bar-do-tiao'));
if (!fs.existsSync(path.join(portal, 'package.json'))) {
    console.error('Portal não encontrado em ' + portal + '. Clone TheCics/bar-do-tiao ao lado ou defina PORTAL_DIR.');
    process.exit(1);
}
// Aponta o portal para esta pasta (symlink, sem alterar o package.json do portal).
spawnSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', here], { cwd: portal, stdio: 'inherit', shell: true });
const run = (script, env = {}) => spawn('npm', ['run', script], { cwd: portal, stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
const children = [run('dev:server', { GAMES: 'uno' }), run('dev:client')];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop); process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', stop));
