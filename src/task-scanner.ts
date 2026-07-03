import * as https from 'node:https';
import * as fs from 'node:fs';
import { loadConfig, UUMitConfig, ToolkitConfig } from './config';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  description: string;
  category?: string;
  bounty_amount: number;
  application_count: number;
  status: string;
}

export interface TaskApplication {
  id: string;
  task_id: string;
  task_title: string;
  task_status: string;
  skill_id: string;
  status: string;
  applied_at: string;
  responded_at: string | null;
}

export interface WalletInfo {
  balance: string;
  available: string;
  withdrawable: string;
  currency: string;
  frozen: string;
}

export interface Order {
  id: string;
  order_no: string;
  task_id: string;
  task_title: string;
  status: string;
  settlement_amount: string;
  unit_price: string;
  deliverables: Deliverable[];
  buyer_nickname: string;
  created_at: string;
  completed_at: string | null;
  rating: { score: number; comment: string | null } | null;
}

export interface Deliverable {
  name: string;
  url: string;
  size: number;
  uploaded_at: string;
  content_type?: string;
  submission_id: string;
  deliverable_type: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class UUMitClient {
  public readonly config: UUMitConfig;

  constructor(config?: Partial<UUMitConfig>) {
    const full = loadConfig().uumit;
    this.config = { ...full, ...config };
  }

  private headers(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'X-Platform-User-Id': this.config.userId,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    binary?: Buffer,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = { ...this.headers() };
      if (binary) {
        headers['Content-Type'] = 'application/octet-stream';
        headers['Content-Length'] = binary.length.toString();
      } else if (body) {
        headers['Content-Length'] = Buffer.byteLength(
          JSON.stringify(body), 'utf-8',
        ).toString();
      }

      const req = https.request(
        {
          hostname: this.config.baseUrl,
          port: 443,
          path,
          method,
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            if (res.statusCode !== undefined && res.statusCode >= 400) {
              return reject(
                new Error(`API error ${res.statusCode}: ${raw.slice(0, 500)}`),
              );
            }
            try {
              resolve(JSON.parse(raw) as T);
            } catch {
              resolve(raw as unknown as T);
            }
          });
        },
      );
      req.on('error', reject);
      if (binary) req.write(binary);
      else if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  /** Fetch open tasks from the hall. */
  async scanTasks(limit = 30): Promise<Task[]> {
    const res = await this.request<ApiResponse<{ items: Task[] }>>(
      'GET',
      `/api/v1/tasks/hall?limit=${limit}`,
    );
    return res.data?.items ?? [];
  }

  /** Submit an application. */
  async applyForTask(taskId: string, skillId: string, message?: string): Promise<unknown> {
    const body: Record<string, unknown> = { skill_id: skillId };
    if (message) body.message = message;
    return this.request('POST', `/api/v1/tasks/${taskId}/applications`, body);
  }

  /** List my applications. */
  async checkApplications(): Promise<TaskApplication[]> {
    const res = await this.request<ApiResponse<{ items: TaskApplication[] }>>(
      'GET',
      '/api/v1/tasks/applications/mine',
    );
    return res.data?.items ?? [];
  }

  /** Get accepted (in-progress) tasks that need deliverables. */
  async getAcceptedApplications(): Promise<TaskApplication[]> {
    const apps = await this.checkApplications();
    return apps.filter((a) => a.status === 'accepted');
  }

  /** List my orders (as seller). */
  async getOrders(): Promise<Order[]> {
    const res = await this.request<ApiResponse<{ items: Order[] }>>(
      'GET',
      '/api/v1/orders',
    );
    return res.data?.items ?? [];
  }

