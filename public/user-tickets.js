// =====================================================
// ส่วน Logic หน้าแสดงสถานะ Ticket ของ User
// - เปิด/ปิดโหมด Dark Mode
// - ตรวจสอบสิทธิ์ผู้ใช้
// - ดึงข้อมูล ticket และกรองผลลัพธ์
// =====================================================
const ticketStatusList = document.getElementById('ticketStatusList');
const logoutButton = document.getElementById('logoutButton');
const themeToggleButton = document.getElementById('themeToggleButton');
const filterStatus = document.getElementById('filterStatus');
const filterCategory = document.getElementById('filterCategory');
const filterFromDate = document.getElementById('filterFromDate');
const filterToDate = document.getElementById('filterToDate');
const applyFiltersButton = document.getElementById('applyFiltersButton');
const resetFiltersButton = document.getElementById('resetFiltersButton');

// -----------------------------------------------------
// ส่วนตั้งค่า Theme
// -----------------------------------------------------
function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  themeToggleButton.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('helpdeskTheme', theme);

  // Toggle flatpickr dark theme stylesheet if present
  const fpThemeLink = document.getElementById('flatpickrDarkTheme');
  if (fpThemeLink) fpThemeLink.disabled = !isDark;
}

const savedTheme = localStorage.getItem('helpdeskTheme') || 'light';
applyTheme(savedTheme);

// initialize flatpickr datepickers (if flatpickr loaded)
function initDatePickers() {
  if (typeof flatpickr === 'undefined') return;

  // Use Thai locale if available (loaded via l10n script)
  const opts = {
    dateFormat: 'Y-m-d', // value returned (ISO) keeps Gregorian year for backend
    altInput: true,
    altFormat: 'j F Y', // will be overridden to display Buddhist year in onReady/onChange
    allowInput: true,
    locale: (flatpickr && flatpickr.l10ns && flatpickr.l10ns.th) ? 'th' : 'default',
    wrap: false,
    onReady: function(selectedDates, dateStr, instance) {
      // if there's already a value, update altInput to show Buddhist year
      if (selectedDates && selectedDates.length) {
        const d = selectedDates[0];
        const monthName = instance.l10n.months.longhand[d.getMonth()];
        const day = d.getDate();
        const buddhistYear = d.getFullYear() + 543;
        if (instance.altInput) instance.altInput.value = `${day} ${monthName} ${buddhistYear}`;
      } else if (instance.altInput) {
        instance.altInput.value = '';
      }
    },
    onChange: function(selectedDates, dateStr, instance) {
      if (selectedDates && selectedDates.length) {
        const d = selectedDates[0];
        const monthName = instance.l10n.months.longhand[d.getMonth()];
        const day = d.getDate();
        const buddhistYear = d.getFullYear() + 543;
        if (instance.altInput) instance.altInput.value = `${day} ${monthName} ${buddhistYear}`;
      } else if (instance.altInput) {
        instance.altInput.value = '';
      }
    }
  };

  if (filterFromDate) flatpickr(filterFromDate, opts);
  if (filterToDate) flatpickr(filterToDate, opts);
}
initDatePickers();

themeToggleButton.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  applyTheme(nextTheme);
});

// -----------------------------------------------------
// ส่วนตรวจสอบสิทธิ์ผู้ใช้
// -----------------------------------------------------
function requireLogin() {
  const auth = JSON.parse(localStorage.getItem('helpdeskAuth') || 'null');
  if (!auth || auth.role !== 'user') {
    window.location.href = '/';
    return null;
  }
  return auth;
}

// -----------------------------------------------------
// ส่วนโหลดรายการ ticket ของผู้ใช้พร้อมการกรอง
// -----------------------------------------------------
async function loadMyTickets() {
  const auth = requireLogin();
  if (!auth) return;

  const query = new URLSearchParams({ userId: auth.userId });
  if (filterStatus.value) query.set('status', filterStatus.value);
  if (filterCategory.value) query.set('category', filterCategory.value);
  if (filterFromDate.value) query.set('createdFrom', filterFromDate.value);
  if (filterToDate.value) query.set('createdTo', filterToDate.value);

  try {
    const response = await fetch(`/api/tickets?${query.toString()}`);
    const tickets = await response.json();

    if (!tickets.length) {
      ticketStatusList.innerHTML = '<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-center text-slate-500">ยังไม่มี Ticket ในระบบ</div>';
      return;
    }

    ticketStatusList.innerHTML = tickets.map(ticket => {
      const statusColor = {
        pending: 'bg-amber-100 text-amber-700',
        in_progress: 'bg-blue-100 text-blue-700',
        completed: 'bg-emerald-100 text-emerald-700'
      }[ticket.status] || 'bg-slate-100 text-slate-700';

      return `
        <div class="ticket-card border border-slate-200 rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5">
          <div class="flex justify-between items-center gap-3 flex-wrap">
            <div>
              <p class="font-semibold text-slate-900">Ticket #${ticket.ticket_id}</p>
              <p class="text-sm text-slate-500">${ticket.equipment_code}</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColor}">${ticket.status.replace('_', ' ')}</span>
          </div>
          <p class="mt-3 text-sm text-slate-700 leading-6">${ticket.issue_detail}</p>
          ${ticket.repair_note ? `
            <div class="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <p class="text-xs font-semibold text-emerald-700">หมายเหตุซ่อม</p>
              <p class="mt-1 text-sm text-slate-700">${ticket.repair_note}</p>
            </div>
          ` : ''}
          <p class="mt-3 text-xs text-slate-500">ประเภท: ${ticket.ticket_category === 'software' ? 'Software' : 'Hardware'}</p>
          <p class="mt-2 text-xs text-slate-500">อัปเดตล่าสุด: ${new Date(ticket.updated_at).toLocaleString('th-TH')}</p>
        </div>
      `;
    }).join('');
  } catch (error) {
    ticketStatusList.innerHTML = '<p class="text-red-500">ไม่สามารถโหลดสถานะ Ticket ได้</p>';
  }
}

logoutButton.addEventListener('click', () => {
  localStorage.removeItem('helpdeskAuth');
  window.location.href = '/';
});

// -----------------------------------------------------
// ส่วนปุ่มการกรอง
// -----------------------------------------------------
applyFiltersButton.addEventListener('click', () => {
  loadMyTickets();
});

resetFiltersButton.addEventListener('click', () => {
  filterStatus.value = '';
  filterCategory.value = '';
  filterFromDate.value = '';
  filterToDate.value = '';
  loadMyTickets();
});

// -----------------------------------------------------
// ส่วนเริ่มต้นหน้า
// -----------------------------------------------------
loadMyTickets();
