import ar from './locales/ar';
import en from './locales/en';

function compareObjects(obj1: any, obj2: any, path: string = '', missing: string[] = []): string[] {
    const keys1 = Object.keys(obj1 || {});
    const keys2 = Object.keys(obj2 || {});

    // Check for keys in obj2 (en) that are missing in obj1 (ar)
    for (const key of keys2) {
        const currentPath = path ? `${path}.${key}` : key;

        if (!(key in obj1)) {
            missing.push(currentPath);
        } else if (typeof obj2[key] === 'object' && typeof obj1[key] === 'object') {
            compareObjects(obj1[key], obj2[key], currentPath, missing);
        }
    }

    return missing;
}

console.log('🔍 Verifying locale files...\n');

// Check if imports worked
if (!ar || !en) {
    console.error('❌ Failed to import locale files');
    process.exit(1);
}

console.log('✅ Both locale files imported successfully\n');

// Compare ar against en (find missing keys in ar)
const missingInAr = compareObjects(ar, en, '', []);

if (missingInAr.length > 0) {
    console.log(`❌ Found ${missingInAr.length} missing keys in ar.ts:\n`);
    missingInAr.forEach(key => console.log(`   - ${key}`));
    console.log('\n');
} else {
    console.log('✅ No missing keys in ar.ts\n');
}

// Compare en against ar (find extra keys in ar)
const missingInEn = compareObjects(en, ar, '', []);

if (missingInEn.length > 0) {
    console.log(`⚠️  Found ${missingInEn.length} extra keys in ar.ts that don't exist in en.ts:\n`);
    missingInEn.forEach(key => console.log(`   - ${key}`));
    console.log('\n');
} else {
    console.log('✅ No extra keys in ar.ts\n');
}

if (missingInAr.length === 0 && missingInEn.length === 0) {
    console.log('🎉 Locale files are perfectly synchronized!\n');
    process.exit(0);
} else {
    console.log('❌ Locale files need synchronization\n');
    process.exit(1);
}
