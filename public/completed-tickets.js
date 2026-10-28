const list = document.getElementById('completedList');
const searchInput = document.getElementById('searchInput');
const resultCount = document.getElementById('resultCount');
const themeToggle = document.getElementById('themeToggle');
let tickets = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function authOrRedirect() {
  const auth = JSON.parse(localStorage.getItem('helpdeskAuth') || 'null');
  if (!auth || auth.role !== 'admin') {
    window.location.href = '/';
    return null;
  }
  return auth;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('th-TH') : '—';
}

function render() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = tickets.filter((ticket) => !term || [
    ticket.ticket_id, ticket.equipment_code, ticket.equipment_type,
    ticket.department, ticket.room, ticket.issue_detail, ticket.repair_note
  ].some((value) => String(value || '').toLowerCase().includes(term)));

  resultCount.textContent = `${filtered.length} รายการ`;
  list.innerHTML = filtered.length ? filtered.map((ticket) => `
    <article class="ticket rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold">Ticket #${escapeHtml(ticket.ticket_id)} • ${escapeHtml(ticket.equipment_code)}</h2>
          <p class="ticket-text mt-1 text-sm text-slate-600">${escapeHtml(ticket.equipment_type || 'ไม่ระบุประเภท')} • ${escapeHtml(ticket.department || 'ไม่ระบุแผนก')} • ${escapeHtml(ticket.room || 'ไม่ระบุห้อง')}</p>
        </div>
        <span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">เสร็จสิ้น</span>
      </div>
      <p class="ticket-text mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">${escapeHtml(ticket.issue_detail || 'ไม่มีรายละเอียด')}</p>
      <div class="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
        <div>ผู้แจ้ง: ${escapeHtml(ticket.reporter_name || ticket.user_name || 'ไม่ระบุ')}</div>
        <div>แจ้งเมื่อ: ${escapeHtml(formatDate(ticket.reported_at || ticket.created_at))}</div>
        <div class="md:col-span-2">หมายเหตุการซ่อม: ${escapeHtml(ticket.repair_note || 'ไม่มีหมายเหตุ')}</div>
      </div>
    </article>
  `).join('') : '<p class="muted py-8 text-center text-slate-500">ไม่พบงานที่เสร็จแล้ว</p>';
}

async function loadCompletedTickets() {
  if (!authOrRedirect()) return;
  try {
    const response = await fetch('/api/tickets?completedOnly=1');
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
loadCompletedTickets();
