import { supabase } from './supabaseClient';

type TableRow = Record<string, unknown>;

export interface TenantBackupFile {
  app: 'myfleet-pro';
  version: 1;
  exported_at: string;
  org_id: string;
  data: Record<string, TableRow[]>;
}

const ORG_TABLES = [
  'drivers',
  'cars',
  'assets',
  'subscriptions',
  'payment_requests',
  'whatsapp_sessions',
  'whatsapp_templates',
  'whatsapp_notification_logs',
  'whatsapp_notification_queue',
  'whatsapp_audit_logs',
  'notification_queue'
] as const;

const RESTORE_ORDER = [
  'organizations',
  'profiles',
  'drivers',
  'cars',
  'transactions',
  'assets',
  'asset_installments',
  'expense_templates',
  'subscriptions',
  'payment_requests',
  'whatsapp_sessions',
  'whatsapp_templates',
  'whatsapp_messages',
  'whatsapp_notification_logs',
  'whatsapp_notification_queue',
  'whatsapp_audit_logs',
  'notification_queue'
] as const;

async function selectTable(table: string, column: string, value: string): Promise<TableRow[]> {
  const { data, error } = await supabase.from(table).select('*').eq(column, value);
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    throw new Error(`${table}: ${error.message}`);
  }
  return (data || []) as TableRow[];
}

async function selectIn(table: string, column: string, values: string[]): Promise<TableRow[]> {
  if (values.length === 0) return [];
  const { data, error } = await supabase.from(table).select('*').in(column, values);
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    throw new Error(`${table}: ${error.message}`);
  }
  return (data || []) as TableRow[];
}

function rowIds(rows: TableRow[]): string[] {
  return rows.map(row => row.id).filter((id): id is string => typeof id === 'string');
}

function normalizeRowsForRestore(table: string, rows: TableRow[], orgId: string): TableRow[] {
  return rows.map(row => {
    const copy = { ...row };
    if (table === 'organizations') {
      copy.id = orgId;
    } else if ('org_id' in copy) {
      copy.org_id = orgId;
    }
    return copy;
  });
}

export async function exportTenantBackup(orgId: string): Promise<TenantBackupFile> {
  const organization = await selectTable('organizations', 'id', orgId);
  const profiles = await selectTable('profiles', 'org_id', orgId);
  const profileIds = rowIds(profiles);

  const data: Record<string, TableRow[]> = {
    organizations: organization,
    profiles
  };

  for (const table of ORG_TABLES) {
    data[table] = await selectTable(table, 'org_id', orgId);
  }

  const carIds = rowIds(data.cars || []);
  const assetIds = rowIds(data.assets || []);
  const sessionIds = rowIds(data.whatsapp_sessions || []);

  data.transactions = [
    ...await selectIn('transactions', 'car_id', carIds),
    ...await selectIn('transactions', 'user_id', profileIds)
  ].filter((row, index, rows) => rows.findIndex(item => item.id === row.id) === index);

  data.asset_installments = await selectIn('asset_installments', 'asset_id', assetIds);
  data.expense_templates = await selectIn('expense_templates', 'user_id', profileIds);
  data.whatsapp_messages = await selectIn('whatsapp_messages', 'session_id', sessionIds);

  return {
    app: 'myfleet-pro',
    version: 1,
    exported_at: new Date().toISOString(),
    org_id: orgId,
    data
  };
}

export async function importTenantBackup(orgId: string, backup: TenantBackupFile): Promise<Record<string, number>> {
  if (backup.app !== 'myfleet-pro' || backup.version !== 1 || !backup.data) {
    throw new Error('ملف النسخة الاحتياطية غير صالح');
  }

  if (backup.org_id !== orgId) {
    throw new Error('هذه النسخة تخص منشأة أخرى ولا يمكن استيرادها هنا');
  }

  const counts: Record<string, number> = {};

  for (const table of RESTORE_ORDER) {
    const rows = backup.data[table] || [];
    if (rows.length === 0) continue;

    const { error } = await supabase
      .from(table)
      .upsert(normalizeRowsForRestore(table, rows, orgId), { onConflict: 'id' });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') continue;
      throw new Error(`${table}: ${error.message}`);
    }

    counts[table] = rows.length;
  }

  return counts;
}

export function downloadBackupFile(backup: TenantBackupFile, orgName?: string): void {
  const safeName = (orgName || backup.org_id).replace(/[^\w\u0600-\u06FF-]+/g, '_');
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `myfleet-backup-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
