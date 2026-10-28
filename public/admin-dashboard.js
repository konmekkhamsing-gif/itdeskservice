// =====================================================
// ส่วน Logic หน้า Dashboard ของ Admin
// - เปิด/ปิดโหมด Dark Mode
// - ตรวจสอบสิทธิ์การเข้าถึง
// - โหลดสถิติ Dashboard
// - แสดงและล้าง Notification
// =====================================================
const totalTickets = document.getElementById('totalTickets');
const pendingTickets = document.getElementById('pendingTickets');
const inProgressTickets = document.getElementById('inProgressTickets');
const completedTickets = document.getElementById('completedTickets');
const categorySummary = document.getElementById('categorySummary');
const departmentAnalytics = document.getElementById('departmentAnalytics');
const equipmentAnalytics = document.getElementById('equipmentAnalytics');
const slaAnalytics = document.getElementById('slaAnalytics');
const statusChartCanvas = document.getElementById('statusChart');
const departmentChartCanvas = document.getElementById('departmentChart');
const categoryChartCanvas = document.getElementById('categoryChart');
const notificationBadge = document.getElementById('notificationBadge');
const notificationList = document.getElementById('notificationList');
const clearNotificationsButton = document.getElementById('clearNotificationsButton');
const logoutButton = document.getElementById('logoutButton');
const themeToggleButton = document.getElementById('themeToggleButton');
let statusChart;
let departmentChart;
let categoryChart;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

// -----------------------------------------------------
// ส่วนตั้งค่า Theme
// -----------------------------------------------------
function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  themeToggleButton.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('helpdeskTheme', theme);
  updateChartTheme();
}

const savedTheme = localStorage.getItem('helpdeskTheme') || 'light';
applyTheme(savedTheme);

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
// ส่วนสถิติ Dashboard
// - ดึงจำนวน ticket และข้อมูลสรุป analytics
// - แสดง KPI Cards และข้อมูลแผนก/อุปกรณ์
// -----------------------------------------------------
async function loadDashboardData() {
  const auth = requireLogin();
  if (!auth) return;

  const [ticketsResponse, analyticsResponse] = await Promise.all([
    fetch('/api/tickets'),
    fetch('/api/admin/analytics')
  ]);

  const tickets = await ticketsResponse.json();
  const analytics = await analyticsResponse.json();

  const pendingCount = tickets.filter(ticket => ticket.status === 'pending').length;
  const inProgressCount = tickets.filter(ticket => ticket.status === 'in_progress').length;
  const completedCount = tickets.filter(ticket => ticket.status === 'completed').length;

  totalTickets.textContent = String(tickets.length);
  pendingTickets.textContent = String(pendingCount);
  inProgressTickets.textContent = String(inProgressCount);
  completedTickets.textContent = String(completedCount);

  const categoryCounts = (analytics.byCategory || []).reduce((acc, item) => {
    acc[item.category || 'hardware'] = Number(item.ticket_count || 0);
    return acc;
  }, { hardware: 0, software: 0 });
  categorySummary.innerHTML = `
    <div>Hardware: ${categoryCounts.hardware}</div>
    <div>Software: ${categoryCounts.software}</div>
  `;

  departmentAnalytics.innerHTML = analytics.byDepartment.length
    ? analytics.byDepartment.map((item, index) => `
      <div class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
        <div>
          <div class="font-semibold text-slate-800">${index + 1}. ${escapeHtml(item.department || 'ไม่ระบุแผนก')}</div>
          <div class="text-xs text-slate-500">จำนวน ticket</div>
        </div>
        <div class="text-lg font-bold text-slate-800">${escapeHtml(item.ticket_count)}</div>
      </div>
    `).join('')
    : '<div class="text-sm text-slate-500">ไม่มีข้อมูล</div>';

  equipmentAnalytics.innerHTML = analytics.byEquipmentType.length
    ? analytics.byEquipmentType.map((item, index) => `
      <div class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
        <div>
          <div class="font-semibold text-slate-800">${index + 1}. ${escapeHtml(item.equipment_type || 'ไม่ระบุชนิด')}</div>
          <div class="text-xs text-slate-500">จำนวน ticket</div>
        </div>
        <div class="text-lg font-bold text-slate-800">${escapeHtml(item.ticket_count)}</div>
      </div>
    `).join('')
    : '<div class="text-sm text-slate-500">ไม่มีข้อมูล</div>';

  slaAnalytics.textContent = Number(analytics.averageSlaHours || 0).toFixed(2);
  renderCharts({
    statusCounts: [pendingCount, inProgressCount, completedCount],
    departments: analytics.byDepartment || [],
    categoryCounts
  });
}

