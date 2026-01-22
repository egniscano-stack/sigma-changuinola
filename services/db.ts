
import { supabase } from './supabaseClient';
import { Taxpayer, Transaction, User, TaxConfig, TaxpayerType, TaxpayerStatus, CommercialCategory, PaymentMethod, UserRole, TaxType, VehicleInfo, AgendaItem, Corregimiento, AdminRequest } from '../types';

// --- DATA MAPPING HELPERS (Snake_case DB <-> CamelCase App) ---

export const mapTaxpayerFromDB = (data: any): Taxpayer => ({
    id: data.id,
    taxpayerNumber: data.taxpayer_number,
    type: data.type as TaxpayerType,
    status: data.status as TaxpayerStatus,
    docId: data.doc_id,
    dv: data.dv,
    name: data.name,
    address: data.address,
    corregimiento: data.corregimiento as Corregimiento,
    phone: data.phone,
    email: data.email,
    hasCommercialActivity: data.has_commercial_activity,
    commercialCategory: data.commercial_category as CommercialCategory,
    commercialName: data.commercial_name,
    balance: data.balance,
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
    corregimiento: data.corregimiento,
    phone: data.phone,
    email: data.email,
    has_commercial_activity: data.hasCommercialActivity,
    commercial_category: data.commercialCategory,
    commercial_name: data.commercialName,
    balance: data.balance || 0,
    has_construction: data.hasConstruction,
    has_garbage_service: data.hasGarbageService
});

export const mapTransactionFromDB = (data: any): Transaction => ({
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

// --- AGENDA MAPPINGS ---

const mapAgendaItemFromDB = (data: any): AgendaItem => ({
    id: data.id,
    title: data.title,
    description: data.description,
    startDate: data.start_date,
    startTime: data.start_time,
    endDate: data.end_date,
    endTime: data.end_time,
    type: data.type,
    status: data.status,
    location: data.location,
    createdBy: data.created_by,
    isImportant: data.is_important,
    rejectionReason: data.rejection_reason
});

const mapAgendaItemToDB = (data: AgendaItem) => ({
    id: data.id,
    title: data.title,
    description: data.description,
    start_date: data.startDate,
    start_time: data.startTime,
    end_date: data.endDate,
    end_time: data.endTime,
    type: data.type,
    status: data.status,
    location: data.location,
    created_by: data.createdBy,
    is_important: data.isImportant,
    rejection_reason: data.rejectionReason
});


// --- ADMIN REQUEST MAPPINGS ---
const mapAdminRequestFromDB = (data: any): AdminRequest => ({
    id: data.id,
    type: data.type,
    status: data.status,
    requesterName: data.requester_name,
    taxpayerName: data.taxpayer_name,
    description: data.description,
    transactionId: data.transaction_id,
    payload: data.payload,
    totalDebt: data.total_debt,
    taxpayerId: data.payload?.id, // Extract from payload if exists
    responseNote: data.response_note,
    approvedAmount: data.approved_amount,
    approvedTotalDebt: data.approved_total_debt,
    installments: data.installments,
    createdAt: data.created_at
});

const mapAdminRequestToDB = (data: AdminRequest) => ({
    id: data.id,
    type: data.type,
    status: data.status,
    requester_name: data.requesterName,
    taxpayer_name: data.taxpayerName,
    description: data.description,
    transaction_id: data.transactionId,
    payload: data.payload,
    total_debt: data.totalDebt,
    response_note: data.responseNote,
    approved_amount: data.approvedAmount,
    approved_total_debt: data.approvedTotalDebt,
    installments: data.installments,
    // created_at is default now()
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
    },


    // AGENDA
    getAgenda: async (): Promise<AgendaItem[]> => {
        const { data, error } = await supabase.from('agenda_items').select('*').order('start_date', { ascending: true }).order('start_time', { ascending: true });
        if (error) {
            console.error("Error fetching agenda:", error);
            return []; // Fail gracefully
        }
        return data.map(mapAgendaItemFromDB);
    },

    createAgendaItem: async (item: AgendaItem) => {
        const dbData = mapAgendaItemToDB(item);
        delete (dbData as any).id; // Let DB generate ID
        const { data, error } = await supabase.from('agenda_items').insert(dbData).select().single();
        if (error) throw error;
        return mapAgendaItemFromDB(data);
    },

    updateAgendaItem: async (item: AgendaItem) => {
        const dbData = mapAgendaItemToDB(item);
        const { data, error } = await supabase.from('agenda_items').update(dbData).eq('id', item.id).select().single();
        if (error) throw error;
        return mapAgendaItemFromDB(data);
    },

    // ADMIN REQUESTS
    getAdminRequests: async (): Promise<AdminRequest[]> => {
        const { data, error } = await supabase.from('admin_requests').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data.map(mapAdminRequestFromDB);
    },

    createAdminRequest: async (req: AdminRequest) => {
        const dbData = mapAdminRequestToDB(req);
        const { data, error } = await supabase.from('admin_requests').insert(dbData).select().single();
        if (error) throw error;
        return mapAdminRequestFromDB(data);
    },

    updateAdminRequest: async (req: AdminRequest) => {
        const dbData = mapAdminRequestToDB(req);
        const { data, error } = await supabase.from('admin_requests').update(dbData).eq('id', req.id).select().single();
        if (error) throw error;
        return mapAdminRequestFromDB(data);
    },

    // CUSTOM QUERY: Get Reports for Mayor (Today, Week, Month counts)
    getReportStats: async () => {
        // This would ideally be a severeal queries or a function.
        // For now, we fetch transactions and calculate client side or use count
        // Optimally:
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        // Let's just return raw transaction data for the dashboard to filter for now
        // to simplify the backend requirements (as we are mocking slightly)
        return db.getTransactions();
    },

    // REALTIME SUBSCRIPTION
    subscribeToChanges: (
        onTaxpayerChange: (payload: any) => void,
        onTransactionChange: (payload: any) => void,
        onAgendaChange?: (payload: any) => void,
        onAdminRequestChange?: (payload: any) => void
    ) => {
        const taxpayersSubscription = supabase
            .channel('public:taxpayers')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'taxpayers' }, (payload) => {
                onTaxpayerChange(payload);
            })
            .subscribe();

        const transactionsSubscription = supabase
            .channel('public:transactions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
                onTransactionChange(payload);
            })
            .subscribe();

        let agendaSubscription: any = null;
        if (onAgendaChange) {
            agendaSubscription = supabase
                .channel('public:agenda_items')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_items' }, (payload) => {
                    onAgendaChange(payload);
                })
                .subscribe();
        }

        let adminReqSubscription: any = null;
        if (onAdminRequestChange) {
            adminReqSubscription = supabase
                .channel('public:admin_requests')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_requests' }, (payload) => {
                    onAdminRequestChange(payload);
                })
                .subscribe();
        }

        return () => {
            supabase.removeChannel(taxpayersSubscription);
            supabase.removeChannel(transactionsSubscription);
            if (agendaSubscription) supabase.removeChannel(agendaSubscription);
            if (adminReqSubscription) supabase.removeChannel(adminReqSubscription);
        };
    }
};
