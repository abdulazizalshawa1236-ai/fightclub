import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { ClassSession, Coach, ContentBlock, Offer, Plan, PublicSite } from '@fightclub/shared';
import { DatabaseService } from '../core/database';
import { parse } from '../core/validation';
import {
  catalogueIdSchema,
  classSchema,
  coachInputSchema,
  coachSchema,
  draftSchema,
  monthSchema,
  offerInputSchema,
  offerSchema,
  planInputSchema,
  planSchema,
  publishSchema,
  revisionSchema,
  settingsSchema,
  sportSchema,
  storedBlocksSchema,
} from './validation';

export type CatalogueKind = 'plans' | 'offers' | 'coaches';
type CatalogueRecord = Plan | Offer | Coach;
type DataRow = { data: unknown };
type RevisionRow = { revision: number; blocks: unknown; published: boolean; created_at: Date };
const CONTENT_LOCK = 762306;

@Injectable()
export class CatalogueService {
  constructor(private readonly db: DatabaseService) {}

  async site(admin = false): Promise<PublicSite> {
    return this.db.transaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const settings = await client.query<DataRow>('SELECT data FROM site_settings WHERE id=1');
      const revision = await client.query<RevisionRow>(
        admin
          ? 'SELECT revision,blocks,published,created_at FROM content_revisions ORDER BY revision DESC LIMIT 1'
          : 'SELECT revision,blocks,published,created_at FROM content_revisions WHERE published LIMIT 1',
      );
      const settingsRow = settings.rows[0];
      const contentRow = revision.rows[0];
      if (!settingsRow || !contentRow)
        throw new ServiceUnavailableException({
          code: 'SITE_NOT_INITIALIZED',
          message: 'Club content is not available yet.',
        });
      const plans = await client.query<DataRow>(
        'SELECT data FROM plans WHERE archived_at IS NULL ORDER BY id',
      );
      const offers = await client.query<DataRow>(
        'SELECT data FROM offers WHERE archived_at IS NULL ORDER BY id',
      );
      const coaches = await client.query<DataRow>(
        'SELECT data FROM coaches WHERE archived_at IS NULL ORDER BY id',
      );
      const sports = await client.query<DataRow>(
        'SELECT data FROM sports WHERE archived_at IS NULL ORDER BY id',
      );
      const blocks = storedBlocksSchema.parse(contentRow.blocks);
      return {
        settings: settingsSchema.parse(settingsRow.data),
        revision: contentRow.revision,
        blocks: (admin ? blocks : blocks.filter((block) => block.visible)).sort(
          (a, b) => a.position - b.position,
        ),
        plans: plans.rows
          .map((row) => planSchema.parse(row.data))
          .filter((plan) => admin || plan.visible)
          .sort(
            (a, b) =>
              (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER),
          ),
        offers: offers.rows
          .map((row) => offerSchema.parse(row.data))
          .filter((offer) => admin || offer.visible),
        coaches: coaches.rows.map((row) => coachSchema.parse(row.data)),
        sports: sports.rows.map((row) => sportSchema.parse(row.data)),
      };
    });
  }

  async settings(input: unknown, actor: string) {
    const settings = parse(settingsSchema, input);
    await this.db.transaction(async (client) => {
      const previous = await client.query<DataRow>(
        'SELECT data FROM site_settings WHERE id=1 FOR UPDATE',
      );
      await client.query(
        'INSERT INTO site_settings(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',
        [JSON.stringify(settings)],
      );
      await this.audit(client, actor, 'settings.updated', {
        before: previous.rows[0]?.data ?? null,
        after: settings,
      });
    });
    return settings;
  }

  async save(
    kind: CatalogueKind,
    id: string | null,
    input: unknown,
    actor: string,
  ): Promise<CatalogueRecord> {
    const recordId = id === null ? randomUUID() : parse(catalogueIdSchema, id);
    const data = this.validateInput(kind, input);
    const record = { ...data, id: recordId };
    await this.db.transaction(async (client) => {
      if (kind === 'coaches' && 'sports' in record && record.sports.length) {
        const sports = await client.query<{ id: string }>(
          'SELECT id FROM sports WHERE id=ANY($1::text[]) AND archived_at IS NULL',
          [record.sports],
        );
        if (sports.rows.length !== new Set(record.sports).size)
          throw new NotFoundException({
            code: 'SPORT_NOT_FOUND',
            message: 'Choose an available sport.',
          });
      }
      let previous: unknown = null;
      if (id !== null) {
        const existing = await client.query<DataRow>(
          `SELECT data FROM ${kind} WHERE id=$1 AND archived_at IS NULL FOR UPDATE`,
          [recordId],
        );
        if (!existing.rows[0])
          throw new NotFoundException({
            code: 'RECORD_NOT_FOUND',
            message: 'The record no longer exists.',
          });
        previous = existing.rows[0].data;
        await client.query(`UPDATE ${kind} SET data=$2 WHERE id=$1`, [
          recordId,
          JSON.stringify(record),
        ]);
      } else {
        await client.query(`INSERT INTO ${kind}(id,data) VALUES($1,$2)`, [
          recordId,
          JSON.stringify(record),
        ]);
      }
      await this.audit(client, actor, `${kind}.${id === null ? 'created' : 'updated'}`, {
        id: recordId,
        before: previous,
        after: record,
      });
    });
    return record;
  }

  async archive(kind: CatalogueKind, id: string, actor: string): Promise<{ archived: true }> {
    const recordId = parse(catalogueIdSchema, id);
    await this.db.transaction(async (client) => {
      const result = await client.query<DataRow>(
        `UPDATE ${kind} SET archived_at=now() WHERE id=$1 AND archived_at IS NULL RETURNING data`,
        [recordId],
      );
      if (!result.rows[0])
        throw new NotFoundException({
          code: 'RECORD_NOT_FOUND',
          message: 'The record no longer exists.',
        });
      await this.audit(client, actor, `${kind}.archived`, {
        id: recordId,
        before: result.rows[0].data,
      });
    });
    return { archived: true };
  }

  async draft(input: unknown, actor: string): Promise<{ revision: number }> {
    const draft = parse(draftSchema, input);
    return this.db.transaction(async (client) => {
      await this.lockRevision(client, draft.expectedRevision);
      return this.insertDraft(client, draft.blocks, actor, 'content.draft_saved');
    });
  }

  async publish(input: unknown, actor: string): Promise<{ revision: number }> {
    const { expectedRevision } = parse(publishSchema, input);
    return this.db.transaction(async (client) => {
      await this.lockRevision(client, expectedRevision);
      const target = await client.query<RevisionRow>(
        'SELECT revision,blocks,published,created_at FROM content_revisions WHERE revision=$1',
        [expectedRevision],
      );
      if (!target.rows[0])
        throw new NotFoundException({
          code: 'REVISION_NOT_FOUND',
          message: 'Save the content before publishing.',
        });
      storedBlocksSchema.parse(target.rows[0].blocks);
      await client.query('UPDATE content_revisions SET published=false WHERE published');
      await client.query('UPDATE content_revisions SET published=true WHERE revision=$1', [
        expectedRevision,
      ]);
      await this.audit(client, actor, 'content.published', { revision: expectedRevision });
      return { revision: expectedRevision };
    });
  }

  async history() {
    const result = await this.db.query<RevisionRow>(
      'SELECT revision,published,created_at FROM content_revisions ORDER BY revision DESC LIMIT 100',
    );
    return {
      revisions: result.rows.map((row) => ({
        revision: row.revision,
        published: row.published,
        createdAt: row.created_at.toISOString(),
      })),
    };
  }

  async restore(revision: string, input: unknown, actor: string): Promise<{ revision: number }> {
    const selected = parse(revisionSchema, Number(revision));
    const { expectedRevision } = parse(publishSchema, input);
    return this.db.transaction(async (client) => {
      await this.lockRevision(client, expectedRevision);
      const source = await client.query<RevisionRow>(
        'SELECT revision,blocks,published,created_at FROM content_revisions WHERE revision=$1',
        [selected],
      );
      if (!source.rows[0])
        throw new NotFoundException({
          code: 'REVISION_NOT_FOUND',
          message: 'This content revision could not be found.',
        });
      return this.insertDraft(
        client,
        storedBlocksSchema.parse(source.rows[0].blocks),
        actor,
        'content.restored',
        selected,
      );
    });
  }

  async schedule(month: unknown): Promise<{ classes: ClassSession[] }> {
    const requested = parse(monthSchema, month);
    const from = `${requested}-01`;
    const next = new Date(`${from}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const until = next.toISOString().slice(0, 10);
    const result = await this.db.query<DataRow>(
      "SELECT data FROM classes WHERE data->>'date'>=$1 AND data->>'date'<$2 ORDER BY data->>'date',data->>'startTime'",
      [from, until],
    );
    return { classes: result.rows.map((row) => classSchema.parse(row.data)) };
  }

  private validateInput(kind: CatalogueKind, input: unknown) {
    if (kind === 'plans') return parse(planInputSchema, input);
    if (kind === 'offers') return parse(offerInputSchema, input);
    return parse(coachInputSchema, input);
  }

  private async lockRevision(client: PoolClient, expected: number): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock($1)', [CONTENT_LOCK]);
    const result = await client.query<{ revision: number }>(
      'SELECT COALESCE(MAX(revision),0)::integer AS revision FROM content_revisions',
    );
    if (result.rows[0]?.revision !== expected)
      throw new ConflictException({
        code: 'CONTENT_CHANGED',
        message: 'Content was updated by another editor. Reload before saving.',
      });
  }

  private async insertDraft(
    client: PoolClient,
    blocks: ContentBlock[],
    actor: string,
    action: string,
    sourceRevision?: number,
  ): Promise<{ revision: number }> {
    const result = await client.query<{ revision: number }>(
      'INSERT INTO content_revisions(blocks) VALUES($1) RETURNING revision',
      [JSON.stringify(blocks)],
    );
    const revision = result.rows[0]!.revision;
    await this.audit(client, actor, action, { revision, sourceRevision });
    return { revision };
  }

  private async audit(
    client: PoolClient,
    actor: string,
    action: string,
    details: unknown,
  ): Promise<void> {
    await client.query('INSERT INTO audit_events(id,actor,action,details) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      actor,
      action,
      JSON.stringify(details),
    ]);
  }
}
