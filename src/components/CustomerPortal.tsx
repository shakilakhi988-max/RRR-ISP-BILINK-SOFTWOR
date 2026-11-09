import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Lock,
  LogOut,
  MessageSquare,
  PhoneCall,
  Printer,
  Send,
  Smartphone,
  Ticket,
  Unlock,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useMaxim } from '../context/MaximContext';
import {
  addMonthsToDateStr,
  addTicketComment,
  computeSubscriberBalanceAfterPayment,
  createOperationalLog,
  createPaymentRecord,
  createSupportTicket,
  formatBrandName,
  formatShortDateTime,
  invokeMikrotikApi,
  logAuditEvent,
  updateCustomer,
} from '../services/maximService';
import { RrrBrandMark } from './MaximLayout';
import type { TicketComment } from '../types';
import maleAvatarImg from '../assets/images/subscriber_male_avatar_1793636053005.jpg';
import femaleAvatarImg from '../assets/images/subscriber_female_avatar_1793636053956.jpg';

export function CustomerPortal() {
  const {
    user,
    settings,
    allCustomers,
    routers,
    payments,
    tickets,
    operationalLogs,
    portalCustomerId,
    setPortalCustomerId,
    setSurface,
    loginWithGoogle,
    notify,
  } = useMaxim();

  const [loginInput, setLoginInput] = useState('Mizan');
  const [passwordInput, setPasswordInput] = useState('123456');
  const [activeTab, setActiveTab] = useState<
    | 'OVERVIEW'
    | 'PAY_ONLINE'
    | 'BKASH_GUIDE'
    | 'INVOICES'
    | 'TICKETS'
    | 'SESSIONS'
    | 'PASSWORD'
    | 'MOBILE_OTP'
  >('OVERVIEW');

  // Online Card Checkout State
  const [cardScheme, setCardScheme] = useState('VISA');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8841');
  const [cardMonths, setCardMonths] = useState(1);

  // Mobile Banking Quick Auto-Sync Test
  const [mfsProvider, setMfsProvider] = useState<'bKash Sync' | 'Rocket Sync'>('bKash Sync');
  const [mfsSenderPhone, setMfsSenderPhone] = useState('01713336400');

  // Ticket Creation & Live Thread State
  const [portalIssue, setPortalIssue] = useState('Slow Speed / High Latency');
  const [portalDesc, setPortalDesc] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketComments, setTicketComments] = useState<TicketComment[]>([]);
  const [replyText, setReplyText] = useState('');

  // Change Password State
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  // Mobile OTP Verification State
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');

  const subscriber = useMemo(() => {
    if (!portalCustomerId) return null;
    return allCustomers.find((c) => c.id === portalCustomerId) || null;
  }, [allCustomers, portalCustomerId]);

  const subscriberRouter = useMemo(() => {
    if (!subscriber) return null;
    return routers.find((r) => r.name === subscriber.routerName) || routers[0] || null;
  }, [routers, subscriber]);

  // Subscribe to comments for the selected ticket in Customer Portal
  useEffect(() => {
    if (!user || !selectedTicketId) {
      setTicketComments([]);
      return;
    }
    const q = query(
      collection(db, 'tickets', selectedTicketId, 'comments'),
      where('ownerUid', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TicketComment, 'id'>),
        }));
        list.sort((a, b) => a.timestampStr.localeCompare(b.timestampStr));
        setTicketComments(list);
      },
      () => {
        setTicketComments([]);
      }
    );
    return () => unsub();
  }, [user, selectedTicketId]);

  const handleSubscriberSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const q = loginInput.trim().toLowerCase();
    const matched = allCustomers.find(
      (c) =>
        (c.username.toLowerCase() === q || c.custId.toLowerCase() === q) &&
        c.password === passwordInput.trim()
    );
    if (!matched) {
      notify('Invalid Subscriber Username/ID or Password. Check credentials or pick a subscriber below.', 'error');
      return;
    }
    setPortalCustomerId(matched.id);
    setMfsSenderPhone(matched.mobile || '01713336400');
    notify(`Welcome back, ${matched.name}!`, 'success');
  };

  // =========================================================================
  // PORTAL LOGIN VIEW (portal.maxim-billing.com)
  // =========================================================================
  if (!user || !subscriber) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <header className="h-[52px] bg-[#1f2227] border-b border-slate-800 text-white px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <RrrBrandMark compact />
            <span className="text-xs text-slate-300 font-medium border-l border-slate-700 pl-2.5">
              Subscriber Self-Care Portal
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSurface('website')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-200 flex items-center gap-1.5 font-medium whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Official Website
            </button>
            <button
              type="button"
              onClick={() => setSurface('admin')}
              className="px-3 py-1.5 bg-[#007bff] hover:bg-blue-700 rounded font-semibold whitespace-nowrap cursor-pointer"
            >
              ISP Admin Panel
            </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-sm rounded-xs max-w-md w-full overflow-hidden">
            <div className="maxim-mint-banner">SUBSCRIBER SELF-CARE SIGN IN</div>
            <div className="bg-[#f8f9fa] px-6 py-3 border-b border-slate-300 text-center">
              <div className="text-xs font-semibold text-slate-700">
                {formatBrandName(settings?.companyName)} — Pay Bills, Check Connection &amp; Open Support Tickets
              </div>
            </div>

            {!user ? (
              <div className="p-6 space-y-4 text-center text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Connect to your ISP cloud database session first to load live subscriber accounts, invoices, tickets, and payment sync records.
                </p>
                <button
                  type="button"
                  onClick={() => loginWithGoogle()}
                  className="maxim-btn-primary w-full py-2.5"
                >
                  Connect Cloud Database Session
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubscriberSignIn} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Subscriber Username or Customer ID</label>
                  <input
                    type="text"
                    required
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="e.g. Mizan or 1023"
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Portal / PPPoE Password</label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="maxim-btn-success w-full py-2.5"
                >
                  Sign In to Customer Portal
                </button>

                <div className="pt-3 border-t border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 mb-2">
                    Quick-Select Subscriber Account:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allCustomers.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setLoginInput(c.username);
                          setPasswordInput(c.password);
                        }}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 border border-slate-200 rounded font-mono text-[11px] text-slate-700 cursor-pointer"
                      >
                        {c.username} (#{c.custId})
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED SUBSCRIBER PORTAL DASHBOARD
  // =========================================================================
  const myPayments = payments.filter(
    (p) => p.customerId === subscriber.id || p.customerUsername === subscriber.username
  );
  const myTickets = tickets.filter(
    (t) => t.customerId === subscriber.id || t.customerUsername === subscriber.username
  );
  const selectedTicket = myTickets.find((t) => t.id === selectedTicketId) || null;

  const subscriberSessionLogs = operationalLogs.filter(
    (l) =>
      (l.logCategory === 'ip_log' || l.logCategory === 'audit_log') &&
      (l.actor.toLowerCase() === subscriber.username.toLowerCase() ||
        l.target.toLowerCase() === subscriber.username.toLowerCase() ||
        (subscriber.ipAddress && l.details.includes(subscriber.ipAddress)))
  );

  const handleCardCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmt = subscriber.category === 'Free' ? 0 : subscriber.monthlyRate * cardMonths;
    const nextBal = computeSubscriberBalanceAfterPayment(subscriber.balance, totalAmt, totalAmt, cardMonths);
    const nextExp = addMonthsToDateStr(subscriber.expiryDate, cardMonths);
    const trx = `PORTAL-${cardScheme}-${Date.now().toString(36).toUpperCase()}`;

    await createPaymentRecord(user.uid, {
      trxNumber: trx,
      targetType: 'Home',
      customerId: subscriber.id,
      customerUsername: subscriber.username,
      customerName: subscriber.name,
      amount: totalAmt,
      chargeAmount: totalAmt,
      billForMonths: cardMonths,
      method: 'Online Card',
      channel: `${cardScheme} Self-Care Portal (Sandbox 3DS)`,
      receivedBy: 'Customer Portal 3DS',
      syncSource: 'Subscriber Portal',
      senderMobile: subscriber.mobile,
      status: 'Completed',
      remarks: `Online Card Recharge (${cardMonths} Month) via Customer Portal Sandbox`,
      oldExpiry: subscriber.expiryDate,
      newExpiry: nextExp,
      paymentDate: formatShortDateTime(),
    });

    await updateCustomer(subscriber.id, {
      balance: nextBal,
      expiryDate: nextExp,
      lockStatus: 'Unlocked',
      accountStatus: 'Active',
      isOnline: true,
    });

    await invokeMikrotikApi({
      action: 'unlock',
      username: subscriber.username,
      packageName: subscriber.packageName,
      routerName: subscriber.routerName,
      routerHost: subscriberRouter?.host,
      routerPort: subscriberRouter?.apiPort,
      sandbox: subscriberRouter ? subscriberRouter.mode === 'Sandbox' : true,
    });

    await logAuditEvent(
      user.uid,
      subscriber.username,
      `Portal Card Recharge (${trx})`,
      `Subscriber paid BDT ${totalAmt} (${cardMonths} mo) via Self-Care 3DS Sandbox; expiry -> ${nextExp}`,
      subscriber.username,
      subscriber.popName
    );

    notify(`Payment of BDT ${totalAmt.toLocaleString()} recorded! Expiry extended to ${nextExp}.`, 'success');
    setActiveTab('INVOICES');
  };

  const handleQuickMfsPay = async () => {
    const res = await fetch('/api/payment-sync/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: mfsProvider,
        senderMobile: mfsSenderPhone,
        reference: subscriber.custId,
        amount: subscriber.monthlyRate,
        companyName: formatBrandName(settings?.companyName),
      }),
    });
    const syncData = await res.json();
    const charge = subscriber.category === 'Free' ? 0 : subscriber.monthlyRate;
    const nextBal = computeSubscriberBalanceAfterPayment(subscriber.balance, subscriber.monthlyRate, charge, 1);
    const nextExp = addMonthsToDateStr(subscriber.expiryDate, 1);

    await createPaymentRecord(user.uid, {
      trxNumber: syncData.trxNumber,
      targetType: 'Home',
      customerId: subscriber.id,
      customerUsername: subscriber.username,
      customerName: subscriber.name,
      amount: subscriber.monthlyRate,
      chargeAmount: charge,
      billForMonths: 1,
      method: mfsProvider,
      channel: `${mfsProvider} Portal Webhook Sim`,
      receivedBy: 'Maestro Payment Sync',
      syncSource: 'Portal MFS Sync',
      senderMobile: mfsSenderPhone,
      status: 'Completed',
      remarks: `Simulated ${mfsProvider} Webhook Ref:${subscriber.custId}`,
      oldExpiry: subscriber.expiryDate,
      newExpiry: nextExp,
      paymentDate: formatShortDateTime(),
    });

    await updateCustomer(subscriber.id, {
      balance: nextBal,
      expiryDate: nextExp,
      lockStatus: 'Unlocked',
      accountStatus: 'Active',
      isOnline: true,
    });

    await logAuditEvent(
      user.uid,
      subscriber.username,
      `Portal ${mfsProvider} Sync (${syncData.trxNumber})`,
      `Simulated MFS callback credited BDT ${subscriber.monthlyRate} to ${subscriber.username}; expiry -> ${nextExp}`,
      subscriber.username,
      subscriber.popName
    );

    notify(`${mfsProvider} payment synced (${syncData.trxNumber}) — account unlocked in database!`, 'success');
    setActiveTab('INVOICES');
  };

  const handleCreatePortalTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalDesc.trim()) return;
    const nextNo = String(Math.max(6410, ...tickets.map((t) => Number(t.ticketNo) || 6400)) + 1);
    const createdId = await createSupportTicket(user.uid, {
      ticketNo: nextNo,
      customerId: subscriber.id,
      customerUsername: subscriber.username,
      customerName: subscriber.name,
      contact: subscriber.mobile,
      email: subscriber.email,
      popName: subscriber.popName,
      address: subscriber.address,
      customerBalance: subscriber.balance,
      customerExpiry: subscriber.expiryDate,
      lockStatus: subscriber.lockStatus,
      issueType: portalIssue,
      description: portalDesc.trim(),
      assignedTo: 'demooperation',
      createdBy: `${subscriber.username} (Portal)`,
      status: 'Open',
      priority: 'Normal',
      lastComment: `Submitted from Customer Self-Care Portal`,
      smsSentCustomer: true,
      smsSentStaff: true,
    });
    setPortalDesc('');
    setSelectedTicketId(createdId);
    notify(`Support Ticket #${nextNo} submitted to NOC team.`, 'success');
  };

  const handleSubscriberTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    if (selectedTicket.status === 'Closed') {
      notify('This ticket is closed and locked by NOC.', 'error');
      return;
    }
    await addTicketComment(
      user.uid,
      selectedTicket.id,
      subscriber.username,
      'Subscriber',
      replyText.trim()
    );
    setReplyText('');
    notify(`Reply posted to Ticket #${selectedTicket.ticketNo}.`, 'success');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPwd.trim() !== subscriber.password) {
      notify('Current password does not match your active account password.', 'error');
      return;
    }
    if (newPwd.trim().length < 4) {
      notify('New password must be at least 4 characters long.', 'error');
      return;
    }
    if (newPwd.trim() !== confirmPwd.trim()) {
      notify('New password and confirmation do not match.', 'error');
      return;
    }

    await updateCustomer(subscriber.id, { password: newPwd.trim() });
    await invokeMikrotikApi({
      action: 'sync',
      username: subscriber.username,
      packageName: subscriber.packageName,
      routerName: subscriber.routerName,
      routerHost: subscriberRouter?.host,
      routerPort: subscriberRouter?.apiPort,
      sandbox: subscriberRouter ? subscriberRouter.mode === 'Sandbox' : true,
    });
    await logAuditEvent(
      user.uid,
      subscriber.username,
      'Subscriber Password Updated',
      `Subscriber ${subscriber.username} updated Portal & PPPoE secret password via Self-Care Portal`,
      subscriber.username,
      subscriber.popName
    );

    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    notify('Portal & PPPoE secret password updated in database!', 'success');
  };

  const handleSendMobileOtp = async () => {
    const code = String(Math.floor(100000 + Math.random() * 899999));
    setGeneratedOtp(code);
    await createOperationalLog(user.uid, {
      logCategory: 'sms_log',
      code: `OTP-${code}`,
      actor: 'Customer Portal',
      target: subscriber.mobile,
      popName: subscriber.popName,
      title: 'Subscriber Mobile Verification OTP (Sandbox)',
      details: `[Sandbox OTP] Your ${formatBrandName(settings?.companyName)} Customer Portal verification code is ${code}.`,
      metaOne: 'SANDBOX-OTP',
      metaTwo: subscriber.username,
      numericVal: 1,
      status: 'Simulated',
      timestampStr: formatShortDateTime(),
    });
    notify(`Sandbox OTP generated for ${subscriber.mobile}: ${code}`, 'info');
  };

  const handleVerifyMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generatedOtp && otpInput.trim() === generatedOtp) {
      await updateCustomer(subscriber.id, { mobileVerified: true });
      await logAuditEvent(
        user.uid,
        subscriber.username,
        'Subscriber Mobile OTP Verified',
        `Mobile ${subscriber.mobile} marked verified for subscriber ${subscriber.username}`,
        subscriber.username,
        subscriber.popName
      );
      setGeneratedOtp(null);
      setOtpInput('');
      notify('Mobile number verified and saved to subscriber profile!', 'success');
    } else {
      notify('Incorrect OTP code entered.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Top Portal Bar */}
      <header className="min-h-[52px] bg-[#1f2227] border-b border-slate-800 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <RrrBrandMark compact />
          <span className="text-xs text-slate-300 border-l border-slate-700 pl-2.5 hidden sm:inline">
            {formatBrandName(settings?.companyName)} — Subscriber Self-Care
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-emerald-400 font-semibold">
            {subscriber.username} (#{subscriber.custId})
          </span>
          <button
            type="button"
            onClick={() => setSurface('admin')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded font-medium whitespace-nowrap cursor-pointer"
          >
            ISP Admin Panel
          </button>
          <button
            type="button"
            onClick={() => setPortalCustomerId(null)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded flex items-center gap-1 font-semibold whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-5 space-y-4">
        {/* Subscriber Status Summary Banner */}
        <div className="maxim-panel p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={subscriber.avatarType === 'female' ? femaleAvatarImg : maleAvatarImg}
              alt={subscriber.name}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-md object-cover border border-slate-200"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">{subscriber.name}</h1>
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded inline-flex items-center gap-1 ${
                    subscriber.lockStatus === 'Unlocked'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {subscriber.lockStatus === 'Unlocked' ? (
                    <Unlock className="w-3 h-3" />
                  ) : (
                    <Lock className="w-3 h-3" />
                  )}
                  {subscriber.lockStatus} · {subscriber.accountStatus}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                ID: <strong className="text-slate-800">{subscriber.custId}</strong> · PPPoE: <strong className="text-slate-800">{subscriber.username}</strong> · POP: {subscriber.popName}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 text-xs">
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded">
              <span className="text-slate-500 block text-[11px]">Active Package</span>
              <strong className="text-[#0284c7]">
                {subscriber.packageName} (BDT {subscriber.monthlyRate}/mo)
              </strong>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded">
              <span className="text-slate-500 block text-[11px]">Account Balance</span>
              <strong
                className={`font-mono tabular-nums ${
                  subscriber.balance < 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                BDT {subscriber.balance.toFixed(2)}
              </strong>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded">
              <span className="text-slate-500 block text-[11px]">Expiry Date</span>
              <strong className="font-mono text-slate-800">{subscriber.expiryDate}</strong>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-white border border-slate-200 p-1.5 rounded-md text-xs">
          {(
            [
              ['OVERVIEW', 'Profile & Link Status'],
              ['PAY_ONLINE', 'Pay Online (Card)'],
              ['BKASH_GUIDE', 'bKash / Rocket Sync'],
              ['INVOICES', `Invoices & History (${myPayments.length})`],
              ['TICKETS', `Support Tickets (${myTickets.length})`],
              ['SESSIONS', 'Session & NAS Logs'],
              ['PASSWORD', 'Change Password'],
              ['MOBILE_OTP', 'Verify Mobile OTP'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === key
                  ? 'bg-[#0f172a] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1: PROFILE & LINK STATUS */}
        {activeTab === 'OVERVIEW' && (
          <div className="border border-slate-400 bg-white text-xs">
            <div className="maxim-mint-banner">SUBSCRIBER PROFILE &amp; FIBER CONNECTION STATUS</div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300">
              <div className="p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Full Name:</span>
                  <strong>{subscriber.name}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Mobile Number:</span>
                  <span className="font-mono">
                    {subscriber.mobile}{' '}
                    {subscriber.mobileVerified ? (
                      <span className="text-emerald-700 font-semibold">(OTP Verified)</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab('MOBILE_OTP')}
                        className="text-[#007bff] underline cursor-pointer"
                      >
                        Verify OTP
                      </button>
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Email Address:</span>
                  <span>{subscriber.email || '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Billing Address:</span>
                  <span className="text-right">{subscriber.address}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Billing Cycle / Type:</span>
                  <span>
                    {subscriber.billingCycle} ({subscriber.planType})
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Online Session:</span>
                  <strong className={subscriber.isOnline ? 'text-emerald-700' : 'text-slate-500'}>
                    {subscriber.isOnline ? 'Connected (PPPoE Active)' : subscriber.lastLogout}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">NAS Router:</span>
                  <span className="font-mono">{subscriber.routerName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Assigned IP / MAC:</span>
                  <span className="font-mono">
                    {subscriber.ipAddress || 'Dynamic'} / {subscriber.macAddress || 'Auto'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">ONU / CPE Device:</span>
                  <span>{subscriber.cpeModel}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Fiber Drop / OLT Port:</span>
                  <span className="font-mono">
                    {subscriber.fiberLength} · Port {subscriber.oltPort}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ONLINE CREDIT / DEBIT CARD RECHARGE */}
        {activeTab === 'PAY_ONLINE' && (
          <form
            onSubmit={handleCardCheckout}
            className="bg-white border border-slate-400 max-w-lg mx-auto rounded-xs overflow-hidden text-xs"
          >
            <div className="maxim-mint-banner">ONLINE CREDIT / DEBIT CARD BILL PAYMENT</div>
            <div className="p-4 space-y-3">
              <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2 rounded-xs flex items-start gap-2 text-[11px]">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <strong>[3D-Secure Sandbox Checkout + Real Receipt Ledger]:</strong> Card authorization is simulated in sandbox mode (no real bank charge occurs), while receipt generation, subscriber balance credit, expiry extension, and account unlock write directly to Cloud Firestore.
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Card Brand</label>
                  <select
                    value={cardScheme}
                    onChange={(e) => setCardScheme(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
                  >
                    <option value="VISA">VISA</option>
                    <option value="MasterCard">MasterCard</option>
                    <option value="AmEx">American Express</option>
                    <option value="DBBL-Nexus">DBBL Nexus</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Recharge Duration</label>
                  <select
                    value={cardMonths}
                    onChange={(e) => setCardMonths(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
                  >
                    <option value={1}>1 Month (BDT {subscriber.monthlyRate})</option>
                    <option value={3}>3 Months (BDT {subscriber.monthlyRate * 3})</option>
                    <option value={6}>6 Months (BDT {subscriber.monthlyRate * 6})</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Test Card Number (Sandbox 3DS)</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
                />
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 flex justify-between font-bold">
                <span>Total Payable Now:</span>
                <span className="font-mono text-[#1e8449]">
                  BDT {(subscriber.monthlyRate * cardMonths).toLocaleString()}
                </span>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#007bff] hover:bg-blue-700 text-white font-bold rounded-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" /> Simulate 3DS Pay &amp; Renew in Database
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: DETAILED bKash & ROCKET PAYMENT INSTRUCTIONS */}
        {activeTab === 'BKASH_GUIDE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-white border border-slate-400 rounded-xs overflow-hidden">
              <div className="bg-[#e2136e] text-white px-4 py-2 font-bold uppercase">
                bKash Payment Instruction (Zero-TrxID Auto-Recharge)
              </div>
              <ol className="p-4 list-decimal pl-7 space-y-1.5 text-slate-700">
                <li>
                  Dial <strong>*247#</strong> or open the <strong>bKash App</strong> &rarr; select <strong>Payment</strong>.
                </li>
                <li>
                  Enter Merchant Account: <strong className="font-mono">{settings?.bkashMerchant || '01700-000111'}</strong>
                </li>
                <li>
                  Enter Bill Amount: <strong className="font-mono">BDT {subscriber.monthlyRate}</strong>
                </li>
                <li>
                  Enter Reference (IMPORTANT): <strong className="font-mono text-[#e2136e]">{subscriber.custId}</strong> (or{' '}
                  <span className="font-mono">{subscriber.username}</span>)
                </li>
                <li>
                  Enter Counter No: <strong>1</strong> and confirm with your PIN. When live bKash IPN credentials are connected, your account unlocks automatically.
                </li>
              </ol>
            </div>

            <div className="bg-white border border-slate-400 rounded-xs overflow-hidden">
              <div className="bg-[#8c3494] text-white px-4 py-2 font-bold uppercase">
                DBBL Rocket BillPay &amp; Webhook Simulator
              </div>
              <div className="p-4 space-y-3">
                <p className="text-slate-700">
                  Dial <strong>*322#</strong> &rarr; Bill Pay &rarr; Biller ID{' '}
                  <strong className="font-mono">{settings?.rocketMerchant || '2940'}</strong> &rarr; Bill Number{' '}
                  <strong className="font-mono">{subscriber.custId}</strong>.
                </p>
                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-2 rounded-xs text-[11px]">
                  <strong>[MFS Webhook Simulator + Real Billing Engine]:</strong> Simulates an incoming bKash/Rocket IPN callback to <code className="font-mono">/api/payment-sync/process</code> and commits a real payment receipt + expiry renewal in Firestore.
                </div>
                <div className="border-t border-slate-200 pt-2.5 space-y-2">
                  <div className="font-bold text-slate-800">Simulate MFS Webhook Callback:</div>
                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <select
                      value={mfsProvider}
                      onChange={(e) => setMfsProvider(e.target.value as 'bKash Sync' | 'Rocket Sync')}
                      className="px-2 py-1.5 border border-slate-300 rounded-xs"
                    >
                      <option value="bKash Sync">bKash</option>
                      <option value="Rocket Sync">Rocket</option>
                    </select>
                    <input
                      type="text"
                      value={mfsSenderPhone}
                      onChange={(e) => setMfsSenderPhone(e.target.value)}
                      className="flex-1 min-w-[130px] px-2 py-1.5 border border-slate-300 rounded-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleQuickMfsPay}
                      className="px-3 py-1.5 bg-[#e2136e] text-white font-semibold rounded-xs whitespace-nowrap cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 inline mr-1" /> Simulate Webhook
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: INVOICES & PAYMENT HISTORY */}
        {activeTab === 'INVOICES' && (
          <div className="overflow-x-auto border border-slate-300 bg-white text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="maxim-amber-thead">
                  <th className="px-2.5 py-2 text-left">Receipt #</th>
                  <th className="px-2.5 py-2 text-left">Date</th>
                  <th className="px-2.5 py-2 text-left">Method / Channel</th>
                  <th className="px-2.5 py-2 text-center">Status</th>
                  <th className="px-2.5 py-2 text-right">Amount</th>
                  <th className="px-2.5 py-2 text-left">Extended Expiry</th>
                  <th className="px-2.5 py-2 text-center">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {myPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      No payment receipts recorded for this subscriber yet.
                    </td>
                  </tr>
                ) : (
                  myPayments.map((p) => (
                    <tr key={p.id} className={p.status === 'Void' ? 'opacity-60 line-through bg-red-50/40' : ''}>
                      <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">{p.trxNumber}</td>
                      <td className="px-2.5 py-2 font-mono">{p.paymentDate}</td>
                      <td className="px-2.5 py-2">
                        {p.method} <span className="text-slate-400">({p.channel})</span>
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-xs text-[10.5px] font-semibold ${
                            p.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono font-bold tabular-nums text-[#1e8449]">
                        BDT {p.amount.toLocaleString()}
                      </td>
                      <td className="px-2.5 py-2 font-mono">{p.newExpiry}</td>
                      <td className="px-2.5 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="p-1 text-[#007bff] hover:bg-blue-50 rounded cursor-pointer"
                          title="Print Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: CREATE & VIEW SUPPORT TICKETS + LIVE CONVERSATION THREAD */}
        {activeTab === 'TICKETS' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
            <form
              onSubmit={handleCreatePortalTicket}
              className="md:col-span-5 bg-white border border-slate-300 p-4 rounded-xs space-y-3 self-start"
            >
              <div className="font-bold uppercase text-slate-800 flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-[#007bff]" /> Open New Support Ticket
              </div>
              <div>
                <label className="block font-semibold mb-1">Issue Category</label>
                <select
                  value={portalIssue}
                  onChange={(e) => setPortalIssue(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
                >
                  <option value="Slow Speed / High Latency">Slow Speed / High Latency</option>
                  <option value="Fiber Cut / LOS Red Light">Fiber Cut / LOS Red Light</option>
                  <option value="Connection Problem">Connection Problem</option>
                  <option value="Billing / Payment Sync Query">Billing / Payment Sync Query</option>
                  <option value="Package Upgrade Request">Package Upgrade Request</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Details</label>
                <textarea
                  rows={3}
                  required
                  value={portalDesc}
                  onChange={(e) => setPortalDesc(e.target.value)}
                  placeholder="Describe your connectivity or billing issue..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full py-1.5 bg-[#28a745] hover:bg-[#218838] text-white font-semibold rounded-xs cursor-pointer"
              >
                Submit Complain Ticket
              </button>
            </form>

            <div className="md:col-span-7 space-y-3">
              <div className="bg-white border border-slate-300 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="maxim-amber-thead">
                      <th className="px-2.5 py-2 text-left">TKT #</th>
                      <th className="px-2.5 py-2 text-left">Issue</th>
                      <th className="px-2.5 py-2 text-center">Status</th>
                      <th className="px-2.5 py-2 text-left">Latest Update</th>
                      <th className="px-2.5 py-2 text-center">Thread</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {myTickets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                          No support tickets submitted yet.
                        </td>
                      </tr>
                    ) : (
                      myTickets.map((t) => (
                        <tr
                          key={t.id}
                          className={selectedTicketId === t.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'}
                        >
                          <td className="px-2.5 py-2 font-mono font-bold text-[#007bff]">#{t.ticketNo}</td>
                          <td className="px-2.5 py-2 font-semibold">{t.issueType}</td>
                          <td className="px-2.5 py-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-xs text-[11px] font-semibold ${
                                t.status === 'Closed'
                                  ? 'bg-slate-200 text-slate-700'
                                  : t.status === 'Resolved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-slate-600">{t.lastComment || t.description}</td>
                          <td className="px-2.5 py-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedTicketId((prev) => (prev === t.id ? null : t.id))
                              }
                              className="px-2 py-1 bg-[#007bff] hover:bg-blue-700 text-white rounded-xs text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              {selectedTicketId === t.id ? 'Hide' : 'Open'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {selectedTicket && (
                <div className="bg-white border border-slate-400 rounded-xs overflow-hidden">
                  <div className="maxim-mint-banner flex items-center justify-between">
                    <span>
                      TICKET #{selectedTicket.ticketNo} CONVERSATION — {selectedTicket.issueType}
                    </span>
                    <span className="font-mono text-[11px]">Status: {selectedTicket.status}</span>
                  </div>
                  <div className="p-3 space-y-2.5">
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xs">
                      <div className="text-[11px] text-slate-500">
                        Assigned NOC Engineer: <strong>{selectedTicket.assignedTo}</strong>
                      </div>
                      <div className="mt-1 text-slate-800">{selectedTicket.description}</div>
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-2 border border-slate-200 p-2.5 bg-slate-50/50">
                      {ticketComments.length === 0 ? (
                        <div className="text-slate-500 text-center py-2">
                          No thread messages yet. Send a message below to update the NOC engineer.
                        </div>
                      ) : (
                        ticketComments.map((c) => (
                          <div
                            key={c.id}
                            className={`p-2 rounded-xs border ${
                              c.authorRole === 'Subscriber'
                                ? 'bg-emerald-50 border-emerald-200 ml-4'
                                : 'bg-white border-slate-300 mr-4'
                            }`}
                          >
                            <div className="flex justify-between text-[10.5px] text-slate-500 font-mono">
                              <strong>
                                {c.author} ({c.authorRole})
                              </strong>
                              <span>{c.timestampStr}</span>
                            </div>
                            <div className="mt-1 text-slate-800">{c.message}</div>
                          </div>
                        ))
                      )}
                    </div>

                    {selectedTicket.status === 'Closed' ? (
                      <div className="p-2 bg-slate-100 border border-slate-300 text-slate-600 text-center font-semibold">
                        This ticket has been Closed &amp; Locked by NOC. Open a new ticket if the issue recurs.
                      </div>
                    ) : (
                      <form onSubmit={handleSubscriberTicketReply} className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a reply to NOC support..."
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-xs"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-[#007bff] hover:bg-blue-700 text-white font-semibold rounded-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" /> Reply
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: DYNAMIC NAS SESSION STATE & OPERATIONAL DB LOGS */}
        {activeTab === 'SESSIONS' && (
          <div className="space-y-3 text-xs">
            <div className="bg-white border border-slate-400 rounded-xs overflow-hidden">
              <div className="maxim-mint-banner flex flex-wrap items-center justify-between gap-2">
                <span>CURRENT NAS PPPoE SESSION STATE</span>
                <span
                  className={`px-2 py-0.5 rounded-xs text-[10.5px] font-mono font-bold ${
                    subscriberRouter?.mode === 'Live'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-amber-200 text-amber-950'
                  }`}
                >
                  {subscriberRouter?.mode === 'Live'
                    ? 'LIVE ROUTEROS SOCKET'
                    : 'SANDBOX NAS STATE + DB LOGS'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="maxim-amber-thead">
                      <th className="px-2.5 py-2 text-left">NAS Router</th>
                      <th className="px-2.5 py-2 text-left">Framed IP</th>
                      <th className="px-2.5 py-2 text-left">Calling Station MAC</th>
                      <th className="px-2.5 py-2 text-left">Queue Profile</th>
                      <th className="px-2.5 py-2 text-left">Session State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    <tr>
                      <td className="px-2.5 py-2">{subscriber.routerName}</td>
                      <td className="px-2.5 py-2">{subscriber.ipAddress || 'Dynamic Pool'}</td>
                      <td className="px-2.5 py-2">{subscriber.macAddress || 'Auto-Bind'}</td>
                      <td className="px-2.5 py-2">{subscriber.mikrotikQueue || subscriber.packageName}</td>
                      <td
                        className={`px-2.5 py-2 font-semibold ${
                          subscriber.isOnline ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        {subscriber.isOnline ? 'ACTIVE SESSION (ONLINE)' : `OFFLINE (${subscriber.lastLogout})`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-300 overflow-x-auto">
              <div className="px-3 py-2 bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                Recorded Connection, CoA &amp; IP Accounting Events ({subscriberSessionLogs.length})
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="maxim-amber-thead">
                    <th className="px-2.5 py-2 text-left">Timestamp</th>
                    <th className="px-2.5 py-2 text-left">Category</th>
                    <th className="px-2.5 py-2 text-left">Event</th>
                    <th className="px-2.5 py-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11.5px]">
                  {subscriberSessionLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-5 text-center text-slate-500 font-sans">
                        No historical session or IP flow events recorded in database for {subscriber.username}.
                      </td>
                    </tr>
                  ) : (
                    subscriberSessionLogs.slice(0, 20).map((log) => (
                      <tr key={log.id}>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">{log.timestampStr}</td>
                        <td className="px-2.5 py-1.5 uppercase">{log.logCategory}</td>
                        <td className="px-2.5 py-1.5 font-sans font-semibold text-slate-800">{log.title}</td>
                        <td className="px-2.5 py-1.5 font-sans text-slate-600">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: CHANGE PORTAL & PPPoE PASSWORD */}
        {activeTab === 'PASSWORD' && (
          <form
            onSubmit={handleChangePassword}
            className="bg-white border border-slate-400 max-w-md mx-auto rounded-xs overflow-hidden text-xs"
          >
            <div className="maxim-mint-banner flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" /> CHANGE PORTAL &amp; PPPoE SECRET PASSWORD
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block font-semibold mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xs font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Updating your password writes to Cloud Firestore and syncs your PPPoE secret profile ({subscriberRouter?.mode === 'Live' ? 'Live RouterOS Socket' : 'Sandbox RouterOS Sync'}). Remember to update your home Wi-Fi router WAN PPPoE password afterwards.
              </p>
              <button
                type="submit"
                className="w-full py-2 bg-[#28a745] hover:bg-[#218838] text-white font-bold rounded-xs cursor-pointer"
              >
                Update Password Now
              </button>
            </div>
          </form>
        )}

        {/* TAB 8: MOBILE NUMBER OTP VERIFICATION */}
        {activeTab === 'MOBILE_OTP' && (
          <div className="bg-white border border-slate-400 max-w-md mx-auto rounded-xs overflow-hidden text-xs">
            <div className="maxim-mint-banner">VERIFY MOBILE NUMBER WITH SMS OTP</div>
            <div className="p-4 space-y-3">
              <div className="bg-amber-50 border border-amber-300 text-amber-900 p-2 rounded-xs text-[11px]">
                <strong>[Sandbox SMS OTP Dispatcher + Real DB Flag]:</strong> Generates a 6-digit OTP in sandbox preview (without live telecom SMS carrier credentials) and updates your verified mobile status in Cloud Firestore upon confirmation.
              </div>
              <div className="flex items-center justify-between">
                <span>Registered Mobile:</span>
                <strong className="font-mono">{subscriber.mobile}</strong>
              </div>
              {subscriber.mobileVerified ? (
                <div className="bg-emerald-50 border border-emerald-300 p-3 text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Mobile number is verified in database for SMS alerts &amp; account notices.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSendMobileOtp}
                    className="w-full py-1.5 bg-[#17a2b8] hover:bg-cyan-700 text-white font-semibold rounded-xs cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5 inline mr-1" /> Generate 6-Digit Sandbox OTP
                  </button>
                  {generatedOtp && (
                    <form onSubmit={handleVerifyMobileOtp} className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-2 border border-amber-200 font-mono">
                        Sandbox OTP Preview Code: <strong>{generatedOtp}</strong>
                      </div>
                      <input
                        type="text"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        placeholder="Enter 6-digit OTP"
                        className="w-full px-2.5 py-1.5 border border-slate-300 font-mono text-center tracking-widest"
                      />
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-[#28a745] hover:bg-[#218838] text-white font-semibold rounded-xs cursor-pointer"
                      >
                        Confirm OTP Verification
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
