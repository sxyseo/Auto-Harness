import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  writeEnrichmentFile,
  readEnrichmentFile,
  runGarbageCollection,
} from '../enrichment-persistence';
import type { EnrichmentFile, IssueEnrichment } from '../../../../shared/types/enrichment';
import { ENRICHMENT_SCHEMA_VERSION } from '../../../../shared/constants/enrichment';
import { createDefaultEnrichment } from '../../../../shared/types/enrichment';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enrichment-gc-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runGarbageCollection', () => {
  it('marks non-matching enrichments as orphaned', async () => {
    const data: EnrichmentFile = {
      schemaVersion: ENRICHMENT_SCHEMA_VERSION,
      issues: {},
    };
    for (let i = 1; i <= 5; i++) {
      data.issues[String(i)] = createDefaultEnrichment(i);
    }

    await writeEnrichmentFile(tmpDir, data);

    // Only issues 1, 2, 3 exist on GitHub
    const result = await runGarbageCollection(tmpDir, [1, 2, 3]);

    expect(result.orphaned).toBe(2);
    expect(result.pruned).toBe(0);

    // Verify orphan markers exist
    const updated = await readEnrichmentFile(tmpDir);
    expect((updated.issues['4'] as IssueEnrichment & { _orphanedAt?: string })._orphanedAt).toBeDefined();
    expect((updated.issues['5'] as IssueEnrichment & { _orphanedAt?: string })._orphanedAt).toBeDefined();
  });

  it('does not prune orphan marked today', async () => {
    const data: EnrichmentFile = {
      schemaVersion: ENRICHMENT_SCHEMA_VERSION,
      issues: {
        '1': createDefaultEnrichment(1),
        '2': createDefaultEnrichment(2),
      },
    };

    await writeEnrichmentFile(tmpDir, data);

    // First GC marks issue 2 as orphaned
    await runGarbageCollection(tmpDir, [1]);

    // Second GC should not prune (orphan is fresh)
    const result = await runGarbageCollection(tmpDir, [1]);
    expect(result.pruned).toBe(0);
    expect(result.orphaned).toBe(1);

    const updated = await readEnrichmentFile(tmpDir);
    expect(updated.issues['2']).toBeDefined();
  });

  it('prunes orphans older than 30 days', async () => {
    const data: EnrichmentFile = {
      schemaVersion: ENRICHMENT_SCHEMA_VERSION,
      issues: {
        '1': createDefaultEnrichment(1),
        '2': {
          ...createDefaultEnrichment(2),
          _orphanedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        } as IssueEnrichment & { _orphanedAt: string },
      },
    };

    await writeEnrichmentFile(tmpDir, data);

    const result = await runGarbageCollection(tmpDir, [1]);

    expect(result.pruned).toBe(1);
    expect(result.orphaned).toBe(0);

    const updated = await readEnrichmentFile(tmpDir);
    expect(updated.issues['2']).toBeUndefined();
  });

  it('does not prune when GitHub returns 0 issues', async () => {
    const data: EnrichmentFile = {
      schemaVersion: ENRICHMENT_SCHEMA_VERSION,
      issues: {
        '1': createDefaultEnrichment(1),
        '2': createDefaultEnrichment(2),
      },
    };

    await writeEnrichmentFile(tmpDir, data);

    const result = await runGarbageCollection(tmpDir, []);

    expect(result.pruned).toBe(0);
    expect(result.orphaned).toBe(0);

    const updated = await readEnrichmentFile(tmpDir);
    expect(Object.keys(updated.issues)).toHaveLength(2);
  });

  it('returns correct counts', async () => {
    const data: EnrichmentFile = {
      schemaVersion: ENRICHMENT_SCHEMA_VERSION,
      issues: {
        '1': createDefaultEnrichment(1),
        '2': createDefaultEnrichment(2),
        '3': {
          ...createDefaultEnrichment(3),
          _orphanedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        } as IssueEnrichment & { _orphanedAt: string },
      },
    };

    await writeEnrichmentFile(tmpDir, data);

    const result = await runGarbageCollection(tmpDir, [1]);

    // Issue 2 = newly orphaned, issue 3 = pruned (>30 days old)
    expect(result.orphaned).toBe(1);
    expect(result.pruned).toBe(1);
  });
});
