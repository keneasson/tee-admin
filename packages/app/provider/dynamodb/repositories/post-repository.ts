import { v4 as uuidv4 } from 'uuid'
import { BaseRepository } from './base-repository'
import type { Post } from '@my/app/types/post'

/**
 * PostRepository — native storage for the unified {@link Post} model
 * (Consolidated CMS epic #131, Phase 1). See docs/UNIFIED_POST_MODEL_DESIGN.md
 * §2 (Post), §7 (Phase 1 = "Persist posts as blocks; adapter-read legacy during
 * transition").
 *
 * Storage — ONE item per post in the `tee-admin` table with `blocks` embedded as
 * a native list (posts are small; no schedule-style JSON-string serialization).
 * Mirrors the person-repository conventions: lowercase `pkey`/`skey` attribute
 * names, `POST#`-prefixed key values, overloaded GSIs, uuid ids.
 *
 * Key scheme (mirrors the adjacency-list + overloaded-GSI pattern):
 *   base   pkey = POST#{tenant}    skey = POST#{postId}   — list-by-tenant + unique item
 *   gsi1   gsi1pk = POST#{postId}  gsi1sk = POST          — O(1) getPost(postId) (like getByEmail)
 *   gsi2   gsi2pk = POSTS#{tenant} gsi2sk = {sortDate}#{postId}
 *          — chronological list by lifecycle.publishDate (falls back to createdAt),
 *            the same idea the events GSI uses ({date}#{id}). `sortDate` lets
 *            listPosts return newest-first without a scan.
 *
 * Cross-platform: no `next-auth` / `next/*` imports (server-only via BaseRepository).
 */

/** Stored shape: the domain {@link Post} plus DynamoDB key + overloaded-GSI attributes. */
export interface PostRecord extends Post {
  pkey: string
  skey: string
  gsi1pk: string
  gsi1sk: string
  gsi2pk: string
  gsi2sk: string
  version?: number
  lastUpdated?: string
}

export interface CreatePostInput {
  tenant: string
  authorId: string
  title: string
  occasion: Post['occasion']
  summary?: string
  visibility: Post['visibility']
  sharingScope: Post['sharingScope']
  lifecycle?: Post['lifecycle']
  blocks?: Post['blocks']
  status?: Post['status']
  seriesId?: Post['seriesId']
}

/** Fields a caller may patch. Keys, id, tenant and createdAt are immutable here. */
export type UpdatePostInput = Partial<
  Pick<
    Post,
    | 'title'
    | 'occasion'
    | 'summary'
    | 'visibility'
    | 'sharingScope'
    | 'lifecycle'
    | 'blocks'
    | 'status'
    | 'seriesId'
  >
>

export interface ListPostsOptions {
  tenant: string
  /** Include archived posts. Default false — archived are filtered out. */
  includeArchived?: boolean
  /** Only return posts with this status (e.g. 'ready'). */
  status?: Post['status']
  /** Newest-first by default (false). Pass true for oldest-first. */
  oldestFirst?: boolean
  limit?: number
  lastEvaluatedKey?: Record<string, any>
}

export interface ListPostsResult {
  posts: Post[]
  lastEvaluatedKey?: Record<string, any>
}

/** The date a post sorts by in gsi2: its publishDate, else its createdAt. */
function sortDate(lifecycle: Post['lifecycle'] | undefined, createdAt: string): string {
  return lifecycle?.publishDate || createdAt
}

/**
 * Mint a fresh block id for a duplicated post. Same compact time+random
 * scheme as the client editor's `genId` (packages/ui/src/post-editor/
 * post-reducer.ts) so server- and client-minted block ids are
 * indistinguishable — duplicated here (rather than imported) so this
 * server-side repository stays free of a `packages/ui` dependency
 * (CLAUDE.md cross-platform layering: shared data code never reaches into UI).
 */
function mintBlockId(prefix = 'blk'): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}

/**
 * Repository for native Post records on the `tee-admin` table (lowercase
 * pkey/skey keys, POST#-prefixed values).
 */
