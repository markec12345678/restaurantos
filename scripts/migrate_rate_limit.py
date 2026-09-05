#!/usr/bin/env python3
"""Migrate all sync checkRateLimit() calls to async checkRateLimitAsync() with await."""
import os, re, glob

# Find all files with checkRateLimit( (not checkRateLimitAsync)
base = '/home/z/my-project/src'
files_to_migrate = []

for root, dirs, files in os.walk(base):
    for f in files:
        if f.endswith('.ts') or f.endswith('.tsx'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r') as fh:
                content = fh.read()
            # Find checkRateLimit( but NOT checkRateLimitAsync
            if 'checkRateLimit(' in content and 'checkRateLimitAsync' not in content.split('checkRateLimit(')[0].split('\n')[-1]:
                files_to_migrate.append(filepath)

print(f'Found {len(files_to_migrate)} files to migrate')

for filepath in files_to_migrate:
    with open(filepath, 'r') as fh:
        content = fh.read()
    
    original = content
    
    # Replace: checkRateLimit( → checkRateLimitAsync(  (but not checkRateLimitAsync already)
    # Also need to add 'await' before the call
    # Pattern: const rl = checkRateLimit(  →  const rl = await checkRateLimitAsync(
    # Pattern: const rateCheck = checkRateLimit(  →  const rateCheck = await checkRateLimitAsync(
    # Pattern: const rateLimit = checkRateLimit(  →  const rateLimit = await checkRateLimitAsync(
    
    # Replace all occurrences
    content = re.sub(
        r'=\s*checkRateLimit\(',
        r'= await checkRateLimitAsync(',
        content
    )
    
    # Update import: checkRateLimit → checkRateLimitAsync
    # If import has checkRateLimit but not checkRateLimitAsync
    if 'checkRateLimit' in content and 'checkRateLimitAsync' not in content:
        # Replace import
        content = content.replace('checkRateLimit,', 'checkRateLimitAsync,')
        content = content.replace('checkRateLimit }', 'checkRateLimitAsync }')
        content = content.replace('{ checkRateLimit }', '{ checkRateLimitAsync }')
        content = content.replace("from '@/lib/rate-limit'", "from '@/lib/rate-limit'")
    
    if content != original:
        with open(filepath, 'w') as fh:
            fh.write(content)
        # Count changes
        changes = original.count('checkRateLimit(') - content.count('checkRateLimit(')
        print(f'  Migrated: {filepath} ({changes} call-sites)')

print('\nMigration complete!')
