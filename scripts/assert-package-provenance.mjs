#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { assertPackageProvenanceMetadata } from './package-provenance.mjs'

const manifestUrl = new URL('../package.json', import.meta.url)
const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'))
assertPackageProvenanceMetadata(manifest)

console.log('Package provenance metadata check passed for peasant-labs/fairtrade-design-system.')
