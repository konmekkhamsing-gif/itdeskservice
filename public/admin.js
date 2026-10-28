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
const ticketFiltersSection = document.getElementById('ticketFiltersSection');
const ticketTableSection = document.getElementById('ticketTableSection');
const manageUsersButton = document.getElementById('manageUsersButton');
const userManagementSection = document.getElementById('userManagementSection');
const userManagementForm = document.getElementById('userManagementForm');
const managedUserId = document.getElementById('managedUserId');
const managedUsername = document.getElementById('managedUsername');
const managedFullName = document.getElementById('managedFullName');
const managedDepartment = document.getElementById('managedDepartment');
const managedPassword = document.getElementById('managedPassword');
const managedPasswordRequiredLabel = document.getElementById('managedPasswordRequiredLabel');
const managedPasswordHelp = document.getElementById('managedPasswordHelp');
const saveManagedUserButton = document.getElementById('saveManagedUserButton');
const cancelManagedUserEditButton = document.getElementById('cancelManagedUserEditButton');
const userManagementMessage = document.getElementById('userManagementMessage');
const managedUsersTableBody = document.getElementById('managedUsersTableBody');
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

const departmentOptions = [
  'งานเวชศาสตร์ครอบครัวและบริการด้านปฐมภูมิ',
  'องค์กรแพทย์',
  'งานผู้ป่วยนอก',
  'งานอุบัติเหตุฉุกเฉิน',
  'งานผู้ป่วยใน ตึก1',
  'งานห้องคลอด',
  'คลินิคพิเศษ ARV,TB-ASTHMA',
  'ระบบยา',
  'งานเทคนิคการแพทย์',
  'งานกายภาพบำบัด',
  'งานรังสีวิทยา',
  'งานแพทย์แผนไทย',
  'งานโภชนาการ/โรงครัว',
  'งานเวชระเบียน/ห้องบัตร',
  'งานจ่ายกลาง',
  'งานประกันสุขภาพ',
  'งานธุรการ',
  'งานยานพาหนะ',
  'งานสนาม/ซ่อมบำรุง',
  'กลุ่มการพยาบาล',
  'งานทันตสาธารณสุข',
  'จุดคัดกรอง',
  'คลินิกNCD',
  'งานการเงิน/บัญชี',
  'งานพัสดุ',
  'งานซักฟอก',
  'ทีม IC',
  'ทีม ENV',
  'ทีมPCT',
  'คณะกรรมการบริหารและ HRD',
  'งานฝากครรภ์',
  'งานทำความสะอาด',
  'จุดซักประวัติระบบทางเดินหายใจ (ARI)',
  'จิตเวชและยาเสพติด',
  'งานผู้ป่วยใน ตึก2',
  'พัฒนาการเด็ก(PCU)',
  'พัฒนาการเด็ก(จิตเวช)',
  'ห้องผ่าตัด',
  'งานเทคโนโลยีสารสนเทศ'
];

function populateDepartmentSelect(select) {
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- เลือกแผนก --';
  select.appendChild(placeholder);

  departmentOptions.forEach((department) => {
    const option = document.createElement('option');
    option.value = department;
    option.textContent = department;
    select.appendChild(option);
  });
}

