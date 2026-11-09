export type AppSurface = 'website' | 'admin' | 'portal';

export type AdminModuleKey =
  | 'dashboard'
  | 'customers_list'
  | 'customers_add'
  | 'customers_detail'
  | 'customers_bulk_recharge'
  | 'customers_online'
  | 'customers_due'
  | 'customers_vip'
  | 'packages'
  | 'routers'
  | 'pppoe_sessions'
  | 'hotspot'
  | 'pops'
  | 'ip_logs'
  | 'corporate'
  | 'corporate_mrtg'
  | 'resellers'
  | 'resellers_tariffs'
  | 'billing_payments'
  | 'billing_sync'
  | 'billing_gateway'
  | 'tickets_list'
  | 'tickets_create'
  | 'tasks'
  | 'sms'
  | 'sms_templates'
  | 'accounts'
  | 'accounts_audit'
  | 'accounts_pnl'
  | 'accounts_cashflow'
  | 'employees'
  | 'employees_rbac'
  | 'reports'
  | 'reports_cpe'
  | 'audit_logs'
  | 'settings'
  | 'settings_backup';

export type OperatorMode = 'COMPANY' | 'STAFF' | 'RESELLER';

export interface ActiveOperatorSession {
  mode: OperatorMode;
  displayName: string;
  username: string;
  roleLabel: string;
  allowedPops: string[]; // Empty or ['ALL'] means unrestricted
  allowedCashChannels: string[]; // Empty or ['ALL'] means unrestricted
  resellerId?: string;
  canEditPackage: boolean;
  canCollectCash: boolean;
  canManageRouter: boolean;
  canDeleteRecord: boolean;
}

export interface WorkspaceSettings {
  id: string;
  ownerUid: string;
  companyName: string;
  companyCode: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  bkashMerchant: string;
  rocketMerchant: string;
  nagadMerchant: string;
  paymentGatewayProvider: string;
  paymentGatewayEnabled: boolean;
  smsSenderId: string;
  smsMasking: boolean;
  smsBalance: number;
  smsRate: number;
  routerSandboxMode: boolean;
  keeperAlertOnLogin: boolean;
  btrcLicenseNo: string;
  seeded: boolean;
}

export interface PopZone {
  id: string;
  ownerUid: string;
  name: string;
  code: string;
  zoneName: string;
  oltInfo: string;
  address: string;
  managerName: string;
  status: 'Active' | 'Maintenance' | 'Inactive';
}

export interface IspPackage {
  id: string;
  ownerUid: string;
  name: string;
  planType: 'Prepaid' | 'Postpaid' | 'Hotspot' | 'Corporate';
  serviceType: 'PPPoE' | 'Hotspot' | 'Static IP';
  downloadMbps: number;
  uploadMbps: number;
  mikrotikQueue: string;
  monthlyRate: number;
  resellerRate: number;
  poolName: string;
  validityDays: number;
  status: 'Active' | 'Archived';
}

export interface MikrotikRouter {
  id: string;
  ownerUid: string;
  name: string;
  host: string;
  apiPort: number;
  username: string;
  popName: string;
  model: string;
  rosVersion: string;
  mode: 'Sandbox' | 'Live';
  radiusSecret: string;
  status: 'Connected' | 'Disconnected' | 'Testing';
  activeSessions: number;
  cpuLoad: number;
  uptime: string;
}

export interface Customer {
  id: string;
  ownerUid: string;
  custId: string;
  username: string;
  password: string;
  name: string;
  mobile: string;
  email: string;
  address: string;
  nidNumber: string;
  popName: string;
  zoneName: string;
  packageId: string;
  packageName: string;
  monthlyRate: number;
  balance: number;
  billingCycle: string;
  expiryDate: string;
  lockStatus: 'Unlocked' | 'Locked';
  accountStatus: 'Active' | 'Expired' | 'Disabled';
  category: 'Regular' | 'VIP' | 'Free';
  planType: 'Prepaid' | 'Postpaid';
  ipAddress: string;
  macAddress: string;
  mikrotikQueue: string;
  routerName: string;
  isOnline: boolean;
  lastLogout: string;
  iRef: string;
  resellerId: string;
  fiberLength: string;
  cpeModel: string;
  oltPort: string;
  linkRemarks: string;
  avatarType: 'male' | 'female';
  mobileVerified: boolean;
}

