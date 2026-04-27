import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, '..');
const ROOT = join(REPO_ROOT, 'supabase', 'functions');
const ALLOWED_DIRECT_WRITE_FILE = join(ROOT, '_shared', 'postAnalytics.ts');
const DIRECT_WRITE_PATTERNS = [
    ".from('post_analytics')",
    '.from("post_analytics")',
];

function walk(dir: string): string[] {
    const entries = readdirSync(dir);
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
            files.push(...walk(fullPath));
            continue;
        }

        if (fullPath.endsWith('.ts')) {
            files.push(fullPath);
        }
    }

    return files;
}

describe('edge post analytics guard', () => {
    it('disallows direct post_analytics writes outside the shared helper', () => {
        const offenders = walk(ROOT).filter((filePath) => {
            if (filePath === ALLOWED_DIRECT_WRITE_FILE) {
                return false;
            }

            const contents = readFileSync(filePath, 'utf8');
            return DIRECT_WRITE_PATTERNS.some((pattern) => contents.includes(pattern));
        });

        expect(offenders).toEqual([]);
    });
});
