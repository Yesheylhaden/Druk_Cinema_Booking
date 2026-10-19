import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'src/server.js'], { cwd: `${root}backend`, stdio: 'inherit' }),
  spawn(process.execPath, ['scripts/serve.mjs'], { cwd: `${root}frontend`, stdio: 'inherit' })
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  process.exitCode = code;
}
children.forEach(child => {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 0); });
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
