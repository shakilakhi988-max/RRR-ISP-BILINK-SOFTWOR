import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  CreditCard,
  Lock,
  Mail,
  Network,
  Plus,
  Router,
  Ticket,
  Users,
} from 'lucide-react';
import { useMaxim } from '../context/MaximContext';
import { formatBrandName } from '../services/maximService';

export function DashboardModule() {
  const {
    settings,
    visibleCustomers,
    payments,
    visibleTickets,
    resellers,
    corporateClients,
    routers,
    pops,
    setActiveModule,
    openCustomerSingleView,
  } = useMaxim();

  const metrics = useMemo(() => {
    const activeUsers = visibleCustomers.filter((c) => c.accountStatus === 'Active').length;
    const onlineUsers = visibleCustomers.filter((c) => c.isOnline).length;
    const lockedOrExpired = visibleCustomers.filter(
      (c) => c.lockStatus === 'Locked' || c.accountStatus !== 'Active'
    ).length;
    const totalDue = visibleCustomers
      .filter((c) => c.balance < 0)
      .reduce((sum, c) => sum + Math.abs(c.balance), 0);

    const completedPayments = payments.filter((p) => p.status === 'Completed');
    const totalCollected = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const cashCollected = completedPayments
      .filter((p) => p.method === 'CASH')
      .reduce((sum, p) => sum + p.amount, 0);
    const syncCollected = completedPayments
      .filter((p) => p.method.includes('Sync') || p.method === 'Online Card')
      .reduce((sum, p) => sum + p.amount, 0);

    const corpMonthly = corporateClients
      .filter((c) => c.status === 'Active')
      .reduce((sum, c) => sum + c.monthlyTotal, 0);

    const resellerFloat = resellers.reduce((sum, r) => sum + r.balance, 0);
    const openTkt = visibleTickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;

    return {
      activeUsers,
      onlineUsers,
      lockedOrExpired,
      totalDue,
      totalCollected,
      cashCollected,
      syncCollected,
      corpMonthly,
      resellerFloat,
      openTkt,
    };
  }, [visibleCustomers, payments, corporateClients, resellers, visibleTickets]);

  const popChartData = useMemo(() => {
    return pops.map((p) => {
      const popCusts = visibleCustomers.filter((c) => c.popName === p.name);
      const monthlyBill = popCusts.reduce((s, c) => s + c.monthlyRate, 0);
      const dueAmt = popCusts.filter((c) => c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0);
      return {
        name: p.name.replace('-POP', ''),
        Billing: monthlyBill,
        Due: Math.round(dueAmt),
        Users: popCusts.length,
      };
    });
  }, [pops, visibleCustomers]);

  const channelSummary = useMemo(() => {
    const groups: Record<string, number> = {
      'bKash Sync': 0,
      'Rocket Sync': 0,
      CASH: 0,
      'Online Card': 0,
      Bank: 0,
    };
    payments
      .filter((p) => p.status === 'Completed')
      .forEach((p) => {
        groups[p.method] = (groups[p.method] || 0) + p.amount;
      });
    const maxVal = Math.max(1, ...Object.values(groups));
    return Object.entries(groups).map(([method, total]) => ({
      method,
      total,
      sharePct: Math.round((total / maxVal) * 100),
    }));
  }, [payments]);

  return (
    <div className="space-y-4">
      {/* Clean Page Header */}
      <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-bold text-slate-900">
            Dashboard / ISP Operations &amp; Billing Overview
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {formatBrandName(settings?.companyName)} · {pops.length} POPs · {visibleCustomers.length} Managed Subscribers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveModule('customers_add')}
            className="maxim-btn-success"
          >
            <Plus className="w-3.5 h-3.5" /> Add Subscriber
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('billing_sync')}
            className="maxim-btn-primary"
          >
            <CreditCard className="w-3.5 h-3.5" /> Payment Sync
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('tickets_create')}
            className="maxim-btn-secondary"
          >
            <Ticket className="w-3.5 h-3.5 text-amber-600" /> New Ticket
          </button>
        </div>
      </div>

      {/* 4 Primary Executive KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setActiveModule('customers_list')}
          className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-md text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Active Subscribers</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {metrics.activeUsers}
            <span className="text-xs font-normal text-slate-400 ml-1">/ {visibleCustomers.length}</span>
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1.5 font-mono tabular-nums">
            {metrics.onlineUsers} Online Sessions Now
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('billing_payments')}
          className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-md text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Verified Collection</span>
            <CreditCard className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            ৳ {metrics.totalCollected.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-1.5">
            Cash: ৳{metrics.cashCollected.toLocaleString()} · MFS/Card: ৳{metrics.syncCollected.toLocaleString()}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('customers_due')}
          className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-md text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Receivable Due &amp; Locked</span>
            <Lock className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-red-600 mt-1.5">
            ৳ {metrics.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
            {metrics.lockedOrExpired} Locked / Expired Accounts
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('tickets_list')}
          className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-md text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Open Support Tickets</span>
            <Ticket className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {metrics.openTkt}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            NOC Queue &amp; Field Dispatch
          </div>
        </button>
      </div>

      {/* Compact Secondary Infrastructure & Wholesale Strip */}
      <div className="bg-white border border-slate-200 rounded-md grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setActiveModule('corporate')}
          className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-left cursor-pointer transition-colors"
        >
          <div>
            <p className="text-slate-500">Corporate &amp; Bulk BW</p>
            <p className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              ৳ {metrics.corpMonthly.toLocaleString()} / mo
            </p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('resellers')}
          className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-left cursor-pointer transition-colors"
        >
          <div>
            <p className="text-slate-500">Reseller (SDT) Wallets</p>
            <p className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              ৳ {metrics.resellerFloat.toLocaleString()} ({resellers.length})
            </p>
          </div>
          <Network className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('routers')}
          className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-left cursor-pointer transition-colors"
        >
          <div>
            <p className="text-slate-500">MikroTik NAS Routers</p>
            <p className="text-sm font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
              {routers.filter((r) => r.status === 'Connected').length} / {routers.length} Connected
            </p>
          </div>
          <Router className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('sms')}
          className="px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-left cursor-pointer transition-colors"
        >
          <div>
            <p className="text-slate-500">
              SMS Gateway ({settings?.smsSenderId === 'MAXIM-ISP' ? 'RRR-CABLE' : settings?.smsSenderId || 'RRR-CABLE'})
            </p>
            <p className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {settings?.smsBalance ?? 0} Credits
            </p>
          </div>
          <Mail className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </div>

      {/* Analytics & Channel Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white border border-slate-300 rounded-xs overflow-hidden">
          <div className="maxim-mint-banner flex items-center justify-between px-3">
            <span>POP-WISE MONTHLY BILLING VS DUE (BDT)</span>
            <button
              type="button"
              onClick={() => setActiveModule('pops')}
              className="text-[11px] font-semibold text-[#0066cc] hover:underline normal-case cursor-pointer"
            >
              Manage POPs &rarr;
            </button>
          </div>
          <div className="p-4">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Billing" name="Monthly Tariff (BDT)" fill="#28a745" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Due" name="Outstanding Due (BDT)" fill="#dc3545" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-300 rounded-xs overflow-hidden flex flex-col">
          <div className="maxim-mint-banner flex items-center justify-between px-3">
            <span>COLLECTION BY CHANNEL</span>
            <span className="text-[11px] font-mono tabular-nums font-bold text-slate-900">
              ৳ {metrics.totalCollected.toLocaleString()}
            </span>
          </div>
          <div className="p-4 flex-1 space-y-3 text-xs">
            {channelSummary.map((item) => (
              <div key={item.method} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{item.method}</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    ৳ {item.total.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-[#28a745]"
                    style={{ width: `${Math.max(item.total > 0 ? 6 : 0, item.sharePct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 bg-[#f8f9fa] border-t border-slate-300 flex items-center justify-between text-xs">
            <span className="text-slate-600">Day Book &amp; Cash Audit</span>
            <button
              type="button"
              onClick={() => setActiveModule('accounts')}
              className="font-semibold text-[#0066cc] hover:underline cursor-pointer"
            >
              Open Cashbook &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Live Operational Tables: Recent Payments & Active Support Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded-xs overflow-hidden">
          <div className="maxim-mint-banner flex items-center justify-between px-3">
            <span>RECENT PAYMENTS &amp; CASH RECEIPTS</span>
            <button
              type="button"
              onClick={() => setActiveModule('billing_payments')}
              className="text-[11px] font-semibold text-[#0066cc] hover:underline normal-case cursor-pointer"
            >
              All Receipts &rarr;
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="maxim-amber-thead">
                <tr>
                  <th>Trx #</th>
                  <th>Subscriber</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                  <th>Collector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.slice(0, 6).map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 border-r border-slate-200 font-mono font-semibold text-slate-800">{p.trxNumber}</td>
                    <td className="px-2.5 py-2 border-r border-slate-200">
                      {p.customerId && p.targetType === 'Home' ? (
                        <button
                          type="button"
                          onClick={() => openCustomerSingleView(p.customerId)}
                          className="font-semibold text-[#0066cc] hover:underline cursor-pointer"
                        >
                          {p.customerUsername}
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-700">{p.customerUsername}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-slate-700">{p.method}</td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono tabular-nums font-bold text-emerald-700">
                      ৳ {p.amount.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 font-mono text-slate-600">{p.receivedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-300 rounded-xs overflow-hidden">
          <div className="maxim-mint-banner flex items-center justify-between px-3">
            <span>ACTIVE SUPPORT TICKETS</span>
            <button
              type="button"
              onClick={() => setActiveModule('tickets_list')}
              className="text-[11px] font-semibold text-[#0066cc] hover:underline normal-case cursor-pointer"
            >
              Ticket Queue &rarr;
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="maxim-amber-thead">
                <tr>
                  <th>TKT #</th>
                  <th>Subscriber</th>
                  <th>Issue</th>
                  <th>Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleTickets.slice(0, 6).map((t) => (
                  <tr key={t.id} className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 border-r border-slate-200 font-mono font-bold">
                      <button
                        type="button"
                        onClick={() => setActiveModule('tickets_list')}
                        className="text-[#0066cc] hover:underline cursor-pointer"
                      >
                        #{t.ticketNo}
                      </button>
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200">
                      {t.customerId ? (
                        <button
                          type="button"
                          onClick={() => openCustomerSingleView(t.customerId)}
                          className="font-semibold text-[#0066cc] hover:underline cursor-pointer"
                        >
                          {t.customerUsername}
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-800">{t.customerUsername}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-slate-700 truncate max-w-[140px]">{t.issueType}</td>
                    <td className="px-2.5 py-2 font-mono text-slate-600">{t.assignedTo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
