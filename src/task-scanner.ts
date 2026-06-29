import * as https from 'node:https';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  description: string;
  category: 'coding' | 'writing' | 'data';
  bounty_amount: number;
  application_count: number;
  status: string;
}

export interface TaskApplication {
  id: string;
  task_id: string;
  status: string;
  created_at: string;
}

export interface WalletInfo {
  balance: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Client helpers
// ---------------------------------------------------------------------------

const API_BASE = 'api.uumit.com';

const AUTH_HEADERS: Record<string, string> = {
  'x-api-key':
    'TwHyRNTDoxvEAjUSw9RJ8Zn77xucFDhrxsIpcqOiVTp9-LVFkDrWsX6dOKT5HCLM',
  'X-Platform-User-Id': 'f0840581-bbd1-4411-93aa-f8bdf8900a03',
};

/** Low-level HTTPS GET / POST wrapper using Node built-in https. */
function apiRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${API_BASE}${path}`);
    const headers: Record<string, string> = {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
    };
    if (body) headers['Content-Length'] = Buffer.byteLength(
      JSON.stringify(body),
      'utf-8',
    ).toString();

    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode === undefined || res.statusCode >= 400) {
            return reject(
              new Error(
                `API error ${res.statusCode}: ${raw.slice(0, 500)}`,
              ),
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// TaskScanner
// ---------------------------------------------------------------------------

export class TaskScanner {
  readonly skillId: string;

  constructor(skillId?: string) {
    this.skillId = skillId ?? 'dd4ff9a5-3849-48de-b238-1c243840bda9';
  }

  /** Fetch open tasks from the task hall (latest 30). */
  async scanTasks(): Promise<Task[]> {
    const data = await apiRequest<{ data?: { tasks?: Task[] } | Task[] }>(
      'GET',
      '/api/v1/tasks/hall?limit=30',
    );

    // The API may wrap tasks under data.tasks or return data as an array.
    if (Array.isArray(data)) return data as Task[];
    if (data?.data) {
      if (Array.isArray(data.data)) return data.data as Task[];
      if (Array.isArray((data.data as { tasks?: Task[] }).tasks)) {
        return (data.data as { tasks: Task[] }).tasks;
      }
    }
    return [];
  }

  /** Filter tasks by allowed categories. */
  filterTasks(tasks: Task[], categories: string[]): Task[] {
    const lower = categories.map((c) => c.toLowerCase());
    return tasks.filter((t) => lower.includes(t.category?.toLowerCase()));
  }

  /** Submit an application for a task. */
  async applyForTask(
    taskId: string,
    skillId?: string,
    message?: string,
  ): Promise<unknown> {
    const body: Record<string, unknown> = {
      skill_id: skillId ?? this.skillId,
    };
    if (message) body.message = message;

    return apiRequest('POST', `/api/v1/tasks/${taskId}/applications`, body);
  }

  /** List my applications. */
  async checkApplications(): Promise<TaskApplication[]> {
    const data = await apiRequest<{ data?: TaskApplication[] } | TaskApplication[]>(
      'GET',
      '/api/v1/tasks/applications/mine',
    );

    if (Array.isArray(data)) return data as TaskApplication[];
    if (data?.data) return data.data;
    return [];
  }

  /** Check wallet balance. */
  async checkWallet(): Promise<WalletInfo | null> {
    const data = await apiRequest<{ data?: WalletInfo } | WalletInfo>(
      'GET',
      '/api/v1/wallet',
    );

    if (data && 'balance' in data && 'currency' in data) {
      return data as WalletInfo;
    }
    if (data && 'data' in data && data.data) return data.data as WalletInfo;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Default export (Paperclip plugin convention)
// ---------------------------------------------------------------------------

export default TaskScanner;
