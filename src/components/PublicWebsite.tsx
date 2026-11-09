import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CreditCard,
  Globe,
  Headphones,
  Lock,
  MessageSquare,
  Network,
  Phone,
  Radio,
  Server,
  ShieldCheck,
  Users,
  Wifi,
} from 'lucide-react';
import { useMaxim } from '../context/MaximContext';
import nocHeroImg from '../assets/images/maxim_noc_hero_1793636051197.jpg';
import hotspotNetImg from '../assets/images/maxim_hotspot_network_1793636053751.jpg';

const VERIFIED_MODULES = [
  {
    id: 'payment_sync',
    title: '01. Payment Sync Technology',
    kicker: 'Maestro Automated Mobile Banking Sync',
    points: [
      'Synchronizes bKash (Personal & Merchant), DBBL Rocket, and Nagad directly with the billing server.',
      'Automatically recharges customer accounts without requiring customers to manually enter Transaction IDs.',
      'Dispatches instant return confirmation SMS after receiving mobile banking payment.',
      'Reconciles and audits total funds received across mobile banking channels.',
    ],
  },
  {
    id: 'home_users',
    title: '02. Home Users Management',
    kicker: 'Single-View Subscriber & RADIUS Control',
    points: [
      'Assign or change bandwidth packages, MikroTik queues, and billing cycles (Day of 1, 5, 10).',
      'Process single or Bulk Recharge, Cash Rcv Entry, and automated due locking.',
      'Dedicated handling for Regular, Free, and VIP subscribers with Subscriber Form & Photo/NID records.',
      'Track fiber length, GPON ONU serial, OLT port info, DIS BTRC reports, and MikroTik .rsc script backups.',
    ],
  },
  {
    id: 'resellers',
    title: '03. Resellers (SDT) Control',
    kicker: 'Prepaid Sub-Dealer & Overdraft Hierarchy',
    points: [
      'Configure prepaid resellers with custom buy/sell package rates and overdraft credit limits.',
      'Restrict allowed billing cycles and isolate reseller customer lists and support tickets.',
      'Resellers can add emergency balance via online payment and wholesale SMS credits with margin.',
    ],
  },
  {
    id: 'crm_portal',
    title: '04. CRM, Tickets, Tasks & Portal',
    kicker: 'End-to-End Subscriber Self-Care & NOC Dispatch',
    points: [
      'Staff and subscribers raise tickets with instant SMS notifications and threaded comments.',
      'Assign and track field engineering Tasks across POPs and analyse resolution performance.',
      'Customer Self-Care Portal for online VISA/MasterCard/AmEx/DBBL Nexus payment, invoices, session logs, and Mobile OTP verification.',
    ],
  },
  {
    id: 'corporate_accounts',
    title: '05. Corporate BW, SMS & Accounts',
    kicker: 'Bulk Bandwidth VAS, Masking SMS & General Ledger',
    points: [
      'Manage Corporate IIG, BDIX, Cache VAS, Data Connectivity, Public IP, and Server Rent with live MRTG graphs.',
      'Masking & Non-Masking Bulk SMS for billing alerts, Eid/New Year greetings, and fiber cut notices.',
      'Audit staff cash collections, transfer Staff Cash to Office Cash/Bank, track Vendor bills, Day Book, Cash Flow, and Income Statement.',
    ],
  },
];

