#!/usr/bin/env node
// @ts-check

// Fairtest local dev bridge: the optional, local-only `fairtest dev` command.
//
// Invocation: pnpm fairtest dev -- --target=product [--theme=dark|light] [--attach] [--once]
//
// It selects the exact adapter and target the mounted proof selects (no second
// registry), starts only the declared loopback service through the shared
// adapter lifecycle, generates a local invocation identity that can never
// claim producer identity, and prints the URL, scenario, route, fixture,
// action, provenance, and the declared local-only CI status. When `--attach`
// is passed it additionally prints a copy-paste attach instruction for an
// already-installed agent-browser; this command never imports, installs, or
// invokes that tool, and it is never a required CI step, CI oracle, or evidence
// path. On SIGINT/SIGTERM it releases the service and prints a validated
// cleanup receipt.
//
// REQUIRED-CI MOUNT: LOCAL-ONLY. No required workflow invokes this command.
// Interactive exploration is never a reason to promote a browser test.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { importFairtestSource } from '../fairtest-source.mjs'
import { FAIRTEST_APP_HOST, FAIRTEST_APP_PORT, FAIRTEST_REPO_ROOT, FAIRTEST_STORYBOOK_PORT } from './fairtest-runtime.mjs'
import { createAdapter } from './fairtrade-adapter.mjs'
import { PRODUCT_TARGET, productThemeRow } from './fairtrade-targets.mjs'
import { COMPONENT_TARGET, componentThemeRow } from './fairtrade-component-target.mjs'
import { FAIRTEST_PROJECT } from './run-envelope-contract.mjs'

const localBridge = await importFairtestSource('src/bridge/local.mjs')

/**
 * How long the shared adapter waits for the declared service to acquire its
 * loopback channel before the partial start is cleaned up and refused.
 * @type {number}
 */
export const DEV_START_TIMEOUT_MS = Number(process.env.FAIRTEST_DEV_START_TIMEOUT_MS || 15000)

/**
 * The declared targets this command accepts, in the order the mounted proof
 * declares them. The keys are the only accepted `--target` values; the values
 * stay product/component so no second target registry is introduced.
 * @type {Record<string, string>}
 */
export const DEV_TARGETS = Object.freeze({ product: 'product', component: 'component' })

/**
 * The declared themes this command accepts for the single local row.
 * @type {readonly string[]}
 */
export const DEV_THEMES = Object.freeze(['dark', 'light'])

/**
 * What this command is. `status: 'local-only'` is the observable statement
 * that no required workflow invokes it; it is interactive exploration, never
 * a CI oracle or evidence path.
 * @type {{ status: string, enforcedBy: string, reason: string }}
 */
export const DEV_REQUIRED_CI_MOUNT = Object.freeze({
  status: 'local-only',
  enforcedBy: 'no required CI workflow',
  reason: 'fairtest dev is interactive local exploration only, so it is never a CI oracle, CI step, or evidence path',
})

/**
 * Build the target spec for one declared target. The route, served root, and
 * provenance source come from the exact target module the mounted proof uses,
 * so the local bridge and the mounted row can never select different targets.
 * @param {unknown} target product or component
 * @returns {{ target: object, kind: string, targetId: string, source: string, root: string, route: string, port: number, driverImport: string, driverFactory: string }}
 */
export function devTargetSpec(target) {
  if (target === DEV_TARGETS.product) {
    return Object.freeze({
      target: PRODUCT_TARGET,
      kind: PRODUCT_TARGET.kind,
      targetId: PRODUCT_TARGET.id,
      source: 'dist',
      root: join(FAIRTEST_REPO_ROOT, 'dist'),
      route: productThemeRow('dark').route,
      port: FAIRTEST_APP_PORT,
      driverImport: './product-producer.mjs',
      driverFactory: 'createProductStaticDriver',
    })
  }
  if (target === DEV_TARGETS.component) {
    return Object.freeze({
      target: COMPONENT_TARGET,
      kind: COMPONENT_TARGET.kind,
      targetId: COMPONENT_TARGET.id,
      source: 'storybook-static',
      root: join(FAIRTEST_REPO_ROOT, 'storybook-static'),
      route: componentThemeRow('dark').url,
      port: FAIRTEST_STORYBOOK_PORT,
      driverImport: './component-producer.mjs',
      driverFactory: 'createComponentStaticDriver',
    })
  }
  throw new Error(
    `fairtest dev: unknown target ${JSON.stringify(target)} for field "target" at path cli.target; ` +
    `repair: use one of ${Object.keys(DEV_TARGETS).join(', ')} for "target".`,
  )
}

/**
 * Return the route for one declared target and theme. A component light row
 * carries the light global; the product row carries the app-owned theme query.
 * @param {string} target product or component
 * @param {string} theme dark or light
 * @returns {string} the served route for the row
 */
