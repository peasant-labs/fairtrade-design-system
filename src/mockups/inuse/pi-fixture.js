import YAML from 'yaml'
import source from '../../../scripts/testdata/pi-transcript.yaml?raw'
import { parseSessionDetailPayloadValue } from '@peasant-labs/schema'

// Synthetic public fixture shared by the mounted demo, stories, and runtime gates.
export const piPayload = parseSessionDetailPayloadValue(YAML.parse(source).payload)
