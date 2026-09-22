// Stub za 'server-only' paket v vitest okolju.
// Pravi paket vrže error ob importu izven react-server condicije
// (Next.js build guard); v testih tega ne želimo — tests tečejo v
// node/jsdom okolju in server-only guard tam nima pomena.
export {}
