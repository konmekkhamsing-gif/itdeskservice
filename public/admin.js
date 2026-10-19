// =====================================================
// ส่วน Logic หน้า Admin Management Ticket
// - เปิด/ปิดโหมด Dark Mode
// - แสดงรายการ ticket และอัปเดตสถานะ
// - สร้าง ticket ใหม่และ Export Excel
// =====================================================
const ticketTableBody = document.getElementById('ticketTableBody');
const logoutButton = document.getElementById('logoutButton');
const notificationBadge = document.getElementById('notificationBadge');
const notificationList = document.getElementById('notificationList');
const clearNotificationsButton = document.getElementById('clearNotificationsButton');
const themeToggleButton = document.getElementById('themeToggleButton');
const filterStatus = document.getElementById('filterStatus');
const filterCategory = document.getElementById('filterCategory');
const filterFromDate = document.getElementById('filterFromDate');
const filterToDate = document.getElementById('filterToDate');
const filterSearch = document.getElementById('filterSearch');
const applyFiltersButton = document.getElementById('applyFiltersButton');
const resetFiltersButton = document.getElementById('resetFiltersButton');
const viewTicketsButton = document.getElementById('viewTicketsButton');
const createTicketButton = document.getElementById('createTicketButton');
const exportExcelButton = document.getElementById('exportExcelButton');
const createTicketSection = document.getElementById('createTicketSection');
const manageTicketsSection = document.getElementById('manageTicketsSection');
const adminCreateTicketForm = document.getElementById('adminCreateTicketForm');
const cancelCreateButton = document.getElementById('cancelCreateButton');
const creatorDepartment = document.getElementById('creatorDepartment');
const creatorEquipment = document.getElementById('creatorEquipment');
const createdDate = document.getElementById('createdDate');
const completedDate = document.getElementById('completedDate');
const creatorName = document.getElementById('creatorName');
const creatorUsername = document.getElementById('creatorUsername');
const creatorCategory = document.getElementById('creatorCategory');
const creatorIssueDetail = document.getElementById('creatorIssueDetail');
const creatorRepairNote = document.getElementById('creatorRepairNote');
const ticketAiModal = document.getElementById('ticketAiModal');
const ticketAiClose = document.getElementById('ticketAiClose');
const ticketAiCancel = document.getElementById('ticketAiCancel');
const ticketAiAsk = document.getElementById('ticketAiAsk');
const ticketAiSubtitle = document.getElementById('ticketAiSubtitle');
const ticketAiIssue = document.getElementById('ticketAiIssue');
const ticketAiStatus = document.getElementById('ticketAiStatus');
const ticketAiAnswer = document.getElementById('ticketAiAnswer');
const ticketRecords = new Map();
let selectedTicketForAi = null;

