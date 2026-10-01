// Skupni tipi za seed-food-norms helperje
// R192: Record<string, unknown> — uporaba bere samo .id (string)
export type InvItem = Record<string, unknown> & { id: string }
export type InvMap = Record<string, InvItem>
export type CatMap = Record<string, { id: string }>