populateDepartmentSelect(creatorDepartment);
populateDepartmentSelect(managedDepartment);

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
            <div class="font-semibold text-slate-800">Ticket #${escapeHtml(item.ticketId)} จาก ${escapeHtml(item.userName)}${item.reporterUsername ? ' (' + escapeHtml(item.reporterUsername) + ')' : ''}</div>
            <div class="text-sm text-slate-600 mt-1">${escapeHtml(item.issueDetail || 'ไม่มีรายละเอียด')}</div>
          </div>
          <div class="text-xs text-slate-500 whitespace-nowrap">${escapeHtml(new Date(item.createdAt).toLocaleString('th-TH'))}</div>
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
  ticketTableBody.innerHTML = tickets.length ? tickets.map((ticket, index) => {
    const showAccept = ticket.status === 'pending';
    const showClose = ticket.status === 'in_progress';
    const urgencyKey = Object.prototype.hasOwnProperty.call(urgencyConfig, ticket.urgency)
      ? ticket.urgency
      : 'medium';
    const urgency = urgencyConfig[urgencyKey];
    const isCompletedGroupStart = ticket.status === 'completed'
      && (index === 0 || tickets[index - 1].status !== 'completed');

    return `
    <tr class="align-top ticket-urgency-row ${isCompletedGroupStart ? 'completed-group-start' : ''} ${ticket.status === 'completed' ? 'completed-row' : ''} ${urgencyKey === 'critical' ? 'critical bg-red-50' : urgencyKey === 'high' ? 'high bg-orange-50' : ''}">
      <td class="px-4 py-4 text-sm text-slate-900 font-semibold">#${escapeHtml(ticket.ticket_id)}</td>
      <td class="px-4 py-4 text-sm text-slate-800">${escapeHtml(ticket.user_name || 'Unknown User')}</td>
      <td class="px-4 py-4 text-sm text-slate-800">
        <div class="font-medium">${escapeHtml(ticket.equipment_code)}</div>
        <div class="text-xs text-slate-500">${escapeHtml(ticket.equipment_type || '')}</div>
        <div class="text-xs text-slate-500">${escapeHtml(ticket.department || '')} • ${escapeHtml(ticket.room || '')}</div>
      </td>
      <td class="px-4 py-4 text-sm text-slate-800">${ticket.ticket_category === 'software' ? 'Software' : 'Hardware'}</td>
      <td class="px-4 py-4 text-sm">
        <span class="ticket-urgency-badge rounded-full border px-3 py-1 text-xs font-semibold ${urgencyKey} ${urgency.className}">${urgency.label}</span>
      </td>
      <td class="px-4 py-4 text-sm text-slate-800">
        <div class="font-medium">${escapeHtml(ticket.reporter_name || ticket.user_name || 'Unknown')}</div>
        <div class="text-xs text-slate-500">${escapeHtml(ticket.reporter_username || '')}</div>
      </td>
      <td class="px-4 py-4 text-sm text-slate-800 max-w-xs leading-6">${escapeHtml(ticket.issue_detail)}</td>
      <td class="px-4 py-4 text-sm text-slate-800">
        <div class="space-y-2">
          <div><span class="font-medium">แจ้ง:</span> ${escapeHtml(formatDateTime(ticket.reported_at || ticket.created_at))}</div>
          
        </div>
      </td>
      <td class="px-4 py-4 text-sm">
        <span class="status-badge px-3 py-1 rounded-full text-xs font-semibold ${statusClass(ticket.status)}${ticket.status === 'completed' ? ' status-completed' : ''}">${escapeHtml(String(ticket.status || '').replace('_', ' '))}</span>
      </td>
      <td class="px-4 py-4 text-sm text-slate-800">
        <textarea data-note="${escapeHtml(ticket.ticket_id)}" rows="3" class="w-full border border-slate-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 repair-note">${escapeHtml(ticket.repair_note || '')}</textarea>
      </td>
      <td class="px-4 py-4 text-sm">
        <div class="flex flex-col gap-2">
          ${showAccept ? `<button data-action="accept" data-id="${escapeHtml(ticket.ticket_id)}" class="bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-200">รับงาน</button>` : ''}
          ${showClose ? `<label class="text-xs text-slate-600">วันและเวลาเสร็จงาน<input data-completed-at="${escapeHtml(ticket.ticket_id)}" type="datetime-local" value="${escapeHtml(toDateTimeLocal(ticket.completed_at))}" class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm" /></label>` : ''}
          ${showClose ? `<button data-action="close" data-id="${escapeHtml(ticket.ticket_id)}" class="bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-700 hover:-translate-y-0.5 transition-all duration-200">ปิดงาน</button>` : ''}
          <button data-action="save" data-id="${escapeHtml(ticket.ticket_id)}" class="bg-slate-600 text-white px-3 py-2 rounded-xl hover:bg-slate-700 hover:-translate-y-0.5 transition-all duration-200">บันทึกหมายเหตุ</button>
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
        const body = { repairNote: note };
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

// -----------------------------------------------------
// ส่วนสลับหน้า/section
// -----------------------------------------------------
function showTicketSections() {
  createTicketSection.classList.add('hidden');
  userManagementSection.classList.add('hidden');
  manageTicketsSection.classList.remove('hidden');
  ticketFiltersSection.classList.remove('hidden');
  ticketTableSection.classList.remove('hidden');
}

viewTicketsButton.addEventListener('click', () => {
  showTicketSections();
});

createTicketButton.addEventListener('click', () => {
  manageTicketsSection.classList.add('hidden');
  ticketFiltersSection.classList.add('hidden');
  ticketTableSection.classList.add('hidden');
  userManagementSection.classList.add('hidden');
  createTicketSection.classList.remove('hidden');
  setDefaultCreateDateTimes();
  loadDepartmentsForCreate();
});

cancelCreateButton.addEventListener('click', () => {
  adminCreateTicketForm.reset();
  createTicketSection.classList.add('hidden');
  showTicketSections();
});

function resetManagedUserForm() {
  userManagementForm.reset();
  managedUserId.value = '';
  managedPassword.required = true;
  managedPasswordRequiredLabel.textContent = '(อย่างน้อย 8 ตัวอักษร) *';
  managedPasswordHelp.textContent = 'กำหนดรหัสผ่านเริ่มต้นอย่างน้อย 8 ตัวอักษร';
  saveManagedUserButton.textContent = 'เพิ่มผู้ใช้';
  cancelManagedUserEditButton.classList.add('hidden');
  userManagementMessage.textContent = '';
  userManagementMessage.className = 'text-sm md:col-span-2';
}

async function loadManagedUsers() {
  const auth = requireLogin();
  if (!auth) return;

  userManagementMessage.textContent = 'กำลังโหลดรายชื่อผู้ใช้...';
  userManagementMessage.className = 'text-sm text-slate-500 md:col-span-2';
  try {
    const response = await fetch('/api/admin/users', {
      credentials: 'same-origin'
    });
    const users = await response.json();
    if (!response.ok) throw new Error(users.error || 'ไม่สามารถดึงรายชื่อผู้ใช้ได้');

    managedUsersTableBody.replaceChildren();
    if (users.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.className = 'px-4 py-6 text-center text-sm text-slate-500';
      cell.textContent = 'ยังไม่มีบัญชีผู้ใช้';
      row.appendChild(cell);
      managedUsersTableBody.appendChild(row);
    } else {
      users.forEach((user) => {
        const row = document.createElement('tr');
        [user.username, user.full_name, user.department || '—'].forEach((value) => {
          const cell = document.createElement('td');
          cell.className = 'px-4 py-3 text-sm text-slate-800';
          cell.textContent = value;
          row.appendChild(cell);
        });
        const actionCell = document.createElement('td');
        actionCell.className = 'px-4 py-3 text-sm';
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.dataset.action = 'edit-user';
        editButton.dataset.userId = String(user.user_id);
        editButton.className = 'rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700';
        editButton.textContent = 'แก้ไข / ตั้งรหัสใหม่';
        actionCell.appendChild(editButton);
        row.appendChild(actionCell);
        managedUsersTableBody.appendChild(row);
      });
    }
    userManagementMessage.textContent = '';
    return true;
  } catch (error) {
    userManagementMessage.textContent = error.message;
    userManagementMessage.className = 'text-sm text-red-600 md:col-span-2';
    return false;
  }
}

manageUsersButton.addEventListener('click', async () => {
  if (!requireLogin()) return;
  createTicketSection.classList.add('hidden');
  manageTicketsSection.classList.add('hidden');
  ticketFiltersSection.classList.add('hidden');
  ticketTableSection.classList.add('hidden');
  userManagementSection.classList.remove('hidden');
  resetManagedUserForm();
  await loadManagedUsers();
});

managedUsersTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="edit-user"]');
  if (!button) return;
  const selectedUser = Array.from(managedUsersTableBody.rows)
    .find((row) => row.querySelector('[data-action="edit-user"]') === button);
  if (!selectedUser) return;

  managedUserId.value = button.dataset.userId;
  managedUsername.value = selectedUser.cells[0].textContent;
  managedFullName.value = selectedUser.cells[1].textContent;
  managedDepartment.value = selectedUser.cells[2].textContent === '—' ? '' : selectedUser.cells[2].textContent;
  managedPassword.value = '';
  managedPassword.required = false;
  managedPasswordRequiredLabel.textContent = '(เว้นว่างเพื่อคงรหัสผ่านเดิม)';
  managedPasswordHelp.textContent = 'กรอกรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษรเมื่อต้องการรีเซ็ต';
  saveManagedUserButton.textContent = 'บันทึกการแก้ไข';
  cancelManagedUserEditButton.classList.remove('hidden');
  userManagementMessage.textContent = '';
  managedUsername.focus();
});

