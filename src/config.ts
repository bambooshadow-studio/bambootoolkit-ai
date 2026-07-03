import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Config interface
// ---------------------------------------------------------------------------

export interface UUMitConfig {
  baseUrl: string;
  apiKey: string;
  userId: string;
  skillId: string;
}

export interface ToolkitConfig {
  uumit: UUMitConfig;
  scanIntervalMinutes: number;
  allowedCategories: string[];
  autoApply: boolean;
  autoApplyMessage: string;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ToolkitConfig = {
  uumit: {
    baseUrl: 'api.uumit.com',
    apiKey: '',
    userId: '',
    skillId: '',
  },
  scanIntervalMinutes: 30,
  allowedCategories: ['coding', 'writing', 'data'],
  autoApply: true,
  autoApplyMessage:
    'I can complete this task with high quality. Experienced developer skilled in programming, writing, and data analysis.',
};

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

function findConfigPath(): string | null {
  // 1. Check CONFIG_PATH env var
  const envPath = process.env['BAMBOO_TOOLKIT_CONFIG'];
  if (envPath && existsSync(envPath)) return envPath;

  // 2. Check cwd
  const cwd = process.cwd();
  for (const name of ['bamboo-toolkit.config.json', 'config.json']) {
    const p = join(cwd, name);
    if (existsSync(p)) return p;
  }

  // 3. (skipped - use env var BAMBOO_TOOLKIT_CONFIG or put config in cwd)

  return null;
}

/** Load config from file or return defaults (with env overrides). */
export function loadConfig(): ToolkitConfig {
  const cfgPath = findConfigPath();
  let cfg: ToolkitConfig = { ...DEFAULT_CONFIG, uumit: { ...DEFAULT_CONFIG.uumit } };

  if (cfgPath) {
    try {
      const raw = readFileSync(cfgPath, 'utf-8');
      const user = JSON.parse(raw) as Partial<ToolkitConfig>;
      if (user.uumit) cfg.uumit = { ...cfg.uumit, ...user.uumit };
      if (user.scanIntervalMinutes !== undefined) cfg.scanIntervalMinutes = user.scanIntervalMinutes;
      if (user.allowedCategories) cfg.allowedCategories = user.allowedCategories;
      if (user.autoApply !== undefined) cfg.autoApply = user.autoApply;
      if (user.autoApplyMessage) cfg.autoApplyMessage = user.autoApplyMessage;
    } catch (err) {
      console.error('[BambooToolkit] Failed to load config:', (err as Error).message);
    }
  }

  // Environment variable overrides
  if (process.env['UUMIT_API_KEY']) cfg.uumit.apiKey = process.env['UUMIT_API_KEY'];
  if (process.env['UUMIT_USER_ID']) cfg.uumit.userId = process.env['UUMIT_USER_ID'];
  if (process.env['UUMIT_SKILL_ID']) cfg.uumit.skillId = process.env['UUMIT_SKILL_ID'];

  return cfg;
}

export { DEFAULT_CONFIG };
