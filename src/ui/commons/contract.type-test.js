// @ts-check
/* Contract type-test for the commons surface payloads (Explore, Manage). It
   imports the ACTUAL production sub-barrel (the surface every adapter + surface
   slice imports) and asserts, at the type level, the load-bearing guarantees of
   the cooked prop payloads — in particular the governance role typing. Enforced
   by:
     pnpm test:contract
   which runs: tsc -p tsconfig.contract.json (strict:true, noImplicitAny:true,
   noEmit). This file + types.js are wired into that program, so a contract leak
   — or a SYNTAX error in types.js — FAILS the build gate. */

/** @typedef {import('./index.js').TranscriptVisibility} TranscriptVisibility */
/** @typedef {import('./index.js').AcceptanceMode} AcceptanceMode */
/** @typedef {import('./index.js').DataAccessPolicy} DataAccessPolicy */
/** @typedef {import('./index.js').TranscriptDeletionPolicy} TranscriptDeletionPolicy */
/** @typedef {import('./index.js').CollectiveRole} CollectiveRole */
/** @typedef {import('./index.js').ViewerRole} ViewerRole */
/** @typedef {import('./index.js').ExploreSurfaceProps} ExploreSurfaceProps */
/** @typedef {import('./index.js').CollectiveMemberPayload} CollectiveMemberPayload */
/** @typedef {import('./index.js').ExplorePayload} ExplorePayload */
/** @typedef {import('./index.js').ManagePayload} ManagePayload */

import {
  TRANSCRIPT_VISIBILITIES,
  ACCEPTANCE_MODES,
  DATA_ACCESS_POLICIES,
  TRANSCRIPT_DELETION_POLICIES,
  COLLECTIVE_ROLES,
} from './index.js'

/* ── (1) enum-value arrays are genuine runtime exports, typed by the union ────── */

/** @type {TranscriptVisibility} */
const firstVis = TRANSCRIPT_VISIBILITIES[0]
void firstVis
/** @type {AcceptanceMode} */
const firstMode = ACCEPTANCE_MODES[0]
void firstMode
/** @type {DataAccessPolicy} */
const firstAccess = DATA_ACCESS_POLICIES[0]
void firstAccess
/** @type {TranscriptDeletionPolicy} */
const firstPolicy = TRANSCRIPT_DELETION_POLICIES[0]
void firstPolicy
/** @type {CollectiveRole} */
const firstRole = COLLECTIVE_ROLES[0]
void firstRole

/* ── (2) POSITIVE: a valid ExplorePayload (the three-hook merge output) ───────── */
/** @type {ExplorePayload} */
const explore = {
  transcripts: {
    transcripts: [
      {
        id: 't1',
        title: 'a session',
        visibility: 'public',
        modelProvider: 'claude-code',
        modelName: null,
        harnessVersion: null,
        sessionStart: null,
        sessionEnd: null,
        turnCount: 3,
        tokenCount: 4200,
        toolCallCount: 1,
        durationMs: 60000,
        gitBranch: null,
        projectName: null,
        tags: [{ id: 'g1', name: 'go' }],
        owner: { githubUsername: 'octocat', displayName: null, avatarUrl: null },
      },
    ],
    total: 1,
    page: 0,
    limit: 20,
  },
  collectives: [
    { id: 'c1', name: 'collective', description: null, linkedGithubOrg: null, memberCount: 3, transcriptCount: 10 },
  ],
  popularTags: [{ id: 'g1', name: 'go', usageCount: 12 }],
}
void explore

/* ── (3) POSITIVE: members carry a concrete CollectiveRole; pending IS a role ────
   The pendingMembers list shares CollectiveMemberPayload, and the backend
   ListGroupPendingMembers filters gm.role = 'pending', so 'pending' must be a
   valid member role. */
/** @type {CollectiveMemberPayload} */
const owner = { id: 'u1', githubUsername: 'a', displayName: null, avatarUrl: null, role: 'owner', joinedAt: '2026-01-01T00:00:00Z' }
/** @type {CollectiveMemberPayload} */
const pending = { id: 'u2', githubUsername: 'b', displayName: null, avatarUrl: null, role: 'pending', joinedAt: '2026-01-02T00:00:00Z' }
void owner
void pending

/* ── (4) POSITIVE: yourRole is a ViewerRole — "" is valid (non-member / anon) ──── */
/** @type {ViewerRole} */
const anonViewer = ''
/** @type {ViewerRole} */
const memberViewer = 'contributor'
void anonViewer
void memberViewer

/* ── (5) POSITIVE: a valid ManagePayload, yourRole "" for a non-member ─────────── */
/** @type {ManagePayload} */
const manage = {
  collective: {
    id: 'c1',
    name: 'collective',
    description: null,
    linkedGithubOrg: null,
    displayMembers: true,
    transcriptDeletionPolicy: 'user_choice',
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    acceptanceMode: 'open',
    dataAccess: 'members_only',
    role: '',
    memberSince: null,
  },
  members: [owner],
  pendingMembers: [pending],
  transcripts: [],
  stats: { totalTranscripts: 0, contributorCount: 0, totalTurns: 0, totalDurationMs: 0, totalTokens: 0 },
  models: [],
  contributors: [],
  yourRole: '',
}
void manage

/* ── (6) POSITIVE: the lifted Explore component accepts the cooked payload seam ─ */
/** @type {ExploreSurfaceProps} */
const exploreSurface = {
  data: explore,
  onOpenTranscript: (transcript) => transcript.id,
  onOpenProfile: (owner) => owner.githubUsername,
  onOpenCollective: (collective) => collective.id,
  transcriptHref: (transcript) => `/transcripts/${transcript.id}`,
  profileHref: (owner) => `/users/${owner.githubUsername}`,
  collectiveHref: (collective) => `/groups/${collective.id}`,
}
void exploreSurface

/* ── (7) NEGATIVE: CollectiveRole rejects "admin" (a wrong recited value) ──────── */
/** @param {CollectiveRole} _r */
function _takesRole(_r) {}
// @ts-expect-error — "admin" is not a CollectiveRole (owner/member/contributor/pending)
_takesRole('admin')

/* ── (8) NEGATIVE: a concrete member role must NOT be "" ─────────────────────────
   "" is the non-member sentinel — it belongs to ViewerRole, not to a member row.
   A member always has a concrete role, so "" must be rejected by CollectiveRole. */
// @ts-expect-error — "" is the ViewerRole non-member sentinel, not a member role
_takesRole('')

/* ── (9) NEGATIVE: AcceptanceMode rejects an out-of-contract string ─────────────── */
/** @param {AcceptanceMode} _m */
function _takesMode(_m) {}
// @ts-expect-error — "invite_only" is not an AcceptanceMode
_takesMode('invite_only')