cancelManagedUserEditButton.addEventListener('click', resetManagedUserForm);

userManagementForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const auth = requireLogin();
  if (!auth) return;

  const isEditing = Boolean(managedUserId.value);
  const payload = {
    username: managedUsername.value.trim(),
    fullName: managedFullName.value.trim(),
    department: managedDepartment.value.trim()
  };
  if (managedPassword.value) payload.password = managedPassword.value;

  saveManagedUserButton.disabled = true;
  userManagementMessage.textContent = 'กำลังบันทึก...';
  userManagementMessage.className = 'text-sm text-slate-500 md:col-span-2';
  try {
    const response = await fetch(
      isEditing ? `/api/admin/users/${encodeURIComponent(managedUserId.value)}` : '/api/admin/users',
      {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถบันทึกผู้ใช้งานได้');

    resetManagedUserForm();
    if (await loadManagedUsers()) {
      userManagementMessage.textContent = result.message;
      userManagementMessage.className = 'text-sm text-green-700 md:col-span-2';
    }
  } catch (error) {
    userManagementMessage.textContent = error.message;
    userManagementMessage.className = 'text-sm text-red-600 md:col-span-2';
  } finally {
    saveManagedUserButton.disabled = false;
  }
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
    const options = [new Option('-- เลือกอุปกรณ์ --', '')];
    equipments.forEach((equipment) => {
      options.push(new Option(`${equipment.equipment_code} (${equipment.equipment_type})`, equipment.equipment_code));
    });
    creatorEquipment.replaceChildren(...options);
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
    completedDate: completedDate.value || null
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
        repairNote: payload.repairNote
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

logoutButton.addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem('helpdeskAuth');
    window.location.href = '/';
  }
});

// -----------------------------------------------------
// ส่วนเริ่มต้นหน้า
// -----------------------------------------------------
requireLogin();
loadTickets();
loadNotifications();
window.setInterval(loadNotifications, 5000);
