/**
 * Adversarial Security Rules Specification Suite for maXim ISP Billing & ERP
 * Verifies that all 12 "Dirty Dozen" payloads evaluate to PERMISSION_DENIED.
 */

export interface AdversarialVector {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_VECTORS: AdversarialVector[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: '/customers/cust_1',
    auth: { uid: 'attacker_uid', email: 'attacker@isp.net', email_verified: true },
    payload: { ownerUid: 'victim_uid', username: 'mizan' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Admin Email Spoof',
    operation: 'get',
    path: '/customers/cust_1',
    auth: { uid: 'spoof_uid', email: 'rendomuser50@gmail.com', email_verified: false },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Create',
    operation: 'create',
    path: '/packages/pkg_1',
    auth: { uid: 'tenant_1', email: 'ops@isp.net', email_verified: true },
    payload: { ownerUid: 'tenant_1', name: '10Mbps', isFreeForever: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Update',
    operation: 'update',
    path: '/customers/cust_1',
    auth: { uid: 'tenant_1', email: 'ops@isp.net', email_verified: true },
    payload: { hiddenAdminFlag: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Value Poisoning on Update',
    operation: 'update',
    path: '/customers/cust_1',
    auth: { uid: 'tenant_1', email: 'ops@isp.net', email_verified: true },
    payload: { balance: 'INVALID_STRING_NUMBER' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning via Invalid Characters',
    operation: 'create',
    path: '/pops/invalid$id!@#with_spaces',
    auth: { uid: 'tenant_1', email: 'ops@isp.net', email_verified: true },
    payload: { ownerUid: 'tenant_1' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Denial of Wallet Oversized Description',
    operation: 'create',
    path: '/tickets/tkt_1',
    auth: { uid: 'tenant_1', email: 'ops@isp.net', email_verified: true },
    payload: { ownerUid: 'tenant_1', description: 'X'.repeat(5000) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation (ownerUid / createdAt)',
    operation: 'update',
    path: '/customers/cust_1',
    auth: { uid: 'tenant_1', email: 'ops@isp.net', email_verified: true },
    payload: { ownerUid: 'tenant_2' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/payments/pay_1',
    auth: { uid: 'tenant_1', email: 'ops@isp.net', email_verified: true },
    payload: { ownerUid: 'tenant_1', createdAt: '1999-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Reversal on Void Payment',
    operation: 'update',
    path: '/payments/pay_voided',
    auth: { uid: 'tenant_1', email: 'ops@isp.net', email_verified: true },
    payload: { status: 'Completed' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-Tenant PII Read',
    operation: 'get',
    path: '/employees/emp_tenant_1',
    auth: { uid: 'tenant_2', email: 'other@isp.net', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Orphaned TicketComment Subcollection Write',
    operation: 'create',
    path: '/tickets/missing_ticket/comments/cmt_1',
    auth: { uid: 'tenant_1', email: 'ops@isp.net', email_verified: true },
    payload: { ownerUid: 'tenant_1', ticketId: 'missing_ticket', message: 'Orphan' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
