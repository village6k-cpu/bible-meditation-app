import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteSyncApi } from '@db/syncEngine';
import type { RemoteRecord } from '@db/syncRepo';

interface RemoteRow {
  entity_type: RemoteRecord['entity_type'];
  entity_id: string;
  operation: RemoteRecord['operation'];
  payload: Record<string, unknown> | null;
  revision: number;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createSupabaseSyncApi(client: SupabaseClient, userId: string): RemoteSyncApi {
  return {
    async push(changes) {
      const rows = changes.map((change) => ({
        owner_id: userId,
        entity_type: change.entity_type,
        entity_id: change.entity_id,
        operation: change.operation,
        payload: change.payload,
      }));
      const { error } = await client
        .from('ledger_sync_records')
        .upsert(rows, { onConflict: 'owner_id,entity_type,entity_id' });
      fail(error);
    },

    async pull(cursor) {
      const { data, error } = await client
        .from('ledger_sync_records')
        .select('entity_type,entity_id,operation,payload,revision')
        .gt('revision', cursor)
        .order('revision', { ascending: true })
        .limit(500);
      fail(error);
      return (data ?? []) as RemoteRow[];
    },
  };
}
