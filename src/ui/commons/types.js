// @ts-check
/* ─────────────────────────────────────────────────────────────────────────────
   commons/types — village lifted-surface prop payload contracts (the adapter seam)
   ─────────────────────────────────────────────────────────────────────────────
   Two surfaces lifted from village into fairtrade/ui:
     • Explore — transcript browser / search / facets (village explore page)
     • Manage  — collective governance (members, transcripts, stats, roles)

   A thin adapter in the village app converts the TanStack Query hook results
   once into these cooked prop payloads; the lifted components never call
   hooks or hit API endpoints directly. This mirrors the transcript surface's
   wire-types/view-model split.

   SOURCE OF TRUTH for field names = village frontend types:
     TranscriptListResponse / TranscriptListItem / Transcript / User / Tag —
       frontend/src/lib/types.ts
     CollectiveSearchResponse / CollectiveSearchResult / TagWithCount —
       frontend/src/lib/types.ts
     Group / GroupMember / GroupTranscript / GroupTranscriptStats /
     GroupModelBreakdown / GroupContributor —
       frontend/src/lib/types.ts
     useTranscripts / useSearchCollectives / usePopularTags —
       frontend/src/lib/queries/transcripts.ts + tags.ts
     useGroup + mutations (useCreateGroup / useUpdateGroup / useJoinGroup /
     usePromoteMember) — frontend/src/lib/queries/groups.ts

   ── Fixture↔API delta tables ─────────────────────────────────────────────────

   ── EXPLORE (TRANSFORM — small) ──────────────────────────────────────────────
   Inputs:
     • useTranscripts(params)       → TranscriptListResponse   (browsing)
     • useSearchCollectives(query)  → CollectiveSearchResponse (collective search)
     • usePopularTags(limit)        → TagWithCount[]           (CONFIRMED EXISTS at
                                      frontend/src/lib/queries/tags.ts — not new)
   Output: ExplorePayload

   TRANSCRIPT LIST (present/transform/absent — grounded in Transcript / TranscriptListItem):
     PRESENT (identity name): transcripts[].transcript{id, title, visibility}
     PRESENT: transcripts[].tags[]{id, name}
     PRESENT: total, page, limit
     TRANSFORM (snake_case → camelCase rename — ALL village wire fields are renamed
       to camelCase for a consistent component naming convention):
         model_provider → modelProvider,   model_name → modelName,
         harness_version → harnessVersion,  session_start → sessionStart,
         session_end → sessionEnd,          turn_count → turnCount,
         token_count → tokenCount,          tool_call_count → toolCallCount,
         duration_ms → durationMs,          git_branch → gitBranch,
         project_name → projectName,
         owner.github_username → owner.githubUsername,
         owner.display_name → owner.displayName, owner.avatar_url → owner.avatarUrl
     ABSENT (on Transcript but not surfaced by Explore browse):
       git_remote, git_worktree, project_hash, project_path, owner_id, local_id,
       blob_key, blob_size_bytes, schema_version, published_at, updated_at,
       ingested_at, source_file_path, source_format, parent_session_id, subagents,
       subagent_count, tokens_in, tokens_out, diagnostics_warnings, diagnostics_partial
     ABSENT (on TranscriptListItem wrapper): shares, attestations

   COLLECTIVE SEARCH (grounded in CollectiveSearchResult — every field mapped):
     PRESENT (identity name): collectives[]{id, name, description}
     TRANSFORM (snake_case → camelCase rename):
       linked_github_org → linkedGithubOrg, member_count → memberCount,
       transcript_count → transcriptCount
     ABSENT: none — CollectiveSearchResult has no other fields

   POPULAR TAGS:
     PRESENT: tags[]{id, name, usageCount}
     TRANSFORM: usage_count → usageCount

   ── MANAGE (TRANSFORM — small) ──────────────────────────────────────────────
   Input:  useGroup(id) → { group, members, transcripts, stats, models,
             contributors, can_read, your_role, pending_members? }
   Output: ManagePayload (data fields only; mutations are component-level callbacks)

   FIXTURE GAP: pending_members is optional on the wire (`pending_members?`)
   and absent in the current mock fixture. The adapter must tolerate its absence
   (`pending_members ?? []`) and the surface slice must fill the mock fixture.

     PRESENT: group{id, name, description, linkedGithubOrg, displayMembers,
       transcriptDeletionPolicy, createdBy, createdAt, updatedAt, acceptanceMode,
       dataAccess, role, memberSince}
     PRESENT: members[]{role, joinedAt, id, githubUsername, displayName, avatarUrl}
     PRESENT: transcripts[]{id, title, visibility, modelProvider, modelName,
       sessionStart, turnCount, tokenCount, ownerUsername, ownerAvatarUrl}
     PRESENT: stats{totalTranscripts, contributorCount, totalTurns, totalDurationMs,
       totalTokens}
     PRESENT: models[]{modelProvider, transcriptCount}
     PRESENT: contributors[]{id, githubUsername, avatarUrl, transcriptCount}
     PRESENT: pendingMembers[] — optional; empty when absent (fixture gap, see above)
     PRESENT: yourRole — the authenticated user's role in this collective
     TRANSFORM: all snake_case → camelCase throughout
     ABSENT: can_read — auth/routing concern; not a display concern inside the component

   MUTATIONS (callbacks — NOT in ManagePayload; wired as component-level props):
     onCreateGroup, onUpdateGroup, onJoinGroup, onPromoteMember, onRemoveMember,
     onAddMember, onDeleteGroup — defined in the surface slice

   ── Runtime exports ──────────────────────────────────────────────────────────
   The @typedef blocks below are erased at build; any small frozen arrays are
   genuine runtime exports. See graph/types.js for the full pattern.
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Shared enums ───────────────────────────────────────────────────────────── */

