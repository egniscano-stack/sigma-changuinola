
import { supabase } from './supabaseClient';
import { Taxpayer, Transaction, User, TaxConfig, TaxpayerType, TaxpayerStatus, CommercialCategory, PaymentMethod, UserRole, TaxType, VehicleInfo } from '../types';

// --- DATA MAPPING HELPERS (Snake_case DB <-> CamelCase App) ---

const mapTaxpayerFromDB = (data: any): Taxpayer => ({
    id: data.id,
    taxpayerNumber: data.taxpayer_number,
    type: data.type as TaxpayerType,
    status: data.status as TaxpayerStatus,
    docId: data.doc_id,
    dv: data.dv,
    name: data.name,
    address: data.address,
    phone: data.phone,
    email: data.email,
    hasCommercialActivity: data.has_commercial_activity,
    commercialCategory: data.commercial_category as CommercialCategory,
    commercialName: data.commercial_name,
    hasConstruction: data.has_construction,
    hasGarbageService: data.has_garbage_service,
    vehicles: [], // Vehicles loaded separately or joined
    createdAt: data.created_at
});

const mapTaxpayerToDB = (data: Taxpayer) => ({
    id: data.id, // Optional for insert if generated
    taxpayer_number: data.taxpayerNumber,
    type: data.type,
    status: data.status,
    doc_id: data.docId,
    dv: data.dv,
    name: data.name,
    address: data.address,
    phone: data.phone,
    email: data.email,
    has_commercial_activity: data.hasCommercialActivity,
    commercial_category: data.commercialCategory,
    commercial_name: data.commercialName,
    has_construction: data.hasConstruction,
    has_garbage_service: data.hasGarbageService
});

const mapTransactionFromDB = (data: any): Transaction => ({
    id: data.id,
    taxpayerId: data.taxpayer_id,
    taxType: data.tax_type as TaxType,
    amount: data.amount,
    date: data.date,
    time: data.time,
    description: data.description,
    status: data.status,
    paymentMethod: data.payment_method as PaymentMethod,
    tellerName: data.teller_name,
    metadata: data.metadata,
});

const mapTransactionToDB = (data: Transaction) => ({
    id: data.id,
    taxpayer_id: data.taxpayerId,
    tax_type: data.taxType,
    amount: data.amount,
    date: data.date,
    time: data.time,
    description: data.description,
    status: data.status,
    payment_method: data.paymentMethod,
    teller_name: data.tellerName,
    metadata: data.metadata
});

// --- API FUNCTIONS ---

export const db = {
    // TAXPAYERS
    getTaxpayers: async (): Promise<Taxpayer[]> => {
        const { data, error } = await supabase.from('taxpayers').select('*');
        if (error) {
            console.error("Error fetching taxpayers:", error);
            throw error;
        }
        return data.map(mapTaxpayerFromDB);
    },

    createTaxpayer: async (taxpayer: Taxpayer) => {
        const dbData = mapTaxpayerToDB(taxpayer);
        // Remove ID to let Postgres generate a valid UUID
        delete (dbData as any).id;

        const { data, error } = await supabase.from('taxpayers').insert(dbData).select().single();
        if (error) {
            console.error("Error creating taxpayer:", error);
            throw error;
        }
        return mapTaxpayerFromDB(data);
    },

    updateTaxpayer: async (taxpayer: Taxpayer) => {
        const dbData = mapTaxpayerToDB(taxpayer);
        // Remove ID from the update payload to prevent PK update errors
        const idToUpdate = dbData.id;
        delete (dbData as any).id;

        const { data, error } = await supabase.from('taxpayers').update(dbData).eq('id', idToUpdate).select().single();

        if (error) {
            console.error("Error updating taxpayer in DB:", error);
            throw error;
        }
        return mapTaxpayerFromDB(data);
    },

    deleteTaxpayer: async (id: string) => {
        const { error } = await supabase.from('taxpayers').delete().eq('id', id);
        if (error) throw error;
    },

    // TRANSACTIONS
    getTransactions: async (): Promise<Transaction[]> => {
        const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(mapTransactionFromDB);
    },

    createTransaction: async (tx: Transaction) => {
        const dbData = mapTransactionToDB(tx);
        // Do NOT remove ID. The column is likely TEXT and requires the client-generated ID.
        console.log("Saving Transaction:", dbData);
        const { data, error } = await supabase.from('transactions').insert(dbData).select().single();
        if (error) {
            console.error("Supabase Create Transaction Error:", error);
            throw error;
        }
        return mapTransactionFromDB(data);
    },

    // USERS (Admin/Teller)
    getAppUsers: async (): Promise<User[]> => {
        const { data, error } = await supabase.from('app_users').select('*');
        if (error) throw error;
        return data as User[];
    },

    createAppUser: async (user: User) => {
        const { data, error } = await supabase.from('app_users').insert(user).select().single();
        if (error) throw error;
        return data as User;
    },

    updateAppUser: async (user: User) => {
        const { data, error } = await supabase.from('app_users').update(user).eq('username', user.username).select().single();
        if (error) throw error;
        return data as User;
    },

    // CONFIG
    getConfig: async (): Promise<TaxConfig | null> => {
        const { data, error } = await supabase.from('system_config').select('config').limit(1).single();
        if (error) return null; // Might be empty initially
        return data.config as TaxConfig;
    },

    updateConfig: async (config: TaxConfig) => {
        // Upsert based on ID 1
        const { data, error } = await supabase.from('system_config').upsert({ id: 1, config }).select().single();
        if (error) throw error;
        return data.config;
    }
};
