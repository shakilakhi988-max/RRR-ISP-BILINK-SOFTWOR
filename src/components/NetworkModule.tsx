import React, { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSearch,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Router,
  Scissors,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  Ticket,
  Trash2,
  Unlock,
  Wifi,
  X,
} from 'lucide-react';
import { useMaxim } from '../context/MaximContext';
import {
  createIspPackage,
  createMikrotikRouter,
  createOperationalLog,
  createPopZone,
  deleteDocumentByPath,
  formatBrandName,
  formatShortDateTime,
  invokeMikrotikApi,
  logAuditEvent,
  saveWorkspaceSettings,
  updateCustomer,
  updateIspPackage,
  updateMikrotikRouter,
  updateOperationalLog,
  updatePopZone,
} from '../services/maximService';
import type { IspPackage, MikrotikRouter, PopZone } from '../types';
import hotspotImg from '../assets/images/maxim_hotspot_network_1793636053751.jpg';

function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8;') {
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

export function NetworkModule() {
  const {
    user,
    settings,
    activeModule,
    packages,
    routers,
    pops,
    visibleCustomers,
    operationalLogs,
    operator,
    notify,
    openCustomerSingleView,
    syncAllMikrotikCustomers,
  } = useMaxim();

  // 1. Packages & Bandwidth State
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<IspPackage | null>(null);
  const [confirmDeletePkgId, setConfirmDeletePkgId] = useState<string | null>(null);
  const [pkgSearch, setPkgSearch] = useState('');
  const [pkgForm, setPkgForm] = useState({
    name: '',
    planType: 'Prepaid' as IspPackage['planType'],
    serviceType: 'PPPoE' as IspPackage['serviceType'],
    downloadMbps: 10,
    uploadMbps: 10,
    mikrotikQueue: '10M_Shared_Queue',
    monthlyRate: 800,
    resellerRate: 640,
    poolName: 'pppoe-pool-mirpur',
    validityDays: 30,
    status: 'Active' as IspPackage['status'],
  });

  // 2. MikroTik NAS Routers State
  const [showRouterForm, setShowRouterForm] = useState(false);
  const [editingRouter, setEditingRouter] = useState<MikrotikRouter | null>(null);
  const [confirmDeleteRouterId, setConfirmDeleteRouterId] = useState<string | null>(null);
  const [routerTestResult, setRouterTestResult] = useState<Record<string, string>>({});
  const [syncingRouterId, setSyncingRouterId] = useState<string | null>(null);
  const [testingRouterForm, setTestingRouterForm] = useState(false);
  const [routerFormTestStatus, setRouterFormTestStatus] = useState<string | null>(null);
  const [showRouterPassword, setShowRouterPassword] = useState(false);
  const [cliTargetRouter, setCliTargetRouter] = useState('');
  const [cliAction, setCliAction] = useState('sync');
  const [cliUsername, setCliUsername] = useState('Mizan');
  const [cliTranscript, setCliTranscript] = useState<string[]>([
    '# RRR CABLE NETWORK — RouterOS v6 & Dual-RADIUS Provisioning Console Ready',
    '# Select a NAS Router and subscriber username to inspect live API commands',
  ]);
  const [routerForm, setRouterForm] = useState({
    name: 'RRR CABLE NETWORK',
    deviceType: 'Router',
    vendor: 'MikroTik',
    host: '103.54.37.182',
    apiPort: 1165,
    username: 'PENEL',
    popName: 'rashidpur bzzar',
    model: 'RB750Gr3 (hEX)',
    rosVersion: '6.49.20 (long-term)',
    mode: 'Live' as MikrotikRouter['mode'],
    radiusSecret: '03422056',
    status: 'Connected' as MikrotikRouter['status'],
    useSsl: false,
    activeSessions: 60,
    cpuLoad: 3,
    uptime: '17h 25m',
  });

  // 2B. PPPoE Secrets & Active Sessions State
  const [pppoeSearch, setPppoeSearch] = useState('');
  const [pppoeRouterFilter, setPppoeRouterFilter] = useState('ALL');
  const [pppoeStateFilter, setPppoeStateFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'LOCKED'>('ALL');

  // 3. Hotspot & Vouchers State
  const [voucherBatchCount, setVoucherBatchCount] = useState(5);
  const [voucherProfile, setVoucherProfile] = useState('Hotspot-1Day-20Mbps');
  const [voucherPrice, setVoucherPrice] = useState(30);
  const [voucherPop, setVoucherPop] = useState('Mirpur-POP');
  const [voucherValidity, setVoucherValidity] = useState('24 Hours');
  const [roamingEnabled, setRoamingEnabled] = useState(true);
  const [otpLoginEnabled, setOtpLoginEnabled] = useState(true);
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<'ALL' | 'Available' | 'Sold / Active'>('ALL');
  const [confirmDeleteVoucherId, setConfirmDeleteVoucherId] = useState<string | null>(null);

  // 4. POP & Zone State
  const [showPopForm, setShowPopForm] = useState(false);
  const [editingPop, setEditingPop] = useState<PopZone | null>(null);
  const [popSearch, setPopSearch] = useState('');
  const [popStatusFilter, setPopStatusFilter] = useState<'ALL' | 'Active' | 'Maintenance' | 'Inactive'>('ALL');
  const [confirmDeletePopId, setConfirmDeletePopId] = useState<string | null>(null);
  const [popForm, setPopForm] = useState({
    name: '',
    code: '',
    zoneName: '',
    oltInfo: 'VSOL 8-Port GPON OLT',
    address: 'Dhaka, Bangladesh',
    managerName: 'demooperation',
    status: 'Active' as PopZone['status'],
  });

  // 5. Maestro IP Log (BTRC Compliance) State
  const [ipLogSearch, setIpLogSearch] = useState('');
  const [confirmDeleteIpLogId, setConfirmDeleteIpLogId] = useState<string | null>(null);
  const [simLogUser, setSimLogUser] = useState('Mizan');
  const [simSrcIp, setSimSrcIp] = useState('10.20.14.55:51422');
  const [simNatIp, setSimNatIp] = useState('103.114.200.18:40120');
  const [simDstIp, setSimDstIp] = useState('142.250.193.110:443');

  const hotspotVouchers = useMemo(
    () => operationalLogs.filter((l) => l.logCategory === 'hotspot_voucher'),
    [operationalLogs]
  );

  const ipLogs = useMemo(() => {
    const raw = operationalLogs.filter((l) => l.logCategory === 'ip_log');
    if (!ipLogSearch.trim()) return raw;
    const q = ipLogSearch.toLowerCase();
    return raw.filter(
      (l) =>
        l.actor.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.metaOne.toLowerCase().includes(q)
    );
  }, [operationalLogs, ipLogSearch]);

  // =========================================================================
  // VIEW 1: PACKAGES & BANDWIDTH QUEUES
  // =========================================================================
  if (activeModule === 'packages') {
    const filteredPkgs = packages.filter(
      (p) =>
        !pkgSearch.trim() ||
        p.name.toLowerCase().includes(pkgSearch.toLowerCase()) ||
        p.mikrotikQueue.toLowerCase().includes(pkgSearch.toLowerCase()) ||
        p.serviceType.toLowerCase().includes(pkgSearch.toLowerCase())
    );

    const openCreatePkg = () => {
      setEditingPkg(null);
      setPkgForm({
        name: '',
        planType: 'Prepaid',
        serviceType: 'PPPoE',
        downloadMbps: 15,
        uploadMbps: 15,
        mikrotikQueue: '15M_Home_Queue',
        monthlyRate: 1000,
        resellerRate: 800,
        poolName: 'pppoe-pool-mirpur',
        validityDays: 30,
        status: 'Active',
      });
      setShowPkgForm(true);
    };

    const openEditPkg = (p: IspPackage) => {
      setEditingPkg(p);
      setPkgForm({
        name: p.name,
        planType: p.planType,
        serviceType: p.serviceType,
        downloadMbps: p.downloadMbps,
        uploadMbps: p.uploadMbps,
        mikrotikQueue: p.mikrotikQueue,
        monthlyRate: p.monthlyRate,
        resellerRate: p.resellerRate,
        poolName: p.poolName,
        validityDays: p.validityDays,
        status: p.status,
      });
      setShowPkgForm(true);
    };

    const handleSavePkg = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!operator.canEditPackage) {
        notify('Your staff role does not have Package Edit permission.', 'error');
        return;
      }
      if (editingPkg) {
        await updateIspPackage(editingPkg.id, pkgForm);
        await logAuditEvent(user.uid, operator.username, 'Updated ISP Package', `Modified package ${pkgForm.name} (BDT ${pkgForm.monthlyRate})`, pkgForm.name);
        notify(`Updated package ${pkgForm.name}.`, 'success');
      } else {
        await createIspPackage(user.uid, pkgForm);
        await logAuditEvent(user.uid, operator.username, 'Created ISP Package', `Created package ${pkgForm.name} (${pkgForm.downloadMbps}Mbps)`, pkgForm.name);
        notify(`Created package ${pkgForm.name}.`, 'success');
      }
      setShowPkgForm(false);
    };

    return (
      <div className="space-y-3">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">Packages &amp; Plans</span>
            <span className="mx-1.5">/</span>
            <span>Bandwidth Profiles &amp; MikroTik Queues</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pkgSearch}
              onChange={(e) => setPkgSearch(e.target.value)}
              placeholder="Filter packages or queues..."
              className="px-2.5 py-1 border border-slate-300 rounded-xs text-xs bg-white"
            />
            <button
              type="button"
              onClick={openCreatePkg}
              className="px-3 py-1 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-semibold rounded-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Package
            </button>
          </div>
        </div>

        {showPkgForm && (
          <form onSubmit={handleSavePkg} className="bg-[#f8f9fa] border border-slate-300 p-4 rounded-xs text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="font-bold text-slate-800 uppercase">
                {editingPkg ? `Edit Package: ${editingPkg.name}` : 'Create New ISP Package & MikroTik Profile'}
              </span>
              <button type="button" onClick={() => setShowPkgForm(false)} className="text-slate-500 hover:text-black cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Package Name *</label>
                <input
                  type="text"
                  required
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                  placeholder="e.g. 20Mbps Turbo"
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plan Type</label>
                <select
                  value={pkgForm.planType}
                  onChange={(e) => setPkgForm({ ...pkgForm, planType: e.target.value as IspPackage['planType'] })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                >
                  <option value="Prepaid">Prepaid</option>
                  <option value="Postpaid">Postpaid</option>
                  <option value="Hotspot">Hotspot</option>
                  <option value="Corporate">Corporate</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Protocol</label>
                <select
                  value={pkgForm.serviceType}
                  onChange={(e) => setPkgForm({ ...pkgForm, serviceType: e.target.value as IspPackage['serviceType'] })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                >
                  <option value="PPPoE">PPPoE</option>
                  <option value="Hotspot">Hotspot</option>
                  <option value="Static IP">Static IP</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">MikroTik Queue / Profile</label>
                <input
                  type="text"
                  value={pkgForm.mikrotikQueue}
                  onChange={(e) => setPkgForm({ ...pkgForm, mikrotikQueue: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Download (Mbps)</label>
                <input
                  type="number"
                  min={1}
                  value={pkgForm.downloadMbps}
                  onChange={(e) => setPkgForm({ ...pkgForm, downloadMbps: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Upload (Mbps)</label>
                <input
                  type="number"
                  min={1}
                  value={pkgForm.uploadMbps}
                  onChange={(e) => setPkgForm({ ...pkgForm, uploadMbps: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Monthly Rate (BDT)</label>
                <input
                  type="number"
                  min={0}
                  value={pkgForm.monthlyRate}
                  onChange={(e) => setPkgForm({ ...pkgForm, monthlyRate: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reseller SDT Rate (BDT)</label>
                <input
                  type="number"
                  min={0}
                  value={pkgForm.resellerRate}
                  onChange={(e) => setPkgForm({ ...pkgForm, resellerRate: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">IP Pool Name</label>
                <input
                  type="text"
                  value={pkgForm.poolName}
                  onChange={(e) => setPkgForm({ ...pkgForm, poolName: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Validity (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={pkgForm.validityDays}
                  onChange={(e) => setPkgForm({ ...pkgForm, validityDays: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={pkgForm.status}
                  onChange={(e) => setPkgForm({ ...pkgForm, status: e.target.value as IspPackage['status'] })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                >
                  <option value="Active">Active</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#007bff] hover:bg-blue-700 text-white font-semibold rounded-xs cursor-pointer"
                >
                  {editingPkg ? 'Save Package' : 'Create Package'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto border border-slate-300 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="px-2.5 py-2 text-left">Package Name</th>
                <th className="px-2.5 py-2 text-left">Plan Type</th>
                <th className="px-2.5 py-2 text-left">Protocol</th>
                <th className="px-2.5 py-2 text-right">Speed (DL / UL)</th>
                <th className="px-2.5 py-2 text-left">MikroTik Queue / Profile</th>
                <th className="px-2.5 py-2 text-left">IP Pool</th>
                <th className="px-2.5 py-2 text-right">Retail Rate</th>
                <th className="px-2.5 py-2 text-right">SDT Rate</th>
                <th className="px-2.5 py-2 text-right">Subscribers</th>
                <th className="px-2.5 py-2 text-center">Status</th>
                <th className="px-2.5 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPkgs.map((p) => {
                const subCount = visibleCustomers.filter((c) => c.packageName === p.name || c.packageId === p.id).length;
                return (
                  <tr key={p.id} className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 font-bold text-[#007bff]">{p.name}</td>
                    <td className="px-2.5 py-2">{p.planType}</td>
                    <td className="px-2.5 py-2 font-mono">{p.serviceType}</td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                      {p.downloadMbps}M / {p.uploadMbps}M
                    </td>
                    <td className="px-2.5 py-2 font-mono text-slate-700">{p.mikrotikQueue}</td>
                    <td className="px-2.5 py-2 font-mono text-slate-600">{p.poolName}</td>
                    <td className="px-2.5 py-2 text-right font-mono font-bold tabular-nums">
                      BDT {p.monthlyRate.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums text-emerald-700">
                      BDT {p.resellerRate.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums font-semibold">{subCount}</td>
                    <td className="px-2.5 py-2 text-center">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-xs ${
                          p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditPkg(p)}
                          title="Edit Package"
                          className="p-1 text-[#007bff] hover:bg-blue-50 rounded cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {operator.canDeleteRecord && (
                          confirmDeletePkgId === p.id ? (
                            <span className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteDocumentByPath('packages', p.id);
                                  setConfirmDeletePkgId(null);
                                  notify(`Deleted package ${p.name}.`, 'info');
                                }}
                                className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePkgId(null)}
                                className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded-xs text-[10px] cursor-pointer"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePkgId(p.id)}
                              title="Delete Package"
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
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: MIKROTIK ROUTEROS & RADIUS NAS MANAGEMENT
  // =========================================================================
  if (activeModule === 'routers') {
    const handleTestRouter = async (r: MikrotikRouter) => {
      setRouterTestResult((prev) => ({ ...prev, [r.id]: 'Testing RouterOS API handshake...' }));
      try {
        const res = await fetch('/api/mikrotik/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: r.host,
            apiPort: r.apiPort,
            username: r.username,
            password: r.radiusSecret,
            mode: r.mode,
            name: r.name,
            model: r.model,
          }),
        });
        const data = await res.json();
        await updateMikrotikRouter(r.id, {
          status: data.connected ? 'Connected' : 'Disconnected',
          cpuLoad: typeof data.cpuLoad === 'number' ? data.cpuLoad : r.cpuLoad,
          uptime: data.uptime || r.uptime,
          activeSessions: typeof data.activeSessions === 'number' ? data.activeSessions : r.activeSessions,
          rosVersion: data.rosVersion || r.rosVersion,
          model: data.model || r.model,
        });
        setRouterTestResult((prev) => ({ ...prev, [r.id]: data.message }));
        notify(data.message, data.connected ? 'success' : 'error');
      } catch {
        setRouterTestResult((prev) => ({ ...prev, [r.id]: 'Router test request failed.' }));
        notify('Router test request failed.', 'error');
      }
    };

    const handleTestRouterFromForm = async () => {
      setTestingRouterForm(true);
      setRouterFormTestStatus('Testing RouterOS API socket connection...');
      try {
        const res = await fetch('/api/mikrotik/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: routerForm.host,
            apiPort: routerForm.apiPort,
            username: routerForm.username,
            password: routerForm.radiusSecret,
            name: routerForm.name,
          }),
        });
        const data = await res.json();
        setRouterFormTestStatus(data.message);
        if (data.connected) {
          setRouterForm((prev) => ({
            ...prev,
            status: 'Connected',
            model: data.model || prev.model,
            rosVersion: data.rosVersion || prev.rosVersion,
            cpuLoad: typeof data.cpuLoad === 'number' ? data.cpuLoad : prev.cpuLoad,
            uptime: data.uptime || prev.uptime,
            activeSessions: typeof data.activeSessions === 'number' ? data.activeSessions : prev.activeSessions,
          }));
          notify(data.message, 'success');
        } else {
          notify(data.message, 'error');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setRouterFormTestStatus(`Error: ${msg}`);
        notify(`Router test failed: ${msg}`, 'error');
      } finally {
        setTestingRouterForm(false);
      }
    };

    const handleSyncRouter = async (r: MikrotikRouter) => {
      setSyncingRouterId(r.id);
      try {
        const res = await syncAllMikrotikCustomers(r);
        notify(
          `মাইক্রোটিক (${r.name}) থেকে সফলভাবে ${res.count} জন কাস্টমার সিঙ্ক হয়েছে! (অনলাইন: ${res.online}, অফলাইন: ${res.offline}, লক/ডিজেবল: ${res.disabled})`,
          'success'
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        notify(`সিঙ্ক ব্যর্থ: ${msg}`, 'error');
      } finally {
        setSyncingRouterId(null);
      }
    };

    const handleSaveRouter = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!operator.canManageRouter) {
        notify('Your staff role is restricted from modifying NAS Routers.', 'error');
        return;
      }
      if (editingRouter) {
        await updateMikrotikRouter(editingRouter.id, routerForm);
        notify(`Updated NAS router ${routerForm.name}.`, 'success');
      } else {
        await createMikrotikRouter(user.uid, routerForm);
        notify(`Added NAS router ${routerForm.name}.`, 'success');
      }
      setShowRouterForm(false);
    };

    const handleExportRsc = async () => {
      const res = await fetch('/api/mikrotik/export-rsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formatBrandName(settings?.companyName),
          packages,
          customers: visibleCustomers,
        }),
      });
      const text = await res.text();
      downloadTextFile(`rrr_cable_mikrotik_backup_${new Date().toISOString().slice(0, 10)}.rsc`, text);
      notify('Downloaded MikroTik RouterOS (.rsc) profile & PPPoE secret backup.', 'success');
    };

    const handleRunRouterCommand = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!operator.canManageRouter) {
        notify('Your operator role is restricted from dispatching NAS CLI/CoA commands.', 'error');
        return;
      }
      const targetName = cliTargetRouter || routers[0]?.name || 'Mirpur-Core-CCR1036';
      const targetObj = routers.find((r) => r.name === targetName);
      const targetSub = visibleCustomers.find((c) => c.username === cliUsername) || visibleCustomers[0];
      const result = await invokeMikrotikApi({
        action: cliAction,
        username: cliUsername || targetSub?.username || 'Mizan',
        packageName: targetSub?.packageName || '10Mbps',
        ipAddress: targetSub?.ipAddress || '10.20.1.50',
        macAddress: targetSub?.macAddress || 'D4:CA:6D:91:22:0B',
        routerName: targetName,
        routerHost: targetObj?.host,
        routerPort: targetObj?.apiPort,
        sandbox: targetObj ? targetObj.mode === 'Sandbox' : true,
      });
      setCliTranscript((prev) => [
        ...prev.slice(-10),
        `[${new Date().toLocaleTimeString()}] NAS=${targetName} (${result.latencyMs}ms):`,
        ...result.transcript.map((cmd) => `  > ${cmd}`),
      ]);
      notify(`Dispatched ${cliAction} to ${targetName} (${result.latencyMs}ms).`, 'success');
    };

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">MikroTik &amp; RADIUS</span>
            <span className="mx-1.5">/</span>
            <span>NAS Routers, Dual-RADIUS Failover &amp; Safe Sandbox</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const primary = routers.find((r) => r.host === '103.54.37.182') || routers[0];
                if (primary) handleSyncRouter(primary);
              }}
              disabled={Boolean(syncingRouterId)}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold rounded-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
              title="Connect to 103.54.37.182:1165 and import all customers"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingRouterId ? 'animate-spin' : ''}`} />
              {syncingRouterId ? 'সিঙ্ক হচ্ছে...' : '1-Click Sync All Customers (100% Real)'}
            </button>
            <button
              type="button"
              onClick={handleExportRsc}
              className="px-2.5 py-1 bg-[#17a2b8] hover:bg-cyan-700 text-white text-xs font-semibold rounded-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export .rsc Backup
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRouter(null);
                setRouterForm({
                  name: 'RRR CABLE NETWORK',
                  deviceType: 'Router',
                  vendor: 'MikroTik',
                  host: '103.54.37.182',
                  apiPort: 1165,
                  username: 'PENEL',
                  popName: 'rashidpur bzzar',
                  model: 'RB750Gr3 (hEX)',
                  rosVersion: '6.49.20 (long-term)',
                  mode: 'Live',
                  radiusSecret: '03422056',
                  status: 'Connected',
                  useSsl: false,
                  activeSessions: 60,
                  cpuLoad: 3,
                  uptime: '17h 25m',
                });
                setShowRouterForm(true);
              }}
              className="px-3 py-1 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-semibold rounded-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add MikroTik NAS
            </button>
          </div>
        </div>

        {/* Safe Sandbox Mode Banner */}
        <div className="bg-[#eef6fb] border border-[#b8daff] px-3.5 py-2.5 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-800">
            <ShieldCheck className="w-4 h-4 text-[#007bff] shrink-0" />
            <span>
              <strong>Safe RouterOS Development Sandbox:</strong> Routers in{' '}
              <span className="font-mono font-semibold">Sandbox</span> mode validate all PPPoE, Hotspot, Queue, and CoA disconnect commands safely without disrupting live production links. Switch a router to{' '}
              <span className="font-mono font-semibold">Live</span> mode to test real TCP API reachability on port 8728/8729.
            </span>
          </div>
          {settings && user && (
            <button
              type="button"
              onClick={async () => {
                if (!operator.canManageRouter) {
                  notify('Your operator role cannot change global Router Sandbox settings.', 'error');
                  return;
                }
                await saveWorkspaceSettings(user.uid, { routerSandboxMode: !settings.routerSandboxMode });
                notify(`Default Router Sandbox Mode ${!settings.routerSandboxMode ? 'Enabled' : 'Disabled'}.`, 'info');
              }}
              className="px-2.5 py-1 bg-white border border-slate-400 rounded-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer"
            >
              Default Mode: {settings.routerSandboxMode ? 'Sandbox Safe' : 'Live Production'}
            </button>
          )}
        </div>

        {showRouterForm && (
          <form onSubmit={handleSaveRouter} className="bg-white border border-slate-300 rounded shadow-sm text-xs space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  {editingRouter ? 'Edit Network Device' : 'Register Network Device'}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Devices &gt; {editingRouter ? 'Edit Device' : 'New Device'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRouterForm(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Basic Information (Screenshot 1) */}
            <div className="border border-slate-200 rounded p-4 bg-slate-50/50 space-y-3">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
                Basic Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Device Name *</label>
                  <input
                    type="text"
                    required
                    value={routerForm.name}
                    onChange={(e) => setRouterForm({ ...routerForm, name: e.target.value })}
                    placeholder="RRR CABLE NETWORK"
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded text-sm focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Device Type *</label>
                  <select
                    value={routerForm.deviceType || 'Router'}
                    onChange={(e) => setRouterForm({ ...routerForm, deviceType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded text-sm"
                  >
                    <option value="Router">Router</option>
                    <option value="Switch">Switch</option>
                    <option value="OLT">OLT</option>
                    <option value="Server">Server</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Vendor *</label>
                  <select
                    value={routerForm.vendor || 'MikroTik'}
                    onChange={(e) => setRouterForm({ ...routerForm, vendor: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded text-sm"
                  >
                    <option value="MikroTik">MikroTik</option>
                    <option value="Cisco">Cisco</option>
                    <option value="Huawei">Huawei</option>
                    <option value="BDCOM">BDCOM</option>
                    <option value="VSOL">VSOL</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Status *</label>
                  <select
                    value={routerForm.status}
                    onChange={(e) => setRouterForm({ ...routerForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded text-sm"
                  >
                    <option value="Active">Active</option>
                    <option value="Connected">Connected</option>
                    <option value="Disconnected">Disconnected</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block font-semibold mb-1 text-slate-700">Location Area *</label>
                  <input
                    type="text"
                    required
                    value={routerForm.popName}
                    onChange={(e) => setRouterForm({ ...routerForm, popName: e.target.value })}
                    placeholder="rashidpur bzzar"
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded text-sm focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Network Configuration (for Sync) (Screenshot 2) */}
            <div className="border border-slate-200 rounded p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Network Configuration (for Sync)
                </h4>
                <button
                  type="button"
                  onClick={handleTestRouterFromForm}
                  disabled={testingRouterForm}
                  className="px-3 py-1.5 bg-[#007bff] hover:bg-blue-600 text-white rounded font-medium text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Cpu className={`w-3.5 h-3.5 ${testingRouterForm ? 'animate-spin' : ''}`} />
                  {testingRouterForm ? 'Connecting...' : 'Test Connection'}
                </button>
              </div>

              {routerFormTestStatus && (
                <div
                  className={`p-3 rounded text-xs flex items-start gap-2 ${
                    routerFormTestStatus.includes('Verified') || routerFormTestStatus.includes('100%')
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                      : 'bg-amber-50 border border-amber-300 text-amber-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <div>
                    <div className="font-bold">Test Status:</div>
                    <div>{routerFormTestStatus}</div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">
                    IP Address / Domain (Hostname) *
                  </label>
                  <input
                    type="text"
                    required
                    value={routerForm.host}
                    onChange={(e) => setRouterForm({ ...routerForm, host: e.target.value })}
                    placeholder="103.54.37.182"
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded text-sm font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700">
                    API Port (Default: 8728)
                  </label>
                  <input
                    type="number"
                    value={routerForm.apiPort}
                    onChange={(e) => setRouterForm({ ...routerForm, apiPort: Number(e.target.value) })}
                    placeholder="1165"
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded text-sm font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    MikroTik API port. Standard is 8728. For custom ports, specify here (e.g. 1165 / 7757).
                  </p>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700">API Username</label>
                  <input
                    type="text"
                    value={routerForm.username}
                    onChange={(e) => setRouterForm({ ...routerForm, username: e.target.value })}
                    placeholder="PENEL"
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded text-sm font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700">API Password</label>
                  <div className="relative">
                    <input
                      type={showRouterPassword ? 'text' : 'password'}
                      value={routerForm.radiusSecret}
                      onChange={(e) => setRouterForm({ ...routerForm, radiusSecret: e.target.value })}
                      placeholder="03422056"
                      className="w-full px-3 py-2 pr-10 border border-slate-300 bg-white rounded text-sm font-mono focus:border-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRouterPassword(!showRouterPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showRouterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Leave blank only if keeping current password. If updating to Real IP, please enter the MikroTik password (e.g. 03422056).
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useSslToggle"
                      checked={Boolean(routerForm.useSsl)}
                      onChange={(e) => setRouterForm({ ...routerForm, useSsl: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <label htmlFor="useSslToggle" className="text-slate-700 font-medium select-none cursor-pointer">
                      Use API-SSL (Secure Connection - Port 8729)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-slate-600 font-medium">Mode:</label>
                    <select
                      value={routerForm.mode}
                      onChange={(e) => setRouterForm({ ...routerForm, mode: e.target.value as any })}
                      className="px-2 py-1 border border-slate-300 bg-white rounded text-xs font-semibold"
                    >
                      <option value="Live">Live (100% Real)</option>
                      <option value="Sandbox">Sandbox (Simulation)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await syncAllMikrotikCustomers({
                      id: editingRouter?.id || 'rtr_rrr_network',
                      ownerUid: user?.uid || 'local',
                      name: routerForm.name,
                      host: routerForm.host,
                      apiPort: routerForm.apiPort,
                      username: routerForm.username,
                      radiusSecret: routerForm.radiusSecret,
                      popName: routerForm.popName,
                      model: routerForm.model,
                      rosVersion: routerForm.rosVersion,
                      mode: routerForm.mode,
                      status: 'Connected',
                      activeSessions: routerForm.activeSessions,
                      cpuLoad: routerForm.cpuLoad,
                      uptime: routerForm.uptime,
                    });
                    setShowRouterForm(false);
                  } catch {
                    // Toast handled by syncAllMikrotikCustomers
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" /> Sync All Secrets / Customers Now (100% Real)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRouterForm(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#007bff] hover:bg-blue-600 text-white font-bold rounded shadow-xs cursor-pointer"
                >
                  {editingRouter ? 'Update Network Device' : 'Save Network Device'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto border border-slate-300 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="px-2.5 py-2 text-left">NAS Identity</th>
                <th className="px-2.5 py-2 text-left">Host : API Port</th>
                <th className="px-2.5 py-2 text-left">POP</th>
                <th className="px-2.5 py-2 text-left">Hardware / ROS</th>
                <th className="px-2.5 py-2 text-center">Mode</th>
                <th className="px-2.5 py-2 text-right">Active PPPoE</th>
                <th className="px-2.5 py-2 text-right">CPU</th>
                <th className="px-2.5 py-2 text-left">Uptime</th>
                <th className="px-2.5 py-2 text-center">Status</th>
                <th className="px-2.5 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {routers.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="hover:bg-amber-50/40">
                    <td className="px-2.5 py-2 font-bold text-slate-900 flex items-center gap-1.5">
                      <Router className="w-3.5 h-3.5 text-[#007bff]" /> {r.name}
                    </td>
                    <td className="px-2.5 py-2 font-mono">
                      {r.host}:{r.apiPort}
                    </td>
                    <td className="px-2.5 py-2">{r.popName}</td>
                    <td className="px-2.5 py-2">
                      {r.model} <span className="text-slate-500 font-mono">v{r.rosVersion}</span>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!operator.canManageRouter) {
                            notify('Your operator role cannot switch NAS execution mode.', 'error');
                            return;
                          }
                          const nextMode = r.mode === 'Sandbox' ? 'Live' : 'Sandbox';
                          await updateMikrotikRouter(r.id, { mode: nextMode });
                          notify(`Switched ${r.name} to ${nextMode} mode.`, 'info');
                        }}
                        className={`px-2 py-0.5 rounded-xs font-mono text-[11px] font-semibold cursor-pointer ${
                          r.mode === 'Sandbox'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-400'
                        }`}
                      >
                        {r.mode}
                      </button>
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums font-bold">{r.activeSessions}</td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">{r.cpuLoad}%</td>
                    <td className="px-2.5 py-2 font-mono text-slate-600">{r.uptime}</td>
                    <td className="px-2.5 py-2 text-center">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-xs ${
                          r.status === 'Connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSyncRouter(r)}
                          disabled={syncingRouterId === r.id}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs text-[11px] font-bold whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-xs"
                          title="1-Click Real Sync: Pull all secrets and active PPPoE sessions from this MikroTik"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingRouterId === r.id ? 'animate-spin' : ''}`} />
                          {syncingRouterId === r.id ? 'Syncing...' : 'Sync (100% Real)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestRouter(r)}
                          className="px-2 py-0.5 bg-[#17a2b8] hover:bg-cyan-700 text-white rounded-xs text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                        >
                          Test API
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRouter(r);
                            setRouterForm({
                              name: r.name,
                              deviceType: 'Router',
                              vendor: 'MikroTik',
                              host: r.host,
                              apiPort: r.apiPort,
                              username: r.username,
                              popName: r.popName,
                              model: r.model,
                              rosVersion: r.rosVersion,
                              mode: r.mode,
                              radiusSecret: r.radiusSecret,
                              status: r.status,
                              useSsl: false,
                              activeSessions: r.activeSessions,
                              cpuLoad: r.cpuLoad,
                              uptime: r.uptime,
                            });
                            setShowRouterForm(true);
                          }}
                          className="p-1 text-[#007bff] hover:bg-blue-50 rounded cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {operator.canDeleteRecord && (
                          confirmDeleteRouterId === r.id ? (
                            <span className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteDocumentByPath('routers', r.id);
                                  setConfirmDeleteRouterId(null);
                                  notify(`Removed router ${r.name}.`, 'info');
                                }}
                                className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRouterId(null)}
                                className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded-xs text-[10px] cursor-pointer"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRouterId(r.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                  {routerTestResult[r.id] && (
                    <tr className="bg-slate-50">
                      <td colSpan={10} className="px-3 py-1.5 font-mono text-[11px] text-slate-700">
                        <Cpu className="w-3.5 h-3.5 inline mr-1.5 text-[#007bff]" />
                        {routerTestResult[r.id]}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Live RouterOS Provisioning & CoA Console */}
        <div className="border border-slate-300 bg-white rounded-xs overflow-hidden">
          <div className="maxim-mint-banner flex items-center justify-between px-3">
            <span>ROUTEROS API &amp; RADIUS CoA PROVISIONING TESTER</span>
            <Terminal className="w-4 h-4 text-slate-700" />
          </div>
          <div className="p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            <form onSubmit={handleRunRouterCommand} className="lg:col-span-5 space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target MikroTik NAS</label>
                <select
                  value={cliTargetRouter || routers[0]?.name || ''}
                  onChange={(e) => setCliTargetRouter(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-xs"
                >
                  {routers.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.host})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Subscriber Username</label>
                <select
                  value={cliUsername}
                  onChange={(e) => setCliUsername(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-xs font-mono"
                >
                  {visibleCustomers.map((c) => (
                    <option key={c.id} value={c.username}>
                      {c.username} ({c.packageName} — {c.lockStatus})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">RouterOS API Operation</label>
                <select
                  value={cliAction}
                  onChange={(e) => setCliAction(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-xs"
                >
                  <option value="sync">Inspect PPPoE Secret (/ppp/secret/print)</option>
                  <option value="disconnect">CoA Disconnect Active Session</option>
                  <option value="lock">Suspend / Lock Subscriber Profile</option>
                  <option value="unlock">Reactivate / Unlock Subscriber Profile</option>
                  <option value="change_package">Sync Simple Queue &amp; PPP Profile</option>
                  <option value="bind_mac">Bind Subscriber Caller-ID MAC</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-1.5 bg-[#007bff] hover:bg-blue-700 text-white font-semibold rounded-xs cursor-pointer"
              >
                Execute RouterOS API Command
              </button>
            </form>

            <div className="lg:col-span-7 bg-[#16191d] text-emerald-400 font-mono text-[11px] p-3 rounded-xs min-h-[175px] max-h-[220px] overflow-y-auto space-y-1">
              {cliTranscript.map((line, i) => (
                <div key={i} className="leading-relaxed">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2B: PPPoE SECRETS & ACTIVE SESSIONS MANAGEMENT
  // =========================================================================
  if (activeModule === 'pppoe_sessions') {
    const filteredPppoe = visibleCustomers.filter((c) => {
      if (pppoeRouterFilter !== 'ALL' && c.routerName !== pppoeRouterFilter) return false;
      if (pppoeStateFilter === 'ONLINE' && !c.isOnline) return false;
      if (pppoeStateFilter === 'OFFLINE' && c.isOnline) return false;
      if (pppoeStateFilter === 'LOCKED' && c.lockStatus !== 'Locked') return false;
      if (pppoeSearch.trim()) {
        const q = pppoeSearch.toLowerCase();
        return (
          c.username.toLowerCase().includes(q) ||
          c.custId.toLowerCase().includes(q) ||
          c.ipAddress.toLowerCase().includes(q) ||
          c.macAddress.toLowerCase().includes(q) ||
          c.packageName.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const handleExportRscSecrets = () => {
      const lines = [
        `# RRR CABLE NETWORK — RouterOS PPPoE Secrets Export (${new Date().toISOString()})`,
        '/ppp secret',
        ...filteredPppoe.map(
          (c) =>
            `add name="${c.username}" password="${c.password}" service=pppoe profile="${c.packageName}" remote-address=${
              c.ipAddress || '0.0.0.0'
            } ${c.macAddress ? `caller-id="${c.macAddress}"` : ''} disabled=${c.lockStatus === 'Locked' ? 'yes' : 'no'} comment="CustID:${c.custId}"`
        ),
      ];
      downloadTextFile(`mikrotik_pppoe_secrets_${new Date().toISOString().slice(0, 10)}.rsc`, lines.join('\n'));
      notify(`Exported ${filteredPppoe.length} PPPoE secrets to RouterOS .rsc script.`, 'success');
    };

    return (
      <div className="space-y-3">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">MikroTik &amp; RADIUS</span>
            <span className="mx-1.5">/</span>
            <span>PPPoE Secrets, Active NAS Sessions &amp; CoA Control</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[11px] font-bold rounded-xs ${
                settings?.routerSandboxMode
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {settings?.routerSandboxMode
                ? 'SANDBOX ROUTEROS API (Safe Dev Simulation + Real DB Sync)'
                : 'LIVE ROUTEROS API MODE'}
            </span>
            <button
              type="button"
              onClick={handleExportRscSecrets}
              className="px-3 py-1 bg-[#17a2b8] hover:bg-cyan-700 text-white text-xs font-semibold rounded-xs inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export .rsc Secrets
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-white border border-slate-300 rounded-xs">
            <p className="text-slate-500">Total PPPoE Secrets</p>
            <p className="text-lg font-bold font-mono text-slate-900">{visibleCustomers.length}</p>
          </div>
          <div className="p-3 bg-white border border-slate-300 rounded-xs">
            <p className="text-slate-500">Active Online Sessions</p>
            <p className="text-lg font-bold font-mono text-emerald-700">{visibleCustomers.filter((c) => c.isOnline).length}</p>
          </div>
          <div className="p-3 bg-white border border-slate-300 rounded-xs">
            <p className="text-slate-500">Locked / Disabled Secrets</p>
            <p className="text-lg font-bold font-mono text-red-600">{visibleCustomers.filter((c) => c.lockStatus === 'Locked').length}</p>
          </div>
          <div className="p-3 bg-white border border-slate-300 rounded-xs">
            <p className="text-slate-500">Provisioned NAS Routers</p>
            <p className="text-lg font-bold font-mono text-[#007bff]">{routers.length}</p>
          </div>
        </div>

        <div className="bg-[#f8f9fa] border border-slate-300 p-2.5 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">NAS Router:</span>
            <select
              value={pppoeRouterFilter}
              onChange={(e) => setPppoeRouterFilter(e.target.value)}
              className="px-2 py-1 border border-slate-300 bg-white rounded-xs"
            >
              <option value="ALL">All Routers</option>
              {routers.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name} ({r.popName})
                </option>
              ))}
            </select>

            <span className="font-semibold">Session Filter:</span>
            <select
              value={pppoeStateFilter}
              onChange={(e) => setPppoeStateFilter(e.target.value as 'ALL' | 'ONLINE' | 'OFFLINE' | 'LOCKED')}
              className="px-2 py-1 border border-slate-300 bg-white rounded-xs"
            >
              <option value="ALL">All Secrets</option>
              <option value="ONLINE">Active Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="LOCKED">Locked / Disabled</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={pppoeSearch}
              onChange={(e) => setPppoeSearch(e.target.value)}
              placeholder="Search PPPoE user, IP, MAC..."
              className="px-2.5 py-1 border border-slate-300 bg-white rounded-xs w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-300 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="px-2.5 py-2 text-left">PPPoE Secret</th>
                <th className="px-2.5 py-2 text-left">Password</th>
                <th className="px-2.5 py-2 text-left">NAS Router</th>
                <th className="px-2.5 py-2 text-left">Profile / Queue</th>
                <th className="px-2.5 py-2 text-left">Framed-IP</th>
                <th className="px-2.5 py-2 text-left">Caller-ID MAC</th>
                <th className="px-2.5 py-2 text-center">Session</th>
                <th className="px-2.5 py-2 text-center">NAS Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPppoe.map((c) => (
                <tr key={c.id} className="hover:bg-amber-50/40">
                  <td className="px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => openCustomerSingleView(c.id)}
                      className="font-bold text-[#007bff] hover:underline cursor-pointer"
                    >
                      {c.username}
                    </button>
                    <span className="block text-[10px] font-mono text-slate-500">#{c.custId} · {c.popName}</span>
                  </td>
                  <td className="px-2.5 py-2 font-mono text-slate-700">{c.password}</td>
                  <td className="px-2.5 py-2 font-mono">{c.routerName}</td>
                  <td className="px-2.5 py-2">
                    <span className="font-semibold">{c.packageName}</span>
                    <span className="block text-[10px] font-mono text-slate-500">{c.mikrotikQueue}</span>
                  </td>
                  <td className="px-2.5 py-2 font-mono">{c.ipAddress || 'Pool Dynamic'}</td>
                  <td className="px-2.5 py-2 font-mono text-[11px]">{c.macAddress || 'Auto'}</td>
                  <td className="px-2.5 py-2 text-center">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-xs ${
                        c.lockStatus === 'Locked'
                          ? 'bg-red-100 text-red-800'
                          : c.isOnline
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {c.lockStatus === 'Locked' ? 'Locked' : c.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!user) return;
                          const nextLock = c.lockStatus === 'Unlocked' ? 'Locked' : 'Unlocked';
                          await invokeMikrotikApi({
                            action: nextLock === 'Locked' ? 'lock' : 'unlock',
                            username: c.username,
                            routerName: c.routerName,
                          });
                          await updateCustomer(c.id, {
                            lockStatus: nextLock,
                            isOnline: nextLock === 'Locked' ? false : c.isOnline,
                            lastLogout: nextLock === 'Locked' ? 'Disabled in PPP Secret' : c.lastLogout,
                          });
                          await logAuditEvent(
                            user.uid,
                            operator.username,
                            `PPPoE Secret ${nextLock}`,
                            `${nextLock} PPPoE secret ${c.username} on ${c.routerName}`,
                            c.username,
                            c.popName
                          );
                          notify(`${nextLock} PPPoE secret ${c.username}.`, 'success');
                        }}
                        title={c.lockStatus === 'Unlocked' ? 'Disable PPPoE Secret' : 'Enable PPPoE Secret'}
                        className={`px-2 py-0.5 rounded-xs text-[11px] font-semibold text-white cursor-pointer ${
                          c.lockStatus === 'Unlocked' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#28a745] hover:bg-[#218838]'
                        }`}
                      >
                        {c.lockStatus === 'Unlocked' ? <Lock className="w-3 h-3 inline" /> : <Unlock className="w-3 h-3 inline" />}{' '}
                        {c.lockStatus === 'Unlocked' ? 'Lock' : 'Unlock'}
                      </button>

                      {c.isOnline ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user) return;
                            await invokeMikrotikApi({ action: 'disconnect', username: c.username, routerName: c.routerName });
                            await updateCustomer(c.id, { isOnline: false, lastLogout: 'CoA Kick from PPPoE Console' });
                            notify(`Disconnected active PPPoE session for ${c.username}.`, 'info');
                          }}
                          title="Send RADIUS CoA Disconnect"
                          className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xs text-[11px] font-semibold cursor-pointer"
                        >
                          <Scissors className="w-3 h-3 inline" /> Kick
                        </button>
                      ) : (
                        c.lockStatus === 'Unlocked' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await invokeMikrotikApi({ action: 'sync', username: c.username, packageName: c.packageName, routerName: c.routerName });
                              await updateCustomer(c.id, { isOnline: true, lastLogout: 'Active Session' });
                              notify(`Synced PPPoE secret & marked ${c.username} online (Sandbox NAS).`, 'success');
                            }}
                            title="Sync Secret / Reconnect Session"
                            className="px-2 py-0.5 bg-[#007bff] hover:bg-blue-700 text-white rounded-xs text-[11px] font-semibold cursor-pointer"
                          >
                            Sync Up
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
  // VIEW 3: HOTSPOT & VOUCHER BILLING SYSTEM
  // =========================================================================
  if (activeModule === 'hotspot') {
    const handleGenerateVouchers = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      const count = Math.min(20, Math.max(1, voucherBatchCount));
      for (let i = 0; i < count; i++) {
        const pin = `RRR-${Math.floor(100000 + Math.random() * 899999)}`;
        await createOperationalLog(user.uid, {
          logCategory: 'hotspot_voucher',
          code: pin,
          actor: operator.username,
          target: 'Unused Card',
          popName: voucherPop,
          title: voucherProfile,
          details: `Validity: ${voucherValidity} | Roaming: ${roamingEnabled ? 'Multi-AP Roaming' : 'Single AP'} | OTP: ${
            otpLoginEnabled ? 'Required' : 'PIN Only'
          }`,
          metaOne: voucherValidity,
          metaTwo: roamingEnabled ? 'ROAMING-ON' : 'LOCAL-AP',
          numericVal: voucherPrice,
          status: 'Available',
          timestampStr: formatShortDateTime(),
        });
      }
      await logAuditEvent(
        user.uid,
        operator.username,
        'Hotspot Voucher Batch Generated',
        `Generated ${count} cards for ${voucherProfile} (BDT ${voucherPrice} each)`,
        voucherProfile,
        voucherPop
      );
      notify(`Generated ${count} Hotspot scratch vouchers.`, 'success');
    };

    const handleSellVoucher = async (id: string, code: string) => {
      await updateOperationalLog(id, {
        status: 'Sold / Active',
        metaTwo: `Sold by ${operator.username}`,
      });
      notify(`Activated Hotspot Voucher ${code}.`, 'success');
    };

    return (
      <div className="space-y-4">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">MikroTik &amp; RADIUS</span>
            <span className="mx-1.5">/</span>
            <span>Wi-Fi Hotspot Billing, Scratch Vouchers &amp; Mobile OTP Portal</span>
          </div>
          <span className="text-xs font-mono text-emerald-700 font-semibold">
            Multi-Zone Roaming: {roamingEnabled ? 'ENABLED' : 'OFF'} · Mobile OTP Verification: {otpLoginEnabled ? 'ACTIVE' : 'OFF'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 border border-slate-300 bg-white rounded-xs overflow-hidden">
            <img
              src={hotspotImg}
              alt="RRR CABLE NETWORK Carrier Wi-Fi Hotspot Architecture"
              referrerPolicy="no-referrer"
              className="w-full h-36 object-cover border-b border-slate-300"
            />
            <form onSubmit={handleGenerateVouchers} className="p-3.5 space-y-2.5 text-xs">
              <div className="font-bold text-slate-800 uppercase border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-[#007bff]" /> Generate Hotspot Scratch Cards / PINs
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">Hotspot Plan</label>
                  <select
                    value={voucherProfile}
                    onChange={(e) => setVoucherProfile(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xs"
                  >
                    <option value="Hotspot-1Day-20Mbps">Hotspot 24h (20Mbps)</option>
                    <option value="Hotspot-7Days-25Mbps">Hotspot 7 Days (25Mbps)</option>
                    <option value="Hotspot-30Days-30Mbps">Hotspot 30 Days Unlimited</option>
                    <option value="Hotspot-5GB-Volume">5 GB Prepaid Volume Card</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Hotspot Zone / POP</label>
                  <select
                    value={voucherPop}
                    onChange={(e) => setVoucherPop(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xs"
                  >
                    {pops.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Batch Qty (1-20)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={voucherBatchCount}
                    onChange={(e) => setVoucherBatchCount(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Card Price (BDT)</label>
                  <input
                    type="number"
                    min={5}
                    value={voucherPrice}
                    onChange={(e) => setVoucherPrice(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Time / Quota Limit</label>
                  <input
                    type="text"
                    value={voucherValidity}
                    onChange={(e) => setVoucherValidity(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xs"
                  />
                </div>
                <div className="flex flex-col justify-end gap-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roamingEnabled}
                      onChange={(e) => setRoamingEnabled(e.target.checked)}
                    />
                    <span>Seamless Roaming</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={otpLoginEnabled}
                      onChange={(e) => setOtpLoginEnabled(e.target.checked)}
                    />
                    <span>Mobile SMS OTP</span>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-1.5 bg-[#28a745] hover:bg-[#218838] text-white font-semibold rounded-xs cursor-pointer"
              >
                Generate Voucher Cards
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 border border-slate-300 bg-white overflow-x-auto">
            <div className="px-3 py-2 bg-[#f8f9fa] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-800">Hotspot Voucher &amp; Online Card Inventory ({hotspotVouchers.length})</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={voucherStatusFilter}
                  onChange={(e) => setVoucherStatusFilter(e.target.value as 'ALL' | 'Available' | 'Sold / Active')}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-xs"
                >
                  <option value="ALL">All Status</option>
                  <option value="Available">Available</option>
                  <option value="Sold / Active">Sold / Active</option>
                </select>
                <input
                  type="text"
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                  placeholder="PIN or POP..."
                  className="px-2 py-1 bg-white border border-slate-300 rounded-xs w-32"
                />
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 bg-white border border-slate-400 rounded-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Print Cards
                </button>
              </div>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="maxim-amber-thead">
                  <th className="px-2.5 py-2 text-left">Voucher PIN</th>
                  <th className="px-2.5 py-2 text-left">Profile</th>
                  <th className="px-2.5 py-2 text-left">Zone / POP</th>
                  <th className="px-2.5 py-2 text-left">Quota</th>
                  <th className="px-2.5 py-2 text-right">Price</th>
                  <th className="px-2.5 py-2 text-center">Status</th>
                  <th className="px-2.5 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hotspotVouchers
                  .filter((v) => {
                    if (voucherStatusFilter !== 'ALL' && v.status !== voucherStatusFilter) return false;
                    if (voucherSearch.trim()) {
                      const q = voucherSearch.toLowerCase();
                      return (
                        v.code.toLowerCase().includes(q) ||
                        v.title.toLowerCase().includes(q) ||
                        v.popName.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((v) => (
                    <tr key={v.id} className="hover:bg-amber-50/40">
                      <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">
                        <Ticket className="w-3.5 h-3.5 inline mr-1" />
                        {v.code}
                      </td>
                      <td className="px-2.5 py-2">{v.title}</td>
                      <td className="px-2.5 py-2">{v.popName}</td>
                      <td className="px-2.5 py-2">{v.metaOne}</td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums font-bold">BDT {v.numericVal}</td>
                      <td className="px-2.5 py-2 text-center">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-xs ${
                            v.status === 'Available' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          {v.status === 'Available' ? (
                            <button
                              type="button"
                              onClick={() => handleSellVoucher(v.id, v.code)}
                              className="px-2 py-0.5 bg-[#007bff] text-white rounded-xs text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                            >
                              Sell / Issue
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500">{v.metaTwo}</span>
                          )}
                          {operator.canDeleteRecord && (
                            confirmDeleteVoucherId === v.id ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteDocumentByPath('operationalLogs', v.id);
                                  setConfirmDeleteVoucherId(null);
                                  notify(`Deleted voucher ${v.code}.`, 'info');
                                }}
                                className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteVoucherId(v.id)}
                                title="Delete Voucher"
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
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: POPs, ZONES & OLT DISTRIBUTION MANAGEMENT
  // =========================================================================
  if (activeModule === 'pops') {
    const handleSavePop = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (editingPop) {
        await updatePopZone(editingPop.id, popForm);
        notify(`Updated POP ${popForm.name}.`, 'success');
      } else {
        await createPopZone(user.uid, popForm);
        notify(`Created POP ${popForm.name}.`, 'success');
      }
      setShowPopForm(false);
    };

    return (
      <div className="space-y-3">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">POP &amp; Network</span>
            <span className="mx-1.5">/</span>
            <span>POP Locations, Coverage Zones &amp; GPON OLT Inventory</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingPop(null);
              setPopForm({
                name: '',
                code: `POP-0${pops.length + 1}`,
                zoneName: 'Dhaka North',
                oltInfo: 'BDCOM GP3600-08B OLT',
                address: 'Dhaka, Bangladesh',
                managerName: 'demooperation',
                status: 'Active',
              });
              setShowPopForm(true);
            }}
            className="px-3 py-1 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add POP / Zone
          </button>
        </div>

        {showPopForm && (
          <form onSubmit={handleSavePop} className="bg-[#f8f9fa] border border-slate-300 p-4 rounded-xs text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="font-bold uppercase text-slate-800">
                {editingPop ? `Edit POP: ${editingPop.name}` : 'Create New POP / Distribution Zone'}
              </span>
              <button type="button" onClick={() => setShowPopForm(false)} className="text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">POP Name *</label>
                <input
                  type="text"
                  required
                  value={popForm.name}
                  onChange={(e) => setPopForm({ ...popForm, name: e.target.value })}
                  placeholder="Dhanmondi-POP"
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">POP Code *</label>
                <input
                  type="text"
                  required
                  value={popForm.code}
                  onChange={(e) => setPopForm({ ...popForm, code: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Zone / Area</label>
                <input
                  type="text"
                  value={popForm.zoneName}
                  onChange={(e) => setPopForm({ ...popForm, zoneName: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">OLT / Switch Chassis</label>
                <input
                  type="text"
                  value={popForm.oltInfo}
                  onChange={(e) => setPopForm({ ...popForm, oltInfo: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">POP In-Charge</label>
                <input
                  type="text"
                  value={popForm.managerName}
                  onChange={(e) => setPopForm({ ...popForm, managerName: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Status</label>
                <select
                  value={popForm.status}
                  onChange={(e) => setPopForm({ ...popForm, status: e.target.value as PopZone['status'] })}
                  className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs"
                >
                  <option value="Active">Active</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-1.5 bg-[#007bff] text-white font-semibold rounded-xs cursor-pointer">
                {editingPop ? 'Save POP' : 'Create POP'}
              </button>
            </div>
          </form>
        )}

        <div className="bg-[#f8f9fa] border border-slate-300 p-2.5 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Status:</span>
            <select
              value={popStatusFilter}
              onChange={(e) => setPopStatusFilter(e.target.value as 'ALL' | 'Active' | 'Maintenance' | 'Inactive')}
              className="px-2 py-1 bg-white border border-slate-300 rounded-xs"
            >
              <option value="ALL">All POPs</option>
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={popSearch}
              onChange={(e) => setPopSearch(e.target.value)}
              placeholder="Search POP name, code, OLT..."
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-xs w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-300 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="px-2.5 py-2 text-left">Code</th>
                <th className="px-2.5 py-2 text-left">POP Name</th>
                <th className="px-2.5 py-2 text-left">Coverage Zone</th>
                <th className="px-2.5 py-2 text-left">OLT / Distribution Gear</th>
                <th className="px-2.5 py-2 text-left">Manager</th>
                <th className="px-2.5 py-2 text-right">Subscribers</th>
                <th className="px-2.5 py-2 text-right">Online</th>
                <th className="px-2.5 py-2 text-center">Status</th>
                <th className="px-2.5 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pops
                .filter((p) => {
                  if (popStatusFilter !== 'ALL' && p.status !== popStatusFilter) return false;
                  if (popSearch.trim()) {
                    const q = popSearch.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      p.code.toLowerCase().includes(q) ||
                      p.zoneName.toLowerCase().includes(q) ||
                      p.oltInfo.toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .map((p) => {
                  const popSubs = visibleCustomers.filter((c) => c.popName === p.name);
                  const popOnline = popSubs.filter((c) => c.isOnline).length;
                  return (
                    <tr key={p.id} className="hover:bg-amber-50/40">
                      <td className="px-2.5 py-2 font-mono font-bold">{p.code}</td>
                      <td className="px-2.5 py-2 font-bold text-[#007bff] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {p.name}
                      </td>
                      <td className="px-2.5 py-2">{p.zoneName}</td>
                      <td className="px-2.5 py-2 font-mono text-slate-700">{p.oltInfo}</td>
                      <td className="px-2.5 py-2">{p.managerName}</td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums font-bold">{popSubs.length}</td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums text-emerald-700 font-bold">{popOnline}</td>
                      <td className="px-2.5 py-2 text-center">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-xs ${
                            p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPop(p);
                              setPopForm({
                                name: p.name,
                                code: p.code,
                                zoneName: p.zoneName,
                                oltInfo: p.oltInfo,
                                address: p.address,
                                managerName: p.managerName,
                                status: p.status,
                              });
                              setShowPopForm(true);
                            }}
                            title="Edit POP"
                            className="p-1 text-[#007bff] hover:bg-blue-50 rounded cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {operator.canDeleteRecord && (
                            confirmDeletePopId === p.id ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!user) return;
                                  await deleteDocumentByPath('pops', p.id);
                                  await logAuditEvent(user.uid, operator.username, 'Delete POP', `Deleted POP ${p.name} (${p.code})`, p.name);
                                  setConfirmDeletePopId(null);
                                  notify(`Deleted POP ${p.name}.`, 'info');
                                }}
                                className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePopId(p.id)}
                                title="Delete POP"
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
      </div>
    );
  }

  // =========================================================================
  // VIEW 5: MAESTRO IP LOG SERVER (BTRC REGULATORY NAT / SYSLOG ARCHIVE)
  // =========================================================================
  const handleRecordIpLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const sub = visibleCustomers.find((c) => c.username === simLogUser) || visibleCustomers[0];
    await createOperationalLog(user.uid, {
      logCategory: 'ip_log',
      code: `NAT-${Math.floor(100000 + Math.random() * 899999)}`,
      actor: sub?.username || simLogUser,
      target: simDstIp,
      popName: sub?.popName || 'Mirpur-POP',
      title: `LAN ${simSrcIp} -> NAT ${simNatIp}`,
      details: `Proto: TCP | MAC: ${sub?.macAddress || 'D4:CA:6D:91:22:0B'} | NAS: ${sub?.routerName || 'Mirpur-Core-CCR1036'}`,
      metaOne: simNatIp,
      metaTwo: sub?.macAddress || 'D4:CA:6D:91:22:0B',
      numericVal: 443,
      status: 'Archived (1-Yr Retention)',
      timestampStr: formatShortDateTime(),
    });
    notify('Captured NAT session into Maestro IP Log archive.', 'success');
  };

  const handleExportIpLogsCsv = () => {
    const rows = [
      ['Log_ID', 'Timestamp', 'Subscriber_Username', 'POP', 'Private_IP_Port', 'Translated_NAT_Public_IP_Port', 'Destination_IP_Port', 'Details'].join(','),
      ...ipLogs.map((l) =>
        [l.code, l.timestampStr, l.actor, l.popName, `"${l.title}"`, l.metaOne, l.target, `"${l.details}"`].join(',')
      ),
    ];
    downloadTextFile(`maestro_btrc_iplog_${new Date().toISOString().slice(0, 10)}.csv`, rows.join('\n'), 'text/csv;charset=utf-8;');
    notify('Exported BTRC NAT IP Log CSV.', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[#007bff]">POP &amp; Network</span>
          <span className="mx-1.5">/</span>
          <span>Maestro IP Log Server (BTRC Regulatory NAT &amp; Port Translation Archive)</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ipLogSearch}
            onChange={(e) => setIpLogSearch(e.target.value)}
            placeholder="Search subscriber, Public IP, port, MAC..."
            className="px-2.5 py-1 border border-slate-300 bg-white rounded-xs text-xs w-64"
          />
          <button
            type="button"
            onClick={handleExportIpLogsCsv}
            className="px-3 py-1 bg-[#17a2b8] hover:bg-cyan-700 text-white text-xs font-semibold rounded-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export BTRC Log CSV
          </button>
        </div>
      </div>

      {/* Sandbox Syslog Flow Injector Banner + Form */}
      <div className="bg-amber-50 border border-amber-300 px-3 py-2 rounded-xs text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>[Sandbox Syslog Flow Injector]</strong> Manually records a real BTRC-compliant CGNAT record into Cloud Firestore. For live router packet ingestion, point MikroTik <code>/system logging action remote</code> (UDP 514) to your production collector daemon.
        </span>
      </div>

      <form onSubmit={handleRecordIpLog} className="bg-[#f8f9fa] border border-slate-300 p-3 rounded-xs text-xs grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end">
        <div>
          <label className="block font-semibold mb-1">PPPoE Subscriber</label>
          <select
            value={simLogUser}
            onChange={(e) => setSimLogUser(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
          >
            {visibleCustomers.map((c) => (
              <option key={c.id} value={c.username}>
                {c.username} ({c.custId})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Source LAN IP:Port</label>
          <input
            type="text"
            value={simSrcIp}
            onChange={(e) => setSimSrcIp(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Public NAT IP:Port</label>
          <input
            type="text"
            value={simNatIp}
            onChange={(e) => setSimNatIp(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Destination IP:Port</label>
          <input
            type="text"
            value={simDstIp}
            onChange={(e) => setSimDstIp(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 bg-white rounded-xs font-mono"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-[#28a745] hover:bg-[#218838] text-white font-semibold rounded-xs flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer"
        >
          <Server className="w-3.5 h-3.5" /> Record Test NAT Flow
        </button>
      </form>

      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="maxim-amber-thead">
              <th className="px-2.5 py-2 text-left">Flow ID</th>
              <th className="px-2.5 py-2 text-left">Timestamp</th>
              <th className="px-2.5 py-2 text-left">Subscriber</th>
              <th className="px-2.5 py-2 text-left">POP</th>
              <th className="px-2.5 py-2 text-left">LAN &rarr; CGNAT Translation</th>
              <th className="px-2.5 py-2 text-left">Destination IP:Port</th>
              <th className="px-2.5 py-2 text-left">MAC &amp; Router Metadata</th>
              <th className="px-2.5 py-2 text-center">Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {ipLogs.map((log) => (
              <tr key={log.id} className="hover:bg-amber-50/40">
                <td className="px-2.5 py-2 font-mono font-semibold text-slate-700">
                  <FileSearch className="w-3.5 h-3.5 inline mr-1 text-[#007bff]" />
                  {log.code}
                </td>
                <td className="px-2.5 py-2 font-mono">{log.timestampStr}</td>
                <td className="px-2.5 py-2 font-bold text-[#1e8449]">{log.actor}</td>
                <td className="px-2.5 py-2">{log.popName}</td>
                <td className="px-2.5 py-2 font-mono text-slate-900">{log.title}</td>
                <td className="px-2.5 py-2 font-mono text-[#007bff]">{log.target}</td>
                <td className="px-2.5 py-2 font-mono text-[11px] text-slate-600">{log.details}</td>
                <td className="px-2.5 py-2 text-center">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-xs text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Archived
                    </span>
                    {operator.canDeleteRecord && (
                      confirmDeleteIpLogId === log.id ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteDocumentByPath('operationalLogs', log.id);
                            setConfirmDeleteIpLogId(null);
                            notify(`Removed IP log ${log.code}.`, 'info');
                          }}
                          className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-bold cursor-pointer"
                        >
                          Confirm
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteIpLogId(log.id)}
                          title="Delete IP Log Entry"
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