/**
 * Transcript visibility level.
 * @typedef {'public' | 'private' | 'shared'} TranscriptVisibility
 */

/** Canonical TranscriptVisibility values. @type {readonly TranscriptVisibility[]} */
export const TRANSCRIPT_VISIBILITIES = Object.freeze(['public', 'private', 'shared'])

/**
 * Collective acceptance mode: who can join.
 * Grounded in backend migration 005 — CHECK (acceptance_mode IN
 * ('open','verified_only','curated')).
 * @typedef {'open' | 'verified_only' | 'curated'} AcceptanceMode
 */

/** Canonical AcceptanceMode values. @type {readonly AcceptanceMode[]} */
export const ACCEPTANCE_MODES = Object.freeze(['open', 'verified_only', 'curated'])

/**
 * Collective data access policy: who can read transcripts.
 * Grounded in backend handler/groups.go canReadData + migration 008
 * (data_access default 'members_only').
 * @typedef {'members_only' | 'contributors' | 'public'} DataAccessPolicy
 */

/** Canonical DataAccessPolicy values. @type {readonly DataAccessPolicy[]} */
export const DATA_ACCESS_POLICIES = Object.freeze([
  'members_only',
  'contributors',
  'public',
])

/**
 * Transcript deletion policy for a collective.
 * Grounded in backend migration 016 — CHECK (transcript_deletion_policy IN
 * ('user_choice','mandatory')).
 * @typedef {'user_choice' | 'mandatory'} TranscriptDeletionPolicy
 */

/** Canonical TranscriptDeletionPolicy values. @type {readonly TranscriptDeletionPolicy[]} */
export const TRANSCRIPT_DELETION_POLICIES = Object.freeze([
  'user_choice',
  'mandatory',
])

/**
 * A member's role within a collective. The `members` list carries
 * owner/member/contributor; the `pendingMembers` list carries `pending`
 * (the backend's ListGroupPendingMembers query filters `gm.role = 'pending'`),
 * so this union — shared by both lists via CollectiveMemberPayload — includes it.
 * Grounded in backend handler/groups.go (Role: "owner"/"member"/"contributor")
 * + sqlc ListGroupPendingMembers (WHERE gm.role = 'pending').
 * @typedef {'owner' | 'member' | 'contributor' | 'pending'} CollectiveRole
 */

/** Canonical CollectiveRole values. @type {readonly CollectiveRole[]} */
export const COLLECTIVE_ROLES = Object.freeze([
  'owner',
  'member',
  'contributor',
  'pending',
])

/**
 * Current Explore browse filters mirrored by the host.
 * @typedef {object} ExploreFilters
 * @property {string} query
 * @property {string} provider
 * @property {string[]} topics
 * @property {string} order
 * @property {number} page
 */

