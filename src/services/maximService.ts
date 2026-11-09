import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  CorporateClient,
  Customer,
  Employee,
  IspPackage,
  LedgerEntry,
  MikrotikRouter,
  OperationalLog,
  PaymentRecord,
  PopZone,
  Reseller,
  StaffTask,
  SupportTicket,
  WorkspaceSettings,
} from '../types';

// Defensive sanitization utilities matching firebase-blueprint.json & firestore.rules
export function cleanStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = String(val ?? '').trim();
  const res = s.length > 0 ? s : fallback;
  return res.slice(0, maxLen);
}

export function optStr(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

export function cleanNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-1000000000, Math.min(1000000000, Math.round(n * 100) / 100));
}

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function formatShortDateTime(date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export const ISP_BRAND_NAME = 'RRR CABLE NETWORK';

export function formatBrandName(name?: string | null): string {
  const trimmed = (name || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'democompany' || trimmed.toLowerCase() === 'maxim') {
    return ISP_BRAND_NAME;
  }
  return trimmed;
}

export function addMonthsToDateStr(currentStr: string, monthsToAdd: number): string {
  const base = new Date();
  const parsed = Date.parse(currentStr);
  const start = !Number.isNaN(parsed) && parsed > base.getTime() ? new Date(parsed) : base;
  start.setMonth(start.getMonth() + Math.max(1, monthsToAdd));
  return start.toISOString().slice(0, 10);
}

/**
 * Unified ISP subscriber balance & due calculation:
 * - Pure Due / Wallet Deposit (billForMonths <= 0 or chargeAmount <= 0): credits +paidAmount directly.
 * - Subscription Renewal (billForMonths >= 1):
 *   If subscriber already has a negative billed balance (arrears), covers up to chargeAmount of that already-billed due
 *   so paying off a -500 due bill brings balance to 0 instead of double-charging, while an active (balance >= 0)
 *   renewal deducts chargeAmount against paidAmount (so paying 500 for a 500 renewal keeps balance at 0, partial 300 -> -200 due, advance 700 -> +200 credit).
 */
export function computeSubscriberBalanceAfterPayment(
  currentBalance: number,
  paidAmount: number,
  chargeAmount: number,
  billForMonths: number
): number {
  const cur = cleanNum(currentBalance, 0);
  const paid = Math.max(0, cleanNum(paidAmount, 0));
  const charge = Math.max(0, cleanNum(chargeAmount, 0));
  if (billForMonths <= 0 || charge <= 0) {
    return cleanNum(cur + paid, 0);
  }
  const priorBilledCovered = cur < 0 ? Math.min(Math.abs(cur), charge) : 0;
  const effectiveNewCharge = charge - priorBilledCovered;
  return cleanNum(cur + paid - effectiveNewCharge, 0);
}

export function computeSubscriberBalanceAfterVoid(
  currentBalance: number,
  paidAmount: number,
  chargeAmount: number,
  billForMonths: number,
  oldExpiry: string
): number {
  const cur = cleanNum(currentBalance, 0);
  const paid = Math.max(0, cleanNum(paidAmount, 0));
  const charge = Math.max(0, cleanNum(chargeAmount, 0));
  if (billForMonths <= 0 || charge <= 0) {
    return cleanNum(cur - paid, 0);
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  const wasExpiredBeforePayment = Boolean(oldExpiry && oldExpiry < todayIso);
  if (wasExpiredBeforePayment) {
    return cleanNum(cur - paid, 0);
  }
  const netAddedOnActiveRenewal = paid - charge;
  return cleanNum(cur - netAddedOnActiveRenewal, 0);
}

// Record Audit Log
export async function logAuditEvent(
  ownerUid: string,
  actor: string,
  title: string,
  details: string,
  target = 'System',
  popName = 'All'
): Promise<void> {
  const id = makeSafeId('aud');
  const path = `operationalLogs/${id}`;
  try {
    await setDoc(doc(db, 'operationalLogs', id), {
      ownerUid,
      logCategory: 'audit_log',
      code: id.slice(0, 16).toUpperCase(),
      actor: cleanStr(actor, 80, 'Operator'),
      target: optStr(target, 120),
      popName: optStr(popName, 80),
      title: cleanStr(title, 160, 'Action'),
      details: optStr(details, 800),
      metaOne: 'AUDIT',
      metaTwo: 'VERIFIED',
      numericVal: 0,
      status: 'Recorded',
      timestampStr: formatShortDateTime(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
}

export function handleSafeFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  try {
    handleFirestoreError(error, operationType, path);
  } catch (err) {
    console.warn(`[Firestore Safe Handler] ${operationType} on ${path}:`, err);
  }
}

export function getStoredCollection<T>(colName: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(`rrr_col_${colName}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return fallback;
}

export function saveStoredCollection<T>(colName: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`rrr_col_${colName}`, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('rrr_data_update', { detail: { colName, items } }));
  } catch {
    // ignore
  }
}

export function addToStoredCollection<T extends { id: string }>(colName: string, item: T): void {
  const current = getStoredCollection<T>(colName, []);
  const updated = [item, ...current.filter((x) => x.id !== item.id)];
  saveStoredCollection(colName, updated);
}

export function updateInStoredCollection<T extends { id: string }>(
  colName: string,
  id: string,
  updates: Partial<T>
): void {
  const current = getStoredCollection<T>(colName, []);
  const updated = current.map((x) => (x.id === id ? { ...x, ...updates } : x));
  saveStoredCollection(colName, updated);
}

export function removeFromStoredCollection<T extends { id: string }>(colName: string, id: string): void {
  const current = getStoredCollection<T>(colName, []);
  const updated = current.filter((x) => x.id !== id);
  saveStoredCollection(colName, updated);
}

function sanitizeUpdatePayload(updates: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && k !== 'id' && k !== 'ownerUid' && k !== 'createdAt') {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

// Generic Create / Update Helpers strictly aligned with Firestore Rules
export async function saveWorkspaceSettings(
  ownerUid: string,
  updates: Partial<Omit<WorkspaceSettings, 'id' | 'ownerUid'>>
): Promise<void> {
  const path = `workspaceSettings/${ownerUid}`;
  try {
    await updateDoc(doc(db, 'workspaceSettings', ownerUid), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createPopZone(
  ownerUid: string,
  payload: Omit<PopZone, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('pop');
  const path = `pops/${id}`;
  try {
    await setDoc(doc(db, 'pops', id), {
      ownerUid,
      name: cleanStr(payload.name, 80, 'New-POP'),
      code: cleanStr(payload.code, 32, 'POP-01'),
      zoneName: optStr(payload.zoneName, 80),
      oltInfo: optStr(payload.oltInfo, 120),
      address: optStr(payload.address, 200),
      managerName: optStr(payload.managerName, 80),
      status: payload.status || 'Active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updatePopZone(
  id: string,
  updates: Partial<Omit<PopZone, 'id' | 'ownerUid'>>
): Promise<void> {
  const path = `pops/${id}`;
  try {
    await updateDoc(doc(db, 'pops', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDocumentByPath(collectionName: string, id: string): Promise<void> {
  const path = `${collectionName}/${id}`;
  removeFromStoredCollection(collectionName, id);
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    handleSafeFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createIspPackage(
  ownerUid: string,
  payload: Omit<IspPackage, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('pkg');
  const path = `packages/${id}`;
  try {
    await setDoc(doc(db, 'packages', id), {
      ownerUid,
      name: cleanStr(payload.name, 80, '5Mbps'),
      planType: payload.planType || 'Prepaid',
      serviceType: payload.serviceType || 'PPPoE',
      downloadMbps: cleanNum(payload.downloadMbps, 5),
      uploadMbps: cleanNum(payload.uploadMbps, 5),
      mikrotikQueue: optStr(payload.mikrotikQueue || 'Package Default', 80),
      monthlyRate: cleanNum(payload.monthlyRate, 500),
      resellerRate: cleanNum(payload.resellerRate, 400),
      poolName: optStr(payload.poolName || 'pppoe-pool', 60),
      validityDays: cleanNum(payload.validityDays, 30),
      status: payload.status || 'Active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateIspPackage(
  id: string,
  updates: Partial<Omit<IspPackage, 'id' | 'ownerUid'>>
): Promise<void> {
  const path = `packages/${id}`;
  try {
    await updateDoc(doc(db, 'packages', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createMikrotikRouter(
  ownerUid: string,
  payload: Omit<MikrotikRouter, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('rtr');
  const path = `routers/${id}`;
  try {
    await setDoc(doc(db, 'routers', id), {
      ownerUid,
      name: cleanStr(payload.name, 80, 'Core-CCR'),
      host: cleanStr(payload.host, 80, '103.114.200.1'),
      apiPort: cleanNum(payload.apiPort, 8728),
      username: cleanStr(payload.username, 60, 'maxim_api'),
      popName: optStr(payload.popName, 80),
      model: optStr(payload.model || 'CCR1036-8G-2S+', 60),
      rosVersion: optStr(payload.rosVersion || '7.15.3', 32),
      mode: payload.mode || 'Sandbox',
      radiusSecret: optStr(payload.radiusSecret || 'maxim_rad_secret', 80),
      status: payload.status || 'Connected',
      activeSessions: cleanNum(payload.activeSessions, 0),
      cpuLoad: cleanNum(payload.cpuLoad, 12),
      uptime: optStr(payload.uptime || '18d 04h 12m', 48),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateMikrotikRouter(
  id: string,
  updates: Partial<Omit<MikrotikRouter, 'id' | 'ownerUid'>>
): Promise<void> {
  const path = `routers/${id}`;
  try {
    await updateDoc(doc(db, 'routers', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createCustomer(
  ownerUid: string,
  payload: Omit<Customer, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('cust');
  const path = `customers/${id}`;
  try {
    await setDoc(doc(db, 'customers', id), {
      ownerUid,
      custId: cleanStr(payload.custId, 32, String(Math.floor(1050 + Math.random() * 8900))),
      username: cleanStr(payload.username, 64, 'user_new'),
      password: cleanStr(payload.password, 64, '123456'),
      name: cleanStr(payload.name, 120, 'Subscriber'),
      mobile: optStr(payload.mobile, 32),
      email: optStr(payload.email, 120),
      address: optStr(payload.address, 240),
      nidNumber: optStr(payload.nidNumber, 40),
      popName: optStr(payload.popName || 'Mirpur-POP', 80),
      zoneName: optStr(payload.zoneName || ISP_BRAND_NAME, 80),
      packageId: optStr(payload.packageId, 128),
      packageName: optStr(payload.packageName || '2Mbps', 80),
      monthlyRate: cleanNum(payload.monthlyRate, 500),
      balance: cleanNum(payload.balance, 0),
      billingCycle: optStr(payload.billingCycle || 'Day of 1', 32),
      expiryDate: optStr(payload.expiryDate || '2026-12-01', 32),
      lockStatus: payload.lockStatus || 'Unlocked',
      accountStatus: payload.accountStatus || 'Active',
      category: payload.category || 'Regular',
      planType: payload.planType || 'Prepaid',
      ipAddress: optStr(payload.ipAddress, 48),
      macAddress: optStr(payload.macAddress, 32),
      mikrotikQueue: optStr(payload.mikrotikQueue || 'Package Default', 80),
      routerName: optStr(payload.routerName || 'Mirpur-Core-CCR1036', 80),
      isOnline: Boolean(payload.isOnline),
      lastLogout: optStr(payload.lastLogout || 'Active Session', 64),
      iRef: optStr(payload.iRef, 64),
      resellerId: optStr(payload.resellerId, 128),
      fiberLength: optStr(payload.fiberLength || '150.0m', 32),
      cpeModel: optStr(payload.cpeModel || 'GPON ONU-HG8310M', 80),
      oltPort: optStr(payload.oltPort || '1', 32),
      linkRemarks: optStr(payload.linkRemarks, 200),
      avatarType: payload.avatarType || 'male',
      mobileVerified: Boolean(payload.mobileVerified),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateCustomer(
  id: string,
  updates: Partial<Omit<Customer, 'id' | 'ownerUid'>>
): Promise<void> {
  const path = `customers/${id}`;
  try {
    await updateDoc(doc(db, 'customers', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createPaymentRecord(
  ownerUid: string,
  payload: Omit<PaymentRecord, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('pay');
  const path = `payments/${id}`;
  try {
    await setDoc(doc(db, 'payments', id), {
      ownerUid,
      trxNumber: cleanStr(payload.trxNumber, 64, `TRX-${Date.now().toString(36).toUpperCase()}`),
      targetType: payload.targetType || 'Home',
      customerId: optStr(payload.customerId, 128),
      customerUsername: optStr(payload.customerUsername, 80),
      customerName: optStr(payload.customerName, 120),
      amount: cleanNum(payload.amount, 0),
      chargeAmount: cleanNum(payload.chargeAmount, 0),
      billForMonths: cleanNum(payload.billForMonths, 1),
      method: payload.method || 'CASH',
      channel: optStr(payload.channel || 'Office Cash', 64),
      receivedBy: optStr(payload.receivedBy || ISP_BRAND_NAME, 80),
      syncSource: optStr(payload.syncSource || 'Manual', 64),
      senderMobile: optStr(payload.senderMobile, 32),
      status: payload.status || 'Completed',
      remarks: optStr(payload.remarks, 240),
      oldExpiry: optStr(payload.oldExpiry, 32),
      newExpiry: optStr(payload.newExpiry, 32),
      paymentDate: optStr(payload.paymentDate || formatShortDateTime(), 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updatePaymentRecord(
  id: string,
  updates: Pick<PaymentRecord, 'status' | 'remarks' | 'receivedBy'>
): Promise<void> {
  const path = `payments/${id}`;
  try {
    await updateDoc(doc(db, 'payments', id), {
      status: updates.status,
      remarks: optStr(updates.remarks, 240),
      receivedBy: optStr(updates.receivedBy, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createReseller(
  ownerUid: string,
  payload: Omit<Reseller, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('sdt');
  const path = `resellers/${id}`;
  try {
    await setDoc(doc(db, 'resellers', id), {
      ownerUid,
      username: cleanStr(payload.username, 64, 'reseller_user'),
      password: cleanStr(payload.password, 64, '123456'),
      companyName: cleanStr(payload.companyName, 120, 'Sub-Dealer Net'),
      contactPerson: optStr(payload.contactPerson, 100),
      mobile: optStr(payload.mobile, 32),
      popName: optStr(payload.popName || 'Mirpur-POP', 80),
      balance: cleanNum(payload.balance, 0),
      creditLimit: cleanNum(payload.creditLimit, 0),
      smsBalance: cleanNum(payload.smsBalance, 0),
      smsRate: cleanNum(payload.smsRate, 0.35),
      allowedCycles: optStr(payload.allowedCycles || 'Day of 1, Day of 5, Day of 10', 120),
      customRateDiscount: cleanNum(payload.customRateDiscount, 15),
      totalCustomers: cleanNum(payload.totalCustomers, 0),
      status: payload.status || 'Active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateReseller(
  id: string,
  updates: Partial<Omit<Reseller, 'id' | 'ownerUid'>>
): Promise<void> {
  const path = `resellers/${id}`;
  try {
    await updateDoc(doc(db, 'resellers', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createEmployee(
  ownerUid: string,
  payload: Omit<Employee, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('emp');
  const path = `employees/${id}`;
  try {
    await setDoc(doc(db, 'employees', id), {
      ownerUid,
      username: cleanStr(payload.username, 64, 'staff_user'),
      password: cleanStr(payload.password, 64, '123456'),
      fullName: cleanStr(payload.fullName, 120, 'Staff Member'),
      mobile: optStr(payload.mobile, 32),
      email: optStr(payload.email, 120),
      role: payload.role || 'Support',
      department: optStr(payload.department || 'Operations', 64),
      allowedPops: optStr(payload.allowedPops || 'ALL', 200),
      allowedCashChannels: optStr(payload.allowedCashChannels || 'CASH, bKash Sync, Bank', 200),
      canEditPackage: Boolean(payload.canEditPackage),
      canCollectCash: Boolean(payload.canCollectCash),
      canManageRouter: Boolean(payload.canManageRouter),
      canDeleteRecord: Boolean(payload.canDeleteRecord),
      status: payload.status || 'Active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateEmployee(
  id: string,
  updates: Partial<Omit<Employee, 'id' | 'ownerUid'>>
): Promise<void> {
  const path = `employees/${id}`;
  try {
    await updateDoc(doc(db, 'employees', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createSupportTicket(
  ownerUid: string,
  payload: Omit<SupportTicket, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('tkt');
  const path = `tickets/${id}`;
  try {
    await setDoc(doc(db, 'tickets', id), {
      ownerUid,
      ticketNo: cleanStr(payload.ticketNo, 32, String(Math.floor(6410 + Math.random() * 2500))),
      customerId: optStr(payload.customerId, 128),
      customerUsername: optStr(payload.customerUsername, 80),
      customerName: optStr(payload.customerName, 120),
      contact: optStr(payload.contact, 32),
      email: optStr(payload.email, 120),
      popName: optStr(payload.popName, 80),
      address: optStr(payload.address, 240),
      customerBalance: cleanNum(payload.customerBalance, 0),
      customerExpiry: optStr(payload.customerExpiry, 32),
      lockStatus: payload.lockStatus || 'Unlocked',
      issueType: cleanStr(payload.issueType, 80, 'Connection Problem'),
      description: cleanStr(payload.description, 1000, 'Customer reported connectivity issue.'),
      assignedTo: optStr(payload.assignedTo || 'demooperation', 80),
      createdBy: optStr(payload.createdBy || ISP_BRAND_NAME, 80),
      status: payload.status || 'Open',
      priority: payload.priority || 'Normal',
      lastComment: optStr(payload.lastComment, 500),
      smsSentCustomer: Boolean(payload.smsSentCustomer),
      smsSentStaff: Boolean(payload.smsSentStaff),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateSupportTicket(
  id: string,
  updates: Partial<
    Pick<
      SupportTicket,
      'assignedTo' | 'status' | 'priority' | 'lastComment' | 'issueType' | 'description' | 'smsSentCustomer' | 'smsSentStaff'
    >
  >
): Promise<void> {
  const path = `tickets/${id}`;
  try {
    await updateDoc(doc(db, 'tickets', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addTicketComment(
  ownerUid: string,
  ticketId: string,
  author: string,
  authorRole: string,
  message: string
): Promise<void> {
  const commentId = makeSafeId('cmt');
  const path = `tickets/${ticketId}/comments/${commentId}`;
  const ts = formatShortDateTime();
  try {
    await setDoc(doc(db, 'tickets', ticketId, 'comments', commentId), {
      ownerUid,
      ticketId,
      author: cleanStr(author, 80, 'Staff'),
      authorRole: cleanStr(authorRole, 32, 'Operator'),
      message: cleanStr(message, 800, 'Updated ticket.'),
      timestampStr: ts,
      createdAt: serverTimestamp(),
    });
    await updateSupportTicket(ticketId, {
      lastComment: optStr(`${ts.slice(0, 11)} ${author}: ${message}`, 500),
    });
  } catch (error) { handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createStaffTask(
  ownerUid: string,
  payload: Omit<StaffTask, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('tsk');
  const path = `tasks/${id}`;
  try {
    await setDoc(doc(db, 'tasks', id), {
      ownerUid,
      title: cleanStr(payload.title, 160, 'Field Task'),
      category: optStr(payload.category || 'Fiber Maintenance', 64),
      assignedTo: optStr(payload.assignedTo || 'demooperation', 80),
      popName: optStr(payload.popName || 'Mirpur-POP', 80),
      relatedCustomer: optStr(payload.relatedCustomer, 80),
      dueDate: optStr(payload.dueDate || '2026-11-10', 32),
      priority: payload.priority || 'Normal',
      status: payload.status || 'Pending',
      notes: optStr(payload.notes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateStaffTask(
  id: string,
  updates: Partial<Omit<StaffTask, 'id' | 'ownerUid'>>
): Promise<void> {
  const path = `tasks/${id}`;
  try {
    await updateDoc(doc(db, 'tasks', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createCorporateClient(
  ownerUid: string,
  payload: Omit<CorporateClient, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('corp');
  const path = `corporateClients/${id}`;
  try {
    await setDoc(doc(db, 'corporateClients', id), {
      ownerUid,
      companyName: cleanStr(payload.companyName, 120, 'Corporate Client'),
      clientCode: cleanStr(payload.clientCode, 32, `CORP-${Math.floor(100 + Math.random() * 899)}`),
      contactPerson: optStr(payload.contactPerson, 100),
      mobile: optStr(payload.mobile, 32),
      email: optStr(payload.email, 120),
      address: optStr(payload.address, 240),
      popName: optStr(payload.popName || 'Mirpur-POP', 80),
      iigMbps: cleanNum(payload.iigMbps, 50),
      bdixMbps: cleanNum(payload.bdixMbps, 100),
      cacheMbps: cleanNum(payload.cacheMbps, 150),
      dataConnectivityMbps: cleanNum(payload.dataConnectivityMbps, 20),
      publicIpCount: cleanNum(payload.publicIpCount, 2),
      serverRentQty: cleanNum(payload.serverRentQty, 0),
      monthlyTotal: cleanNum(payload.monthlyTotal, 25000),
      balance: cleanNum(payload.balance, 0),
      billingCycle: optStr(payload.billingCycle || 'Day of 1', 32),
      mrtgLinkId: optStr(payload.mrtgLinkId || id.toUpperCase(), 64),
      status: payload.status || 'Active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateCorporateClient(
  id: string,
  updates: Partial<Omit<CorporateClient, 'id' | 'ownerUid'>>
): Promise<void> {
  const path = `corporateClients/${id}`;
  try {
    await updateDoc(doc(db, 'corporateClients', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createLedgerEntry(
  ownerUid: string,
  payload: Omit<LedgerEntry, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('led');
  const path = `ledgerEntries/${id}`;
  try {
    await setDoc(doc(db, 'ledgerEntries', id), {
      ownerUid,
      entryNo: cleanStr(payload.entryNo, 40, `VCH-${Date.now().toString(36).toUpperCase()}`),
      entryType: payload.entryType || 'Income',
      accountHead: optStr(payload.accountHead || 'General Cash', 80),
      channel: optStr(payload.channel || 'Office Cash', 64),
      staffName: optStr(payload.staffName, 80),
      vendorName: optStr(payload.vendorName, 100),
      invoiceRef: optStr(payload.invoiceRef, 64),
      debit: cleanNum(payload.debit, 0),
      credit: cleanNum(payload.credit, 0),
      amount: cleanNum(payload.amount, 0),
      status: payload.status || 'Posted',
      entryDate: optStr(payload.entryDate || new Date().toISOString().slice(0, 10), 32),
      remarks: optStr(payload.remarks, 240),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateLedgerEntry(
  id: string,
  updates: Pick<LedgerEntry, 'status' | 'remarks' | 'channel'>
): Promise<void> {
  const path = `ledgerEntries/${id}`;
  try {
    await updateDoc(doc(db, 'ledgerEntries', id), {
      status: updates.status,
      remarks: optStr(updates.remarks, 240),
      channel: optStr(updates.channel, 64),
      updatedAt: serverTimestamp(),
    });
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createOperationalLog(
  ownerUid: string,
  payload: Omit<OperationalLog, 'id' | 'ownerUid'>
): Promise<string> {
  const id = makeSafeId('opl');
  const path = `operationalLogs/${id}`;
  try {
    await setDoc(doc(db, 'operationalLogs', id), {
      ownerUid,
      logCategory: payload.logCategory,
      code: optStr(payload.code, 64),
      actor: optStr(payload.actor, 80),
      target: optStr(payload.target, 120),
      popName: optStr(payload.popName, 80),
      title: optStr(payload.title, 160),
      details: optStr(payload.details, 800),
      metaOne: optStr(payload.metaOne, 120),
      metaTwo: optStr(payload.metaTwo, 120),
      numericVal: cleanNum(payload.numericVal, 0),
      status: optStr(payload.status || 'Active', 32),
      timestampStr: optStr(payload.timestampStr || formatShortDateTime(), 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    }
  catch (error) {
    handleSafeFirestoreError(error, OperationType.CREATE, path);
  }
  return id;
}

export async function updateOperationalLog(
  id: string,
  updates: Partial<Pick<OperationalLog, 'title' | 'details' | 'metaOne' | 'metaTwo' | 'numericVal' | 'status'>>
): Promise<void> {
  const path = `operationalLogs/${id}`;
  try {
    await updateDoc(doc(db, 'operationalLogs', id), sanitizeUpdatePayload(updates as Record<string, unknown>));
  } catch (error) { handleSafeFirestoreError(error, OperationType.UPDATE, path);
  }
}

// MikroTik Backend Proxy Action Invoker
export async function invokeMikrotikApi(payload: {
  action: string;
  username: string;
  packageName?: string;
  ipAddress?: string;
  macAddress?: string;
  routerName?: string;
  routerHost?: string;
  routerPort?: number;
  sandbox?: boolean;
}): Promise<{ ok: boolean; transcript: string[]; latencyMs: number }> {
  const res = await fetch('/api/mikrotik/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to execute RouterOS command');
  }
  return res.json();
}

export async function syncMikrotikCustomers(options?: {
  host?: string;
  apiPort?: number;
  username?: string;
  password?: string;
  routerName?: string;
  defaultPop?: string;
}): Promise<{
  ok: boolean;
  routerName: string;
  latencyMs: number;
  totalSecrets: number;
  onlineCount: number;
  offlineCount: number;
  disabledCount: number;
  customers: Customer[];
  profiles: string[];
  pops: string[];
}> {
  const res = await fetch('/api/mikrotik/sync-customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: options?.host || '103.54.37.182',
      apiPort: options?.apiPort || 1165,
      username: options?.username || 'PENEL',
      password: options?.password || '03422056',
      routerName: options?.routerName || 'RRR CABLE NETWORK',
      defaultPop: options?.defaultPop || 'rashidpur bzzar',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to sync with MikroTik router');
  }
  return res.json();
}

const activeSeedLocks = new Map<string, Promise<void>>();

export function getInitialSeedData(ownerUid: string, userEmail = 'mobailtelecom201@gmail.com') {
  const settings: WorkspaceSettings = {
    id: ownerUid,
    ownerUid,
    companyName: ISP_BRAND_NAME,
    companyCode: 'COMPANY',
    phone: '09666755955',
    email: cleanStr(userEmail, 120, 'mobailtelecom201@gmail.com'),
    address: 'House# 226/2/Ta/3, West Agargaon (60 feet), Sher-e-Bangla Nagar, Dhaka-1207',
    currency: 'BDT',
    bkashMerchant: '01713336401',
    rocketMerchant: '017133364019',
    nagadMerchant: '01713336402',
    paymentGatewayProvider: 'SSLCommerz (VISA / MasterCard / AmEx / DBBL Nexus)',
    paymentGatewayEnabled: true,
    smsSenderId: 'RRR-CABLE',
    smsMasking: true,
    smsBalance: 4850,
    smsRate: 0.35,
    routerSandboxMode: false,
    keeperAlertOnLogin: true,
    btrcLicenseNo: 'BTRC-ISP-NAT-2026-094',
    seeded: true,
  };

  const pops: PopZone[] = [
    { id: 'pop_rashidpur', ownerUid, name: 'rashidpur bzzar', code: 'RSH-01', zoneName: 'RRR CABLE NETWORK', oltInfo: 'GPON OLT (8 PON)', address: 'Rashidpur Bazar, Bangladesh', managerName: 'admin', status: 'Active' },
    { id: 'pop_mirpur', ownerUid, name: 'Mirpur-POP', code: 'MIR-01', zoneName: ISP_BRAND_NAME, oltInfo: 'BDCOM GP3600-08B (8 PON)', address: 'Mirpur-2, Section-2, Dhaka', managerName: 'mirpur_mgr', status: 'Active' },
    { id: 'pop_shamoli', ownerUid, name: 'Shamoli-POP', code: 'SHM-02', zoneName: ISP_BRAND_NAME, oltInfo: 'VSOL V1600G1-B (8 PON)', address: 'Ring Road, Shamoli, Dhaka', managerName: 'demooperation', status: 'Active' },
    { id: 'pop_uttara', ownerUid, name: 'Uttara-POP', code: 'UTT-03', zoneName: 'uttara_zone', oltInfo: 'Huawei MA5608T GPON', address: 'Sector-7, Uttara, Dhaka', managerName: 'noc_tanvir', status: 'Active' },
    { id: 'pop_dhanmondi', ownerUid, name: 'Dhanmondi-POP', code: 'DHN-04', zoneName: ISP_BRAND_NAME, oltInfo: 'C-Data FD1608S-B0', address: 'Road-27, Dhanmondi, Dhaka', managerName: 'demooperation', status: 'Active' },
  ];

  const pkg25M = 'pkg_25mbps';
  const pkg30M = 'pkg_30mbps';
  const pkg35M = 'pkg_35mbps';
  const pkgMir1 = 'pkg_1m';
  const pkgMir2 = 'pkg_2m';
  const pkgPool = 'pkg_2mpool';
  const pkgHome15 = 'pkg_15m';
  const pkgVip30 = 'pkg_30m';
  const pkgHotspot = 'pkg_hs7';

  const packages: IspPackage[] = [
    { id: pkg25M, ownerUid, name: '25-Mbps', planType: 'Prepaid', serviceType: 'PPPoE', downloadMbps: 25, uploadMbps: 25, mikrotikQueue: 'Queue-25-Mbps', monthlyRate: 800, resellerRate: 600, poolName: 'pppoe-pool', validityDays: 30, status: 'Active' },
    { id: pkg30M, ownerUid, name: '30-Mbps', planType: 'Prepaid', serviceType: 'PPPoE', downloadMbps: 30, uploadMbps: 30, mikrotikQueue: 'Queue-30-Mbps', monthlyRate: 1000, resellerRate: 750, poolName: 'pppoe-pool', validityDays: 30, status: 'Active' },
    { id: pkg35M, ownerUid, name: '35-Mbps', planType: 'Prepaid', serviceType: 'PPPoE', downloadMbps: 35, uploadMbps: 35, mikrotikQueue: 'Queue-35-Mbps', monthlyRate: 1200, resellerRate: 900, poolName: 'pppoe-pool', validityDays: 30, status: 'Active' },
    { id: pkgMir1, ownerUid, name: '1Mbps', planType: 'Prepaid', serviceType: 'PPPoE', downloadMbps: 10, uploadMbps: 10, mikrotikQueue: 'Package Default', monthlyRate: 500, resellerRate: 380, poolName: 'pppoe-std-pool', validityDays: 30, status: 'Active' },
    { id: pkgMir2, ownerUid, name: '2Mbps', planType: 'Prepaid', serviceType: 'PPPoE', downloadMbps: 20, uploadMbps: 20, mikrotikQueue: 'Package Default', monthlyRate: 800, resellerRate: 620, poolName: 'pppoe-plus-pool', validityDays: 30, status: 'Active' },
    { id: pkgPool, ownerUid, name: '2Mbps-Pool', planType: 'Prepaid', serviceType: 'PPPoE', downloadMbps: 15, uploadMbps: 15, mikrotikQueue: 'Package Default', monthlyRate: 600, resellerRate: 460, poolName: 'mirpur-shared-pool', validityDays: 30, status: 'Active' },
    { id: pkgHome15, ownerUid, name: '15Mbps-Turbo', planType: 'Prepaid', serviceType: 'PPPoE', downloadMbps: 15, uploadMbps: 15, mikrotikQueue: 'PCQ-15M-Burst', monthlyRate: 1000, resellerRate: 780, poolName: 'turbo-pool', validityDays: 30, status: 'Active' },
    { id: pkgVip30, ownerUid, name: '30Mbps-VIP', planType: 'Postpaid', serviceType: 'Static IP', downloadMbps: 30, uploadMbps: 30, mikrotikQueue: 'SimpleQueue-Dedicated', monthlyRate: 1800, resellerRate: 1450, poolName: 'vip-public-pool', validityDays: 30, status: 'Active' },
    { id: pkgHotspot, ownerUid, name: 'Hotspot-7Day-Unlimited', planType: 'Hotspot', serviceType: 'Hotspot', downloadMbps: 10, uploadMbps: 10, mikrotikQueue: 'HS-Default-10M', monthlyRate: 150, resellerRate: 110, poolName: 'hotspot-pool', validityDays: 7, status: 'Active' },
  ];

  const routers: MikrotikRouter[] = [
    {
      id: 'rtr_rrr_network',
      ownerUid,
      name: 'RRR CABLE NETWORK',
      host: '103.54.37.182',
      apiPort: 1165,
      username: 'PENEL',
      popName: 'rashidpur bzzar',
      model: 'RB750Gr3 (hEX)',
      rosVersion: '6.49.20 (long-term)',
      mode: 'Live',
      radiusSecret: '03422056',
      status: 'Connected',
      activeSessions: 60,
      cpuLoad: 3,
      uptime: '17h 25m',
    },
    { id: 'rtr_mirpur', ownerUid, name: 'Mirpur-Core-CCR1036', host: '103.114.200.2', apiPort: 8728, username: 'maxim_radius', popName: 'Mirpur-POP', model: 'CCR1036-8G-2S+', rosVersion: '7.15.3', mode: 'Sandbox', radiusSecret: 'rad_mirpur_99', status: 'Connected', activeSessions: 312, cpuLoad: 14, uptime: '42d 14h 28m' },
    { id: 'rtr_shamoli', ownerUid, name: 'Shamoli-Edge-CCR2004', host: '103.114.200.14', apiPort: 8728, username: 'maxim_radius', popName: 'Shamoli-POP', model: 'CCR2004-16G-2S+', rosVersion: '7.14.2', mode: 'Sandbox', radiusSecret: 'rad_shamoli_88', status: 'Connected', activeSessions: 194, cpuLoad: 11, uptime: '29d 08h 51m' },
    { id: 'rtr_uttara', ownerUid, name: 'Uttara-Hotspot-RB4011', host: '103.114.200.29', apiPort: 8728, username: 'maxim_hs', popName: 'Uttara-POP', model: 'RB4011iGS+RM', rosVersion: '7.15.3', mode: 'Sandbox', radiusSecret: 'rad_uttara_77', status: 'Connected', activeSessions: 88, cpuLoad: 9, uptime: '61d 02h 15m' },
  ];

  const resDemoId = 'sdt_demo';
  const resUttaraId = 'sdt_utt';
  const resellers: Reseller[] = [
    { id: resDemoId, ownerUid, username: 'demoreseller', password: '123456', companyName: 'Mirpur SpeedNet SDT', contactPerson: 'Kamrul Hasan', mobile: '01713336411', popName: 'Mirpur-POP', balance: 18500, creditLimit: 5000, smsBalance: 450, smsRate: 0.4, allowedCycles: 'Day of 1, Day of 5, Day of 10', customRateDiscount: 20, totalCustomers: 3, status: 'Active' },
    { id: resUttaraId, ownerUid, username: 'uttaralink', password: '123456', companyName: 'Uttara Fiber Link SDT', contactPerson: 'Rafiqul Islam', mobile: '01819224488', popName: 'Uttara-POP', balance: 6200, creditLimit: 3000, smsBalance: 180, smsRate: 0.4, allowedCycles: 'Day of 1, Day of 10', customRateDiscount: 15, totalCustomers: 2, status: 'Active' },
  ];

  const customers: Customer[] = [
    {
      id: 'cust_1020', ownerUid, custId: '1020', username: 'haqs', password: '123456', name: 'Ali Haq',
      mobile: '0100002445', email: 'haqs@client.bd', address: 'Rd#4, Mirpur-2, Dhaka', nidNumber: '1988269441201',
      popName: 'Mirpur-POP', zoneName: 'democompany', packageId: pkgMir1, packageName: '1Mbps', monthlyRate: 500,
      balance: -1582.53, billingCycle: 'Day of 10', expiryDate: '2026-10-12', lockStatus: 'Unlocked', accountStatus: 'Expired',
      category: 'Regular', planType: 'Prepaid', ipAddress: '10.20.10.20', macAddress: 'C0:25:E9:41:11:A2',
      mikrotikQueue: 'Package Default', routerName: 'Mirpur-Core-CCR1036', isOnline: false, lastLogout: '2 hrs 15 min Ago (02/11/26 05:45)',
      iRef: '5 MB', resellerId: '', fiberLength: '210.0m', cpeModel: 'GPON BDCOM-P1501DT', oltPort: '3', linkRemarks: 'Pole #12 Rd 4',
      avatarType: 'male', mobileVerified: true,
    },
    {
      id: 'cust_1035', ownerUid, custId: '1035', username: 'hassan', password: '123456', name: 'Hassan Khan',
      mobile: '01713336400', email: 'hassan@client.bd', address: 'mirpur-2, Dhaka, Bangladesh', nidNumber: '1991269553109',
      popName: 'Mirpur-POP', zoneName: 'democompany', packageId: pkgMir1, packageName: '1Mbps', monthlyRate: 500,
      balance: 0.54, billingCycle: 'Day of 1', expiryDate: '2026-12-01', lockStatus: 'Unlocked', accountStatus: 'Active',
      category: 'Regular', planType: 'Prepaid', ipAddress: '10.20.10.35', macAddress: 'D8:07:B6:19:4C:08',
      mikrotikQueue: 'Package Default', routerName: 'Mirpur-Core-CCR1036', isOnline: true, lastLogout: 'Online Now (PPPoE)',
      iRef: '', resellerId: resDemoId, fiberLength: '185.0m', cpeModel: 'GPON V-SOL HG323DAC', oltPort: '5', linkRemarks: '2nd Floor East Flat',
      avatarType: 'male', mobileVerified: true,
    },
    {
      id: 'cust_1023', ownerUid, custId: '1023', username: 'Mizan', password: '123456', name: 'maestro (Mizanur Rahman)',
      mobile: '01713336400', email: 'support@maestro.com.bd', address: 'mirpur-2, Dhaka, Bangladesh', nidNumber: '1986269778234',
      popName: 'Mirpur-POP', zoneName: 'democompany', packageId: pkgPool, packageName: '2Mbps-Pool', monthlyRate: 600,
      balance: -82.8, billingCycle: 'Day of 1', expiryDate: '2027-01-01', lockStatus: 'Unlocked', accountStatus: 'Active',
      category: 'VIP', planType: 'Prepaid', ipAddress: '103.114.200.45', macAddress: 'AC:84:C6:82:9F:10',
      mikrotikQueue: 'Package Default', routerName: 'Mirpur-Core-CCR1036', isOnline: true, lastLogout: '3 hrs 10 min Ago (01/11/26 16:30)',
      iRef: 'VIP-Priority', resellerId: resDemoId, fiberLength: '333.0m', cpeModel: 'GPON GL-787665554', oltPort: '7', linkRemarks: 'from Home 27/1 Shamoli',
      avatarType: 'male', mobileVerified: true,
    },
    {
      id: 'cust_1031', ownerUid, custId: '1031', username: 'mahojabin', password: '123456', name: 'Mahojabin Akter',
      mobile: '01713336400', email: 'mahojabin@client.bd', address: 'mirpur-2, Dhaka, Bangladesh', nidNumber: '1994269884120',
      popName: 'Mirpur-POP', zoneName: 'democompany', packageId: pkgMir2, packageName: '2Mbps', monthlyRate: 800,
      balance: 7.63, billingCycle: 'Day of 5', expiryDate: '2026-12-05', lockStatus: 'Unlocked', accountStatus: 'Active',
      category: 'Regular', planType: 'Prepaid', ipAddress: '10.20.10.31', macAddress: '60:32:B1:77:2E:41',
      mikrotikQueue: 'Package Default', routerName: 'Mirpur-Core-CCR1036', isOnline: true, lastLogout: 'Online Now (PPPoE)',
      iRef: '', resellerId: resDemoId, fiberLength: '140.0m', cpeModel: 'GPON Huawei HG8546M', oltPort: '2', linkRemarks: 'House 14 Block C',
      avatarType: 'female', mobileVerified: true,
    },
    {
      id: 'cust_1037', ownerUid, custId: '1037', username: 'ershad', password: '123456', name: 'Md. Ershadul Haque',
      mobile: '01911445566', email: 'ershad@client.bd', address: 'Ring Road, Shamoli, Dhaka', nidNumber: '1990269112345',
      popName: 'Shamoli-POP', zoneName: 'democompany', packageId: pkgMir1, packageName: '1Mbps', monthlyRate: 500,
      balance: 500, billingCycle: 'Day of 1', expiryDate: '2026-12-01', lockStatus: 'Unlocked', accountStatus: 'Active',
      category: 'Regular', planType: 'Prepaid', ipAddress: '10.22.4.18', macAddress: '74:DA:88:3A:09:CC',
      mikrotikQueue: 'Package Default', routerName: 'Shamoli-Edge-CCR2004', isOnline: true, lastLogout: 'Online Now (PPPoE)',
      iRef: '', resellerId: '', fiberLength: '275.0m', cpeModel: 'GPON C-Data FD511G', oltPort: '4', linkRemarks: 'Shamoli Square Lane',
      avatarType: 'male', mobileVerified: false,
    },
    {
      id: 'cust_1026', ownerUid, custId: '1026', username: 'khalid', password: '123456', name: 'Md. Khalid',
      mobile: '01817665544', email: 'khalid@client.bd', address: 'Sector-7, Road-12, Uttara, Dhaka', nidNumber: '1989269330012',
      popName: 'Uttara-POP', zoneName: 'uttara_zone', packageId: pkgHome15, packageName: '15Mbps-Turbo', monthlyRate: 1000,
      balance: 0, billingCycle: 'Day of 5', expiryDate: '2026-12-05', lockStatus: 'Unlocked', accountStatus: 'Active',
      category: 'VIP', planType: 'Prepaid', ipAddress: '10.30.7.26', macAddress: '2A:38:E2:A5:56:E0',
      mikrotikQueue: 'PCQ-15M-Burst', routerName: 'Uttara-Hotspot-RB4011', isOnline: true, lastLogout: 'Online Now (PPPoE)',
      iRef: 'Ref:1023', resellerId: resUttaraId, fiberLength: '195.0m', cpeModel: 'GPON Huawei EG8145V5', oltPort: '1', linkRemarks: 'Uttara Sector 7 Splitter-B',
      avatarType: 'male', mobileVerified: true,
    },
    {
      id: 'cust_1027', ownerUid, custId: '1027', username: 'najmul', password: '123456', name: 'Md. Najmul Hoque',
      mobile: '01675889900', email: 'najmul@client.bd', address: 'Road-27, Dhanmondi, Dhaka', nidNumber: '1993269007812',
      popName: 'Dhanmondi-POP', zoneName: 'democompany', packageId: pkgVip30, packageName: '30Mbps-VIP', monthlyRate: 0,
      balance: 0, billingCycle: 'Day of 10', expiryDate: '2027-06-01', lockStatus: 'Unlocked', accountStatus: 'Active',
      category: 'Free', planType: 'Postpaid', ipAddress: '103.114.200.99', macAddress: 'B0:BE:76:12:88:FA',
      mikrotikQueue: 'SimpleQueue-Dedicated', routerName: 'Shamoli-Edge-CCR2004', isOnline: true, lastLogout: 'Online Now (Static)',
      iRef: 'Complimentary-NOC', resellerId: '', fiberLength: '90.0m', cpeModel: 'MikroTik hAP ax2', oltPort: '6', linkRemarks: 'Building Rooftop POP Host Free Line',
      avatarType: 'male', mobileVerified: true,
    },
    {
      id: 'cust_1045', ownerUid, custId: '1045', username: 'milon-pc', password: '123456', name: 'Milon Chowdhury',
      mobile: '01713336409', email: 'milon@client.bd', address: 'Shamoli Ring Rd, Dhaka, Bangladesh', nidNumber: '1992269445511',
      popName: 'Shamoli-POP', zoneName: 'democompany', packageId: pkgMir2, packageName: '2Mbps', monthlyRate: 800,
      balance: -1201, billingCycle: 'Day of 5', expiryDate: '2026-10-05', lockStatus: 'Locked', accountStatus: 'Expired',
      category: 'Regular', planType: 'Prepaid', ipAddress: '10.22.4.91', macAddress: 'E4:F4:C6:01:55:29',
      mikrotikQueue: 'Package Default', routerName: 'Shamoli-Edge-CCR2004', isOnline: false, lastLogout: '5 days Ago (Locked for Due)',
      iRef: '', resellerId: resUttaraId, fiberLength: '410.0m', cpeModel: 'GPON BDCOM-P1501DT', oltPort: '8', linkRemarks: 'TJ Box #09',
      avatarType: 'male', mobileVerified: false,
    },
  ];

  const employees: Employee[] = [
    { id: 'emp_ops', ownerUid, username: 'demooperation', password: '123456', fullName: 'Tariqul Alam (Operations)', mobile: '01713336420', email: 'ops@maestro.com.bd', role: 'Operations', department: 'Field & CRM Operations', allowedPops: 'ALL', allowedCashChannels: 'CASH, bKash Sync', canEditPackage: true, canCollectCash: true, canManageRouter: false, canDeleteRecord: false, status: 'Active' },
    { id: 'emp_noc', ownerUid, username: 'noc_tanvir', password: '123456', fullName: 'Tanvir Ahmed (NOC Lead)', mobile: '01713336421', email: 'noc@maestro.com.bd', role: 'NOC', department: 'Core Network & RADIUS', allowedPops: 'ALL', allowedCashChannels: 'NONE', canEditPackage: true, canCollectCash: false, canManageRouter: true, canDeleteRecord: false, status: 'Active' },
    { id: 'emp_mir', ownerUid, username: 'mirpur_mgr', password: '123456', fullName: 'Sazzad Hossain (Mirpur POP Mgr)', mobile: '01713336422', email: 'mirpur@maestro.com.bd', role: 'POP Manager', department: 'Regional POP Management', allowedPops: 'Mirpur-POP', allowedCashChannels: 'CASH, bKash Sync', canEditPackage: true, canCollectCash: true, canManageRouter: false, canDeleteRecord: false, status: 'Active' },
    { id: 'emp_bil', ownerUid, username: 'billing_nusrat', password: '123456', fullName: 'Nusrat Jahan (Accounts & Billing)', mobile: '01713336423', email: 'accounts@maestro.com.bd', role: 'Billing', department: 'Finance & Cash Audit', allowedPops: 'ALL', allowedCashChannels: 'CASH, bKash Sync, Rocket Sync, Nagad Sync, Bank', canEditPackage: false, canCollectCash: true, canManageRouter: false, canDeleteRecord: false, status: 'Active' },
  ];

  const tickets: SupportTicket[] = [
    {
      id: 'tkt_6408', ownerUid, ticketNo: '6408', customerId: 'cust_1023', customerUsername: 'Mizan',
      customerName: 'maestro (Mizanur Rahman)', contact: '01713336400', email: 'support@maestro.com.bd',
      popName: 'Mirpur-POP', address: 'Mirpur-2, Dhaka, Bangladesh', customerBalance: -82.8, customerExpiry: '2027-01-01',
      lockStatus: 'Unlocked', issueType: 'Connection Problem', description: 'Intermittent packet loss on GPON OLT Port 7 during peak evening hours.',
      assignedTo: 'demooperation', createdBy: 'democompany', status: 'Open', priority: 'High',
      lastComment: '02/11 09:10 democompany: Optical power checked (-19.4 dBm), monitoring port.', smsSentCustomer: true, smsSentStaff: true,
    },
    {
      id: 'tkt_6407', ownerUid, ticketNo: '6407', customerId: 'cust_1035', customerUsername: 'hassan',
      customerName: 'Hassan Khan', contact: '01713336400', email: 'hassan@client.bd',
      popName: 'Mirpur-POP', address: 'mirpur-2, Dhaka, Bangladesh', customerBalance: 0.54, customerExpiry: '2026-12-01',
      lockStatus: 'Unlocked', issueType: 'Line Shifting Request', description: 'Dear sir, Please shift my fiber connection to Block-D Road-6 next week.',
      assignedTo: 'demooperation', createdBy: 'hassan', status: 'In Progress', priority: 'Normal',
      lastComment: '01/11 19:52 hassan: Shifting flat within Mirpur-2, please schedule technician.', smsSentCustomer: true, smsSentStaff: false,
    },
    {
      id: 'tkt_6406', ownerUid, ticketNo: '6406', customerId: 'cust_1045', customerUsername: 'milon-pc',
      customerName: 'Milon Chowdhury', contact: '01713336409', email: 'milon@client.bd',
      popName: 'Shamoli-POP', address: 'Shamoli Ring Rd, Dhaka, Bangladesh', customerBalance: -1201, customerExpiry: '2026-10-05',
      lockStatus: 'Locked', issueType: 'Router / ONU Configuration', description: 'Facing router configure problem after WiFi reset, please re-configure PPPoE dialer.',
      assignedTo: 'noc_tanvir', createdBy: 'milon-pc', status: 'Open', priority: 'Normal',
      lastComment: '01/11 19:50 milon-pc: Router reset accidentally, need PPPoE credentials set.', smsSentCustomer: false, smsSentStaff: true,
    },
  ];

  const tasks: StaffTask[] = [
    { id: 'tsk_1', ownerUid, title: 'Splice 12-Core Distribution Fiber at Mirpur-2 Box-04', category: 'Fiber Splicing', assignedTo: 'demooperation', popName: 'Mirpur-POP', relatedCustomer: 'Mizan', dueDate: '2026-11-05', priority: 'High', status: 'In Progress', notes: 'OTDR test required after fusion splice.' },
    { id: 'tsk_2', ownerUid, title: 'Audit Secondary RADIUS Failover Sync with Uttara RB4011', category: 'NOC / RADIUS', assignedTo: 'noc_tanvir', popName: 'Uttara-POP', relatedCustomer: 'khalid', dueDate: '2026-11-06', priority: 'Normal', status: 'Pending', notes: 'Verify CoA port 3799 disconnect response.' },
  ];

  const corporateClients: CorporateClient[] = [
    { id: 'corp_1', ownerUid, companyName: 'Apex Knitwear Composite Ltd.', clientCode: 'CORP-101', contactPerson: 'Engr. Mahbub Alam', mobile: '01711882200', email: 'it@apexknit.bd', address: 'Plot 14, Mirpur Industrial Area, Dhaka', popName: 'Mirpur-POP', iigMbps: 100, bdixMbps: 200, cacheMbps: 300, dataConnectivityMbps: 50, publicIpCount: 8, serverRentQty: 1, monthlyTotal: 48500, balance: 0, billingCycle: 'Day of 1', mrtgLinkId: 'MRTG-APEX-101', status: 'Active' },
    { id: 'corp_2', ownerUid, companyName: 'MetroNet Sub-ISP Bulk Link', clientCode: 'BULK-204', contactPerson: 'Zahidul Karim', mobile: '01819554433', email: 'noc@metronet.bd', address: 'House 8, Sector 7, Uttara, Dhaka', popName: 'Uttara-POP', iigMbps: 250, bdixMbps: 500, cacheMbps: 600, dataConnectivityMbps: 100, publicIpCount: 16, serverRentQty: 0, monthlyTotal: 92000, balance: -15000, billingCycle: 'Day of 5', mrtgLinkId: 'MRTG-METRO-204', status: 'Active' },
  ];

  const payments: PaymentRecord[] = [
    { id: 'pay_1', ownerUid, trxNumber: 'BKS98A7721K', targetType: 'Home', customerId: 'cust_1035', customerUsername: 'hassan', customerName: 'Hassan Khan', amount: 500, chargeAmount: 500, billForMonths: 1, method: 'bKash Sync', channel: 'bKash Merchant 01713336401', receivedBy: 'PaymentSync-Auto', syncSource: 'Maestro Payment Sync', senderMobile: '01713336400', status: 'Completed', remarks: 'Auto-recharged without manual TrxID + Return SMS sent', oldExpiry: '2026-11-01', newExpiry: '2026-12-01', paymentDate: '01/11/2026 11:20' },
    { id: 'pay_2', ownerUid, trxNumber: 'RKT4401982M', targetType: 'Home', customerId: 'cust_1031', customerUsername: 'mahojabin', customerName: 'Mahojabin Akter', amount: 800, chargeAmount: 800, billForMonths: 1, method: 'Rocket Sync', channel: 'DBBL Rocket Merchant', receivedBy: 'PaymentSync-Auto', syncSource: 'Maestro Payment Sync', senderMobile: '01713336400', status: 'Completed', remarks: 'Auto synced via DBBL Rocket', oldExpiry: '2026-11-05', newExpiry: '2026-12-05', paymentDate: '01/11/2026 14:05' },
    { id: 'pay_3', ownerUid, trxNumber: 'CSH-2026-881', targetType: 'Home', customerId: 'cust_1037', customerUsername: 'ershad', customerName: 'Md. Ershadul Haque', amount: 500, chargeAmount: 500, billForMonths: 1, method: 'CASH', channel: 'Staff Cash (demooperation)', receivedBy: 'demooperation', syncSource: 'Cash Rcv Entry', senderMobile: '01911445566', status: 'Completed', remarks: 'Collected in Shamoli Zone', oldExpiry: '2026-11-01', newExpiry: '2026-12-01', paymentDate: '01/11/2026 17:40' },
    { id: 'pay_4', ownerUid, trxNumber: 'SSL-VISA-9042', targetType: 'Corporate', customerId: 'corp_1', customerUsername: 'CORP-101', customerName: 'Apex Knitwear Composite Ltd.', amount: 48500, chargeAmount: 48500, billForMonths: 1, method: 'Online Card', channel: 'SSLCommerz VISA', receivedBy: 'Gateway-Auto', syncSource: 'Customer Portal', senderMobile: '01711882200', status: 'Completed', remarks: 'Monthly IIG + Cache VAS Invoice Paid Online', oldExpiry: '2026-11-01', newExpiry: '2026-12-01', paymentDate: '02/11/2026 10:15' },
  ];

  const ledgerEntries: LedgerEntry[] = [
    { id: 'led_1', ownerUid, entryNo: 'VCH-1001', entryType: 'Income', accountHead: 'Broadband Subscription Revenue', channel: 'bKash & Rocket Merchant', staffName: 'billing_nusrat', vendorName: '', invoiceRef: 'SYNC-BATCH-11', debit: 0, credit: 52800, amount: 52800, status: 'Posted', entryDate: '2026-11-01', remarks: 'Synced mobile banking & portal card settlements' },
    { id: 'led_2', ownerUid, entryNo: 'VCH-1002', entryType: 'Staff Cash Transfer', accountHead: 'Staff Cash -> Office Vault', channel: 'Office Cash', staffName: 'demooperation', vendorName: '', invoiceRef: 'TRF-209', debit: 0, credit: 14500, amount: 14500, status: 'Posted', entryDate: '2026-11-01', remarks: 'Verified & transferred field collection from demooperation to Office Cash' },
    { id: 'led_3', ownerUid, entryNo: 'VCH-1003', entryType: 'Vendor Payment', accountHead: 'Upstream IIG & NTTN Fiber Bandwidth', channel: 'City Bank A/C', staffName: 'billing_nusrat', vendorName: 'Summit Communications / Fiber@Home', invoiceRef: 'INV-FTH-992', debit: 28000, credit: 0, amount: 28000, status: 'Posted', entryDate: '2026-11-02', remarks: 'Monthly NTTN transmission & IIG upstream settlement' },
    { id: 'led_4', ownerUid, entryNo: 'VCH-1004', entryType: 'Expense', accountHead: 'POP Utility & Generator Fuel', channel: 'Office Cash', staffName: 'mirpur_mgr', vendorName: 'Mirpur Power Supply', invoiceRef: 'EXP-412', debit: 3400, credit: 0, amount: 3400, status: 'Posted', entryDate: '2026-11-02', remarks: 'Mirpur-POP UPS battery maintenance & electricity bill' },
  ];

  const operationalLogs: OperationalLog[] = [
    { id: 'opl_tpl1', ownerUid, logCategory: 'sms_template', code: 'WELCOME_SMS', actor: 'System', target: 'New Subscriber', popName: 'All', title: 'Welcome SMS Template', details: 'Welcome to RRR CABLE NETWORK! Your Login ID: {USERNAME}, Pass: {PASSWORD}, Package: {PACKAGE}. Support: 09666755955.', metaOne: 'Masking', metaTwo: 'Active', numericVal: 1, status: 'Saved', timestampStr: '01/11/2026 09:00' },
    { id: 'opl_tpl2', ownerUid, logCategory: 'sms_template', code: 'PAYMENT_ALERT', actor: 'System', target: 'Paid Subscriber', popName: 'All', title: 'Payment Confirmation Alert', details: 'Dear {NAME}, BDT {AMOUNT} received ({METHOD}). Collected by {STAFF}. New Expiry: {EXPIRY}. Thank you!', metaOne: 'Masking', metaTwo: 'Active', numericVal: 1, status: 'Saved', timestampStr: '01/11/2026 09:00' },
    { id: 'opl_tpl3', ownerUid, logCategory: 'sms_template', code: 'DUE_REMINDER', actor: 'System', target: 'Due Users', popName: 'All', title: 'Automated Billing Due Alert', details: 'Dear {NAME} ({USERNAME}), your internet bill BDT {DUE} is due before {EXPIRY}. Pay via bKash 01713336401 (Ref: {CUST_ID}) for instant auto-recharge.', metaOne: 'Masking', metaTwo: 'Active', numericVal: 1, status: 'Saved', timestampStr: '01/11/2026 09:00' },
    { id: 'opl_sms1', ownerUid, logCategory: 'sms_log', code: 'SMS-8821A', actor: 'PaymentSync-Auto', target: '01713336400 (hassan)', popName: 'Mirpur-POP', title: 'Auto Payment Return SMS', details: 'Dear Hassan Khan, BDT 500.00 received via bKash Sync (TrxID: BKS98A7721K). Account recharged.', metaOne: 'RRR-CABLE', metaTwo: 'GSM-7 (1 Seg)', numericVal: 0.35, status: 'DELIVERED', timestampStr: '01/11/2026 11:20' },
    { id: 'opl_hs1', ownerUid, logCategory: 'hotspot_voucher', code: 'RRR-7D-994821', actor: ISP_BRAND_NAME, target: 'Hotspot-7Day-Unlimited', popName: 'Uttara-POP', title: '7-Day Unlimited Hotspot Card', details: 'Rate: BDT 150 | Speed: 10Mbps | Roaming Enabled | Mobile OTP Ready', metaOne: '10Mbps', metaTwo: '7 Days', numericVal: 150, status: 'Available', timestampStr: '02/11/2026 08:00' },
    { id: 'opl_hs2', ownerUid, logCategory: 'hotspot_voucher', code: 'RRR-7D-551904', actor: ISP_BRAND_NAME, target: 'Hotspot-7Day-Unlimited', popName: 'Mirpur-POP', title: '7-Day Unlimited Hotspot Card', details: 'Activated by 01713336488 via bKash Hotspot Portal', metaOne: '10Mbps', metaTwo: '7 Days', numericVal: 150, status: 'Sold / Active', timestampStr: '01/11/2026 20:15' },
    { id: 'opl_ip1', ownerUid, logCategory: 'ip_log', code: 'NAT-99201', actor: 'khalid', target: '142.250.199.14:443', popName: 'Uttara-POP', title: 'LAN 10.30.7.26:52410 -> NAT 103.114.200.29:40112', details: 'MAC: 2A:38:E2:A5:56:E0 | Proto: TCP | Router: Uttara-Hotspot-RB4011 | BTRC Compliant Log', metaOne: '103.114.200.29:40112', metaTwo: '2A:38:E2:A5:56:E0', numericVal: 443, status: 'Logged', timestampStr: '02/11/2026 07:58' },
    { id: 'opl_ip2', ownerUid, logCategory: 'ip_log', code: 'NAT-99202', actor: 'Mizan', target: '157.240.22.35:443', popName: 'Mirpur-POP', title: 'LAN 103.114.200.45:58102 -> NAT 103.114.200.45:58102', details: 'MAC: AC:84:C6:82:9F:10 | Proto: TCP | Router: Mirpur-Core-CCR1036 | BTRC Compliant Log', metaOne: '103.114.200.45:58102', metaTwo: 'AC:84:C6:82:9F:10', numericVal: 443, status: 'Logged', timestampStr: '02/11/2026 08:01' },
    { id: 'opl_aud1', ownerUid, logCategory: 'audit_log', code: 'KEEPER-001', actor: 'Maestro Keeper', target: 'Admin Login', popName: 'All', title: 'Verified Workspace Initialization', details: 'Maestro Keeper firewall & secondary RADIUS sync verified for ISP workspace.', metaOne: 'SECURITY', metaTwo: 'OK', numericVal: 0, status: 'Recorded', timestampStr: formatShortDateTime() },
  ];

  return {
    settings,
    pops,
    packages,
    routers,
    resellers,
    customers,
    employees,
    tickets,
    tasks,
    corporateClients,
    payments,
    ledgerEntries,
    operationalLogs,
  };
}

// Initial Verified MAXIM ISP Workspace Seeder
export async function ensureMaximWorkspaceSeeded(ownerUid: string, userEmail: string): Promise<void> {
  const inFlight = activeSeedLocks.get(ownerUid);
  if (inFlight) {
    return inFlight;
  }

  const runSeed = async () => {
    const seed = getInitialSeedData(ownerUid, userEmail);

    // Save to local cached collections immediately so offline/fallback is always populated
    saveStoredCollection('pops', seed.pops);
    saveStoredCollection('packages', seed.packages);
    saveStoredCollection('routers', seed.routers);
    saveStoredCollection('resellers', seed.resellers);
    saveStoredCollection('customers', seed.customers);
    saveStoredCollection('employees', seed.employees);
    saveStoredCollection('tickets', seed.tickets);
    saveStoredCollection('tasks', seed.tasks);
    saveStoredCollection('corporateClients', seed.corporateClients);
    saveStoredCollection('payments', seed.payments);
    saveStoredCollection('ledgerEntries', seed.ledgerEntries);
    saveStoredCollection('operationalLogs', seed.operationalLogs);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`rrr_settings_${ownerUid}`, JSON.stringify(seed.settings));
      } catch {
        // ignore
      }
    }

    // Now attempt Firestore batch initialization if connection & auth allow
    const settingsRef = doc(db, 'workspaceSettings', ownerUid);
    let settingsExists = false;
    try {
      const snap = await getDoc(settingsRef);
      if (snap.exists()) {
        settingsExists = true;
        if (snap.data()?.seeded === true) {
          return;
        }
      }
    } catch (error) {
      handleSafeFirestoreError(error, OperationType.GET, `workspaceSettings/${ownerUid}`);
    }

    const batch = writeBatch(db);
    const ts = serverTimestamp();

    const batchCreateClean = <T extends { id: string }>(collectionName: string, item: T) => {
      const { id, ...body } = item;
      batch.set(doc(db, collectionName, id), {
        ownerUid,
        ...body,
        createdAt: ts,
        updatedAt: ts,
      });
    };

    if (settingsExists) {
      batch.update(settingsRef, {
        seeded: true,
        updatedAt: ts,
      });
    } else {
      batch.set(settingsRef, {
        ...seed.settings,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    for (const p of seed.pops) batchCreateClean('pops', p);
    for (const pkg of seed.packages) batchCreateClean('packages', pkg);
    for (const r of seed.routers) batchCreateClean('routers', r);
    for (const s of seed.resellers) batchCreateClean('resellers', s);
    for (const c of seed.customers) batchCreateClean('customers', c);
    for (const e of seed.employees) batchCreateClean('employees', e);
    for (const t of seed.tickets) batchCreateClean('tickets', t);
    for (const tk of seed.tasks) batchCreateClean('tasks', tk);
    for (const cc of seed.corporateClients) batchCreateClean('corporateClients', cc);
    for (const pm of seed.payments) batchCreateClean('payments', pm);
    for (const l of seed.ledgerEntries) batchCreateClean('ledgerEntries', l);
    for (const op of seed.operationalLogs) batchCreateClean('operationalLogs', op);

    try {
      await batch.commit();
    } catch (error) {
      handleSafeFirestoreError(error, OperationType.WRITE, 'batch/seedInitialMaximWorkspace');
    }
  };

  const promise = runSeed().finally(() => {
    activeSeedLocks.delete(ownerUid);
  });
  activeSeedLocks.set(ownerUid, promise);
  return promise;
}
