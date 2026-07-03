export { TaskScanner, UUMitClient } from './task-scanner.js';
export type { Task, TaskApplication, Order, Deliverable, WalletInfo, ApiResponse } from './task-scanner.js';
export { Scheduler } from './scheduler.js';
export type { ScanCycleResult } from './scheduler.js';
export { RevenueDashboard } from './revenue-dashboard.js';
export type { RevenueReport, PlatformSummary } from './revenue-dashboard.js';
export { MultiPlatformScanner } from './platforms/index.js';
export { GitHubBountyAdapter } from './platforms/github.js';
export { GiteeBountyAdapter } from './platforms/gitee.js';
export type { PlatformAdapter, PlatformTask, PlatformOrder, PlatformBalance, ScanResult } from './platforms/types.js';
export { loadConfig } from './config.js';
export type { ToolkitConfig, UUMitConfig } from './config.js';

// MCP Server — spawn via: npx bamboo-toolkit-mcp
export { startMcpServer } from './mcp-server/index.js';

/** Plugin activation (Paperclip convention). */
export function activate() {
  console.log('[BambooToolkit] Activated');
  const { TaskScanner } = require('./task-scanner.js');
  const scanner = new TaskScanner();
  console.log('[BambooToolkit] TaskScanner ready, skillId:', scanner.skillId);
  return { name: 'bamboo-toolkit', version: '2.0.0', scanner };
}
