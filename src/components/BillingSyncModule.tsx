import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  Download,
  Printer,
  RefreshCw,
  Search,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import { useMaxim } from '../context/MaximContext';
import {
  addMonthsToDateStr,
  computeSubscriberBalanceAfterPayment,
  computeSubscriberBalanceAfterVoid,
  createLedgerEntry,
  createOperationalLog,
  createPaymentRecord,
  formatBrandName,
  formatShortDateTime,
  invokeMikrotikApi,
  logAuditEvent,
  saveWorkspaceSettings,
  updateCorporateClient,
  updateCustomer,
  updatePaymentRecord,
  updateReseller,
} from '../services/maximService';
import type { PaymentRecord } from '../types';

export function BillingSyncModule() {
  const {
    user,
    settings,
    activeModule,
    setActiveModule,
    payments,
    visibleCustomers,
    resellers,
    corporateClients,
    pops,
    operator,
    notify,
    openCustomerSingleView,
  } = useMaxim();

  // Filters for Invoices & Payments
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [targetFilter, setTargetFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptModal, setReceiptModal] = useState<PaymentRecord | null>(null);
  const [confirmVoidPayId, setConfirmVoidPayId] = useState<string | null>(null);

  // Monthly Billing Cycle Invoice Generator State
  const [showCycleBillForm, setShowCycleBillForm] = useState(false);
  const [cycleBillTarget, setCycleBillTarget] = useState('Day of 1');
  const [cycleBillPop, setCycleBillPop] = useState('ALL');

  // Manual Cash Rcv Entry Form
  const [showCashForm, setShowCashForm] = useState(false);
  const [cashCustId, setCashCustId] = useState('');
  const [cashAmount, setCashAmount] = useState('500');
  const [cashMonths, setCashMonths] = useState(1);
  const [cashMethod, setCashMethod] = useState<PaymentRecord['method']>('CASH');
  const [cashChannel, setCashChannel] = useState('Office Cash');
  const [cashRemarks, setCashRemarks] = useState('');

  // Maestro Payment Sync (bKash / Rocket / Nagad) State
  const [syncProvider, setSyncProvider] = useState<'bKash Sync' | 'Rocket Sync' | 'Nagad Sync'>('bKash Sync');
  const [syncReference, setSyncReference] = useState('Mizan');
  const [syncSenderMobile, setSyncSenderMobile] = useState('01713336400');
  const [syncAmount, setSyncAmount] = useState('500');
  const [syncTrxId, setSyncTrxId] = useState('');
  const [lastSyncConfirmation, setLastSyncConfirmation] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState('5000');
  const [transferFromWallet, setTransferFromWallet] = useState('bKash Merchant Wallet');
  const [transferToBank, setTransferToBank] = useState('Dutch-Bangla Bank Corporate A/C');

  // Online Card Gateway Simulator State
  const [cardSubUsername, setCardSubUsername] = useState('hassan');
  const [cardBrand, setCardBrand] = useState('VISA');
  const [cardLast4, setCardLast4] = useState('4821');
  const [cardAmount, setCardAmount] = useState('1000');

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (methodFilter !== 'ALL' && p.method !== methodFilter) return false;
      if (targetFilter !== 'ALL' && p.targetType !== targetFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${p.trxNumber} ${p.customerUsername} ${p.customerName} ${p.senderMobile} ${p.receivedBy} ${p.remarks}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, methodFilter, targetFilter, searchQuery]);

  // =========================================================================
  // VIEW 1: INVOICES, PAYMENT COLLECTION & RECEIPTS
  // =========================================================================
  if (activeModule === 'billing_payments') {
    const totalCompleted = filteredPayments
      .filter((p) => p.status === 'Completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const handleReceiveCash = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!operator.canCollectCash) {
        notify('Your operator role does not permit Cash Collection.', 'error');
        return;
      }
      if (
        operator.allowedCashChannels.length > 0 &&
        !operator.allowedCashChannels.includes('ALL') &&
        !operator.allowedCashChannels.some((ch) => ch.toLowerCase().includes(cashMethod.toLowerCase()))
      ) {
        notify(`Channel ${cashMethod} is restricted for your staff profile.`, 'error');
        return;
      }

      const cust =
        visibleCustomers.find((c) => c.id === cashCustId || c.username === cashCustId || c.custId === cashCustId) ||
        visibleCustomers[0];
      if (!cust) {
        notify('Select a valid subscriber.', 'error');
        return;
      }

      const amt = Math.max(1, Number(cashAmount) || cust.monthlyRate);
      const charge = cust.category === 'Free' ? 0 : cust.monthlyRate * cashMonths;
      const nextBal = computeSubscriberBalanceAfterPayment(cust.balance, amt, charge, cashMonths);
      const nextExp = addMonthsToDateStr(cust.expiryDate, cashMonths);
      const trx = `RCV-${Date.now().toString(36).toUpperCase()}`;

      await createPaymentRecord(user.uid, {
        trxNumber: trx,
        targetType: 'Home',
        customerId: cust.id,
        customerUsername: cust.username,
        customerName: cust.name,
        amount: amt,
        chargeAmount: charge,
        billForMonths: cashMonths,
        method: cashMethod,
        channel: cashChannel,
        receivedBy: operator.username,
        syncSource: 'Counter Collection',
        senderMobile: cust.mobile,
        status: 'Completed',
        remarks: cashRemarks || `Collected ${cashMonths} month(s) bill`,
        oldExpiry: cust.expiryDate,
        newExpiry: nextExp,
        paymentDate: formatShortDateTime(),
      });

      await updateCustomer(cust.id, {
        balance: nextBal,
        expiryDate: nextExp,
        lockStatus: 'Unlocked',
        accountStatus: 'Active',
        isOnline: true,
      });

      if (cust.lockStatus === 'Locked') {
        await invokeMikrotikApi({
          action: 'unlock',
          username: cust.username,
          packageName: cust.packageName,
          routerName: cust.routerName,
        });
      }

      await logAuditEvent(
        user.uid,
        operator.username,
        'Bill Payment Collected',
        `Collected BDT ${amt} (${cashMethod}) for ${cust.username} [${trx}] -> Bal: ${nextBal}`,
        cust.username,
        cust.popName
      );

      notify(`Recorded payment ${trx} (BDT ${amt.toLocaleString()}) for ${cust.username}.`, 'success');
      setShowCashForm(false);
      setCashRemarks('');
    };

    const handleGenerateCycleBills = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!operator.canCollectCash) {
        notify('Your operator role does not permit Billing Cycle Invoice generation.', 'error');
        return;
      }
      const billableSubs = visibleCustomers.filter((c) => {
        if (c.category === 'Free' || c.accountStatus === 'Disabled' || c.monthlyRate <= 0) return false;
        if (cycleBillTarget !== 'ALL' && c.billingCycle !== cycleBillTarget) return false;
        if (cycleBillPop !== 'ALL' && c.popName !== cycleBillPop) return false;
        return true;
      });
      if (billableSubs.length === 0) {
        notify('No active billable subscribers matched the selected cycle & POP.', 'info');
        return;
      }
      let totalBilled = 0;
      const todayIso = new Date().toISOString().slice(0, 10);
      for (const sub of billableSubs) {
        const nextBal = Number((sub.balance - sub.monthlyRate).toFixed(2));
        totalBilled += sub.monthlyRate;
        await updateCustomer(sub.id, {
          balance: nextBal,
          accountStatus: nextBal < 0 && sub.expiryDate <= todayIso ? 'Expired' : sub.accountStatus,
        });
      }
      await logAuditEvent(
        user.uid,
        operator.username,
        'Generated Monthly Cycle Bills',
        `Debited monthly invoice charges for ${billableSubs.length} subscribers (${cycleBillTarget}, POP: ${cycleBillPop}) totaling BDT ${totalBilled.toLocaleString()}`,
        cycleBillTarget,
        cycleBillPop
      );
      notify(
        `Generated monthly dues for ${billableSubs.length} subscribers (Total BDT ${totalBilled.toLocaleString()}).`,
        'success'
      );
      setShowCycleBillForm(false);
    };

    const handleVoidPayment = async (p: PaymentRecord) => {
      if (!user) return;
      if (!operator.canCollectCash) {
        notify('Your operator role does not permit Voiding payment receipts.', 'error');
        return;
      }
      if (p.status === 'Void') return;

      if (p.targetType === 'Home') {
        const cust = visibleCustomers.find(
          (c) => c.id === p.customerId || c.username === p.customerUsername
        );
        if (cust) {
          const reversedBal = computeSubscriberBalanceAfterVoid(
            cust.balance,
            p.amount,
            p.chargeAmount,
            p.billForMonths,
            p.oldExpiry
          );
          const restoredExpiry = p.billForMonths > 0 && p.oldExpiry ? p.oldExpiry : cust.expiryDate;
          const todayIso = new Date().toISOString().slice(0, 10);
          const isNowExpired = restoredExpiry < todayIso && reversedBal < 0;
          await updateCustomer(cust.id, {
            balance: reversedBal,
            expiryDate: restoredExpiry,
            accountStatus: isNowExpired ? 'Expired' : cust.accountStatus,
          });
        }
      } else if (p.targetType === 'Reseller') {
        const res = resellers.find(
          (r) => r.id === p.customerId || r.username === p.customerUsername
        );
        if (res) {
          await updateReseller(res.id, {
            balance: Number((res.balance - p.amount).toFixed(2)),
          });
        }
      } else if (p.targetType === 'Corporate') {
        const corp = corporateClients.find(
          (c) => c.id === p.customerId || c.clientCode === p.customerUsername
        );
        if (corp) {
          await updateCorporateClient(corp.id, {
            balance: Number((corp.balance - p.amount).toFixed(2)),
          });
        }
      }

      await updatePaymentRecord(p.id, {
        status: 'Void',
        remarks: `${p.remarks} [VOIDED by ${operator.username}]`,
        receivedBy: p.receivedBy,
      });
      await logAuditEvent(
        user.uid,
        operator.username,
        'Payment Voided & Balance Reversed',
        `Voided receipt ${p.trxNumber} (BDT ${p.amount}) and reversed ledger balance`,
        p.customerUsername
      );
      setConfirmVoidPayId(null);
      notify(`Voided receipt ${p.trxNumber} and reversed BDT ${p.amount.toLocaleString()} balance.`, 'info');
    };

    const handleExportPaymentsCsv = () => {
      const header = ['Trx_No', 'Date', 'Type', 'Subscriber', 'Method', 'Channel', 'Received_By', 'Amount_BDT', 'Status', 'Old_Expiry', 'New_Expiry'];
      const lines = [
        header.join(','),
        ...filteredPayments.map((p) =>
          [
            p.trxNumber,
            `"${p.paymentDate}"`,
            p.targetType,
            p.customerUsername,
            `"${p.method}"`,
            `"${p.channel}"`,
            p.receivedBy,
            p.amount,
            p.status,
            p.oldExpiry,
            p.newExpiry,
          ].join(',')
        ),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rrr_cable_payments_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify('Exported payment ledger CSV.', 'success');
    };

    return (
      <div className="space-y-3.5">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              Invoices, Cash Receipts &amp; Collection Ledger
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Collect subscriber bills, generate monthly cycle dues, and print official money receipts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              type="button"
              onClick={handleExportPaymentsCsv}
              className="maxim-btn-secondary"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCashForm(false);
                setShowCycleBillForm(!showCycleBillForm);
              }}
              className="maxim-btn-secondary"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-600" /> Generate Cycle Bills
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCycleBillForm(false);
                setCashCustId(visibleCustomers[0]?.id || '');
                setShowCashForm(!showCashForm);
              }}
              className="maxim-btn-success"
            >
              <Wallet className="w-3.5 h-3.5" /> Collect Bill
            </button>
          </div>
        </div>

        {showCycleBillForm && (
          <form onSubmit={handleGenerateCycleBills} className="bg-white border border-amber-300 p-4 rounded-md text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-900">
                Run Monthly Cycle Invoice / Due Generation (Debits Monthly Tariff)
              </span>
              <button type="button" onClick={() => setShowCycleBillForm(false)} className="text-slate-400 hover:text-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Billing Cycle</label>
                <select
                  value={cycleBillTarget}
                  onChange={(e) => setCycleBillTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-md"
                >
                  <option value="Day of 1">Day of 1</option>
                  <option value="Day of 5">Day of 5</option>
                  <option value="Day of 10">Day of 10</option>
                  <option value="Day of 15">Day of 15</option>
                  <option value="ALL">All Cycles</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">POP Scope</label>
                <select
                  value={cycleBillPop}
                  onChange={(e) => setCycleBillPop(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-md"
                >
                  <option value="ALL">All Allowed POPs</option>
                  {pops.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="py-2 maxim-btn-primary">
                Post Monthly Dues
              </button>
            </div>
          </form>
        )}

        {showCashForm && (
          <form onSubmit={handleReceiveCash} className="bg-white border border-slate-200 p-4 rounded-md text-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-900">Receive Subscriber Bill / Cash Collection</span>
              <button type="button" onClick={() => setShowCashForm(false)} className="text-slate-400 hover:text-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Subscriber *</label>
                <select
                  value={cashCustId}
                  onChange={(e) => {
                    const c = visibleCustomers.find((item) => item.id === e.target.value);
                    setCashCustId(e.target.value);
                    if (c) setCashAmount(String(c.monthlyRate));
                  }}
                  className="w-full px-2.5 py-2 border border-slate-300 bg-white rounded-md"
                >
                  {visibleCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.custId} — {c.username} ({c.name}) [Bal: ৳{c.balance}]
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Months</label>
                <select
                  value={cashMonths}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setCashMonths(m);
                    const c = visibleCustomers.find((item) => item.id === cashCustId);
                    if (c) setCashAmount(String(c.monthlyRate * m));
                  }}
                  className="w-full px-2.5 py-2 border border-slate-300 bg-white rounded-md"
                >
                  <option value={1}>1 Month</option>
                  <option value={2}>2 Months</option>
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (BDT)</label>
                <input
                  type="number"
                  min={1}
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 bg-emerald-50/50 font-mono tabular-nums font-bold text-right rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Method</label>
                <select
                  value={cashMethod}
                  onChange={(e) => setCashMethod(e.target.value as PaymentRecord['method'])}
                  className="w-full px-2.5 py-2 border border-slate-300 bg-white rounded-md"
                >
                  <option value="CASH">CASH</option>
                  <option value="Bank">Bank Deposit</option>
                  <option value="bKash Sync">bKash Counter</option>
                  <option value="Rocket Sync">Rocket Counter</option>
                  <option value="Nagad Sync">Nagad Counter</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cash / Bank Head</label>
                <select
                  value={cashChannel}
                  onChange={(e) => setCashChannel(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 bg-white rounded-md"
                >
                  <option value="Office Cash">Office Cash</option>
                  <option value="Staff Hand Cash">Staff Hand Cash</option>
                  <option value="DBBL Corporate A/C">DBBL Corporate A/C</option>
                  <option value="City Bank A/C">City Bank A/C</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <input
                type="text"
                value={cashRemarks}
                onChange={(e) => setCashRemarks(e.target.value)}
                placeholder="Optional receipt remarks / check ref..."
                className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 bg-white rounded-md"
              />
              <button type="submit" className="py-2 maxim-btn-success">
                Post Receipt &amp; Renew
              </button>
            </div>
          </form>
        )}

        {/* Filter & Summary Toolbar */}
        <div className="bg-white border border-slate-200 p-3 rounded-md flex flex-wrap items-center justify-between gap-2.5 text-xs no-print">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 bg-white rounded-md"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">CASH</option>
              <option value="bKash Sync">bKash Sync</option>
              <option value="Rocket Sync">Rocket Sync</option>
              <option value="Nagad Sync">Nagad Sync</option>
              <option value="Online Card">Online Card</option>
              <option value="Bank">Bank</option>
            </select>
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 bg-white rounded-md"
            >
              <option value="ALL">All Account Types</option>
              <option value="Home">Home Users</option>
              <option value="Corporate">Corporate Clients</option>
              <option value="Reseller">SDT Resellers</option>
            </select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search TrxID, username, collector..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 bg-white rounded-md w-56"
              />
            </div>
          </div>
          <div className="font-mono font-bold text-slate-800 tabular-nums">
            Verified Collection: <span className="text-emerald-700">৳ {totalCompleted.toLocaleString()}</span>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-md bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="text-left">Receipt / TrxID</th>
                <th className="text-left">Date</th>
                <th className="text-left">Subscriber</th>
                <th className="text-left">Type</th>
                <th className="text-left">Method</th>
                <th className="text-left">Collector</th>
                <th className="text-right">Amount</th>
                <th className="text-left">New Expiry</th>
                <th className="text-center">Status</th>
                <th className="text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/90">
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{p.trxNumber}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500 whitespace-nowrap">{p.paymentDate}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (p.targetType === 'Reseller') {
                          setActiveModule('resellers');
                        } else if (p.targetType === 'Corporate') {
                          setActiveModule('corporate');
                        } else if (p.customerId) {
                          openCustomerSingleView(p.customerId);
                        }
                      }}
                      className="font-bold text-sky-700 hover:underline cursor-pointer"
                    >
                      {p.customerUsername}
                    </button>
                    <div className="text-[11px] text-slate-500">{p.customerName}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{p.targetType}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{p.method}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-600">{p.receivedBy}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-700">
                    ৳ {p.amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-600">{p.newExpiry || '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`font-semibold ${
                        p.status === 'Completed'
                          ? 'text-emerald-700'
                          : p.status === 'Void'
                          ? 'text-red-600 line-through'
                          : 'text-amber-700'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap no-print">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setReceiptModal(p)}
                        title="Print / View Invoice Receipt"
                        className="px-2 py-1 text-sky-700 hover:bg-sky-50 border border-slate-200 rounded inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Receipt
                      </button>
                      {p.status !== 'Void' && (
                        confirmVoidPayId === p.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleVoidPayment(p)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              Void!
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmVoidPayId(null)}
                              className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[11px] cursor-pointer"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmVoidPayId(p.id)}
                            title="Void Receipt & Reverse Balance"
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
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

        {/* Printable Invoice / Money Receipt Modal */}
        {receiptModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 max-w-lg w-full rounded-lg overflow-hidden shadow-xl text-xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Subscriber Money Receipt</h3>
                <button type="button" onClick={() => setReceiptModal(null)} className="text-slate-400 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3.5">
                <div className="flex justify-between border-b border-slate-200 pb-3">
                  <div>
                    <div className="font-bold text-sm text-slate-900">{formatBrandName(settings?.companyName)}</div>
                    <div className="text-slate-500">{settings?.address}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-sky-700">{receiptModal.trxNumber}</div>
                    <div className="text-slate-500">{receiptModal.paymentDate}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 border border-slate-200 rounded-md">
                  <div>
                    <span className="text-slate-500 block">Subscriber</span>
                    <strong>{receiptModal.customerName}</strong> ({receiptModal.customerUsername})
                  </div>
                  <div>
                    <span className="text-slate-500 block">Method / Channel</span>
                    <strong>{receiptModal.method}</strong> ({receiptModal.channel})
                  </div>
                  <div>
                    <span className="text-slate-500 block">Validity Extended</span>
                    <span className="font-mono">
                      {receiptModal.oldExpiry || 'N/A'} &rarr; {receiptModal.newExpiry || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Collected By</span>
                    <span className="font-mono">{receiptModal.receivedBy}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-y border-slate-200 py-2.5 text-sm font-bold">
                  <span>Total Paid Amount</span>
                  <span className="font-mono tabular-nums text-emerald-700">
                    BDT {receiptModal.amount.toLocaleString()}
                  </span>
                </div>
                <div className="text-slate-600">Remarks: {receiptModal.remarks || 'Paid in full'}</div>
                <div className="flex justify-end gap-2 pt-2 no-print">
                  <button
                    type="button"
                    onClick={() => setReceiptModal(null)}
                    className="maxim-btn-secondary"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="maxim-btn-primary"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: MAESTRO PAYMENT SYNC (bKash, Rocket, Nagad Zero-Touch Auto-Recharge)
  // =========================================================================
  if (activeModule === 'billing_sync') {
    const mobileSyncPayments = payments.filter(
      (p) => p.method === 'bKash Sync' || p.method === 'Rocket Sync' || p.method === 'Nagad Sync'
    );

    const handleTriggerPaymentSync = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!operator.canCollectCash) {
        notify('Your operator role does not permit Payment Sync recharge posting.', 'error');
        return;
      }

      const refClean = syncReference.trim().toLowerCase();
      const matched =
        visibleCustomers.find(
          (c) =>
            c.username.toLowerCase() === refClean ||
            c.custId.toLowerCase() === refClean ||
            c.mobile.replace(/\D/g, '') === syncSenderMobile.replace(/\D/g, '')
        ) || visibleCustomers[0];

      if (!matched) {
        notify('No subscriber matched Reference or Mobile number.', 'error');
        return;
      }

      const res = await fetch('/api/payment-sync/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: syncProvider,
          senderMobile: syncSenderMobile,
          reference: matched.custId,
          amount: Number(syncAmount) || matched.monthlyRate,
          trxId: syncTrxId,
          companyName: formatBrandName(settings?.companyName),
        }),
      });
      const syncData = await res.json();
      const paidAmt = Number(syncData.amount) || matched.monthlyRate;
      const charge = matched.category === 'Free' ? 0 : matched.monthlyRate;
      const nextBal = computeSubscriberBalanceAfterPayment(matched.balance, paidAmt, charge, 1);
      const nextExp = addMonthsToDateStr(matched.expiryDate, 1);

      await createPaymentRecord(user.uid, {
        trxNumber: syncData.trxNumber,
        targetType: 'Home',
        customerId: matched.id,
        customerUsername: matched.username,
        customerName: matched.name,
        amount: paidAmt,
        chargeAmount: charge,
        billForMonths: 1,
        method: syncProvider,
        channel: `${syncProvider} Auto-Webhook`,
        receivedBy: 'Maestro Payment Sync',
        syncSource: 'Zero-TrxID Webhook',
        senderMobile: syncSenderMobile,
        status: 'Completed',
        remarks: `Auto-recharged via ${syncProvider} Ref:${matched.custId}`,
        oldExpiry: matched.expiryDate,
        newExpiry: nextExp,
        paymentDate: formatShortDateTime(),
      });

      await updateCustomer(matched.id, {
        balance: nextBal,
        expiryDate: nextExp,
        lockStatus: 'Unlocked',
        accountStatus: 'Active',
        isOnline: true,
      });

      await invokeMikrotikApi({
        action: 'unlock',
        username: matched.username,
        packageName: matched.packageName,
        routerName: matched.routerName,
      });

      await createOperationalLog(user.uid, {
        logCategory: 'sms_log',
        code: syncData.trxNumber,
        actor: 'Payment Sync SMS',
        target: syncSenderMobile,
        popName: matched.popName,
        title: `${syncProvider} Return Confirmation SMS`,
        details: syncData.returnSms,
        metaOne: 'DELIVERED',
        metaTwo: matched.username,
        numericVal: 1,
        status: 'Sent',
        timestampStr: formatShortDateTime(),
      });

      setLastSyncConfirmation(syncData.returnSms);
      setSyncTrxId('');
      notify(
        `${syncProvider} synced (${syncData.trxNumber}): ${matched.username} unlocked & recharged automatically!`,
        'success'
      );
    };

    const handleWalletBankTransfer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!operator.canCollectCash) {
        notify('Your operator role does not permit MFS Bank Settlement transfers.', 'error');
        return;
      }
      const amt = Math.max(100, Number(transferAmount) || 0);
      await createLedgerEntry(user.uid, {
        entryNo: `MFS-${Date.now().toString(36).toUpperCase()}`,
        entryType: 'Staff Cash Transfer',
        accountHead: transferToBank,
        channel: transferFromWallet,
        staffName: operator.username,
        vendorName: '',
        invoiceRef: 'MFS-SETTLEMENT',
        debit: amt,
        credit: 0,
        amount: amt,
        status: 'Posted',
        entryDate: new Date().toISOString().slice(0, 10),
        remarks: `Transferred BDT ${amt} from ${transferFromWallet} to ${transferToBank}`,
      });
      notify(`Posted settlement transfer of BDT ${amt.toLocaleString()} to ${transferToBank}.`, 'success');
    };

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              Maestro Payment Sync (bKash, Rocket &amp; Nagad)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Zero-TrxID Reference Matching · Instant MikroTik Unlock · Automated Return SMS
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('billing_payments')}
            className="maxim-btn-secondary"
          >
            All Receipts &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <form onSubmit={handleTriggerPaymentSync} className="lg:col-span-7 bg-white border border-slate-200 rounded-md overflow-hidden text-xs">
            <div className="maxim-mint-banner">Incoming Mobile Banking Webhook &amp; Auto-Recharge</div>
            <div className="p-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Wallet Gateway</label>
                  <select
                    value={syncProvider}
                    onChange={(e) => setSyncProvider(e.target.value as 'bKash Sync' | 'Rocket Sync' | 'Nagad Sync')}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md bg-white font-semibold"
                  >
                    <option value="bKash Sync">bKash (Merchant / Personal)</option>
                    <option value="Rocket Sync">DBBL Rocket BillPay</option>
                    <option value="Nagad Sync">Nagad Merchant Sync</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bill Ref (Cust ID / Username)</label>
                  <input
                    type="text"
                    value={syncReference}
                    onChange={(e) => setSyncReference(e.target.value)}
                    placeholder="e.g. 1023 or Mizan"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sender Mobile No</label>
                  <input
                    type="text"
                    value={syncSenderMobile}
                    onChange={(e) => setSyncSenderMobile(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount Paid (BDT)</label>
                  <input
                    type="number"
                    min={10}
                    value={syncAmount}
                    onChange={(e) => setSyncAmount(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 bg-emerald-50/50 font-mono tabular-nums font-bold text-right rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Optional TrxID</label>
                  <input
                    type="text"
                    value={syncTrxId}
                    onChange={(e) => setSyncTrxId(e.target.value)}
                    placeholder="Auto if blank"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#e2136e] hover:bg-[#c20f5e] text-white font-semibold rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Sync &amp; Recharge
                  </button>
                </div>
              </div>

              {lastSyncConfirmation && (
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-md text-emerald-900 font-mono text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5 text-emerald-700" />
                  <strong>Confirmation SMS Dispatched:</strong> {lastSyncConfirmation}
                </div>
              )}
            </div>
          </form>

          {/* Mobile Wallet Settlement Transfer */}
          <form onSubmit={handleWalletBankTransfer} className="lg:col-span-5 bg-white border border-slate-200 rounded-md overflow-hidden text-xs">
            <div className="maxim-mint-banner">MFS Wallet Bank Settlement</div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source MFS Wallet</label>
                <select
                  value={transferFromWallet}
                  onChange={(e) => setTransferFromWallet(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-md bg-white"
                >
                  <option value="bKash Merchant Wallet">bKash Merchant ({settings?.bkashMerchant || '01700-000111'})</option>
                  <option value="Rocket BillPay Wallet">Rocket BillPay ({settings?.rocketMerchant || '2940'})</option>
                  <option value="Nagad Merchant Wallet">Nagad Merchant ({settings?.nagadMerchant || '01800-000222'})</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Bank / Vault</label>
                <select
                  value={transferToBank}
                  onChange={(e) => setTransferToBank(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-md bg-white"
                >
                  <option value="Dutch-Bangla Bank Corporate A/C">Dutch-Bangla Bank Corporate A/C</option>
                  <option value="BRAC Bank Settlement A/C">BRAC Bank Settlement A/C</option>
                  <option value="Head Office Vault Cash">Head Office Vault Cash</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block font-semibold text-slate-700 mb-1">Settlement Amount (BDT)</label>
                  <input
                    type="number"
                    min={100}
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md font-mono tabular-nums font-bold"
                  />
                </div>
                <button type="submit" className="py-2 maxim-btn-primary">
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Settle
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Synced Mobile Banking Transactions Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-md bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="text-left">MFS TrxID</th>
                <th className="text-left">Synced At</th>
                <th className="text-left">Provider</th>
                <th className="text-left">Sender Mobile</th>
                <th className="text-left">Matched Subscriber</th>
                <th className="text-right">Amount</th>
                <th className="text-left">New Expiry</th>
                <th className="text-left">Sync Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mobileSyncPayments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/90">
                  <td className="px-3 py-2.5 font-mono font-bold text-[#e2136e]">{p.trxNumber}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">{p.paymentDate}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{p.method}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-700">{p.senderMobile}</td>
                  <td className="px-3 py-2.5">
                    {p.customerId ? (
                      <button
                        type="button"
                        onClick={() => openCustomerSingleView(p.customerId)}
                        className="font-bold text-sky-700 hover:underline cursor-pointer"
                      >
                        {p.customerUsername}
                      </button>
                    ) : (
                      <span className="font-bold text-slate-800">{p.customerUsername}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-700">
                    ৳ {p.amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-600">{p.newExpiry}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: ONLINE CARD PAYMENT GATEWAY
  // =========================================================================
  const cardPayments = payments.filter((p) => p.method === 'Online Card');

  const handleProcessCardGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!operator.canCollectCash) {
      notify('Your operator role does not permit Card Gateway collection.', 'error');
      return;
    }
    const cust =
      visibleCustomers.find((c) => c.username === cardSubUsername) || visibleCustomers[0];
    if (!cust) return;

    const amt = Math.max(100, Number(cardAmount) || cust.monthlyRate);
    const charge = cust.category === 'Free' ? 0 : cust.monthlyRate;
    const nextBal = computeSubscriberBalanceAfterPayment(cust.balance, amt, charge, 1);
    const nextExp = addMonthsToDateStr(cust.expiryDate, 1);
    const trx = `SSL-${cardBrand.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    await createPaymentRecord(user.uid, {
      trxNumber: trx,
      targetType: 'Home',
      customerId: cust.id,
      customerUsername: cust.username,
      customerName: cust.name,
      amount: amt,
      chargeAmount: charge,
      billForMonths: 1,
      method: 'Online Card',
      channel: `${cardBrand} ****${cardLast4}`,
      receivedBy: settings?.paymentGatewayProvider || 'SSLCommerz',
      syncSource: 'Card Checkout 3DS',
      senderMobile: cust.mobile,
      status: 'Completed',
      remarks: `3D-Secure ${cardBrand} (*${cardLast4}) Checkout Approved`,
      oldExpiry: cust.expiryDate,
      newExpiry: nextExp,
      paymentDate: formatShortDateTime(),
    });

    await updateCustomer(cust.id, {
      balance: nextBal,
      expiryDate: nextExp,
      lockStatus: 'Unlocked',
      accountStatus: 'Active',
    });

    notify(`Processed ${cardBrand} card checkout (${trx}) for ${cust.username}.`, 'success');
  };

  return (
    <div className="space-y-4">
      <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-bold text-slate-900">
            Online Card Payment Gateway (VISA, MasterCard, AmEx, DBBL Nexus)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            3D-Secure card settlement &amp; automatic subscriber renewal ledger
          </p>
        </div>
        {settings && user && (
          <button
            type="button"
            onClick={async () => {
              await saveWorkspaceSettings(user.uid, {
                paymentGatewayEnabled: !settings.paymentGatewayEnabled,
              });
              notify(`Online Card Gateway ${!settings.paymentGatewayEnabled ? 'Enabled' : 'Paused'}.`, 'info');
            }}
            className={settings.paymentGatewayEnabled ? 'maxim-btn-success' : 'maxim-btn-secondary'}
          >
            Gateway: {settings.paymentGatewayEnabled ? 'ACTIVE (3D-Secure)' : 'PAUSED'}
          </button>
        )}
      </div>

      <form onSubmit={handleProcessCardGateway} className="bg-white border border-slate-200 p-4 rounded-md text-xs grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Subscriber</label>
          <select
            value={cardSubUsername}
            onChange={(e) => setCardSubUsername(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 bg-white rounded-md"
          >
            {visibleCustomers.map((c) => (
              <option key={c.id} value={c.username}>
                {c.username} ({c.packageName})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Card Scheme</label>
          <select
            value={cardBrand}
            onChange={(e) => setCardBrand(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 bg-white rounded-md"
          >
            <option value="VISA">VISA Credit / Debit</option>
            <option value="MasterCard">MasterCard</option>
            <option value="AmEx">American Express (City Bank)</option>
            <option value="DBBL Nexus">DBBL Nexus Card</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Card Last 4 Digits</label>
          <input
            type="text"
            maxLength={4}
            value={cardLast4}
            onChange={(e) => setCardLast4(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 bg-white rounded-md font-mono"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Amount (BDT)</label>
          <input
            type="number"
            min={50}
            value={cardAmount}
            onChange={(e) => setCardAmount(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 bg-emerald-50/50 rounded-md font-mono tabular-nums font-bold text-right"
          />
        </div>
        <button type="submit" className="py-2 maxim-btn-primary">
          <CreditCard className="w-3.5 h-3.5" /> Process 3DS Charge
        </button>
      </form>

      <div className="overflow-x-auto border border-slate-200 rounded-md bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="maxim-amber-thead">
              <th className="text-left">Gateway Ref</th>
              <th className="text-left">Timestamp</th>
              <th className="text-left">Subscriber</th>
              <th className="text-left">Card Instrument</th>
              <th className="text-left">Processor</th>
              <th className="text-right">Settled Amount</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cardPayments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/90">
                <td className="px-3 py-2.5 font-mono font-bold text-sky-700">{p.trxNumber}</td>
                <td className="px-3 py-2.5 font-mono text-slate-500">{p.paymentDate}</td>
                <td className="px-3 py-2.5 font-bold text-slate-800">{p.customerUsername}</td>
                <td className="px-3 py-2.5 font-mono text-slate-700">{p.channel}</td>
                <td className="px-3 py-2.5 text-slate-600">{p.receivedBy}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-700">
                  ৳ {p.amount.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-emerald-700 font-semibold">{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