function renderCharts({ statusCounts, departments, categoryCounts }) {
  if (typeof Chart === 'undefined') return;

  const chartTheme = getChartTheme();
  const statusData = {
    labels: ['รอรับงาน', 'กำลังซ่อม', 'เสร็จสิ้น'],
    datasets: [{
      data: statusCounts,
      backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
      borderColor: chartTheme.surfaceColor,
      borderWidth: 3
    }]
  };
  const departmentData = {
    labels: departments.map(item => item.department || 'ไม่ระบุแผนก'),
    datasets: [{
      label: 'จำนวน Ticket',
      data: departments.map(item => Number(item.ticket_count || 0)),
      backgroundColor: '#0d9488',
      borderRadius: 8,
      maxBarThickness: 42
    }]
  };
  const categoryData = {
    labels: ['Hardware', 'Software'],
    datasets: [{
      label: 'จำนวน Ticket',
      data: [categoryCounts.hardware, categoryCounts.software],
      backgroundColor: ['#8b5cf6', '#ec4899'],
      borderRadius: 8,
      maxBarThickness: 56
    }]
  };

  if (!statusChart) {
    statusChart = new Chart(statusChartCanvas, {
      type: 'doughnut',
      data: statusData,
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: chartTheme.textColor, padding: 18 } }
        }
      }
    });
  } else {
    statusChart.data = statusData;
    statusChart.options.plugins.legend.labels.color = chartTheme.textColor;
    statusChart.data.datasets[0].borderColor = chartTheme.surfaceColor;
    statusChart.update();
  }

  if (!departmentChart) {
    departmentChart = new Chart(departmentChartCanvas, {
      type: 'bar',
      data: departmentData,
      options: {
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: chartTheme.textColor }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: chartTheme.textColor, precision: 0 }, grid: { color: chartTheme.gridColor } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: context => ` ${context.parsed.y} Ticket` } }
        }
      }
    });
  } else {
    departmentChart.data = departmentData;
    departmentChart.update();
  }

  if (!categoryChart) {
    categoryChart = new Chart(categoryChartCanvas, {
      type: 'bar',
      data: categoryData,
      options: {
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: chartTheme.textColor }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: chartTheme.textColor, precision: 0 }, grid: { color: chartTheme.gridColor } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: context => ` ${context.parsed.y} Ticket` } }
        }
      }
    });
  } else {
    categoryChart.data = categoryData;
    categoryChart.update();
  }
}

function getChartTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  return {
    textColor: isDark ? '#f8fafc' : '#334155',
    gridColor: isDark ? 'rgba(148, 163, 184, 0.32)' : 'rgba(100, 116, 139, 0.2)',
    surfaceColor: isDark ? '#0f172a' : '#ffffff'
  };
}

function updateChartTheme() {
  const chartTheme = getChartTheme();
  if (statusChart) {
    statusChart.data.datasets[0].borderColor = chartTheme.surfaceColor;
    statusChart.options.plugins.legend.labels.color = chartTheme.textColor;
    statusChart.update();
  }
  [departmentChart, categoryChart].forEach(chart => {
    if (!chart) return;
    chart.options.scales.x.ticks.color = chartTheme.textColor;
    chart.options.scales.y.ticks.color = chartTheme.textColor;
    chart.options.scales.y.grid.color = chartTheme.gridColor;
    chart.update();
  });
}

clearNotificationsButton.addEventListener('click', async () => {
  const auth = requireLogin();
  if (!auth) return;

  await fetch('/api/admin/notifications', { method: 'DELETE' });
  await loadNotifications();
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
loadDashboardData();
loadNotifications();
window.setInterval(() => {
  loadDashboardData();
  loadNotifications();
}, 300000);
