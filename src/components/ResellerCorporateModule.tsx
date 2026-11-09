import React, { useState } from 'react';
import {
  Activity,
  Building2,
  CreditCard,
  Edit3,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMaxim } from '../context/MaximContext';
import {
  createCorporateClient,
  createOperationalLog,
  createPaymentRecord,
  createReseller,
  deleteDocumentByPath,
  formatShortDateTime,
  logAuditEvent,
  saveWorkspaceSettings,
  updateCorporateClient,
  updateReseller,
} from '../services/maximService';
import type { CorporateClient, Reseller } from '../types';

interface MrtgPayload {
  linkId: string;
  capacityMbps: number;
  peakInboundMbps: number;
  avgInboundMbps: number;
  percentile95Mbps: number;
  points: Array<{
    time: string;
    inboundMbps: number;
    outboundMbps: number;
    cacheVasMbps: number;
  }>;
}

export function ResellerCorporateModule() {
  const {
    user,
    settings,
    activeModule,
    resellers,
    corporateClients,
    packages,
    operationalLogs,
    allCustomers,
    pops,
    operator,
    setOperator,
    setActiveModule,
    notify,
  } = useMaxim();

  // Reseller (SDT) State
  const [showResellerForm, setShowResellerForm] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [resellerSearch, setResellerSearch] = useState('');
  const [resellerPopFilter, setResellerPopFilter] = useState('ALL');
  const [confirmDeleteResellerId, setConfirmDeleteResellerId] = useState<string | null>(null);
  const [topupReseller, setTopupReseller] = useState<Reseller | null>(null);
  const [topupAmount, setTopupAmount] = useState('5000');
  const [smsSellReseller, setSmsSellReseller] = useState<Reseller | null>(null);
  const [smsSellQty, setSmsSellQty] = useState('1000');
  const [smsSellRate, setSmsSellRate] = useState('0.35');
  const [resellerForm, setResellerForm] = useState({
    username: '',
    password: '123456',
    companyName: '',
    contactPerson: '',
    mobile: '017',
    popName: 'Mirpur-POP',
    balance: 2500,
    creditLimit: 5000,
    smsBalance: 200,
    smsRate: 0.35,
    allowedCycles: 'Day of 1, Day of 10, Monthly Dynamic',
    customRateDiscount: 20,
    totalCustomers: 0,
    status: 'Active' as Reseller['status'],
  });

  // Corporate & Bulk Bandwidth State
  const [showCorpForm, setShowCorpForm] = useState(false);
  const [editingCorp, setEditingCorp] = useState<CorporateClient | null>(null);
  const [corpSearch, setCorpSearch] = useState('');
  const [corpPopFilter, setCorpPopFilter] = useState('ALL');
  const [confirmDeleteCorpId, setConfirmDeleteCorpId] = useState<string | null>(null);
  const [mrtgModalClient, setMrtgModalClient] = useState<CorporateClient | null>(null);
  const [mrtgData, setMrtgData] = useState<MrtgPayload | null>(null);
  const [corpPayClient, setCorpPayClient] = useState<CorporateClient | null>(null);
  const [corpPayAmount, setCorpPayAmount] = useState('');
  const [corpForm, setCorpForm] = useState({
    companyName: '',
    clientCode: '',
    contactPerson: '',
    mobile: '017',
    email: '',
    address: 'Gulshan-2, Dhaka',
    popName: 'Uttara-POP',
    iigMbps: 50,
    bdixMbps: 100,
    cacheMbps: 150,
    dataConnectivityMbps: 20,
    publicIpCount: 2,
    serverRentQty: 0,
    monthlyTotal: 28500,
    balance: 0,
    billingCycle: 'Day of 1',
    mrtgLinkId: 'CORP-SNMP-109',
    status: 'Active' as CorporateClient['status'],
  });

  // =========================================================================
  // VIEW 1A: RESELLER WHOLESALE TARIFFS & SMS TRANSFER LOGS
  // =========================================================================
  if (activeModule === 'resellers_tariffs') {
    const sdtLogs = operationalLogs.filter(
      (l) => l.metaOne === 'RESELLER-SMS-TRANSFER' || l.title.toLowerCase().includes('reseller')
    );

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">Resellers (SDT)</span>
            <span className="mx-1.5">/</span>
            <span>Wholesale Package Tariff Matrix &amp; Reseller SMS Credit Logs</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('resellers')}
            className="px-3 py-1 bg-[#007bff] text-white text-xs font-semibold rounded-xs cursor-pointer"
          >
            &larr; Manage Resellers &amp; Wallets
          </button>
        </div>

        <div className="border border-slate-300 bg-white overflow-x-auto">
          <div className="maxim-mint-banner">PACKAGE RETAIL VS SDT WHOLESALE TARIFF MATRIX</div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="px-2.5 py-2 text-left">Package Name</th>
                <th className="px-2.5 py-2 text-left">Speed / Queue</th>
                <th className="px-2.5 py-2 text-right">Subscriber Retail Rate</th>
                <th className="px-2.5 py-2 text-right">Base SDT Wholesale Rate</th>
                <th className="px-2.5 py-2 text-right">SDT Margin / Sub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-amber-50/40">
                  <td className="px-2.5 py-2 font-bold text-[#007bff]">{p.name}</td>
                  <td className="px-2.5 py-2 font-mono">{p.downloadMbps}M / {p.uploadMbps}M ({p.mikrotikQueue})</td>
                  <td className="px-2.5 py-2 text-right font-mono font-bold">BDT {p.monthlyRate.toLocaleString()}</td>
                  <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-700">BDT {p.resellerRate.toLocaleString()}</td>
                  <td className="px-2.5 py-2 text-right font-mono font-semibold text-amber-800">
                    BDT {(p.monthlyRate - p.resellerRate).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-slate-300 bg-white overflow-x-auto">
          <div className="maxim-mint-banner">RESELLER SMS TRANSFERS &amp; WALLET ACTIVITY LOGS</div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="px-2.5 py-2 text-left">Ref Code</th>
                <th className="px-2.5 py-2 text-left">Timestamp</th>
                <th className="px-2.5 py-2 text-left">Reseller / Target</th>
                <th className="px-2.5 py-2 text-left">Action</th>
                <th className="px-2.5 py-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sdtLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    No reseller SMS transfers or wallet audit events recorded yet.
                  </td>
                </tr>
              ) : (
                sdtLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 font-mono font-semibold text-[#007bff]">{log.code}</td>
                    <td className="px-2.5 py-2 font-mono">{log.timestampStr}</td>
                    <td className="px-2.5 py-2 font-bold">{log.target}</td>
                    <td className="px-2.5 py-2 font-semibold">{log.title}</td>
                    <td className="px-2.5 py-2 text-slate-600">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1B: PREPAID RESELLERS (SDT SUB-DEALER MANAGEMENT)
  // =========================================================================
  if (activeModule === 'resellers') {
    const handleSaveReseller = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (editingReseller) {
        await updateReseller(editingReseller.id, resellerForm);
        notify(`Updated SDT Reseller ${resellerForm.companyName}.`, 'success');
      } else {
        await createReseller(user.uid, resellerForm);
        notify(`Created SDT Reseller ${resellerForm.companyName}.`, 'success');
      }
      setShowResellerForm(false);
    };

    const handleTopupWallet = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !topupReseller) return;
      const amt = Math.max(100, Number(topupAmount) || 0);
      await updateReseller(topupReseller.id, {
        balance: Number((topupReseller.balance + amt).toFixed(2)),
      });
      await createPaymentRecord(user.uid, {
        trxNumber: `SDT-${Date.now().toString(36).toUpperCase()}`,
        targetType: 'Reseller',
        customerId: topupReseller.id,
        customerUsername: topupReseller.username,
        customerName: topupReseller.companyName,
        amount: amt,
        chargeAmount: amt,
        billForMonths: 1,
        method: 'CASH',
        channel: 'SDT Wallet Top-Up',
        receivedBy: operator.username,
        syncSource: 'Reseller Funding',
        senderMobile: topupReseller.mobile,
        status: 'Completed',
        remarks: `SDT Prepaid Wallet Recharge for ${topupReseller.companyName}`,
        oldExpiry: '',
        newExpiry: '',
        paymentDate: formatShortDateTime(),
      });
      await logAuditEvent(
        user.uid,
        operator.username,
        'SDT Reseller Balance Top-Up',
        `Credited BDT ${amt} to reseller ${topupReseller.username}`,
        topupReseller.username,
        topupReseller.popName
      );
      notify(`Credited BDT ${amt.toLocaleString()} to ${topupReseller.companyName}.`, 'success');
      setTopupReseller(null);
    };

    const handleSellSmsToReseller = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !smsSellReseller) return;
      const qty = Math.max(50, Number(smsSellQty) || 0);
      const rate = Math.max(0.1, Number(smsSellRate) || 0.35);
      const totalCost = Number((qty * rate).toFixed(2));
      const baseCost = Number((qty * (settings?.smsRate || 0.25)).toFixed(2));
      const margin = Number((totalCost - baseCost).toFixed(2));

      if (smsSellReseller.balance + smsSellReseller.creditLimit < totalCost) {
        notify('Insufficient Reseller balance/overdraft limit for SMS purchase.', 'error');
        return;
      }

      await updateReseller(smsSellReseller.id, {
        smsBalance: smsSellReseller.smsBalance + qty,
        smsRate: rate,
        balance: Number((smsSellReseller.balance - totalCost).toFixed(2)),
      });

      if (settings) {
        await saveWorkspaceSettings(user.uid, {
          smsBalance: Math.max(0, settings.smsBalance - qty),
        });
      }

      await createOperationalLog(user.uid, {
        logCategory: 'sms_log',
        code: `SMS-SDT-${Date.now().toString(36).toUpperCase()}`,
        actor: operator.username,
        target: smsSellReseller.username,
        popName: smsSellReseller.popName,
        title: `Sold ${qty} SMS Credits to ${smsSellReseller.companyName}`,
        details: `Charged BDT ${totalCost} (@${rate}/SMS) | ISP Profit Margin: BDT ${margin}`,
        metaOne: 'RESELLER-SMS-TRANSFER',
        metaTwo: `${qty} SMS`,
        numericVal: totalCost,
        status: 'Transferred',
        timestampStr: formatShortDateTime(),
      });

      notify(`Transferred ${qty} SMS to ${smsSellReseller.username} (Profit: BDT ${margin}).`, 'success');
      setSmsSellReseller(null);
    };

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">Resellers (SDT)</span>
            <span className="mx-1.5">/</span>
            <span>Prepaid Sub-Dealers, Overdraft Limits, Custom Package Discounts &amp; SMS Sales</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingReseller(null);
              setResellerForm({
                username: `sdt_${resellers.length + 1}`,
                password: '123456',
                companyName: '',
                contactPerson: '',
                mobile: '017',
                popName: pops[0]?.name || 'Mirpur-POP',
                balance: 2000,
                creditLimit: 3000,
                smsBalance: 100,
                smsRate: 0.35,
                allowedCycles: 'Day of 1, Day of 10, Monthly Dynamic',
                customRateDiscount: 20,
                totalCustomers: 0,
                status: 'Active',
              });
              setShowResellerForm(true);
            }}
            className="px-3 py-1 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add SDT Reseller
          </button>
        </div>

        {showResellerForm && (
          <form onSubmit={handleSaveReseller} className="bg-[#f8f9fa] border border-slate-300 p-4 rounded-xs text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="font-bold uppercase text-slate-800">
                {editingReseller ? `Edit Reseller: ${editingReseller.companyName}` : 'Create Prepaid SDT Reseller'}
              </span>
              <button type="button" onClick={() => setShowResellerForm(false)} className="text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold mb-1">Reseller Firm Name *</label>
                <input
                  type="text"
                  required
                  value={resellerForm.companyName}
                  onChange={(e) => setResellerForm({ ...resellerForm, companyName: e.target.value })}
                  placeholder="Pallabi Cyber Net"
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Login Username *</label>
                <input
                  type="text"
                  required
                  value={resellerForm.username}
                  onChange={(e) => setResellerForm({ ...resellerForm, username: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Contact Person</label>
                <input
                  type="text"
                  value={resellerForm.contactPerson}
                  onChange={(e) => setResellerForm({ ...resellerForm, contactPerson: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Mobile No</label>
                <input
                  type="text"
                  value={resellerForm.mobile}
                  onChange={(e) => setResellerForm({ ...resellerForm, mobile: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Assigned POP</label>
                <select
                  value={resellerForm.popName}
                  onChange={(e) => setResellerForm({ ...resellerForm, popName: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                >
                  {pops.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Wallet Balance (BDT)</label>
                <input
                  type="number"
                  value={resellerForm.balance}
                  onChange={(e) => setResellerForm({ ...resellerForm, balance: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Overdraft Credit Limit (BDT)</label>
                <input
                  type="number"
                  min={0}
                  value={resellerForm.creditLimit}
                  onChange={(e) => setResellerForm({ ...resellerForm, creditLimit: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Wholesale Discount (%)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={resellerForm.customRateDiscount}
                  onChange={(e) => setResellerForm({ ...resellerForm, customRateDiscount: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Allowed Billing Cycles</label>
                <input
                  type="text"
                  value={resellerForm.allowedCycles}
                  onChange={(e) => setResellerForm({ ...resellerForm, allowedCycles: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">SMS Selling Rate (BDT)</label>
                <input
                  type="number"
                  step="0.05"
                  value={resellerForm.smsRate}
                  onChange={(e) => setResellerForm({ ...resellerForm, smsRate: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full py-1.5 bg-[#007bff] text-white font-semibold rounded-xs cursor-pointer">
                  {editingReseller ? 'Update Reseller' : 'Save Reseller'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="bg-[#f8f9fa] border border-slate-300 p-2.5 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold">POP Filter:</span>
            <select
              value={resellerPopFilter}
              onChange={(e) => setResellerPopFilter(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-xs"
            >
              <option value="ALL">All POPs</option>
              {pops.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={resellerSearch}
              onChange={(e) => setResellerSearch(e.target.value)}
              placeholder="Search reseller firm, username, mobile..."
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-xs w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-300 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="px-2.5 py-2 text-left">Username</th>
                <th className="px-2.5 py-2 text-left">Reseller Firm</th>
                <th className="px-2.5 py-2 text-left">POP</th>
                <th className="px-2.5 py-2 text-right">Sub-Users</th>
                <th className="px-2.5 py-2 text-right">SDT Balance</th>
                <th className="px-2.5 py-2 text-right">Overdraft Limit</th>
                <th className="px-2.5 py-2 text-right">Discount</th>
                <th className="px-2.5 py-2 text-right">SMS Credits</th>
                <th className="px-2.5 py-2 text-center">Status</th>
                <th className="px-2.5 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {resellers
                .filter((r) => {
                  if (resellerPopFilter !== 'ALL' && r.popName !== resellerPopFilter) return false;
                  if (resellerSearch.trim()) {
                    const q = resellerSearch.toLowerCase();
                    return (
                      r.username.toLowerCase().includes(q) ||
                      r.companyName.toLowerCase().includes(q) ||
                      r.mobile.toLowerCase().includes(q) ||
                      r.contactPerson.toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .map((r) => {
                  const subCount = allCustomers.filter((c) => c.resellerId === r.id).length || r.totalCustomers;
                  return (
                  <tr key={r.id} className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">{r.username}</td>
                    <td className="px-2.5 py-2">
                      <div className="font-bold text-slate-900">{r.companyName}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.contactPerson} · {r.mobile}
                      </div>
                    </td>
                    <td className="px-2.5 py-2">{r.popName}</td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums font-bold">{subCount}</td>
                    <td
                      className={`px-2.5 py-2 text-right font-mono tabular-nums font-bold ${
                        r.balance < 0 ? 'text-red-600' : 'text-[#1e8449]'
                      }`}
                    >
                      BDT {r.balance.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                      BDT {r.creditLimit.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">{r.customRateDiscount}%</td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                      {r.smsBalance} <span className="text-slate-400">(@{r.smsRate})</span>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-xs ${
                          r.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTopupReseller(r);
                            setTopupAmount('5000');
                          }}
                          title="Add SDT Prepaid Balance"
                          className="px-2 py-0.5 bg-[#28a745] text-white rounded-xs text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                        >
                          <Wallet className="w-3 h-3 inline mr-0.5" /> +Fund
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSmsSellReseller(r);
                            setSmsSellQty('500');
                            setSmsSellRate(String(r.smsRate || 0.35));
                          }}
                          title="Sell SMS Credits with Margin"
                          className="px-2 py-0.5 bg-[#17a2b8] text-white rounded-xs text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3 inline mr-0.5" /> SMS
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOperator({
                              mode: 'RESELLER',
                              displayName: r.companyName,
                              username: r.username,
                              roleLabel: 'RESELLER (SDT)',
                              allowedPops: [r.popName],
                              allowedCashChannels: ['CASH'],
                              resellerId: r.id,
                              canEditPackage: false,
                              canCollectCash: true,
                              canManageRouter: false,
                              canDeleteRecord: false,
                            });
                            setActiveModule('customers_list');
                            notify(`Switched panel to Reseller (${r.username}) isolated view.`, 'info');
                          }}
                          title="Preview Reseller Sub-Panel"
                          className="p-1 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReseller(r);
                            setResellerForm({
                              username: r.username,
                              password: r.password,
                              companyName: r.companyName,
                              contactPerson: r.contactPerson,
                              mobile: r.mobile,
                              popName: r.popName,
                              balance: r.balance,
                              creditLimit: r.creditLimit,
                              smsBalance: r.smsBalance,
                              smsRate: r.smsRate,
                              allowedCycles: r.allowedCycles,
                              customRateDiscount: r.customRateDiscount,
                              totalCustomers: r.totalCustomers,
                              status: r.status,
                            });
                            setShowResellerForm(true);
                          }}
                          className="p-1 text-[#007bff] hover:bg-blue-50 rounded cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {operator.canDeleteRecord && (
                          confirmDeleteResellerId === r.id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!user) return;
                                await deleteDocumentByPath('resellers', r.id);
                                await logAuditEvent(
                                  user.uid,
                                  operator.username,
                                  'Delete Reseller',
                                  `Deleted SDT reseller ${r.username} (${r.companyName})`,
                                  r.username,
                                  r.popName
                                );
                                setConfirmDeleteResellerId(null);
                                notify(`Deleted reseller ${r.companyName}.`, 'info');
                              }}
                              className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                            >
                              Confirm
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteResellerId(r.id)}
                              title="Delete Reseller"
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Wallet Top-up Modal */}
        {topupReseller && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <form onSubmit={handleTopupWallet} className="bg-white border border-slate-500 max-w-sm w-full rounded-xs overflow-hidden text-xs shadow-xl">
              <div className="maxim-mint-banner flex items-center justify-between px-3">
                <span>RECHARGE SDT WALLET</span>
                <button type="button" onClick={() => setTopupReseller(null)} className="cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  Reseller: <strong>{topupReseller.companyName}</strong> ({topupReseller.username})
                </div>
                <div>
                  Current SDT Balance:{' '}
                  <strong className="font-mono">BDT {topupReseller.balance.toLocaleString()}</strong>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Top-Up Amount (BDT)</label>
                  <input
                    type="number"
                    min={100}
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    className="w-full px-3 py-1.5 border border-emerald-400 bg-emerald-50/40 rounded font-mono font-bold text-slate-900"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setTopupReseller(null)} className="maxim-btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="maxim-btn-success">
                    Credit Balance
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Sell SMS Modal */}
        {smsSellReseller && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <form onSubmit={handleSellSmsToReseller} className="bg-white border border-slate-500 max-w-sm w-full rounded-xs overflow-hidden text-xs shadow-xl">
              <div className="maxim-mint-banner flex items-center justify-between px-3">
                <span>SELL SMS CREDITS TO RESELLER</span>
                <button type="button" onClick={() => setSmsSellReseller(null)} className="cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  Reseller: <strong>{smsSellReseller.companyName}</strong>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">SMS Quantity</label>
                    <input
                      type="number"
                      min={50}
                      value={smsSellQty}
                      onChange={(e) => setSmsSellQty(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Sell Rate (BDT)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={smsSellRate}
                      onChange={(e) => setSmsSellRate(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-400 font-mono"
                    />
                  </div>
                </div>
                <div className="bg-slate-50 p-2 border border-slate-200 font-mono">
                  Total Deduction:{' '}
                  <strong>BDT {(Number(smsSellQty || 0) * Number(smsSellRate || 0)).toFixed(2)}</strong>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setSmsSellReseller(null)} className="px-3 py-1 bg-slate-200 rounded-xs cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-3.5 py-1 bg-[#17a2b8] text-white font-semibold rounded-xs cursor-pointer">
                    Transfer SMS
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: CORPORATE & BULK BANDWIDTH + VAS + LIVE MRTG GRAPHS
  // =========================================================================
  const calculateRecommendedMonthly = (f: typeof corpForm) => {
    return (
      f.iigMbps * 250 +
      f.bdixMbps * 60 +
      f.cacheMbps * 40 +
      f.dataConnectivityMbps * 180 +
      f.publicIpCount * 500 +
      f.serverRentQty * 4500
    );
  };

  const handleOpenMrtgGraph = async (client: CorporateClient) => {
    setMrtgModalClient(client);
    const totalCap = client.iigMbps + client.bdixMbps + client.cacheMbps + client.dataConnectivityMbps;
    try {
      const res = await fetch(`/api/mrtg/${encodeURIComponent(client.mrtgLinkId)}?capacity=${totalCap}`);
      const json = (await res.json()) as MrtgPayload;
      setMrtgData(json);
    } catch {
      notify('Could not fetch MRTG SNMP series.', 'error');
    }
  };

  const handleSaveCorp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (editingCorp) {
      await updateCorporateClient(editingCorp.id, corpForm);
      notify(`Updated Corporate link ${corpForm.companyName}.`, 'success');
    } else {
      await createCorporateClient(user.uid, corpForm);
      notify(`Created Corporate client ${corpForm.companyName}.`, 'success');
    }
    setShowCorpForm(false);
  };

  const handleReceiveCorpInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !corpPayClient) return;
    const amt = Math.max(100, Number(corpPayAmount) || corpPayClient.monthlyTotal);
    await createPaymentRecord(user.uid, {
      trxNumber: `CORP-${Date.now().toString(36).toUpperCase()}`,
      targetType: 'Corporate',
      customerId: corpPayClient.id,
      customerUsername: corpPayClient.clientCode,
      customerName: corpPayClient.companyName,
      amount: amt,
      chargeAmount: corpPayClient.monthlyTotal,
      billForMonths: 1,
      method: 'Bank',
      channel: 'Corporate Bank EFT/Cheque',
      receivedBy: operator.username,
      syncSource: 'Corporate Billing',
      senderMobile: corpPayClient.mobile,
      status: 'Completed',
      remarks: `Corporate Bulk BW & VAS Invoice settled for ${corpPayClient.companyName}`,
      oldExpiry: '',
      newExpiry: '',
      paymentDate: formatShortDateTime(),
    });
    await updateCorporateClient(corpPayClient.id, {
      balance: Number((corpPayClient.balance + amt).toFixed(2)),
    });
    notify(`Recorded Corporate Invoice payment of BDT ${amt.toLocaleString()} for ${corpPayClient.companyName}.`, 'success');
    setCorpPayClient(null);
  };

  const filteredCorpClients = corporateClients.filter((c) => {
    if (corpPopFilter !== 'ALL' && c.popName !== corpPopFilter) return false;
    if (corpSearch.trim()) {
      const q = corpSearch.toLowerCase();
      return (
        c.companyName.toLowerCase().includes(q) ||
        c.clientCode.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalCorpIig = filteredCorpClients.reduce((s, c) => s + c.iigMbps, 0);
  const totalCorpBdix = filteredCorpClients.reduce((s, c) => s + c.bdixMbps, 0);
  const totalCorpCache = filteredCorpClients.reduce((s, c) => s + c.cacheMbps, 0);
  const totalCorpMrc = filteredCorpClients.reduce((s, c) => s + c.monthlyTotal, 0);

  return (
    <div className="space-y-4">
      <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[#007bff]">Corporate &amp; Bulk BW</span>
          <span className="mx-1.5">/</span>
          <span>
            {activeModule === 'corporate_mrtg'
              ? 'SNMP Bandwidth Capacity & Simulated MRTG Telemetry'
              : 'Dedicated IIG / BDIX / Cache / Data Connectivity & VAS'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingCorp(null);
            setShowCorpForm(true);
          }}
          className="px-3 py-1 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Corporate Client
        </button>
      </div>

      {activeModule === 'corporate_mrtg' && (
        <div className="space-y-2">
          <div className="bg-amber-50 border border-amber-300 px-3 py-2 rounded-xs text-xs text-amber-950">
            <strong>[Simulated SNMP MRTG Telemetry]</strong> Corporate bandwidth graphs render realistic utilization curves scaled to each client&apos;s provisioned IIG/BDIX/Cache capacity. Connect an external SNMPv2c/v3 poller (Cacti / LibreNMS / RouterOS SNMP) in production for hardware interface counters.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white border border-slate-300 rounded-xs">
              <p className="text-slate-500">Provisioned IIG Bandwidth</p>
              <p className="text-lg font-bold font-mono text-slate-900">{totalCorpIig} Mbps</p>
            </div>
            <div className="p-3 bg-white border border-slate-300 rounded-xs">
              <p className="text-slate-500">Provisioned BDIX Peering</p>
              <p className="text-lg font-bold font-mono text-[#007bff]">{totalCorpBdix} Mbps</p>
            </div>
            <div className="p-3 bg-white border border-slate-300 rounded-xs">
              <p className="text-slate-500">GGC / FNA Cache Capacity</p>
              <p className="text-lg font-bold font-mono text-cyan-700">{totalCorpCache} Mbps</p>
            </div>
            <div className="p-3 bg-white border border-slate-300 rounded-xs">
              <p className="text-slate-500">Monthly Corporate MRC</p>
              <p className="text-lg font-bold font-mono text-emerald-700">BDT {totalCorpMrc.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {showCorpForm && (
        <form onSubmit={handleSaveCorp} className="bg-[#f8f9fa] border border-slate-300 p-4 rounded-xs text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-300 pb-2">
            <span className="font-bold uppercase text-slate-800">
              {editingCorp ? `Upgrade / Edit Corporate Link: ${editingCorp.companyName}` : 'Provision Corporate Bulk Bandwidth & VAS'}
            </span>
            <button type="button" onClick={() => setShowCorpForm(false)} className="text-slate-500 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold mb-1">Enterprise Name *</label>
              <input
                type="text"
                required
                value={corpForm.companyName}
                onChange={(e) => setCorpForm({ ...corpForm, companyName: e.target.value })}
                placeholder="Apex Garments Ltd."
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Client Code *</label>
              <input
                type="text"
                required
                value={corpForm.clientCode}
                onChange={(e) => setCorpForm({ ...corpForm, clientCode: e.target.value })}
                placeholder="CORP-204"
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Contact Person</label>
              <input
                type="text"
                value={corpForm.contactPerson}
                onChange={(e) => setCorpForm({ ...corpForm, contactPerson: e.target.value })}
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">POP Termination</label>
              <select
                value={corpForm.popName}
                onChange={(e) => setCorpForm({ ...corpForm, popName: e.target.value })}
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
              >
                {pops.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">IIG Internet (Mbps)</label>
              <input
                type="number"
                min={0}
                value={corpForm.iigMbps}
                onChange={(e) => {
                  const next = { ...corpForm, iigMbps: Number(e.target.value) };
                  setCorpForm({ ...next, monthlyTotal: calculateRecommendedMonthly(next) });
                }}
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">BDIX Peering (Mbps)</label>
              <input
                type="number"
                min={0}
                value={corpForm.bdixMbps}
                onChange={(e) => {
                  const next = { ...corpForm, bdixMbps: Number(e.target.value) };
                  setCorpForm({ ...next, monthlyTotal: calculateRecommendedMonthly(next) });
                }}
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">GGC / FNA Cache (Mbps)</label>
              <input
                type="number"
                min={0}
                value={corpForm.cacheMbps}
                onChange={(e) => {
                  const next = { ...corpForm, cacheMbps: Number(e.target.value) };
                  setCorpForm({ ...next, monthlyTotal: calculateRecommendedMonthly(next) });
                }}
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">L2 Data MPLS (Mbps)</label>
              <input
                type="number"
                min={0}
                value={corpForm.dataConnectivityMbps}
                onChange={(e) => {
                  const next = { ...corpForm, dataConnectivityMbps: Number(e.target.value) };
                  setCorpForm({ ...next, monthlyTotal: calculateRecommendedMonthly(next) });
                }}
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">VAS: Routed Public IPs</label>
              <input
                type="number"
                min={0}
                value={corpForm.publicIpCount}
                onChange={(e) => {
                  const next = { ...corpForm, publicIpCount: Number(e.target.value) };
                  setCorpForm({ ...next, monthlyTotal: calculateRecommendedMonthly(next) });
                }}
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">VAS: Co-Location / Server Rent</label>
              <input
                type="number"
                min={0}
                value={corpForm.serverRentQty}
                onChange={(e) => {
                  const next = { ...corpForm, serverRentQty: Number(e.target.value) };
                  setCorpForm({ ...next, monthlyTotal: calculateRecommendedMonthly(next) });
                }}
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">SNMP MRTG Interface ID</label>
              <input
                type="text"
                value={corpForm.mrtgLinkId}
                onChange={(e) => setCorpForm({ ...corpForm, mrtgLinkId: e.target.value })}
                className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Monthly Recurring MRC (BDT)</label>
              <input
                type="number"
                value={corpForm.monthlyTotal}
                onChange={(e) => setCorpForm({ ...corpForm, monthlyTotal: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-emerald-400 bg-emerald-50/40 font-mono font-bold rounded text-slate-900"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-1.5 bg-[#007bff] text-white font-semibold rounded-xs cursor-pointer">
              {editingCorp ? 'Save Bandwidth & VAS Changes' : 'Create Corporate Account'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-[#f8f9fa] border border-slate-300 p-2.5 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold">POP Filter:</span>
          <select
            value={corpPopFilter}
            onChange={(e) => setCorpPopFilter(e.target.value)}
            className="px-2 py-1 bg-white border border-slate-300 rounded-xs"
          >
            <option value="ALL">All POPs</option>
            {pops.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={corpSearch}
            onChange={(e) => setCorpSearch(e.target.value)}
            placeholder="Search company, code, contact..."
            className="px-2.5 py-1 bg-white border border-slate-300 rounded-xs w-60"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="maxim-amber-thead">
              <th className="px-2.5 py-2 text-left">Code</th>
              <th className="px-2.5 py-2 text-left">Enterprise Client</th>
              <th className="px-2.5 py-2 text-left">POP</th>
              <th className="px-2.5 py-2 text-right">IIG / BDIX / Cache / Data</th>
              <th className="px-2.5 py-2 text-left">VAS Items</th>
              <th className="px-2.5 py-2 text-right">Monthly MRC</th>
              <th className="px-2.5 py-2 text-right">Ledger Bal</th>
              <th className="px-2.5 py-2 text-center">MRTG &amp; Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredCorpClients.map((c) => (
              <tr key={c.id} className="hover:bg-amber-50/40">
                <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">{c.clientCode}</td>
                <td className="px-2.5 py-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" /> {c.companyName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {c.contactPerson} · {c.mobile}
                  </div>
                </td>
                <td className="px-2.5 py-2">{c.popName}</td>
                <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                  {c.iigMbps}M / {c.bdixMbps}M / {c.cacheMbps}M / {c.dataConnectivityMbps}M
                </td>
                <td className="px-2.5 py-2 font-mono text-[11px]">
                  {c.publicIpCount} IP · {c.serverRentQty} Rack
                </td>
                <td className="px-2.5 py-2 text-right font-mono font-bold tabular-nums">
                  BDT {c.monthlyTotal.toLocaleString()}
                </td>
                <td
                  className={`px-2.5 py-2 text-right font-mono font-bold tabular-nums ${
                    c.balance < 0 ? 'text-red-600' : 'text-[#1e8449]'
                  }`}
                >
                  BDT {c.balance.toLocaleString()}
                </td>
                <td className="px-2.5 py-2 text-center">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenMrtgGraph(c)}
                      className="px-2 py-0.5 bg-[#17a2b8] hover:bg-cyan-700 text-white rounded-xs text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Activity className="w-3 h-3" /> MRTG
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCorpPayClient(c);
                        setCorpPayAmount(String(c.monthlyTotal));
                      }}
                      title="Receive Corporate Invoice Payment"
                      className="p-1 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCorp(c);
                        setCorpForm({
                          companyName: c.companyName,
                          clientCode: c.clientCode,
                          contactPerson: c.contactPerson,
                          mobile: c.mobile,
                          email: c.email,
                          address: c.address,
                          popName: c.popName,
                          iigMbps: c.iigMbps,
                          bdixMbps: c.bdixMbps,
                          cacheMbps: c.cacheMbps,
                          dataConnectivityMbps: c.dataConnectivityMbps,
                          publicIpCount: c.publicIpCount,
                          serverRentQty: c.serverRentQty,
                          monthlyTotal: c.monthlyTotal,
                          balance: c.balance,
                          billingCycle: c.billingCycle,
                          mrtgLinkId: c.mrtgLinkId,
                          status: c.status,
                        });
                        setShowCorpForm(true);
                      }}
                      title="Upgrade / Downgrade Bandwidth"
                      className="p-1 text-[#007bff] hover:bg-blue-50 rounded cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {operator.canDeleteRecord && (
                      confirmDeleteCorpId === c.id ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteDocumentByPath('corporateClients', c.id);
                            setConfirmDeleteCorpId(null);
                            notify(`Deleted corporate record ${c.companyName}.`, 'info');
                          }}
                          className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                        >
                          Confirm
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCorpId(c.id)}
                          title="Delete Corporate Client"
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

      {/* MRTG Graph Modal (Simulated SNMP Telemetry) */}
      {mrtgModalClient && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-500 max-w-3xl w-full rounded-xs overflow-hidden shadow-xl text-xs">
            <div className="maxim-mint-banner flex items-center justify-between px-3">
              <span>
                SNMP MRTG BANDWIDTH UTILIZATION (SIMULATED CURVE) — {mrtgModalClient.companyName} ({mrtgModalClient.mrtgLinkId})
              </span>
              <button type="button" onClick={() => setMrtgModalClient(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-amber-50 border border-amber-300 px-2.5 py-1.5 rounded-xs text-[11px] text-amber-950">
                <strong>[Simulated Telemetry Curve]</strong> Scaled dynamically from provisioned bandwidth ({mrtgModalClient.iigMbps + mrtgModalClient.bdixMbps + mrtgModalClient.cacheMbps + mrtgModalClient.dataConnectivityMbps} Mbps total). Connect live SNMPv2c/v3 interface polling in production for physical router counters.
              </div>
              {mrtgData ? (
                <>
                  <div className="grid grid-cols-4 gap-2 bg-slate-50 border border-slate-200 p-2.5 font-mono">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Provisioned Cap</span>
                      <strong>{mrtgData.capacityMbps} Mbps</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Peak Inbound</span>
                      <strong className="text-emerald-700">{mrtgData.peakInboundMbps} Mbps</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Average Inbound</span>
                      <strong className="text-blue-700">{mrtgData.avgInboundMbps} Mbps</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">95th Percentile</span>
                      <strong className="text-amber-700">{mrtgData.percentile95Mbps} Mbps</strong>
                    </div>
                  </div>
                  <div className="h-64 w-full border border-slate-200 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mrtgData.points}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="M" />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Area
                          type="monotone"
                          dataKey="inboundMbps"
                          name="Inbound Download (Mbps)"
                          stroke="#16a34a"
                          fill="#bbf7d0"
                        />
                        <Area
                          type="monotone"
                          dataKey="cacheVasMbps"
                          name="GGC/BDIX Cache (Mbps)"
                          stroke="#0284c7"
                          fill="#bae6fd"
                        />
                        <Area
                          type="monotone"
                          dataKey="outboundMbps"
                          name="Outbound Upload (Mbps)"
                          stroke="#dc2626"
                          fill="#fecaca"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-500">Polling SNMP interface counters...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Corporate Invoice Settlement Modal */}
      {corpPayClient && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleReceiveCorpInvoice} className="bg-white border border-slate-500 max-w-sm w-full rounded-xs overflow-hidden text-xs shadow-xl">
            <div className="maxim-mint-banner flex items-center justify-between px-3">
              <span>COLLECT CORPORATE INVOICE</span>
              <button type="button" onClick={() => setCorpPayClient(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                Enterprise: <strong>{corpPayClient.companyName}</strong>
              </div>
              <div>
                <label className="block font-semibold mb-1">EFT / Cheque Amount (BDT)</label>
                <input
                  type="number"
                  min={100}
                  value={corpPayAmount}
                  onChange={(e) => setCorpPayAmount(e.target.value)}
                  className="w-full px-3 py-1.5 border border-emerald-400 bg-emerald-50/40 rounded font-mono font-bold text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setCorpPayClient(null)} className="maxim-btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="maxim-btn-success">
                  Post Corporate Payment
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
