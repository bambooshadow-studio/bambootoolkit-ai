import { PlatformAdapter, PlatformTask, PlatformOrder, PlatformBalance } from './types.js';
import * as https from 'node:https';

// ---------------------------------------------------------------------------
// GitHub Issues Bounty Adapter
// ---------------------------------------------------------------------------

export class GitHubBountyAdapter implements PlatformAdapter {
  readonly name = 'github-bounties';
  private token: string;

  constructor(token?: string) {
    this.token = token ?? process.env['GITHUB_TOKEN'] ?? '';
  }

  private graphql(query: string, variables: Record<string, unknown> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ query, variables });
      const req = https.request(
        {
          hostname: 'api.github.com',
          port: 443,
          path: '/graphql',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'bamboo-toolkit/1.0',
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString();
            try { resolve(JSON.parse(raw)); }
            catch { reject(new Error(raw.slice(0, 200))); }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private rest(method: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.github.com',
          port: 443,
          path,
          method,
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'bamboo-toolkit/1.0',
          },
        },
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

  /** Search for bounty issues across public repos. */
  async scanTasks(limit = 30): Promise<PlatformTask[]> {
    const q = 'label:bounty OR label:reward label:"help wanted" is:issue is:open';
    const data = await this.rest('GET', `/search/issues?q=${encodeURIComponent(q)}&per_page=${limit}&sort=created&order=desc`);

    const items: any[] = data?.items ?? [];
    return items.map((i: any) => ({
      id: String(i.id),
      title: i.title,
      description: (i.body ?? '').slice(0, 200),
      bounty: 0, // GitHub doesn't expose bounty amount in API
      currency: 'USD',
      platform: 'github',
      url: i.html_url,
      status: 'open',
      category: 'coding',
      applicationCount: i.comments,
      createdAt: i.created_at,
    }));
  }

  /** Comment `/claim` on an issue to apply. */
  async applyForTask(taskId: string, message = '/claim'): Promise<boolean> {
    // taskId is the GitHub issue number; we need the full API URL
    // For now, return false since we need repo + issue number
    console.warn('[GitHubBountyAdapter] applyForTask requires repo/issue format');
    return false;
  }

  async getOrders(): Promise<PlatformOrder[]> {
    // Check merged PRs that reference bounty issues
    return [];
  }

  async getBalance(): Promise<PlatformBalance | null> {
    return { platform: 'github', balance: 0, currency: 'USD', withdrawable: 0 };
  }
}

export default GitHubBountyAdapter;