export interface Reseller {
  id: string;
  ownerUid: string;
  username: string;
  password: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  popName: string;
  balance: number;
  creditLimit: number;
  smsBalance: number;
  smsRate: number;
  allowedCycles: string;
  customRateDiscount: number;
  totalCustomers: number;
  status: 'Active' | 'Suspended';
}

export interface Employee {
  id: string;
  ownerUid: string;
  username: string;
  password: string;
  fullName: string;
  mobile: string;
  email: string;
  role: 'Super Admin' | 'Billing' | 'Support' | 'NOC' | 'Operations' | 'POP Manager';
  department: string;
  allowedPops: string;
  allowedCashChannels: string;
  canEditPackage: boolean;
  canCollectCash: boolean;
  canManageRouter: boolean;
  canDeleteRecord: boolean;
  status: 'Active' | 'Inactive';
}

export interface PaymentRecord {
  id: string;
  ownerUid: string;
  trxNumber: string;
  targetType: 'Home' | 'Corporate' | 'Reseller';
  customerId: string;
  customerUsername: string;
  customerName: string;
  amount: number;
  chargeAmount: number;
  billForMonths: number;
  method: 'CASH' | 'bKash Sync' | 'Rocket Sync' | 'Nagad Sync' | 'Online Card' | 'Bank';
  channel: string;
  receivedBy: string;
  syncSource: string;
  senderMobile: string;
  status: 'Completed' | 'Pending' | 'Failed' | 'Void';
  remarks: string;
  oldExpiry: string;
  newExpiry: string;
  paymentDate: string;
}

export interface SupportTicket {
  id: string;
  ownerUid: string;
  ticketNo: string;
  customerId: string;
  customerUsername: string;
  customerName: string;
  contact: string;
  email: string;
  popName: string;
  address: string;
  customerBalance: number;
  customerExpiry: string;
  lockStatus: 'Unlocked' | 'Locked';
  issueType: string;
  description: string;
  assignedTo: string;
  createdBy: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Normal' | 'High' | 'Critical';
  lastComment: string;
  smsSentCustomer: boolean;
  smsSentStaff: boolean;
}

export interface TicketComment {
  id: string;
  ownerUid: string;
  ticketId: string;
  author: string;
  authorRole: string;
  message: string;
  timestampStr: string;
}

export interface StaffTask {
  id: string;
  ownerUid: string;
  title: string;
  category: string;
  assignedTo: string;
  popName: string;
  relatedCustomer: string;
  dueDate: string;
  priority: 'Normal' | 'High' | 'Urgent';
  status: 'Pending' | 'In Progress' | 'Completed';
  notes: string;
}

export interface CorporateClient {
  id: string;
  ownerUid: string;
  companyName: string;
  clientCode: string;
  contactPerson: string;
  mobile: string;
  email: string;
  address: string;
  popName: string;
  iigMbps: number;
  bdixMbps: number;
  cacheMbps: number;
  dataConnectivityMbps: number;
  publicIpCount: number;
  serverRentQty: number;
  monthlyTotal: number;
  balance: number;
  billingCycle: string;
  mrtgLinkId: string;
  status: 'Active' | 'Suspended';
}

export interface LedgerEntry {
  id: string;
  ownerUid: string;
  entryNo: string;
  entryType: 'Staff Cash Transfer' | 'Income' | 'Expense' | 'Vendor Invoice' | 'Vendor Payment';
  accountHead: string;
  channel: string;
  staffName: string;
  vendorName: string;
  invoiceRef: string;
  debit: number;
  credit: number;
  amount: number;
  status: 'Posted' | 'Pending Audit' | 'Void';
  entryDate: string;
  remarks: string;
}

export interface OperationalLog {
  id: string;
  ownerUid: string;
  logCategory: 'sms_template' | 'sms_log' | 'hotspot_voucher' | 'ip_log' | 'audit_log';
  code: string;
  actor: string;
  target: string;
  popName: string;
  title: string;
  details: string;
  metaOne: string;
  metaTwo: string;
  numericVal: number;
  status: string;
  timestampStr: string;
}
