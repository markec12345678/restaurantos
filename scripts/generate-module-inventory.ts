// ============================================
// GENERATOR: docs/MODULE-INVENTORY.md (§6 — epic #144, R173)
// ============================================
//
// Izvira iz src/lib/modules/registry.ts (single source of truth) in
// generira človeku berljiv inventar vseh modulov (dinamično — R175: 76).
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
lines.push(`> Vir resnice: \`src/lib/modules/registry.ts\` (${MODULE_REGISTRY.length} modulov × §6 metadata).`)
lines.push('> Drift-gate: `tests/unit/lib/module-registry.test.ts` (register ≡ navItems ≡ moduleComponents ≡ i18n ×5).')
lines.push('')

// R175: številke DINAMIČNO iz registerja (prej hardcodirane — drift-gate je ulovil 75-vs-76)
const permCount = MODULE_REGISTRY.filter((m) => m.permission).length
const adminOnlyCount = MODULE_REGISTRY.filter((m) => m.adminOnly === true).length
const coreCount = MODULE_REGISTRY.filter((m) => m.priority === 'core').length
const secondaryCount = MODULE_REGISTRY.filter((m) => m.priority === 'secondary').length
const longTailCount = MODULE_REGISTRY.filter((m) => m.priority === 'long-tail').length
lines.push(`**${MODULE_REGISTRY.length} modulov** · ${MODULE_GROUPS.length} skupin · 6 domen · ${permCount} permission + ${adminOnlyCount} adminOnly · ${coreCount} core / ${secondaryCount} secondary / ${longTailCount} long-tail`)
lines.push('')

for (const group of MODULE_GROUPS) {
  const mods = MODULE_REGISTRY.filter((m) => m.group === group.id)
  const domain = DOMAIN_BY_GROUP[group.id as ModuleGroupId]
  lines.push(`## ${group.label} (\`${group.id}\` · domena: \`${domain}\` · ${mods.length})`)
  lines.push('')
  lines.push('| Modul | Naziv (sl) | Dostop | Prioriteta | Mobilno | Povezani |')
  lines.push('|---|---|---|---|---|---|')
  for (const m of mods) {
    const name = tFor('sl', m.labelKey)
    const related = m.relatedModules.map((r) => `\`${r}\``).join(', ')
    const mobile = m.mobile ? '✓' : '—'
    lines.push(`| \`${m.id}\` | ${name} | ${accessLabel(m)} | ${priorityLabel[m.priority]} | ${mobile} | ${related} |`)
  }
  lines.push('')
}

lines.push('## Legenda')
lines.push('')
lines.push('- **Dostop**: `admin/manager` = adminOnly; sicer zahtevano dovoljenje (`take_orders`, `manage_cash`, `manage_employees`, `view_reports`). Vrata: `canAccessModule()` (Sidebar semantika).')
lines.push('- **Prioriteta**: `core` = Golden Path semena (epic #144 §7); `long-tail` = specialistični moduli; `secondary` = ostalo. Sodbe se spreminjajo z rundami (glej register header).')
lines.push('- **Domena**: groba izpeljava iz skupine (`DOMAIN_BY_GROUP`) — za cockpite/IA (P0 korak 4+).')
lines.push('- **Mobilno** (IA runda R174): `✓` = operativno na mobilnem/tablici; `—` = back-office desktop sodba (12 modulov; invarianta: `—` ⇒ adminOnly ∨ long-tail).')
lines.push('- Standalone ruta: samo `driver` → `/driver` (ostali moduli živijo v in-app POS plasteh).')
lines.push('')

writeFileSync(OUT, lines.join('\n'), 'utf-8')
const total = MODULE_REGISTRY.length
console.log(`[inventory] docs/MODULE-INVENTORY.md regeneriran (${total} modulov, ${MODULE_GROUPS.length} skupin).`)
