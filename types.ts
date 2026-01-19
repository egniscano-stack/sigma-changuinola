
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
  phone: string;
  email: string;

  // Services & Assets Flags
  hasCommercialActivity: boolean; // Available for both Natural & Juridica
  commercialCategory?: CommercialCategory;
  commercialName?: string; // Nombre del establecimiento

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
  metadata?: Record<string, any>;
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
  confidence: number;
}

// Authentication Types
export type UserRole = 'ADMIN' | 'CAJERO' | 'CONTRIBUYENTE' | 'AUDITOR' | 'REGISTRO';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  password?: string; // Included for demo purposes to allow creating users
}
