import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BatteryCharging,
  Calendar,
  ClipboardList,
  CreditCard,
  Edit3,
  FileText,
  IdCard,
  Key,
  Lightbulb,
  List,
  Lock,
  MapPin,
  Minus,
  Network,
  Plus,
  Printer,
  RefreshCw,
  Scissors,
  Ticket,
  Trash2,
  Unlock,
  UserCheck,
  X,
  ZoomIn,
} from 'lucide-react';
import { useMaxim } from '../context/MaximContext';
import {
  addMonthsToDateStr,
  computeSubscriberBalanceAfterPayment,
  createCustomer,
  createPaymentRecord,
  createSupportTicket,
  deleteDocumentByPath,
  formatBrandName,
  formatShortDateTime,
  ISP_BRAND_NAME,
  invokeMikrotikApi,
  logAuditEvent,
  updateCustomer,
  updateReseller,
} from '../services/maximService';
import type { Customer, PaymentRecord } from '../types';
import maleAvatarImg from '../assets/images/subscriber_male_avatar_1793636053005.jpg';
import femaleAvatarImg from '../assets/images/subscriber_female_avatar_1793636053956.jpg';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMaximShortDate(dateStr: string): string {
  if (!dateStr) return '01/Jan/26';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (isoMatch) {
    const yy = isoMatch[1].slice(-2);
    const mIdx = Math.max(0, Math.min(11, Number(isoMatch[2]) - 1));
    const dd = isoMatch[3];
    return `${dd}/${SHORT_MONTHS[mIdx]}/${yy}`;
  }
  return dateStr;
}

function splitLastLogoutLines(lastLogout: string, isOnline: boolean): { primary: string; secondary: string } {
  const raw = (lastLogout || '').trim();
  if (!raw) {
    return {
      primary: isOnline ? 'Online Now (Active PPPoE)' : '3 hrs 10 min Ago',
      secondary: '02/Nov/26 16:30',
    };
  }
  if (raw.includes('·')) {
    const [p, s] = raw.split('·').map((x) => x.trim());
    return { primary: p || raw, secondary: s || '02/Nov/26 16:30' };
  }
  return {
    primary: raw,
    secondary: isOnline ? 'Active Session · NAS Verified' : '02/Nov/26 16:30',
  };
}

