import Dexie, { Table } from 'dexie';
import { Profile, Organization, ExpenseTemplate } from '../types';

export interface LocalCar {
    id?: string;
    org_id: string;
    plate_number: string;
    brand: string;
    model: string;
    year: number;
    status: string;
    current_mileage?: number;
    last_updated: number; // For conflict resolution
}

export interface LocalTransaction {
    id?: string;
    org_id: string;
    car_id: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    date: string;
    notes?: string;
    last_updated: number; // For conflict resolution
}

export interface LocalSession {
    id: string; // user_id
    token: string;
    role: string;
    profile: Profile;
    org: Organization;
    expires_at: number;
}

export interface SyncQueue {
    id?: number;
    table: string;
    action: 'insert' | 'update' | 'delete';
    data: unknown;
    timestamp: number;
}

export class MyFleetDB extends Dexie {
    cars!: Table<LocalCar>;
    transactions!: Table<LocalTransaction>;
    sessions!: Table<LocalSession>;
    profiles!: Table<Profile>;
    expenseTemplates!: Table<ExpenseTemplate>;
    syncQueue!: Table<SyncQueue>;

    constructor() {
        super('MyFleetDB');
        this.version(2).stores({
            cars: 'id, org_id, plate_number, status, last_updated',
            transactions: 'id, org_id, car_id, date, type, last_updated',
            sessions: 'id, token, expires_at',
            profiles: 'id, org_id',
            expenseTemplates: 'id, user_id, title, is_active',
            syncQueue: '++id, table, action, timestamp'
        });
    }
}

export const db = new MyFleetDB();
