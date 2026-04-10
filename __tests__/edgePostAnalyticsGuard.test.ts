import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:\\Users\\aboda\\Downloads\\sbrandops---v1.0541\\supabase\\functions';
const ALLOWED_DIRECT_WRITE_FILE = 'C:\\Users\\aboda\\Downloads\\sbrandops---v1.0541\\supabase\\functions\\_shared\\postAnalytics.ts';
const DIRECT_WRITE_PATTERNS = [
    ".from('post_analytics')",
    '.from(\"post_analytics\")',
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