const CLOUD_PLANS = [
  {
    name: 'Trial',
    audience: 'For evaluation up to 10 active users',
    price: 'FREE',
    cadence: 'for 1 month',
    setup: '৳ 0 Setup Charge',
    specs: [
      'Up to 10 active home users',
      'Basic Billing & Accounting',
      'Tk 25 SMS Credit included',
      'Payment Sync & Payment Gateway',
      'Domain & Free SSL (HTTPS)',
      '8h / 5 days Support',
    ],
  },
  {
    name: 'Starter',
    audience: 'For emerging ISPs up to 500 users',
    price: '৳ 2,500',
    cadence: '/ Month',
    setup: '৳ 5,000 Setup Charge',
    specs: [
      'Up to 500 active home users',
      'Up to 10 corporate users',
      'All Modules & All Features',
      'admin.YourDomain.com',
      'customer.YourDomain.com',
      '12/7/365 Support + Secondary RADIUS',
    ],
  },
  {
    name: 'Standard',
    audience: 'For growing ISPs up to 1,000 users',
    price: '৳ 4.5',
    cadence: '/ user / Month',
    setup: '৳ 10,000 Setup Charge',
    featured: true,
    specs: [
      'Up to 1,000 active home users',
      'Up to 25 corporate users',
      'All Modules & All Features',
      'admin.YourDomain.com & Portal SSL',
      'Real-time Backup Server in Bangladesh',
      '12/7/365 Dedicated Support',
    ],
  },
  {
    name: 'Advanced',
    audience: 'For scaling ISPs up to 2,000 users',
    price: '৳ 4.0',
    cadence: '/ user / Month',
    setup: '৳ 10,000 Setup Charge',
    specs: [
      'Up to 2,000 active home users',
      'Up to 50 corporate users',
      'All Modules & All Features',
      'Secondary Failover RADIUS Server',
      'Low-Latency BD Cloud Hosting',
      '12/7/365 Priority Support',
    ],
  },
];

const OWN_SERVER_PLANS = [
  {
    tier: '1000x',
    capacity: 'Up to 1,000 active users',
    license: '৳ 1,50,000',
    renewal: '৳ 18,000 / year after Year 1',
    hardware: '4 Logical Cores · 8 GB RAM · 120 GB SSD + 500 GBx2 RAID-1',
  },
  {
    tier: '2000x',
    capacity: 'Up to 2,000 active users',
    license: '৳ 2,00,000',
    renewal: '৳ 24,000 / year after Year 1',
    hardware: '8 Logical Cores · 16 GB RAM · 120 GB SSD + 500 GBx2 RAID-1',
  },
  {
    tier: '3000x',
    capacity: 'Up to 3,000 active users',
    license: '৳ 2,50,000',
    renewal: '৳ 30,000 / year after Year 1',
    hardware: '8 Logical Cores · 16 GB RAM · 120 GB SSD + 500 GBx2 RAID-1',
  },
  {
    tier: 'XX000 Enterprise',
    capacity: '5,000 / 10,000 / 30,000+ users',
    license: 'Custom Quote',
    renewal: '20% annual support renewal',
    hardware: '16 Logical Cores · 32 GB RAM · 120 GB SSD + 1 TBx2 RAID-1 / RAID-5',
  },
];

const ISP_CLIENTS = [
  'BDCOM Online (Smile Broadband)',
  'DOT Internet',
  'ICC Communication',
  'Agni Systems',
  'CyberWay Internet',
  'Alpha Net',
  'Unique Online',
  'SebaNet Broadband',
  'HiSpeed Telecom',
  'MyNet ISP',
];

