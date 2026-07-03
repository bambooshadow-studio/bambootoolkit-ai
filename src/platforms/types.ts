// ---------------------------------------------------------------------------
// Platform adapter interface — all platforms implement this
// ---------------------------------------------------------------------------

export interface PlatformTask {
  id: string;
  title: string;
  description: string;
  bounty: number;
  currency: string;
  platform: string;
  url: string;
  status: string;
  category?: string;
  applicationCount: number;
  createdAt: string;
}

export interface PlatformOrder {
  id: string;
  platform: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'settled' | 'cancelled';
  income: number;
  currency: string;
  completedAt: string | null;
  buyerName: string;
  rating: number | null;
}

export interface PlatformBalance {
  platform: string;
  balance: number;
  currency: string;
  withdrawable: number;
}

export interface ScanResult {
  scanned: number;
  applied: number;
  skipped: number;
  errors: string[];
}

/** Each platform adapter must implement this interface. */
export interface PlatformAdapter {
  readonly name: string;

  /** Scan available tasks/bounties. */
  scanTasks(limit?: number): Promise<PlatformTask[]>;

  /** Apply for a task. */
  applyForTask(taskId: string, message?: string): Promise<boolean>;

  /** Get current orders (won tasks). */
  getOrders(): Promise<PlatformOrder[]>;

  /** Get account balance. */
  getBalance(): Promise<PlatformBalance | null>;

  /** Submit a deliverable. */
  submitDeliverable?(orderId: string, filePath: string, fileName?: string): Promise<boolean>;
}