const urgencyConfig = {
  critical: { label: 'ด่วนมาก', className: 'bg-red-100 text-red-800 border-red-300' },
  high: { label: 'ด่วน', className: 'bg-orange-100 text-orange-800 border-orange-300' },
  medium: { label: 'ปานกลาง', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  low: { label: 'ทั่วไป', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
};

// -----------------------------------------------------
// ส่วนตั้งค่า Theme
// -----------------------------------------------------
function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  themeToggleButton.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('helpdeskTheme', theme);

  // toggle flatpickr dark theme if present
  const fpThemeLink = document.getElementById('flatpickrDarkTheme');
  if (fpThemeLink) fpThemeLink.disabled = !isDark;
}

const savedTheme = localStorage.getItem('helpdeskTheme') || 'light';
applyTheme(savedTheme);

// initialize flatpickr for admin date fields
function initAdminDatePickers() {
  if (typeof flatpickr === 'undefined') return;

  const commonOpts = {
    allowInput: true,
    locale: (flatpickr && flatpickr.l10ns && flatpickr.l10ns.th) ? 'th' : 'default',
    onReady: function(selectedDates, dateStr, instance) {
      if (instance.altInput && selectedDates && selectedDates.length) {
        const d = selectedDates[0];
        const monthName = instance.l10n.months.longhand[d.getMonth()];
        const day = d.getDate();
        const buddhistYear = d.getFullYear() + 543;
        // include time if present
        const timePart = (d.getHours() || d.getMinutes()) ? (' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0')) : '';
        instance.altInput.value = `${day} ${monthName} ${buddhistYear}${timePart}`;
      }
    },
    onChange: function(selectedDates, dateStr, instance) {
      if (instance.altInput && selectedDates && selectedDates.length) {
        const d = selectedDates[0];
        const monthName = instance.l10n.months.longhand[d.getMonth()];
        const day = d.getDate();
        const buddhistYear = d.getFullYear() + 543;
        const timePart = (d.getHours() || d.getMinutes()) ? (' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0')) : '';
        instance.altInput.value = `${day} ${monthName} ${buddhistYear}${timePart}`;
      }
    }
  };

  // date-only filters
  if (filterFromDate) {
    flatpickr(filterFromDate, Object.assign({}, commonOpts, { dateFormat: 'Y-m-d', altInput: true, altFormat: 'j F Y' }));
  }
  if (filterToDate) {
    flatpickr(filterToDate, Object.assign({}, commonOpts, { dateFormat: 'Y-m-d', altInput: true, altFormat: 'j F Y' }));
  }

  // datetime inputs in create form
  if (createdDate) {
    flatpickr(createdDate, Object.assign({}, commonOpts, { enableTime: true, dateFormat: "Y-m-d\\TH:i", altInput: true, altFormat: 'j F Y H:i' }));
  }
  if (completedDate) {
    flatpickr(completedDate, Object.assign({}, commonOpts, { enableTime: true, dateFormat: "Y-m-d\\TH:i", altInput: true, altFormat: 'j F Y H:i' }));
  }

  // per-row completed datetime inputs (rendered dynamically) — select by attribute
  document.querySelectorAll('input[data-completed-at]').forEach(input => {
    // avoid double-init: destroy existing fp instance if any
    if (input._flatpickr) input._flatpickr.destroy();
    flatpickr(input, Object.assign({}, commonOpts, { enableTime: true, dateFormat: "Y-m-d\\TH:i", altInput: true, altFormat: 'j F Y H:i' }));
  });
}

initAdminDatePickers();

themeToggleButton.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  applyTheme(nextTheme);
});

// -----------------------------------------------------
// ส่วนตรวจสอบสิทธิ์ Admin
// -----------------------------------------------------
function requireLogin() {
  const auth = JSON.parse(localStorage.getItem('helpdeskAuth') || 'null');
  if (!auth || auth.role !== 'admin') {
    window.location.href = '/';
    return null;
  }

  return auth;
}

// -----------------------------------------------------
// ส่วน helper สถานะและวันที่
// -----------------------------------------------------
function statusClass(status) {
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

function setDefaultCreateDateTimes() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localNow = new Date(now.getTime() - offset).toISOString().slice(0, 16);
  if (createdDate && createdDate._flatpickr) {
    createdDate._flatpickr.setDate(localNow);
  } else if (createdDate) {
    createdDate.value = localNow;
  }
  if (completedDate && completedDate._flatpickr) {
    completedDate._flatpickr.clear();
  } else if (completedDate) {
    completedDate.value = '';
  }
}

// -----------------------------------------------------
// ส่วน Notification
// -----------------------------------------------------
async function loadNotifications() {
  const auth = requireLogin();
  if (!auth) return;

  const response = await fetch('/api/admin/notifications');
  const result = await response.json();

  notificationBadge.textContent = String(result.count || 0);
  notificationList.innerHTML = result.items.length
    ? result.items.map(item => `
      <div class="notification-card rounded-2xl bg-rose-50 border border-rose-100 p-3">
        <div class="flex justify-between items-start gap-3">
          <div>
            <div class="font-semibold text-slate-800">Ticket #${item.ticketId} จาก ${item.userName}${item.reporterUsername ? ' (' + item.reporterUsername + ')' : ''}</div>
            <div class="text-sm text-slate-600 mt-1">${item.issueDetail || 'ไม่มีรายละเอียด'}</div>
          </div>
          <div class="text-xs text-slate-500 whitespace-nowrap">${new Date(item.createdAt).toLocaleString('th-TH')}</div>
        </div>
      </div>
    `).join('')
    : '<div class="text-sm text-slate-500">ยังไม่มีแจ้งเตือน</div>';
}

