// ---------------------------------------------------------------------------
// Revenue Dashboard — track earnings across platforms
// ---------------------------------------------------------------------------

import { MultiPlatformScanner } from './platforms/index.js';
import { PlatformOrder, PlatformBalance } from './platforms/types.js';

export interface RevenueReport {
  generatedAt: string;
  summary: {
    totalIncome: number;
    totalOrders: number;
    settledOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    activePlatforms: number;
  };
  byPlatform: PlatformSummary[];
  recentActivity: PlatformOrder[];
}

export interface PlatformSummary {
  name: string;
  income: number;
  currency: string;
  orders: number;
  settled: number;
  rating: number | null;
  balance: number | null;
  withdrawable: number | null;
}

export class RevenueDashboard {
  private scanner: MultiPlatformScanner;

  constructor(scanner?: MultiPlatformScanner) {
    this.scanner = scanner ?? new MultiPlatformScanner();
  }

  /** Generate a full revenue report. */
  async generateReport(): Promise<RevenueReport> {
    const [allOrders, balances] = await Promise.all([
      this.scanner.getAllOrders(),
      this.scanner.getAllBalances(),
    ]);

    const byPlatformMap = new Map<string, PlatformOrder[]>();
    for (const o of allOrders) {
      const list = byPlatformMap.get(o.platform) ?? [];
      list.push(o);
      byPlatformMap.set(o.platform, list);
    }

    const byPlatform: PlatformSummary[] = [];
    for (const [name, orders] of byPlatformMap) {
      const settled = orders.filter((o) => o.status === 'settled' || o.status === 'completed');
      const ratings = settled.filter((o) => o.rating !== null).map((o) => o.rating!);
      const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null;
      const bal = balances.find((b) => b.platform === name);

      byPlatform.push({
        name,
        income: settled.reduce((s, o) => s + o.income, 0),
        currency: orders[0]?.currency ?? 'USD',
        orders: orders.length,
        settled: settled.length,
        rating: avgRating,
        balance: bal?.balance ?? null,
        withdrawable: bal?.withdrawable ?? null,
      });
    }

    const settled = allOrders.filter((o) => o.status === 'settled' || o.status === 'completed');
    const pending = allOrders.filter((o) => o.status === 'pending' || o.status === 'in_progress');

    // Recent activity (last 10 orders sorted by date)
    const recent = [...allOrders]
      .filter((o) => o.completedAt)
      .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalIncome: settled.reduce((s, o) => s + o.income, 0),
        totalOrders: allOrders.length,
        settledOrders: settled.length,
        pendingOrders: pending.length,
        cancelledOrders: allOrders.filter((o) => o.status === 'cancelled').length,
        activePlatforms: byPlatform.length,
      },
      byPlatform,
      recentActivity: recent,
    };
  }

  /** Print a human-readable report to console. */
  async printReport(): Promise<void> {
    const report = await this.generateReport();

    console.log('═══════════════════════════════════════════');
    console.log('  🚀 BambooToolkit Revenue Dashboard');
    console.log(`  ${new Date(report.generatedAt).toLocaleString()}`);
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log(`  💰 Total Income:     ${report.summary.totalIncome}`);
    console.log(`  📦 Total Orders:     ${report.summary.totalOrders}`);
    console.log(`  ✅ Settled:          ${report.summary.settledOrders}`);
    console.log(`  ⏳ In Progress:      ${report.summary.pendingOrders}`);
    console.log(`  ❌ Cancelled:        ${report.summary.cancelledOrders}`);
    console.log(`  🌐 Active Platforms: ${report.summary.activePlatforms}`);
    console.log('');

    for (const p of report.byPlatform) {
      console.log(`  ── ${p.name.toUpperCase()} ──`);
      console.log(`     Income:    ${p.income} ${p.currency}`);
      console.log(`     Orders:    ${p.settled}/${p.orders} settled`);
      if (p.rating !== null) console.log(`     Rating:    ⭐ ${p.rating.toFixed(1)}`);
      if (p.balance !== null) console.log(`     Balance:   ${p.balance} (${p.withdrawable} withdrawable)`);
      console.log('');
    }

    if (report.recentActivity.length > 0) {
      console.log('  📋 Recent Activity:');
      for (const o of report.recentActivity.slice(0, 5)) {
        const date = o.completedAt ? new Date(o.completedAt).toLocaleDateString() : '?';
        console.log(`     ${date} | ${o.income} ${o.currency} | ${o.title.slice(0, 40)}`);
      }
    }
    console.log('═══════════════════════════════════════════');
  }
}

export default RevenueDashboard;
