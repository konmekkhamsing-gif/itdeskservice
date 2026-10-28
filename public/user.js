// =====================================================
// ส่วน Logic หน้าแจ้งซ่อมของ User
// - เปิด/ปิดโหมด Dark Mode
// - ดึงรหัสอุปกรณ์ที่สามารถใช้งานได้
// - ส่ง ticket และตรวจสอบข้อมูลที่จำเป็น
// =====================================================
const ticketForm = document.getElementById('ticketForm');
const ticketMessage = document.getElementById('ticketMessage');
const logoutButton = document.getElementById('logoutButton');
const themeToggleButton = document.getElementById('themeToggleButton');
const userIdInput = document.getElementById('userIdInput');
const equipmentCodeSelect = document.getElementById('equipmentCode');
const equipmentHelp = document.getElementById('equipmentHelp');
const ticketCategorySelect = document.getElementById('ticketCategory');
const reporterUsernameInput = document.getElementById('reporterUsername');
const reporterUsernameDisplay = document.getElementById('reporterUsernameDisplay');

// -----------------------------------------------------
// ส่วนตั้งค่า Theme
// -----------------------------------------------------
function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  themeToggleButton.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('helpdeskTheme', theme);
}

const savedTheme = localStorage.getItem('helpdeskTheme') || 'light';
applyTheme(savedTheme);

themeToggleButton.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  applyTheme(nextTheme);
});

// -----------------------------------------------------
// ส่วนโหลดรายการอุปกรณ์
// - ดึงรหัสอุปกรณ์ที่ตรงกับแผนกของผู้ใช้งาน
// - เติมข้อมูลลงใน dropdown สำหรับการแจ้งซ่อม
// -----------------------------------------------------
async function loadSupportedCodes(department) {
  if (!department) {
    equipmentCodeSelect.innerHTML = '<option value="" disabled selected>บัญชียังไม่ได้ระบุแผนก</option>';
    equipmentHelp.textContent = 'กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดแผนกให้บัญชีของคุณ';
    equipmentCodeSelect.disabled = true;
    return;
  }

  try {
    const response = await fetch(`/api/equipment-codes?department=${encodeURIComponent(department)}`);
    const equipmentList = await response.json();
    equipmentCodeSelect.innerHTML = '';

    if (!equipmentList.length) {
      equipmentCodeSelect.innerHTML = '<option value="" disabled>ไม่มีอุปกรณ์ในแผนกนี้</option>';
      equipmentHelp.textContent = 'ไม่พบรายการอุปกรณ์สำหรับแผนกของคุณ';
      equipmentCodeSelect.disabled = true;
      return;
    }

    equipmentList.forEach((item, index) => {
      const option = document.createElement('option');
      option.value = item.equipment_code;
      option.textContent = `${item.equipment_code} (${item.room})`;
      if (index === 0) option.selected = true;
      equipmentCodeSelect.appendChild(option);
    });

    equipmentHelp.textContent = `เลือกอุปกรณ์จากแผนก ${department}`;
    equipmentCodeSelect.disabled = false;
  } catch (error) {
    equipmentCodeSelect.innerHTML = '<option value="" disabled>ไม่สามารถโหลดข้อมูลได้</option>';
    equipmentHelp.textContent = 'ไม่สามารถโหลดข้อมูลอุปกรณ์ได้';
    equipmentCodeSelect.disabled = true;
  }
}

// -----------------------------------------------------
// ส่วนตรวจสอบสิทธิ์ผู้ใช้
// - ตรวจสอบว่าผู้ใช้เข้าสู่ระบบก่อนสร้าง ticket
// - เติมค่า hidden field จากข้อมูล auth ที่บันทึกไว้
// -----------------------------------------------------
function requireLogin() {
  const auth = JSON.parse(localStorage.getItem('helpdeskAuth') || 'null');
  if (!auth || auth.role !== 'user') {
    window.location.href = '/';
    return null;
  }

  userIdInput.value = auth.userId;
  if (reporterUsernameInput && auth.username) reporterUsernameInput.value = auth.username;
  if (reporterUsernameDisplay && auth.username) reporterUsernameDisplay.textContent = auth.username;

  return auth;
}

// -----------------------------------------------------
// ส่วนส่งฟอร์ม ticket
// - ตรวจสอบข้อมูลที่จำเป็น
// - ส่ง request ไปยัง API เพื่อสร้าง ticket ใหม่
// -----------------------------------------------------
ticketForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const auth = requireLogin();
  if (!auth) return;

  const equipmentCode = equipmentCodeSelect.value.trim();
  const issueDetail = document.getElementById('issueDetail').value.trim();
  const ticketCategory = ticketCategorySelect.value;
  const userId = userIdInput.value;
  const reporterName = document.getElementById('reporterName').value.trim();
  const reporterUsername = reporterUsernameInput.value.trim();

  if (!equipmentCode || !issueDetail || !ticketCategory || !reporterName) {
    ticketMessage.textContent = 'กรุณากรอกข้อมูลให้ครบ โดยเฉพาะชื่อผู้แจ้ง (ชื่อจริง)';
    ticketMessage.className = 'mt-4 text-sm text-red-600';
    return;
  }

  ticketMessage.textContent = 'กำลังส่ง Ticket...';
  ticketMessage.className = 'mt-4 text-sm text-slate-600';

  try {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentCode, issueDetail, ticketCategory, userId, reporterName, reporterUsername })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'ไม่สามารถส่ง Ticket ได้');
    }

    ticketMessage.textContent = result.message;
    ticketMessage.className = 'mt-4 text-sm text-green-600';
    ticketForm.reset();
    if (auth.username) {
      reporterUsernameInput.value = auth.username;
      if (reporterUsernameDisplay) reporterUsernameDisplay.textContent = auth.username;
    }
    ticketCategorySelect.value = 'hardware';
  } catch (error) {
    ticketMessage.textContent = error.message;
    ticketMessage.className = 'mt-4 text-sm text-red-600';
  }
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
const auth = requireLogin();
if (auth) {
  loadSupportedCodes(auth.department);
}