export class PostRepository extends BaseRepository<PostRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for PostRepository')
  }

  private static basePk(tenant: string): string {
    return `POST#${tenant}`
  }

  private static baseSk(postId: string): string {
    return `POST#${postId}`
  }

  /** Build the overloaded-GSI attributes for a post. */
  private static gsiKeys(post: Post): {
    gsi1pk: string
    gsi1sk: string
    gsi2pk: string
    gsi2sk: string
  } {
    return {
      gsi1pk: `POST#${post.id}`,
      gsi1sk: 'POST',
      gsi2pk: `POSTS#${post.tenant}`,
      gsi2sk: `${sortDate(post.lifecycle, post.createdAt)}#${post.id}`,
    }
  }

  /** Strip storage attributes → a clean domain Post (no key/gsi/version leakage). */
  private static toPost(record: PostRecord): Post {
    const {
      pkey: _pkey,
      skey: _skey,
      gsi1pk: _g1p,
      gsi1sk: _g1s,
      gsi2pk: _g2p,
      gsi2sk: _g2s,
      version: _version,
      lastUpdated: _lastUpdated,
      ...post
    } = record
    return post
  }

  /**
   * Create a new post. Generates a uuid id and createdAt/updatedAt/status,
   * embeds `blocks` as a native list.
   */
  async createPost(input: CreatePostInput): Promise<Post> {
    const id = uuidv4()
    const now = new Date().toISOString()

    const post: Post = {
      id,
      tenant: input.tenant,
      authorId: input.authorId,
      title: input.title,
      occasion: input.occasion,
      summary: input.summary,
      visibility: input.visibility,
      sharingScope: input.sharingScope,
      lifecycle: input.lifecycle ?? {},
      blocks: input.blocks ?? [],
      createdAt: now,
      updatedAt: now,
      status: input.status ?? 'draft',
      seriesId: input.seriesId,
    }

    const record: PostRecord = {
      pkey: PostRepository.basePk(post.tenant),
      skey: PostRepository.baseSk(post.id),
      ...PostRepository.gsiKeys(post),
      ...post,
      version: 0,
    }

    await this.put(record)
    return post
  }

  /** Get a single post by id via gsi1 (O(1) — no tenant required). */
  async getPost(postId: string): Promise<Post | null> {
    const result = await this.query(
      'gsi1pk = :gsi1pk AND gsi1sk = :gsi1sk',
      { ':gsi1pk': `POST#${postId}`, ':gsi1sk': 'POST' },
      { indexName: 'gsi1' }
    )
    const record = result.items[0]
    return record ? PostRepository.toPost(record) : null
  }

  /**
   * List a tenant's posts, chronologically by publishDate (newest-first by
   * default) via gsi2. Archived posts are excluded unless `includeArchived`.
   */
  async listPosts(options: ListPostsOptions): Promise<ListPostsResult> {
    const result = await this.query(
      'gsi2pk = :gsi2pk',
      { ':gsi2pk': `POSTS#${options.tenant}` },
      {
        indexName: 'gsi2',
        limit: options.limit,
        lastEvaluatedKey: options.lastEvaluatedKey,
        scanIndexForward: options.oldestFirst ?? false,
      }
    )

    let posts = result.items.map(PostRepository.toPost)
    if (options.status) {
      posts = posts.filter((p) => p.status === options.status)
    } else if (!options.includeArchived) {
      posts = posts.filter((p) => p.status !== 'archived')
    }

    return { posts, lastEvaluatedKey: result.lastEvaluatedKey }
  }

  /**
   * Update a post. Re-derives the gsi2 sort key (it encodes publishDate) so a
   * publish-scheduling change re-sorts correctly, mirroring how updatePerson
   * rebuilds GSI keys. Always bumps updatedAt.
   */
  async updatePost(postId: string, patch: UpdatePostInput): Promise<Post> {
    const current = await this.getPost(postId)
    if (!current) throw new Error(`Post ${postId} not found`)

    const merged: Post = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }

    const updates: Partial<PostRecord> = {
      ...patch,
      updatedAt: merged.updatedAt,
      gsi2sk: `${sortDate(merged.lifecycle, merged.createdAt)}#${merged.id}`,
    }

    const record = await this.update(
      PostRepository.basePk(current.tenant),
      PostRepository.baseSk(current.id),
      updates
    )
    return PostRepository.toPost(record)
  }

  /** Archive a post (soft delete) — drops it out of the default list view. */
  async archivePost(postId: string): Promise<Post> {
    return this.updatePost(postId, { status: 'archived' })
  }

  /**
   * List every native post across all tenants (scan). Used by the unified read
   * when no tenant is scoped. The native store is small during the Phase 1
   * transition, so a scan is acceptable here.
   */
  async listAllPosts(options?: { includeArchived?: boolean }): Promise<Post[]> {
    const posts: Post[] = []
    let lastKey: Record<string, any> | undefined

    do {
      const result = await this.scan({
        filterExpression: 'begins_with(pkey, :prefix) AND begins_with(skey, :prefix)',
        expressionAttributeValues: { ':prefix': 'POST#' },
        lastEvaluatedKey: lastKey,
      })
      for (const record of result.items) {
        const post = PostRepository.toPost(record)
        if (!options?.includeArchived && post.status === 'archived') continue
        posts.push(post)
      }
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return posts
  }

  /**
   * List every post sharing a `seriesId` (Connect/series, Consolidated CMS
   * epic #131). Series are small (a handful of related posts), so — like
   * {@link listAllPosts} — a filtered scan mirrors the existing query style
   * instead of adding a dedicated GSI for what is, today, a rare lookup.
   */
  async listPostsBySeries(seriesId: string): Promise<Post[]> {
    if (!seriesId) return []
    const posts: Post[] = []
    let lastKey: Record<string, any> | undefined

    do {
      const result = await this.scan({
        filterExpression: 'begins_with(pkey, :prefix) AND seriesId = :seriesId',
        expressionAttributeValues: { ':prefix': 'POST#', ':seriesId': seriesId },
        lastEvaluatedKey: lastKey,
      })
      posts.push(...result.items.map(PostRepository.toPost))
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return posts
  }

  /**
   * Duplicate a post's STRUCTURE into a fresh draft (Consolidated CMS epic
   * #131 "Duplicate/replicate"): so an annual gathering or study day isn't
   * rebuilt from scratch every year. Deep-clones `blocks` with FRESH block ids
   * (mirrors the client editor's `genId` scheme — see {@link mintBlockId}) so
   * neither post's blocks alias the other's. `title`/`occasion`/`blocks`
   * (structure) carry over verbatim for the author to edit; `id`/`createdAt`/
   * `updatedAt` are freshly minted by {@link createPost} and `status` resets to
   * `'draft'`.
   *
   * `seriesId` = the source's existing series, or a brand-new one — either way
   * the source AND the new draft end up sharing ONE seriesId (Connect/series:
   * "a duplicate auto-joins the original's series"). When the source had no
   * `seriesId` yet, it is retroactively updated to the new series id so the
   * pair is linked from both sides.
   *
   * `authorId` is caller-supplied (never trusts a client body — mirrors
   * {@link createPost}'s convention; the API route derives it from the session).
   */
  async duplicatePost(id: string, authorId: string): Promise<Post> {
    const source = await this.getPost(id)
    if (!source) throw new Error(`Post ${id} not found`)

    const seriesId = source.seriesId ?? uuidv4()
    if (!source.seriesId) {
      await this.updatePost(source.id, { seriesId })
    }

    const blocks = source.blocks.map((block) => ({
      ...(JSON.parse(JSON.stringify(block)) as typeof block),
      id: mintBlockId(),
    }))

    return this.createPost({
      tenant: source.tenant,
      authorId,
      title: source.title,
      occasion: source.occasion,
      summary: source.summary,
      visibility: source.visibility,
      sharingScope: source.sharingScope,
      lifecycle: { ...source.lifecycle },
      blocks,
      status: 'draft',
      seriesId,
    })
  }
}

// Export singleton instance
export const postRepository = new PostRepository()
