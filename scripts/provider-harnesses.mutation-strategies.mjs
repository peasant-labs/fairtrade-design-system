const STRATEGIES = Object.freeze({
  'graph-turn-invalid-fallback': (source, mutation, mutateRegion) => mutateRegion(
    source,
    mutation,
    'src/ui/transcript/graph/GraphTurnNode.jsx',
    /([A-Za-z_$][\w$]*) === void 0 \? "amber" : ([A-Za-z_$][\w$]*)\(\1\)/,
    (_match, provider, accent) => `${provider} === void 0 || ${provider} === "google" ? "amber" : ${accent}(${provider})`,
  ),
  'omit-strike-inventory': (source, mutation, mutateRegion) => mutateRegion(
    source,
    mutation,
    'src/ui/provider-policy.js',
    /Object\.freeze\(Object\.values\(([A-Za-z_$][\w$]*)\)\)/,
    (_match, inventory) => `Object.freeze(Object.values(${inventory}).filter((value) => value !== "strike"))`,
  ),
  'accept-arbitrary-string': (source, mutation, mutateRegion) => mutateRegion(
    source,
    mutation,
    'src/ui/provider-policy.js',
    /if \(([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*)\)\) return;/,
    (_match, _predicate, value) => `if (typeof ${value} === "string") return;`,
  ),
  'mutate-strike-display-name': (source, mutation, mutateRegion) => mutateRegion(
    source,
    mutation,
    'src/ui/provider-policy.js',
    /strike: "Strike"/,
    'strike: "Agent"',
  ),
  'mutate-strike-brand': (source, mutation, mutateRegion) => mutateRegion(
    source,
    mutation,
    'src/ui/provider-policy.js',
    /strike: "strike"/,
    'strike: "openai"',
  ),
  'mutate-strike-accent': (source, mutation, mutateRegion) => mutateRegion(
    source,
    mutation,
    'src/ui/provider-policy.js',
    /strike: "clay"/,
    'strike: "amber"',
  ),
  'mutate-strike-mark': (source, mutation, mutateRegion) => mutateRegion(
    source,
    mutation,
    'src/ui/BrandMark.jsx',
    /M18\.5 6L11 17\.5h5\.2L13\.5 26 21 14\.5h-5\.2L18\.5 6z/,
    'M18.5 7L11 17.5h5.2L13.5 26 21 14.5h-5.2L18.5 7z',
  ),
})

export const PROVIDER_MUTATION_STRATEGY_NAMES = Object.freeze(Object.keys(STRATEGIES))

export function applyProviderMutationStrategy(source, mutation, mutateRegion) {
  const apply = STRATEGIES[mutation.strategy]
  if (!apply) {
    throw new Error(
      `${mutation.name}: unsupported production mutation strategy ${JSON.stringify(mutation.strategy)} in ` +
      'scripts/provider-harnesses.mutation-strategies.mjs; add an executable strategy there before referencing it in the manifest.',
    )
  }
  return apply(source, mutation, mutateRegion)
}