// -----------------------------------------------------
// ส่วนโหลดตาราง ticket และจัดการ action
// - ดึง ticket ตาม filter
// - Render row และ attach event handler สำหรับอัปเดต
// -----------------------------------------------------
async function loadTickets() {
  const auth = requireLogin();
  if (!auth) return;

  const query = new URLSearchParams();
  query.set('pendingOnly', '1');
  if (filterStatus.value) query.set('status', filterStatus.value);
  if (filterCategory.value) query.set('category', filterCategory.value);
  if (filterFromDate.value) query.set('createdFrom', filterFromDate.value);
  if (filterToDate.value) query.set('createdTo', filterToDate.value);
  if (filterSearch.value.trim()) query.set('search', filterSearch.value.trim());

  const response = await fetch(`/api/tickets?${query.toString()}`);
  const tickets = await response.json();
  ticketRecords.clear();
  tickets.forEach((ticket) => ticketRecords.set(String(ticket.ticket_id), ticket));

  ticketTableBody.innerHTML = tickets.length ? tickets.map((ticket, index) => {
    const showAccept = ticket.status === 'pending';
    const showClose = ticket.status === 'in_progress';
    const urgency = urgencyConfig[ticket.urgency] || urgencyConfig.medium;
    const isCompletedGroupStart = ticket.status === 'completed'
      && (index === 0 || tickets[index - 1].status !== 'completed');

    return `
    <tr class="align-top ticket-urgency-row ${isCompletedGroupStart ? 'completed-group-start' : ''} ${ticket.status === 'completed' ? 'completed-row' : ''} ${ticket.urgency === 'critical' ? 'critical bg-red-50' : ticket.urgency === 'high' ? 'high bg-orange-50' : ''}">
      <td class="px-4 py-4 text-sm text-slate-900 font-semibold">#${ticket.ticket_id}</td>
      <td class="px-4 py-4 text-sm text-slate-800">${ticket.user_name || 'Unknown User'}</td>
      <td class="px-4 py-4 text-sm text-slate-800">
        <div class="font-medium">${ticket.equipment_code}</div>
        <div class="text-xs text-slate-500">${ticket.equipment_type || ''}</div>
        <div class="text-xs text-slate-500">${ticket.department || ''} • ${ticket.room || ''}</div>
      </td>
      <td class="px-4 py-4 text-sm text-slate-800">${ticket.ticket_category === 'software' ? 'Software' : 'Hardware'}</td>
      <td class="px-4 py-4 text-sm">
        <span class="ticket-urgency-badge rounded-full border px-3 py-1 text-xs font-semibold ${ticket.urgency || 'medium'} ${urgency.className}">${urgency.label}</span>
      </td>
      <td class="px-4 py-4 text-sm text-slate-800">
        <div class="font-medium">${ticket.reporter_name || ticket.user_name || 'Unknown'}</div>
        <div class="text-xs text-slate-500">${ticket.reporter_username || ''}</div>
      </td>
      <td class="px-4 py-4 text-sm text-slate-800 max-w-xs leading-6">${ticket.issue_detail}</td>
      <td class="px-4 py-4 text-sm text-slate-800">
        <div class="space-y-2">
          <div><span class="font-medium">แจ้ง:</span> ${formatDateTime(ticket.reported_at || ticket.created_at)}</div>
          
        </div>
      </td>
      <td class="px-4 py-4 text-sm">
        <span class="status-badge px-3 py-1 rounded-full text-xs font-semibold ${statusClass(ticket.status)}${ticket.status === 'completed' ? ' status-completed' : ''}">${ticket.status.replace('_', ' ')}</span>
      </td>
      <td class="px-4 py-4 text-sm text-slate-800">
        <textarea data-note="${ticket.ticket_id}" rows="3" class="w-full border border-slate-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 repair-note">${ticket.repair_note || ''}</textarea>
      </td>
      <td class="px-4 py-4 text-sm">
        <div class="flex flex-col gap-2">
          ${showAccept ? `<button data-action="accept" data-id="${ticket.ticket_id}" class="bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-200">รับงาน</button>` : ''}
          ${showClose ? `<label class="text-xs text-slate-600">วันและเวลาเสร็จงาน<input data-completed-at="${ticket.ticket_id}" type="datetime-local" value="${toDateTimeLocal(ticket.completed_at)}" class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm" /></label>` : ''}
          ${showClose ? `<button data-action="close" data-id="${ticket.ticket_id}" class="bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-700 hover:-translate-y-0.5 transition-all duration-200">ปิดงาน</button>` : ''}
          <button data-action="save" data-id="${ticket.ticket_id}" class="bg-slate-600 text-white px-3 py-2 rounded-xl hover:bg-slate-700 hover:-translate-y-0.5 transition-all duration-200">บันทึกหมายเหตุ</button>
          <button data-action="ai-help" data-id="${ticket.ticket_id}" class="bg-violet-600 text-white px-3 py-2 rounded-xl hover:bg-violet-700 hover:-translate-y-0.5 transition-all duration-200">AIวิเคราะห์</button>
          ${ticket.status === 'completed' ? '<span class="inline-block rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-xs font-semibold">เสร็จสิ้น</span>' : ''}
        </div>
      </td>
    </tr>
  `;
  }).join('') : `
    <tr>
      <td colspan="11" class="px-4 py-6 text-center text-sm text-slate-500">ไม่พบ Ticket ที่ตรงกับเงื่อนไข</td>
    </tr>
  `;

  // initialize flatpickr instances for newly rendered inputs
  initAdminDatePickers();

  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', async () => {
      const ticketId = button.dataset.id;
      if (button.dataset.action === 'ai-help') {
        openTicketAi(ticketRecords.get(String(ticketId)));
        return;
      }
      const note = document.querySelector(`[data-note="${ticketId}"]`).value;
      let status;

      if (button.dataset.action === 'accept') {
        status = 'in_progress';
      } else if (button.dataset.action === 'close') {
        status = 'completed';
      } else {
        status = undefined;
      }

      try {
        const body = {
          repairNote: note,
          adminId: auth.userId
        };
        if (status) body.status = status;
        if (button.dataset.action === 'close') {
          const completedAt = document.querySelector(`[data-completed-at="${ticketId}"]`).value;
          body.completedAt = completedAt ? new Date(completedAt).toISOString() : null;
        }

        const response = await fetch(`/api/tickets/${ticketId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'ไม่สามารถอัปเดต ticket ได้');

        alert(result.message);
        await loadTickets();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

function openTicketAi(ticket) {
  if (!ticket) return;
  selectedTicketForAi = ticket;
  ticketAiSubtitle.textContent = `Ticket #${ticket.ticket_id} • ${ticket.equipment_code || 'ไม่ระบุอุปกรณ์'}`;
  ticketAiIssue.textContent = `รายละเอียดปัญหา: ${ticket.issue_detail || 'ไม่พบรายละเอียด'}`;
  ticketAiStatus.textContent = 'AI จะช่วยจัดลำดับการตรวจสอบเบื้องต้นให้';
  ticketAiAnswer.textContent = '';
  ticketAiAnswer.classList.add('hidden');
  ticketAiAsk.disabled = false;
  ticketAiModal.classList.remove('hidden');
  ticketAiModal.classList.remove('ticket-ai-closing');
  ticketAiModal.classList.add('ticket-ai-opening');
}

function closeTicketAi() {
  if (ticketAiModal.classList.contains('hidden') || ticketAiModal.classList.contains('ticket-ai-closing')) return;
  ticketAiModal.classList.remove('ticket-ai-opening');
  ticketAiModal.classList.add('ticket-ai-closing');
}

ticketAiModal.addEventListener('animationend', (event) => {
  if (event.target === ticketAiModal && ticketAiModal.classList.contains('ticket-ai-closing')) {
    ticketAiModal.classList.add('hidden');
    ticketAiModal.classList.remove('ticket-ai-closing');
    selectedTicketForAi = null;
  }
});

async function askTicketAi() {
  if (!selectedTicketForAi || ticketAiAsk.disabled) return;
  const ticket = selectedTicketForAi;
  ticketAiAsk.disabled = true;
  ticketAiStatus.textContent = 'กำลังวิเคราะห์ Ticket...';
  ticketAiAnswer.classList.add('hidden');

  const question = [
    'ช่วยวิเคราะห์ Ticket งาน IT ของโรงพยาบาลนี้สำหรับแอดมินช่าง',
    `อุปกรณ์: ${ticket.equipment_code || 'ไม่ระบุ'}`,
    `ประเภท: ${ticket.ticket_category === 'software' ? 'Software' : 'Hardware'}`,
    `รายละเอียดอาการ: ${ticket.issue_detail || 'ไม่ระบุ'}`,
    '',
    'ขอคำตอบภาษาไทยแบบสั้นและปฏิบัติได้ โดยแบ่งเป็น 1) ตรวจสอบเบื้องต้นทีละขั้น 2) สิ่งที่ควรระวัง 3) เกณฑ์ส่งต่อหรือเรียกช่างเฉพาะทาง และอย่าแนะนำให้แกะหรือซ่อมอุปกรณ์ทางการแพทย์ที่อาจกระทบผู้ป่วย ให้ระบุว่าเป็นคำแนะนำเบื้องต้นเท่านั้น'
  ].join('\n');

  try {
    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถขอคำแนะนำจาก AI ได้');
    ticketAiAnswer.textContent = result.answer;
    ticketAiAnswer.classList.remove('hidden');
    ticketAiStatus.textContent = 'คำแนะนำเบื้องต้นจาก AI';
  } catch (error) {
    ticketAiStatus.textContent = error.message;
  } finally {
    ticketAiAsk.disabled = false;
  }
}

ticketAiClose.addEventListener('click', closeTicketAi);
ticketAiCancel.addEventListener('click', closeTicketAi);
ticketAiAsk.addEventListener('click', askTicketAi);
ticketAiModal.addEventListener('click', (event) => {
  if (event.target === ticketAiModal) closeTicketAi();
});

// -----------------------------------------------------
// ส่วนสลับหน้า/section
// -----------------------------------------------------
viewTicketsButton.addEventListener('click', () => {
  createTicketSection.classList.add('hidden');
  manageTicketsSection.classList.remove('hidden');
});

createTicketButton.addEventListener('click', () => {
  manageTicketsSection.classList.add('hidden');
  createTicketSection.classList.remove('hidden');
  setDefaultCreateDateTimes();
  loadDepartmentsForCreate();
});

cancelCreateButton.addEventListener('click', () => {
  adminCreateTicketForm.reset();
  createTicketSection.classList.add('hidden');
  manageTicketsSection.classList.remove('hidden');
});

// -----------------------------------------------------
// ส่วน helper ฟอร์มสร้าง ticket
// -----------------------------------------------------
async function loadDepartmentsForCreate() {
  if (creatorEquipment.options.length > 1) return;
  creatorEquipment.innerHTML = '<option value="">-- เลือกแผนก ก่อน --</option>';
}

creatorDepartment.addEventListener('change', async () => {
  const dept = creatorDepartment.value;
  if (!dept) {
    creatorEquipment.innerHTML = '<option value="">-- เลือกอุปกรณ์ --</option>';
    return;
  }

  try {
    const response = await fetch(`/api/equipment-codes?department=${encodeURIComponent(dept)}`);
    const equipments = await response.json();
    creatorEquipment.innerHTML = '<option value="">-- เลือกอุปกรณ์ --</option>' + equipments.map(e => `<option value="${e.equipment_code}">${e.equipment_code} (${e.equipment_type})</option>`).join('');
  } catch (error) {
    console.error(error);
  }
});

// -----------------------------------------------------
// ส่วนสร้าง ticket ใหม่ใน role Admin
// -----------------------------------------------------
adminCreateTicketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const auth = requireLogin();
  if (!auth) return;

  const payload = {
    reporterName: creatorName.value.trim(),
    reporterUsername: creatorUsername.value.trim(),
    equipmentCode: creatorEquipment.value,
    ticketCategory: creatorCategory.value,
    issueDetail: creatorIssueDetail.value.trim(),
    repairNote: creatorRepairNote.value.trim(),
    createdDate: createdDate.value,
    completedDate: completedDate.value || null,
    adminId: auth.userId
  };

  try {
    const response = await fetch('/api/admin/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถสร้าง Ticket ได้');

    const completionResponse = await fetch(`/api/tickets/${result.ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        completedAt: payload.completedDate ? new Date(payload.completedDate).toISOString() : null,
        repairNote: payload.repairNote,
        adminId: auth.userId
      })
    });
    const completionResult = await completionResponse.json();
    if (!completionResponse.ok) {
      throw new Error(`สร้าง Ticket #${result.ticketId} แล้ว แต่เปลี่ยนสถานะเป็นเสร็จสิ้นไม่สำเร็จ: ${completionResult.error || 'กรุณาลองใหม่'}`);
    }

    alert(`สร้าง Ticket #${result.ticketId} และบันทึกเป็นเสร็จสิ้นแล้ว`);
    window.location.href = '/completed-tickets.html';
  } catch (error) {
    alert(error.message);
  }
});

// -----------------------------------------------------
// ส่วน Export และการกรองข้อมูล
// -----------------------------------------------------
exportExcelButton.addEventListener('click', () => {
  const auth = requireLogin();
  if (!auth) return;

  const query = new URLSearchParams();
  if (filterStatus.value) query.set('status', filterStatus.value);
  if (filterCategory.value) query.set('category', filterCategory.value);
  if (filterFromDate.value) query.set('createdFrom', filterFromDate.value);
  if (filterToDate.value) query.set('createdTo', filterToDate.value);
  if (filterSearch.value.trim()) query.set('search', filterSearch.value.trim());
  query.set('adminId', auth.userId);
  window.location.href = `/api/admin/tickets/export?${query.toString()}`;
});

clearNotificationsButton.addEventListener('click', async () => {
  const auth = requireLogin();
  if (!auth) return;

  await fetch('/api/admin/notifications', { method: 'DELETE' });
  await loadNotifications();
});

applyFiltersButton.addEventListener('click', () => {
  loadTickets();
});

resetFiltersButton.addEventListener('click', () => {
  filterStatus.value = '';
  filterCategory.value = '';
  if (filterFromDate && filterFromDate._flatpickr) filterFromDate._flatpickr.clear(); else if (filterFromDate) filterFromDate.value = '';
  if (filterToDate && filterToDate._flatpickr) filterToDate._flatpickr.clear(); else if (filterToDate) filterToDate.value = '';
  filterSearch.value = '';
  loadTickets();
});

logoutButton.addEventListener('click', () => {
  localStorage.removeItem('helpdeskAuth');
  window.location.href = '/';
});

// -----------------------------------------------------
// ส่วนเริ่มต้นหน้า
// -----------------------------------------------------
requireLogin();
loadTickets();
loadNotifications();
window.setInterval(loadNotifications, 5000);