/**
 * Surface props for the lifted Explore component.
 * The component consumes one cooked payload and owns its own browse state; hosts may also supply
 * navigation slots for transcript/profile/collective exits.
 * @typedef {object} ExploreSurfaceProps
 * @property {ExplorePayload} data
 * @property {string} [className]
 * @property {(filters: ExploreFilters) => void} [onFiltersChange]
 * @property {(transcript: ExploreTranscriptPayload) => void} [onOpenTranscript]
 * @property {(owner: ExploreOwnerPayload) => void} [onOpenProfile]
 * @property {(collective: CollectiveResultPayload) => void} [onOpenCollective]
 * @property {(transcript: ExploreTranscriptPayload) => string} [transcriptHref]
 * @property {(owner: ExploreOwnerPayload) => string} [profileHref]
 * @property {(collective: CollectiveResultPayload) => string} [collectiveHref]
 */

/**
 * The AUTHENTICATED VIEWER's role in a collective — a CollectiveRole, OR the
 * empty string when the viewer is not a member / anonymous. The backend GetGroup
 * handler defaults `your_role` to "" for non-members (handler/groups.go:
 * `yourRole := ""`), so this distinct type is required wherever the viewer's own
 * role is exposed (your_role + the per-viewer Group.role), as opposed to a
 * concrete member row's role.
 * @typedef {CollectiveRole | ''} ViewerRole
 */

/* ── Explore surface sub-types ───────────────────────────────────────────────── */

/**
 * One tag attached to a transcript in the Explore list.
 *
 * @typedef {object} TagPayload
 * @property {string} id
 * @property {string} name
 */

/**
 * The author (owner) of a transcript as shown in the Explore list.
 *
 * @typedef {object} ExploreOwnerPayload
 * @property {string} githubUsername
 * @property {string | null} displayName
 * @property {string | null} avatarUrl
 */

/**
 * One transcript row in the Explore browse list.
 * Cooked from TranscriptListItem (frontend/src/lib/types.ts): snake_case fields
 * are renamed to camelCase; fields not needed by the Explore surface are omitted.
 *
 * @typedef {object} ExploreTranscriptPayload
 * @property {string} id
 * @property {string | null} title
 * @property {TranscriptVisibility} visibility
 * @property {string} modelProvider              e.g. "claude-code", "opencode"
 * @property {string | null} modelName
 * @property {string | null} harnessVersion
 * @property {string | null} sessionStart        ISO-8601 datetime or null
 * @property {string | null} sessionEnd          ISO-8601 datetime or null
 * @property {number | null} turnCount
 * @property {number | null} tokenCount
 * @property {number | null} toolCallCount
 * @property {number | null} durationMs
 * @property {string | null} gitBranch
 * @property {string | null} projectName
 * @property {TagPayload[]} tags
 * @property {ExploreOwnerPayload} owner
 */

/**
 * Paginated list of transcripts for the Explore browse view.
 * Cooked from TranscriptListResponse.
 *
 * @typedef {object} ExploreTranscriptListPayload
 * @property {ExploreTranscriptPayload[]} transcripts
 * @property {number} total   total matching transcripts (for pagination)
 * @property {number} page    current page (1-based)
 * @property {number} limit   page size
 */

/**
 * One collective result from a collective search (useSearchCollectives).
 * Cooked from CollectiveSearchResult (frontend/src/lib/types.ts).
 *
 * @typedef {object} CollectiveResultPayload
 * @property {string} id
 * @property {string} name
 * @property {string | null} description
 * @property {string | null} linkedGithubOrg
 * @property {number} memberCount
 * @property {number} transcriptCount
 */

/**
 * One popular tag with its usage count.
 * Cooked from TagWithCount (frontend/src/lib/types.ts).
 *
 * @typedef {object} PopularTagPayload
 * @property {string} id
 * @property {string} name
 * @property {number} usageCount
 */

/**
 * The Explore surface prop payload. The adapter maps the three hook results
 * (useTranscripts, useSearchCollectives, usePopularTags) into this single
 * cooked shape; the lifted <Explore> component never calls hooks directly.
 *
 * Query parameters (q, sort, page, provider, tags) are not embedded in the
 * payload — they live as component-level props that the host passes alongside
 * the payload (the adapter is called when any of them changes).
 *
 * @typedef {object} ExplorePayload
 * @property {ExploreTranscriptListPayload} transcripts  browsing results (page + facet filters applied)
 * @property {CollectiveResultPayload[]} collectives     collective search results (empty when no query)
 * @property {PopularTagPayload[]} popularTags           top tags for the facet rail (cap set by caller)
 */

