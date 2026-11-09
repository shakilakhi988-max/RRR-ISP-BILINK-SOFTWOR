import React, { useState } from 'react';
import { Eye, EyeOff, Globe, KeyRound, LockKeyhole, Mail, ShieldCheck, UserCheck } from 'lucide-react';
import { useMaxim } from '../context/MaximContext';
import { RrrBrandMark } from './MaximLayout';

export function AdminLogin() {
  const { loginWithEmailPassword, setSurface } = useMaxim();
  const [email, setEmail] = useState('mobailtelecom201@gmail.com');
  const [password, setPassword] = useState('Ridoy1432');
  const [showPassword, setShowPassword] = useState(false);
  const [operatorPreset, setOperatorPreset] = useState('RRR CABLE NETWORK');
  const [remember30Days, setRemember30Days] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim()) {
      setErrorMsg('Please enter your administrator email.');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await loginWithEmailPassword(email.trim(), password.trim(), operatorPreset.trim() || 'RRR CABLE NETWORK');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDefaultCredentials = () => {
    setEmail('mobailtelecom201@gmail.com');
    setPassword('Ridoy1432');
    setOperatorPreset('RRR CABLE NETWORK');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-[#ebedef] flex flex-col justify-between py-8 px-4">
      {/* Top Surface Switcher Bar */}
      <div className="max-w-md mx-auto w-full flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
          <LockKeyhole className="w-3.5 h-3.5 text-emerald-700" />
          RRR CABLE NETWORK Console
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSurface('portal')}
            className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-[#007bff] cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" /> Customer Self-Care
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => setSurface('website')}
            className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-[#007bff] cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" /> Official Website
          </button>
        </div>
      </div>

      {/* Classic ISP Billing Admin Login Box */}
      <div className="w-full max-w-[420px] mx-auto my-auto">
        <div className="bg-white border border-slate-300 rounded-[3px] shadow-sm overflow-hidden">
          <div className="bg-[#1f2227] px-6 py-5 flex items-center justify-center border-b border-slate-800">
            <RrrBrandMark />
          </div>

          <div className="maxim-mint-banner">ADMIN &amp; OPERATOR SIGN IN</div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Operator / Admin Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    name="adminEmail"
                    required
                    placeholder="mobailtelecom201@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    className="w-full pl-8 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-[2px] font-mono focus:border-[#28a745] focus:outline-none"
                  />
                </div>
              </div>

              {/* Password with Eye Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer select-none"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Show
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="adminPassword"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-8 pr-10 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-[2px] font-mono focus:border-[#28a745] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Initial Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Operator Role
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'RRR CABLE NETWORK', label: 'Super Admin' },
                    { id: 'demoreseller', label: 'SDT Reseller' },
                    { id: 'demooperation', label: 'NOC Staff' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setOperatorPreset(preset.id)}
                      className={`py-1.5 px-2 border rounded-[2px] text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        operatorPreset === preset.id
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                          : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Remember Session */}
              <label
                title="Persist session token"
                className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={remember30Days}
                  onChange={(e) => setRemember30Days(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Keep operator session active on this device (30 days)</span>
              </label>

              {errorMsg && (
                <div className="p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-[2px]">
                  {errorMsg}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#28a745] hover:bg-[#218838] rounded-[3px] transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
              >
                <LockKeyhole className="w-4 h-4" />
                {loading ? 'Authenticating Workspace...' : 'Sign In to RRR CABLE NETWORK'}
              </button>

              {/* Configured Admin Credentials Info Box */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-[3px] p-2.5 text-[11px] text-emerald-950 space-y-1">
                <div className="flex items-center justify-between font-semibold text-emerald-900">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Default Master Admin Access
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyDefaultCredentials}
                    className="text-[10px] text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
                  >
                    Auto-Fill
                  </button>
                </div>
                <div className="font-mono text-[10px] text-emerald-800 flex flex-col gap-0.5 pt-0.5">
                  <div>Email: <span className="font-semibold text-slate-900">mobailtelecom201@gmail.com</span></div>
                  <div>Password: <span className="font-semibold text-slate-900">Ridoy1432</span></div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <footer className="text-center pt-6">
        <span className="text-xs text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} RRR CABLE NETWORK · ISP Billing &amp; RADIUS ERP
        </span>
      </footer>
    </div>
  );
}
