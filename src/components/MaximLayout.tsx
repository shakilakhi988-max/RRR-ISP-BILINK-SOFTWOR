import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpSquare,
  Banknote,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronRight,
  Gauge,
  Globe,
  IdCard,
  Info,
  Lightbulb,
  LogOut,
  Mail,
  Network,
  PlusSquare,
  RefreshCw,
  Search,
  Settings,
  SquareUser,
  Ticket,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useMaxim } from '../context/MaximContext';
import {
  addMonthsToDateStr,
  computeSubscriberBalanceAfterPayment,
  createPaymentRecord,
  formatBrandName,
  formatShortDateTime,
  logAuditEvent,
  updateCustomer,
} from '../services/maximService';
import type { ActiveOperatorSession, AdminModuleKey } from '../types';

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultModule: AdminModuleKey;
  children: Array<{ key: AdminModuleKey; label: string }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Gauge,
    defaultModule: 'dashboard',
    children: [{ key: 'dashboard', label: 'Dashboard Overview' }],
  },
  {
    id: 'home_users',
    label: 'Home Users',
    icon: Users,
    defaultModule: 'customers_list',
    children: [
      { key: 'customers_list', label: 'Customer List' },
      { key: 'customers_add', label: 'Add Customer' },
      { key: 'customers_online', label: 'Online Users' },
      { key: 'customers_due', label: 'Due & Expired List' },
      { key: 'customers_bulk_recharge', label: 'Bulk Recharge' },
      { key: 'customers_vip', label: 'Free & VIP Users' },
    ],
  },
  {
    id: 'resellers',
    label: 'Resellers (SDT)',
    icon: Network,
    defaultModule: 'resellers',
    children: [
      { key: 'resellers', label: 'Resellers & Balance' },
      { key: 'resellers_tariffs', label: 'SDT Tariffs & Logs' },
    ],
  },
  {
    id: 'corporate',
    label: 'Corporate & Bulk BW',
    icon: User,
    defaultModule: 'corporate',
    children: [
      { key: 'corporate', label: 'Corporate & VAS Links' },
      { key: 'corporate_mrtg', label: 'SNMP Bandwidth & MRTG' },
    ],
  },
  {
    id: 'tickets_crm',
    label: 'Tickets & CRM',
    icon: Ticket,
    defaultModule: 'tickets_list',
    children: [
      { key: 'tickets_list', label: 'Ticket List' },
      { key: 'tickets_create', label: 'Create Ticket' },
      { key: 'tasks', label: 'Staff Tasks & Dispatch' },
    ],
  },
  {
    id: 'sms',
    label: 'SMS Gateway',
    icon: Mail,
    defaultModule: 'sms',
    children: [
      { key: 'sms', label: 'Send Bulk SMS' },
      { key: 'sms_templates', label: 'Templates & Delivery Logs' },
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts & Billing',
    icon: Calculator,
    defaultModule: 'billing_payments',
    children: [
      { key: 'billing_payments', label: 'Payments & Receipts' },
      { key: 'billing_sync', label: 'Payment Sync (bKash/MFS)' },
      { key: 'billing_gateway', label: 'Card Payment Gateway' },
      { key: 'accounts', label: 'Day Book & Vouchers' },
      { key: 'accounts_audit', label: 'Staff Cash Audit' },
      { key: 'accounts_pnl', label: 'Income Statement' },
      { key: 'accounts_cashflow', label: 'Cash & Bank Flow' },
    ],
  },
  {
    id: 'employees',
    label: 'Employee & RBAC',
    icon: SquareUser,
    defaultModule: 'employees',
    children: [
      { key: 'employees', label: 'Employee List' },
      { key: 'employees_rbac', label: 'Permissions & POP Scope' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Audit',
    icon: BarChart3,
    defaultModule: 'reports',
    children: [
      { key: 'reports', label: 'Collection & DIS Reports' },
      { key: 'reports_cpe', label: 'Fiber & CPE Inventory' },
      { key: 'audit_logs', label: 'Maestro Keeper Audit' },
    ],
  },
  {
    id: 'network',
    label: 'MikroTik & POP',
    icon: ArrowUpSquare,
    defaultModule: 'routers',
    children: [
      { key: 'packages', label: 'Packages & Queues' },
      { key: 'routers', label: 'MikroTik NAS Routers' },
      { key: 'pppoe_sessions', label: 'PPPoE Secrets & Active' },
      { key: 'hotspot', label: 'Hotspot Cards & OTP' },
      { key: 'pops', label: 'POP & Zone Setup' },
      { key: 'ip_logs', label: 'Maestro IP Log (BTRC)' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings & Backup',
    icon: Settings,
    defaultModule: 'settings',
    children: [
      { key: 'settings', label: 'ISP & Gateway Config' },
      { key: 'settings_backup', label: 'Customer & DB Backup' },
    ],
  },
];

export function RrrBrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 shrink-0 select-none">
      <svg
        viewBox="0 0 36 36"
        className="w-7 h-7 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="1" y="1" width="34" height="34" rx="5" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
        <path
          d="M7 24C11 14 17 11 29 11"
          stroke="#10b981"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M7 27C13 19 19 16 29 16"
          stroke="#38bdf8"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="28.5" cy="11" r="2.3" fill="#f59e0b" />
        <text
          x="8"
          y="15"
          fill="#ffffff"
          fontSize="8.5"
          fontWeight="800"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          RRR
        </text>
      </svg>
      <span className="flex flex-col leading-none text-left">
        <span className="text-[13.5px] font-extrabold tracking-tight text-[#22c55e] whitespace-nowrap">
          RRR <span className="text-white">CABLE NETWORK</span>
        </span>
        {!compact && (
          <span className="text-[9.5px] font-semibold text-[#38bdf8] tracking-wide whitespace-nowrap mt-0.5">
            ISP Billing and ERP
          </span>
        )}
      </span>
    </span>
  );
}

export function MaximLayout({ children }: { children: React.ReactNode }) {
  const {
    user,
    settings,
    activeModule,
    setActiveModule,
    setSurface,
    operator,
    setOperator,
    visibleCustomers,
    visibleTickets,
    employees,
    resellers,
    logout,
    notify,
    openCustomerSingleView,
    cashRcvPrefill,
    openCashRcvModal,
    closeCashRcvModal,
    syncAllMikrotikCustomers,
  } = useMaxim();

  const [isSyncingTop, setIsSyncingTop] = useState(false);

  // Narrow icon sidebar by default matching userinfo.png; expandable via top-left toggle
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroupIds, setOpenGroupIds] = useState<string[]>(['home_users', 'tickets_crm']);
  const [quickQuery, setQuickQuery] = useState('');

  // Header Action Strip Modals
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [idCardModalOpen, setIdCardModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Cash Rcv Entry Modal State
  const [cashCustQuery, setCashCustQuery] = useState('');
  const [cashAmount, setCashAmount] = useState('500');
  const [cashChannel, setCashChannel] = useState<'CASH' | 'bKash Sync' | 'Bank'>('CASH');
  const [cashRemarks, setCashRemarks] = useState('Cash Rcv Entry');

  // ID Lookup State
  const [cardLookupInput, setCardLookupInput] = useState('1023');

  const brandName = formatBrandName(settings?.companyName);
  const openTicketCount = visibleTickets.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;
  const onlineCount = visibleCustomers.filter((c) => c.isOnline).length;
  const dueCount = visibleCustomers.filter((c) => c.balance < 0 || c.accountStatus !== 'Active').length;

  useEffect(() => {
    if (cashRcvPrefill.open) {
      const q = cashRcvPrefill.query.trim();
      setCashCustQuery(q);
      if (q) {
        const hit = visibleCustomers.find(
          (c) => c.custId.toLowerCase() === q.toLowerCase() || c.username.toLowerCase() === q.toLowerCase()
        );
        if (hit) {
          setCashAmount(String(hit.monthlyRate || 500));
        }
      }
    }
  }, [cashRcvPrefill, visibleCustomers]);

  const matchedQuickCashSub = useMemo(() => {
    const q = cashCustQuery.trim().toLowerCase();
    if (!q) return null;
    return (
      visibleCustomers.find(
        (c) => c.custId.toLowerCase() === q || c.username.toLowerCase() === q
      ) || null
    );
  }, [cashCustQuery, visibleCustomers]);

  useEffect(() => {
    const matched = NAV_GROUPS.find(
      (g) => g.children.some((ch) => ch.key === activeModule) || (activeModule === 'customers_detail' && g.id === 'home_users')
    );
    if (matched && matched.children.length > 1) {
      setOpenGroupIds((prev) => (prev.includes(matched.id) ? prev : [...prev, matched.id]));
    }
  }, [activeModule]);

  const toggleGroup = (id: string, defaultMod: AdminModuleKey) => {
    if (!sidebarExpanded && !mobileMenuOpen) {
      setActiveModule(defaultMod);
      setHoveredGroupId(null);
      return;
    }
    setOpenGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const handleQuickSidebarSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickQuery.trim().toLowerCase();
    if (!q) {
      setActiveModule('customers_list');
      return;
    }
    const exact = visibleCustomers.find(
      (c) =>
        c.custId.toLowerCase() === q ||
        c.username.toLowerCase() === q ||
        c.mobile.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    );
    if (exact) {
      openCustomerSingleView(exact.id);
      setQuickQuery('');
      setMobileMenuOpen(false);
    } else {
      notify(`No subscriber matched "${quickQuery}" in your allowed POP scope.`, 'error');
    }
  };

  const handleQuickCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!operator.canCollectCash) {
      notify('Current staff role does not have Cash Collection permission.', 'error');
      return;
    }
    if (
      !operator.allowedCashChannels.includes('ALL') &&
      !operator.allowedCashChannels.some((ch) => ch.toLowerCase() === cashChannel.toLowerCase())
    ) {
      notify(`Channel "${cashChannel}" is restricted for operator ${operator.username}.`, 'error');
      return;
    }
    const target = visibleCustomers.find(
      (c) =>
        c.custId.toLowerCase() === cashCustQuery.trim().toLowerCase() ||
        c.username.toLowerCase() === cashCustQuery.trim().toLowerCase()
    );
    if (!target) {
      notify('Enter a valid Customer ID or Username (e.g. 1023 or Mizan).', 'error');
      return;
    }
    const amt = Math.max(1, Number(cashAmount) || 0);
    const charge = target.category === 'Free' ? 0 : target.monthlyRate;
    const newBal = computeSubscriberBalanceAfterPayment(target.balance, amt, charge, 1);
    const newExp = addMonthsToDateStr(target.expiryDate, 1);

    await createPaymentRecord(user.uid, {
      trxNumber: `RCV-${Date.now().toString(36).toUpperCase()}`,
      targetType: 'Home',
      customerId: target.id,
      customerUsername: target.username,
      customerName: target.name,
      amount: amt,
      chargeAmount: charge,
      billForMonths: 1,
      method: cashChannel,
      channel: `${cashChannel} (${operator.username})`,
      receivedBy: operator.username,
      syncSource: 'Cash Rcv Entry',
      senderMobile: target.mobile,
      status: 'Completed',
      remarks: cashRemarks,
      oldExpiry: target.expiryDate,
      newExpiry: newExp,
      paymentDate: formatShortDateTime(),
    });

    await updateCustomer(target.id, {
      balance: newBal,
      expiryDate: newExp,
      lockStatus: 'Unlocked',
      accountStatus: 'Active',
    });

    await logAuditEvent(
      user.uid,
      operator.username,
      'Cash Rcv Entry',
      `Collected BDT ${amt} (${cashChannel}) for ${target.username} (${target.custId})`,
      target.username,
      target.popName
    );

    notify(`BDT ${amt} received for ${target.username}. Balance updated to ${newBal.toFixed(2)}.`, 'success');
    closeCashRcvModal();
    setCashCustQuery('');
  };

  const switchOperatorSession = (next: ActiveOperatorSession) => {
    setOperator(next);
    setRoleModalOpen(false);
    notify(`Switched active RBAC session to ${next.username} (${next.roleLabel}).`, 'info');
  };

  const operatorNamePrimary = operator.mode === 'COMPANY' ? brandName : operator.username;
  const isDetailCanvas = activeModule === 'customers_detail';

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Official MAXIM Reference Dark Top Bar (#1d2024 — matching userinfo.png) */}
      <header className="h-[48px] bg-[#1d2024] text-[#9b9ea3] flex items-center justify-between gap-2 px-2.5 sm:px-4 border-b border-black/50 shrink-0 select-none z-30 no-print">
        {/* Left: Hamburger+Arrow + RRR CABLE NETWORK Brand + Active Company/Role Label */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileMenuOpen((v) => !v);
              } else {
                setSidebarExpanded((v) => !v);
              }
            }}
            title="Toggle Sidebar"
            className="p-1.5 text-white hover:bg-white/10 rounded-[2px] cursor-pointer shrink-0"
          >
            <svg viewBox="0 0 22 18" className="w-[19px] h-[16px]" fill="currentColor" aria-hidden="true">
              <rect x="0" y="1" width="14" height="2.4" rx="0.5" />
              <rect x="0" y="7.8" width="11" height="2.4" rx="0.5" />
              <rect x="0" y="14.6" width="14" height="2.4" rx="0.5" />
              <polygon points="15,5.5 21,9 15,12.5" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            className="cursor-pointer shrink-0 pr-2"
          >
            <RrrBrandMark />
          </button>

          <button
            type="button"
            onClick={() => setRoleModalOpen(true)}
            title="Switch Operator / Reseller / Portal View"
            className="hidden md:inline-flex items-baseline gap-1 text-white hover:text-slate-200 truncate cursor-pointer ml-4 lg:ml-8"
          >
            <span className="text-[13.5px] font-bold tracking-tight truncate">{operatorNamePrimary}</span>
            <span className="text-[9.5px] font-semibold text-slate-200 uppercase">({operator.roleLabel})</span>
          </button>
        </div>

        {/* Right: Authentic 11-Item MAXIM Matte-Grey Action Icon Strip (userinfo.png) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* 1. Open Tickets */}
          <button
            type="button"
            onClick={() => setActiveModule('tickets_list')}
            title={`Ticket List (${openTicketCount} Open)`}
            className="relative p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <Ticket className="w-[19px] h-[19px]" />
            {openTicketCount > 0 && !isDetailCanvas && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-600 text-white text-[9.5px] font-bold flex items-center justify-center leading-none tabular-nums">
                {openTicketCount}
              </span>
            )}
          </button>

          {/* 2. Create New Ticket [+] */}
          <button
            type="button"
            onClick={() => setActiveModule('tickets_create')}
            title="Create Support Ticket"
            className="p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <PlusSquare className="w-[18px] h-[18px]" />
          </button>

          {/* 3. Add New Customer */}
          <button
            type="button"
            onClick={() => setActiveModule('customers_add')}
            title="Add New Customer"
            className="p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <UserPlus className="w-[19px] h-[19px]" />
          </button>

          {/* 4. Global Subscriber Search */}
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            title="Global Subscriber Search"
            className="p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          {/* 5. System & License Info (i) */}
          <button
            type="button"
            onClick={() => setInfoModalOpen(true)}
            title="System & License Info"
            className="hidden sm:inline-flex p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <Info className="w-[18px] h-[18px]" />
          </button>

          {/* 6. Online Sessions Lightbulb */}
          <button
            type="button"
            onClick={() => setActiveModule('customers_online')}
            title={`Online Sessions (${onlineCount} Active)`}
            className="hidden sm:inline-flex p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <Lightbulb className="w-[18px] h-[18px]" />
          </button>

          {/* MikroTik 100% Real Quick Sync */}
          <button
            type="button"
            onClick={async () => {
              setIsSyncingTop(true);
              try {
                await syncAllMikrotikCustomers();
              } catch {
                // handled in context
              } finally {
                setIsSyncingTop(false);
              }
            }}
            disabled={isSyncingTop}
            title="1-Click Real MikroTik Sync (103.54.37.182:1165 — RRR CABLE NETWORK)"
            className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-[2px] cursor-pointer"
          >
            <RefreshCw className={`w-[18px] h-[18px] ${isSyncingTop ? 'animate-spin' : ''}`} />
          </button>

          {/* 7. Open Subscriber by ID Card */}
          <button
            type="button"
            onClick={() => setIdCardModalOpen(true)}
            title="Open Customer by ID"
            className="hidden md:inline-flex p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <IdCard className="w-[19px] h-[19px]" />
          </button>

          {/* 8. Quick Cash Rcv Entry [$=] */}
          <button
            type="button"
            onClick={() => openCashRcvModal('')}
            title="Cash Rcv Entry / Quick Bill Collection"
            className="p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <Banknote className="w-[19px] h-[19px]" />
          </button>

          {/* 9. Operator / Role / Portal Switcher */}
          <button
            type="button"
            onClick={() => setRoleModalOpen(true)}
            title="Operator Role, Reseller & Customer Portal Switcher"
            className="p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <User className="w-[18px] h-[18px]" />
          </button>

          {/* 10. Dashboard Gauge */}
          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            title="ISP Dashboard"
            className="hidden sm:inline-flex p-1.5 text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer"
          >
            <Gauge className="w-[19px] h-[19px]" />
          </button>

          {/* 11. Logout */}
          <button
            type="button"
            onClick={logout}
            title="Logout"
            className="inline-flex items-center gap-1 px-1.5 py-1 text-[13px] font-medium text-[#9b9ea3] hover:text-white rounded-[2px] cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogOut className="w-[17px] h-[17px]" />
            <span className="hidden lg:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="flex-1 flex min-h-0 relative">
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/55 z-20 lg:hidden no-print"
          />
        )}

        {/* Official MAXIM Narrow Dark Left Sidebar (#1d2024 — 44px collapsed matching userinfo.png, expandable via Hamburger) */}
        <aside
          className={`${
            mobileMenuOpen ? 'translate-x-0 w-[228px]' : '-translate-x-full lg:translate-x-0'
          } ${
            sidebarExpanded ? 'lg:w-[228px]' : 'lg:w-[44px]'
          } fixed lg:static inset-y-0 left-0 top-[48px] z-20 bg-[#1d2024] text-[#9b9ea3] flex flex-col border-r border-black/40 shrink-0 transition-transform duration-150 no-print`}
        >
          {/* Top Subscriber Quick Jump ('Ent' + Blue Search Button matching userinfo.png) */}
          <form
            onSubmit={handleQuickSidebarSearch}
            className={sidebarExpanded || mobileMenuOpen ? 'p-2 border-b border-white/10' : 'p-0'}
          >
            {sidebarExpanded || mobileMenuOpen ? (
              <div className="flex items-stretch gap-1">
                <input
                  type="text"
                  placeholder="Enter ID / Username"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-[2px]"
                />
                <button
                  type="submit"
                  title="Jump to Customer Single View"
                  className="px-2.5 bg-[#007bff] hover:bg-[#0069d9] text-white rounded-[2px] flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col pt-2.5">
                <input
                  type="text"
                  placeholder="Ent"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  className="w-full h-[34px] px-1.5 text-[12px] bg-white text-[#222222] placeholder:text-[#555555] border-0 rounded-none focus:ring-0 focus:shadow-none"
                />
                <button
                  type="submit"
                  title="Search Subscriber by ID / Username"
                  className="w-full h-[35px] bg-[#007bff] hover:bg-[#0069d9] text-white rounded-none flex items-center justify-center cursor-pointer"
                >
                  <Search className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            )}
          </form>

          {/* Clean MAXIM Vertical Navigation List (with Hover Flyout Submenu in Narrow Mode) */}
          <nav
            className={`flex-1 py-1.5 ${
              sidebarExpanded || mobileMenuOpen ? 'overflow-y-auto' : 'overflow-visible'
            }`}
          >
            {NAV_GROUPS.map((group) => {
              const Icon = group.icon;
              const isGroupActive =
                group.children.some((ch) => ch.key === activeModule) ||
                (activeModule === 'customers_detail' && group.id === 'home_users');
              const isOpen = openGroupIds.includes(group.id);
              const isNarrowMode = !sidebarExpanded && !mobileMenuOpen;

              return (
                <div
                  key={group.id}
                  onMouseEnter={() => {
                    if (isNarrowMode) setHoveredGroupId(group.id);
                  }}
                  onMouseLeave={() => {
                    if (isNarrowMode) setHoveredGroupId((prev) => (prev === group.id ? null : prev));
                  }}
                  className={`relative ${sidebarExpanded || mobileMenuOpen ? 'border-b border-white/[0.04]' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (group.children.length === 1) {
                        setActiveModule(group.defaultModule);
                        setMobileMenuOpen(false);
                        setHoveredGroupId(null);
                      } else {
                        toggleGroup(group.id, group.defaultModule);
                      }
                    }}
                    title={group.label}
                    className={`w-full min-h-[38px] flex items-center ${
                      isNarrowMode ? 'justify-center px-0' : 'justify-between px-3'
                    } py-2 text-[12.5px] transition-colors cursor-pointer ${
                      isGroupActive
                        ? 'bg-[#141619] text-white font-semibold'
                        : 'text-[#8c9198] hover:bg-[#272b31] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-[16px] h-[16px] shrink-0 ${
                          isGroupActive ? 'text-white' : 'text-[#8c9198]'
                        }`}
                      />
                      {(sidebarExpanded || mobileMenuOpen) && (
                        <span className="truncate whitespace-nowrap">{group.label}</span>
                      )}
                    </div>
                    {(sidebarExpanded || mobileMenuOpen) && group.children.length > 1 && (
                      isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      )
                    )}
                  </button>

                  {/* Narrow Mode Classic MAXIM Flyout Submenu */}
                  {isNarrowMode && hoveredGroupId === group.id && (
                    <div className="absolute left-full top-0 w-[212px] bg-[#22262e] border border-black/60 shadow-xl z-50 text-xs">
                      <div className="px-3 py-2 bg-[#171a20] text-white font-bold border-b border-white/10 flex items-center justify-between">
                        <span>{group.label}</span>
                      </div>
                      <div className="py-1">
                        {group.children.map((sub) => {
                          const isSubActive =
                            activeModule === sub.key ||
                            (activeModule === 'customers_detail' && sub.key === 'customers_list');
                          const badgeVal =
                            sub.key === 'customers_online'
                              ? onlineCount
                              : sub.key === 'customers_due'
                              ? dueCount
                              : sub.key === 'tickets_list'
                              ? openTicketCount
                              : null;

                          return (
                            <button
                              key={sub.key}
                              type="button"
                              onClick={() => {
                                setActiveModule(sub.key);
                                setHoveredGroupId(null);
                              }}
                              className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 cursor-pointer ${
                                isSubActive
                                  ? 'text-[#38bdf8] font-semibold bg-white/[0.06]'
                                  : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                              }`}
                            >
                              <span className="truncate">{sub.label}</span>
                              {badgeVal !== null && badgeVal > 0 && (
                                <span className="font-mono tabular-nums text-[10.5px] text-amber-300 font-semibold">
                                  {badgeVal}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {group.id === 'settings' && (
                          <div className="mt-1 pt-1 border-t border-white/10">
                            <button
                              type="button"
                              onClick={() => {
                                setHoveredGroupId(null);
                                setSurface('portal');
                              }}
                              className="w-full text-left px-3 py-1.5 text-emerald-400 hover:bg-white/[0.05] flex items-center gap-1.5 cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Customer Self-Care Portal
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHoveredGroupId(null);
                                setSurface('website');
                              }}
                              className="w-full text-left px-3 py-1.5 text-sky-400 hover:bg-white/[0.05] flex items-center gap-1.5 cursor-pointer"
                            >
                              <Globe className="w-3.5 h-3.5" /> RRR Public Website
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expanded / Mobile Submenu */}
                  {(sidebarExpanded || mobileMenuOpen) && group.children.length > 1 && isOpen && (
                    <div className="bg-[#17191d] py-1">
                      {group.children.map((sub) => {
                        const isSubActive =
                          activeModule === sub.key ||
                          (activeModule === 'customers_detail' && sub.key === 'customers_list');

                        const badgeVal =
                          sub.key === 'customers_online'
                            ? onlineCount
                            : sub.key === 'customers_due'
                            ? dueCount
                            : sub.key === 'tickets_list'
                            ? openTicketCount
                            : null;

                        return (
                          <button
                            key={sub.key}
                            type="button"
                            onClick={() => {
                              setActiveModule(sub.key);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full min-h-[31px] text-left pl-9 pr-3 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                              isSubActive
                                ? 'text-[#38bdf8] font-semibold bg-white/[0.04]'
                                : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                            }`}
                          >
                            <span className="truncate">{sub.label}</span>
                            {badgeVal !== null && badgeVal > 0 && (
                              <span
                                className={`font-mono tabular-nums text-[11px] font-semibold ${
                                  sub.key === 'customers_due'
                                    ? 'text-red-400'
                                    : sub.key === 'tickets_list'
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {badgeVal}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Portal & Public Website Switcher Footer (Expanded Mode) */}
          {(sidebarExpanded || mobileMenuOpen) && (
            <div className="p-2 border-t border-white/10 bg-[#16181c] space-y-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSurface('portal');
                }}
                className="w-full py-1.5 px-2.5 text-left rounded-[2px] bg-[#262b35] hover:bg-[#303643] text-slate-200 flex items-center justify-between cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Customer Self-Care</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSurface('website');
                }}
                className="w-full py-1.5 px-2.5 text-left rounded-[2px] hover:bg-[#262b35] text-slate-400 hover:text-slate-200 flex items-center justify-between cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">RRR Public Website</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            </div>
          )}
        </aside>

        {/* Main Viewport Canvas — Pure White on Customer Details matching userinfo.png */}
        <main
          className={`flex-1 min-w-0 overflow-x-hidden ${
            isDetailCanvas ? 'bg-white py-2 px-2 sm:px-6' : 'bg-[#f4f6f9] p-3 sm:p-4'
          }`}
        >
          {operator.mode !== 'COMPANY' && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-300 rounded-[2px] flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 no-print">
              <span>
                Active Role Scope: <strong>{operator.username}</strong> ({operator.roleLabel}) · Allowed POPs:{' '}
                <strong>{operator.allowedPops.join(', ')}</strong> · Cash Channels:{' '}
                <strong>{operator.allowedCashChannels.join(', ')}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  switchOperatorSession({
                    mode: 'COMPANY',
                    displayName: brandName,
                    username: brandName,
                    roleLabel: 'COMPANY',
                    allowedPops: ['ALL'],
                    allowedCashChannels: ['ALL'],
                    canEditPackage: true,
                    canCollectCash: true,
                    canManageRouter: true,
                    canDeleteRecord: true,
                  })
                }
                className="maxim-classic-btn"
              >
                Switch to {brandName} (COMPANY)
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Modal 1: Global Subscriber Search */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-400 rounded-[3px] w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300">
              <h3 className="text-sm font-bold text-slate-800">Global Subscriber Lookup</h3>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Type Customer ID, Username, Name, Mobile, or IP..."
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-[3px]"
              />
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 border border-slate-300 rounded-[3px]">
                {visibleCustomers
                  .filter((c) => {
                    const q = quickQuery.toLowerCase();
                    return (
                      !q ||
                      c.custId.toLowerCase().includes(q) ||
                      c.username.toLowerCase().includes(q) ||
                      c.name.toLowerCase().includes(q) ||
                      c.mobile.includes(q) ||
                      c.ipAddress.includes(q)
                    );
                  })
                  .slice(0, 14)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        openCustomerSingleView(c.id);
                        setSearchModalOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-amber-50/60 flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900 mr-2">{c.custId}</span>
                        <span className="font-bold text-emerald-700">{c.username}</span>
                        <span className="text-slate-600 ml-2">({c.name})</span>
                      </div>
                      <div className="font-mono tabular-nums text-right">
                        <span className={c.balance < 0 ? 'text-red-600 font-bold' : 'text-slate-800'}>
                          {c.balance.toFixed(2)}
                        </span>
                        <span className="text-slate-400 ml-2">{c.popName}</span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Quick ID Card Lookup */}
      {idCardModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-400 rounded-[3px] w-full max-w-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300">
              <h3 className="text-sm font-bold text-slate-800">Open Customer Single View by ID</h3>
              <button
                type="button"
                onClick={() => setIdCardModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const hit = visibleCustomers.find(
                  (c) =>
                    c.custId.toLowerCase() === cardLookupInput.trim().toLowerCase() ||
                    c.username.toLowerCase() === cardLookupInput.trim().toLowerCase()
                );
                if (hit) {
                  openCustomerSingleView(hit.id);
                  setIdCardModalOpen(false);
                } else {
                  notify('Customer ID / Login ID not found in your allowed POP.', 'error');
                }
              }}
              className="p-4 space-y-3"
            >
              <label className="block text-xs font-semibold text-slate-700">Customer ID or Login ID</label>
              <input
                type="text"
                value={cardLookupInput}
                onChange={(e) => setCardLookupInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-[3px] font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIdCardModalOpen(false)}
                  className="maxim-classic-btn"
                >
                  Close
                </button>
                <button type="submit" className="maxim-btn-primary">
                  Open Single View
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Cash Rcv Entry Modal (Triggered from Header or Customer List 'Cash Rcv Entry' button) */}
      {cashRcvPrefill.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-500 rounded-[3px] w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300">
              <h3 className="text-sm font-bold text-slate-800">Cash Rcv Entry</h3>
              <button
                type="button"
                onClick={closeCashRcvModal}
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickCashSubmit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Customer ID or Username *
                </label>
                <input
                  type="text"
                  required
                  list="rrr-quick-sub-list"
                  placeholder="Enter Customer ID or Username (e.g. 1023 or Mizan)"
                  value={cashCustQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCashCustQuery(val);
                    const hit = visibleCustomers.find(
                      (c) =>
                        c.custId.toLowerCase() === val.trim().toLowerCase() ||
                        c.username.toLowerCase() === val.trim().toLowerCase()
                    );
                    if (hit) setCashAmount(String(hit.monthlyRate));
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-400 rounded-[3px] font-mono"
                />
                <datalist id="rrr-quick-sub-list">
                  {visibleCustomers.slice(0, 40).map((c) => (
                    <option key={c.id} value={c.username}>
                      {c.custId} — {c.name} ({c.packageName}, ৳{c.monthlyRate})
                    </option>
                  ))}
                </datalist>

                {matchedQuickCashSub && (
                  <div className="mt-1.5 px-2.5 py-1.5 bg-[#f8f9fa] border border-slate-300 rounded-[3px] flex items-center justify-between text-[11px]">
                    <span>
                      <strong>{matchedQuickCashSub.name}</strong> ({matchedQuickCashSub.packageName})
                    </span>
                    <span className="font-mono tabular-nums">
                      Balance:{' '}
                      <strong className={matchedQuickCashSub.balance < 0 ? 'text-red-600' : 'text-emerald-700'}>
                        {matchedQuickCashSub.balance.toFixed(2)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="border border-slate-400 divide-y divide-slate-300">
                <div className="grid grid-cols-2 items-center p-2">
                  <span className="font-bold text-slate-700">Payment Method</span>
                  <select
                    value={cashChannel}
                    onChange={(e) => setCashChannel(e.target.value as 'CASH' | 'bKash Sync' | 'Bank')}
                    className="w-full px-2 py-1 border border-slate-400 bg-[#ffff66] font-bold text-slate-900"
                  >
                    <option value="CASH">CASH</option>
                    <option value="bKash Sync">bKash Sync</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 items-center p-2">
                  <span className="font-bold text-slate-700">Amount Received</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-400 bg-[#ffff66] font-mono tabular-nums font-bold text-right text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 items-center p-2">
                  <span className="font-bold text-slate-700">Received By</span>
                  <input
                    type="text"
                    readOnly
                    value={operator.username}
                    className="w-full px-2 py-1 border border-slate-300 bg-[#e9ecef] text-slate-700 font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 items-center p-2">
                  <span className="font-bold text-slate-700">Remarks:</span>
                  <input
                    type="text"
                    value={cashRemarks}
                    onChange={(e) => setCashRemarks(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-400"
                  />
                </div>
              </div>

              <div className="flex justify-center gap-2 pt-1">
                <button type="submit" className="maxim-classic-btn px-5 py-1.5 font-bold">
                  Save
                </button>
                <button
                  type="button"
                  onClick={closeCashRcvModal}
                  className="maxim-classic-btn px-4 py-1.5"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: RBAC Role & Portal Switcher */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-400 rounded-[3px] w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300">
              <h3 className="text-sm font-bold text-slate-800">Operator Role, Reseller &amp; Portal Switcher</h3>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3.5 text-xs">
              <p className="text-slate-600">
                Switch active operator session to test RBAC permissions, POP isolation, cash channel rules, or Reseller (SDT) views:
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                <button
                  type="button"
                  onClick={() =>
                    switchOperatorSession({
                      mode: 'COMPANY',
                      displayName: brandName,
                      username: brandName,
                      roleLabel: 'COMPANY',
                      allowedPops: ['ALL'],
                      allowedCashChannels: ['ALL'],
                      canEditPackage: true,
                      canCollectCash: true,
                      canManageRouter: true,
                      canDeleteRecord: true,
                    })
                  }
                  className={`w-full p-2.5 border rounded-[3px] text-left flex items-center justify-between cursor-pointer ${
                    operator.mode === 'COMPANY'
                      ? 'border-emerald-600 bg-emerald-50/50'
                      : 'border-slate-300 hover:border-emerald-600'
                  }`}
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {brandName} (COMPANY — Super Admin)
                    </p>
                    <p className="text-slate-500">Full access across all POPs, Routers, Cashbooks &amp; Resellers</p>
                  </div>
                  <span className="font-mono text-emerald-700 font-bold">COMPANY</span>
                </button>

                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() =>
                      switchOperatorSession({
                        mode: 'STAFF',
                        displayName: emp.fullName,
                        username: emp.username,
                        roleLabel: emp.role.toUpperCase(),
                        allowedPops: emp.allowedPops.split(',').map((s) => s.trim()).filter(Boolean),
                        allowedCashChannels: emp.allowedCashChannels.split(',').map((s) => s.trim()).filter(Boolean),
                        canEditPackage: emp.canEditPackage,
                        canCollectCash: emp.canCollectCash,
                        canManageRouter: emp.canManageRouter,
                        canDeleteRecord: emp.canDeleteRecord,
                      })
                    }
                    className={`w-full p-2.5 border rounded-[3px] text-left flex items-center justify-between cursor-pointer ${
                      operator.username === emp.username
                        ? 'border-sky-600 bg-sky-50/50'
                        : 'border-slate-300 hover:border-sky-600'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {emp.username} — {emp.fullName}
                      </p>
                      <p className="text-slate-500">
                        POPs: {emp.allowedPops} · Cash: {emp.allowedCashChannels}
                      </p>
                    </div>
                    <span className="font-mono text-sky-700 font-bold">{emp.role}</span>
                  </button>
                ))}

                {resellers.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() =>
                      switchOperatorSession({
                        mode: 'RESELLER',
                        displayName: res.companyName,
                        username: res.username,
                        roleLabel: 'RESELLER / SDT',
                        allowedPops: [res.popName],
                        allowedCashChannels: ['CASH'],
                        resellerId: res.id,
                        canEditPackage: true,
                        canCollectCash: true,
                        canManageRouter: false,
                        canDeleteRecord: false,
                      })
                    }
                    className={`w-full p-2.5 border rounded-[3px] text-left flex items-center justify-between cursor-pointer ${
                      operator.username === res.username
                        ? 'border-amber-600 bg-amber-50/50'
                        : 'border-slate-300 hover:border-amber-600'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {res.username} — {res.companyName}
                      </p>
                      <p className="text-slate-500 font-mono tabular-nums">
                        SDT Balance: ৳{res.balance.toLocaleString()} · Credit: ৳{res.creditLimit.toLocaleString()} · {res.popName}
                      </p>
                    </div>
                    <span className="font-mono text-amber-700 font-bold">SDT</span>
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRoleModalOpen(false);
                    setSurface('portal');
                  }}
                  className="maxim-btn-primary"
                >
                  Open Customer Self-Care Portal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRoleModalOpen(false);
                    setSurface('website');
                  }}
                  className="maxim-btn-secondary"
                >
                  Open RRR Public Website
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: System & License Status */}
      {infoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-400 rounded-[3px] w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#e9ecef] border-b border-slate-300">
              <h3 className="text-sm font-bold text-slate-800">ISP License &amp; Gateway Status</h3>
              <button
                type="button"
                onClick={() => setInfoModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2 text-xs text-slate-700">
              <div className="flex justify-between py-1.5 border-b border-slate-200">
                <span className="text-slate-500">ISP Organization</span>
                <span className="font-bold text-slate-900">{brandName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200">
                <span className="text-slate-500">BTRC License</span>
                <span className="font-mono text-slate-900">{settings?.btrcLicenseNo}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200">
                <span className="text-slate-500">RouterOS / RADIUS Mode</span>
                <span className="font-mono text-emerald-700 font-bold">
                  {settings?.routerSandboxMode ? 'Sandbox Mode (Live Ready)' : 'Live RouterOS Socket'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200">
                <span className="text-slate-500">Maestro Keeper Security</span>
                <span className="text-emerald-700 font-bold">
                  {settings?.keeperAlertOnLogin ? 'Active (Audit Alerts On)' : 'Standby'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">SMS Gateway Balance</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">{settings?.smsBalance ?? 0} Credits</span>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setInfoModalOpen(false)}
                  className="maxim-classic-btn"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
