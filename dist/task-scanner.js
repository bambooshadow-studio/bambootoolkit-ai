"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskScanner = void 0;
const https = __importStar(require("node:https"));
// ---------------------------------------------------------------------------
// Client helpers
// ---------------------------------------------------------------------------
const API_BASE = 'api.uumit.com';
const AUTH_HEADERS = {
    'x-api-key': 'TwHyRNTDoxvEAjUSw9RJ8Zn77xucFDhrxsIpcqOiVTp9-LVFkDrWsX6dOKT5HCLM',
    'X-Platform-User-Id': 'f0840581-bbd1-4411-93aa-f8bdf8900a03',
};
/** Low-level HTTPS GET / POST wrapper using Node built-in https. */
function apiRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(`https://${API_BASE}${path}`);
        const headers = {
            ...AUTH_HEADERS,
            'Content-Type': 'application/json',
        };
        if (body)
            headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body), 'utf-8').toString();
        const req = https.request({
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method,
            headers,
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf-8');
                if (res.statusCode === undefined || res.statusCode >= 400) {
                    return reject(new Error(`API error ${res.statusCode}: ${raw.slice(0, 500)}`));
                }
                try {
                    resolve(JSON.parse(raw));
                }
                catch {
                    resolve(raw);
                }
            });
        });
        req.on('error', reject);
        if (body)
            req.write(JSON.stringify(body));
        req.end();
    });
}
// ---------------------------------------------------------------------------
// TaskScanner
// ---------------------------------------------------------------------------
class TaskScanner {
    skillId;
    constructor(skillId) {
        this.skillId = skillId ?? 'dd4ff9a5-3849-48de-b238-1c243840bda9';
    }
    /** Fetch open tasks from the task hall (latest 30). */
    async scanTasks() {
        const data = await apiRequest('GET', '/api/v1/tasks/hall?limit=30');
        // The API may wrap tasks under data.tasks or return data as an array.
        if (Array.isArray(data))
            return data;
        if (data?.data) {
            if (Array.isArray(data.data))
                return data.data;
            if (Array.isArray(data.data.tasks)) {
                return data.data.tasks;
            }
        }
        return [];
    }
    /** Filter tasks by allowed categories. */
    filterTasks(tasks, categories) {
        const lower = categories.map((c) => c.toLowerCase());
        return tasks.filter((t) => lower.includes(t.category?.toLowerCase()));
    }
    /** Submit an application for a task. */
    async applyForTask(taskId, skillId, message) {
        const body = {
            skill_id: skillId ?? this.skillId,
        };
        if (message)
            body.message = message;
        return apiRequest('POST', `/api/v1/tasks/${taskId}/applications`, body);
    }
    /** List my applications. */
    async checkApplications() {
        const data = await apiRequest('GET', '/api/v1/tasks/applications/mine');
        if (Array.isArray(data))
            return data;
        if (data?.data)
            return data.data;
        return [];
    }
    /** Check wallet balance. */
    async checkWallet() {
        const data = await apiRequest('GET', '/api/v1/wallet');
        if (data && 'balance' in data && 'currency' in data) {
            return data;
        }
        if (data && 'data' in data && data.data)
            return data.data;
        return null;
    }
}
exports.TaskScanner = TaskScanner;
// ---------------------------------------------------------------------------
// Default export (Paperclip plugin convention)
// ---------------------------------------------------------------------------
exports.default = TaskScanner;