  /** Get order detail. */
  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const res = await this.request<ApiResponse<Order>>(
        'GET',
        `/api/v1/orders/${orderId}`,
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  /** Submit a deliverable file to an order.
   *  @param orderId - The order ID
   *  @param filePath - Local path to the deliverable file
   *  @param fileName - Name shown in the platform
   */
  async submitDeliverable(orderId: string, filePath: string, fileName?: string): Promise<unknown> {
    const fileBuffer = fs.readFileSync(filePath);
    const name = fileName ?? filePath.split(/[/\\]/).pop() ?? 'deliverable';

    // First get upload URL
    const uploadRes = await this.request<ApiResponse<{ upload_url: string; attachment_id: string }>>(
      'POST',
      '/api/v1/attachments/upload',
      { filename: name, content_type: 'application/octet-stream' },
    );

    const { upload_url, attachment_id } = uploadRes.data;

    // Upload file to OSS
    await new Promise<void>((resolve, reject) => {
      const url = new URL(upload_url);
      const req = https.request(
        { hostname: url.hostname, port: 443, path: url.pathname + url.search, method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' } },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Upload failed: ${res.statusCode}`));
          } else {
            resolve();
          }
        },
      );
      req.on('error', reject);
      req.write(fileBuffer);
      req.end();
    });

    // Submit deliverable reference
    return this.request('POST', `/api/v1/orders/${orderId}/deliverables`, {
      attachment_id,
      name: name,
      deliverable_type: 'digital',
    });
  }

  /** Check wallet. */
  async checkWallet(): Promise<WalletInfo | null> {
    try {
      const res = await this.request<ApiResponse<{ ut: WalletInfo }>>('GET', '/api/v1/wallet');
      if (res.data?.ut) return { ...res.data.ut, currency: 'UT' };
      return null;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// TaskScanner (backward-compatible wrapper)
// ---------------------------------------------------------------------------

export class TaskScanner {
  readonly skillId: string;
  private client: UUMitClient;
  private cfg: ToolkitConfig;

  constructor(skillId?: string, config?: Partial<UUMitConfig>) {
    this.cfg = loadConfig();
    this.client = new UUMitClient(config);
    this.skillId = skillId ?? this.cfg.uumit.skillId;
  }

  getClient(): UUMitClient {
    return this.client;
  }

  async scanTasks(): Promise<Task[]> {
    return this.client.scanTasks();
  }

  filterTasks(tasks: Task[], categories: string[]): Task[] {
    const lower = categories.map((c) => c.toLowerCase());
    return tasks.filter((t) => t.category && lower.includes(t.category.toLowerCase()));
  }

  async applyForTask(taskId: string, skillId?: string, message?: string): Promise<unknown> {
    return this.client.applyForTask(taskId, skillId ?? this.skillId, message ?? this.cfg.autoApplyMessage);
  }

  async checkApplications(): Promise<TaskApplication[]> {
    return this.client.checkApplications();
  }

  async getAcceptedApplications(): Promise<TaskApplication[]> {
    return this.client.getAcceptedApplications();
  }

  async getOrders(): Promise<Order[]> {
    return this.client.getOrders();
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.client.getOrder(orderId);
  }

  async submitDeliverable(orderId: string, filePath: string, fileName?: string): Promise<unknown> {
    return this.client.submitDeliverable(orderId, filePath, fileName);
  }

  async checkWallet(): Promise<WalletInfo | null> {
    return this.client.checkWallet();
  }

  /** Full auto-scan: scan → filter → auto-apply (if enabled). */
  async autoScanAndApply(): Promise<{ scanned: number; applied: number; skipped: number }> {
    const tasks = await this.scanTasks();
    const filtered = this.filterTasks(tasks, this.cfg.allowedCategories);

    const existing = await this.checkApplications();
    const existingIds = new Set(existing.map((a) => a.task_id));

    let applied = 0;
    let skipped = 0;

    if (this.cfg.autoApply) {
      for (const task of filtered) {
        if (existingIds.has(task.id)) {
          skipped++;
          continue;
        }
        try {
          await this.applyForTask(task.id, this.skillId, this.cfg.autoApplyMessage);
          applied++;
        } catch {
          skipped++;
        }
      }
    }

    return { scanned: tasks.length, applied, skipped };
  }
}

export default TaskScanner;
