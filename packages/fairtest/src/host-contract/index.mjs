// Host-contract barrel. Re-exports the type-only and value-validation seam
// for later app-owned adapters: closed kind and theme vocabulary, target
// declarations, lifecycle traces, the resolution proof union, opaque
// handles, and bridge identity/readiness/cleanup records. No adapter,
// browser runtime, route, selector, or fixture data is added at this layer.

export { HOST_KINDS, THEME_NAMES, assertHostKind, validateThemeObservation } from './kinds.mjs'
export {
  COMPONENT_CAPABILITIES,
  COMPONENT_REQUIRED_CAPABILITIES,
  PRODUCT_CAPABILITIES,
  PRODUCT_REQUIRED_CAPABILITIES,
  capabilitiesFor,
  createTargetDeclaration,
  requiredCapabilitiesFor,
  requiresCapability,
  validateCapabilityList,
  validateNameList,
  validateTargetDeclaration,
  validateTargetIdentity,
} from './targets.mjs'
export {
  PRODUCT_ONLY_FIELDS,
  validateComponentResolution,
  validateMountedRoot,
  validateNamedResult,
  validateObservedPart,
  validateProductResolution,
  validateResolution,
} from './resolution.mjs'
export { LIFECYCLE_STAGES, validateLifecycleTrace } from './lifecycle.mjs'
export { validateOpaqueHandle } from './handles.mjs'
export {
  BRIDGE_CAPABILITIES,
  BRIDGE_IDENTITY_KINDS,
  BRIDGE_REQUIRED_CAPABILITIES,
  BRIDGE_SIGNALS,
  assertBridgeKind,
  createBridgeDeclaration,
  requiresBridgeCapability,
  validateBridgeCapabilities,
  validateBridgeCleanup,
  validateBridgeDeclaration,
  validateBridgeIdentity,
  validateBridgeReadiness,
  validateCoreIdentityForBridge,
} from './bridge.mjs'