export function devRouteFor(target, theme) {
  if (!DEV_THEMES.includes(theme)) {
    throw new Error(
      `fairtest dev: unknown theme ${JSON.stringify(theme)} for field "theme" at path cli.theme; ` +
      `repair: use one of ${DEV_THEMES.join(', ')} for "theme".`,
    )
  }
  return target === DEV_TARGETS.component ? componentThemeRow(theme).url : productThemeRow(theme).route
}

/**
 * Parse and validate the `fairtest dev` arguments. A leading `dev` subcommand
 * and a `--` separator are both accepted so the command resolves identically
 * whether it is run through the `fairtest` package script or directly.
 * @param {string[]} args command arguments
 * @returns {{ target: string, theme: string, attach: boolean, once: boolean }}
 */
export function parseDevArgs(args) {
  let target = null
  let theme = 'dark'
  let attach = false
  let once = false
  let subcommandSeen = false
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--') continue
    if (arg === 'dev') {
      subcommandSeen = true
      continue
    }
    if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length)
    } else if (arg === '--target' && index + 1 < args.length) {
      target = args[index + 1]
      index += 1
    } else if (arg.startsWith('--theme=')) {
      theme = arg.slice('--theme='.length)
    } else if (arg === '--theme' && index + 1 < args.length) {
      theme = args[index + 1]
      index += 1
    } else if (arg === '--attach') {
      attach = true
    } else if (arg === '--once') {
      once = true
    } else {
      throw new Error(
        `fairtest dev: unknown argument ${JSON.stringify(arg)} for field "args" at path cli.args; ` +
        'repair: run with -- --target=product|component, optional --theme=dark|light, --attach, or --once.',
      )
    }
  }
  if (!subcommandSeen && args.length > 0 && !args[0].startsWith('--')) {
    throw new Error(
      `fairtest dev: unknown subcommand ${JSON.stringify(args[0])} for field "subcommand" at path cli.subcommand; ` +
      'repair: run the dev subcommand only, as pnpm fairtest dev -- --target=product.',
    )
  }
  if (target === null) {
    throw new Error(
      'fairtest dev: missing target for field "target" at path cli.target; ' +
      'repair: run with -- --target=product or -- --target=component.',
    )
  }
  devTargetSpec(target)
  if (!DEV_THEMES.includes(theme)) {
    throw new Error(
      `fairtest dev: unknown theme ${JSON.stringify(theme)} for field "theme" at path cli.theme; ` +
      `repair: use one of ${DEV_THEMES.join(', ')} for "theme".`,
    )
  }
  return { target, theme, attach, once }
}

/**
 * Generate a fresh local id matching the shared identity pattern.
 * @param {string} prefix id prefix
 * @returns {string} the generated local id
 */
export function generateLocalId(prefix) {
  return `${prefix}-${randomBytes(4).toString('hex')}`
}

/**
 * Read the local provenance of the served tree. The commit and dirtiness are
 * read with git when available and reported as unknown otherwise, so the
 * readout is still useful outside a git checkout.
 * @returns {{ commit: string, dirty: boolean }}
 */
