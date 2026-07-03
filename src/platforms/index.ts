// ---------------------------------------------------------------------------
// Multi-platform orchestrator — combines all platform adapters
// ---------------------------------------------------------------------------

import { PlatformAdapter, PlatformTask, PlatformOrder, PlatformBalance, ScanResult } from './types.js';
import { UUMitClient } from '../task-scanner.js';
import { GitHubBountyAdapter } from './github.js';
import { GiteeBountyAdapter } from './gitee.js';
import { loadConfig } from '../config.js';

export class MultiPlatformScanner {
  private adapters: PlatformAdapter[] = [];

  constructor() {
    const cfg = loadConfig();

    // UUMit
    if (cfg.uumit.apiKey) {
      const client = new UUMitClient();
      this.adapters.push(this.wrapUUMit(client));
    }

    // GitHub
    const ghToken = process.env['GITHUB_TOKEN'];
    if (ghToken) {
      this.adapters.push(new GitHubBountyAdapter(ghToken));
    }

    // Gitee
    const giteeToken = process.env['GITEE_TOKEN'];
    if (giteeToken) {
      this.adapters.push(new GiteeBountyAdapter(giteeToken));
    }
  }

  /** Wrap UUMitClient to conform to PlatformAdapter. */
  private wrapUUMit(client: UUMitClient): PlatformAdapter {
    return {
      name: 'uumit',
      scanTasks: async (limit) => {
        const tasks = await client.scanTasks(limit ?? 30);
        return tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          bounty: t.bounty_amount,
          currency: 'UT',
          platform: 'uumit',
          url: '',
          status: t.status,
          category: t.category,
          applicationCount: t.application_count,
          createdAt: '',
        }));
      },
      applyForTask: async (taskId, message) => {
        const cfg = loadConfig();
        await client.applyForTask(taskId, cfg.uumit.skillId, message);
        return true;
      },
      getOrders: async () => {
        const orders = await client.getOrders();
        return orders.map((o) => ({
          id: o.id,
          platform: 'uumit',
          title: o.task_title,
          status: o.status as any,
          income: Number(o.settlement_amount),
          currency: 'UT',
          completedAt: o.completed_at,
          buyerName: o.buyer_nickname,
          rating: o.rating?.score ?? null,
        }));
      },
      getBalance: async () => {
        const w = await client.checkWallet();
        return w ? { platform: 'uumit', balance: Number(w.balance), currency: 'UT', withdrawable: Number(w.withdrawable) } : null;
      },
      submitDeliverable: async (orderId, filePath, fileName) => {
        await client.submitDeliverable(orderId, filePath, fileName);
        return true;
      },
    };
  }

  getAdapters(): PlatformAdapter[] {
    return this.adapters;
  }

  /** Scan all platforms. */
  async scanAll(): Promise<Record<string, PlatformTask[]>> {
    const result: Record<string, PlatformTask[]> = {};
    for (const a of this.adapters) {
      try {
        result[a.name] = await a.scanTasks();
      } catch {
        result[a.name] = [];
      }
    }
    return result;
  }

  /** Get all orders across platforms. */
  async getAllOrders(): Promise<PlatformOrder[]> {
    const all: PlatformOrder[] = [];
    for (const a of this.adapters) {
      try {
        const orders = await a.getOrders();
        all.push(...orders);
      } catch { /* skip */ }
    }
    return all;
  }

  /** Get all balances. */
  async getAllBalances(): Promise<PlatformBalance[]> {
    const all: PlatformBalance[] = [];
    for (const a of this.adapters) {
      try {
        const b = await a.getBalance();
        if (b) all.push(b);
      } catch { /* skip */ }
    }
    return all;
  }

  /** Auto-scan & auto-apply across all platforms. */
  async autoScanAll(): Promise<Record<string, ScanResult>> {
    const result: Record<string, ScanResult> = {};
    for (const a of this.adapters) {
      try {
        const tasks = await a.scanTasks(30);
        let applied = 0;
        let skipped = 0;
        for (const t of tasks) {
          try {
            await a.applyForTask(t.id);
            applied++;
          } catch {
            skipped++;
          }
        }
        result[a.name] = { scanned: tasks.length, applied, skipped, errors: [] };
      } catch (err) {
        result[a.name] = { scanned: 0, applied: 0, skipped: 0, errors: [(err as Error).message] };
      }
    }
    return result;
  }
}

export default MultiPlatformScanner;
