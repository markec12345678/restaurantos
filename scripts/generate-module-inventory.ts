// ============================================
// GENERATOR: docs/MODULE-INVENTORY.md (§6 — epic #144, R173)
// ============================================
//
// Izvira iz src/lib/modules/registry.ts (single source of truth) in
// generira človeku berljiv inventar vseh 75 modulov.
//
// DETERMINISTIČNO: brez timestampov / naključja — regeneracija na istem
// drevesu je BITNIČNO ENAKA (gate: `bun run inventory && git diff --exit-code
// docs/MODULE-INVENTORY.md`). Dokumenta NE urejati ročno — spremeni register
// in regeneriraj.
//
// Zaženi: bun run inventory   (= npx tsx scripts/generate-module-inventory.ts)
// ============================================

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MODULE_REGISTRY,
  MODULE_GROUPS,
  DOMAIN_BY_GROUP,
  type ModuleGroupId,
} from '../src/lib/modules/registry'
import { tFor } from '../src/lib/i18n'

const OUT = join(process.cwd(), 'docs', 'MODULE-INVENTORY.md')

const accessLabel = (m: { adminOnly?: boolean; permission?: string }): string =>
  m.adminOnly ? 'admin/manager' : (m.permission ?? '—')

const priorityLabel: Record<string, string> = {
  core: '🥇 core',
  secondary: 'secondary',
  'long-tail': 'long-tail',
}

const lines: string[] = []

lines.push('# MODULE-INVENTORY (§6)')
lines.push('')
lines.push('> ⚙️ GENERIRANO z `scripts/generate-module-inventory.ts` (bun run inventory) — **NE urejati ročno**.')
lines.push('> Vir resnice: `src/lib/modules/registry.ts` (75 modulov × §6 metadata).')
lines.push('> Drift-gate: `tests/unit/lib/module-registry.test.ts` (register ≡ navItems ≡ moduleComponents ≡ i18n ×5).')
lines.push('')

lines.push('**75 modulov** · 7 skupin · 6 domen · 43 permission + 32 adminOnly · 12 core / 49 secondary / 14 long-tail')
lines.push('')

for (const group of MODULE_GROUPS) {
  const mods = MODULE_REGISTRY.filter((m) => m.group === group.id)
  const domain = DOMAIN_BY_GROUP[group.id as ModuleGroupId]
  lines.push(`## ${group.label} (\`${group.id}\` · domena: \`${domain}\` · ${mods.length})`)
  lines.push('')
  lines.push('| Modul | Naziv (sl) | Dostop | Prioriteta | Povezani |')
  lines.push('|---|---|---|---|---|')
  for (const m of mods) {
    const name = tFor('sl', m.labelKey)
    const related = m.relatedModules.map((r) => `\`${r}\``).join(', ')
    lines.push(`| \`${m.id}\` | ${name} | ${accessLabel(m)} | ${priorityLabel[m.priority]} | ${related} |`)
  }
  lines.push('')
}

lines.push('## Legenda')
lines.push('')
lines.push('- **Dostop**: `admin/manager` = adminOnly; sicer zahtevano dovoljenje (`take_orders`, `manage_cash`, `manage_employees`, `view_reports`). Vrata: `canAccessModule()` (Sidebar semantika).')
lines.push('- **Prioriteta**: `core` = Golden Path semena (epic #144 §7); `long-tail` = specialistični moduli; `secondary` = ostalo. Sodbe se spreminjajo z rundami (glej register header).')
lines.push('- **Domena**: groba izpeljava iz skupine (`DOMAIN_BY_GROUP`) — za cockpite/IA (P0 korak 4+).')
lines.push('- Standalone ruta: samo `driver` → `/driver` (ostali moduli živijo v in-app POS plasteh).')
lines.push('')

writeFileSync(OUT, lines.join('\n'), 'utf-8')
const total = MODULE_REGISTRY.length
console.log(`[inventory] docs/MODULE-INVENTORY.md regeneriran (${total} modulov, ${MODULE_GROUPS.length} skupin).`)
