// Skupni tipi za seed-food-norms helperje
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InvItem = Record<string, any> & { id: string }
export type InvMap = Record<string, InvItem>
export type CatMap = Record<string, { id: string }>
