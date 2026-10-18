// @ts-check
import React from 'react'
import { VillageObservations, LOCAL_APP_SECTIONS, GraphSectionNav } from './index.js'
import { VillageObservations as UiObservations } from '../index.js'
/** @type {import('./index.js').VillageObservationsProps} */
const props = { accountLabel: 'Developer', villageLabel: 'Village', domains: [], collectives: [], categories: [], onPageChange: (id, page) => { id.toUpperCase(); page.toFixed() } }
React.createElement(VillageObservations, props)
React.createElement(UiObservations, props)
React.createElement(GraphSectionNav, { sections: [{ id: 'custom-route', label: 'custom route', inNav: true }] })
LOCAL_APP_SECTIONS.map((section) => section.id.toUpperCase())
// @ts-expect-error presentation rows require string outcomes
const invalid = /** @type {import('../VillageObservations.jsx').ContributionEvidenceRow} */ ({ id: 'r', title: 'Title', outcome: 1 })
void invalid
