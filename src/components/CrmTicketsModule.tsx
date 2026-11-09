import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  CheckCircle2,
  ClipboardList,
  Edit3,
  Lock,
  Minus,
  Plus,
  Search,
  Send,
  Trash2,
  Unlock,
  User,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useMaxim } from '../context/MaximContext';
import {
  addTicketComment,
  createOperationalLog,
  createStaffTask,
  createSupportTicket,
  deleteDocumentByPath,
  formatBrandName,
  formatShortDateTime,
  logAuditEvent,
  updateStaffTask,
  updateSupportTicket,
} from '../services/maximService';
import type { StaffTask, SupportTicket, TicketComment } from '../types';

const ISSUE_TYPES = [
  'Connection Problem',
  'Slow Speed / High Latency',
  'Fiber Cut / LOS Red Light',
  'Router / ONU Configuration',
  'Billing / Payment Sync Query',
  'Package Upgrade Request',
  'Line Shifting Request',
];

function formatCommentBrand(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\bdemocompany\b/gi, 'RRR CABLE NETWORK');
}

function extractTicketDate(ticket: SupportTicket): string {
  const match = (ticket.lastComment || '').match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  return new Date().toISOString().slice(0, 10);
}

export function CrmTicketsModule() {
  const {
    user,
    activeModule,
    setActiveModule,
    visibleTickets,
    visibleCustomers,
    employees,
    tasks,
    pops,
    selectedCustomerId,
    operator,
    notify,
    openCustomerSingleView,
  } = useMaxim();

  // Ticket List Filters (matching ticketlist.png)
  const [filterType, setFilterType] = useState('');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('OPEN_ONLY');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTicketIds, setExpandedTicketIds] = useState<string[]>([]);

  // Selected Ticket Detail & Subcollection Comments Modal
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [ticketComments, setTicketComments] = useState<TicketComment[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [confirmDeleteTicketId, setConfirmDeleteTicketId] = useState<string | null>(null);

  // Create Ticket Form State (matching createtkt.png)
  const [lookupInput, setLookupInput] = useState('');
  const [loadedCustomerId, setLoadedCustomerId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [createdByField, setCreatedByField] = useState(formatBrandName(operator.username));
  const [emailField, setEmailField] = useState('');
  const [assignedToField, setAssignedToField] = useState('demooperation');
  const [sendSmsStaff, setSendSmsStaff] = useState(true);
  const [phoneField, setPhoneField] = useState('');
  const [sendSmsCustomer, setSendSmsCustomer] = useState(true);
  const [issueTypeField, setIssueTypeField] = useState('Connection Problem');
  const [descriptionField, setDescriptionField] = useState('');

  // Staff Tasks State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<StaffTask | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');
  const [taskPopFilter, setTaskPopFilter] = useState('ALL');
  const [taskSearch, setTaskSearch] = useState('');
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    category: 'Fiber Splicing / Maintenance',
    assignedTo: 'demooperation',
    popName: 'Mirpur-POP',
    relatedCustomer: '',
    dueDate: new Date().toISOString().slice(0, 10),
    priority: 'Normal' as StaffTask['priority'],
    status: 'Pending' as StaffTask['status'],
    notes: '',
  });

  useEffect(() => {
    if (activeModule === 'tickets_create') {
      const target =
        visibleCustomers.find((c) => c.id === selectedCustomerId) ||
        visibleCustomers.find((c) => c.username === 'Mizan') ||
        visibleCustomers[0];
      setCreatedByField(formatBrandName(operator.username));
      if (target) {
        setLookupInput(target.username);
        setLoadedCustomerId(target.id);
        setFirstName(target.name);
        setEmailField(target.email || '');
        setPhoneField(target.mobile || '');
      }
    }
  }, [activeModule, selectedCustomerId, visibleCustomers, operator.username]);

  useEffect(() => {
    if (!activeTicket || !user) {
      setTicketComments([]);
      return;
    }
    const q = query(
      collection(db, 'tickets', activeTicket.id, 'comments'),
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
      (err) => handleFirestoreError(err, OperationType.LIST, `tickets/${activeTicket.id}/comments`)
    );
    return () => unsub();
  }, [activeTicket, user]);

  const filteredTickets = useMemo(() => {
    return visibleTickets.filter((t) => {
      if (filterStatus === 'OPEN_ONLY' && (t.status === 'Resolved' || t.status === 'Closed')) return false;
      if (filterStatus !== 'ALL' && filterStatus !== 'OPEN_ONLY' && t.status !== filterStatus) return false;
      if (filterType && t.issueType !== filterType) return false;
      if (filterAssignedTo && t.assignedTo !== filterAssignedTo) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const hay = `${t.ticketNo} ${t.customerUsername} ${t.customerName} ${t.contact} ${t.popName} ${t.address} ${t.issueType} ${t.lastComment}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleTickets, filterStatus, filterType, filterAssignedTo, searchTerm]);

  const displayedTickets = useMemo(
    () => filteredTickets.slice(0, entriesPerPage),
    [filteredTickets, entriesPerPage]
  );

  const toggleExpandTicket = (id: string) => {
    setExpandedTicketIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // =========================================================================
  // VIEW 1: CREATE SUPPORT TICKET (Exact createtkt.png Reference)
  // =========================================================================
  if (activeModule === 'tickets_create') {
    const matchedSub = visibleCustomers.find(
      (c) =>
        c.id === loadedCustomerId ||
        c.username.toLowerCase() === lookupInput.trim().toLowerCase() ||
        c.custId === lookupInput.trim()
    );

    const openTicketsCountForSub = matchedSub
      ? visibleTickets.filter(
          (t) =>
            (t.customerId === matchedSub.id || t.customerUsername === matchedSub.username) &&
            t.status !== 'Closed' &&
            t.status !== 'Resolved'
        ).length
      : 0;

    const handleLoadClientInfo = () => {
      const q = lookupInput.trim().toLowerCase();
      const found = visibleCustomers.find(
        (c) => c.username.toLowerCase() === q || c.custId.toLowerCase() === q || c.mobile.includes(q)
      );
      if (!found) {
        notify(`No subscriber found matching "${lookupInput}".`, 'error');
        return;
      }
      setLoadedCustomerId(found.id);
      setLookupInput(found.username);
      setFirstName(found.name);
      setEmailField(found.email || '');
      setPhoneField(found.mobile || '');
      notify(`Loaded client info for ${found.username} (CustID: ${found.custId}).`, 'success');
    };

    const handleCreateComplain = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!descriptionField.trim()) {
        notify('Please enter ticket description.', 'error');
        return;
      }

      const nextNo = String(
        Math.max(6408, ...visibleTickets.map((t) => Number(t.ticketNo) || 6400)) + 1
      );
      const actorDisplay = formatBrandName(operator.username);

      await createSupportTicket(user.uid, {
        ticketNo: nextNo,
        customerId: matchedSub?.id || '',
        customerUsername: matchedSub?.username || lookupInput.trim() || 'walkin',
        customerName: firstName.trim() || matchedSub?.name || 'Subscriber',
        contact: phoneField.trim() || matchedSub?.mobile || '',
        email: emailField.trim(),
        popName: matchedSub?.popName || pops[0]?.name || 'Mirpur-POP',
        address: matchedSub?.address || 'Dhaka, Bangladesh',
        customerBalance: matchedSub?.balance ?? 0,
        customerExpiry: matchedSub?.expiryDate || '',
        lockStatus: matchedSub?.lockStatus || 'Unlocked',
        issueType: issueTypeField,
        description: descriptionField.trim(),
        assignedTo: assignedToField,
        createdBy: createdByField || actorDisplay,
        status: 'Open',
        priority: issueTypeField.includes('Fiber') ? 'Critical' : 'Normal',
        lastComment: `${formatShortDateTime().slice(0, 10)} ${actorDisplay}: ${descriptionField.trim().slice(0, 80)}`,
        smsSentCustomer: sendSmsCustomer,
        smsSentStaff: sendSmsStaff,
      });

      if (sendSmsCustomer && phoneField.trim()) {
        await createOperationalLog(user.uid, {
          logCategory: 'sms_log',
          code: `TKT-${nextNo}`,
          actor: actorDisplay,
          target: phoneField.trim(),
          popName: matchedSub?.popName || 'Mirpur-POP',
          title: `Ticket #${nextNo} Opened SMS to Subscriber`,
          details: `Dear ${firstName}, Complain Ticket #${nextNo} (${issueTypeField}) has been opened & assigned to ${assignedToField}. - RRR CABLE NETWORK`,
          metaOne: 'DELIVERED',
          metaTwo: 'TICKET-SMS',
          numericVal: 1,
          status: 'Sent',
          timestampStr: formatShortDateTime(),
        });
      }

      await logAuditEvent(
        user.uid,
        actorDisplay,
        `Ticket #${nextNo} Created`,
        `Opened ${issueTypeField} complain for ${matchedSub?.username || lookupInput} -> ${assignedToField}`,
        matchedSub?.username || lookupInput
      );

      notify(`Complain Ticket #${nextNo} created successfully.`, 'success');
      setDescriptionField('');
      setActiveModule('tickets_list');
    };

    return (
      <div className="space-y-3">
        {/* Top Gray Breadcrumb Bar (createtkt.png) */}
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <button
              type="button"
              onClick={() => setActiveModule('tickets_list')}
              className="text-[#007bff] hover:underline font-semibold cursor-pointer"
            >
              Tickets
            </button>
            <span className="mx-1.5 text-slate-500">/</span>
            <span className="text-slate-700">Create Ticket</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveModule('tickets_list')}
            className="maxim-classic-btn"
          >
            Ticket List
          </button>
        </div>

        {/* Pink Open Ticket Counter Alert Badge (createtkt.png) */}
        {matchedSub && (
          <div className="max-w-xl mx-auto bg-[#f8d7da] text-[#721c24] border border-[#f5c6cb] px-4 py-1.5 text-xs font-semibold text-center rounded-[2px]">
            No of Open ticket for {matchedSub.username} : {openTicketsCountForSub}
          </div>
        )}

        {/* Centered 2-Column Create Ticket Form (createtkt.png) */}
        <form
          onSubmit={handleCreateComplain}
          className="max-w-3xl mx-auto bg-white border border-slate-300 p-5 text-xs space-y-3.5"
        >
          {/* Row 1: Client ID / Username * + Teal Load Client Info */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label className="block font-semibold text-slate-700 mb-1">
                Client ID / Username <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder="Username or Customer ID"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-[2px] font-mono bg-white"
              />
            </div>
            <div className="sm:col-span-6">
              <button
                type="button"
                onClick={handleLoadClientInfo}
                className="px-4 py-1.5 bg-[#17a2b8] hover:bg-[#138496] text-white font-semibold rounded-[3px] transition-colors cursor-pointer whitespace-nowrap"
              >
                Load Client Info
              </button>
            </div>
          </div>

          {/* Row 2: First Name * (left) | Created By * (right) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                First Name <span className="text-red-600">*</span>
              </label>
              <div className="flex items-center border border-slate-300 bg-[#e9ecef] rounded-[2px]">
                <span className="px-2 py-1.5 border-r border-slate-300 bg-slate-200 text-slate-800">
                  <User className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#e9ecef] text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Created By <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={createdByField}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-[2px] bg-[#e9ecef] font-mono text-slate-700"
              />
            </div>
          </div>

          {/* Row 3: Email (left) | Assigned To * + Send SMS (right) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={emailField}
                onChange={(e) => setEmailField(e.target.value)}
                placeholder="Please enter your email"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-[2px] bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Assigned To <span className="text-red-600">*</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-[#007bff] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendSmsStaff}
                    onChange={(e) => setSendSmsStaff(e.target.checked)}
                  />
                  <span>Send SMS</span>
                </label>
              </div>
              <select
                value={assignedToField}
                onChange={(e) => setAssignedToField(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-[2px] bg-white"
              >
                <option value="demooperation">demooperation</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.username}>
                    {emp.username} ({emp.fullName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Phone + SMS to Customer (left) | Short Description * (right) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">Phone</label>
                <label className="inline-flex items-center gap-1.5 text-[#007bff] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendSmsCustomer}
                    onChange={(e) => setSendSmsCustomer(e.target.checked)}
                  />
                  <span>SMS to Customer</span>
                </label>
              </div>
              <input
                type="text"
                value={phoneField}
                onChange={(e) => setPhoneField(e.target.value)}
                placeholder="Please enter your phone"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-[2px] font-mono bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Short Description <span className="text-red-600">*</span>
              </label>
              <select
                value={issueTypeField}
                onChange={(e) => setIssueTypeField(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-[2px] bg-white"
              >
                {ISSUE_TYPES.map((issue) => (
                  <option key={issue} value={issue}>
                    {issue}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Full-Width Description * */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Description <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={descriptionField}
              onChange={(e) => setDescriptionField(e.target.value)}
              placeholder="Write detailed complain description *"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-[2px] bg-white"
            />
          </div>

          {/* Centered Green Create Complain Button (createtkt.png) */}
          <div className="text-center pt-1">
            <button
              type="submit"
              className="px-6 py-2 bg-[#28a745] hover:bg-[#218838] text-white font-semibold rounded-[3px] transition-colors cursor-pointer"
            >
              Create Complain
            </button>
          </div>

          <div className="text-[11px] text-slate-500 pt-1">
            <span className="text-red-600">*</span> These fields are required.
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: STAFF TASK MANAGEMENT (CRM & Field Dispatch)
  // =========================================================================
  if (activeModule === 'tasks') {
    const visibleTasks = tasks.filter((t) => {
      if (taskStatusFilter !== 'ALL' && t.status !== taskStatusFilter) return false;
      if (taskPopFilter !== 'ALL' && t.popName !== taskPopFilter) return false;
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.assignedTo.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const handleCreateTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (editingTask) {
        await updateStaffTask(editingTask.id, taskForm);
        notify(`Updated field task "${taskForm.title}".`, 'success');
      } else {
        await createStaffTask(user.uid, taskForm);
        notify(`Assigned field task "${taskForm.title}" to ${taskForm.assignedTo}.`, 'success');
      }
      setEditingTask(null);
      setShowTaskForm(false);
      setTaskForm({ ...taskForm, title: '', notes: '' });
    };

    return (
      <div className="space-y-3">
        <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#007bff]">CRM &amp; Tickets</span>
            <span className="mx-1.5 text-slate-500">/</span>
            <span className="text-slate-700">Staff Tasks &amp; Field Dispatch</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={taskPopFilter}
              onChange={(e) => setTaskPopFilter(e.target.value)}
              className="px-2 py-1 border border-slate-300 bg-white rounded-[2px] text-xs"
            >
              <option value="ALL">All POPs</option>
              {pops.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={taskStatusFilter}
              onChange={(e) => setTaskStatusFilter(e.target.value)}
              className="px-2 py-1 border border-slate-300 bg-white rounded-[2px] text-xs"
            >
              <option value="ALL">All Status ({tasks.length})</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded-[2px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search task or staff..."
                className="text-xs w-40 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setTaskForm({
                  title: '',
                  category: 'Fiber Splicing / Maintenance',
                  assignedTo: 'demooperation',
                  popName: pops[0]?.name || 'Mirpur-POP',
                  relatedCustomer: '',
                  dueDate: new Date().toISOString().slice(0, 10),
                  priority: 'Normal',
                  status: 'Pending',
                  notes: '',
                });
                setShowTaskForm(!showTaskForm);
              }}
              className="maxim-btn-success"
            >
              <Plus className="w-3.5 h-3.5" /> Assign Task
            </button>
          </div>
        </div>

        {showTaskForm && (
          <form onSubmit={handleCreateTask} className="bg-white border border-slate-300 overflow-hidden text-xs">
            <div className="maxim-mint-banner flex items-center justify-between px-3">
              <span>{editingTask ? `EDIT FIELD TASK: ${editingTask.title}` : 'ASSIGN NEW FIELD ENGINEERING TASK'}</span>
              <button type="button" onClick={() => setShowTaskForm(false)} className="text-slate-700 hover:text-black cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Splice 12-Core Distribution Box"
                    className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded-[2px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded-[2px]"
                  >
                    <option value="Fiber Splicing / Maintenance">Fiber Splicing / Maintenance</option>
                    <option value="New ONU Installation">New ONU Installation</option>
                    <option value="OLT / POP Power Check">OLT / POP Power Check</option>
                    <option value="Bill Collection Visit">Bill Collection Visit</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign To Staff</label>
                  <select
                    value={taskForm.assignedTo}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded-[2px]"
                  >
                    <option value="demooperation">demooperation</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.username}>
                        {emp.username} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">POP / Area</label>
                  <select
                    value={taskForm.popName}
                    onChange={(e) => setTaskForm({ ...taskForm, popName: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded-[2px]"
                  >
                    {pops.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded-[2px] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as StaffTask['priority'] })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded-[2px]"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                  placeholder="Field instructions / splitter port details..."
                  className="flex-1 px-2.5 py-1.5 border border-slate-300 bg-white rounded-[2px]"
                />
                <button type="submit" className="maxim-btn-primary">
                  Save Task
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto border border-slate-300 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="maxim-amber-thead">
                <th className="text-left">Task</th>
                <th className="text-left">Category</th>
                <th className="text-left">POP</th>
                <th className="text-left">Assigned Staff</th>
                <th className="text-left">Due Date</th>
                <th className="text-center">Priority</th>
                <th className="text-center">Status</th>
                <th className="text-right">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleTasks.map((tsk) => (
                <tr key={tsk.id} className="hover:bg-amber-50/40">
                  <td className="px-2.5 py-2 border-r border-slate-200">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-[#007bff]" /> {tsk.title}
                    </div>
                    {tsk.notes && <div className="text-[11px] text-slate-500">{tsk.notes}</div>}
                  </td>
                  <td className="px-2.5 py-2 border-r border-slate-200 text-slate-700">{tsk.category}</td>
                  <td className="px-2.5 py-2 border-r border-slate-200 text-slate-600">{tsk.popName}</td>
                  <td className="px-2.5 py-2 border-r border-slate-200 font-mono font-semibold text-slate-800">{tsk.assignedTo}</td>
                  <td className="px-2.5 py-2 border-r border-slate-200 font-mono text-slate-600">{tsk.dueDate}</td>
                  <td className="px-2.5 py-2 border-r border-slate-200 text-center">
                    <span
                      className={`font-semibold ${
                        tsk.priority === 'Urgent'
                          ? 'text-red-600'
                          : tsk.priority === 'High'
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {tsk.priority}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 border-r border-slate-200 text-center">
                    <span
                      className={`font-semibold ${
                        tsk.status === 'Completed'
                          ? 'text-emerald-700'
                          : tsk.status === 'In Progress'
                          ? 'text-[#007bff]'
                          : 'text-amber-700'
                      }`}
                    >
                      {tsk.status}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {tsk.status !== 'Completed' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const next = tsk.status === 'Pending' ? 'In Progress' : 'Completed';
                            await updateStaffTask(tsk.id, { status: next });
                            notify(`Task marked ${next}.`, 'success');
                          }}
                          className="maxim-classic-btn"
                        >
                          {tsk.status === 'Pending' ? 'Start' : 'Complete'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTask(tsk);
                          setTaskForm({
                            title: tsk.title,
                            category: tsk.category,
                            assignedTo: tsk.assignedTo,
                            popName: tsk.popName,
                            relatedCustomer: tsk.relatedCustomer,
                            dueDate: tsk.dueDate,
                            priority: tsk.priority,
                            status: tsk.status,
                            notes: tsk.notes,
                          });
                          setShowTaskForm(true);
                        }}
                        title="Edit Task"
                        className="p-1 text-[#007bff] hover:bg-blue-50 rounded cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {operator.canDeleteRecord && (
                        confirmDeleteTaskId === tsk.id ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteDocumentByPath('tasks', tsk.id);
                              setConfirmDeleteTaskId(null);
                              notify('Deleted task.', 'info');
                            }}
                            className="px-2 py-0.5 bg-red-600 text-white rounded-[2px] text-[11px] font-bold cursor-pointer"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTaskId(tsk.id)}
                            title="Delete Task"
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
    );
  }

  // =========================================================================
  // VIEW 3: SUPPORT TICKET LIST (Exact ticketlist.png Reference)
  // =========================================================================
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeTicket || !replyMessage.trim()) return;
    await addTicketComment(
      user.uid,
      activeTicket.id,
      formatBrandName(operator.username),
      operator.roleLabel,
      replyMessage.trim()
    );
    setReplyMessage('');
    notify(`Added comment to Ticket #${activeTicket.ticketNo}.`, 'success');
  };

  return (
    <div className="space-y-2.5 text-xs">
      {/* Top Gray Breadcrumb Bar (ticketlist.png) */}
      <div className="maxim-breadcrumb flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[#007bff] font-semibold">Tickets</span>
          <span className="mx-1.5 text-slate-500">/</span>
          <span className="text-slate-700">Ticket List</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1 border border-slate-300 bg-white rounded-[2px] text-xs"
            title="Filter by Ticket Status"
          >
            <option value="OPEN_ONLY">Open &amp; Active ({visibleTickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length})</option>
            <option value="ALL">All Tickets ({visibleTickets.length})</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          <button
            type="button"
            onClick={() => setActiveModule('tasks')}
            className="maxim-classic-btn"
          >
            Staff Tasks ({tasks.length})
          </button>
        </div>
      </div>

      {/* Left Green Square [+] Button + Centered 2-Column Filter Row (ticketlist.png) */}
      <div className="bg-white border border-slate-300 p-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveModule('tickets_create')}
            title="Create New Support Ticket"
            className="w-8 h-8 bg-[#28a745] hover:bg-[#218838] text-white rounded-[3px] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>

          <div className="flex-1 max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">Ticket Type</label>
                <span className="text-[11px] font-mono text-slate-500">{filterType ? 'Filtered' : 'ALL'}</span>
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-[2px] bg-white"
              >
                <option value="">ALL</option>
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Assigned To <span className="text-red-600">*</span>
              </label>
              <select
                value={filterAssignedTo}
                onChange={(e) => setFilterAssignedTo(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-[2px] bg-white"
              >
                <option value="">ALL</option>
                <option value="demooperation">demooperation</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.username}>
                    {emp.username}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Classic DataTables Show [25] entries + Search Row (ticketlist.png) */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span>Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value))}
              className="px-1.5 py-1 border border-slate-300 bg-white rounded-[2px] font-mono"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700">
            <label htmlFor="maxim-tkt-search">Search:</label>
            <input
              id="maxim-tkt-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded-[2px] bg-white w-48"
            />
          </div>
        </div>
      </div>

      {/* 11-Column Gold-Header Ticket Table (ticketlist.png) */}
      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="maxim-amber-thead">
              <th className="text-left whitespace-nowrap">TKT #</th>
              <th className="text-left whitespace-nowrap">Customer</th>
              <th className="text-left whitespace-nowrap">Type</th>
              <th className="text-left whitespace-nowrap">Contact</th>
              <th className="text-left whitespace-nowrap">Assigned To</th>
              <th className="text-left whitespace-nowrap">Date</th>
              <th className="text-right whitespace-nowrap">Balance</th>
              <th className="text-center whitespace-nowrap">Expiry</th>
              <th className="text-left whitespace-nowrap">Area</th>
              <th className="text-left whitespace-nowrap">Address</th>
              <th className="text-left whitespace-nowrap">Last Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {displayedTickets.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                  No matching tickets found. Click the green <strong>+</strong> button above to create a complain ticket.
                </td>
              </tr>
            ) : (
              displayedTickets.map((t, idx) => {
                const isExpanded = expandedTicketIds.includes(t.id);
                return (
                  <React.Fragment key={t.id}>
                    <tr className={`${idx % 2 === 1 ? 'bg-[#f9f9f9]' : 'bg-white'} hover:bg-amber-50/50`}>
                      {/* 1. TKT # with Green [+] Circle Expander */}
                      <td className="px-2 py-2 border-r border-slate-200 whitespace-nowrap font-mono">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleExpandTicket(t.id)}
                            title="Expand ticket details"
                            className={`w-4 h-4 rounded-full text-white inline-flex items-center justify-center cursor-pointer shrink-0 ${
                              isExpanded ? 'bg-red-600' : 'bg-[#28a745]'
                            }`}
                          >
                            {isExpanded ? <Minus className="w-2.5 h-2.5 stroke-[3]" /> : <Plus className="w-2.5 h-2.5 stroke-[3]" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTicket(t)}
                            className="font-bold text-[#0066cc] hover:underline cursor-pointer"
                          >
                            {t.ticketNo}
                          </button>
                        </div>
                      </td>

                      {/* 2. Customer (Solid User Icon + Blue Clickable Username -> Single View) */}
                      <td className="px-2 py-2 border-r border-slate-200 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-800 fill-slate-800 shrink-0" />
                          <button
                            type="button"
                            onClick={() => t.customerId && openCustomerSingleView(t.customerId)}
                            className="font-bold text-[#0066cc] hover:underline cursor-pointer"
                          >
                            {t.customerUsername}
                          </button>
                        </div>
                      </td>

                      {/* 3. Type */}
                      <td className="px-2 py-2 border-r border-slate-200 text-slate-800">{t.issueType}</td>

                      {/* 4. Contact */}
                      <td className="px-2 py-2 border-r border-slate-200 font-mono text-slate-800 whitespace-nowrap">
                        {t.contact}
                      </td>

                      {/* 5. Assigned To */}
                      <td className="px-2 py-2 border-r border-slate-200 font-mono text-slate-800 whitespace-nowrap">
                        {t.assignedTo}
                      </td>

                      {/* 6. Date */}
                      <td className="px-2 py-2 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                        {extractTicketDate(t)}
                      </td>

                      {/* 7. Balance */}
                      <td
                        className={`px-2 py-2 border-r border-slate-200 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                          t.customerBalance < 0 ? 'text-red-600' : 'text-slate-800'
                        }`}
                      >
                        {t.customerBalance.toFixed(2)}
                      </td>

                      {/* 8. Expiry (Stacked Lock/Unlock Icon on Top + Date Below, matching ticketlist.png) */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center leading-tight">
                          {t.lockStatus === 'Unlocked' ? (
                            <Unlock className="w-3.5 h-3.5 text-[#28a745]" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-red-600" />
                          )}
                          <span className="font-mono text-[11px] text-slate-700 mt-0.5">
                            {t.customerExpiry || '—'}
                          </span>
                        </div>
                      </td>

                      {/* 9. Area */}
                      <td className="px-2 py-2 border-r border-slate-200 text-slate-800 whitespace-nowrap">
                        {t.popName}
                      </td>

                      {/* 10. Address */}
                      <td className="px-2 py-2 border-r border-slate-200 text-slate-700 max-w-[170px] truncate" title={t.address}>
                        {t.address}
                      </td>

                      {/* 11. Last Comment */}
                      <td className="px-2 py-2 max-w-[230px]">
                        <button
                          type="button"
                          onClick={() => setActiveTicket(t)}
                          className="text-left text-slate-700 hover:text-[#0066cc] hover:underline line-clamp-2 cursor-pointer"
                        >
                          {formatCommentBrand(t.lastComment || t.description)}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#f3f8fb]">
                        <td colSpan={11} className="px-4 py-2.5 text-xs border-t border-slate-200">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div>
                                <strong>Subscriber Name:</strong> {t.customerName} · <strong>Status:</strong>{' '}
                                <span className="font-semibold text-[#0066cc]">{t.status}</span> ·{' '}
                                <strong>Priority:</strong> {t.priority} · <strong>Created By:</strong>{' '}
                                {formatCommentBrand(t.createdBy)}
                              </div>
                              <div className="text-slate-700">
                                <strong>Full Description:</strong> {t.description}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {t.customerId && (
                                <button
                                  type="button"
                                  onClick={() => openCustomerSingleView(t.customerId)}
                                  className="maxim-classic-btn"
                                >
                                  Customer Single View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveTicket(t)}
                                className="maxim-btn-primary"
                              >
                                Update Status / Reply
                              </button>
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

      <div className="text-[11px] text-slate-600 flex items-center justify-between px-1">
        <span>
          Showing {displayedTickets.length === 0 ? 0 : 1} to {displayedTickets.length} of {filteredTickets.length} entries
        </span>
      </div>

      {/* Ticket Conversation & Workflow Modal */}
      {activeTicket && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-400 max-w-2xl w-full rounded-[2px] overflow-hidden shadow-xl text-xs">
            <div className="maxim-mint-banner flex items-center justify-between px-3">
              <span>
                TICKET #{activeTicket.ticketNo} — {activeTicket.customerUsername} ({activeTicket.issueType})
              </span>
              <button
                type="button"
                onClick={() => setActiveTicket(null)}
                className="text-slate-700 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f8f9fa] border border-slate-300 p-2.5">
                <div>
                  <span className="text-slate-500 block">Subscriber</span>
                  <strong>{activeTicket.customerName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Contact</span>
                  <span className="font-mono">{activeTicket.contact}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">POP / Area</span>
                  <span>{activeTicket.popName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <strong>{activeTicket.status}</strong>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-300 p-2.5 text-slate-800">
                <strong>Complaint Description:</strong> {activeTicket.description}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                {activeTicket.status !== 'Closed' ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-700">Status:</span>
                      {(['Open', 'In Progress', 'Resolved'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={async () => {
                            await updateSupportTicket(activeTicket.id, { status: st });
                            setActiveTicket({ ...activeTicket, status: st });
                            notify(`Ticket #${activeTicket.ticketNo} status updated to ${st}.`, 'success');
                          }}
                          className={`px-2.5 py-1 rounded-[2px] font-semibold cursor-pointer ${
                            activeTicket.status === st
                              ? 'bg-[#007bff] text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {st === 'Resolved' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                          {st}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={async () => {
                          await updateSupportTicket(activeTicket.id, { status: 'Closed' });
                          setActiveTicket({ ...activeTicket, status: 'Closed' });
                          notify(`Ticket #${activeTicket.ticketNo} archived as Closed (Locked).`, 'info');
                        }}
                        className="px-2.5 py-1 rounded-[2px] font-semibold bg-slate-800 hover:bg-black text-white cursor-pointer"
                      >
                        Close &amp; Lock
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600">Assigned To:</span>
                      <select
                        value={activeTicket.assignedTo}
                        onChange={async (e) => {
                          const nextStaff = e.target.value;
                          await updateSupportTicket(activeTicket.id, { assignedTo: nextStaff });
                          setActiveTicket({ ...activeTicket, assignedTo: nextStaff });
                          notify(`Reassigned ticket to ${nextStaff}.`, 'info');
                        }}
                        className="px-2 py-1 border border-slate-300 rounded-[2px] bg-white"
                      >
                        <option value="demooperation">demooperation</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.username}>
                            {emp.username}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <span className="text-slate-600 font-semibold">
                    Archived as <strong>Closed</strong> (terminal lock).
                  </span>
                )}

                {operator.canDeleteRecord && (
                  confirmDeleteTicketId === activeTicket.id ? (
                    <span className="inline-flex items-center gap-1 bg-red-50 border border-red-300 px-2 py-1 rounded-[2px]">
                      <span className="text-red-700 font-semibold">Delete?</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!user) return;
                          await deleteDocumentByPath('tickets', activeTicket.id);
                          await logAuditEvent(
                            user.uid,
                            formatBrandName(operator.username),
                            'Delete Ticket',
                            `Deleted ticket #${activeTicket.ticketNo} (${activeTicket.customerUsername})`,
                            activeTicket.ticketNo,
                            activeTicket.popName
                          );
                          setConfirmDeleteTicketId(null);
                          setActiveTicket(null);
                          notify(`Deleted Ticket #${activeTicket.ticketNo}.`, 'info');
                        }}
                        className="px-1.5 py-0.5 bg-red-600 text-white font-bold rounded-[2px] cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTicketId(null)}
                        className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-[2px] cursor-pointer"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTicketId(activeTicket.id)}
                      className="maxim-classic-btn text-red-700"
                    >
                      <Trash2 className="w-3 h-3 inline mr-1" /> Delete
                    </button>
                  )
                )}
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-300 p-2.5 bg-[#f8f9fa]">
                {ticketComments.length === 0 ? (
                  <div className="text-slate-500 text-center py-3">
                    Latest log: {formatCommentBrand(activeTicket.lastComment || 'No follow-up notes yet.')}
                  </div>
                ) : (
                  ticketComments.map((cmt) => (
                    <div key={cmt.id} className="bg-white border border-slate-200 p-2 rounded-[2px]">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                        <strong className="text-[#0066cc]">
                          {formatCommentBrand(cmt.author)} ({cmt.authorRole})
                        </strong>
                        <span className="font-mono">{cmt.timestampStr}</span>
                      </div>
                      <div className="text-slate-800">{cmt.message}</div>
                    </div>
                  ))
                )}
              </div>

              {activeTicket.status !== 'Closed' && (
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Write engineer troubleshooting update or resolution note..."
                    className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-[2px]"
                  />
                  <button type="submit" className="maxim-btn-success">
                    <Send className="w-3.5 h-3.5" /> Post Comment
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
