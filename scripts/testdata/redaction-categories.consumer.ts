import {
  RedactionCategory, RedactionCategoryLabel,
  AllRedactionCategories, AllRedactionCategoryLabels,
  isRedactionCategory, parseRedactionCategory, parseRedactionCategoryLabel,
  redactionCategoryFromLabel, redactionCategoryLabel,
  RedactionReview, PublishDialog,
} from '@peasant-labs/fairtrade/ui'

const category: RedactionCategory = RedactionCategory.Secrets
const label: RedactionCategoryLabel = RedactionCategoryLabel.Credential
const categories: readonly RedactionCategory[] = AllRedactionCategories
const labels: readonly RedactionCategoryLabel[] = AllRedactionCategoryLabels
const converted: RedactionCategory = redactionCategoryFromLabel(label)
const displayed: RedactionCategoryLabel = redactionCategoryLabel(category)
declare const raw: unknown
declare const arbitrary: string
const parsed: RedactionCategory = parseRedactionCategory(raw)
const parsedLabel: RedactionCategoryLabel = parseRedactionCategoryLabel(raw)
if (isRedactionCategory(raw)) {
  const narrowed: RedactionCategory = raw
  redactionCategoryLabel(narrowed)
}
// @ts-expect-error raw data must pass boundary validation
redactionCategoryLabel(raw)
// @ts-expect-error arbitrary strings cannot bypass boundary validation
redactionCategoryFromLabel(arbitrary)
// @ts-expect-error categories and labels are not interchangeable
redactionCategoryFromLabel(category)
// @ts-expect-error labels cannot enter the category converter
redactionCategoryLabel(label)
// @ts-expect-error review matches require semantic categories, not engine labels
const invalidMatch: NonNullable<Parameters<typeof RedactionReview>[0]['matches']>[number] = { id: 'bad', category: label, confidence: 1, after: 'redacted' }
// @ts-expect-error publish scans also require semantic categories
const invalidScan: NonNullable<Parameters<typeof PublishDialog>[0]['scan']> = { matches: [{ id: 'bad', category: label, confidence: 1, after: 'redacted' }] }
void [categories, labels, converted, displayed, parsed, parsedLabel, invalidMatch, invalidScan]