/* ── Manage surface sub-types ────────────────────────────────────────────────── */

/**
 * One member of a collective.
 * Cooked from GroupMember (frontend/src/lib/types.ts).
 *
 * @typedef {object} CollectiveMemberPayload
 * @property {string} id
 * @property {string} githubUsername
 * @property {string | null} displayName
 * @property {string | null} avatarUrl
 * @property {CollectiveRole} role  owner/member/contributor for the members list; "pending" for the pendingMembers list
 * @property {string} joinedAt      ISO-8601 datetime
 */

/**
 * One transcript published to the collective (lightweight row).
 * Cooked from GroupTranscript (which extends Transcript with owner fields).
 *
 * @typedef {object} CollectiveTranscriptPayload
 * @property {string} id
 * @property {string | null} title
 * @property {TranscriptVisibility} visibility
 * @property {string} modelProvider
 * @property {string | null} modelName
 * @property {string | null} sessionStart   ISO-8601 datetime or null
 * @property {number | null} turnCount
 * @property {number | null} tokenCount
 * @property {string} ownerUsername
 * @property {string | null} ownerAvatarUrl
 */

/**
 * Aggregate statistics for a collective's transcript corpus.
 * Mirrors GroupTranscriptStats from frontend/src/lib/types.ts.
 *
 * @typedef {object} CollectiveStatsPayload
 * @property {number} totalTranscripts
 * @property {number} contributorCount
 * @property {number} totalTurns
 * @property {number} totalDurationMs
 * @property {number} totalTokens
 */

/**
 * Model usage breakdown for a collective.
 * Mirrors GroupModelBreakdown from frontend/src/lib/types.ts.
 *
 * @typedef {object} CollectiveModelBreakdownPayload
 * @property {string} modelProvider
 * @property {number} transcriptCount
 */

/**
 * One contributor to a collective's transcript corpus.
 * Mirrors GroupContributor from frontend/src/lib/types.ts.
 *
 * @typedef {object} CollectiveContributorPayload
 * @property {string} id
 * @property {string} githubUsername
 * @property {string | null} avatarUrl
 * @property {number} transcriptCount
 */

/**
 * The collective's own metadata.
 * Cooked from Group (frontend/src/lib/types.ts): snake_case → camelCase.
 *
 * @typedef {object} CollectivePayload
 * @property {string} id
 * @property {string} name
 * @property {string | null} description
 * @property {string | null} linkedGithubOrg
 * @property {boolean} displayMembers
 * @property {TranscriptDeletionPolicy} transcriptDeletionPolicy
 * @property {string} createdBy        user id of the creator
 * @property {string} createdAt        ISO-8601 datetime
 * @property {string} updatedAt        ISO-8601 datetime
 * @property {AcceptanceMode} acceptanceMode
 * @property {DataAccessPolicy} dataAccess
 * @property {ViewerRole} role         the authenticated viewer's role; "" when not a member / anonymous
 * @property {string | null} memberSince  ISO-8601 datetime when the user joined; null if not a member
 */

/**
 * The Manage surface prop payload. The adapter maps the useGroup hook result
 * into this single cooked shape; the lifted <Manage> component never calls
 * hooks directly.
 *
 * Mutation callbacks (onCreateGroup, onUpdateGroup, onJoinGroup,
 * onPromoteMember, onRemoveMember, onAddMember, onDeleteGroup) are
 * component-level props defined in the surface slice — NOT fields in this
 * payload. The payload carries only the READ data model.
 *
 * FIXTURE GAP: pendingMembers is optional on the wire (`pending_members?`)
 * and absent from the current mock fixture. The adapter normalizes it to `[]`
 * when absent; the mock fixture must be filled by the surface slice worker.
 *
 * @typedef {object} ManagePayload
 * @property {CollectivePayload} collective
 * @property {CollectiveMemberPayload[]} members        approved members
 * @property {CollectiveMemberPayload[]} pendingMembers pending join requests (may be [] when not yet seeded)
 * @property {CollectiveTranscriptPayload[]} transcripts  published transcripts (paginated externally)
 * @property {CollectiveStatsPayload} stats
 * @property {CollectiveModelBreakdownPayload[]} models  usage breakdown by model provider
 * @property {CollectiveContributorPayload[]} contributors
 * @property {ViewerRole} yourRole                       authenticated viewer's role; "" when not a member / anonymous
 */

export {}
