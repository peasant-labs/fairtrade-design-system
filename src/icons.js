// @peasant-labs/fairtrade/icons
//
// Passthrough re-export of lucide-react so consumers (e.g. peasant, village)
// import icons through the shared fairtrade copy instead of declaring their own
// lucide-react dependency. lucide-react stays a fairtrade dependency and is kept
// EXTERNAL by the lib build (see vite.lib.config.js), so the consumer's bundler
// tree-shakes only the named icons it actually imports.
//
// `export *` re-exports every named icon plus createLucideIcon.
export * from 'lucide-react'
