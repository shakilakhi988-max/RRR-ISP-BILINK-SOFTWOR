import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Printer,
  Search,
  Send,
  Settings,
  Trash2,
  Upload,
  UserCog,
  X,
} from 'lucide-react';
import { useMaxim } from '../context/MaximContext';
import {
  createCorporateClient,
  createCustomer,
  createEmployee,
  createIspPackage,
  createLedgerEntry,
  createMikrotikRouter,
  createOperationalLog,
  createPopZone,
  createReseller,
  deleteDocumentByPath,
  formatBrandName,
  formatShortDateTime,
  logAuditEvent,
  saveWorkspaceSettings,
  updateEmployee,
  updateLedgerEntry,
} from '../services/maximService';
import type { Employee, LedgerEntry } from '../types';

function downloadBlob(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function OperationsErpModule() {
  const {
    user,
    settings,
    activeModule,
    visibleCustomers,
    allCustomers,
    packages,
    pops,
    routers,
    resellers,
    employees,
    payments,
    tickets,
    tasks,
    corporateClients,
    ledgerEntries,
    operationalLogs,
    operator,
    setOperator,
    setActiveModule,
    notify,
  } = useMaxim();

  // 1. SMS Gateway State
  const [smsTargetMode, setSmsTargetMode] = useState<'DUE' | 'POP' | 'ALL' | 'CUSTOM'>('DUE');
  const [smsPop, setSmsPop] = useState('Mirpur-POP');
  const [smsCustomPhones, setSmsCustomPhones] = useState('01713336400');
  const [smsBody, setSmsBody] = useState(
    'Dear Subscriber, your monthly internet bill is due. Pay easily via bKash/Rocket using your Customer ID as Reference for instant auto-recharge. - RRR CABLE NETWORK'
  );
  const [newTplTitle, setNewTplTitle] = useState('');
  const [newTplBody, setNewTplBody] = useState('');

  const [smsLogSearch, setSmsLogSearch] = useState('');
  const [confirmDeleteSmsLogId, setConfirmDeleteSmsLogId] = useState<string | null>(null);

  // 2. Accounts & General Ledger State
  const [acctTab, setAcctTab] = useState<'DAYBOOK' | 'STAFF_AUDIT' | 'INCOME_STATEMENT' | 'CASH_FLOW'>('DAYBOOK');
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');
  const [confirmVoidLedgerId, setConfirmVoidLedgerId] = useState<string | null>(null);
  const [voucherForm, setVoucherForm] = useState({
    entryType: 'Expense' as LedgerEntry['entryType'],
    accountHead: 'Upstream IIG Bandwidth Bill',
    channel: 'Office Cash',
    staffName: operator.username,
    vendorName: 'Summit Communications IIG',
    invoiceRef: '',
    amount: 5000,
    entryDate: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  // 3. Employees & RBAC State
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [empRoleFilter, setEmpRoleFilter] = useState('ALL');
  const [confirmDeleteEmpId, setConfirmDeleteEmpId] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState({
    username: '',
    password: '123456',
    fullName: '',
    mobile: '017',
    email: '',
    role: 'Support' as Employee['role'],
    department: 'NOC & Support',
    allowedPops: 'Mirpur-POP',
    allowedCashChannels: 'CASH, bKash Sync',
    canEditPackage: false,
    canCollectCash: true,
    canManageRouter: false,
    canDeleteRecord: false,
    status: 'Active' as Employee['status'],
  });

  // 4. Reports & Audit State
  const [reportTab, setReportTab] = useState<'PAYMENTS' | 'LINK_CPE' | 'SMS_REPORT'>('PAYMENTS');
  const [reportSearch, setReportSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [confirmDeleteAuditId, setConfirmDeleteAuditId] = useState<string | null>(null);

  // 5. Settings & Backup State
  const [settingsTab, setSettingsTab] = useState<'GENERAL' | 'BACKUP' | 'DOCS'>('GENERAL');
  const [companyDraft, setCompanyDraft] = useState({
    companyName: formatBrandName(settings?.companyName),
    companyCode: settings?.companyCode === 'MAXIM-BD' ? 'RRR-CABLE' : settings?.companyCode || 'RRR-CABLE',
    phone: settings?.phone || '+8809610755955',
    email: settings?.email === 'noc@maxim-isp.com' ? 'noc@rrrcablenetwork.com' : settings?.email || 'noc@rrrcablenetwork.com',
    address: settings?.address || 'Mirpur-10, Dhaka-1216, Bangladesh',
    btrcLicenseNo: settings?.btrcLicenseNo || 'BTRC-ISP-NAT-2026-041',
    bkashMerchant: settings?.bkashMerchant || '01700-000111',
    rocketMerchant: settings?.rocketMerchant || '2940',
    nagadMerchant: settings?.nagadMerchant || '01800-000222',
    paymentGatewayProvider: settings?.paymentGatewayProvider || 'SSLCommerz 3DS',
    smsSenderId: settings?.smsSenderId === 'MAXIM-ISP' ? 'RRR-CABLE' : settings?.smsSenderId || 'RRR-CABLE',
  });
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setCompanyDraft({
        companyName: formatBrandName(settings.companyName),
        companyCode: settings.companyCode === 'MAXIM-BD' ? 'RRR-CABLE' : settings.companyCode || 'RRR-CABLE',
        phone: settings.phone || '+8809610755955',
        email: settings.email === 'noc@maxim-isp.com' ? 'noc@rrrcablenetwork.com' : settings.email || 'noc@rrrcablenetwork.com',
        address: settings.address || 'Mirpur-10, Dhaka-1216, Bangladesh',
        btrcLicenseNo: settings.btrcLicenseNo || 'BTRC-ISP-NAT-2026-041',
        bkashMerchant: settings.bkashMerchant || '01700-000111',
        rocketMerchant: settings.rocketMerchant || '2940',
        nagadMerchant: settings.nagadMerchant || '01800-000222',
        paymentGatewayProvider: settings.paymentGatewayProvider || 'SSLCommerz 3DS',
        smsSenderId: settings.smsSenderId === 'MAXIM-ISP' ? 'RRR-CABLE' : settings.smsSenderId || 'RRR-CABLE',
      });
    }
  }, [settings]);

  useEffect(() => {
    if (activeModule === 'accounts') setAcctTab('DAYBOOK');
    else if (activeModule === 'accounts_audit') setAcctTab('STAFF_AUDIT');
    else if (activeModule === 'accounts_pnl') setAcctTab('INCOME_STATEMENT');
    else if (activeModule === 'accounts_cashflow') setAcctTab('CASH_FLOW');
    else if (activeModule === 'reports') setReportTab('PAYMENTS');
    else if (activeModule === 'reports_cpe') setReportTab('LINK_CPE');
    else if (activeModule === 'settings') setSettingsTab('GENERAL');
    else if (activeModule === 'settings_backup') setSettingsTab('BACKUP');
  }, [activeModule]);

  const smsTemplates = useMemo(
    () => operationalLogs.filter((l) => l.logCategory === 'sms_template'),
    [operationalLogs]
  );
  const smsLogs = useMemo(
    () => operationalLogs.filter((l) => l.logCategory === 'sms_log'),
    [operationalLogs]
  );
  const auditLogs = useMemo(
    () => operationalLogs.filter((l) => l.logCategory === 'audit_log'),
    [operationalLogs]
  );

  // =========================================================================
  // VIEW 1: SMS GATEWAY, BULK BROADCAST & TEMPLATES
  // =========================================================================
  if (activeModule === 'sms' || activeModule === 'sms_templates') {
    const targetRecipients =
      smsTargetMode === 'DUE'
        ? visibleCustomers.filter((c) => c.balance < 0).map((c) => c.mobile)
        : smsTargetMode === 'POP'
        ? visibleCustomers.filter((c) => c.popName === smsPop).map((c) => c.mobile)
        : smsTargetMode === 'ALL'
        ? visibleCustomers.map((c) => c.mobile)
        : smsCustomPhones
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

    const handleSendSmsCampaign = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || targetRecipients.length === 0) {
        notify('No target mobile numbers selected for broadcast.', 'error');
        return;
      }

      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: settings?.smsSenderId === 'MAXIM-ISP' ? 'RRR-CABLE' : settings?.smsSenderId || 'RRR-CABLE',
          masking: settings?.smsMasking ?? true,
          recipients: targetRecipients,
          message: smsBody,
        }),
      });
      const dispatch = await res.json();

      await createOperationalLog(user.uid, {
        logCategory: 'sms_log',
        code: dispatch.gatewayReference,
        actor: operator.username,
        target: `${dispatch.recipientCount} Recipients (${smsTargetMode})`,
        popName: smsTargetMode === 'POP' ? smsPop : 'All POPs',
        title: `SMS Broadcast [${dispatch.encoding}] via ${dispatch.senderId}`,
        details: smsBody,
        metaOne: dispatch.deliveryStatus,
        metaTwo: `${dispatch.totalSegmentsCharged} Segments`,
        numericVal: dispatch.totalSegmentsCharged,
        status: 'Sent',
        timestampStr: formatShortDateTime(),
      });

      if (settings) {
        await saveWorkspaceSettings(user.uid, {
          smsBalance: Math.max(0, settings.smsBalance - Number(dispatch.totalSegmentsCharged || 1)),
        });
      }

      notify(
        `Dispatched ${dispatch.totalSegmentsCharged} SMS segments to ${dispatch.recipientCount} subscribers (${dispatch.encoding}).`,
        'success'
      );
    };

    const handleSaveTemplate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !newTplTitle.trim() || !newTplBody.trim()) return;
      await createOperationalLog(user.uid, {
        logCategory: 'sms_template',
        code: `TPL-${smsTemplates.length + 1}`,
        actor: operator.username,
        target: 'Reusable Template',
        popName: 'All',
        title: newTplTitle.trim(),
        details: newTplBody.trim(),
        metaOne: 'MASKING',
        metaTwo: 'ACTIVE',
        numericVal: 1,
        status: 'Saved',
        timestampStr: formatShortDateTime(),
      });
      setNewTplTitle('');
      setNewTplBody('');
      notify('Saved SMS template.', 'success');
    };

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">SMS Gateway</span>
            <span className="mx-1.5">/</span>
            <span>Masking &amp; Non-Masking Bulk SMS, POP Outage Alerts &amp; Templates</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span>
              Gateway Credits: <strong className="text-[#1e8449]">{settings?.smsBalance ?? 0} SMS</strong>
            </span>
            {settings && user && (
              <button
                type="button"
                onClick={async () => {
                  await saveWorkspaceSettings(user.uid, { smsMasking: !settings.smsMasking });
                  notify(`Switched SMS mode to ${!settings.smsMasking ? 'Masking' : 'Non-Masking'}.`, 'info');
                }}
                className="px-2.5 py-0.5 bg-white border border-slate-400 rounded-xs font-semibold cursor-pointer"
              >
                Mode:{' '}
                {settings.smsMasking
                  ? `Masking (${settings.smsSenderId === 'MAXIM-ISP' ? 'RRR-CABLE' : settings.smsSenderId})`
                  : 'Non-Masking (8809610755955)'}
              </button>
            )}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-300 px-3 py-2 rounded-xs text-xs text-amber-950">
          <strong>[Sandbox Telecom SMS Dispatcher]</strong> Calculates real GSM-7 / Bangla Unicode segment counts, deducts ISP SMS credits, and records delivery logs in Cloud Firestore. Connect a live BD SMS Aggregator API Key (SSLWireless / BoomCast / Reve) in production for physical carrier delivery.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <form onSubmit={handleSendSmsCampaign} className="lg:col-span-7 border border-slate-300 bg-white rounded-xs overflow-hidden text-xs">
            <div className="maxim-mint-banner">BULK &amp; TARGETED SMS BROADCASTER</div>
            <div className="p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">Recipient Group</label>
                  <select
                    value={smsTargetMode}
                    onChange={(e) => setSmsTargetMode(e.target.value as 'DUE' | 'POP' | 'ALL' | 'CUSTOM')}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xs"
                  >
                    <option value="DUE">Due / Unpaid Subscribers</option>
                    <option value="POP">POP-Specific Outage / Maintenance</option>
                    <option value="ALL">All Subscribers (Eid / New Year Greeting)</option>
                    <option value="CUSTOM">Single / Custom Mobile Numbers</option>
                  </select>
                </div>
                {smsTargetMode === 'POP' && (
                  <div>
                    <label className="block font-semibold mb-1">Select POP</label>
                    <select
                      value={smsPop}
                      onChange={(e) => setSmsPop(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-xs"
                    >
                      {pops.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {smsTargetMode === 'CUSTOM' && (
                  <div>
                    <label className="block font-semibold mb-1">Mobile Numbers (comma-separated)</label>
                    <input
                      type="text"
                      value={smsCustomPhones}
                      onChange={(e) => setSmsCustomPhones(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-xs font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="text-slate-500 py-0.5">Quick Presets:</span>
                {smsTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSmsBody(tpl.details)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 border border-slate-300 rounded-xs text-[11px] font-medium cursor-pointer"
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Message Content ({smsBody.length} chars · {targetRecipients.length} recipients)
                </label>
                <textarea
                  rows={3}
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-1.5 bg-[#28a745] hover:bg-[#218838] text-white font-semibold rounded-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Dispatch SMS Campaign ({targetRecipients.length})
              </button>
            </div>
          </form>

          {/* Saved SMS Templates Manager */}
          <form onSubmit={handleSaveTemplate} className="lg:col-span-5 border border-slate-300 bg-white rounded-xs overflow-hidden text-xs">
            <div className="maxim-mint-banner">SAVED SMS TEMPLATES</div>
            <div className="p-3.5 space-y-2.5">
              <input
                type="text"
                value={newTplTitle}
                onChange={(e) => setNewTplTitle(e.target.value)}
                placeholder="Template Name (e.g. Fiber Cut Notice)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
              />
              <textarea
                rows={2}
                value={newTplBody}
                onChange={(e) => setNewTplBody(e.target.value)}
                placeholder="Template SMS body (English or Bangla Unicode)..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
              />
              <button type="submit" className="px-3 py-1 bg-[#007bff] text-white font-semibold rounded-xs cursor-pointer">
                + Save Template
              </button>
              <div className="divide-y divide-slate-200 max-h-36 overflow-y-auto pt-1">
                {smsTemplates.map((t) => (
                  <div key={t.id} className="py-1.5 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-800">{t.title}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{t.details}</div>
                    </div>
                    {operator.canDeleteRecord && (
                      <button
                        type="button"
                        onClick={() => deleteDocumentByPath('operationalLogs', t.id)}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* SMS Gateway Delivery Logs */}
        <div className="overflow-x-auto border border-slate-300 bg-white">
          <div className="px-3 py-2 bg-[#f8f9fa] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-800">SMS Gateway Delivery Archive ({smsLogs.length})</span>
            <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded-xs">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={smsLogSearch}
                onChange={(e) => setSmsLogSearch(e.target.value)}
                placeholder="Search recipient, ref, text..."
                className="w-48 focus:outline-none"
              />
            </div>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="px-2.5 py-2 text-left">Gateway Ref</th>
                <th className="px-2.5 py-2 text-left">Dispatched</th>
                <th className="px-2.5 py-2 text-left">Recipient / Group</th>
                <th className="px-2.5 py-2 text-left">Campaign / Event</th>
                <th className="px-2.5 py-2 text-left">Message Preview</th>
                <th className="px-2.5 py-2 text-right">Segments</th>
                <th className="px-2.5 py-2 text-center">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {smsLogs
                .filter((l) => {
                  if (!smsLogSearch.trim()) return true;
                  const q = smsLogSearch.toLowerCase();
                  return (
                    l.code.toLowerCase().includes(q) ||
                    l.target.toLowerCase().includes(q) ||
                    l.title.toLowerCase().includes(q) ||
                    l.details.toLowerCase().includes(q)
                  );
                })
                .map((l) => (
                  <tr key={l.id} className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">{l.code}</td>
                    <td className="px-2.5 py-2 font-mono">{l.timestampStr}</td>
                    <td className="px-2.5 py-2 font-semibold">{l.target}</td>
                    <td className="px-2.5 py-2">{l.title}</td>
                    <td className="px-2.5 py-2 max-w-[280px] truncate" title={l.details}>
                      {l.details}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">{l.numericVal}</td>
                    <td className="px-2.5 py-2 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-xs text-[11px] font-semibold">
                          {l.metaOne || l.status}
                        </span>
                        {operator.canDeleteRecord && (
                          confirmDeleteSmsLogId === l.id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteDocumentByPath('operationalLogs', l.id);
                                setConfirmDeleteSmsLogId(null);
                                notify(`Deleted SMS log ${l.code}.`, 'info');
                              }}
                              className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                            >
                              Confirm
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSmsLogId(l.id)}
                              title="Delete SMS Log"
                              className="p-0.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACCOUNTS, STAFF CASH AUDIT, VENDOR PAYABLES & GENERAL LEDGER
  // =========================================================================
  if (
    activeModule === 'accounts' ||
    activeModule === 'accounts_audit' ||
    activeModule === 'accounts_pnl' ||
    activeModule === 'accounts_cashflow'
  ) {
    const activeEntries = ledgerEntries.filter((e) => e.status !== 'Void');
    const totalIncomeCredit =
      payments.filter((p) => p.status === 'Completed').reduce((s, p) => s + p.amount, 0) +
      activeEntries.filter((e) => e.entryType === 'Income').reduce((s, e) => s + e.credit, 0);
    const totalExpenseDebit = activeEntries
      .filter((e) => e.entryType === 'Expense' || e.entryType === 'Vendor Payment')
      .reduce((s, e) => s + e.debit, 0);
    const netSurplus = totalIncomeCredit - totalExpenseDebit;

    // Staff Hand Cash Audit aggregation
    const staffCollections = employees.map((emp) => {
      const collected = payments
        .filter((p) => p.status === 'Completed' && p.receivedBy === emp.username && p.method === 'CASH')
        .reduce((s, p) => s + p.amount, 0);
      const transferred = activeEntries
        .filter((e) => e.entryType === 'Staff Cash Transfer' && e.staffName === emp.username && e.status === 'Posted')
        .reduce((s, e) => s + e.amount, 0);
      return {
        emp,
        collected,
        transferred,
        inHand: collected - transferred,
      };
    });

    const handlePostVoucher = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      const amt = Math.max(1, Number(voucherForm.amount) || 0);
      const isCredit = voucherForm.entryType === 'Income' || voucherForm.entryType === 'Vendor Invoice';
      await createLedgerEntry(user.uid, {
        entryNo: `GL-${Date.now().toString(36).toUpperCase()}`,
        entryType: voucherForm.entryType,
        accountHead: voucherForm.accountHead,
        channel: voucherForm.channel,
        staffName: voucherForm.staffName,
        vendorName: voucherForm.vendorName,
        invoiceRef: voucherForm.invoiceRef,
        debit: isCredit ? 0 : amt,
        credit: isCredit ? amt : 0,
        amount: amt,
        status: voucherForm.entryType === 'Staff Cash Transfer' ? 'Pending Audit' : 'Posted',
        entryDate: voucherForm.entryDate,
        remarks: voucherForm.remarks || `${voucherForm.entryType} - ${voucherForm.accountHead}`,
      });
      notify(`Posted ${voucherForm.entryType} voucher (BDT ${amt.toLocaleString()}).`, 'success');
      setShowVoucherForm(false);
    };

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">Accounts &amp; Cash</span>
            <span className="mx-1.5">/</span>
            <span>Staff Cash Audit, Income/Expense Vouchers, Vendor Payables &amp; Financial Statements</span>
          </div>
          <button
            type="button"
            onClick={() => setShowVoucherForm(!showVoucherForm)}
            className="px-3 py-1 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Post Accounting Voucher
          </button>
        </div>

        {/* Accounting Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white border border-slate-300 p-3 rounded-xs">
            <div className="text-slate-500 uppercase font-semibold">Gross Revenue &amp; Collections</div>
            <div className="text-lg font-bold font-mono tabular-nums text-[#1e8449] mt-0.5">
              BDT {totalIncomeCredit.toLocaleString()}
            </div>
          </div>
          <div className="bg-white border border-slate-300 p-3 rounded-xs">
            <div className="text-slate-500 uppercase font-semibold">Operating Expenses &amp; Vendor Payouts</div>
            <div className="text-lg font-bold font-mono tabular-nums text-red-600 mt-0.5">
              BDT {totalExpenseDebit.toLocaleString()}
            </div>
          </div>
          <div className="bg-white border border-slate-300 p-3 rounded-xs">
            <div className="text-slate-500 uppercase font-semibold">Net Operating Cash Surplus</div>
            <div className="text-lg font-bold font-mono tabular-nums text-[#007bff] mt-0.5">
              BDT {netSurplus.toLocaleString()}
            </div>
          </div>
        </div>

        {showVoucherForm && (
          <form onSubmit={handlePostVoucher} className="bg-[#f8f9fa] border border-slate-300 p-4 rounded-xs text-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              <div>
                <label className="block font-semibold mb-1">Voucher Type</label>
                <select
                  value={voucherForm.entryType}
                  onChange={(e) => setVoucherForm({ ...voucherForm, entryType: e.target.value as LedgerEntry['entryType'] })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                >
                  <option value="Staff Cash Transfer">Staff Cash &rarr; Office</option>
                  <option value="Income">Misc Income (ONU/OTC)</option>
                  <option value="Expense">Office / POP Expense</option>
                  <option value="Vendor Invoice">Vendor Purchase Invoice</option>
                  <option value="Vendor Payment">Vendor Bill Payment</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Account Head</label>
                <input
                  type="text"
                  value={voucherForm.accountHead}
                  onChange={(e) => setVoucherForm({ ...voucherForm, accountHead: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Cash / Bank Book</label>
                <select
                  value={voucherForm.channel}
                  onChange={(e) => setVoucherForm({ ...voucherForm, channel: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                >
                  <option value="Office Cash">Office Cash</option>
                  <option value="DBBL Corporate A/C">DBBL Corporate A/C</option>
                  <option value="bKash Merchant Wallet">bKash Merchant Wallet</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Staff / Vendor</label>
                <input
                  type="text"
                  value={
                    voucherForm.entryType === 'Staff Cash Transfer'
                      ? voucherForm.staffName
                      : voucherForm.vendorName
                  }
                  onChange={(e) =>
                    voucherForm.entryType === 'Staff Cash Transfer'
                      ? setVoucherForm({ ...voucherForm, staffName: e.target.value })
                      : setVoucherForm({ ...voucherForm, vendorName: e.target.value })
                  }
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Amount (BDT)</label>
                <input
                  type="number"
                  min={1}
                  value={voucherForm.amount}
                  onChange={(e) => setVoucherForm({ ...voucherForm, amount: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-emerald-400 bg-emerald-50/40 font-mono font-bold rounded text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Date</label>
                <input
                  type="date"
                  value={voucherForm.entryDate}
                  onChange={(e) => setVoucherForm({ ...voucherForm, entryDate: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <input
                type="text"
                value={voucherForm.remarks}
                onChange={(e) => setVoucherForm({ ...voucherForm, remarks: e.target.value })}
                placeholder="Narration / Invoice Reference..."
                className="flex-1 px-2.5 py-1.5 border border-slate-300 bg-white rounded-xs"
              />
              <button type="submit" className="px-4 py-1.5 bg-[#007bff] text-white font-semibold rounded-xs cursor-pointer">
                Post Voucher
              </button>
            </div>
          </form>
        )}

        {/* Accounting Statement Sub-Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-300 pb-2 text-xs">
          {(
            [
              ['DAYBOOK', 'Day Book & General Ledger'],
              ['STAFF_AUDIT', 'Staff Cash Collection Audit & Transfer'],
              ['INCOME_STATEMENT', 'Income Statement (P&L)'],
              ['CASH_FLOW', 'Cash & Bank Book Flow'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setAcctTab(key)}
              className={`px-3 py-1.5 rounded-xs font-semibold whitespace-nowrap cursor-pointer ${
                acctTab === key ? 'bg-[#1f2227] text-white' : 'bg-white border border-slate-300 text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {acctTab === 'STAFF_AUDIT' ? (
          <div className="overflow-x-auto border border-slate-300 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="maxim-amber-thead">
                  <th className="px-2.5 py-2 text-left">Staff Username</th>
                  <th className="px-2.5 py-2 text-left">Full Name / Role</th>
                  <th className="px-2.5 py-2 text-right">Total Cash Collected</th>
                  <th className="px-2.5 py-2 text-right">Audited &amp; Transferred</th>
                  <th className="px-2.5 py-2 text-right">Cash In Hand</th>
                  <th className="px-2.5 py-2 text-center">Transfer to Office</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {staffCollections.map(({ emp, collected, transferred, inHand }) => (
                  <tr key={emp.id} className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">{emp.username}</td>
                    <td className="px-2.5 py-2">
                      {emp.fullName} <span className="text-slate-500">({emp.role})</span>
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">BDT {collected.toLocaleString()}</td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums text-emerald-700">
                      BDT {transferred.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono font-bold tabular-nums text-amber-800">
                      BDT {inHand.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      {inHand > 0 ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user) return;
                            await createLedgerEntry(user.uid, {
                              entryNo: `TRF-${Date.now().toString(36).toUpperCase()}`,
                              entryType: 'Staff Cash Transfer',
                              accountHead: 'Head Office Vault Cash',
                              channel: 'Office Cash',
                              staffName: emp.username,
                              vendorName: '',
                              invoiceRef: 'HAND-CASH-AUDIT',
                              debit: 0,
                              credit: inHand,
                              amount: inHand,
                              status: 'Posted',
                              entryDate: new Date().toISOString().slice(0, 10),
                              remarks: `Audited & transferred hand cash from ${emp.username}`,
                            });
                            notify(`Audited & transferred BDT ${inHand.toLocaleString()} from ${emp.username} to Office Cash.`, 'success');
                          }}
                          className="px-2.5 py-0.5 bg-[#28a745] text-white rounded-xs text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                        >
                          Audit &amp; Settle
                        </button>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : acctTab === 'CASH_FLOW' ? (
          <div className="overflow-x-auto border border-slate-300 bg-white">
            <div className="maxim-mint-banner">CHANNEL-WISE CASH &amp; BANK BOOK RECONCILIATION</div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="maxim-amber-thead">
                  <th className="px-2.5 py-2 text-left">Cash / Bank / MFS Book</th>
                  <th className="px-2.5 py-2 text-right">Subscriber Receipts (In)</th>
                  <th className="px-2.5 py-2 text-right">Ledger Credits (In)</th>
                  <th className="px-2.5 py-2 text-right">Expenses &amp; Settlements (Out)</th>
                  <th className="px-2.5 py-2 text-right">Closing Book Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[
                  { label: 'Office Cash / Counter', payMethods: ['CASH'], ledgerKey: 'office cash' },
                  { label: 'bKash Merchant Wallet', payMethods: ['bKash Sync'], ledgerKey: 'bkash' },
                  { label: 'Rocket & Nagad Wallets', payMethods: ['Rocket Sync', 'Nagad Sync'], ledgerKey: 'rocket' },
                  { label: 'Corporate Bank (DBBL / EFT)', payMethods: ['Bank'], ledgerKey: 'bank' },
                  { label: 'Online Card Acquiring (3DS)', payMethods: ['Online Card'], ledgerKey: 'card' },
                ].map((book) => {
                  const payIn = payments
                    .filter((p) => p.status === 'Completed' && book.payMethods.includes(p.method))
                    .reduce((s, p) => s + p.amount, 0);
                  const ledIn = activeEntries
                    .filter(
                      (e) =>
                        e.channel.toLowerCase().includes(book.ledgerKey) ||
                        e.accountHead.toLowerCase().includes(book.ledgerKey)
                    )
                    .reduce((s, e) => s + e.credit, 0);
                  const ledOut = activeEntries
                    .filter((e) => e.channel.toLowerCase().includes(book.ledgerKey))
                    .reduce((s, e) => s + e.debit, 0);
                  const netBook = payIn + ledIn - ledOut;
                  return (
                    <tr key={book.label} className="hover:bg-amber-50/40">
                      <td className="px-2.5 py-2 font-bold text-slate-900">{book.label}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-[#1e8449]">BDT {payIn.toLocaleString()}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-blue-700">BDT {ledIn.toLocaleString()}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-red-600">BDT {ledOut.toLocaleString()}</td>
                      <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-900">
                        BDT {netBook.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="bg-[#f8f9fa] border border-slate-300 p-2.5 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Voucher Filter:</span>
                <select
                  value={ledgerTypeFilter}
                  onChange={(e) => setLedgerTypeFilter(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-xs"
                >
                  <option value="ALL">All Types</option>
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                  <option value="Staff Cash Transfer">Staff Cash Transfer</option>
                  <option value="Vendor Invoice">Vendor Invoice</option>
                  <option value="Vendor Payment">Vendor Payment</option>
                </select>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded-xs">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search voucher #, head, vendor..."
                  className="w-52 focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-300 bg-white">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="maxim-amber-thead">
                    <th className="px-2.5 py-2 text-left">Voucher #</th>
                    <th className="px-2.5 py-2 text-left">Date</th>
                    <th className="px-2.5 py-2 text-left">Type</th>
                    <th className="px-2.5 py-2 text-left">Account Head</th>
                    <th className="px-2.5 py-2 text-left">Channel</th>
                    <th className="px-2.5 py-2 text-right">Debit (Out)</th>
                    <th className="px-2.5 py-2 text-right">Credit (In)</th>
                    <th className="px-2.5 py-2 text-center">Status</th>
                    <th className="px-2.5 py-2 text-center">Audit / Void</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ledgerEntries
                    .filter((e) => {
                      if (acctTab === 'INCOME_STATEMENT') {
                        if (e.entryType !== 'Income' && e.entryType !== 'Expense') return false;
                      }
                      if (ledgerTypeFilter !== 'ALL' && e.entryType !== ledgerTypeFilter) return false;
                      if (ledgerSearch.trim()) {
                        const q = ledgerSearch.toLowerCase();
                        return (
                          e.entryNo.toLowerCase().includes(q) ||
                          e.accountHead.toLowerCase().includes(q) ||
                          e.remarks.toLowerCase().includes(q) ||
                          e.vendorName.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map((e) => (
                      <tr key={e.id} className={`hover:bg-amber-50/40 ${e.status === 'Void' ? 'opacity-50' : ''}`}>
                        <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">{e.entryNo}</td>
                        <td className="px-2.5 py-2 font-mono">{e.entryDate}</td>
                        <td className="px-2.5 py-2 font-semibold">{e.entryType}</td>
                        <td className="px-2.5 py-2">
                          <div>{e.accountHead}</div>
                          <div className="text-[11px] text-slate-500">{e.remarks}</div>
                        </td>
                        <td className="px-2.5 py-2">{e.channel}</td>
                        <td className="px-2.5 py-2 text-right font-mono tabular-nums text-red-600">
                          {e.debit > 0 ? `BDT ${e.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono tabular-nums text-[#1e8449]">
                          {e.credit > 0 ? `BDT ${e.credit.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-xs ${
                              e.status === 'Posted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : e.status === 'Pending Audit'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            {e.status === 'Pending Audit' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateLedgerEntry(e.id, {
                                    status: 'Posted',
                                    remarks: `${e.remarks} [Audited by ${operator.username}]`,
                                    channel: e.channel,
                                  });
                                  notify(`Approved & posted voucher ${e.entryNo}.`, 'success');
                                }}
                                className="px-2 py-0.5 bg-[#28a745] text-white rounded-xs text-[11px] font-semibold cursor-pointer"
                              >
                                Approve
                              </button>
                            )}
                            {e.status !== 'Void' && (
                              confirmVoidLedgerId === e.id ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await updateLedgerEntry(e.id, {
                                      status: 'Void',
                                      remarks: `${e.remarks} [Voided by ${operator.username}]`,
                                      channel: e.channel,
                                    });
                                    setConfirmVoidLedgerId(null);
                                    notify(`Voided voucher ${e.entryNo}.`, 'info');
                                  }}
                                  className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                                >
                                  Confirm Void
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmVoidLedgerId(e.id)}
                                  className="px-2 py-0.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-xs text-[11px] font-semibold cursor-pointer"
                                >
                                  Void
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: EMPLOYEES, GRANULAR RBAC & POP RESTRICTIONS
  // =========================================================================
  if (activeModule === 'employees' || activeModule === 'employees_rbac') {
    const handleSaveEmp = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (operator.mode !== 'COMPANY') {
        notify('Only Company Super Admin can create or edit Staff RBAC profiles.', 'error');
        return;
      }
      if (editingEmp) {
        await updateEmployee(editingEmp.id, empForm);
        notify(`Updated staff profile ${empForm.username}.`, 'success');
      } else {
        await createEmployee(user.uid, empForm);
        notify(`Created staff account ${empForm.username}.`, 'success');
      }
      setShowEmpForm(false);
    };

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">Employees &amp; RBAC</span>
            <span className="mx-1.5">/</span>
            <span>Staff Roles, POP/Area Visibility Restrictions &amp; Cash Channel Permissions</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingEmp(null);
              setShowEmpForm(true);
            }}
            className="px-3 py-1 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Staff / Operator
          </button>
        </div>

        {showEmpForm && (
          <form onSubmit={handleSaveEmp} className="bg-[#f8f9fa] border border-slate-300 p-4 rounded-xs text-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={empForm.fullName}
                  onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Staff Username *</label>
                <input
                  type="text"
                  required
                  value={empForm.username}
                  onChange={(e) => setEmpForm({ ...empForm, username: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select
                  value={empForm.role}
                  onChange={(e) => setEmpForm({ ...empForm, role: e.target.value as Employee['role'] })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Billing">Billing</option>
                  <option value="Support">Support</option>
                  <option value="NOC">NOC</option>
                  <option value="Operations">Operations</option>
                  <option value="POP Manager">POP Manager</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Mobile</label>
                <input
                  type="text"
                  value={empForm.mobile}
                  onChange={(e) => setEmpForm({ ...empForm, mobile: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Allowed POPs (ALL or comma-separated POP names)</label>
                <input
                  type="text"
                  value={empForm.allowedPops}
                  onChange={(e) => setEmpForm({ ...empForm, allowedPops: e.target.value })}
                  placeholder="ALL or Mirpur-POP, Pallabi-POP"
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Allowed Cash Channels</label>
                <input
                  type="text"
                  value={empForm.allowedCashChannels}
                  onChange={(e) => setEmpForm({ ...empForm, allowedCashChannels: e.target.value })}
                  placeholder="CASH, bKash Sync, Bank"
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empForm.canCollectCash}
                    onChange={(e) => setEmpForm({ ...empForm, canCollectCash: e.target.checked })}
                  />
                  <span>Can Collect Cash</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empForm.canEditPackage}
                    onChange={(e) => setEmpForm({ ...empForm, canEditPackage: e.target.checked })}
                  />
                  <span>Can Edit Packages</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empForm.canManageRouter}
                    onChange={(e) => setEmpForm({ ...empForm, canManageRouter: e.target.checked })}
                  />
                  <span>Can Manage NAS Routers</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empForm.canDeleteRecord}
                    onChange={(e) => setEmpForm({ ...empForm, canDeleteRecord: e.target.checked })}
                  />
                  <span>Can Delete Records</span>
                </label>
              </div>
              <button type="submit" className="px-4 py-1.5 bg-[#007bff] text-white font-semibold rounded-xs cursor-pointer">
                {editingEmp ? 'Update Staff' : 'Save Staff'}
              </button>
            </div>
          </form>
        )}

        <div className="bg-[#f8f9fa] border border-slate-300 p-2.5 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Role Filter:</span>
            <select
              value={empRoleFilter}
              onChange={(e) => setEmpRoleFilter(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-xs"
            >
              <option value="ALL">All Roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Billing">Billing</option>
              <option value="Support">Support</option>
              <option value="NOC">NOC</option>
              <option value="Operations">Operations</option>
              <option value="POP Manager">POP Manager</option>
            </select>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder="Search staff name, username, POP..."
              className="w-56 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-300 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="px-2.5 py-2 text-left">Username</th>
                <th className="px-2.5 py-2 text-left">Full Name</th>
                <th className="px-2.5 py-2 text-left">Role</th>
                <th className="px-2.5 py-2 text-left">POP Restriction</th>
                <th className="px-2.5 py-2 text-left">Cash Channels</th>
                <th className="px-2.5 py-2 text-left">
                  {activeModule === 'employees_rbac' ? 'Live RBAC Toggles (Click to Toggle)' : 'Privileges'}
                </th>
                <th className="px-2.5 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees
                .filter((emp) => {
                  if (empRoleFilter !== 'ALL' && emp.role !== empRoleFilter) return false;
                  if (empSearch.trim()) {
                    const q = empSearch.toLowerCase();
                    return (
                      emp.username.toLowerCase().includes(q) ||
                      emp.fullName.toLowerCase().includes(q) ||
                      emp.allowedPops.toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .map((emp) => (
                  <tr key={emp.id} className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">{emp.username}</td>
                    <td className="px-2.5 py-2 font-semibold">{emp.fullName}</td>
                    <td className="px-2.5 py-2">{emp.role}</td>
                    <td className="px-2.5 py-2 font-mono">{emp.allowedPops}</td>
                    <td className="px-2.5 py-2 font-mono text-[11px]">{emp.allowedCashChannels}</td>
                    <td className="px-2.5 py-2 text-[11px] text-slate-600">
                      {activeModule === 'employees_rbac' ? (
                        <div className="flex flex-wrap gap-1">
                          {(
                            [
                              ['canCollectCash', 'Cash'],
                              ['canEditPackage', 'Pkg'],
                              ['canManageRouter', 'NAS'],
                              ['canDeleteRecord', 'Del'],
                            ] as const
                          ).map(([field, label]) => (
                            <button
                              key={field}
                              type="button"
                              onClick={async () => {
                                if (operator.mode !== 'COMPANY') {
                                  notify('Switch to Company Super Admin role to modify RBAC privileges.', 'error');
                                  return;
                                }
                                await updateEmployee(emp.id, { [field]: !emp[field] });
                                notify(`Updated ${label} permission for ${emp.username}.`, 'success');
                              }}
                              className={`px-1.5 py-0.5 rounded-xs font-semibold cursor-pointer ${
                                emp[field]
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {label}: {emp[field] ? 'ON' : 'OFF'}
                            </button>
                          ))}
                        </div>
                      ) : (
                        [
                          emp.canCollectCash && 'Cash',
                          emp.canEditPackage && 'Pkg',
                          emp.canManageRouter && 'NAS',
                          emp.canDeleteRecord && 'Del',
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Read/Ticket Only'
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const popsArr = emp.allowedPops
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean);
                            const chArr = emp.allowedCashChannels
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean);
                            setOperator({
                              mode: 'STAFF',
                              displayName: emp.fullName,
                              username: emp.username,
                              roleLabel: emp.role.toUpperCase(),
                              allowedPops: popsArr.length ? popsArr : ['ALL'],
                              allowedCashChannels: chArr.length ? chArr : ['ALL'],
                              canEditPackage: emp.canEditPackage,
                              canCollectCash: emp.canCollectCash,
                              canManageRouter: emp.canManageRouter,
                              canDeleteRecord: emp.canDeleteRecord,
                            });
                            setActiveModule('customers_list');
                            notify(`Switched active operator session to ${emp.username} (${emp.role}).`, 'info');
                          }}
                          className="px-2 py-0.5 bg-slate-800 text-white rounded-xs text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                        >
                          <UserCog className="w-3 h-3 inline mr-0.5" /> Test Role
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEmp(emp);
                            setEmpForm({
                              username: emp.username,
                              password: emp.password,
                              fullName: emp.fullName,
                              mobile: emp.mobile,
                              email: emp.email,
                              role: emp.role,
                              department: emp.department,
                              allowedPops: emp.allowedPops,
                              allowedCashChannels: emp.allowedCashChannels,
                              canEditPackage: emp.canEditPackage,
                              canCollectCash: emp.canCollectCash,
                              canManageRouter: emp.canManageRouter,
                              canDeleteRecord: emp.canDeleteRecord,
                              status: emp.status,
                            });
                            setShowEmpForm(true);
                          }}
                          title="Edit Staff"
                          className="p-1 text-[#007bff] hover:bg-blue-50 rounded cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {operator.canDeleteRecord && (
                          confirmDeleteEmpId === emp.id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!user) return;
                                await deleteDocumentByPath('employees', emp.id);
                                await logAuditEvent(
                                  user.uid,
                                  operator.username,
                                  'Delete Staff',
                                  `Deleted staff operator ${emp.username} (${emp.fullName})`,
                                  emp.username
                                );
                                setConfirmDeleteEmpId(null);
                                notify(`Deleted staff operator ${emp.username}.`, 'info');
                              }}
                              className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                            >
                              Confirm
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteEmpId(emp.id)}
                              title="Delete Staff"
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: REPORTS & ANALYTICS + AUDIT LOGS (Maestro Keeper)
  // =========================================================================
  if (activeModule === 'reports' || activeModule === 'reports_cpe' || activeModule === 'audit_logs') {
    if (activeModule === 'audit_logs') {
      const filteredAudit = auditLogs.filter((a) => {
        if (!auditSearch.trim()) return true;
        const q = auditSearch.toLowerCase();
        return (
          a.code.toLowerCase().includes(q) ||
          a.actor.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.target.toLowerCase().includes(q) ||
          a.details.toLowerCase().includes(q)
        );
      });

      return (
        <div className="space-y-3">
          <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[#007bff]">Maestro Keeper</span>
              <span className="mx-1.5">/</span>
              <span>Operator Activity &amp; Security Audit Trail ({filteredAudit.length})</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded-xs text-xs">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search operator, action, target..."
                  className="w-52 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const csv = [
                    ['Audit_Code', 'Timestamp', 'Operator', 'Event_Title', 'Target', 'POP', 'Details'].join(','),
                    ...filteredAudit.map((a) =>
                      [a.code, `"${a.timestampStr}"`, a.actor, `"${a.title}"`, a.target, a.popName, `"${a.details}"`].join(',')
                    ),
                  ].join('\n');
                  downloadBlob(`maestro_keeper_audit_${new Date().toISOString().slice(0, 10)}.csv`, csv);
                  notify('Exported Maestro Keeper Audit Log CSV.', 'success');
                }}
                className="px-3 py-1 bg-[#17a2b8] text-white text-xs font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export Audit CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-300 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="maxim-amber-thead">
                  <th className="px-2.5 py-2 text-left">Audit ID</th>
                  <th className="px-2.5 py-2 text-left">Timestamp</th>
                  <th className="px-2.5 py-2 text-left">Operator</th>
                  <th className="px-2.5 py-2 text-left">Operation</th>
                  <th className="px-2.5 py-2 text-left">Target</th>
                  <th className="px-2.5 py-2 text-left">Audit Transcript</th>
                  {operator.canDeleteRecord && <th className="px-2.5 py-2 text-center">Del</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAudit.map((a) => (
                  <tr key={a.id} className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 font-mono font-bold text-slate-700">{a.code}</td>
                    <td className="px-2.5 py-2 font-mono">{a.timestampStr}</td>
                    <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">{a.actor}</td>
                    <td className="px-2.5 py-2 font-semibold">{a.title}</td>
                    <td className="px-2.5 py-2 font-mono">{a.target}</td>
                    <td className="px-2.5 py-2 font-mono text-[11px] text-slate-600">{a.details}</td>
                    {operator.canDeleteRecord && (
                      <td className="px-2.5 py-2 text-center">
                        {confirmDeleteAuditId === a.id ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteDocumentByPath('operationalLogs', a.id);
                              setConfirmDeleteAuditId(null);
                              notify(`Deleted audit entry ${a.code}.`, 'info');
                            }}
                            className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAuditId(a.id)}
                            className="p-0.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const handleDownloadBtrcDis = async () => {
      const res = await fetch('/api/reports/dis-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formatBrandName(settings?.companyName),
          btrcLicenseNo: settings?.btrcLicenseNo || 'BTRC-ISP-001',
          customers: visibleCustomers,
        }),
      });
      const csv = await res.text();
      downloadBlob(`BTRC_DIS_Report_${new Date().toISOString().slice(0, 10)}.csv`, csv);
      notify('Downloaded official BTRC DIS CSV report.', 'success');
    };

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">Reports &amp; Analytics</span>
            <span className="mx-1.5">/</span>
            <span>BTRC DIS Report, Payment Summary, Connecting Link / CPE Inventory &amp; SMS Logs</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadBtrcDis}
              className="px-3 py-1 bg-[#28a745] text-white text-xs font-semibold rounded-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Download BTRC DIS CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-2.5 py-1 bg-white border border-slate-400 text-xs font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print Report
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-300 pb-2 text-xs">
          {(
            [
              ['PAYMENTS', 'Payment Summary by Collector & Method'],
              ['LINK_CPE', 'Connecting Link Fiber & CPE ONU Inventory'],
              ['SMS_REPORT', 'SMS Dispatch & Reseller Transfer Report'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setReportTab(key)}
              className={`px-3 py-1.5 rounded-xs font-semibold whitespace-nowrap cursor-pointer ${
                reportTab === key ? 'bg-[#1f2227] text-white' : 'bg-white border border-slate-300 text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {reportTab === 'PAYMENTS' && (
          <div className="overflow-x-auto border border-slate-300 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="maxim-amber-thead">
                  <th className="px-2.5 py-2 text-left">Payment Channel / Method</th>
                  <th className="px-2.5 py-2 text-right">Receipts Count</th>
                  <th className="px-2.5 py-2 text-right">Total Collected (BDT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(['CASH', 'bKash Sync', 'Rocket Sync', 'Nagad Sync', 'Online Card', 'Bank'] as const).map((m) => {
                  const rows = payments.filter((p) => p.status === 'Completed' && p.method === m);
                  const sum = rows.reduce((a, b) => a + b.amount, 0);
                  return (
                    <tr key={m}>
                      <td className="px-2.5 py-2 font-bold">{m}</td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">{rows.length}</td>
                      <td className="px-2.5 py-2 text-right font-mono font-bold tabular-nums text-[#1e8449]">
                        BDT {sum.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {reportTab === 'LINK_CPE' && (
          <div className="space-y-2.5">
            <div className="bg-[#f8f9fa] border border-slate-300 p-2.5 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">Fiber Drop &amp; GPON ONU / CPE Hardware Inventory</span>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="Search ONU model, MAC, POP..."
                    className="w-48 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const csv = [
                      ['Cust_ID', 'Username', 'POP', 'Fiber_Drop', 'CPE_Model', 'OLT_Port', 'MAC_Address'].join(','),
                      ...visibleCustomers.map((c) =>
                        [c.custId, c.username, c.popName, `"${c.fiberLength}"`, `"${c.cpeModel}"`, c.oltPort, c.macAddress].join(',')
                      ),
                    ].join('\n');
                    downloadBlob(`rrr_cable_cpe_fiber_inventory_${new Date().toISOString().slice(0, 10)}.csv`, csv);
                    notify('Downloaded Fiber & CPE Inventory CSV.', 'success');
                  }}
                  className="px-2.5 py-1 bg-[#17a2b8] text-white font-semibold rounded-xs cursor-pointer"
                >
                  Export CPE CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-300 bg-white">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="maxim-amber-thead">
                    <th className="px-2.5 py-2 text-left">Cust ID</th>
                    <th className="px-2.5 py-2 text-left">Username</th>
                    <th className="px-2.5 py-2 text-left">POP</th>
                    <th className="px-2.5 py-2 text-left">Fiber Drop Length</th>
                    <th className="px-2.5 py-2 text-left">CPE / ONU Model</th>
                    <th className="px-2.5 py-2 text-left">OLT / Switch Port</th>
                    <th className="px-2.5 py-2 text-left">MAC Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleCustomers
                    .filter((c) => {
                      if (!reportSearch.trim()) return true;
                      const q = reportSearch.toLowerCase();
                      return (
                        c.username.toLowerCase().includes(q) ||
                        c.custId.toLowerCase().includes(q) ||
                        c.popName.toLowerCase().includes(q) ||
                        c.cpeModel.toLowerCase().includes(q) ||
                        c.macAddress.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => (
                      <tr key={c.id}>
                        <td className="px-2.5 py-2 font-mono">{c.custId}</td>
                        <td className="px-2.5 py-2 font-bold text-[#007bff]">{c.username}</td>
                        <td className="px-2.5 py-2">{c.popName}</td>
                        <td className="px-2.5 py-2 font-mono">{c.fiberLength}</td>
                        <td className="px-2.5 py-2">{c.cpeModel}</td>
                        <td className="px-2.5 py-2 font-mono">{c.oltPort}</td>
                        <td className="px-2.5 py-2 font-mono">{c.macAddress}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportTab === 'SMS_REPORT' && (
          <div className="overflow-x-auto border border-slate-300 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="maxim-amber-thead">
                  <th className="px-2.5 py-2 text-left">Ref</th>
                  <th className="px-2.5 py-2 text-left">Date</th>
                  <th className="px-2.5 py-2 text-left">Target</th>
                  <th className="px-2.5 py-2 text-left">Title</th>
                  <th className="px-2.5 py-2 text-right">Segments / Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {smsLogs.map((s) => (
                  <tr key={s.id}>
                    <td className="px-2.5 py-2 font-mono">{s.code}</td>
                    <td className="px-2.5 py-2 font-mono">{s.timestampStr}</td>
                    <td className="px-2.5 py-2">{s.target}</td>
                    <td className="px-2.5 py-2">{s.title}</td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">{s.numericVal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 5: SYSTEM SETTINGS, DATABASE BACKUP / RESTORE & SETUP DOCUMENTATION
  // =========================================================================
  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (operator.mode !== 'COMPANY') {
      notify('Only Company Super Admin can modify Organization & Gateway Settings.', 'error');
      return;
    }
    await saveWorkspaceSettings(user.uid, companyDraft);
    await logAuditEvent(user.uid, operator.username, 'Updated System Settings', `Updated organization settings for ${companyDraft.companyName}`);
    notify('Saved ISP System & Gateway Configuration.', 'success');
  };

  const handleExportFullJsonBackup = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      software: 'RRR CABLE NETWORK — ISP Billing & ERP',
      settings,
      pops,
      packages,
      routers,
      customers: allCustomers,
      resellers,
      employees,
      corporateClients,
      payments,
      tickets,
      tasks,
      ledgerEntries,
    };
    downloadBlob(
      `rrr_cable_full_database_backup_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(snapshot, null, 2),
      'application/json'
    );
    notify('Downloaded complete JSON database backup.', 'success');
  };

  const handleImportJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      let importedCount = 0;

      if (Array.isArray(parsed.pops)) {
        for (const p of parsed.pops.slice(0, 15)) {
          if (p.name && !pops.some((ex) => ex.name === p.name)) {
            await createPopZone(user.uid, p);
            importedCount++;
          }
        }
      }

      if (Array.isArray(parsed.packages)) {
        for (const p of parsed.packages.slice(0, 20)) {
          if (p.name && !packages.some((ex) => ex.name === p.name)) {
            await createIspPackage(user.uid, p);
            importedCount++;
          }
        }
      }

      if (Array.isArray(parsed.routers)) {
        for (const r of parsed.routers.slice(0, 10)) {
          if (r.name && !routers.some((ex) => ex.name === r.name)) {
            await createMikrotikRouter(user.uid, r);
            importedCount++;
          }
        }
      }

      if (Array.isArray(parsed.resellers)) {
        for (const r of parsed.resellers.slice(0, 15)) {
          if (r.username && !resellers.some((ex) => ex.username === r.username)) {
            await createReseller(user.uid, r);
            importedCount++;
          }
        }
      }

      if (Array.isArray(parsed.corporateClients)) {
        for (const cc of parsed.corporateClients.slice(0, 15)) {
          if (cc.clientCode && !corporateClients.some((ex) => ex.clientCode === cc.clientCode)) {
            await createCorporateClient(user.uid, cc);
            importedCount++;
          }
        }
      }

      if (Array.isArray(parsed.customers)) {
        for (const c of parsed.customers.slice(0, 40)) {
          if (c.username && !allCustomers.some((ex) => ex.username === c.username)) {
            await createCustomer(user.uid, c);
            importedCount++;
          }
        }
      }

      setRestoreStatus(`Validated backup archive (${file.name}). Merged ${importedCount} new non-duplicate records.`);
      notify(`Backup validated — merged ${importedCount} new records.`, 'success');
    } catch {
      setRestoreStatus('Invalid JSON backup file format.');
      notify('Invalid JSON backup file.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[#007bff]">System Settings</span>
          <span className="mx-1.5">/</span>
          <span>Organization Profile, Payment Gateways, Full Backup System &amp; Setup Guide</span>
        </div>
        <div className="flex gap-1.5 text-xs">
          {(
            [
              ['GENERAL', 'ISP & Gateway Config'],
              ['BACKUP', 'Database & Router Backup'],
              ['DOCS', 'Setup & Architecture Guide'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSettingsTab(k)}
              className={`px-3 py-1 rounded-xs font-semibold cursor-pointer ${
                settingsTab === k ? 'bg-[#1f2227] text-white' : 'bg-white border border-slate-300 text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {settingsTab === 'GENERAL' && (
        <form onSubmit={handleSaveGeneralSettings} className="bg-white border border-slate-300 p-4 rounded-xs text-xs space-y-4">
          <div className="font-bold uppercase text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-[#007bff]" /> ISP Organization, BTRC License &amp; Payment Sync Credentials
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Company / ISP Name</label>
              <input
                type="text"
                value={companyDraft.companyName}
                onChange={(e) => setCompanyDraft({ ...companyDraft, companyName: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Short Code</label>
              <input
                type="text"
                value={companyDraft.companyCode}
                onChange={(e) => setCompanyDraft({ ...companyDraft, companyCode: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">BTRC License Number</label>
              <input
                type="text"
                value={companyDraft.btrcLicenseNo}
                onChange={(e) => setCompanyDraft({ ...companyDraft, btrcLicenseNo: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">NOC Hotline</label>
              <input
                type="text"
                value={companyDraft.phone}
                onChange={(e) => setCompanyDraft({ ...companyDraft, phone: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">NOC Email</label>
              <input
                type="email"
                value={companyDraft.email}
                onChange={(e) => setCompanyDraft({ ...companyDraft, email: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">SMS Masking Sender ID</label>
              <input
                type="text"
                value={companyDraft.smsSenderId}
                onChange={(e) => setCompanyDraft({ ...companyDraft, smsSenderId: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">bKash Merchant / Personal Sync No</label>
              <input
                type="text"
                value={companyDraft.bkashMerchant}
                onChange={(e) => setCompanyDraft({ ...companyDraft, bkashMerchant: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">DBBL Rocket BillPay Biller ID</label>
              <input
                type="text"
                value={companyDraft.rocketMerchant}
                onChange={(e) => setCompanyDraft({ ...companyDraft, rocketMerchant: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Nagad Merchant Account</label>
              <input
                type="text"
                value={companyDraft.nagadMerchant}
                onChange={(e) => setCompanyDraft({ ...companyDraft, nagadMerchant: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Head Office Address</label>
            <input
              type="text"
              value={companyDraft.address}
              onChange={(e) => setCompanyDraft({ ...companyDraft, address: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-1.5 bg-[#28a745] text-white font-semibold rounded-xs cursor-pointer">
              Save Configuration
            </button>
          </div>
        </form>
      )}

      {settingsTab === 'BACKUP' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-white border border-slate-300 p-4 rounded-xs space-y-3">
            <div className="font-bold uppercase text-slate-800 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#007bff]" /> Complete Cloud Database JSON Snapshot
            </div>
            <p className="text-slate-600 leading-relaxed">
              Export all Subscribers ({allCustomers.length}), Packages ({packages.length}), NAS Routers ({routers.length}), Resellers ({resellers.length}), Corporate Accounts ({corporateClients.length}), Invoices, Tickets, and Ledger entries into a portable JSON archive.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportFullJsonBackup}
                className="px-4 py-2 bg-[#007bff] hover:bg-blue-700 text-white font-semibold rounded-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Full JSON Backup
              </button>
              <button
                type="button"
                onClick={() => {
                  const rsc = [
                    `# RRR CABLE NETWORK — RouterOS Disaster Recovery Export (${new Date().toISOString()})`,
                    '/ppp profile',
                    ...packages.map(
                      (p) =>
                        `add name="${p.name}" rate-limit="${p.uploadMbps}M/${p.downloadMbps}M" remote-address="${p.poolName}"`
                    ),
                    '/ppp secret',
                    ...allCustomers.map(
                      (c) =>
                        `add name="${c.username}" password="${c.password}" service=pppoe profile="${c.packageName}" remote-address=${
                          c.ipAddress || '0.0.0.0'
                        } disabled=${c.lockStatus === 'Locked' ? 'yes' : 'no'}`
                    ),
                  ].join('\n');
                  downloadBlob(`rrr_cable_routeros_recovery_${new Date().toISOString().slice(0, 10)}.rsc`, rsc, 'text/plain;charset=utf-8;');
                  notify('Downloaded MikroTik RouterOS .rsc Disaster Recovery Script.', 'success');
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-black text-white font-semibold rounded-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" /> RouterOS .rsc Backup
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-300 p-4 rounded-xs space-y-3">
            <div className="font-bold uppercase text-slate-800 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-[#28a745]" /> Restore / Merge JSON Backup Archive
            </div>
            <p className="text-slate-600 leading-relaxed">
              Upload a previously exported JSON backup file to restore missing packages and subscribers without overwriting existing live accounts.
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#28a745] hover:bg-[#218838] text-white font-semibold rounded-xs cursor-pointer">
              <Upload className="w-4 h-4" /> Select Backup (.json)
              <input type="file" accept=".json" onChange={handleImportJsonBackup} className="hidden" />
            </label>
            {restoreStatus && <div className="text-emerald-800 font-mono text-[11px] pt-1">{restoreStatus}</div>}
          </div>
        </div>
      )}

      {settingsTab === 'DOCS' && (
        <div className="bg-white border border-slate-300 p-5 rounded-xs text-xs space-y-4 leading-relaxed text-slate-700">
          <div className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
            <BookOpen className="w-4 h-4 text-[#007bff]" /> RRR CABLE NETWORK — Production Setup &amp; Operations Guide
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">1. Application Surfaces</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>Public Website:</strong> Accessible via the top-right surface bar or Public Website link — showcases features, BDT pricing, Maestro IP Log, and contact intake.
                </li>
                <li>
                  <strong>Admin &amp; Reseller Panel:</strong> Full ISP ERP with role switcher (Company, Staff RBAC, and Prepaid SDT Reseller sub-panel).
                </li>
                <li>
                  <strong>Customer Self-Care Portal:</strong> Subscribers sign in with Username/CustID + Password (e.g. <span className="font-mono">Mizan / 123456</span>) to pay bills, verify Mobile OTP, view session logs, and open tickets.
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">2. MikroTik RouterOS &amp; Safe Sandbox</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  All NAS routers default to <strong>Sandbox Mode</strong> so lock/unlock, package queue updates, MAC binding, and CoA disconnects execute safely during testing.
                </li>
                <li>
                  To connect a physical MikroTik CCR/RB router, enable RouterOS API service (<span className="font-mono">/ip service enable api</span> on port 8728), permit your server IP, and toggle the router to <strong>Live Mode</strong> in <em>MikroTik &amp; RADIUS</em>.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
