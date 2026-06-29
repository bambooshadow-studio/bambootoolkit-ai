import { TaskScanner } from './task-scanner';

export function activate() {
  console.log('[BambooToolkit] Activated');

  const scanner = new TaskScanner();
  console.log('[BambooToolkit] TaskScanner ready, skillId:', scanner.skillId);

  return { name: 'bamboo-toolkit', version: '1.0.0', scanner };
}

export { TaskScanner } from './task-scanner';
