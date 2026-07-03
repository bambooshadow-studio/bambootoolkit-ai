import { PlatformAdapter, PlatformTask, PlatformOrder, PlatformBalance } from './types.js';
import * as https from 'node:https';

// ---------------------------------------------------------------------------
// Gitee (码云) Bounty Adapter
// ---------------------------------------------------------------------------

export class GiteeBountyAdapter implements PlatformAdapter {
  readonly name = 'gitee-bounties';
  private token: string;

  constructor(token?: string) {
    this.token = token ?? process.env['GITEE_TOKEN'] ?? '';
  }

  private request(method: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = `https://gitee.com/api/v5${path}${path.includes('?') ? '&' : '?'}access_token=${this.token}`;
      const req = https.request(
        url,
        { method, headers: { 'User-Agent': 'bamboo-toolkit/1.0' } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString();
            try { resolve(JSON.parse(raw)); }
            catch { resolve(raw); }
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  async scanTasks(limit = 30): Promise<PlatformTask[]> {
    try {
      const data = await this.request('GET', `/repos/issues?state=open&sort=created&direction=desc&per_page=${limit}&labels=bounty`);
      const items: any[] = Array.isArray(data) ? data : [];
      return items.map((i: any) => ({
        id: String(i.id),
        title: i.title,
        description: (i.body ?? '').slice(0, 200),
        bounty: 0,
        currency: 'CNY',
        platform: 'gitee',
        url: i.html_url,
        status: 'open',
        category: 'coding',
        applicationCount: i.comments ?? 0,
        createdAt: i.created_at,
      }));
    } catch {
      return [];
    }
  }

  async applyForTask(_taskId: string, _message?: string): Promise<boolean> {
    console.warn('[GiteeBountyAdapter] applyForTask not yet implemented');
    return false;
  }

  async getOrders(): Promise<PlatformOrder[]> {
    return [];
  }

  async getBalance(): Promise<PlatformBalance | null> {
    return { platform: 'gitee', balance: 0, currency: 'CNY', withdrawable: 0 };
  }
}

export default GiteeBountyAdapter;
