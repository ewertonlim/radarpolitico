import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

export function loadScript(file, globalName) {
  const src = readFileSync(resolve(ROOT, 'js', file), 'utf8');
  const value = new Function(`${src}\nreturn ${globalName};`)();
  globalThis[globalName] = value;
  return value;
}

export const loadAPI = () => loadScript('api.js', 'API');
export const loadComponents = () => loadScript('components.js', 'Components');
export const loadApp = () => loadScript('app.js', 'App');
