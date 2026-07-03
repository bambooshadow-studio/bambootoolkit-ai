import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { RevenueDashboard } from '../revenue-dashboard.js';
import { MultiPlatformScanner } from '../platforms/index.js';
import { loadConfig } from '../config.js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// MCP Server: BambooToolkit
// Exposes revenue, bounty scanning, npm publish as MCP tools/resources
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'bamboo-toolkit', version: '2.0.0' },
  { capabilities: { resources: {}, tools: {} } },
);

// ── Resources ─────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'bamboo://revenue/summary',
      name: 'Revenue Summary',
      description: 'Cross-platform revenue summary',
      mimeType: 'application/json',
    },
    {
      uri: 'bamboo://config',
      name: 'Toolkit Config',
      description: 'Current toolkit configuration (keys redacted)',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === 'bamboo://revenue/summary') {
    const dash = new RevenueDashboard();
    const report = await dash.generateReport();
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(report, null, 2) }],
    };
  }

  if (uri === 'bamboo://config') {
    const cfg = loadConfig();
    const safe = {
      platforms: {
        uumit: cfg.uumit.apiKey ? { configured: true, baseUrl: cfg.uumit.baseUrl, skillId: cfg.uumit.skillId } : { configured: false },
        github: process.env['GITHUB_TOKEN'] ? { configured: true } : { configured: false },
        gitee: process.env['GITEE_TOKEN'] ? { configured: true } : { configured: false },
      },
      scanIntervalMinutes: cfg.scanIntervalMinutes,
      autoApply: cfg.autoApply,
    };
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(safe, null, 2) }],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ── Tools ─────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan_bounties',
      description: 'Scan all platforms for open bounties/tasks',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results per platform', default: 10 },
        },
      },
    },
    {
      name: 'check_revenue',
      description: 'Get cross-platform revenue dashboard',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'check_pr_status',
      description: 'Check Claude Builders Bounty PR status',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'publish_npm',
      description: 'Build and publish bamboo-toolkit to npm (requires OTP)',
      inputSchema: {
        type: 'object',
        properties: {
          otp: { type: 'string', description: 'npm OTP code from authenticator' },
        },
        required: ['otp'],
      },
    },
    {
      name: 'run_uumit_scan',
      description: 'Run UUMit task hall scan and auto-apply',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['coding', 'writing', 'data', 'all'], default: 'all' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'scan_bounties': {
      const scanner = new MultiPlatformScanner();
      const limit = (args as any)?.limit ?? 10;
      const results = await scanner.scanAll();
      const summary = Object.entries(results).map(([platform, tasks]) => ({
        platform,
        count: tasks.length,
        tasks: tasks.slice(0, limit).map((t) => ({
          id: t.id,
          title: t.title.slice(0, 80),
          bounty: t.bounty,
          currency: t.currency,
          url: t.url,
        })),
      }));
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
    }

    case 'check_revenue': {
      const dash = new RevenueDashboard();
      const report = await dash.generateReport();
      return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
    }

    case 'check_pr_status': {
      const ghToken = process.env['GITHUB_TOKEN'];
      if (!ghToken) return { content: [{ type: 'text', text: '{ "error": "GITHUB_TOKEN not set" }' }] };

      const res = await fetch('https://api.github.com/search/issues?q=author:bambooshadow-studio+repo:claude-builders-bounty/claude-builders-bounty+type:pr', {
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'bamboo-toolkit-mcp' },
      });
      const data = await res.json() as any;
      const prs = (data.items ?? []).map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        created: pr.created_at,
        comments: pr.comments,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(prs, null, 2) }] };
    }

    case 'publish_npm': {
      const otp = (args as any)?.otp;
      if (!otp) return { content: [{ type: 'text', text: '{ "error": "OTP required" }' }] };

      try {
        const result = execSync(`npm publish --access public --otp="${otp}"`, {
          cwd: join(process.cwd()),
          encoding: 'utf-8',
          timeout: 30000,
        });
        return { content: [{ type: 'text', text: result }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `{ "error": ${JSON.stringify(err.message)} }` }] };
      }
    }

    case 'run_uumit_scan': {
      const { TaskScanner } = require('../task-scanner.js');
      const scanner = new TaskScanner();
      const result = await scanner.autoScanAndApply();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[BambooToolkit MCP] Server running on stdio');
}

// Auto-start when run directly
const isDirectRun = process.argv[1]?.includes('mcp-server');
if (isDirectRun) {
  startMcpServer().catch((err) => {
    console.error('[BambooToolkit MCP] Fatal:', err);
    process.exit(1);
  });
}
