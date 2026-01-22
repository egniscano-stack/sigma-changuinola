
// Enums for standardizing tax types
export enum TaxType {
  VEHICULO = 'VEHICULO',
  CONSTRUCCION = 'CONSTRUCCION',
  BASURA = 'BASURA',
  COMERCIO = 'COMERCIO',
}

export enum TaxpayerType {
  NATURAL = 'NATURAL',
  JURIDICA = 'JURIDICA',
}

export enum TaxpayerStatus {
  ACTIVO = 'ACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  BLOQUEADO = 'BLOQUEADO',
  MOROSO = 'MOROSO',
}

export enum CommercialCategory {
  NONE = 'NONE',
  CLASE_A = 'CLASE_A', // Banks, Supermarkets (High)
  CLASE_B = 'CLASE_B', // Stores, Pharmacies (Medium)
  CLASE_C = 'CLASE_C', // Small Kiosks (Low)
}

export enum PaymentMethod {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  CHEQUE = 'CHEQUE',
  ONLINE = 'ONLINE', // Payment via Portal
  ARREGLO_PAGO = 'ARREGLO_PAGO', // New for Special Arrangement
}

export interface VehicleInfo {
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  motorSerial: string;
  chassisSerial: string;
  hasTransferDocuments: boolean; // Documentacion de traspaso
}

// Corregimientos defined by requirements
export enum Corregimiento {
  FINCA_4 = 'Finca 4',
  GUABITO = 'Guabito',
  FINCA_66 = 'Finca 66',
  EMPALME = 'Empalme',
  FINCA_51 = 'Finca 51',
  FINCA_6 = 'Finca 6',
  FINCA_LAS_30 = 'Finca Las 30',
  FINCA_LAS_60 = 'Finca Las 60',
  FINCA_12 = 'Finca 12',
  LAS_TABLAS = 'Las Tablas',
  LAS_DELICIAS = 'Las Delicias',
  CHOCHIGRO = 'Chochigro',
  EL_SILENCIO = 'El Silencio',
  BARANCO = 'Baranco',
  BARRIADA_4_ABRIL = 'Barriada 4 Abril',
  LA_GLORIA = 'La Gloria',
  CHANGUINOLA = 'Changuinola',
  LA_MESA = 'La Mesa',
}

export interface Taxpayer {
  id: string;
  taxpayerNumber: string; // Unique Auto-Generated Number (e.g., 2024-0001)
  type: TaxpayerType;
  status: TaxpayerStatus; // ACTIVO, SUSPENDIDO, BLOQUEADO

  // Identification
  docId: string; // Cédula or RUC
  dv?: string; // Digito Verificador (only for RUC)
  name: string; // Full Name or Razón Social

  // Contact & Location
  address: string;
  corregimiento?: Corregimiento;
  phone: string;
  email: string;

  // Services & Assets Flags
  hasCommercialActivity: boolean; // Available for both Natural & Juridica
  commercialCategory?: CommercialCategory;
  commercialName?: string; // Nombre del establecimiento

  // Economic Status
  balance?: number; // Monto por cobrar (Deuda)

  hasConstruction: boolean; // Active construction permit
  hasGarbageService: boolean; // Active garbage collection

  // Assets
  vehicles?: VehicleInfo[]; // List of registered vehicles

  createdAt: string;
}

export interface Transaction {
  id: string;
  taxpayerId: string;
  taxType: TaxType;
  amount: number;
  date: string;
  time: string;
  description: string;
  status: 'PAGADO' | 'PENDIENTE' | 'ANULADO';
  paymentMethod: PaymentMethod;
  tellerName: string;
  metadata?: Record<string, any>; // Can store arrangement details here
}

export interface TaxConfig {
  plateCost: number;
  constructionRatePerSqm: number;
  garbageResidentialRate: number;
  garbageCommercialRate: number;
  commercialBaseRate: number;
  liquorLicenseRate: number; // New
  advertisementRate: number; // New
  // Dynamic commercial rates
  commercialRates: {
    [key in CommercialCategory]: number;
  };
}

export interface MunicipalityInfo {
  name: string;
  province: string;
  ruc: string;
  phone: string;
  email: string;
  address: string;
}

// AI Analysis Result Interface
export interface ExtractedInvoiceData {
  date?: string;
  amount?: number;
  taxpayerName?: string;
  concept?: string;
  docId?: string;
  taxpayerNumber?: string; // New: Number of Taxpayer
  confidence: number;
}

// Authentication Types
export type UserRole = 'ADMIN' | 'CAJERO' | 'CONTRIBUYENTE' | 'AUDITOR' | 'REGISTRO' | 'ALCALDE' | 'SECRETARIA';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  password?: string; // Included for demo purposes to allow creating users
}

// --- ADMIN REQUESTS (For Void / Arrangement / Taxpayer Edit) ---
export type RequestType = 'VOID_TRANSACTION' | 'PAYMENT_ARRANGEMENT' | 'UPDATE_TAXPAYER';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface AdminRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  requesterName: string;
  taxpayerName: string; // Context

  description: string; // Reason

  // For VOID
  transactionId?: string;

  // For ARRANGEMENT
  totalDebt?: number;

  // For UPDATE_TAXPAYER
  taxpayerId?: string;
  payload?: Partial<Taxpayer>; // New data proposed

  // Admin Response
  responseNote?: string;
  approvedAmount?: number; // The amount to pay NOW
  approvedTotalDebt?: number; // Total agreed debt
  installments?: number; // Number of payments

  createdAt: string;
}

// --- AGENDA Items ---
export interface AgendaItem {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO Date "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endDate?: string;
  endTime?: string;
  type: 'EVENTO' | 'REUNION' | 'TRAMITE' | 'VISITA';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  location?: string;
  createdBy: string; // User ID or Name
  isImportant: boolean;
  rejectionReason?: string;
}
