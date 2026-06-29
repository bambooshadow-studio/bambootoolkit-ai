import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TaskScanner, Task } from '../task-scanner.js';

describe('TaskScanner', () => {
  const scanner = new TaskScanner();

  it('should have default skillId', () => {
    assert.strictEqual(scanner.skillId, 'dd4ff9a5-3849-48de-b238-1c243840bda9');
  });

  it('should accept custom skillId', () => {
    const s = new TaskScanner('custom-id');
    assert.strictEqual(s.skillId, 'custom-id');
  });
});

describe('filterTasks', () => {
  const scanner = new TaskScanner();
  const tasks: Task[] = [
    { id:'1',title:'a',description:'',category:'coding',bounty_amount:51,application_count:0,status:'open' },
    { id:'2',title:'b',description:'',category:'writing',bounty_amount:53,application_count:1,status:'open' },
    { id:'3',title:'c',description:'',category:'data',bounty_amount:51,application_count:2,status:'open' },
    { id:'4',title:'d',description:'',category:'coding',bounty_amount:55,application_count:3,status:'open' },
  ];

  it('should filter single category', () => {
    const r = scanner.filterTasks(tasks, ['coding']);
    assert.strictEqual(r.length, 2);
  });

  it('should filter multiple categories', () => {
    const r = scanner.filterTasks(tasks, ['coding','writing']);
    assert.strictEqual(r.length, 3);
  });

  it('should return empty for no match', () => {
    const r = scanner.filterTasks(tasks, ['design']);
    assert.strictEqual(r.length, 0);
  });

  it('should be case-insensitive', () => {
    const r = scanner.filterTasks(tasks, ['CODING']);
    assert.strictEqual(r.length, 2);
  });
});
