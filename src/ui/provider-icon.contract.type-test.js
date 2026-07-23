// @ts-check

import { Harness } from '@peasant-labs/schema'
import {
  AccentLegend,
  HARNESSES,
  PROVIDER_ACCENT,
  ProviderIcon,
  ProviderName,
  ProviderTag,
} from './ProviderIcon.jsx'
import { providerAccent, providerDisplayName } from './index.js'
import { providerLabel } from './commons/providers.js'

for (const harness of Object.values(Harness)) {
  ProviderIcon({ harness })
  ProviderTag({ harness })
  ProviderName({ harness })
  const accent = PROVIDER_ACCENT[harness]
  void accent
  providerAccent(harness)
}

/** @type {readonly import('@peasant-labs/schema').Harness[]} */
const canonicalHarnesses = HARNESSES
void canonicalHarnesses
AccentLegend({})
providerDisplayName(Harness.Antigravity)
providerAccent(Harness.Antigravity)
providerLabel(Harness.Antigravity)

// @ts-expect-error arbitrary strings must be validated before entering display APIs
ProviderIcon({ harness: 'unknown-provider' })

// @ts-expect-error a widened string cannot bypass the canonical Harness boundary
ProviderTag({ harness: /** @type {string} */ ('antigravity') })

// @ts-expect-error browser/provider names are not harness wire values
ProviderName({ harness: 'google' })

// @ts-expect-error canonical display names never accept generic provider prose
providerDisplayName('google')

// @ts-expect-error canonical accents never accept arbitrary provider prose
providerAccent('google')

// @ts-expect-error commons cannot silently relabel an unknown Harness
providerLabel('google')