export function readLocalGitProvenance() {
  try {
    const commit = execFileSync('git', ['-C', FAIRTEST_REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const dirty = execFileSync('git', ['-C', FAIRTEST_REPO_ROOT, 'status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0
    return { commit: commit || 'unknown', dirty }
  } catch {
    return { commit: 'unknown', dirty: false }
  }
}

/**
 * Report whether the fixed loopback channel can be bound again, by binding and
 * immediately releasing a throwaway listener on the same host.
 * @param {number} port loopback port to probe
 * @returns {Promise<boolean>} true when the channel was released
 */
export function isLoopbackPortFree(port) {
  return new Promise((settle) => {
    const probe = createServer()
    probe.once('error', () => settle(false))
    probe.listen(port, FAIRTEST_APP_HOST, () => probe.close(() => settle(true)))
  })
}

/**
 * The optional attach instruction. It names an already-installed agent-browser
 * as a local exploration convenience only; this command never imports,
 * installs, or invokes it, and it is never a CI or evidence path.
 * @param {string} url served URL to attach to
 * @returns {string[]} the attach instruction lines
 */
export function attachInstruction(url) {
  return [
    'optional attach: an already-installed agent-browser may point at this local target for exploration:',
    `  agent-browser open ${url}`,
    '  this is local exploration only; fairtest never imports, installs, or invokes agent-browser, and it is never a CI or evidence path.',
  ]
}

/**
 * Format the readout lines the command prints.
 * @param {{ identity: { invocationId: string, runId: string, project: string, purpose: string, targetId: string }, url: string, scenario: { route: string, fixture: string, action: string }, provenance: { source: string, root: string, commit: string, dirty: boolean } }} readout validated local readout
 * @param {{ kind: string, port: number }} context target context
 * @returns {string[]} the banner lines
 */
export function readoutLines(readout, context) {
  return [
    'fairtest dev: local bridge for the exact adapter-selected target',
    `  identity   ${readout.identity.invocationId} (run ${readout.identity.runId}, project ${readout.identity.project}, purpose ${readout.identity.purpose})`,
    `  target     ${readout.identity.targetId} (${context.kind})`,
    `  url        ${readout.url}`,
    `  scenario   route=${readout.scenario.route} fixture=${readout.scenario.fixture} action=${readout.scenario.action}`,
    `  provenance ${readout.provenance.source} root=${readout.provenance.root} commit=${readout.provenance.commit} dirty=${readout.provenance.dirty}`,
    `  service    loopback ${FAIRTEST_APP_HOST}:${context.port} (declared by fairtest-runtime.mjs, never a wildcard listener)`,
    `  required-ci mount: ${DEV_REQUIRED_CI_MOUNT.status} (${DEV_REQUIRED_CI_MOUNT.reason})`,
  ]
}

/**
 * Wait for an interrupt or termination signal, reporting the closed cleanup
 * signal name the shared contract uses.
 * @returns {Promise<string>} interrupted or terminated
 */
function waitForSignal() {
  return new Promise((settle) => {
    const onSignal = (/** @type {string} */ name) => {
      process.removeListener('SIGINT', onSignal)
      process.removeListener('SIGTERM', onSignal)
      settle(name)
    }
    process.on('SIGINT', () => onSignal('interrupted'))
    process.on('SIGTERM', () => onSignal('terminated'))
  })
}

/**
 * Load the declared driver module for one target. The driver modules pull the
 * browser-backed capture helpers, so they are imported only when a local
 * service is actually started; importing this command stays browser-free.
 * @param {{ driverImport: string, driverFactory: string }} spec target spec
 * @returns {Promise<Record<string, Function>>} the driver module
 */
async function loadDriver(spec) {
  return import(spec.driverImport)
}

/**
 * Start the declared local service and print the readout, then either release
 * immediately (`--once`) or wait for a signal before releasing.
 * @returns {Promise<number>} the process exit code
 */
async function main() {
  let options
  try {
    options = parseDevArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 2
  }
  const spec = devTargetSpec(options.target)
  const driverModule = await loadDriver(spec)
  const driver = driverModule[spec.driverFactory]({ port: spec.port, host: FAIRTEST_APP_HOST })
  const runId = generateLocalId('local')
  const invocationId = generateLocalId('local')
  const createdAtMs = Date.now()
  const adapter = await createAdapter({
    runId,
    driver,
    target: spec.target,
    createdAtMs,
  })
  const identity = localBridge.createLocalInvocationIdentity({
    purpose: 'local',
    runId,
    invocationId,
    project: FAIRTEST_PROJECT,
    targetId: adapter.targetId,
    createdAtMs,
  })
  const declaration = localBridge.createLocalBridgeDeclaration(identity, ['describe-target', 'report-readiness', 'cleanup-process'])
  const scenario = localBridge.createLocalScenario({
    route: devRouteFor(options.target, options.theme),
    fixture: adapter.declaration.fixtures[0],
    action: adapter.declaration.actions[0],
  })
  const provenance = localBridge.createLocalProvenance({
    source: spec.source,
    root: spec.root,
    ...readLocalGitProvenance(),
    producedAtMs: Date.now(),
  })
  const url = `${driver.baseUrl}${scenario.route}`
  const readout = localBridge.createLocalReadout({ identity, declaration, scenario, provenance, url })

  let signal = 'completed'
  try {
    await adapter.start({ timeoutMs: DEV_START_TIMEOUT_MS })
    await adapter.readiness()
    for (const line of readoutLines(readout, { kind: spec.kind, port: spec.port })) console.log(line)
    if (options.attach) {
      for (const line of attachInstruction(url)) console.log(line)
    }
    if (options.once) {
      console.log('  mode       once: releasing the service immediately after the readout')
    } else {
      console.log('  serve      running until SIGINT or SIGTERM; the service is released on interrupt')
      signal = await waitForSignal()
    }
  } finally {
    await adapter.teardown()
  }
  const cleanup = localBridge.validateLocalCleanup(
    {
      identityId: identity.invocationId,
      signal,
      reaped: !driver.isRunning(),
      portReleased: await isLoopbackPortFree(spec.port),
      observedAtMs: Date.now(),
    },
    identity,
    'fairtest dev',
  )
  console.log('fairtest dev: released the loopback service')
  console.log(`  cleanup    signal=${cleanup.signal} reaped=${cleanup.reaped} portReleased=${cleanup.portReleased}`)
  return 0
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().then((code) => {
    process.exitCode = code
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