export function PublicWebsite() {
  const { setSurface, notify } = useMaxim();
  const [selectedModule, setSelectedModule] = useState(VERIFIED_MODULES[0].id);
  const [heroImgOk, setHeroImgOk] = useState(true);
  const [netImgOk, setNetImgOk] = useState(true);
  const [contactForm, setContactForm] = useState({ ispName: '', phone: '', users: '500 - 1,000', message: '' });
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  const activeFeature = VERIFIED_MODULES.find((m) => m.id === selectedModule) || VERIFIED_MODULES[0];

  const handleInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.ispName.trim() || !contactForm.phone.trim()) return;
    setInquirySubmitted(true);
    notify(`Meeting request logged for ${contactForm.ispName}. Our Dhaka team will contact ${contactForm.phone}.`, 'success');
    setContactForm({ ispName: '', phone: '', users: '500 - 1,000', message: '' });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 lg:px-12 py-3.5 bg-white/95 backdrop-blur border-b border-slate-200">
        <a href="#top" className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          RRR CABLE NETWORK
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <a href="#solutions" className="hover:text-[#196F3D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
            Solutions
          </a>
          <a href="#modules" className="hover:text-[#196F3D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
            Modules
          </a>
          <a href="#hotspot" className="hover:text-[#196F3D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
            Hotspot
          </a>
          <a href="#pricing" className="hover:text-[#196F3D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
            Pricing
          </a>
          <a href="#contact" className="hover:text-[#196F3D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
            Contact
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setSurface('admin')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#196F3D] hover:bg-[#145a32] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Admin Panel
          </button>
        </div>
      </header>

      {/* Hero Split */}
      <section id="top" className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-medium text-slate-500">
                <span>RRR CABLE NETWORK</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>FTTH Broadband &amp; RADIUS AAA</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>Hosted in Bangladesh</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight text-slate-900 leading-[1.15] [text-wrap:balance]">
                Carrier-Grade RADIUS Billing, Payment Sync &amp; ISP ERP
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                Automate subscriber provisioning across MikroTik PPPoE and Hotspot routers, synchronize bKash and Rocket collections without manual TrxIDs, manage prepaid SDT resellers, and maintain BTRC-compliant IP logs from a unified console.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSurface('admin')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#196F3D] hover:bg-[#145a32] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Launch Admin Panel <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSurface('portal')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Customer Self-Care Portal
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[300px] rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
              {heroImgOk ? (
                <img
                  src={nocHeroImg}
                  alt="RRR CABLE NETWORK Operations Center with fiber patch panels and monitoring screens"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgOk(false)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-slate-200 bg-slate-900">
                  <Server className="w-12 h-12 text-emerald-400 mb-3" />
                  <p className="text-sm font-semibold">RRR CABLE NETWORK — ISP Billing &amp; RADIUS Operations Center</p>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 text-white">
                <p className="text-xs font-mono tabular-nums text-emerald-300">
                  Primary &amp; Secondary RADIUS Failover · Real-Time BD Cloud Mirroring
                </p>
                <p className="text-sm font-medium mt-0.5">
                  Serving 300+ Broadband ISPs &amp; Enterprise Networks Across Bangladesh
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Quantitative Proof Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10 pt-8 border-t border-slate-200">
          <div>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">2001</p>
            <p className="text-xs text-slate-500 mt-1">First RADIUS ISP Billing Deployment in Bangladesh</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">300+ ISPs</p>
            <p className="text-xs text-slate-500 mt-1">Operating Maestro IP Log &amp; Billing Infrastructure</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">0 TrxID Entry</p>
            <p className="text-xs text-slate-500 mt-1">Instant Auto-Recharge via bKash &amp; Rocket Payment Sync</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">12/7/365</p>
            <p className="text-xs text-slate-500 mt-1">BUET &amp; CS Graduate Engineering Support Desk</p>
          </div>
        </div>
      </section>

      {/* Core Maestro Ecosystem Solutions */}
      <section id="solutions" className="bg-slate-50 border-y border-slate-200 py-14">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl font-bold text-slate-900 [text-wrap:balance]">
              Complete ISP Automation, Regulatory Logging &amp; Server Protection
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Configured for RRR CABLE NETWORK across residential FTTH broadband, prepaid SDT resellers, Hotspot zones, and corporate bulk bandwidth links.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900">RRR CABLE Billing &amp; ERP</h3>
                <Network className="w-5 h-5 text-[#196F3D]" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Complete subscriber lifecycle control, MikroTik PPPoE/Queue synchronization, bulk recharge, reseller overdraft billing, CRM ticketing, masking SMS, and multi-channel cash accounting.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900">Maestro IP Log Server</h3>
                <Radio className="w-5 h-5 text-[#196F3D]" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Approved by Cyber Police Bureau and compliant with BTRC guidelines. Collects source/NAT/destination port and MAC session logs from multiple remote MikroTik routers with low disk overhead.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900">Maestro Keeper Security</h3>
                <ShieldCheck className="w-5 h-5 text-[#196F3D]" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Customized ISP server firewall and intrusion alerting subsystem. Sends instant administrator notifications on login events and monitors suspicious router/server processes in real time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Verified Module Explorer */}
      <section id="modules" className="max-w-7xl mx-auto px-6 lg:px-12 py-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Operational ISP Billing &amp; ERP Modules</h2>
            <p className="text-sm text-slate-600 mt-1">
              Every module below is live and fully operational inside the Admin Panel and Customer Portal.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-md border border-slate-200">
            {VERIFIED_MODULES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedModule(m.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedModule === m.id
                    ? 'bg-white text-[#196F3D] border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.title.split('. ')[1]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border border-slate-200 rounded-lg p-6 lg:p-8 bg-white">
          <div className="lg:col-span-5 space-y-3 border-b lg:border-b-0 lg:border-r border-slate-200 pb-6 lg:pb-0 lg:pr-8">
            <p className="text-xs font-medium text-[#196F3D]">{activeFeature.kicker}</p>
            <h3 className="text-xl font-bold text-slate-900">{activeFeature.title}</h3>
            <p className="text-sm text-slate-600">
              Inspect and execute real database operations for this module directly inside the Admin Console.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSurface('admin')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Module in Admin Panel <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center space-y-3">
            {activeFeature.points.map((pt, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                <Check className="w-4 h-4 text-[#196F3D] shrink-0 mt-0.5" />
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hotspot Billing & GPON Infrastructure Section */}
      <section id="hotspot" className="bg-slate-900 text-white py-14">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <div className="text-xs text-emerald-300">
              <span>Carrier Hotspot &amp; FTTH Automation</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>RADIUS Roaming Ready</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-wide [text-wrap:balance]">
              Complete Hotspot Billing, Voucher Sales &amp; Mobile OTP Onboarding
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Monetize public Wi-Fi zones, campuses, and shopping malls alongside FTTH PPPoE subscribers with automated voucher generation and mobile financial checkout.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-200 pt-1">
              <div className="flex items-center gap-2"><Wifi className="w-4 h-4 text-emerald-400 shrink-0" /><span>bKash &amp; Card Payment</span></div>
              <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-emerald-400 shrink-0" /><span>Mobile OTP Verification</span></div>
              <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400 shrink-0" /><span>Scratch Card / Voucher</span></div>
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400 shrink-0" /><span>Data, Unlimited &amp; Guest Plans</span></div>
              <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-emerald-400 shrink-0" /><span>Multi-Zone Roaming</span></div>
              <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" /><span>Captive Ad Campaigns</span></div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
              {netImgOk ? (
                <img
                  src={hotspotNetImg}
                  alt="GPON OLT rack, core router, and wireless Hotspot infrastructure diagram"
                  referrerPolicy="no-referrer"
                  onError={() => setNetImgOk(false)}
                  className="w-full h-72 object-cover"
                />
              ) : (
                <div className="w-full h-72 flex items-center justify-center text-slate-300">
                  <Wifi className="w-10 h-10 mr-3 text-emerald-400" />
                  <span>GPON OLT + MikroTik Core + Hotspot Controller</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Verified Cloud & Own-Server Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 lg:px-12 py-14 space-y-12">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cloud ISP Billing Packages (Below 2,000 Active Users)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Zero server investment, zero extra server electricity cost, real-time backup server, and secondary failover RADIUS hosted in Bangladesh.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
            {CLOUD_PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg p-5 flex flex-col justify-between border ${
                  plan.featured ? 'border-[#196F3D] bg-emerald-50/20' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{plan.audience}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">{plan.price}</span>
                    <span className="text-xs text-slate-600 ml-1">{plan.cadence}</span>
                    <p className="text-xs font-mono tabular-nums text-slate-500 mt-1">{plan.setup}</p>
                  </div>
                  <ul className="space-y-2 pt-2 text-xs text-slate-700">
                    {plan.specs.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#196F3D] shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => setSurface('admin')}
                  className="mt-6 w-full py-2 px-3 text-xs font-semibold rounded bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Start {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Own Server Table */}
        <div>
          <h3 className="text-xl font-bold text-slate-900">Own Dedicated Server Licenses (1,000 to 30,000+ Users)</h3>
          <p className="text-sm text-slate-600 mt-1">
            Includes all modules, admin &amp; customer portal domains with SSL, 1 year free updates &amp; 12/7/365 support.
          </p>
          <div className="mt-4 overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="maxim-amber-thead">
                <tr>
                  <th>Edition</th>
                  <th>Subscriber Capacity</th>
                  <th>One-Time License</th>
                  <th>Annual Support Renewal</th>
                  <th>Recommended Server Hardware</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {OWN_SERVER_PLANS.map((row) => (
                  <tr key={row.tier} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{row.tier}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.capacity}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums font-semibold text-[#196F3D]">{row.license}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-600">{row.renewal}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-600">{row.hardware}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Client Roster */}
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-500 mb-3">
            Trusted by Leading Broadband Operators Across Bangladesh
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-700">
            {ISP_CLIENTS.map((client, idx) => (
              <React.Fragment key={client}>
                <span>{client}</span>
                {idx < ISP_CLIENTS.length - 1 && (
                  <span className="text-slate-300" aria-hidden="true">·</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Contact & Footer */}
      <footer id="contact" className="bg-slate-950 text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-lg font-bold text-white">RRR CABLE NETWORK</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Mirpur-10, Dhaka-1216, Bangladesh · High-Speed FTTH Broadband, Corporate Data Connectivity &amp; Carrier Wi-Fi Hotspot Network
            </p>
            <div className="space-y-1.5 text-sm font-mono tabular-nums text-slate-300">
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>09666755955 · 09610755955 · 01713336401</span>
              </p>
              <p className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-400" />
                <span>24/7 NOC &amp; Billing Support Desk · BTRC Compliant Network</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSurface('admin')}
                className="px-4 py-2 text-xs font-semibold bg-[#196F3D] hover:bg-[#145a32] text-white rounded cursor-pointer"
              >
                Admin Login
              </button>
              <button
                type="button"
                onClick={() => setSurface('portal')}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
              >
                Customer Portal Login
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <form onSubmit={handleInquiry} className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
              <h4 className="text-sm font-bold text-white">Request Broadband / Corporate Connectivity Consultation</h4>
              {inquirySubmitted && (
                <p className="text-xs text-emerald-400">
                  Consultation request recorded. Our engineering team will reach out shortly.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Subscriber / Organization Name *"
                  value={contactForm.ispName}
                  onChange={(e) => setContactForm({ ...contactForm, ispName: e.target.value })}
                  className="px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  required
                  placeholder="Contact Mobile *"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={contactForm.users}
                  onChange={(e) => setContactForm({ ...contactForm, users: e.target.value })}
                  className="px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Under 500">Home FTTH Broadband</option>
                  <option value="500 - 1,000">Prepaid Reseller (SDT) Partnership</option>
                  <option value="1,000 - 2,000">Corporate Dedicated Bandwidth</option>
                  <option value="2,000+ Own Server">Enterprise / Custom Deployment</option>
                </select>
                <input
                  type="text"
                  placeholder="POP Location / Area"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer"
              >
                Submit Inquiry
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-slate-900 py-4 px-6 lg:px-12 text-center text-xs text-slate-500">
          &copy; RRR CABLE NETWORK 2026. All rights reserved. ISP Billing &amp; RADIUS ERP.
        </div>
      </footer>
    </div>
  );
}
