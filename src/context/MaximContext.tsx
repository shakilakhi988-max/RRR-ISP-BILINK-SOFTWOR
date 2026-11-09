import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import {
  ensureMaximWorkspaceSeeded,
  formatBrandName,
  getInitialSeedData,
  getStoredCollection,
  ISP_BRAND_NAME,
  logAuditEvent,
  saveStoredCollection,
  syncMikrotikCustomers,
} from '../services/maximService';
import type {
  ActiveOperatorSession,
  AdminModuleKey,
  AppSurface,
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

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface MaximContextValue {
  user: User | null;
  authReady: boolean;
  seeding: boolean;
  surface: AppSurface;
  setSurface: (s: AppSurface) => void;
  activeModule: AdminModuleKey;
  setActiveModule: (m: AdminModuleKey) => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  bulkCustomerIds: string[];
  setBulkCustomerIds: React.Dispatch<React.SetStateAction<string[]>>;
  operator: ActiveOperatorSession;
  setOperator: (op: ActiveOperatorSession) => void;
  portalCustomerId: string | null;
  setPortalCustomerId: (id: string | null) => void;

  // Firestore Live Collections
  settings: WorkspaceSettings | null;
  pops: PopZone[];
  packages: IspPackage[];
  routers: MikrotikRouter[];
  allCustomers: Customer[];
  visibleCustomers: Customer[];
  resellers: Reseller[];
  employees: Employee[];
  payments: PaymentRecord[];
  tickets: SupportTicket[];
  visibleTickets: SupportTicket[];
  tasks: StaffTask[];
  corporateClients: CorporateClient[];
  ledgerEntries: LedgerEntry[];
  operationalLogs: OperationalLog[];

  // Actions
  loginWithEmailPassword: (email: string, pass: string, preferredPreset?: string) => Promise<void>;
  loginWithGoogle: (preferredUsername?: string) => Promise<void>;
  logout: () => Promise<void>;
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  openCustomerSingleView: (customerId: string) => void;
  cashRcvPrefill: { open: boolean; query: string };
  openCashRcvModal: (prefillQuery?: string) => void;
  closeCashRcvModal: () => void;
  syncAllMikrotikCustomers: (targetRouter?: MikrotikRouter) => Promise<{
    count: number;
    online: number;
    offline: number;
    disabled: number;
  }>;
}

const DEFAULT_OPERATOR: ActiveOperatorSession = {
  mode: 'COMPANY',
  displayName: ISP_BRAND_NAME,
  username: ISP_BRAND_NAME,
  roleLabel: 'COMPANY',
  allowedPops: ['ALL'],
  allowedCashChannels: ['ALL'],
  canEditPackage: true,
  canCollectCash: true,
  canManageRouter: true,
  canDeleteRecord: true,
};

const MaximContext = createContext<MaximContextValue | null>(null);

export function MaximProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [surface, setSurface] = useState<AppSurface>('admin');
  const [activeModule, setActiveModule] = useState<AdminModuleKey>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [bulkCustomerIds, setBulkCustomerIds] = useState<string[]>([]);
  const [operator, setOperator] = useState<ActiveOperatorSession>(DEFAULT_OPERATOR);
  const [pendingOperatorPreset, setPendingOperatorPreset] = useState<string | null>(null);
  const [portalCustomerId, setPortalCustomerId] = useState<string | null>(null);
  const [cashRcvPrefill, setCashRcvPrefill] = useState<{ open: boolean; query: string }>({ open: false, query: '' });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [pops, setPops] = useState<PopZone[]>([]);
  const [packages, setPackages] = useState<IspPackage[]>([]);
  const [routers, setRouters] = useState<MikrotikRouter[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [corporateClients, setCorporateClients] = useState<CorporateClient[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [operationalLogs, setOperationalLogs] = useState<OperationalLog[]>([]);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Restore authenticated operator session from localStorage on initial boot
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rrr_admin_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.uid) {
          const mockUser = parsed as unknown as User;
          setUser(mockUser);
          const initialSeed = getInitialSeedData(parsed.uid, parsed.email || 'mobailtelecom201@gmail.com');
          setSettings(initialSeed.settings);
          setPops(getStoredCollection('pops', initialSeed.pops));
          setPackages(getStoredCollection('packages', initialSeed.packages));
          setRouters(getStoredCollection('routers', initialSeed.routers));
          setResellers(getStoredCollection('resellers', initialSeed.resellers));
          setAllCustomers(getStoredCollection('customers', initialSeed.customers));
          setEmployees(getStoredCollection('employees', initialSeed.employees));
          setTickets(getStoredCollection('tickets', initialSeed.tickets));
          setTasks(getStoredCollection('tasks', initialSeed.tasks));
          setCorporateClients(getStoredCollection('corporateClients', initialSeed.corporateClients));
          setPayments(getStoredCollection('payments', initialSeed.payments));
          setLedgerEntries(getStoredCollection('ledgerEntries', initialSeed.ledgerEntries));
          setOperationalLogs(getStoredCollection('operationalLogs', initialSeed.operationalLogs));
        }
      }
    } catch (e) {
      console.warn('Session restoration failed:', e);
    }
  }, []);

  // Listen to in-memory/local-storage updates to reflect UI changes across all modules immediately
  useEffect(() => {
    const handleDataUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ colName: string; items: unknown[] }>;
      if (!ce.detail) return;
      const { colName, items } = ce.detail;
      switch (colName) {
        case 'pops': setPops(items as PopZone[]); break;
        case 'packages': setPackages(items as IspPackage[]); break;
        case 'routers': setRouters(items as MikrotikRouter[]); break;
        case 'resellers': setResellers(items as Reseller[]); break;
        case 'customers': setAllCustomers(items as Customer[]); break;
        case 'employees': setEmployees(items as Employee[]); break;
        case 'tickets': setTickets(items as SupportTicket[]); break;
        case 'tasks': setTasks(items as StaffTask[]); break;
        case 'corporateClients': setCorporateClients(items as CorporateClient[]); break;
        case 'payments': setPayments(items as PaymentRecord[]); break;
        case 'ledgerEntries': setLedgerEntries(items as LedgerEntry[]); break;
        case 'operationalLogs': setOperationalLogs(items as OperationalLog[]); break;
      }
    };
    window.addEventListener('rrr_data_update', handleDataUpdate);
    return () => window.removeEventListener('rrr_data_update', handleDataUpdate);
  }, []);

  // Firebase auth state observer (for SSO or direct Firebase auth)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setSeeding(true);
        try {
          await ensureMaximWorkspaceSeeded(currentUser.uid, currentUser.email || '');
        } catch (err) {
          console.error('Seed check error:', err);
        } finally {
          setSeeding(false);
        }
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Attach tenant-scoped real-time listeners once authenticated
  useEffect(() => {
    if (!authReady || !user || seeding) return;
    const uid = user.uid;
    const initialSeed = getInitialSeedData(uid, user.email || 'mobailtelecom201@gmail.com');

    const unsubs: Array<() => void> = [];

    // Load initial cached datasets
    setSettings(initialSeed.settings);
    setPops(getStoredCollection('pops', initialSeed.pops));
    setPackages(getStoredCollection('packages', initialSeed.packages));
    setRouters(getStoredCollection('routers', initialSeed.routers));
    setResellers(getStoredCollection('resellers', initialSeed.resellers));
    setAllCustomers(getStoredCollection('customers', initialSeed.customers));
    setEmployees(getStoredCollection('employees', initialSeed.employees));
    setTickets(getStoredCollection('tickets', initialSeed.tickets));
    setTasks(getStoredCollection('tasks', initialSeed.tasks));
    setCorporateClients(getStoredCollection('corporateClients', initialSeed.corporateClients));
    setPayments(getStoredCollection('payments', initialSeed.payments));
    setLedgerEntries(getStoredCollection('ledgerEntries', initialSeed.ledgerEntries));
    setOperationalLogs(getStoredCollection('operationalLogs', initialSeed.operationalLogs));

    // Live workspace settings listener
    try {
      unsubs.push(
        onSnapshot(
          doc(db, 'workspaceSettings', uid),
          (snap) => {
            if (snap.exists()) {
              const raw = snap.data() as Omit<WorkspaceSettings, 'id'>;
              const resolvedName = formatBrandName(raw.companyName);
              setSettings({ id: snap.id, ...raw, companyName: resolvedName });
              setOperator((prev) =>
                prev.mode === 'COMPANY'
                  ? {
                      ...prev,
                      displayName: resolvedName,
                      username: resolvedName,
                      roleLabel: raw.companyCode || 'COMPANY',
                    }
                  : prev
              );
            }
          },
          (err) => {
            console.warn(`workspaceSettings live listener info:`, err.message);
          }
        )
      );
    } catch (e) {
      console.warn('workspaceSettings listener skipped:', e);
    }

    const bindCollection = <T extends { id: string }>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      initialFallback: T[]
    ) => {
      // First populate from local store
      const localItems = getStoredCollection<T>(colName, initialFallback);
      setter(localItems);

      try {
        const q = query(collection(db, colName), where('ownerUid', '==', uid));
        const u = onSnapshot(
          q,
          (snap) => {
            if (!snap.empty) {
              const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as T[];
              setter(items);
              saveStoredCollection<T>(colName, items);
            }
          },
          (err) => {
            console.warn(`Live listener for ${colName} info:`, err.message);
          }
        );
        unsubs.push(u);
      } catch (e) {
        console.warn(`Could not attach live listener for ${colName}:`, e);
      }
    };

    bindCollection<PopZone>('pops', setPops, initialSeed.pops);
    bindCollection<IspPackage>('packages', setPackages, initialSeed.packages);
    bindCollection<MikrotikRouter>('routers', setRouters, initialSeed.routers);
    bindCollection<Customer>('customers', setAllCustomers, initialSeed.customers);
    bindCollection<Reseller>('resellers', setResellers, initialSeed.resellers);
    bindCollection<Employee>('employees', setEmployees, initialSeed.employees);
    bindCollection<PaymentRecord>('payments', setPayments, initialSeed.payments);
    bindCollection<SupportTicket>('tickets', setTickets, initialSeed.tickets);
    bindCollection<StaffTask>('tasks', setTasks, initialSeed.tasks);
    bindCollection<CorporateClient>('corporateClients', setCorporateClients, initialSeed.corporateClients);
    bindCollection<LedgerEntry>('ledgerEntries', setLedgerEntries, initialSeed.ledgerEntries);
    bindCollection<OperationalLog>('operationalLogs', setOperationalLogs, initialSeed.operationalLogs);

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, user, seeding]);

  // Enforce RBAC POP/Area Restriction & Reseller Customer Isolation
  const visibleCustomers = useMemo(() => {
    const sorted = [...allCustomers].sort((a, b) => Number(a.custId) - Number(b.custId));
    if (operator.mode === 'RESELLER' && operator.resellerId) {
      return sorted.filter((c) => c.resellerId === operator.resellerId);
    }
    if (
      operator.allowedPops.length > 0 &&
      !operator.allowedPops.includes('ALL')
    ) {
      return sorted.filter((c) => operator.allowedPops.includes(c.popName));
    }
    return sorted;
  }, [allCustomers, operator]);

  const visibleTickets = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => Number(b.ticketNo) - Number(a.ticketNo));
    if (operator.mode === 'RESELLER' && operator.resellerId) {
      const myCustIds = new Set(visibleCustomers.map((c) => c.id));
      return sorted.filter((t) => myCustIds.has(t.customerId));
    }
    if (
      operator.allowedPops.length > 0 &&
      !operator.allowedPops.includes('ALL')
    ) {
      return sorted.filter((t) => operator.allowedPops.includes(t.popName));
    }
    return sorted;
  }, [tickets, operator, visibleCustomers]);

  // Apply login operator preset once resellers/employees load, and keep RBAC flags live-synced
  useEffect(() => {
    if (!pendingOperatorPreset) return;
    const uname = pendingOperatorPreset.trim().toLowerCase();
    const brandName = formatBrandName(settings?.companyName);
    if (!uname || uname === 'democompany' || uname === 'rrr cable network' || uname === brandName.toLowerCase()) {
      setOperator({
        ...DEFAULT_OPERATOR,
        displayName: brandName,
        username: brandName,
        roleLabel: settings?.companyCode || 'COMPANY',
      });
      setPendingOperatorPreset(null);
      return;
    }

    const matchedReseller =
      resellers.find((r) => r.username.toLowerCase() === uname) ||
      (uname === 'demoreseller' ? resellers[0] : undefined);
    if (matchedReseller) {
      setOperator({
        mode: 'RESELLER',
        displayName: matchedReseller.companyName,
        username: matchedReseller.username,
        roleLabel: 'RESELLER (SDT)',
        resellerId: matchedReseller.id,
        allowedPops: [matchedReseller.popName],
        allowedCashChannels: ['CASH', 'bKash Sync'],
        canEditPackage: false,
        canCollectCash: true,
        canManageRouter: false,
        canDeleteRecord: false,
      });
      setPendingOperatorPreset(null);
      notify(`Active operator session set to Reseller: ${matchedReseller.username} (${matchedReseller.popName}).`, 'info');
      return;
    }

    const matchedEmp = employees.find((e) => e.username.toLowerCase() === uname);
    if (matchedEmp) {
      const popsArr = matchedEmp.allowedPops
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const chArr = matchedEmp.allowedCashChannels
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      setOperator({
        mode: 'STAFF',
        displayName: matchedEmp.fullName,
        username: matchedEmp.username,
        roleLabel: matchedEmp.role.toUpperCase(),
        allowedPops: popsArr.length ? popsArr : ['ALL'],
        allowedCashChannels: chArr.length ? chArr : ['ALL'],
        canEditPackage: matchedEmp.canEditPackage,
        canCollectCash: matchedEmp.canCollectCash,
        canManageRouter: matchedEmp.canManageRouter,
        canDeleteRecord: matchedEmp.canDeleteRecord,
      });
      setPendingOperatorPreset(null);
      notify(`Active operator session set to Staff: ${matchedEmp.username} (${matchedEmp.role}).`, 'info');
    }
  }, [pendingOperatorPreset, resellers, employees, settings]);

  // Live-sync active STAFF or RESELLER session permissions when updated in Firestore
  useEffect(() => {
    if (operator.mode === 'STAFF') {
      const emp = employees.find((e) => e.username === operator.username);
      if (!emp) return;
      const popsArr = emp.allowedPops
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const chArr = emp.allowedCashChannels
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const nextPops = popsArr.length ? popsArr : ['ALL'];
      const nextCh = chArr.length ? chArr : ['ALL'];
      if (
        operator.canCollectCash !== emp.canCollectCash ||
        operator.canEditPackage !== emp.canEditPackage ||
        operator.canManageRouter !== emp.canManageRouter ||
        operator.canDeleteRecord !== emp.canDeleteRecord ||
        operator.allowedPops.join(',') !== nextPops.join(',') ||
        operator.allowedCashChannels.join(',') !== nextCh.join(',')
      ) {
        setOperator({
          mode: 'STAFF',
          displayName: emp.fullName,
          username: emp.username,
          roleLabel: emp.role.toUpperCase(),
          allowedPops: nextPops,
          allowedCashChannels: nextCh,
          canEditPackage: emp.canEditPackage,
          canCollectCash: emp.canCollectCash,
          canManageRouter: emp.canManageRouter,
          canDeleteRecord: emp.canDeleteRecord,
        });
      }
    } else if (operator.mode === 'RESELLER' && operator.resellerId) {
      const res = resellers.find((r) => r.id === operator.resellerId);
      if (res && (operator.displayName !== res.companyName || operator.allowedPops[0] !== res.popName)) {
        setOperator((prev) => ({
          ...prev,
          displayName: res.companyName,
          allowedPops: [res.popName],
        }));
      }
    }
  }, [employees, resellers, operator]);

  const loginWithEmailPassword = async (
    email: string,
    pass: string,
    preferredPreset = 'RRR CABLE NETWORK'
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail) {
      throw new Error('Please enter a valid administrator email.');
    }
    if (!cleanPass) {
      throw new Error('Please enter your password.');
    }

    if (preferredPreset && preferredPreset.trim()) {
      setPendingOperatorPreset(preferredPreset.trim());
    }

    let authUser: User | null = null;
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      if (cred.user) {
        authUser = cred.user;
      }
    } catch (err) {
      console.info('Direct Firebase Auth returned:', err);
    }

    const uid = authUser ? authUser.uid : `admin_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const sessionUser = authUser || ({
      uid,
      email: cleanEmail,
      displayName: ISP_BRAND_NAME,
      emailVerified: true,
    } as unknown as User);

    setUser(sessionUser);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(
          'rrr_admin_session',
          JSON.stringify({
            uid: sessionUser.uid,
            email: sessionUser.email,
            displayName: sessionUser.displayName || ISP_BRAND_NAME,
          })
        );
      } catch {
        // ignore
      }
    }

    const initialSeed = getInitialSeedData(uid, cleanEmail);
    setSettings(initialSeed.settings);
    setPops(getStoredCollection('pops', initialSeed.pops));
    setPackages(getStoredCollection('packages', initialSeed.packages));
    setRouters(getStoredCollection('routers', initialSeed.routers));
    setResellers(getStoredCollection('resellers', initialSeed.resellers));
    setAllCustomers(getStoredCollection('customers', initialSeed.customers));
    setEmployees(getStoredCollection('employees', initialSeed.employees));
    setTickets(getStoredCollection('tickets', initialSeed.tickets));
    setTasks(getStoredCollection('tasks', initialSeed.tasks));
    setCorporateClients(getStoredCollection('corporateClients', initialSeed.corporateClients));
    setPayments(getStoredCollection('payments', initialSeed.payments));
    setLedgerEntries(getStoredCollection('ledgerEntries', initialSeed.ledgerEntries));
    setOperationalLogs(getStoredCollection('operationalLogs', initialSeed.operationalLogs));

    try {
      await ensureMaximWorkspaceSeeded(uid, cleanEmail);
    } catch (e) {
      console.warn('Workspace seed fallback:', e);
    }

    notify(`Welcome to ${ISP_BRAND_NAME}! Logged in as ${cleanEmail}`, 'success');
    await logAuditEvent(
      uid,
      preferredPreset || cleanEmail,
      'Operator Login',
      `Administrator logged in with email: ${cleanEmail}`
    );
  };

  const loginWithGoogle = async (preferredUsername?: string) => {
    if (preferredUsername && preferredUsername.trim()) {
      setPendingOperatorPreset(preferredUsername.trim());
    }
    const cred = await signInWithPopup(auth, googleProvider);
    if (cred.user) {
      await ensureMaximWorkspaceSeeded(cred.user.uid, cred.user.email || '');
      notify('Authenticated to RRR CABLE NETWORK — ISP Billing & ERP.', 'success');
      await logAuditEvent(
        cred.user.uid,
        preferredUsername?.trim() || cred.user.email || 'Operator',
        'Operator Login',
        `Maestro Keeper verified session login for ${cred.user.email || cred.user.uid}`
      );
    }
  };

  const logout = async () => {
    setOperator(DEFAULT_OPERATOR);
    setPendingOperatorPreset(null);
    setPortalCustomerId(null);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('rrr_admin_session');
      } catch {
        // ignore
      }
    }
    setUser(null);
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    notify('Logged out securely.', 'info');
  };

  const openCustomerSingleView = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveModule('customers_detail');
  };

  const openCashRcvModal = (prefillQuery = '') => {
    setCashRcvPrefill({ open: true, query: prefillQuery });
  };

  const closeCashRcvModal = () => {
    setCashRcvPrefill({ open: false, query: '' });
  };

  const syncAllMikrotikCustomers = async (targetRouter?: MikrotikRouter) => {
    const routerHost = targetRouter?.host || '103.54.37.182';
    const routerPort = targetRouter?.apiPort || 1165;
    const routerUser = targetRouter?.username || 'PENEL';
    const routerPass = targetRouter?.radiusSecret || '03422056';
    const rName = targetRouter?.name || 'RRR CABLE NETWORK';
    const rPop = targetRouter?.popName || 'rashidpur bzzar';

    notify(`মাইক্রোটিক (${routerHost}:${routerPort}) এর সাথে লাইভ কানেক্ট করে সব কাস্টমার সিঙ্ক করা হচ্ছে...`, 'info');

    try {
      const res = await syncMikrotikCustomers({
        host: routerHost,
        apiPort: routerPort,
        username: routerUser,
        password: routerPass,
        routerName: rName,
        defaultPop: rPop,
      });

      if (!res.ok) {
        throw new Error('Sync failed');
      }

      // Merge customers into state and localStorage
      setAllCustomers((prev) => {
        const mikrotikUsernames = new Set(res.customers.map((c) => c.username.toLowerCase()));
        const others = prev.filter((c) => !mikrotikUsernames.has(c.username.toLowerCase()));
        const merged = [...res.customers, ...others];
        saveStoredCollection('customers', merged);
        return merged;
      });

      // Update POPs if new ones found
      if (res.pops && res.pops.length > 0) {
        setPops((prev) => {
          const existing = new Set(prev.map((p) => p.name.toLowerCase()));
          const newPops: PopZone[] = [];
          for (const p of res.pops) {
            if (!existing.has(p.toLowerCase())) {
              newPops.push({
                id: `pop_${p.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                ownerUid: user?.uid || 'local',
                name: p,
                code: `POP-${prev.length + newPops.length + 1}`,
                zoneName: 'RRR CABLE NETWORK',
                oltInfo: 'GPON OLT',
                address: `${p}, Bangladesh`,
                managerName: 'admin',
                status: 'Active',
              });
            }
          }
          if (newPops.length > 0) {
            const updatedPops = [...prev, ...newPops];
            saveStoredCollection('pops', updatedPops);
            return updatedPops;
          }
          return prev;
        });
      }

      // Update Packages if new profiles found
      if (res.profiles && res.profiles.length > 0) {
        setPackages((prev) => {
          const existing = new Set(prev.map((p) => p.name.toLowerCase()));
          const newPkgs: IspPackage[] = [];
          for (const pr of res.profiles) {
            if (!existing.has(pr.toLowerCase())) {
              const mbpsMatch = pr.match(/(\d+)/);
              const mbpsNum = mbpsMatch ? Number(mbpsMatch[1]) : 25;
              const rate = mbpsNum >= 40 ? 1200 : mbpsNum >= 25 ? 800 : 500;
              newPkgs.push({
                id: `pkg_${pr.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                ownerUid: user?.uid || 'local',
                name: pr,
                planType: 'Prepaid',
                serviceType: 'PPPoE',
                downloadMbps: mbpsNum,
                uploadMbps: mbpsNum,
                mikrotikQueue: `Queue-${pr}`,
                monthlyRate: rate,
                resellerRate: Math.round(rate * 0.75),
                poolName: 'pppoe-pool',
                validityDays: 30,
                status: 'Active',
              });
            }
          }
          if (newPkgs.length > 0) {
            const updatedPkgs = [...prev, ...newPkgs];
            saveStoredCollection('packages', updatedPkgs);
            return updatedPkgs;
          }
          return prev;
        });
      }

      // Update router active sessions
      setRouters((prev) => {
        let found = false;
        const updated = prev.map((r) => {
          if (r.host === routerHost || r.name === rName) {
            found = true;
            return {
              ...r,
              status: 'Connected' as const,
              mode: 'Live' as const,
              activeSessions: res.onlineCount,
            };
          }
          return r;
        });
        if (!found) {
          updated.unshift({
            id: 'rtr_rrr_network',
            ownerUid: user?.uid || 'local',
            name: rName,
            host: routerHost,
            apiPort: routerPort,
            username: routerUser,
            popName: rPop,
            model: 'RB750Gr3 (hEX)',
            rosVersion: '6.49.20 (long-term)',
            mode: 'Live',
            radiusSecret: routerPass,
            status: 'Connected',
            activeSessions: res.onlineCount,
            cpuLoad: 3,
            uptime: 'Active',
          });
        }
        saveStoredCollection('routers', updated);
        return updated;
      });

      notify(
        `সফলভাবে MikroTik থেকে ${res.totalSecrets} জন কাস্টমার সিঙ্ক হয়েছে! (অনলাইন: ${res.onlineCount}, অফলাইন: ${res.offlineCount}, লক/ডিজেবল: ${res.disabledCount})`,
        'success'
      );

      return {
        count: res.totalSecrets,
        online: res.onlineCount,
        offline: res.offlineCount,
        disabled: res.disabledCount,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(`MikroTik সিঙ্ক ব্যর্থ: ${msg}`, 'error');
      throw err;
    }
  };

  return (
    <MaximContext.Provider
      value={{
        user,
        authReady,
        seeding,
        surface,
        setSurface,
        activeModule,
        setActiveModule,
        selectedCustomerId,
        setSelectedCustomerId,
        bulkCustomerIds,
        setBulkCustomerIds,
        operator,
        setOperator,
        portalCustomerId,
        setPortalCustomerId,
        settings,
        pops,
        packages,
        routers,
        allCustomers,
        visibleCustomers,
        resellers,
        employees,
        payments,
        tickets,
        visibleTickets,
        tasks,
        corporateClients,
        ledgerEntries,
        operationalLogs,
        loginWithEmailPassword,
        loginWithGoogle,
        logout,
        notify,
        toasts,
        dismissToast,
        openCustomerSingleView,
        cashRcvPrefill,
        openCashRcvModal,
        closeCashRcvModal,
        syncAllMikrotikCustomers,
      }}
    >
      {children}
    </MaximContext.Provider>
  );
}

export function useMaxim() {
  const ctx = useContext(MaximContext);
  if (!ctx) {
    throw new Error('useMaxim must be used inside MaximProvider');
  }
  return ctx;
}
