import React from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, X } from 'lucide-react';
import { MaximProvider, useMaxim } from './context/MaximContext';
import { PublicWebsite } from './components/PublicWebsite';
import { AdminLogin } from './components/AdminLogin';
import { MaximLayout } from './components/MaximLayout';
import { DashboardModule } from './components/DashboardModule';
import { HomeUsersModule } from './components/HomeUsersModule';
import { NetworkModule } from './components/NetworkModule';
import { BillingSyncModule } from './components/BillingSyncModule';
import { ResellerCorporateModule } from './components/ResellerCorporateModule';
import { CrmTicketsModule } from './components/CrmTicketsModule';
import { OperationsErpModule } from './components/OperationsErpModule';
import { CustomerPortal } from './components/CustomerPortal';

interface ErrorBoundaryState {
  hasError: boolean;
  errorText: string;
}

class MaximErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.operationType) {
        return {
          hasError: true,
          errorText: `Database ${parsed.operationType} error on "${parsed.path || 'collection'}": ${parsed.error}`,
        };
      }
    } catch {
      // plain error string
    }
    return { hasError: true, errorText: raw };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white border border-red-200 max-w-lg w-full p-6 rounded-md space-y-4 text-xs">
            <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" /> Application Operation Interrupted
            </div>
            <p className="text-slate-700 font-mono bg-slate-50 p-3 border border-slate-200 rounded break-words">
              {this.state.errorText}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorText: '' });
                window.location.reload();
              }}
              className="maxim-btn-primary"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MaximToastStack() {
  const { toasts, dismissToast } = useMaxim();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0 no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-md shadow-md border text-xs font-medium ${
            t.type === 'error'
              ? 'bg-red-950 text-white border-red-800'
              : t.type === 'info'
              ? 'bg-slate-900 text-white border-slate-700'
              : 'bg-emerald-900 text-white border-emerald-700'
          }`}
        >
          {t.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
          ) : t.type === 'info' ? (
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-300" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
          )}
          <span className="flex-1 leading-snug">{t.text}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="opacity-75 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AdminModuleRouter() {
  const { activeModule } = useMaxim();

  switch (activeModule) {
    case 'dashboard':
      return <DashboardModule />;

    case 'customers_list':
    case 'customers_add':
    case 'customers_detail':
    case 'customers_bulk_recharge':
    case 'customers_online':
    case 'customers_due':
    case 'customers_vip':
      return <HomeUsersModule />;

    case 'packages':
    case 'routers':
    case 'pppoe_sessions':
    case 'hotspot':
    case 'pops':
    case 'ip_logs':
      return <NetworkModule />;

    case 'billing_payments':
    case 'billing_sync':
    case 'billing_gateway':
      return <BillingSyncModule />;

    case 'resellers':
    case 'resellers_tariffs':
    case 'corporate':
    case 'corporate_mrtg':
      return <ResellerCorporateModule />;

    case 'tickets_list':
    case 'tickets_create':
    case 'tasks':
      return <CrmTicketsModule />;

    case 'sms':
    case 'sms_templates':
    case 'accounts':
    case 'accounts_audit':
    case 'accounts_pnl':
    case 'accounts_cashflow':
    case 'employees':
    case 'employees_rbac':
    case 'reports':
    case 'reports_cpe':
    case 'audit_logs':
    case 'settings':
    case 'settings_backup':
      return <OperationsErpModule />;

    default:
      return <DashboardModule />;
  }
}

function MaximSurfaceShell() {
  const { surface, authReady, seeding, user } = useMaxim();

  if (surface === 'website') {
    return (
      <>
        <PublicWebsite />
        <MaximToastStack />
      </>
    );
  }

  if (surface === 'portal') {
    return (
      <>
        <CustomerPortal />
        <MaximToastStack />
      </>
    );
  }

  if (!authReady || seeding) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-xs text-slate-600">
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-700" />
        <div className="font-semibold text-slate-700">
          {seeding
            ? 'Provisioning RRR CABLE NETWORK Billing & RADIUS Workspace...'
            : 'Initializing RRR CABLE NETWORK Admin Panel...'}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AdminLogin />
        <MaximToastStack />
      </>
    );
  }

  return (
    <>
      <MaximLayout>
        <AdminModuleRouter />
      </MaximLayout>
      <MaximToastStack />
    </>
  );
}

export default function App() {
  return (
    <MaximErrorBoundary>
      <MaximProvider>
        <MaximSurfaceShell />
      </MaximProvider>
    </MaximErrorBoundary>
  );
}
