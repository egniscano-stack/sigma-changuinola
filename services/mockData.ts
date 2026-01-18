
import { TaxConfig, Taxpayer, TaxType, Transaction, TaxpayerType, CommercialCategory, PaymentMethod, TaxpayerStatus } from "../types";

export const INITIAL_CONFIG: TaxConfig = {
  plateCost: 25.00,
  constructionRatePerSqm: 1.50,
  garbageResidentialRate: 5.00,
  garbageCommercialRate: 15.00,
  commercialBaseRate: 10.00,
  liquorLicenseRate: 150.00,
  advertisementRate: 20.00,
  commercialRates: {
    [CommercialCategory.NONE]: 0,
    [CommercialCategory.CLASE_A]: 150.00, // Supermarkets, Banks
    [CommercialCategory.CLASE_B]: 75.00,  // Standard Stores
    [CommercialCategory.CLASE_C]: 25.00,  // Small Shops
  }
};

export const MOCK_TAXPAYERS: Taxpayer[] = [
  {
    id: '1',
    taxpayerNumber: '2023-0001',
    type: TaxpayerType.JURIDICA,
    status: TaxpayerStatus.ACTIVO,
    hasCommercialActivity: true,
    commercialCategory: CommercialCategory.CLASE_A,
    commercialName: 'Super Changuinola Principal',
    docId: '155698888',
    dv: '22',
    name: 'Supermercado Changuinola S.A.',
    address: 'Av. 17 de Abril, Finca 8',
    phone: '758-4444',
    email: 'conta@superchanguinola.com',
    hasConstruction: false,
    hasGarbageService: true,
    vehicles: [],
    createdAt: '2023-01-15'
  },
  {
    id: '2',
    taxpayerNumber: '2023-0002',
    type: TaxpayerType.NATURAL,
    status: TaxpayerStatus.ACTIVO,
    hasCommercialActivity: false,
    commercialCategory: CommercialCategory.NONE,
    docId: '1-789-456',
    name: 'Juan Pérez del Toro',
    address: 'Empalme, Calle Principal',
    phone: '6655-8899',
    email: 'juan.perez@email.com',
    hasConstruction: true,
    hasGarbageService: true,
    vehicles: [
      {
        plate: 'AB-1234',
        brand: 'Toyota',
        model: 'Hilux',
        year: '2019',
        color: 'Blanco',
        motorSerial: '1KD-998877',
        chassisSerial: 'JTE-12345678',
        hasTransferDocuments: true
      }
    ],
    createdAt: '2023-03-10'
  },
  {
    id: '3',
    taxpayerNumber: '2023-0003',
    type: TaxpayerType.JURIDICA,
    status: TaxpayerStatus.ACTIVO,
    hasCommercialActivity: true,
    commercialCategory: CommercialCategory.CLASE_C,
    commercialName: 'El Banano Feliz',
    docId: '200-888-999',
    dv: '01',
    name: 'Kiosco El Banano',
    address: 'Finca 12, Parada de Buses',
    phone: '6600-1122',
    email: 'kiosco@email.com',
    hasConstruction: false,
    hasGarbageService: true,
    vehicles: [],
    createdAt: '2023-06-20'
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'TX-998877',
    taxpayerId: '1',
    taxType: TaxType.COMERCIO,
    amount: 150.00,
    date: '2023-10-05',
    time: '08:30:00',
    description: 'Impuesto Municipal Mensual - Octubre',
    status: 'PAGADO',
    paymentMethod: PaymentMethod.CHEQUE,
    tellerName: 'Cajero Ventanilla 1'
  },
  {
    id: 'TX-998878',
    taxpayerId: '2',
    taxType: TaxType.VEHICULO,
    amount: 25.00,
    date: '2023-10-12',
    time: '09:15:00',
    description: 'Renovación de Placa 2023 - Toyota Hilux',
    status: 'PAGADO',
    paymentMethod: PaymentMethod.EFECTIVO,
    tellerName: 'Cajero Ventanilla 1',
    metadata: { plateNumber: 'AB-1234' }
  }
];
