const list = document.getElementById('workingList');
const searchInput = document.getElementById('searchInput');
const resultCount = document.getElementById('resultCount');
const themeToggle = document.getElementById('themeToggle');
let tickets = [];
let admin = null;

const priorityLabels = {
  critical: { label: 'ด่วนมาก', color: 'bg-red-100 text-red-800' },
  high: { label: 'ด่วน', color: 'bg-orange-100 text-orange-800' },
  medium: { label: 'ปานกลาง', color: 'bg-yellow-100 text-yellow-800' },
  low: { label: 'ทั่วไป', color: 'bg-emerald-100 text-emerald-800' }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function requireAdmin() {
  admin = JSON.parse(localStorage.getItem('helpdeskAuth') || 'null');
  if (!admin || admin.role !== 'admin') {
    window.location.href = '/';
    return false;
  }
  return true;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('th-TH') : '—';
}

function formatDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function render() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = tickets.filter((ticket) => !term || [
    ticket.ticket_id, ticket.equipment_code, ticket.equipment_type, ticket.department,
    ticket.room, ticket.issue_detail, ticket.reporter_name, ticket.repair_note
  ].some((value) => String(value || '').toLowerCase().includes(term)));

  resultCount.textContent = `${filtered.length} รายการ`;
  list.innerHTML = filtered.length ? filtered.map((ticket) => {
    const priority = priorityLabels[ticket.urgency] || priorityLabels.medium;
    return `
      <article class="ticket rounded-2xl border border-slate-200 bg-slate-50 p-4 ${ticket.urgency === 'critical' ? 'border-l-4 border-l-red-500' : ticket.urgency === 'high' ? 'border-l-4 border-l-orange-500' : ''}">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">Ticket #${escapeHtml(ticket.ticket_id)} • ${escapeHtml(ticket.equipment_code)}</h2>
            <p class="ticket-text mt-1 text-sm text-slate-600">${escapeHtml(ticket.equipment_type || 'ไม่ระบุประเภท')} • ${escapeHtml(ticket.department || 'ไม่ระบุแผนก')} • ${escapeHtml(ticket.room || 'ไม่ระบุห้อง')}</p>
          </div>
          <div class="flex gap-2">
            <span class="rounded-full px-3 py-1 text-xs font-semibold ${priority.color}">${priority.label}</span>
            <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">กำลังดำเนินการ</span>
          </div>
        </div>
        <p class="ticket-text mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">${escapeHtml(ticket.issue_detail || 'ไม่มีรายละเอียด')}</p>
        <div class="mt-2 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
          <div>ผู้แจ้ง: ${escapeHtml(ticket.reporter_name || ticket.user_name || 'ไม่ระบุ')}</div>
          <div>แจ้งเมื่อ: ${formatDate(ticket.reported_at || ticket.created_at)}</div>
        </div>
        <label for="note-${escapeHtml(ticket.ticket_id)}" class="muted mt-4 block text-sm font-medium text-slate-600">หมายเหตุการซ่อม</label>
        <textarea id="note-${escapeHtml(ticket.ticket_id)}" rows="3" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">${escapeHtml(ticket.repair_note || '')}</textarea>
        <label for="completed-at-${escapeHtml(ticket.ticket_id)}" class="muted mt-3 block text-sm font-medium text-slate-600">วันและเวลาเสร็จงาน <span class="font-normal">(ไม่เลือกจะใช้เวลาปัจจุบัน)</span></label>
        <input id="completed-at-${escapeHtml(ticket.ticket_id)}" type="datetime-local" value="${escapeHtml(formatDateTimeLocal(ticket.completed_at))}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-sm" />
        <div class="mt-3 flex flex-wrap justify-end gap-2">
          <button data-action="save" data-id="${escapeHtml(ticket.ticket_id)}" class="rounded-xl bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">บันทึกหมายเหตุ</button>
          <button data-action="complete" data-id="${escapeHtml(ticket.ticket_id)}" class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">ปิดงาน / เสร็จแล้ว</button>
        </div>
      </article>
    `;
  }).join('') : '<p class="muted py-8 text-center text-slate-500">ไม่มี Ticket ที่กำลังดำเนินการ</p>';

  list.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', () => updateTicket(button));
  });
}

async function updateTicket(button) {
  const ticketId = button.dataset.id;
  const action = button.dataset.action;
  const repairNote = document.getElementById(`note-${ticketId}`).value;
  const body = { repairNote };
  if (action === 'complete') {
    if (!window.confirm(`ปิด Ticket #${ticketId} และย้ายไปหน้างานที่เสร็จแล้วหรือไม่?`)) return;
    body.status = 'completed';
    const completedAt = document.getElementById(`completed-at-${ticketId}`).value;
    body.completedAt = completedAt ? new Date(completedAt).toISOString() : null;
  }

  button.disabled = true;
  try {
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถอัปเดต Ticket ได้');
    await loadTickets();
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
  }
}

async function loadTickets() {
  if (!requireAdmin()) return;
  try {
    const response = await fetch('/api/tickets?workingOnly=1');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'โหลดรายการไม่สำเร็จ');
    tickets = result;
    render();
  } catch (error) {
    list.innerHTML = `<p class="py-8 text-center text-red-500">${escapeHtml(error.message)}</p>`;
  }
}

function applyTheme(theme) {
  document.body.classList.toggle('dark-mode', theme === 'dark');
  themeToggle.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('helpdeskTheme', theme);
}

themeToggle.addEventListener('click', () => applyTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark'));
searchInput.addEventListener('input', render);
document.getElementById('logoutButton').addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem('helpdeskAuth');
    window.location.href = '/';
  }
});
applyTheme(localStorage.getItem('helpdeskTheme') || 'light');
loadTickets();
