#!/usr/bin/env python3
"""Fix Group 1: Replace direct locationId from searchParams with resolveTenantLocationId."""
import re, os

FILES = [
    'src/app/api/cash-register/route.ts',
    'src/app/api/devices/route.ts',
    'src/app/api/accounting/accounts-payable/route.ts',
    'src/app/api/accounting/accounts-receivable/route.ts',
    'src/app/api/delivery-zones/route.ts',
    'src/app/api/tip-pool/route.ts',
    'src/app/api/staff-shifts/_helpers.ts',
    'src/app/api/z-report/route.ts',
]

for filepath in FILES:
    fullpath = os.path.join('/home/z/my-project', filepath)
    with open(fullpath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Add import for resolveTenantLocationId
    if 'resolveTenantLocationId' not in content:
        # Find the last import from auth-middleware
        if "from '@/lib/auth-middleware'" in content:
            content = content.replace(
                "from '@/lib/auth-middleware'",
                "from '@/lib/auth-middleware'\nimport { resolveTenantLocationId } from '@/lib/auth-middleware/tenant-scope'"
            )
        elif "from '../auth-middleware'" in content:
            content = content.replace(
                "from '../auth-middleware'",
                "from '../auth-middleware'\nimport { resolveTenantLocationId } from '@/lib/auth-middleware/tenant-scope'"
            )
        else:
            # Add after first import
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith("import ") and i > 0 and not lines[i-1].startswith("import "):
                    lines.insert(i, "import { resolveTenantLocationId } from '@/lib/auth-middleware/tenant-scope'")
                    break
            content = '\n'.join(lines)
    
    # Replace: const locationId = searchParams.get('locationId')
    # With: const locationId = resolveTenantLocationId(authResult, searchParams)
    content = re.sub(
        r"const locationId = (?:url\.)?searchParams\.get\('locationId'\)",
        "const locationId = resolveTenantLocationId(authResult, searchParams ?? null)",
        content
    )
    
    # Also handle url.searchParams variant
    content = re.sub(
        r"const locationId = url\.searchParams\.get\('locationId'\)",
        "const locationId = resolveTenantLocationId(authResult, url.searchParams)",
        content
    )
    
    if content != original:
        with open(fullpath, 'w') as f:
            f.write(content)
        print(f"  Fixed: {filepath}")
    else:
        print(f"  No change: {filepath}")

print("\nGroup 1 done!")
