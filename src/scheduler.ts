import { TaskScanner, UUMitClient, TaskApplication, WalletInfo } from './task-scanner.js';
import { loadConfig, ToolkitConfig } from './config.js';

// ---------------------------------------------------------------------------
// ScanResult
// ---------------------------------------------------------------------------

export interface ScanCycleResult {
  timestamp: string;
  tasksScanned: number;
  newApplications: number;
  acceptedTasks: number;
  pendingDeliverables: number;
  walletBalance: string;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Scheduler — heartbeat-based auto-scan loop
// ---------------------------------------------------------------------------

export class Scheduler {
  private scanner: TaskScanner;
  private cfg: ToolkitConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private cycleCount = 0;

  /** Callback invoked after each scan cycle. */
  onCycle?: (result: ScanCycleResult) => void;

  constructor(scanner?: TaskScanner) {
    this.cfg = loadConfig();
    this.scanner = scanner ?? new TaskScanner();
  }

  /** Start the heartbeat loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.cycleCount = 0;

    console.log(`[BambooToolkit] Scheduler started (interval: ${this.cfg.scanIntervalMinutes}min)`);

    // Run immediately
    this.tick();

    // Then run on interval
    this.timer = setInterval(() => this.tick(), this.cfg.scanIntervalMinutes * 60 * 1000);
  }

  /** Stop the heartbeat loop. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    console.log('[BambooToolkit] Scheduler stopped');
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Execute one scan cycle. */
  async tick(): Promise<ScanCycleResult> {
    this.cycleCount++;
    const errors: string[] = [];
    const ts = new Date().toISOString();

    console.log(`[BambooToolkit] Cycle #${this.cycleCount} starting...`);

    // --- Step 1: Auto-scan & apply ---
    let tasksScanned = 0;
    let newApplications = 0;
    try {
      const result = await this.scanner.autoScanAndApply();
      tasksScanned = result.scanned;
      newApplications = result.applied;
      console.log(`[BambooToolkit] Scanned ${result.scanned} tasks, applied ${result.applied}, skipped ${result.skipped}`);
    } catch (err) {
      errors.push(`Auto-scan failed: ${(err as Error).message}`);
    }

    // --- Step 2: Check accepted tasks ---
    let acceptedTasks = 0;
    let pendingDeliverables = 0;
    try {
      const accepted = await this.scanner.getAcceptedApplications();
      acceptedTasks = accepted.length;

      // Check orders for pending deliverables
      const orders = await this.scanner.getOrders();
      const unsettled = orders.filter((o) => o.status === 'pending' || o.status === 'in_progress');
      pendingDeliverables = unsettled.length;

      if (acceptedTasks > 0) {
        console.log(`[BambooToolkit] ${acceptedTasks} accepted task(s), ${pendingDeliverables} pending delivery`);
      }
    } catch (err) {
      errors.push(`Check applications failed: ${(err as Error).message}`);
    }

    // --- Step 3: Check wallet ---
    let walletBalance = 'unknown';
    try {
      const wallet = await this.scanner.checkWallet();
      if (wallet) {
        walletBalance = `${wallet.available} ${wallet.currency}`;
      }
    } catch (err) {
      errors.push(`Wallet check failed: ${(err as Error).message}`);
    }

    const result: ScanCycleResult = {
      timestamp: ts,
      tasksScanned,
      newApplications,
      acceptedTasks,
      pendingDeliverables,
      walletBalance,
      errors,
    };

    this.onCycle?.(result);
    return result;
  }
}

export default Scheduler;