function triggerDownload(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
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

export function HomeUsersModule() {
  const {
    user,
    settings,
    activeModule,
    setActiveModule,
    visibleCustomers,
    packages,
    pops,
    routers,
    resellers,
    employees,
    payments,
    operationalLogs,
    visibleTickets,
    selectedCustomerId,
    setSelectedCustomerId,
    bulkCustomerIds,
    setBulkCustomerIds,
    operator,
    notify,
    openCustomerSingleView,
    openCashRcvModal,
    syncAllMikrotikCustomers,
  } = useMaxim();

  const brandName = formatBrandName(settings?.companyName);

  const [isSyncingMikrotik, setIsSyncingMikrotik] = useState(false);

  const handleOneClickMikrotikSync = async () => {
    setIsSyncingMikrotik(true);
    try {
      const primaryRouter = routers.find((r) => r.host === '103.54.37.182') || routers[0];
      const res = await syncAllMikrotikCustomers(primaryRouter);
      notify(
        `সফলভাবে MikroTik (103.54.37.182:1165) থেকে মোট ${res.count} জন কাস্টমার সিঙ্ক হয়েছে! অনলাইন: ${res.online}, অফলাইন: ${res.offline}, লক/ডিজেবল: ${res.disabled}`,
        'success'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(`সিঙ্ক ব্যর্থ হয়েছে: ${msg}`, 'error');
    } finally {
      setIsSyncingMikrotik(false);
    }
  };

  // Filter Grid State (matching customerlist.png)
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPackage, setFilterPackage] = useState('');
  const [filterCycle, setFilterCycle] = useState('');
  const [filterPop, setFilterPop] = useState('');
  const [filterPlanType, setFilterPlanType] = useState('');
  const [expiryFrom, setExpiryFrom] = useState('');
  const [expiryTo, setExpiryTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesLimit, setEntriesLimit] = useState(100);
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
  const [confirmDeleteCustomerId, setConfirmDeleteCustomerId] = useState<string | null>(null);
  const [vipSubFilter, setVipSubFilter] = useState<'ALL' | 'VIP' | 'Free'>('ALL');

  // Fast Row Collect Modal State
  const [quickCollectCustomer, setQuickCollectCustomer] = useState<Customer | null>(null);
  const [quickCollectMonths, setQuickCollectMonths] = useState(1);
  const [quickCollectAmount, setQuickCollectAmount] = useState('500');
  const [quickCollectMethod, setQuickCollectMethod] = useState<'CASH' | 'bKash Sync' | 'Rocket Sync' | 'Bank'>('CASH');
  const [quickCollectRemarks, setQuickCollectRemarks] = useState('');

  // Receipt Preview on Single View
  const [receiptPreview, setReceiptPreview] = useState<PaymentRecord | null>(null);

  // Add / Edit Customer Form State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custForm, setCustForm] = useState({
    custId: '',
    username: '',
    password: '123456',
    name: '',
    mobile: '017',
    email: '',
    address: 'Mirpur-2, Dhaka, Bangladesh',
    nidNumber: '',
    popName: 'Mirpur-POP',
    zoneName: ISP_BRAND_NAME,
    packageId: '',
    billingCycle: 'Day of 1',
    expiryDate: '2026-12-01',
    category: 'Regular' as 'Regular' | 'VIP' | 'Free',
    planType: 'Prepaid' as 'Prepaid' | 'Postpaid',
    ipAddress: '',
    macAddress: '',
    mikrotikQueue: 'Package Default',
    routerName: 'Mirpur-Core-CCR1036',
    resellerId: '',
    fiberLength: '200.0m',
    cpeModel: 'GPON GL-787665554',
    oltPort: '1',
    linkRemarks: '',
    avatarType: 'male' as 'male' | 'female',
    balance: '0',
  });

  // Single-View Action Modals
  const [activeActionModal, setActiveActionModal] = useState<
    | null
    | 'password'
    | 'recharge'
    | 'package'
    | 'ledger'
    | 'payment'
    | 'expiry'
    | 'mac_disconnect'
    | 'link_info'
    | 'nid_form'
    | 'session_logs'
    | 'switch_customer'
    | 'tickets_modal'
    | 'location_edit'
    | 'router_sync'
  >(null);
  const [linkEditMode, setLinkEditMode] = useState(false);
  const [nidPrintMode, setNidPrintMode] = useState(false);
  const [modalInputA, setModalInputA] = useState('');
  const [modalInputB, setModalInputB] = useState('');
  const [modalInputC, setModalInputC] = useState('');
  const [modalInputD, setModalInputD] = useState('');

  // Bulk Recharge Form State (matching rechargebulk.png)
  const [bulkMonths, setBulkMonths] = useState<Record<string, number>>({});
  const [bulkMethod, setBulkMethod] = useState<'CASH' | 'bKash Sync' | 'Bank'>('CASH');
  const [bulkAmountReceived, setBulkAmountReceived] = useState('');
  const [bulkReceivedBy, setBulkReceivedBy] = useState('');
  const [bulkRemarks, setBulkRemarks] = useState('');

  // Inline Edit States on Single-View
  const [ipDraft, setIpDraft] = useState('');
  const [contactEditMode, setContactEditMode] = useState(false);
  const [contactDraft, setContactDraft] = useState('');

  const selectedCustomer = useMemo(() => {
    return (
      visibleCustomers.find((c) => c.id === selectedCustomerId) ||
      visibleCustomers.find((c) => c.custId === '1023') ||
      visibleCustomers[0] ||
      null
    );
  }, [visibleCustomers, selectedCustomerId]);

  const hasActiveFilter = Boolean(
    filterStatus !== 'ALL' ||
      filterPackage ||
      filterCycle ||
      filterPop ||
      filterPlanType ||
      expiryFrom ||
      expiryTo ||
      searchTerm.trim()
  );

  // Apply Submenu Presets + Filter Table
  const filteredCustomers = useMemo(() => {
    return visibleCustomers.filter((c) => {
      if (activeModule === 'customers_online' && !c.isOnline) return false;
      if (activeModule === 'customers_due' && c.balance >= 0 && c.accountStatus === 'Active') return false;
      if (activeModule === 'customers_vip') {
        if (c.category === 'Regular') return false;
        if (vipSubFilter !== 'ALL' && c.category !== vipSubFilter) return false;
      }

      if (filterStatus === 'ACTIVE' && c.accountStatus !== 'Active') return false;
      if (filterStatus === 'EXPIRED' && c.accountStatus !== 'Expired') return false;
      if (filterStatus === 'LOCKED' && c.lockStatus !== 'Locked') return false;
      if (filterStatus === 'DUE' && c.balance >= 0) return false;
      if (filterStatus === 'ONLINE' && !c.isOnline) return false;

      if (filterPackage && c.packageName !== filterPackage) return false;
      if (filterCycle && c.billingCycle !== filterCycle) return false;
      if (filterPop && c.popName !== filterPop) return false;
      if (filterPlanType && c.planType !== filterPlanType) return false;

      if (expiryFrom && c.expiryDate < expiryFrom) return false;
      if (expiryTo && c.expiryDate > expiryTo) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const hit =
          c.custId.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.mobile.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.ipAddress.toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [
    visibleCustomers,
    activeModule,
    vipSubFilter,
    filterStatus,
    filterPackage,
    filterCycle,
    filterPop,
    filterPlanType,
    expiryFrom,
    expiryTo,
    searchTerm,
  ]);

  const toggleSelectCustomer = (id: string) => {
    setBulkCustomerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredCustomers.slice(0, entriesLimit).map((c) => c.id);
    const allChecked = visibleIds.length > 0 && visibleIds.every((id) => bulkCustomerIds.includes(id));
    if (allChecked) {
      setBulkCustomerIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setBulkCustomerIds(Array.from(new Set([...bulkCustomerIds, ...visibleIds])));
    }
  };

  // Export Handlers
  const handleDownloadDisReport = async () => {
    const res = await fetch('/api/reports/dis-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: brandName,
        btrcLicenseNo: settings?.btrcLicenseNo || 'BTRC-ISP-001',
        customers: filteredCustomers,
      }),
    });
    const csvText = await res.text();
    triggerDownload(`DIS_Report_${new Date().toISOString().slice(0, 10)}.csv`, csvText);
    notify(`Exported BTRC DIS Report for ${filteredCustomers.length} subscribers.`, 'success');
  };

  const handleDownloadBillReport = () => {
    const rows = [
      ['SN', 'Customer_ID', 'Username', 'Name', 'Package', 'Monthly_Rate', 'Balance', 'Billing_Cycle', 'Expiry_Date', 'POP', 'Mobile', 'Address', 'IP'].join(','),
      ...filteredCustomers.map((c, idx) =>
        [
          idx + 1,
          c.custId,
          c.username,
          `"${c.name}"`,
          c.packageName,
          c.monthlyRate,
          c.balance.toFixed(2),
          `"${c.billingCycle}"`,
          c.expiryDate,
          c.popName,
          c.mobile,
          `"${c.address}"`,
          c.ipAddress,
        ].join(',')
      ),
    ];
    triggerDownload(`RRR_Bill_Report_${new Date().toISOString().slice(0, 10)}.csv`, rows.join('\n'));
    notify('Downloaded filtered Subscriber Bill Report CSV.', 'success');
  };

  const handleDownloadExcel = () => {
    const tsv = [
      ['SN', 'Customer ID', 'Username', 'Name', 'Package', 'Balance', 'Billing Cycle', 'Expiry Date', 'Mobile', 'Address', 'IP'].join('\t'),
      ...filteredCustomers.map((c, idx) =>
        [
          idx + 1,
          c.custId,
          c.username,
          c.name,
          c.packageName,
          c.balance.toFixed(2),
          c.billingCycle,
          c.expiryDate,
          c.mobile,
          c.address,
          c.ipAddress,
        ].join('\t')
      ),
    ].join('\n');
    triggerDownload(
      `RRR_Customer_List_${new Date().toISOString().slice(0, 10)}.xls`,
      tsv,
      'application/vnd.ms-excel;charset=utf-8;'
    );
    notify(`Exported ${filteredCustomers.length} subscribers to Excel (.xls).`, 'success');
  };

  const handleDownloadMikrotikBackup = async () => {
    const res = await fetch('/api/mikrotik/export-rsc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: brandName,
        packages,
        customers: filteredCustomers,
      }),
    });
    const rsc = await res.text();
    triggerDownload(`rrr_customer_backup_${new Date().toISOString().slice(0, 10)}.rsc`, rsc, 'text/plain;charset=utf-8;');
    notify('Downloaded Customer Backup & MikroTik RouterOS (.rsc) script.', 'success');
  };

  const handleCopyTable = async () => {
    const text = filteredCustomers
      .map((c) => `${c.custId}\t${c.username}\t${c.name}\t${c.packageName}\t${c.balance.toFixed(2)}\t${c.expiryDate}\t${c.mobile}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    notify(`Copied ${filteredCustomers.length} rows to clipboard.`, 'info');
  };

  const handleRowToggleLock = async (target: Customer) => {
    if (!user) return;
    if (operator.mode === 'STAFF' && !operator.canManageRouter) {
      notify('Your staff role does not have NAS Router Lock/Unlock permission.', 'error');
      return;
    }
    const nextLock = target.lockStatus === 'Unlocked' ? 'Locked' : 'Unlocked';
    const mkAction = nextLock === 'Locked' ? 'lock' : 'unlock';
    const res = await invokeMikrotikApi({
      action: mkAction,
      username: target.username,
      packageName: target.packageName,
      routerName: target.routerName,
    });
    await updateCustomer(target.id, {
      lockStatus: nextLock,
      isOnline: nextLock === 'Unlocked',
      lastLogout: nextLock === 'Locked' ? 'Just now (Locked via Billing)' : 'Online Now (PPPoE)',
    });
    await logAuditEvent(user.uid, operator.username, `Subscriber ${nextLock}`, res.transcript.join(' | '), target.username, target.popName);
    notify(`${target.username} is now ${nextLock} on ${target.routerName}.`, 'success');
  };

  const handleQuickRowCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickCollectCustomer) return;
    if (!operator.canCollectCash) {
      notify('Your operator role does not permit Cash / Recharge collection.', 'error');
      return;
    }
    const c = quickCollectCustomer;
    const months = Math.max(0, Number(quickCollectMonths) || 0);
    const paid = Math.max(1, Number(quickCollectAmount) || 0);
    const charge = months > 0 ? (c.category === 'Free' ? 0 : c.monthlyRate * months) : 0;
    const nextExp = months > 0 ? addMonthsToDateStr(c.expiryDate, months) : c.expiryDate;
    const nextBal = computeSubscriberBalanceAfterPayment(c.balance, paid, charge, months);
    const trx = `RCV-${Date.now().toString(36).toUpperCase()}`;

    await createPaymentRecord(user.uid, {
      trxNumber: trx,
      targetType: 'Home',
      customerId: c.id,
      customerUsername: c.username,
      customerName: c.name,
      amount: paid,
      chargeAmount: charge,
      billForMonths: months,
      method: quickCollectMethod,
      channel: `${quickCollectMethod} (${operator.username})`,
      receivedBy: operator.username,
      syncSource: months > 0 ? 'Quick List Recharge' : 'Quick Due Payment',
      senderMobile: c.mobile,
      status: 'Completed',
      remarks:
        quickCollectRemarks ||
        (months > 0 ? `Renewed ${months} month(s) (${c.packageName})` : 'Due clearance receipt'),
      oldExpiry: c.expiryDate,
      newExpiry: nextExp,
      paymentDate: formatShortDateTime(),
    });

    await updateCustomer(c.id, {
      balance: nextBal,
      expiryDate: nextExp,
      lockStatus: nextBal >= 0 || months > 0 ? 'Unlocked' : c.lockStatus,
      accountStatus: 'Active',
      isOnline: nextBal >= 0 || months > 0 ? true : c.isOnline,
    });

    if (c.lockStatus === 'Locked' && (nextBal >= 0 || months > 0)) {
      await invokeMikrotikApi({
        action: 'unlock',
        username: c.username,
        packageName: c.packageName,
        routerName: c.routerName,
      });
    }

    await logAuditEvent(
      user.uid,
      operator.username,
      'Quick Subscriber Collection',
      `Collected BDT ${paid} (${quickCollectMethod}) for ${c.username} [${trx}] -> Bal: ${nextBal}`,
      c.username,
      c.popName
    );

    notify(`Collected BDT ${paid.toLocaleString()} for ${c.username} (${trx}).`, 'success');
    setQuickCollectCustomer(null);
    setQuickCollectRemarks('');
  };

  const beginEditCustomer = (cust: Customer) => {
    setEditingCustomer(cust);
    setCustForm({
      custId: cust.custId,
      username: cust.username,
      password: cust.password,
      name: cust.name,
      mobile: cust.mobile,
      email: cust.email,
      address: cust.address,
      nidNumber: cust.nidNumber,
      popName: cust.popName,
      zoneName: formatBrandName(cust.zoneName),
      packageId: cust.packageId,
      billingCycle: cust.billingCycle,
      expiryDate: cust.expiryDate,
      category: cust.category,
      planType: cust.planType,
      ipAddress: cust.ipAddress,
      macAddress: cust.macAddress,
      mikrotikQueue: cust.mikrotikQueue,
      routerName: cust.routerName,
      resellerId: cust.resellerId,
      fiberLength: cust.fiberLength,
      cpeModel: cust.cpeModel,
      oltPort: cust.oltPort,
      linkRemarks: cust.linkRemarks,
      avatarType: cust.avatarType,
      balance: String(cust.balance),
    });
    setActiveModule('customers_add');
  };

  const handleSaveCustomerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const chosenPkg = packages.find((p) => p.id === custForm.packageId) || packages[0];
    const pkgName = chosenPkg ? chosenPkg.name : '1Mbps';
    const pkgRate = custForm.category === 'Free' ? 0 : chosenPkg ? chosenPkg.monthlyRate : 500;

    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, {
        custId: custForm.custId || editingCustomer.custId,
        username: custForm.username,
        password: custForm.password,
        name: custForm.name,
        mobile: custForm.mobile,
        email: custForm.email,
        address: custForm.address,
        nidNumber: custForm.nidNumber,
        popName: custForm.popName,
        zoneName: custForm.zoneName,
        packageId: chosenPkg?.id || '',
        packageName: pkgName,
        monthlyRate: pkgRate,
        balance: Number(custForm.balance) || 0,
        billingCycle: custForm.billingCycle,
        expiryDate: custForm.expiryDate,
        category: custForm.category,
        planType: custForm.planType,
        ipAddress: custForm.ipAddress,
        macAddress: custForm.macAddress,
        mikrotikQueue: custForm.mikrotikQueue,
        routerName: custForm.routerName,
        resellerId: custForm.resellerId,
        fiberLength: custForm.fiberLength,
        cpeModel: custForm.cpeModel,
        oltPort: custForm.oltPort,
        linkRemarks: custForm.linkRemarks,
        avatarType: custForm.avatarType,
      });
      await logAuditEvent(user.uid, operator.username, 'Updated Subscriber Profile', `Edited subscriber ${custForm.username} (#${custForm.custId})`, custForm.username, custForm.popName);
      notify(`Updated subscriber ${custForm.username}.`, 'success');
      const targetId = editingCustomer.id;
      setEditingCustomer(null);
      openCustomerSingleView(targetId);
    } else {
      const cleanUname = custForm.username.trim();
      if (visibleCustomers.some((c) => c.username.toLowerCase() === cleanUname.toLowerCase())) {
        notify(`PPPoE Username "${cleanUname}" already exists. Choose a unique login ID.`, 'error');
        return;
      }
      const nextCustNum =
        visibleCustomers.reduce((max, c) => Math.max(max, Number(c.custId) || 1000), 1045) + 1;
      const newId = await createCustomer(user.uid, {
        custId: custForm.custId.trim() || String(nextCustNum),
        username: cleanUname,
        password: custForm.password,
        name: custForm.name.trim(),
        mobile: custForm.mobile,
        email: custForm.email,
        address: custForm.address,
        nidNumber: custForm.nidNumber,
        popName: custForm.popName,
        zoneName: custForm.zoneName || ISP_BRAND_NAME,
        packageId: chosenPkg?.id || '',
        packageName: pkgName,
        monthlyRate: pkgRate,
        balance: Number(custForm.balance) || 0,
        billingCycle: custForm.billingCycle,
        expiryDate: custForm.expiryDate,
        lockStatus: 'Unlocked',
        accountStatus: 'Active',
        category: custForm.category,
        planType: custForm.planType,
        ipAddress: custForm.ipAddress || '10.20.15.88',
        macAddress: custForm.macAddress,
        mikrotikQueue: custForm.mikrotikQueue,
        routerName: custForm.routerName,
        isOnline: true,
        lastLogout: 'Online Now (PPPoE)',
        iRef: '',
        resellerId: operator.mode === 'RESELLER' && operator.resellerId ? operator.resellerId : custForm.resellerId,
        fiberLength: custForm.fiberLength,
        cpeModel: custForm.cpeModel,
        oltPort: custForm.oltPort,
        linkRemarks: custForm.linkRemarks,
        avatarType: custForm.avatarType,
        mobileVerified: false,
      });
      await invokeMikrotikApi({
        action: 'add_pppoe',
        username: custForm.username.trim(),
        packageName: pkgName,
        ipAddress: custForm.ipAddress || '10.20.15.88',
        routerName: custForm.routerName,
      });
      await logAuditEvent(user.uid, operator.username, 'Created Subscriber & PPPoE Secret', `Provisioned ${custForm.username} on ${custForm.routerName}`, custForm.username, custForm.popName);
      notify(`Created subscriber ${custForm.username} and provisioned PPPoE secret.`, 'success');
      openCustomerSingleView(newId);
    }
  };

  // =========================================================================
  // VIEW 1: ADD / EDIT CUSTOMER FORM (MAXIM Mint-Banner Structured Form)
  // =========================================================================
  if (activeModule === 'customers_add') {
    return (
      <div className="space-y-3 max-w-5xl mx-auto">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <button
              type="button"
              onClick={() => setActiveModule('customers_list')}
              className="text-[#007bff] hover:underline font-semibold cursor-pointer"
            >
              Home Users
            </button>
            <span className="mx-1.5 text-slate-400">/</span>
            <span className="font-semibold text-slate-700">
              {editingCustomer ? `Edit Customer — ${editingCustomer.username} (${editingCustomer.custId})` : 'Add Customer'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editingCustomer && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCustomer(null);
                    setCustForm((prev) => ({
                      ...prev,
                      custId: '',
                      username: '',
                      name: '',
                      mobile: '017',
                      email: '',
                      nidNumber: '',
                      ipAddress: '',
                      macAddress: '',
                      balance: '0',
                    }));
                  }}
                  className="maxim-btn-success"
                >
                  <Plus className="w-3.5 h-3.5" /> New Blank Form
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = editingCustomer.id;
                    setEditingCustomer(null);
                    openCustomerSingleView(id);
                  }}
                  className="maxim-classic-btn"
                >
                  &larr; Single View
                </button>
              </>
            )}
            {!editingCustomer && (
              <button
                type="button"
                onClick={() => setActiveModule('customers_list')}
                className="maxim-classic-btn"
              >
                &larr; Customer List
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveCustomerForm} className="bg-white border border-slate-500 overflow-hidden text-xs">
          <div className="maxim-mint-banner">CUSTOMER INFORMATION</div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer ID (Auto if blank)</label>
              <input
                type="text"
                placeholder="e.g. 1046"
                value={custForm.custId}
                onChange={(e) => setCustForm({ ...custForm, custId: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Login ID (PPPoE Username) *</label>
              <input
                type="text"
                required
                placeholder="e.g. rahim_mirpur"
                value={custForm.username}
                onChange={(e) => setCustForm({ ...custForm, username: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">PPPoE &amp; Portal Password *</label>
              <input
                type="text"
                required
                value={custForm.password}
                onChange={(e) => setCustForm({ ...custForm, password: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer Name *</label>
              <input
                type="text"
                required
                placeholder="Full Name"
                value={custForm.name}
                onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact No *</label>
              <input
                type="text"
                required
                value={custForm.mobile}
                onChange={(e) => setCustForm({ ...custForm, mobile: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">National ID (NID) / Passport</label>
              <input
                type="text"
                placeholder="National ID Number"
                value={custForm.nidNumber}
                onChange={(e) => setCustForm({ ...custForm, nidNumber: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="subscriber@domain.com"
                value={custForm.email}
                onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer Category</label>
              <select
                value={custForm.category}
                onChange={(e) => setCustForm({ ...custForm, category: e.target.value as 'Regular' | 'VIP' | 'Free' })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] bg-white"
              >
                <option value="Regular">Regular Home User</option>
                <option value="VIP">VIP Priority User</option>
                <option value="Free">Free / Complimentary</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Subscriber Photo</label>
              <select
                value={custForm.avatarType}
                onChange={(e) => setCustForm({ ...custForm, avatarType: e.target.value as 'male' | 'female' })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] bg-white"
              >
                <option value="male">Male Subscriber Portrait</option>
                <option value="female">Female Subscriber Portrait</option>
              </select>
            </div>
          </div>

          <div className="maxim-mint-banner">CONNECTION STATUS/INFO</div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Package *</label>
              <select
                value={custForm.packageId}
                onChange={(e) => setCustForm({ ...custForm, packageId: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] bg-white"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ৳{p.monthlyRate}/mo ({p.downloadMbps}M)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Bill Cycle</label>
              <select
                value={custForm.billingCycle}
                onChange={(e) => setCustForm({ ...custForm, billingCycle: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] bg-white"
              >
                <option value="Day of 1">Day of 1</option>
                <option value="Day of 5">Day of 5</option>
                <option value="Day of 10">Day of 10</option>
                <option value="Day of 15">Day of 15</option>
                <option value="Monthly Dynamic">Monthly Dynamic</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={custForm.expiryDate}
                onChange={(e) => setCustForm({ ...custForm, expiryDate: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">POP *</label>
              <select
                value={custForm.popName}
                onChange={(e) => setCustForm({ ...custForm, popName: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] bg-white"
              >
                {pops.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">MikroTik NAS Router</label>
              <select
                value={custForm.routerName}
                onChange={(e) => setCustForm({ ...custForm, routerName: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] bg-white"
              >
                {routers.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name} ({r.popName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">SDT / Reseller</label>
              <select
                value={custForm.resellerId}
                onChange={(e) => setCustForm({ ...custForm, resellerId: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] bg-white"
              >
                <option value="">{brandName} (Direct)</option>
                {resellers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.username} ({r.companyName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">IP Address</label>
              <input
                type="text"
                placeholder="10.20.x.x or Public IP"
                value={custForm.ipAddress}
                onChange={(e) => setCustForm({ ...custForm, ipAddress: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">MAC Address</label>
              <input
                type="text"
                placeholder="AA:BB:CC:DD:EE:FF"
                value={custForm.macAddress}
                onChange={(e) => setCustForm({ ...custForm, macAddress: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Balance (BDT)</label>
              <input
                type="number"
                step="0.01"
                value={custForm.balance}
                onChange={(e) => setCustForm({ ...custForm, balance: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="maxim-mint-banner">CONNECTION LINK INFO &amp; LOCATION</div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Fiber Optic Length</label>
              <input
                type="text"
                value={custForm.fiberLength}
                onChange={(e) => setCustForm({ ...custForm, fiberLength: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">CPE / ONU Model</label>
              <input
                type="text"
                value={custForm.cpeModel}
                onChange={(e) => setCustForm({ ...custForm, cpeModel: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">OLT Port No</label>
              <input
                type="text"
                value={custForm.oltPort}
                onChange={(e) => setCustForm({ ...custForm, oltPort: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Link Remarks</label>
              <input
                type="text"
                value={custForm.linkRemarks}
                onChange={(e) => setCustForm({ ...custForm, linkRemarks: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px]"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block font-bold text-slate-700 mb-1">Address *</label>
              <input
                type="text"
                required
                value={custForm.address}
                onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px]"
              />
            </div>
          </div>

          <div className="px-4 py-3 bg-[#f3f4f6] border-t border-slate-400 flex items-center justify-center gap-3">
            <button type="submit" className="maxim-btn-success px-5 py-1.5">
              {editingCustomer ? 'Save Changes' : 'Save & Provision PPPoE'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingCustomer(null);
                setActiveModule('customers_list');
              }}
              className="maxim-classic-btn px-4 py-1.5"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: BULK RECHARGE WORKSPACE (Exact Official Reference: rechargebulk.png)
  // =========================================================================
  if (activeModule === 'customers_bulk_recharge') {
    const selectedRows =
      bulkCustomerIds.length > 0
        ? visibleCustomers.filter((c) => bulkCustomerIds.includes(c.id))
        : visibleCustomers.slice(0, 6);

    const activeReseller =
      operator.mode === 'RESELLER' && operator.resellerId
        ? resellers.find((r) => r.id === operator.resellerId)
        : resellers[0];

    const totalCharge = selectedRows.reduce((sum, c) => {
      const m = bulkMonths[c.id] || 1;
      return sum + c.monthlyRate * m;
    }, 0);

    const sdtStartingBalance = operator.mode === 'RESELLER' && activeReseller ? activeReseller.balance : 0;
    const sdtCalcTotal = operator.mode === 'RESELLER' ? Math.round(totalCharge * 0.8) : 0;
    const sdtBalanceLeft = sdtStartingBalance - sdtCalcTotal;
    const effectiveReceived = bulkAmountReceived !== '' ? Number(bulkAmountReceived) : totalCharge;

    const handleBulkSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || selectedRows.length === 0) return;
      if (!operator.canCollectCash) {
        notify('Current role is not permitted to post Bulk Recharge entries.', 'error');
        return;
      }
      if (operator.mode === 'RESELLER' && activeReseller && sdtBalanceLeft < -activeReseller.creditLimit) {
        notify('Insufficient Reseller balance (exceeds allowed Overdraft Credit Limit).', 'error');
        return;
      }

      for (const c of selectedRows) {
        const months = bulkMonths[c.id] || 1;
        const charge = c.category === 'Free' ? 0 : c.monthlyRate * months;
        const nextBal = computeSubscriberBalanceAfterPayment(c.balance, charge, charge, months);
        const nextExp = addMonthsToDateStr(c.expiryDate, months);

        await createPaymentRecord(user.uid, {
          trxNumber: `BLK-${Date.now().toString(36).toUpperCase()}-${c.custId}`,
          targetType: 'Home',
          customerId: c.id,
          customerUsername: c.username,
          customerName: c.name,
          amount: charge,
          chargeAmount: charge,
          billForMonths: months,
          method: bulkMethod,
          channel: `${bulkMethod} Bulk`,
          receivedBy: bulkReceivedBy || operator.username,
          syncSource: 'Bulk Recharge',
          senderMobile: c.mobile,
          status: 'Completed',
          remarks: bulkRemarks || `Bulk recharged (${months} Month)`,
          oldExpiry: c.expiryDate,
          newExpiry: nextExp,
          paymentDate: formatShortDateTime(),
        });

        await updateCustomer(c.id, {
          balance: nextBal,
          expiryDate: nextExp,
          lockStatus: 'Unlocked',
          accountStatus: 'Active',
        });
      }

      if (operator.mode === 'RESELLER' && activeReseller) {
        await updateReseller(activeReseller.id, {
          balance: sdtBalanceLeft,
        });
      }

      await logAuditEvent(
        user.uid,
        operator.username,
        'Bulk Recharge Executed',
        `Recharged ${selectedRows.length} subscribers totaling BDT ${effectiveReceived}`,
        'Bulk Recharge'
      );

      notify(`Bulk recharged ${selectedRows.length} subscribers (BDT ${totalCharge.toLocaleString()}).`, 'success');
      setBulkCustomerIds([]);
      setActiveModule('customers_list');
    };

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <button
              type="button"
              onClick={() => setActiveModule('customers_list')}
              className="text-[#007bff] hover:underline font-semibold cursor-pointer"
            >
              Home Users
            </button>
            <span className="mx-1.5 text-slate-400">/</span>
            <span className="font-semibold text-slate-700">Bulk Recharge</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('customers_list')}
            className="maxim-classic-btn"
          >
            &larr; Customer List
          </button>
        </div>

        {/* Full-Width 9-Column Bordered Bulk Recharge Grid (rechargebulk.png) */}
        <div className="bg-white border border-slate-500 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f1f3f5] text-slate-900 font-bold border-b border-slate-400">
                <th className="px-2.5 py-2 border-r border-slate-300">Cust ID</th>
                <th className="px-2.5 py-2 border-r border-slate-300">Username</th>
                <th className="px-2.5 py-2 border-r border-slate-300">Package</th>
                <th className="px-2.5 py-2 border-r border-slate-300 text-right">Rate</th>
                <th className="px-2.5 py-2 border-r border-slate-300">Bill For</th>
                <th className="px-2.5 py-2 border-r border-slate-300 text-right">Charge Amt</th>
                <th className="px-2.5 py-2 border-r border-slate-300">Old Expiry Date</th>
                <th className="px-2.5 py-2 border-r border-slate-300">Full Name</th>
                <th className="px-2.5 py-2 text-right">SDT/POP Calc</th>
              </tr>
            </thead>
            <tbody>
              {selectedRows.map((c) => {
                const m = bulkMonths[c.id] || 1;
                const charge = c.category === 'Free' ? 0 : c.monthlyRate * m;
                const sdtRow = operator.mode === 'RESELLER' ? Math.round(charge * 0.8) : 0;
                return (
                  <tr key={c.id} className="border-b border-slate-300 hover:bg-amber-50/30">
                    <td className="px-2.5 py-1.5 border-r border-slate-300 font-mono">{c.custId}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-300 font-semibold text-slate-900">{c.username}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-300">{c.packageName}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-300 text-right font-mono tabular-nums">
                      {c.monthlyRate}
                    </td>
                    <td className="px-2.5 py-1 border-r border-slate-300">
                      <select
                        value={m}
                        onChange={(e) => setBulkMonths({ ...bulkMonths, [c.id]: Number(e.target.value) })}
                        className="border border-slate-400 px-2 py-0.5 text-xs bg-white"
                      >
                        <option value={1}>1 Month</option>
                        <option value={2}>2 Months</option>
                        <option value={3}>3 Months</option>
                        <option value={6}>6 Months</option>
                        <option value={12}>12 Months</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-slate-300 text-right font-mono tabular-nums font-bold">
                      {charge}
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-slate-300 font-mono">{c.expiryDate}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-300">{c.name}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{sdtRow}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="font-bold text-slate-900 text-xs">
              <tr className="bg-[#ccccff] border-b border-slate-400">
                <td colSpan={5} className="px-2.5 py-1.5 border-r border-slate-400 text-right">
                  Total:
                </td>
                <td className="px-2.5 py-1.5 border-r border-slate-400 text-right font-mono tabular-nums">
                  {totalCharge}
                </td>
                <td colSpan={2} className="px-2.5 py-1.5 border-r border-slate-400" />
                <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{sdtCalcTotal}</td>
              </tr>
              <tr className="bg-[#ccccff] border-b border-slate-400">
                <td colSpan={8} className="px-2.5 py-1.5 border-r border-slate-400 text-right">
                  SDT Balance:
                </td>
                <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{sdtStartingBalance}</td>
              </tr>
              <tr className="border-b border-slate-400">
                <td colSpan={8} className="bg-[#ccccff] px-2.5 py-1.5 border-r border-slate-400 text-right">
                  SDT Balance Left:
                </td>
                <td className="bg-[#88ff88] px-2.5 py-1.5 text-right font-mono tabular-nums">
                  {sdtBalanceLeft}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Centered 2-Column Yellow-Input Settlement Box (rechargebulk.png) */}
        <form onSubmit={handleBulkSave} className="max-w-md mx-auto bg-white border border-slate-500 text-xs">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-slate-400">
                <td className="px-3 py-2 font-bold text-slate-800 border-r border-slate-400 w-1/2">
                  Payment Method
                </td>
                <td className="p-1.5">
                  <select
                    value={bulkMethod}
                    onChange={(e) => setBulkMethod(e.target.value as 'CASH' | 'bKash Sync' | 'Bank')}
                    className="w-full px-2 py-1 border border-slate-500 bg-[#ffff66] font-bold text-slate-900"
                  >
                    <option value="CASH">CASH</option>
                    <option value="bKash Sync">bKash Sync</option>
                    <option value="Bank">Bank</option>
                  </select>
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="px-3 py-2 font-bold text-slate-800 border-r border-slate-400">
                  Amount Received from Client
                </td>
                <td className="p-1.5">
                  <input
                    type="number"
                    value={bulkAmountReceived !== '' ? bulkAmountReceived : totalCharge}
                    onChange={(e) => setBulkAmountReceived(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-500 bg-[#ffff66] font-mono tabular-nums font-bold text-slate-900"
                  />
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="px-3 py-2 font-bold text-slate-800 border-r border-slate-400">
                  Received By
                </td>
                <td className="p-1.5">
                  <select
                    value={bulkReceivedBy}
                    onChange={(e) => setBulkReceivedBy(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-400 bg-white font-semibold"
                  >
                    <option value={operator.username}>{operator.username}</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.username}>
                        {emp.username} ({emp.role})
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="px-3 py-2 font-bold text-slate-800 border-r border-slate-400">
                  Remarks:
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={bulkRemarks}
                    onChange={(e) => setBulkRemarks(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-400"
                  />
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="py-2.5 text-center bg-[#f8f9fa]">
                  <button type="submit" className="maxim-classic-btn px-6 py-1.5 font-bold">
                    Save
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </form>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: CUSTOMER DETAILS — EXACT MAXIM SINGLE-VIEW TABLE (userinfo.png + linkinfo.png)
  // =========================================================================
  if (activeModule === 'customers_detail' && selectedCustomer) {
    const c = selectedCustomer;
    const custPayments = payments.filter((p) => p.customerId === c.id || p.customerUsername === c.username);
    const custTickets = visibleTickets.filter((t) => t.customerId === c.id || t.customerUsername === c.username);
    const assignedSdt = c.resellerId ? resellers.find((r) => r.id === c.resellerId) : null;
    const sdtOrZoneLabel = assignedSdt ? assignedSdt.username : formatBrandName(c.zoneName);
    const logoutDisplay = splitLastLogoutLines(c.lastLogout, c.isOnline);

    const handleToggleLock = async () => {
      await handleRowToggleLock(c);
    };

    const handlePermanentDisable = async () => {
      if (!user) return;
      if (operator.mode === 'STAFF' && !operator.canManageRouter) {
        notify('Your staff role does not have NAS Permanent Disable permission.', 'error');
        return;
      }
      const nextStatus = c.accountStatus === 'Disabled' ? 'Active' : 'Disabled';
      await invokeMikrotikApi({
        action: nextStatus === 'Disabled' ? 'permanent_disable' : 'unlock',
        username: c.username,
        packageName: c.packageName,
        routerName: c.routerName,
      });
      await updateCustomer(c.id, {
        accountStatus: nextStatus,
        lockStatus: nextStatus === 'Disabled' ? 'Locked' : 'Unlocked',
        isOnline: nextStatus === 'Active',
        lastLogout:
          nextStatus === 'Disabled'
            ? `Permanently Disabled · ${formatMaximShortDate(new Date().toISOString().slice(0, 10))} ${new Date().toTimeString().slice(0, 5)}`
            : 'Online Now (PPPoE)',
      });
      await logAuditEvent(
        user.uid,
        operator.username,
        nextStatus === 'Disabled' ? 'Permanent Disable' : 'Re-Activated Subscriber',
        `Set subscriber ${c.username} (#${c.custId}) accountStatus=${nextStatus}`,
        c.username,
        c.popName
      );
      notify(`${c.username} status set to ${nextStatus}.`, 'info');
    };

    const handleSaveIp = async () => {
      if (!user) return;
      if (operator.mode === 'STAFF' && !operator.canManageRouter) {
        notify('Your staff role does not have IP Change permission.', 'error');
        return;
      }
      const nextIp = ipDraft.trim() || c.ipAddress;
      if (!nextIp) {
        notify('Enter a valid IPv4 address (e.g. 10.20.15.42) before clicking Change.', 'error');
        return;
      }
      await invokeMikrotikApi({
        action: 'change_ip',
        username: c.username,
        ipAddress: nextIp,
        routerName: c.routerName,
      });
      await updateCustomer(c.id, { ipAddress: nextIp });
      await logAuditEvent(
        user.uid,
        operator.username,
        'Changed Subscriber IP',
        `Assigned Framed-IP ${nextIp} to ${c.username} on ${c.routerName}`,
        c.username,
        c.popName
      );
      notify(`Updated IP Address for ${c.username} to ${nextIp}.`, 'success');
      setIpDraft('');
    };

    const handleDeleteCustomer = async (targetCust: Customer) => {
      if (!user) return;
      if (!operator.canDeleteRecord) {
        notify('Current operator role does not have Delete Record permission.', 'error');
        return;
      }
      await deleteDocumentByPath('customers', targetCust.id);
      await logAuditEvent(
        user.uid,
        operator.username,
        'Delete Subscriber',
        `Deleted subscriber ${targetCust.username} (#${targetCust.custId}) from ${targetCust.popName}`,
        targetCust.username,
        targetCust.popName
      );
      setConfirmDeleteCustomerId(null);
      notify(`Deleted subscriber ${targetCust.username} (#${targetCust.custId}).`, 'info');
      setActiveModule('customers_list');
    };

    const openPasswordModal = () => {
      setModalInputA(c.password);
      setActiveActionModal('password');
    };

    const openRechargeModal = () => {
      setModalInputA('1');
      setModalInputB(String(c.monthlyRate));
      setModalInputC('CASH');
      setActiveActionModal('recharge');
    };

    const openPackageModal = () => {
      setModalInputA(c.packageId || packages[0]?.id || '');
      setModalInputB(c.mikrotikQueue || 'Package Default');
      setActiveActionModal('package');
    };

    const openPaymentModal = () => {
      setModalInputA(String(Math.max(500, Math.abs(Math.round(c.balance)) || c.monthlyRate)));
      setModalInputB('CASH');
      setModalInputC('');
      setActiveActionModal('payment');
    };

    const openExpiryModal = () => {
      setModalInputA(c.expiryDate);
      setModalInputB(c.billingCycle);
      setActiveActionModal('expiry');
    };

    const openMacModal = () => {
      setModalInputA(c.macAddress);
      setActiveActionModal('mac_disconnect');
    };

    const openTicketsModal = () => {
      setModalInputA('No Internet / LOS Red Light');
      setModalInputB(employees[0]?.username || operator.username);
      setModalInputC('Normal');
      setModalInputD('');
      setActiveActionModal('tickets_modal');
    };

    const openLinkInfoModal = () => {
      setModalInputA(c.fiberLength);
      setModalInputB(c.cpeModel);
      setModalInputC(c.oltPort);
      setModalInputD(c.linkRemarks);
      setLinkEditMode(false);
      setActiveActionModal('link_info');
    };

    const openLocationModal = () => {
      setModalInputA(formatBrandName(c.zoneName));
      setModalInputB(c.popName);
      setModalInputC(c.address);
      setModalInputD(c.resellerId || '');
      setActiveActionModal('location_edit');
    };

    const openNidModal = (printView: boolean) => {
      setModalInputA(c.nidNumber || '1990269000111');
      setModalInputB(c.avatarType);
      setModalInputC(c.mobileVerified ? 'yes' : 'no');
      setNidPrintMode(printView);
      setActiveActionModal('nid_form');
    };

    const openRouterModal = () => {
      setModalInputA(c.routerName || routers[0]?.name || 'Mirpur-Core-CCR1036');
      setActiveActionModal('router_sync');
    };

    const custSessionLogs = operationalLogs.filter(
      (l) =>
        (l.logCategory === 'ip_log' || l.logCategory === 'audit_log') &&
        (l.actor.toLowerCase() === c.username.toLowerCase() || l.target.toLowerCase() === c.username.toLowerCase())
    );

    return (
      <div className="w-full">
        {/* =============================================================== */}
        {/* EXACT MAXIM SINGLE-VIEW TABLE (https://maxim-billing.com/img/screens/userinfo.png) */}
        {/* Pure Table-Based Layout — Zero Card Wrappers                    */}
        {/* =============================================================== */}
        <div className="w-full max-w-[960px] mx-auto bg-white overflow-x-auto">
          <table className="w-full table-fixed border-collapse border border-[#555555] text-[12.5px] leading-[1.35] text-[#222222]">
            <colgroup>
              <col className="w-[38.5%]" />
              <col className="w-[41.5%]" />
              <col className="w-[20%]" />
            </colgroup>
            <tbody>
              {/* SECTION 1 HEADER: CUSTOMER INFORMATION */}
              <tr className="border-b border-[#666666]">
                <th
                  colSpan={3}
                  className="bg-[#ade6d8] text-[#111111] font-semibold text-[13px] text-center py-[5px] px-3 tracking-[0.01em] uppercase"
                >
                  CUSTOMER INFORMATION
                </th>
              </tr>

              {/* Row 1: CUSTOMER ID + Subscriber Portrait Column (rowSpan=3 matching userinfo.png) */}
              <tr className="bg-white border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-bold text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  CUSTOMER ID:
                </td>
                <td className="px-2.5 py-[5px] align-middle">
                  <div className="inline-flex items-center gap-3">
                    <span className="font-bold text-[#111111] text-[13px]">{c.custId}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setModalInputA('');
                        setActiveActionModal('switch_customer');
                      }}
                      title="Switch / Jump to Another Customer ID"
                      className="text-[#0b67e5] hover:text-[#084db3] cursor-pointer inline-flex items-center no-print"
                    >
                      <svg viewBox="0 0 24 20" className="w-[22px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h16M15 2l5 4-5 4" />
                        <path d="M21 14H5M9 10l-5 4 5 4" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td
                  rowSpan={3}
                  className="border-l border-[#888888] bg-white p-[3px] align-top"
                >
                  <button
                    type="button"
                    onClick={() => openNidModal(false)}
                    title="Click to manage Subscriber Photo & NID"
                    className="block cursor-pointer"
                  >
                    <img
                      src={c.avatarType === 'female' ? femaleAvatarImg : maleAvatarImg}
                      alt={c.name}
                      referrerPolicy="no-referrer"
                      className="w-[82px] h-[82px] object-cover border border-[#e0e0e0] bg-white block"
                    />
                  </button>
                  <div className="mt-[3px] flex items-center gap-[3px] no-print">
                    <button
                      type="button"
                      onClick={() => openNidModal(false)}
                      title="National ID (NID) Verification & Edit"
                      className="w-[24px] h-[16px] bg-[#2e8b15] hover:bg-[#236e0f] text-white rounded-[2px] inline-flex items-center justify-center cursor-pointer"
                    >
                      <svg viewBox="0 0 20 14" className="w-[16px] h-[12px]" fill="currentColor">
                        <circle cx="5.5" cy="5" r="2.2" />
                        <path d="M2 11.5c0-1.9 1.6-3.2 3.5-3.2S9 9.6 9 11.5H2z" />
                        <rect x="11" y="3.2" width="7" height="1.5" />
                        <rect x="11" y="6.3" width="7" height="1.5" />
                        <rect x="11" y="9.4" width="7" height="1.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => openNidModal(true)}
                      title="BTRC Subscriber KYC Application Form"
                      className="w-[24px] h-[16px] bg-[#e64a19] hover:bg-[#c63c11] text-white rounded-[2px] inline-flex items-center justify-center cursor-pointer"
                    >
                      <svg viewBox="0 0 20 14" className="w-[16px] h-[12px]" fill="currentColor">
                        <circle cx="5.5" cy="5" r="2.2" />
                        <path d="M2 11.5c0-1.9 1.6-3.2 3.5-3.2S9 9.6 9 11.5H2z" />
                        <rect x="11" y="3.2" width="7" height="1.5" />
                        <rect x="11" y="6.3" width="7" height="1.5" />
                        <rect x="11" y="9.4" width="7" height="1.5" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              {/* Row 2: LOGIN ID */}
              <tr className="bg-[#f1f1f1] border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-bold text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  LOGIN ID:
                </td>
                <td className="px-2.5 py-[5px] align-middle">
                  <div className="inline-flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#008000] text-[15px] leading-none">{c.username}</span>
                    <button
                      type="button"
                      onClick={() => setActiveActionModal('session_logs')}
                      title={c.isOnline ? 'Subscriber Online — View PPPoE Session' : 'Subscriber Offline — View Session Details'}
                      className="inline-flex items-center cursor-pointer"
                    >
                      <svg viewBox="0 0 20 24" className="w-[16px] h-[19px]" fill="none">
                        <path
                          d="M10 1.5C6.1 1.5 3 4.5 3 8.3c0 2.4 1.2 4.5 3.1 5.7.6.4 1 1.1 1 1.8v1.2h5.8v-1.2c0-.7.4-1.4 1-1.8 1.9-1.2 3.1-3.3 3.1-5.7 0-3.8-3.1-6.8-7-6.8z"
                          fill={c.isOnline ? '#fbbf24' : '#d4d4d4'}
                        />
                        <rect x="7.2" y="18" width="5.6" height="1.8" rx="0.6" fill={c.isOnline ? '#b45309' : '#b8b8b8'} />
                        <rect x="7.8" y="20.4" width="4.4" height="1.8" rx="0.6" fill={c.isOnline ? '#92400e' : '#b8b8b8'} />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={openPasswordModal}
                      title="Click to change PPPoE & Portal Password"
                      className="text-[#777777] hover:text-[#222222] text-[12.5px] ml-1 cursor-pointer"
                    >
                      pass: {c.password}
                    </button>
                  </div>
                </td>
              </tr>

              {/* Row 3: MAC ADDRESS */}
              <tr className="bg-white border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[4px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  MAC ADDRESS:
                </td>
                <td className="px-2.5 py-[4px] align-middle">
                  <div className="inline-flex flex-wrap items-center gap-2">
                    {c.macAddress && (
                      <span className="font-mono text-[12px] text-[#111111]">{c.macAddress}</span>
                    )}
                    <button
                      type="button"
                      onClick={openMacModal}
                      className="maxim-userinfo-btn no-print"
                    >
                      Change
                    </button>
                  </div>
                </td>
              </tr>

              {/* Row 4: CUSTOMER NAME (colSpan=2 spans full right width matching userinfo.png) */}
              <tr className="bg-[#f1f1f1] border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  CUSTOMER NAME:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] font-bold text-[#111111] align-middle">
                  <button
                    type="button"
                    onClick={() => beginEditCustomer(c)}
                    title="Click to edit Customer Profile"
                    className="font-bold text-[#111111] hover:underline cursor-pointer text-left"
                  >
                    {c.name}
                  </button>
                </td>
              </tr>

              {/* Row 5: CONTACT NO (colSpan=2 spans full right width matching userinfo.png) */}
              <tr className="bg-white border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[4px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  CONTACT NO:
                </td>
                <td colSpan={2} className="px-2.5 py-[4px] align-middle">
                  {contactEditMode ? (
                    <div className="inline-flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={contactDraft}
                        onChange={(e) => setContactDraft(e.target.value)}
                        className="px-2 py-[2px] border border-[#767676] text-[12px] w-36 bg-white"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (contactDraft.trim() && user) {
                            await updateCustomer(c.id, { mobile: contactDraft.trim() });
                            await logAuditEvent(
                              user.uid,
                              operator.username,
                              'Updated Contact No',
                              `Changed contact number for ${c.username} to ${contactDraft.trim()}`,
                              c.username,
                              c.popName
                            );
                            notify('Contact number updated.', 'success');
                          }
                          setContactEditMode(false);
                        }}
                        className="maxim-userinfo-btn font-semibold"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactEditMode(false)}
                        className="maxim-userinfo-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5">
                      <span className="font-bold text-[#111111]">{c.mobile}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setContactDraft(c.mobile);
                          setContactEditMode(true);
                        }}
                        className="maxim-userinfo-btn no-print"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </td>
              </tr>

              {/* Row 6: OFFICIAL 10 BLUE ACTION ICONS TOOLBAR BELOW CONTACT NO (userinfo.png) */}
              <tr className="bg-white border-b border-[#666666] no-print">
                <td colSpan={3} className="px-3 py-[6px]">
                  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5">
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 1. Change PPPoE & Portal Password (Key) */}
                    <button
                      type="button"
                      onClick={openPasswordModal}
                      title="Change PPPoE & Portal Password"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" className="w-[23px] h-[23px]" fill="currentColor">
                        <path d="M16.5 2a5.5 5.5 0 0 0-5.32 6.89L3 17.07V21h3.93l1.79-1.79v-2.14h2.14l1.95-1.95A5.5 5.5 0 1 0 16.5 2zm1.5 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                      </svg>
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 2. Recharge / Renew Subscription (Battery Charge) */}
                    <button
                      type="button"
                      onClick={openRechargeModal}
                      title="Recharge / Renew Subscription"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <svg viewBox="0 0 26 20" className="w-[24px] h-[20px]" fill="none">
                        <rect x="1.5" y="3" width="20" height="14" rx="1.8" stroke="currentColor" strokeWidth="2.2" />
                        <rect x="4.5" y="6" width="10.5" height="8" fill="currentColor" />
                        <rect x="22.5" y="6.8" width="2.5" height="6.4" rx="0.8" fill="currentColor" />
                      </svg>
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 3. Change Bandwidth Package & Queue (Recycle Arrows) */}
                    <button
                      type="button"
                      onClick={openPackageModal}
                      title="Change Package & MikroTik Queue"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <RefreshCw className="w-[22px] h-[22px] stroke-[2.5]" />
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 4. Payment & Billing Ledger + Printable Receipts (List) */}
                    <button
                      type="button"
                      onClick={() => setActiveActionModal('ledger')}
                      title="Billing & Payment Ledger / Receipts"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <List className="w-[23px] h-[23px] stroke-[2.6]" />
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 5. Add Payment / Receive Cash (Money Card with Plus) */}
                    <button
                      type="button"
                      onClick={openPaymentModal}
                      title="Add Payment / Receive Due"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <svg viewBox="0 0 26 20" className="w-[24px] h-[20px]" fill="currentColor">
                        <path d="M2 2.5h22a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H2A1.5 1.5 0 0 1 .5 16V4A1.5 1.5 0 0 1 2 2.5zm11 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm-.8 2h1.6v1.7h1.7v1.6h-1.7v1.7h-1.6v-1.7h-1.7V9.2h1.7V7.5z" />
                      </svg>
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 6. Change Expiry Date & Billing Cycle (Calendar) */}
                    <button
                      type="button"
                      onClick={openExpiryModal}
                      title="Change Expiry Date & Bill Cycle"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <Calendar className="w-[21px] h-[21px] stroke-[2.3]" />
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 7. Bind/Clear MAC & Disconnect Active PPPoE Session (Scissors) */}
                    <button
                      type="button"
                      onClick={openMacModal}
                      title="Bind/Clear MAC & Kick Active PPPoE Session"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <Scissors className="w-[22px] h-[22px] stroke-[2.3]" />
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 8. Support Tickets & Create Ticket (Ticket) */}
                    <button
                      type="button"
                      onClick={openTicketsModal}
                      title="Subscriber Support Tickets & Create Ticket"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <Ticket className="w-[23px] h-[23px] stroke-[2.3]" />
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 9. Connection Link Info — Fiber / CPE / OLT (Network Sitemap) */}
                    <button
                      type="button"
                      onClick={openLinkInfoModal}
                      title="Connection Link Info (Fiber / CPE / OLT)"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <Network className="w-[22px] h-[22px] stroke-[2.3]" />
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>

                    {/* 10. Edit Full Customer Profile (Square + Pencil) */}
                    <button
                      type="button"
                      onClick={() => beginEditCustomer(c)}
                      title="Edit Full Customer Profile"
                      className="p-0.5 text-[#0b67e5] hover:text-[#084bb0] cursor-pointer"
                    >
                      <Edit3 className="w-[21px] h-[21px] stroke-[2.3]" />
                    </button>
                    <span className="text-[#888888] text-[12px] select-none">|</span>
                  </div>
                </td>
              </tr>

              {/* SECTION 2 HEADER: CONNECTION STATUS/INFO */}
              <tr className="border-b border-[#666666]">
                <th
                  colSpan={3}
                  className="bg-[#ade6d8] text-[#111111] font-semibold text-[13px] text-center py-[5px] px-3 tracking-[0.01em] uppercase"
                >
                  CONNECTION STATUS/INFO
                </th>
              </tr>

              {/* Row 7: PACKAGE */}
              <tr className="bg-white border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  PACKAGE:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <button
                    type="button"
                    onClick={openPackageModal}
                    title="Click to change Bandwidth Package"
                    className="font-bold text-[#111111] hover:underline cursor-pointer text-left"
                  >
                    {c.packageName}
                  </button>
                </td>
              </tr>

              {/* Row 8: LOCK STATUS (Exact 2-Row Inner Status Block from userinfo.png) */}
              <tr className="bg-[#f1f1f1] border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[6px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  LOCK STATUS:
                </td>
                <td colSpan={2} className="px-2.5 py-[6px] align-middle">
                  <div className="inline-grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-1.5 bg-[#e7e7e7] px-2 py-1.5">
                    <div className="inline-flex items-center gap-1.5">
                      {c.lockStatus === 'Unlocked' ? (
                        <svg viewBox="0 0 18 18" className="w-[16px] h-[16px] shrink-0" fill="none">
                          <path d="M6 8V5.2a3.2 3.2 0 0 1 6.2-1" stroke="#888888" strokeWidth="1.8" strokeLinecap="round" />
                          <rect x="2.5" y="8" width="10.5" height="8" rx="1.3" fill="#2e8b15" stroke="#1f630d" strokeWidth="0.8" />
                          <circle cx="7.75" cy="12" r="1.1" fill="#ffffff" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 18 18" className="w-[16px] h-[16px] shrink-0" fill="none">
                          <path d="M5.2 8V5.4a3.2 3.2 0 0 1 6.4 0V8" stroke="#888888" strokeWidth="1.8" strokeLinecap="round" />
                          <rect x="3" y="8" width="10.8" height="8" rx="1.3" fill="#dc2626" stroke="#991b1b" strokeWidth="0.8" />
                          <circle cx="8.4" cy="12" r="1.1" fill="#ffffff" />
                        </svg>
                      )}
                      <span
                        className={`font-bold ${
                          c.lockStatus === 'Unlocked' ? 'text-[#008000]' : 'text-[#dc0000]'
                        }`}
                      >
                        {c.lockStatus}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleLock}
                      className="px-2.5 py-[2px] bg-[#efefef] hover:bg-[#e0e0e0] border border-[#cccccc] text-[#111111] text-[11.5px] text-left cursor-pointer no-print"
                    >
                      Change
                    </button>

                    <div>
                      <span
                        className={`font-bold ${
                          c.accountStatus === 'Active' ? 'text-[#008000]' : 'text-[#dc0000]'
                        }`}
                      >
                        {c.accountStatus}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handlePermanentDisable}
                      className="px-2.5 py-[2px] bg-[#efefef] hover:bg-[#e0e0e0] border border-[#cccccc] text-[#111111] text-[11.5px] text-left cursor-pointer no-print"
                    >
                      {c.accountStatus === 'Disabled' ? 'Re-Activate' : 'Permanent Disable'}
                    </button>
                  </div>
                </td>
              </tr>

              {/* Row 9: EXPIRY DATE */}
              <tr className="bg-white border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-bold text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  EXPIRY DATE:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <button
                    type="button"
                    onClick={openExpiryModal}
                    title="Click to change Expiry Date"
                    className="font-bold text-[#111111] hover:underline cursor-pointer"
                  >
                    {formatMaximShortDate(c.expiryDate)}
                  </button>
                </td>
              </tr>

              {/* Row 10: BILL CYCLE */}
              <tr className="bg-[#f1f1f1] border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  BILL CYCLE:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <button
                    type="button"
                    onClick={openExpiryModal}
                    title="Click to change Bill Cycle"
                    className="text-[#222222] hover:underline cursor-pointer"
                  >
                    {c.billingCycle}
                  </button>
                </td>
              </tr>

              {/* Row 11: Mikrotik Queue */}
              <tr className="bg-white border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  Mikrotik Queue:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <button
                    type="button"
                    onClick={openPackageModal}
                    title="Click to change MikroTik Queue"
                    className="text-[#222222] hover:underline cursor-pointer"
                  >
                    {c.mikrotikQueue}
                  </button>
                </td>
              </tr>

              {/* Row 12: Balance */}
              <tr className="bg-[#f1f1f1] border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-bold text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  Balance:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <button
                    type="button"
                    onClick={openPaymentModal}
                    title="Click to collect Due / Add Payment"
                    className={`font-bold tabular-nums hover:underline cursor-pointer ${
                      c.balance < 0
                        ? 'text-[#dc0000]'
                        : c.balance > 0
                        ? 'text-[#008000]'
                        : 'text-[#111111]'
                    }`}
                  >
                    {c.balance.toFixed(2)}
                  </button>
                </td>
              </tr>

              {/* Row 13: IP Address */}
              <tr className="bg-white border-b border-[#666666]">
                <td className="pr-2.5 pl-2 py-[10px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  IP Address:
                </td>
                <td colSpan={2} className="px-2.5 py-[10px] align-middle">
                  <div className="inline-flex flex-wrap items-center gap-1">
                    <input
                      type="text"
                      placeholder={c.ipAddress || 'xxx.xxx.xxx.xxx'}
                      value={ipDraft}
                      onChange={(e) => setIpDraft(e.target.value)}
                      className="w-[172px] h-[25px] px-2 border border-[#767676] bg-white text-[12px] text-[#222222] placeholder:text-[#777777] rounded-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveIp}
                      className="maxim-userinfo-btn h-[25px] px-2.5 no-print"
                    >
                      Change
                    </button>
                  </div>
                </td>
              </tr>

              {/* SECTION 3 HEADER: LOCATION */}
              <tr className="border-b border-[#666666]">
                <th
                  colSpan={3}
                  className="bg-[#ade6d8] text-[#111111] font-semibold text-[13px] text-center py-[5px] px-3 tracking-[0.01em] uppercase"
                >
                  LOCATION
                </th>
              </tr>

              {/* Row 14: SDT/ZONE NAME */}
              <tr className="bg-white border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  SDT/ZONE NAME:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <button
                    type="button"
                    onClick={openLocationModal}
                    title="Click to edit SDT / Zone Name"
                    className="font-bold text-[#111111] hover:underline cursor-pointer text-left"
                  >
                    {sdtOrZoneLabel}
                  </button>
                </td>
              </tr>

              {/* Row 15: POP */}
              <tr className="bg-[#f1f1f1] border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  POP:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <div className="inline-flex items-center gap-3">
                    <span className="text-[#222222]">{c.popName}</span>
                    <button
                      type="button"
                      onClick={openLocationModal}
                      title="Change POP & Location Info"
                      className="text-[#0b67e5] hover:text-[#084bb0] cursor-pointer inline-flex items-center no-print"
                    >
                      <svg viewBox="0 0 20 24" className="w-[18px] h-[21px]" fill="currentColor">
                        <path d="M10 1C5.3 1 1.5 4.8 1.5 9.5 1.5 15.8 10 23 10 23s8.5-7.2 8.5-13.5C18.5 4.8 14.7 1 10 1zm0 11.7a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              {/* Row 16: ADDRESS */}
              <tr className="bg-white border-b border-[#666666]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  ADDRESS:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <div className="inline-flex flex-wrap items-center gap-2">
                    <strong className="text-[#111111]">{c.address}</strong>
                    <button
                      type="button"
                      onClick={openLocationModal}
                      title="Edit Subscriber Address & Location"
                      className="text-[#0b67e5] hover:text-[#084bb0] cursor-pointer ml-1 inline-flex items-center no-print"
                    >
                      <svg viewBox="0 0 26 22" className="w-[23px] h-[20px]" fill="currentColor">
                        <circle cx="9.5" cy="6.2" r="4" />
                        <path d="M2 19.5c0-3.8 3.3-6.5 7.5-6.5 1.5 0 2.9.4 4.1 1l-2.9 2.9v2.6H2z" />
                        <path d="M21.8 10.2l2 2-7.1 7.1h-2v-2l7.1-7.1z" />
                      </svg>
                    </button>
                    <span className="text-[#888888] text-[12px] select-none no-print">|</span>
                    <button
                      type="button"
                      onClick={() => openNidModal(false)}
                      title="Subscriber NID & KYC Details"
                      className="text-[#0b67e5] hover:text-[#084bb0] cursor-pointer inline-flex items-center no-print"
                    >
                      <svg viewBox="0 0 26 19" className="w-[23px] h-[18px]" fill="none">
                        <rect x="1" y="1" width="24" height="17" rx="1.8" fill="currentColor" />
                        <circle cx="7.5" cy="7.5" r="2.3" fill="#ffffff" />
                        <path d="M3.8 14.5c0-2 1.7-3.4 3.7-3.4s3.7 1.4 3.7 3.4H3.8z" fill="#ffffff" />
                        <rect x="13.5" y="5" width="8.5" height="1.8" fill="#ffffff" />
                        <rect x="13.5" y="8.8" width="8.5" height="1.8" fill="#ffffff" />
                        <rect x="13.5" y="12.6" width="6" height="1.8" fill="#ffffff" />
                      </svg>
                    </button>
                    <span className="text-[#888888] text-[12px] select-none no-print">|</span>
                  </div>
                </td>
              </tr>

              {/* SECTION 4 HEADER: OTHERS */}
              <tr className="border-b border-[#666666]">
                <th
                  colSpan={3}
                  className="bg-[#ade6d8] text-[#111111] font-semibold text-[13px] text-center py-[5px] px-3 tracking-[0.01em] uppercase"
                >
                  OTHERS
                </th>
              </tr>

              {/* Row 17: Online Session Details */}
              <tr className="bg-white border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-bold text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  Online Session Details:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <button
                    type="button"
                    onClick={() => setActiveActionModal('session_logs')}
                    title="Click to inspect Live PPPoE Session & CoA Controls"
                    className="inline-flex items-center gap-2 cursor-pointer text-left"
                  >
                    <svg viewBox="0 0 20 24" className="w-[16px] h-[19px] shrink-0" fill="none">
                      <path
                        d="M10 1.5C6.1 1.5 3 4.5 3 8.3c0 2.4 1.2 4.5 3.1 5.7.6.4 1 1.1 1 1.8v1.2h5.8v-1.2c0-.7.4-1.4 1-1.8 1.9-1.2 3.1-3.3 3.1-5.7 0-3.8-3.1-6.8-7-6.8z"
                        fill={c.isOnline ? '#fbbf24' : '#d4d4d4'}
                      />
                      <rect x="7.2" y="18" width="5.6" height="1.8" rx="0.6" fill={c.isOnline ? '#b45309' : '#b8b8b8'} />
                      <rect x="7.8" y="20.4" width="4.4" height="1.8" rx="0.6" fill={c.isOnline ? '#92400e' : '#b8b8b8'} />
                    </svg>
                    {c.isOnline && (
                      <span className="text-[12px] text-[#008000] font-semibold">
                        Connected ({c.ipAddress || 'Dynamic'} · {c.macAddress || 'PPPoE'})
                      </span>
                    )}
                  </button>
                </td>
              </tr>

              {/* Row 18: Last Logged Out (Exact 2-Line Stack + Blue Square List Button matching userinfo.png) */}
              <tr className="bg-[#f1f1f1] border-b border-[#888888]">
                <td className="pr-2.5 pl-2 py-[6px] text-right font-bold text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  Last Logged Out
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <div className="font-bold text-[#222222] leading-snug">{logoutDisplay.primary}</div>
                  <div className="inline-flex items-center gap-1.5 mt-0.5">
                    <span className="text-[#222222] text-[12px]">{logoutDisplay.secondary}</span>
                    <button
                      type="button"
                      onClick={() => setActiveActionModal('session_logs')}
                      title="Open PPPoE Session & NAT Activity Logs"
                      className="w-[23px] h-[20px] bg-[#0b67e5] hover:bg-[#084bb0] text-white rounded-[2px] inline-flex items-center justify-center cursor-pointer no-print"
                    >
                      <List className="w-3.5 h-3.5 stroke-[2.6]" />
                    </button>
                  </div>
                </td>
              </tr>

              {/* Row 19: Mikrotik */}
              <tr className="bg-white">
                <td className="pr-2.5 pl-2 py-[5px] text-right font-normal text-[#222222] border-r border-[#888888] whitespace-nowrap align-middle">
                  Mikrotik:
                </td>
                <td colSpan={2} className="px-2.5 py-[5px] align-middle">
                  <button
                    type="button"
                    onClick={openRouterModal}
                    title="Click to configure NAS Router or sync PPPoE Secret"
                    className="text-[#222222] hover:underline cursor-pointer text-left"
                  >
                    {c.routerName}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Printable Money Receipt Modal */}
        {receiptPreview && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-500 max-w-lg w-full rounded-[3px] overflow-hidden shadow-xl text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Money Receipt — {brandName}</h3>
                <button type="button" onClick={() => setReceiptPreview(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3.5">
                <div className="flex justify-between border-b border-slate-300 pb-3">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">{brandName}</div>
                    <div className="text-slate-600">{settings?.address}</div>
                    <div className="text-slate-500 font-mono">Phone: {settings?.phone}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-[#0066cc]">{receiptPreview.trxNumber}</div>
                    <div className="text-slate-500">{receiptPreview.paymentDate}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-[#f8f9fa] p-3 border border-slate-300">
                  <div>
                    <span className="text-slate-500 block">Subscriber</span>
                    <strong>{receiptPreview.customerName}</strong> ({receiptPreview.customerUsername})
                  </div>
                  <div>
                    <span className="text-slate-500 block">Payment Channel</span>
                    <strong>{receiptPreview.method}</strong> ({receiptPreview.channel})
                  </div>
                  <div>
                    <span className="text-slate-500 block">Validity Extended</span>
                    <span className="font-mono">
                      {receiptPreview.oldExpiry || 'N/A'} &rarr; {receiptPreview.newExpiry || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Received By</span>
                    <span className="font-mono">{formatBrandName(receiptPreview.receivedBy)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-y border-slate-300 py-2.5 text-sm font-bold">
                  <span>Total Paid Amount</span>
                  <span className="font-mono tabular-nums text-[#15803d]">
                    BDT {receiptPreview.amount.toLocaleString()}
                  </span>
                </div>
                <div className="text-slate-600">Remarks: {receiptPreview.remarks || 'Paid in full'}</div>
                <div className="flex justify-end gap-2 pt-2 no-print">
                  <button type="button" onClick={() => setReceiptPreview(null)} className="maxim-classic-btn">
                    Close
                  </button>
                  <button type="button" onClick={() => window.print()} className="maxim-btn-primary">
                    <Printer className="w-3.5 h-3.5" /> Print Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Switch Customer Popup (⇄ Button next to CUSTOMER ID) */}
        {activeActionModal === 'switch_customer' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-md overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Switch Subscriber Single View</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = visibleCustomers.findIndex((item) => item.id === c.id);
                      const prev = visibleCustomers[(idx - 1 + visibleCustomers.length) % visibleCustomers.length];
                      if (prev) setSelectedCustomerId(prev.id);
                      setActiveActionModal(null);
                    }}
                    className="maxim-classic-btn flex-1 py-1.5"
                  >
                    &larr; Previous Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = visibleCustomers.findIndex((item) => item.id === c.id);
                      const next = visibleCustomers[(idx + 1) % visibleCustomers.length];
                      if (next) setSelectedCustomerId(next.id);
                      setActiveActionModal(null);
                    }}
                    className="maxim-classic-btn flex-1 py-1.5"
                  >
                    Next Customer &rarr;
                  </button>
                </div>

                <input
                  type="text"
                  autoFocus
                  placeholder="Search by Customer ID, Login ID, Name or Contact..."
                  value={modalInputA}
                  onChange={(e) => setModalInputA(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-400"
                />

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 border border-slate-300">
                  {visibleCustomers
                    .filter((item) => {
                      const q = modalInputA.trim().toLowerCase();
                      return (
                        !q ||
                        item.custId.toLowerCase().includes(q) ||
                        item.username.toLowerCase().includes(q) ||
                        item.name.toLowerCase().includes(q) ||
                        item.mobile.includes(q)
                      );
                    })
                    .slice(0, 20)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(item.id);
                          setActiveActionModal(null);
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-amber-50 cursor-pointer ${
                          item.id === c.id ? 'bg-[#ade6d8]/35 font-bold' : ''
                        }`}
                      >
                        <span>
                          <span className="font-mono font-bold mr-2">{item.custId}</span>
                          <span className="text-[#008000] font-bold">{item.username}</span>
                          <span className="text-slate-600 ml-1.5">({item.name})</span>
                        </span>
                        <span className="font-mono tabular-nums text-slate-600">{item.packageName}</span>
                      </button>
                    ))}
                </div>

                <div className="flex justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionModal(null);
                      setActiveModule('customers_list');
                    }}
                    className="maxim-classic-btn"
                  >
                    Back to Customer List
                  </button>
                  <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* OFFICIAL CONNECTION LINK INFO POPUP (Exact linkinfo.png)        */}
        {/* =============================================================== */}
        {activeActionModal === 'link_info' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] shadow-xl border border-slate-400 w-full max-w-[360px] overflow-hidden">
              <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-slate-800">Connection Link Info</h3>
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4">
                {!linkEditMode ? (
                  <div className="border border-slate-200 p-4 text-center space-y-1 text-[12.5px] text-slate-800">
                    <div>
                      <span className="font-bold">Fiber Optic :</span>
                      <span>{c.fiberLength}</span>
                    </div>
                    <div>
                      <span className="font-bold">CPE: </span>
                      <span>{c.cpeModel}</span>
                    </div>
                    <div>
                      <span className="font-bold">OLT Port No: </span>
                      <span>{c.oltPort},</span>
                    </div>
                    <div className="pt-0.5">
                      <span className="font-bold">Remarks: </span>
                      <span>{c.linkRemarks || 'Direct FTTH'}</span>{' '}
                      <button
                        type="button"
                        onClick={() => setLinkEditMode(true)}
                        className="maxim-userinfo-btn ml-1 px-2.5"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-300 p-3.5 space-y-2.5 text-xs">
                    <div>
                      <label className="block font-bold mb-1">Fiber Optic Length</label>
                      <input
                        type="text"
                        value={modalInputA}
                        onChange={(e) => setModalInputA(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">CPE / GPON ONU</label>
                      <input
                        type="text"
                        value={modalInputB}
                        onChange={(e) => setModalInputB(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">OLT Port No</label>
                      <input
                        type="text"
                        value={modalInputC}
                        onChange={(e) => setModalInputC(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">Remarks</label>
                      <input
                        type="text"
                        value={modalInputD}
                        onChange={(e) => setModalInputD(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-400"
                      />
                    </div>
                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!user) return;
                          await updateCustomer(c.id, {
                            fiberLength: modalInputA,
                            cpeModel: modalInputB,
                            oltPort: modalInputC,
                            linkRemarks: modalInputD,
                          });
                          await logAuditEvent(
                            user.uid,
                            operator.username,
                            'Updated Connection Link Info',
                            `Updated FTTH link (${modalInputA}, ${modalInputB}, Port ${modalInputC}) for ${c.username}`,
                            c.username,
                            c.popName
                          );
                          setLinkEditMode(false);
                          notify('Updated Connection Link Info.', 'success');
                        }}
                        className="maxim-btn-success"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setLinkEditMode(false)}
                        className="maxim-userinfo-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="px-3.5 py-1.5 bg-[#6c757d] hover:bg-[#5a6268] text-white text-xs font-semibold rounded-[3px] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action 1: Change Password */}
        {activeActionModal === 'password' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-sm overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Change Password ({c.username})</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <label className="block font-bold text-slate-700">New PPPoE &amp; Portal Password</label>
                <input
                  type="text"
                  value={modalInputA}
                  onChange={(e) => setModalInputA(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-400 font-mono"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!modalInputA.trim() || !user) return;
                      await updateCustomer(c.id, { password: modalInputA.trim() });
                      await logAuditEvent(
                        user.uid,
                        operator.username,
                        'Changed Subscriber Password',
                        `Updated PPPoE secret & portal password for ${c.username}`,
                        c.username,
                        c.popName
                      );
                      notify(`Updated PPPoE secret & portal password for ${c.username}.`, 'success');
                      setActiveActionModal(null);
                    }}
                    className="maxim-btn-success"
                  >
                    Save Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action 2: Single Recharge / Renew */}
        {activeActionModal === 'recharge' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-sm overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Recharge Customer ({c.username})</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="p-2 bg-[#f8f9fa] border border-slate-300 flex justify-between font-mono">
                  <span className="text-slate-600">{c.packageName}</span>
                  <span className="font-bold text-slate-900">৳{c.monthlyRate}/mo</span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bill For</label>
                  <select
                    value={modalInputA}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      setModalInputA(e.target.value);
                      setModalInputB(String(c.monthlyRate * m));
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-400 bg-white"
                  >
                    <option value="1">1 Month</option>
                    <option value="2">2 Months</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={modalInputC || 'CASH'}
                    onChange={(e) => setModalInputC(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-400 bg-white"
                  >
                    <option value="CASH">CASH</option>
                    <option value="bKash Sync">bKash Sync</option>
                    <option value="Rocket Sync">Rocket Sync</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount Received (BDT)</label>
                  <input
                    type="number"
                    value={modalInputB}
                    onChange={(e) => setModalInputB(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-500 font-mono tabular-nums bg-[#ffff66] font-bold text-right"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      if (!operator.canCollectCash) {
                        notify('Your operator role does not permit Cash / Recharge collection.', 'error');
                        return;
                      }
                      const months = Number(modalInputA) || 1;
                      const paid = Number(modalInputB) || 0;
                      const chosenMethod = (modalInputC || 'CASH') as 'CASH' | 'bKash Sync' | 'Rocket Sync' | 'Bank';
                      const charge = c.category === 'Free' ? 0 : c.monthlyRate * months;
                      const nextExp = addMonthsToDateStr(c.expiryDate, months);
                      const nextBal = computeSubscriberBalanceAfterPayment(c.balance, paid, charge, months);
                      await createPaymentRecord(user.uid, {
                        trxNumber: `RCH-${Date.now().toString(36).toUpperCase()}`,
                        targetType: 'Home',
                        customerId: c.id,
                        customerUsername: c.username,
                        customerName: c.name,
                        amount: paid,
                        chargeAmount: charge,
                        billForMonths: months,
                        method: chosenMethod,
                        channel: `${chosenMethod} (${operator.username})`,
                        receivedBy: operator.username,
                        syncSource: 'Single View Recharge',
                        senderMobile: c.mobile,
                        status: 'Completed',
                        remarks: `Renewed ${months} month(s) on ${c.packageName}`,
                        oldExpiry: c.expiryDate,
                        newExpiry: nextExp,
                        paymentDate: formatShortDateTime(),
                      });
                      await updateCustomer(c.id, {
                        balance: nextBal,
                        expiryDate: nextExp,
                        lockStatus: 'Unlocked',
                        accountStatus: 'Active',
                        isOnline: true,
                      });
                      if (c.lockStatus === 'Locked') {
                        await invokeMikrotikApi({
                          action: 'unlock',
                          username: c.username,
                          packageName: c.packageName,
                          routerName: c.routerName,
                        });
                      }
                      await logAuditEvent(
                        user.uid,
                        operator.username,
                        'Subscriber Recharged',
                        `Renewed ${c.username} (${months}m) for BDT ${paid} -> Expiry ${nextExp}`,
                        c.username,
                        c.popName
                      );
                      notify(`Recharged ${c.username} until ${formatMaximShortDate(nextExp)} (Balance: ${nextBal.toFixed(2)}).`, 'success');
                      setActiveActionModal(null);
                    }}
                    className="maxim-btn-success"
                  >
                    Confirm Recharge
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action 3: Change Package & Queue */}
        {activeActionModal === 'package' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-sm overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Change Package &amp; Queue</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Bandwidth Package</label>
                  <select value={modalInputA} onChange={(e) => setModalInputA(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-400 bg-white">
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ৳{p.monthlyRate}/mo
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mikrotik Queue Profile</label>
                  <input type="text" value={modalInputB} onChange={(e) => setModalInputB(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-400 font-mono" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      if (!operator.canEditPackage) {
                        notify('Your operator role does not permit Package / Queue changes.', 'error');
                        return;
                      }
                      const pkg = packages.find((p) => p.id === modalInputA);
                      if (!pkg) return;
                      await invokeMikrotikApi({
                        action: 'change_package',
                        username: c.username,
                        packageName: pkg.name,
                        routerName: c.routerName,
                      });
                      await updateCustomer(c.id, {
                        packageId: pkg.id,
                        packageName: pkg.name,
                        monthlyRate: c.category === 'Free' ? 0 : pkg.monthlyRate,
                        mikrotikQueue: modalInputB || pkg.mikrotikQueue || 'Package Default',
                      });
                      await logAuditEvent(
                        user.uid,
                        operator.username,
                        'Changed Subscriber Package',
                        `Updated ${c.username} package to ${pkg.name} (Queue: ${modalInputB || 'Package Default'})`,
                        c.username,
                        c.popName
                      );
                      notify(`Changed ${c.username} package to ${pkg.name} on ${c.routerName}.`, 'success');
                      setActiveActionModal(null);
                    }}
                    className="maxim-btn-primary"
                  >
                    Apply Package
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action 4: Customer Ledger Modal */}
        {activeActionModal === 'ledger' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-2xl overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  Payment &amp; Billing Ledger — {c.username} ({c.custId}) · Balance:{' '}
                  <span className={c.balance < 0 ? 'text-red-600' : 'text-[#15803d]'}>{c.balance.toFixed(2)}</span>
                </h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                {custPayments.length === 0 ? (
                  <p className="text-slate-500 text-center py-6">No payment entries recorded yet for this subscriber.</p>
                ) : (
                  <table className="w-full text-left border-collapse border border-slate-300">
                    <thead className="maxim-amber-thead">
                      <tr>
                        <th>Date</th>
                        <th>Trx #</th>
                        <th>Method</th>
                        <th className="text-right">Charge</th>
                        <th className="text-right">Paid</th>
                        <th>New Expiry</th>
                        <th className="text-center">Print</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {custPayments.map((pm) => (
                        <tr key={pm.id}>
                          <td className="px-2.5 py-1.5 font-mono">{pm.paymentDate}</td>
                          <td className="px-2.5 py-1.5 font-mono font-bold">{pm.trxNumber}</td>
                          <td className="px-2.5 py-1.5">{pm.method}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">৳{pm.chargeAmount}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono tabular-nums font-bold text-[#15803d]">৳{pm.amount}</td>
                          <td className="px-2.5 py-1.5 font-mono">{formatMaximShortDate(pm.newExpiry)}</td>
                          <td className="px-2.5 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionModal(null);
                                setReceiptPreview(pm);
                              }}
                              className="maxim-userinfo-btn"
                            >
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="px-4 py-2.5 bg-[#f8f9fa] border-t border-slate-300 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => openPaymentModal()}
                  className="maxim-btn-success"
                >
                  + Receive Payment
                </button>
                <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action 5: Add Payment / Receive Due */}
        {activeActionModal === 'payment' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-sm overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Add Payment ({c.username})</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount Received (BDT)</label>
                  <input
                    type="number"
                    value={modalInputA}
                    onChange={(e) => setModalInputA(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-500 bg-[#ffff66] font-mono tabular-nums font-bold text-right"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Channel</label>
                  <select value={modalInputB} onChange={(e) => setModalInputB(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-400 bg-white">
                    <option value="CASH">CASH</option>
                    <option value="bKash Sync">bKash Sync</option>
                    <option value="Rocket Sync">Rocket Sync</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={modalInputC}
                    onChange={(e) => setModalInputC(e.target.value)}
                    placeholder="Due clearance receipt"
                    className="w-full px-2.5 py-1.5 border border-slate-400"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      if (!operator.canCollectCash) {
                        notify('Your operator role does not permit Cash / Payment collection.', 'error');
                        return;
                      }
                      const amt = Number(modalInputA) || 0;
                      if (amt <= 0) return;
                      const nextBal = computeSubscriberBalanceAfterPayment(c.balance, amt, 0, 0);
                      await createPaymentRecord(user.uid, {
                        trxNumber: `PAY-${Date.now().toString(36).toUpperCase()}`,
                        targetType: 'Home',
                        customerId: c.id,
                        customerUsername: c.username,
                        customerName: c.name,
                        amount: amt,
                        chargeAmount: 0,
                        billForMonths: 0,
                        method: modalInputB as 'CASH' | 'bKash Sync' | 'Rocket Sync' | 'Bank',
                        channel: modalInputB,
                        receivedBy: operator.username,
                        syncSource: 'Single View Payment',
                        senderMobile: c.mobile,
                        status: 'Completed',
                        remarks: modalInputC || 'Due payment added',
                        oldExpiry: c.expiryDate,
                        newExpiry: c.expiryDate,
                        paymentDate: formatShortDateTime(),
                      });
                      await updateCustomer(c.id, {
                        balance: nextBal,
                        lockStatus: nextBal >= 0 ? 'Unlocked' : c.lockStatus,
                      });
                      await logAuditEvent(
                        user.uid,
                        operator.username,
                        'Payment Collected',
                        `Credited BDT ${amt} (${modalInputB}) to ${c.username} -> Balance ${nextBal.toFixed(2)}`,
                        c.username,
                        c.popName
                      );
                      notify(`Credited BDT ${amt} to ${c.username}. New balance: ${nextBal.toFixed(2)}`, 'success');
                      setActiveActionModal(null);
                    }}
                    className="maxim-btn-success"
                  >
                    Save Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action 6: Change Expiry & Bill Cycle */}
        {activeActionModal === 'expiry' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-sm overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Change Expiry &amp; Billing Cycle</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expiry Date</label>
                  <input type="date" value={modalInputA} onChange={(e) => setModalInputA(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-400 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bill Cycle</label>
                  <select value={modalInputB} onChange={(e) => setModalInputB(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-400 bg-white">
                    <option value="Day of 1">Day of 1</option>
                    <option value="Day of 5">Day of 5</option>
                    <option value="Day of 10">Day of 10</option>
                    <option value="Day of 15">Day of 15</option>
                    <option value="Monthly Dynamic">Monthly Dynamic</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      await updateCustomer(c.id, {
                        expiryDate: modalInputA || c.expiryDate,
                        billingCycle: modalInputB || c.billingCycle,
                        accountStatus: 'Active',
                      });
                      await logAuditEvent(
                        user.uid,
                        operator.username,
                        'Updated Expiry / Bill Cycle',
                        `Changed ${c.username} expiry=${modalInputA || c.expiryDate}, cycle=${modalInputB || c.billingCycle}`,
                        c.username,
                        c.popName
                      );
                      notify(`Updated expiry date to ${formatMaximShortDate(modalInputA || c.expiryDate)} (${modalInputB}).`, 'success');
                      setActiveActionModal(null);
                    }}
                    className="maxim-btn-primary"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action 7: Bind MAC / Disconnect Session */}
        {activeActionModal === 'mac_disconnect' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-sm overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">MAC Address &amp; Session Control</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Caller-ID MAC Address (blank = clear bind)</label>
                  <input
                    type="text"
                    value={modalInputA}
                    onChange={(e) => setModalInputA(e.target.value)}
                    placeholder="AC:84:C6:82:9F:10"
                    className="w-full px-2.5 py-1.5 border border-slate-400 font-mono"
                  />
                </div>
                <div className="flex flex-wrap justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      if (operator.mode === 'STAFF' && !operator.canManageRouter) {
                        notify('Your staff role does not have NAS CoA Disconnect permission.', 'error');
                        return;
                      }
                      await invokeMikrotikApi({ action: 'disconnect', username: c.username, routerName: c.routerName });
                      const stamp = `${formatMaximShortDate(new Date().toISOString().slice(0, 10))} ${new Date().toTimeString().slice(0, 5)}`;
                      await updateCustomer(c.id, {
                        isOnline: false,
                        lastLogout: `Just now (Admin CoA) · ${stamp}`,
                      });
                      await logAuditEvent(
                        user.uid,
                        operator.username,
                        'PPPoE CoA Disconnect',
                        `Sent CoA Disconnect for ${c.username} on ${c.routerName}`,
                        c.username,
                        c.popName
                      );
                      notify(`Sent RADIUS CoA Disconnect to ${c.routerName} for ${c.username}.`, 'info');
                      setActiveActionModal(null);
                    }}
                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-[3px] cursor-pointer"
                  >
                    Kick Active Session
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user) return;
                        if (operator.mode === 'STAFF' && !operator.canManageRouter) {
                          notify('Your staff role does not have NAS MAC Binding permission.', 'error');
                          return;
                        }
                        await invokeMikrotikApi({ action: 'bind_mac', username: c.username, macAddress: modalInputA.trim(), routerName: c.routerName });
                        await updateCustomer(c.id, { macAddress: modalInputA.trim() });
                        await logAuditEvent(
                          user.uid,
                          operator.username,
                          'Updated MAC Binding',
                          `Set Caller-ID MAC="${modalInputA.trim() || 'Cleared'}" for ${c.username}`,
                          c.username,
                          c.popName
                        );
                        notify('Saved Caller-ID MAC binding on RouterOS.', 'success');
                        setActiveActionModal(null);
                      }}
                      className="maxim-btn-primary"
                    >
                      Save MAC
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action 8: Subscriber Support Tickets & Quick Create Ticket Modal */}
        {activeActionModal === 'tickets_modal' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-xl overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Support Tickets — {c.username} ({c.custId})
                </h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
                <div className="border border-slate-300 p-3 bg-[#f8f9fa] space-y-2.5">
                  <div className="font-bold text-slate-800 uppercase">Create New Ticket for {c.username}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Issue Type</label>
                      <select
                        value={modalInputA}
                        onChange={(e) => setModalInputA(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-400 bg-white"
                      >
                        <option value="No Internet / LOS Red Light">No Internet / LOS Red Light</option>
                        <option value="Slow Speed / High Ping">Slow Speed / High Ping</option>
                        <option value="ONU / Router Config">ONU / Router Config</option>
                        <option value="Fiber Cut / Line Shift">Fiber Cut / Line Shift</option>
                        <option value="Billing / Recharge Query">Billing / Recharge Query</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Assign Staff</label>
                      <select
                        value={modalInputB}
                        onChange={(e) => setModalInputB(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-400 bg-white"
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.username}>
                            {emp.username} ({emp.role})
                          </option>
                        ))}
                        <option value={operator.username}>{operator.username}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                      <select
                        value={modalInputC}
                        onChange={(e) => setModalInputC(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-400 bg-white"
                      >
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Problem Description</label>
                    <input
                      type="text"
                      value={modalInputD}
                      onChange={(e) => setModalInputD(e.target.value)}
                      placeholder="Describe ONU / Fiber / PPPoE issue..."
                      className="w-full px-2.5 py-1.5 border border-slate-400 bg-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionModal(null);
                        setActiveModule('tickets_create');
                      }}
                      className="maxim-classic-btn"
                    >
                      Full Create Ticket Form
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user) return;
                        const tktNo = String(Math.floor(6500 + Math.random() * 3000));
                        await createSupportTicket(user.uid, {
                          ticketNo: tktNo,
                          customerId: c.id,
                          customerUsername: c.username,
                          customerName: c.name,
                          contact: c.mobile,
                          email: c.email,
                          popName: c.popName,
                          address: c.address,
                          customerBalance: c.balance,
                          customerExpiry: c.expiryDate,
                          lockStatus: c.lockStatus,
                          issueType: modalInputA || 'Connection Problem',
                          description: modalInputD.trim() || `${modalInputA} reported from Single View`,
                          assignedTo: modalInputB || operator.username,
                          createdBy: operator.username,
                          status: 'Open',
                          priority: (modalInputC as 'Normal' | 'High' | 'Critical') || 'Normal',
                          lastComment: 'Opened from Customer Single View',
                          smsSentCustomer: true,
                          smsSentStaff: true,
                        });
                        await logAuditEvent(
                          user.uid,
                          operator.username,
                          'Created Support Ticket',
                          `Opened Ticket #${tktNo} (${modalInputA}) for ${c.username}`,
                          c.username,
                          c.popName
                        );
                        setModalInputD('');
                        notify(`Created Ticket #${tktNo} for ${c.username}.`, 'success');
                      }}
                      className="maxim-btn-primary"
                    >
                      Save Ticket
                    </button>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-800 mb-1.5">
                    Existing Subscriber Tickets ({custTickets.length})
                  </div>
                  {custTickets.length === 0 ? (
                    <div className="p-3 border border-slate-200 text-center text-slate-500">
                      No tickets recorded for {c.username}.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse border border-slate-300">
                      <thead className="maxim-amber-thead">
                        <tr>
                          <th>TKT #</th>
                          <th>Issue Type</th>
                          <th>Assigned</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {custTickets.map((t) => (
                          <tr key={t.id}>
                            <td className="px-2.5 py-1.5 font-mono font-bold">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionModal(null);
                                  setActiveModule('tickets_list');
                                }}
                                className="text-[#0b67e5] hover:underline cursor-pointer"
                              >
                                {t.ticketNo}
                              </button>
                            </td>
                            <td className="px-2.5 py-1.5">{t.issueType}</td>
                            <td className="px-2.5 py-1.5 font-mono">{t.assignedTo}</td>
                            <td className="px-2.5 py-1.5 font-bold">
                              <span className={t.status === 'Open' ? 'text-red-600' : 'text-[#008000]'}>
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOCATION Edit Modal (SDT/ZONE NAME, POP, ADDRESS) */}
        {activeActionModal === 'location_edit' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-md overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Update Subscriber Location ({c.username})</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SDT / Reseller Assignment</label>
                  <select
                    value={modalInputD}
                    onChange={(e) => {
                      const nextResId = e.target.value;
                      setModalInputD(nextResId);
                      const foundRes = resellers.find((r) => r.id === nextResId);
                      setModalInputA(foundRes ? foundRes.username : brandName);
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-400 bg-white"
                  >
                    <option value="">{brandName} (Direct Company Zone)</option>
                    {resellers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.username} — {r.companyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SDT / Zone Name</label>
                  <input
                    type="text"
                    value={modalInputA}
                    onChange={(e) => setModalInputA(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">POP</label>
                  <select
                    value={modalInputB}
                    onChange={(e) => setModalInputB(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-400 bg-white"
                  >
                    {pops.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={modalInputC}
                    onChange={(e) => setModalInputC(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-400"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      await updateCustomer(c.id, {
                        zoneName: modalInputA.trim() || brandName,
                        popName: modalInputB || c.popName,
                        address: modalInputC.trim() || c.address,
                        resellerId: modalInputD,
                      });
                      await logAuditEvent(
                        user.uid,
                        operator.username,
                        'Updated Subscriber Location',
                        `Updated POP=${modalInputB}, Zone=${modalInputA}, Address="${modalInputC}" for ${c.username}`,
                        c.username,
                        modalInputB || c.popName
                      );
                      notify(`Updated location details for ${c.username}.`, 'success');
                      setActiveActionModal(null);
                    }}
                    className="maxim-btn-success"
                  >
                    Save Location
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NID & Subscriber KYC Form Modal */}
        {activeActionModal === 'nid_form' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-lg overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  {nidPrintMode
                    ? `${brandName} — BTRC Subscriber KYC Form`
                    : `${brandName} — Subscriber Photo & NID Verification`}
                </h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4 border-b border-slate-300 pb-4">
                  <img
                    src={(modalInputB || c.avatarType) === 'female' ? femaleAvatarImg : maleAvatarImg}
                    alt={c.name}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 object-cover border border-slate-400"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">{c.name}</p>
                    <p className="font-mono text-slate-700">
                      Customer ID: <strong>{c.custId}</strong> · Login: <strong>{c.username}</strong>
                    </p>
                    <p className="font-mono text-slate-700">
                      NID No: <strong>{modalInputA || c.nidNumber || '1990269000111'}</strong>
                    </p>
                    <p className="text-[#008000] font-bold">
                      Mobile OTP KYC: {(modalInputC || (c.mobileVerified ? 'yes' : 'no')) === 'yes' ? 'Verified' : 'Pending OTP'}
                    </p>
                  </div>
                </div>

                {!nidPrintMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">National ID (NID)</label>
                      <input
                        type="text"
                        value={modalInputA}
                        onChange={(e) => setModalInputA(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Subscriber Photo</label>
                      <select
                        value={modalInputB}
                        onChange={(e) => setModalInputB(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-400 bg-white"
                      >
                        <option value="male">Male Portrait</option>
                        <option value="female">Female Portrait</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">OTP KYC Status</label>
                      <select
                        value={modalInputC}
                        onChange={(e) => setModalInputC(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-400 bg-white"
                      >
                        <option value="yes">Verified</option>
                        <option value="no">Pending OTP</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 text-slate-800">
                    <p>
                      <strong>POP / Zone:</strong> {c.popName} ({sdtOrZoneLabel})
                    </p>
                    <p>
                      <strong>Package:</strong> {c.packageName} (BDT {c.monthlyRate})
                    </p>
                    <p>
                      <strong>ONU / CPE:</strong> {c.cpeModel}
                    </p>
                    <p>
                      <strong>OLT Port / Fiber:</strong> Port {c.oltPort} ({c.fiberLength})
                    </p>
                    <p className="col-span-2">
                      <strong>Address:</strong> {c.address}
                    </p>
                  </div>
                )}

                <div className="pt-2 flex justify-between items-center gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => setNidPrintMode((v) => !v)}
                    className="maxim-classic-btn"
                  >
                    {nidPrintMode ? 'Switch to Edit NID / Photo' : 'Preview Printable KYC Form'}
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                      Close
                    </button>
                    {nidPrintMode ? (
                      <button type="button" onClick={() => window.print()} className="maxim-btn-primary">
                        <Printer className="w-3.5 h-3.5" /> Print KYC Form
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!user) return;
                          await updateCustomer(c.id, {
                            nidNumber: modalInputA.trim(),
                            avatarType: (modalInputB as 'male' | 'female') || 'male',
                            mobileVerified: modalInputC === 'yes',
                          });
                          notify('Saved Subscriber NID & KYC record.', 'success');
                          setActiveActionModal(null);
                        }}
                        className="maxim-btn-success"
                      >
                        Save KYC
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RADIUS Session History & Live Toggle Modal */}
        {activeActionModal === 'session_logs' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-2xl overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-slate-800">Online Session Details &amp; NAT Logs — {c.username}</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
                <div className="p-2.5 bg-[#f8f9fa] border border-slate-300 flex flex-wrap items-center justify-between gap-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                    <div>
                      <span className="text-slate-500 block">State</span>
                      <span className={`font-bold ${c.isOnline ? 'text-[#008000]' : 'text-slate-700'}`}>
                        {c.isOnline ? 'Online (PPPoE)' : 'Offline'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Framed-IP</span>
                      <span className="font-mono font-bold">{c.ipAddress || 'Dynamic'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Caller-ID MAC</span>
                      <span className="font-mono font-bold">{c.macAddress || 'Auto'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">NAS Router</span>
                      <span className="font-mono">{c.routerName}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      const nextOnline = !c.isOnline;
                      await invokeMikrotikApi({
                        action: nextOnline ? 'unlock' : 'disconnect',
                        username: c.username,
                        packageName: c.packageName,
                        routerName: c.routerName,
                      });
                      const stamp = `${formatMaximShortDate(new Date().toISOString().slice(0, 10))} ${new Date().toTimeString().slice(0, 5)}`;
                      await updateCustomer(c.id, {
                        isOnline: nextOnline,
                        lastLogout: nextOnline ? `Online Now (PPPoE) · ${stamp}` : `1 min Ago · ${stamp}`,
                      });
                      notify(
                        nextOnline
                          ? `Dialed/verified active PPPoE session for ${c.username}.`
                          : `Disconnected active PPPoE session for ${c.username}.`,
                        'info'
                      );
                    }}
                    className={c.isOnline ? 'maxim-classic-btn text-red-700 font-bold' : 'maxim-btn-success'}
                  >
                    {c.isOnline ? 'Disconnect Session' : 'Simulate / Sync Online'}
                  </button>
                </div>

                <table className="w-full text-left border-collapse border border-slate-300">
                  <thead className="maxim-amber-thead">
                    <tr>
                      <th>Timestamp</th>
                      <th>Category</th>
                      <th>Event / NAT Flow</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {custSessionLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-5 text-center font-sans text-slate-500">
                          No recorded NAT or RADIUS events yet for <strong>{c.username}</strong>.
                        </td>
                      </tr>
                    ) : (
                      custSessionLogs.slice(0, 15).map((log) => (
                        <tr key={log.id}>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{log.timestampStr}</td>
                          <td className="px-2.5 py-1.5 font-sans font-bold text-[#0066cc]">
                            {log.logCategory === 'ip_log' ? 'NAT Flow' : 'NAS Audit'}
                          </td>
                          <td className="px-2.5 py-1.5">{log.title}</td>
                          <td className="px-2.5 py-1.5 font-sans text-slate-600">{log.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MikroTik Router Sync & Admin Record Modal */}
        {activeActionModal === 'router_sync' && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[3px] border border-slate-500 shadow-xl w-full max-w-sm overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">MikroTik NAS Assignment ({c.username})</h3>
                <button type="button" onClick={() => setActiveActionModal(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned MikroTik NAS Router</label>
                  <select
                    value={modalInputA}
                    onChange={(e) => setModalInputA(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-400 bg-white"
                  >
                    {routers.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} ({r.popName})
                      </option>
                    ))}
                  </select>
                </div>

                {operator.canDeleteRecord && (
                  <div className="pt-2 border-t border-slate-200">
                    {confirmDeleteCustomerId === c.id ? (
                      <div className="flex items-center justify-between bg-red-50 border border-red-300 p-2 rounded-[2px]">
                        <span className="text-red-700 font-bold">Permanently delete {c.username}?</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(c)}
                            className="px-2 py-0.5 bg-red-600 text-white font-bold rounded-[2px] cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCustomerId(null)}
                            className="maxim-userinfo-btn"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCustomerId(c.id)}
                        className="inline-flex items-center gap-1 text-red-600 hover:underline font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Subscriber Record
                      </button>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setActiveActionModal(null)} className="maxim-classic-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      const chosenRouter = modalInputA || c.routerName;
                      await invokeMikrotikApi({
                        action: 'add_pppoe',
                        username: c.username,
                        packageName: c.packageName,
                        ipAddress: c.ipAddress,
                        routerName: chosenRouter,
                      });
                      await updateCustomer(c.id, { routerName: chosenRouter });
                      await logAuditEvent(
                        user.uid,
                        operator.username,
                        'Synced MikroTik NAS',
                        `Synced PPPoE secret ${c.username} to ${chosenRouter}`,
                        c.username,
                        c.popName
                      );
                      notify(`Synced ${c.username} PPPoE profile on ${chosenRouter}.`, 'success');
                      setActiveActionModal(null);
                    }}
                    className="maxim-btn-primary"
                  >
                    Sync &amp; Save NAS
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
  // VIEW 4: CUSTOMER LIST (Exact Official Reference: customerlist.png)
  // =========================================================================
  const selectedObjects = visibleCustomers.filter((c) => bulkCustomerIds.includes(c.id));

  const handleBulkLockDueAccounts = async () => {
    if (!user) return;
    if (operator.mode === 'STAFF' && !operator.canManageRouter) {
      notify('Your staff role does not have NAS Bulk Lock permission.', 'error');
      return;
    }
    const dueUnlocked = filteredCustomers.filter((c) => (c.balance < 0 || c.accountStatus === 'Expired') && c.lockStatus === 'Unlocked');
    if (dueUnlocked.length === 0) {
      notify('All due/expired subscribers in current view are already locked.', 'info');
      return;
    }
    for (const sub of dueUnlocked) {
      await invokeMikrotikApi({ action: 'lock', username: sub.username, routerName: sub.routerName });
      await updateCustomer(sub.id, {
        lockStatus: 'Locked',
        accountStatus: 'Expired',
        isOnline: false,
        lastLogout: 'Auto-Locked (Due Balance)',
      });
    }
    await logAuditEvent(
      user.uid,
      operator.username,
      'Bulk Lock Due Users',
      `Locked ${dueUnlocked.length} overdue/expired PPPoE accounts`,
      'Home Users'
    );
    notify(`Locked ${dueUnlocked.length} overdue/expired PPPoE accounts.`, 'success');
  };

  const handleKickCustomerSession = async (sub: Customer) => {
    if (!user) return;
    if (operator.mode === 'STAFF' && !operator.canManageRouter) {
      notify('Your staff role does not have NAS CoA Disconnect permission.', 'error');
      return;
    }
    await invokeMikrotikApi({ action: 'disconnect', username: sub.username, routerName: sub.routerName });
    await updateCustomer(sub.id, { isOnline: false, lastLogout: 'Disconnected via CoA' });
    await logAuditEvent(
      user.uid,
      operator.username,
      'PPPoE CoA Disconnect',
      `Disconnected active PPPoE session for ${sub.username} on ${sub.routerName}`,
      sub.username,
      sub.popName
    );
    notify(`Disconnected PPPoE session for ${sub.username}.`, 'info');
  };

  const listSubLabel =
    activeModule === 'customers_online'
      ? 'Online Users'
      : activeModule === 'customers_due'
      ? 'Due & Expired List'
      : activeModule === 'customers_vip'
      ? 'Free & VIP Users'
      : 'Customer List';

  return (
    <div className="space-y-3">
      {/* MAXIM Breadcrumb Bar */}
      <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2 no-print">
        <div>
          <span className="text-[#007bff] font-semibold">Home Users</span>
          <span className="mx-1.5 text-slate-400">/</span>
          <span className="text-slate-700 font-semibold">{listSubLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeModule === 'customers_due' && (
            <button
              type="button"
              onClick={handleBulkLockDueAccounts}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-[3px] cursor-pointer"
            >
              Lock Unpaid ({filteredCustomers.filter((c) => c.lockStatus === 'Unlocked').length})
            </button>
          )}

          {activeModule === 'customers_vip' && (
            <div className="inline-flex border border-slate-400 rounded-[3px] overflow-hidden bg-white text-xs">
              {(['ALL', 'VIP', 'Free'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setVipSubFilter(cat)}
                  className={`px-2.5 py-1 font-semibold cursor-pointer ${
                    vipSubFilter === cat ? 'bg-[#007bff] text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cat === 'ALL' ? 'All VIP/Free' : cat}
                </button>
              ))}
            </div>
          )}

          {activeModule !== 'customers_list' && (
            <button
              type="button"
              onClick={() => setActiveModule('customers_list')}
              className="maxim-classic-btn"
            >
              All Customers
            </button>
          )}

          <button
            type="button"
            onClick={handleOneClickMikrotikSync}
            disabled={isSyncingMikrotik}
            className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold rounded-[3px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
            title="Connects to MikroTik 103.54.37.182:1165 to import and sync all customers in real-time"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMikrotik ? 'animate-spin' : ''}`} />
            {isSyncingMikrotik ? 'সিঙ্ক হচ্ছে...' : 'মাইক্রোটিক থেকে সব কাস্টমার আনুন (100% Real)'}
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingCustomer(null);
              setActiveModule('customers_add');
            }}
            className="maxim-btn-success"
          >
            <Plus className="w-3.5 h-3.5" /> Add Customer
          </button>
        </div>
      </div>

      {/* 100% Real MikroTik Integration Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-300 rounded p-3 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs no-print">
        <div className="flex items-center gap-2.5 text-slate-800">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-emerald-950 flex items-center gap-2">
              <span>RRR CABLE NETWORK — MikroTik RouterOS Live Connection</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-mono font-bold">
                103.54.37.182:1165 (RB750Gr3)
              </span>
            </div>
            <div className="text-slate-600 text-[11px] mt-0.5">
              রাউটারে থাকা সকল গ্রাহক (অনলাইন, অফলাইন, এক্সপায়ার, ডিজেবল) রিয়েল-টাইমে প্যানেলে যুক্ত করতে বাটনটিতে ক্লিক করুন।
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOneClickMikrotikSync}
            disabled={isSyncingMikrotik}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMikrotik ? 'animate-spin' : ''}`} />
            {isSyncingMikrotik ? 'কানেকশন ও সিঙ্ক চলছে...' : 'এক ক্লিকে সব কাস্টমার সিঙ্ক করুন (100% Real)'}
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('routers')}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded cursor-pointer"
          >
            Router Config
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* OFFICIAL MAXIM FILTER TABLE + 3 REPORT BUTTONS (customerlist.png)   */}
      {/* =================================================================== */}
      <div className="bg-[#f9f9f9] border border-slate-300 overflow-x-auto text-xs no-print">
        <table className="w-full border-collapse">
          <tbody>
            {/* Row 1: Filter Dropdowns */}
            <tr className="border-b border-slate-300">
              <td className="px-2.5 py-2 font-bold text-slate-800 border-r border-slate-300 whitespace-nowrap">
                Filter:
              </td>
              <td className="px-2.5 py-2 border-r border-slate-300 whitespace-nowrap">
                <span className="font-semibold text-slate-700 mr-1.5">Expiry/Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2 py-1 border border-slate-400 bg-white rounded-[2px]"
                >
                  <option value="ALL">ALL</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ONLINE">Online</option>
                  <option value="DUE">Due Balance</option>
                  <option value="LOCKED">Locked</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </td>
              <td className="px-2.5 py-2 border-r border-slate-300 whitespace-nowrap">
                <span className="font-semibold text-slate-700 mr-1.5">Package:</span>
                <select
                  value={filterPackage}
                  onChange={(e) => setFilterPackage(e.target.value)}
                  className="px-2 py-1 border border-slate-400 bg-white rounded-[2px]"
                >
                  <option value=""></option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2.5 py-2 border-r border-slate-300 whitespace-nowrap">
                <span className="font-semibold text-slate-700 mr-1.5">Billing Cycle:</span>
                <select
                  value={filterCycle}
                  onChange={(e) => setFilterCycle(e.target.value)}
                  className="px-2 py-1 border border-slate-400 bg-white rounded-[2px]"
                >
                  <option value=""></option>
                  <option value="Day of 1">Day of 1</option>
                  <option value="Day of 5">Day of 5</option>
                  <option value="Day of 10">Day of 10</option>
                  <option value="Day of 15">Day of 15</option>
                  <option value="Monthly Dynamic">Monthly Dynamic</option>
                </select>
              </td>
              <td className="px-2.5 py-2 border-r border-slate-300 whitespace-nowrap">
                <span className="font-semibold text-slate-700 mr-1.5">POP</span>
                <select
                  value={filterPop}
                  onChange={(e) => setFilterPop(e.target.value)}
                  className="px-2 py-1 border border-slate-400 bg-white rounded-[2px]"
                >
                  <option value=""></option>
                  {pops.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2.5 py-2 whitespace-nowrap">
                <span className="font-semibold text-slate-700 mr-1.5">Plan_Type:</span>
                <select
                  value={filterPlanType}
                  onChange={(e) => setFilterPlanType(e.target.value)}
                  className="px-2 py-1 border border-slate-400 bg-white rounded-[2px]"
                >
                  <option value=""></option>
                  <option value="Prepaid">Prepaid</option>
                  <option value="Postpaid">Postpaid</option>
                </select>
              </td>
            </tr>

            {/* Row 2: Expiry Date Range + Search Button */}
            <tr className="border-b border-slate-300">
              <td className="px-2.5 py-2 border-r border-slate-300" />
              <td colSpan={3} className="px-2.5 py-2 border-r border-slate-300 whitespace-nowrap">
                <span className="font-semibold text-slate-700 mr-1.5">Expiry Date From:</span>
                <input
                  type="date"
                  value={expiryFrom}
                  onChange={(e) => setExpiryFrom(e.target.value)}
                  className="px-2 py-0.5 border border-slate-400 bg-white font-mono mr-2"
                />
                <span className="font-semibold text-slate-700 mr-1.5">To:</span>
                <input
                  type="date"
                  value={expiryTo}
                  onChange={(e) => setExpiryTo(e.target.value)}
                  className="px-2 py-0.5 border border-slate-400 bg-white font-mono"
                />
              </td>
              <td colSpan={2} className="px-2.5 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => notify(`Showing ${filteredCustomers.length} matching customer(s).`, 'info')}
                  className="maxim-classic-btn"
                >
                  Search
                </button>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('ALL');
                      setFilterPackage('');
                      setFilterCycle('');
                      setFilterPop('');
                      setFilterPlanType('');
                      setExpiryFrom('');
                      setExpiryTo('');
                      setSearchTerm('');
                    }}
                    className="maxim-classic-btn ml-2"
                  >
                    Reset
                  </button>
                )}
              </td>
            </tr>

            {/* Row 3: 3 Official Utility Export Buttons */}
            <tr className="bg-white">
              <td colSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                <button type="button" onClick={handleDownloadDisReport} className="maxim-classic-btn">
                  DIS Report
                </button>
              </td>
              <td colSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                <button type="button" onClick={handleDownloadBillReport} className="maxim-classic-btn">
                  Download Bill Report
                </button>
              </td>
              <td colSpan={2} className="px-2.5 py-2">
                <button type="button" onClick={handleDownloadMikrotikBackup} className="maxim-classic-btn">
                  Customer Backup
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* =================================================================== */}
      {/* CENTER SELECTION CHIPS, BATCH BUTTONS & COPY/EXCEL/CSV/PDF BAR      */}
      {/* =================================================================== */}
      <div className="bg-white border border-slate-300 p-3 space-y-2.5 text-xs no-print">
        {/* Select-All Checkbox + Selected Customer Tags */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <label className="inline-flex items-center gap-1.5 cursor-pointer mr-1" title="Select / Deselect All">
            <input
              type="checkbox"
              checked={
                filteredCustomers.length > 0 &&
                filteredCustomers.slice(0, entriesLimit).every((c) => bulkCustomerIds.includes(c.id))
              }
              onChange={toggleSelectAllVisible}
              className="cursor-pointer"
            />
          </label>

          {selectedObjects.length > 0 ? (
            <div className="inline-flex flex-wrap items-center gap-1.5 border border-slate-300 px-2.5 py-1 bg-[#fcfcfc] min-w-[240px]">
              {selectedObjects.map((sel) => (
                <span
                  key={sel.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e9ecef] border border-slate-400 rounded-[2px] text-slate-900 font-semibold"
                >
                  <span>{sel.username}</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectCustomer(sel.id)}
                    className="text-slate-600 hover:text-red-600 font-bold cursor-pointer ml-0.5"
                  >
                    X
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="px-3 py-1 border border-slate-300 bg-[#fcfcfc] text-slate-400 min-w-[240px] text-center">
              Select customer checkbox(es) below for batch actions
            </div>
          )}
        </div>

        {/* Green 'Recharge Selected' + Blue 'Cash Rcv Entry' */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (bulkCustomerIds.length === 0 && filteredCustomers.length > 0) {
                setBulkCustomerIds(filteredCustomers.slice(0, 3).map((c) => c.id));
              }
              setActiveModule('customers_bulk_recharge');
            }}
            className="maxim-btn-success px-3.5 py-1.5"
          >
            Recharge Selected
          </button>
          <button
            type="button"
            onClick={() => openCashRcvModal(selectedObjects[0]?.username || '')}
            className="maxim-btn-primary px-3.5 py-1.5"
          >
            Cash Rcv Entry
          </button>
        </div>

        {/* Copy | Excel | CSV | PDF Button Group */}
        <div className="flex items-center justify-center">
          <div className="inline-flex border border-slate-400 rounded-[3px] overflow-hidden divide-x divide-slate-400 bg-[#f8f9fa]">
            <button
              type="button"
              onClick={handleCopyTable}
              className="px-3 py-1 hover:bg-slate-200 font-semibold text-slate-800 cursor-pointer"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="px-3 py-1 hover:bg-slate-200 font-semibold text-slate-800 cursor-pointer"
            >
              Excel
            </button>
            <button
              type="button"
              onClick={handleDownloadBillReport}
              className="px-3 py-1 hover:bg-slate-200 font-semibold text-slate-800 cursor-pointer"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1 hover:bg-slate-200 font-semibold text-slate-800 cursor-pointer"
            >
              PDF
            </button>
          </div>
        </div>

        {/* DataTable Show Entries & Live Search Row */}
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span>Show</span>
            <select
              value={entriesLimit}
              onChange={(e) => setEntriesLimit(Number(e.target.value))}
              className="px-2 py-1 border border-slate-400 bg-white rounded-[2px] font-mono"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-slate-700 font-medium">Search:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2.5 py-1 border border-slate-400 rounded-[2px] bg-white w-48 sm:w-60"
            />
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* GOLD-HEADER 11-COLUMN CUSTOMER LIST TABLE (customerlist.png)        */}
      {/* =================================================================== */}
      <div className="bg-white border border-slate-400 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="maxim-amber-thead">
            <tr>
              <th>SN</th>
              <th>Customer ID</th>
              <th>Username</th>
              <th>Name</th>
              <th>Package</th>
              <th className="text-right">Balance</th>
              <th>Billing Cycle</th>
              <th>Expiry Date</th>
              <th>Mobile</th>
              <th>Address</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  No matching records found.{' '}
                  <button
                    type="button"
                    onClick={() => setActiveModule('customers_add')}
                    className="text-[#007bff] font-semibold hover:underline cursor-pointer ml-1"
                  >
                    + Add Customer
                  </button>
                </td>
              </tr>
            ) : (
              filteredCustomers.slice(0, entriesLimit).map((c, idx) => {
                const isSelected = bulkCustomerIds.includes(c.id);
                const isExpanded = expandedRowIds.includes(c.id);
                return (
                  <React.Fragment key={c.id}>
                    <tr
                      className={`border-b border-slate-300 hover:bg-amber-50/40 ${
                        isSelected ? 'bg-sky-50/60' : idx % 2 === 1 ? 'bg-[#f9fafb]' : 'bg-white'
                      }`}
                    >
                      {/* 1. SN + Green Circle Expand Button */}
                      <td className="px-2 py-2 border-r border-slate-200 whitespace-nowrap font-mono">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRowIds((prev) =>
                                prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                              )
                            }
                            title="Quick Actions & Fiber Info"
                            className="w-4 h-4 rounded-full bg-[#28a745] hover:bg-[#218838] text-white inline-flex items-center justify-center cursor-pointer shrink-0 no-print"
                          >
                            {isExpanded ? <Minus className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                          </button>
                          <span>{idx + 1}</span>
                        </div>
                      </td>

                      {/* 2. Customer ID: Checkbox + ID + Zoom Magnifier -> Single View */}
                      <td className="px-2 py-2 border-r border-slate-200 whitespace-nowrap font-mono">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectCustomer(c.id)}
                            className="cursor-pointer no-print"
                          />
                          <button
                            type="button"
                            onClick={() => openCustomerSingleView(c.id)}
                            className="font-semibold text-slate-900 hover:text-[#0066cc] hover:underline cursor-pointer"
                          >
                            {c.custId}
                          </button>
                          <button
                            type="button"
                            onClick={() => openCustomerSingleView(c.id)}
                            title="Open Customer Single View"
                            className="text-slate-600 hover:text-[#0066cc] cursor-pointer no-print"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 3. Username: Lock/Unlock Icon + Username + Online Lightbulb */}
                      <td className="px-2 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRowToggleLock(c)}
                            title={c.lockStatus === 'Unlocked' ? 'Click to Lock PPPoE' : 'Click to Unlock PPPoE'}
                            className="cursor-pointer shrink-0"
                          >
                            {c.lockStatus === 'Unlocked' ? (
                              <Unlock className="w-3.5 h-3.5 text-[#15803d]" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-red-600" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openCustomerSingleView(c.id)}
                            className="font-bold text-slate-900 hover:text-[#0066cc] hover:underline cursor-pointer"
                          >
                            {c.username}
                          </button>
                          {c.isOnline && (
                            <Lightbulb
                              className="w-3.5 h-3.5 text-amber-500 fill-amber-300 shrink-0"
                              aria-label="Online"
                            />
                          )}
                        </div>
                      </td>

                      {/* 4. Name + red iRef subline */}
                      <td className="px-2 py-2 border-r border-slate-200">
                        <div className="text-slate-900 font-medium">{c.name}</div>
                        {c.iRef && <div className="text-[10.5px] font-semibold text-red-600">iRef: {c.iRef}</div>}
                      </td>

                      {/* 5. Package */}
                      <td className="px-2 py-2 border-r border-slate-200 whitespace-nowrap text-slate-800">
                        {c.packageName}
                      </td>

                      {/* 6. Balance */}
                      <td
                        className={`px-2 py-2 border-r border-slate-200 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                          c.balance < 0 ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {c.balance.toFixed(2)}
                      </td>

                      {/* 7. Billing Cycle */}
                      <td className="px-2 py-2 border-r border-slate-200 whitespace-nowrap text-slate-700">
                        {c.billingCycle}
                      </td>

                      {/* 8. Expiry Date */}
                      <td className="px-2 py-2 border-r border-slate-200 whitespace-nowrap font-mono tabular-nums text-slate-800">
                        {c.expiryDate}
                      </td>

                      {/* 9. Mobile */}
                      <td className="px-2 py-2 border-r border-slate-200 whitespace-nowrap font-mono tabular-nums text-slate-800">
                        {c.mobile}
                      </td>

                      {/* 10. Address */}
                      <td className="px-2 py-2 border-r border-slate-200 text-slate-700 max-w-[200px] truncate" title={c.address}>
                        {c.address}
                      </td>

                      {/* 11. IP */}
                      <td className="px-2 py-2 whitespace-nowrap font-mono text-slate-700">
                        {c.ipAddress}
                      </td>
                    </tr>

                    {/* Expanded Row Drawer for Quick Cash / Edit / Kick / Delete */}
                    {isExpanded && (
                      <tr className="bg-[#f1f5f9] border-b border-slate-300 text-xs no-print">
                        <td colSpan={11} className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-slate-700">
                              <strong>POP:</strong> {c.popName} · <strong>NAS:</strong>{' '}
                              <span className="font-mono">{c.routerName}</span> · <strong>MAC:</strong>{' '}
                              <span className="font-mono">{c.macAddress || 'Auto'}</span> · <strong>CPE:</strong>{' '}
                              <span className="font-mono">{c.cpeModel}</span> (OLT Port {c.oltPort}, {c.fiberLength})
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openCustomerSingleView(c.id)}
                                className="maxim-btn-primary"
                              >
                                Single View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickCollectCustomer(c);
                                  setQuickCollectMonths(1);
                                  setQuickCollectAmount(String(c.monthlyRate));
                                  setQuickCollectMethod('CASH');
                                  setQuickCollectRemarks('');
                                }}
                                className="maxim-btn-success"
                              >
                                Collect / Renew
                              </button>
                              <button
                                type="button"
                                onClick={() => beginEditCustomer(c)}
                                className="maxim-classic-btn"
                              >
                                Edit
                              </button>
                              {c.isOnline && (
                                <button
                                  type="button"
                                  onClick={() => handleKickCustomerSession(c)}
                                  className="maxim-classic-btn text-amber-800"
                                >
                                  Kick PPPoE
                                </button>
                              )}
                              {operator.canDeleteRecord && (
                                confirmDeleteCustomerId === c.id ? (
                                  <span className="inline-flex items-center gap-1 bg-red-50 border border-red-300 px-2 py-0.5 rounded-[2px]">
                                    <span className="text-red-700 font-bold">Delete?</span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!user) return;
                                        await deleteDocumentByPath('customers', c.id);
                                        await logAuditEvent(
                                          user.uid,
                                          operator.username,
                                          'Delete Subscriber',
                                          `Deleted subscriber ${c.username} (#${c.custId})`,
                                          c.username,
                                          c.popName
                                        );
                                        setConfirmDeleteCustomerId(null);
                                        notify(`Deleted subscriber ${c.username}.`, 'info');
                                      }}
                                      className="px-1.5 py-0.5 bg-red-600 text-white font-bold rounded-[2px] cursor-pointer"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteCustomerId(null)}
                                      className="maxim-classic-btn"
                                    >
                                      No
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteCustomerId(c.id)}
                                    className="maxim-classic-btn text-red-600"
                                  >
                                    Delete
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Entries Footer Summary */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 px-1 no-print">
        <span>
          Showing {filteredCustomers.length === 0 ? 0 : 1} to{' '}
          {Math.min(entriesLimit, filteredCustomers.length)} of {filteredCustomers.length} entries
        </span>
        <span className="font-mono">
          Active POP Scope: <strong>{operator.allowedPops.join(', ')}</strong>
        </span>
      </div>

      {/* Fast Row Collect / Recharge Modal */}
      {quickCollectCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-500 rounded-[3px] shadow-xl w-full max-w-md overflow-hidden text-xs">
            <div className="px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Collect Bill — {quickCollectCustomer.username} ({quickCollectCustomer.custId})
              </h3>
              <button
                type="button"
                onClick={() => setQuickCollectCustomer(null)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickRowCollectSubmit} className="p-4 space-y-3">
              <div className="p-2 bg-[#f8f9fa] border border-slate-300 flex items-center justify-between">
                <span className="text-slate-600">Current Balance:</span>
                <span
                  className={`font-mono tabular-nums font-bold ${
                    quickCollectCustomer.balance < 0 ? 'text-red-600' : 'text-[#15803d]'
                  }`}
                >
                  {quickCollectCustomer.balance.toFixed(2)} (Exp: {quickCollectCustomer.expiryDate})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bill For</label>
                  <select
                    value={quickCollectMonths}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      setQuickCollectMonths(m);
                      if (m > 0) {
                        setQuickCollectAmount(String(quickCollectCustomer.monthlyRate * m));
                      } else {
                        setQuickCollectAmount(
                          String(Math.max(500, Math.abs(Math.round(quickCollectCustomer.balance)) || quickCollectCustomer.monthlyRate))
                        );
                      }
                    }}
                    className="w-full px-2 py-1.5 border border-slate-400 bg-white"
                  >
                    <option value={1}>1 Month</option>
                    <option value={2}>2 Months</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={0}>Due Only (No Renew)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount Paid (BDT)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quickCollectAmount}
                    onChange={(e) => setQuickCollectAmount(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-500 bg-[#ffff66] font-mono tabular-nums font-bold text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={quickCollectMethod}
                    onChange={(e) =>
                      setQuickCollectMethod(e.target.value as 'CASH' | 'bKash Sync' | 'Rocket Sync' | 'Bank')
                    }
                    className="w-full px-2 py-1.5 border border-slate-500 bg-[#ffff66] font-bold"
                  >
                    <option value="CASH">CASH</option>
                    <option value="bKash Sync">bKash Sync</option>
                    <option value="Rocket Sync">Rocket Sync</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={quickCollectRemarks}
                    onChange={(e) => setQuickCollectRemarks(e.target.value)}
                    placeholder="Receipt note"
                    className="w-full px-2 py-1.5 border border-slate-400"
                  />
                </div>
              </div>

              <div className="flex justify-center gap-2 pt-2 border-t border-slate-200">
                <button type="submit" className="maxim-classic-btn px-5 py-1.5 font-bold">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setQuickCollectCustomer(null)}
                  className="maxim-classic-btn px-4 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
