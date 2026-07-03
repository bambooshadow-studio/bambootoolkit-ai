export { TaskScanner, UUMitClient } from './task-scanner.js';
export type { Task, TaskApplication, Order, Deliverable, WalletInfo, ApiResponse } from './task-scanner.js';
export { Scheduler } from './scheduler.js';
export type { ScanCycleResult } from './scheduler.js';
export { loadConfig } from './config.js';
export type { ToolkitConfig, UUMitConfig } from './config.js';

/** Plugin activation (Paperclip convention). */
export function activate() {
  console.log('[BambooToolkit] Activated');
  const { TaskScanner } = require('./task-scanner.js');
  const scanner = new TaskScanner();
  console.log('[BambooToolkit] TaskScanner ready, skillId:', scanner.skillId);
  return { name: 'bamboo-toolkit', version: '2.0.0', scanner };
}
