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
const aiChatToggle = document.getElementById('aiChatToggle');
const aiChatPanel = document.getElementById('aiChatPanel');
const aiChatClose = document.getElementById('aiChatClose');
const aiChatMessages = document.getElementById('aiChatMessages');
const aiChatForm = document.getElementById('aiChatForm');
const aiChatInput = document.getElementById('aiChatInput');
const aiChatSend = document.getElementById('aiChatSend');
const aiChatHistory = [];

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

function addChatMessage(text, role) {
  const message = document.createElement('div');
  message.className = role === 'user'
    ? 'max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-blue-600 px-3 py-2 text-sm text-white shadow-sm'
    : 'max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-700 shadow-sm';
  message.textContent = text;
  aiChatMessages.appendChild(message);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

aiChatToggle.addEventListener('click', () => {
  aiChatPanel.classList.remove('hidden');
  aiChatPanel.classList.remove('chat-closing');
  aiChatPanel.classList.add('chat-opening');
  aiChatToggle.classList.add('hidden');
  window.setTimeout(() => aiChatPanel.classList.remove('chat-opening'), 240);
  aiChatInput.focus();
});

aiChatClose.addEventListener('click', () => {
  aiChatPanel.classList.remove('chat-opening');
  aiChatPanel.classList.add('chat-closing');
  window.setTimeout(() => {
    aiChatPanel.classList.add('hidden');
    aiChatPanel.classList.remove('chat-closing');
    aiChatToggle.classList.remove('hidden');
  }, 190);
});

aiChatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = aiChatInput.value.trim();
  if (!question || aiChatSend.disabled) return;

  addChatMessage(question, 'user');
  aiChatHistory.push({ role: 'user', text: question });
  aiChatInput.value = '';
  aiChatSend.disabled = true;
  aiChatSend.textContent = '...';

  try {
    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history: aiChatHistory.slice(-10) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถติดต่อผู้ช่วย AI ได้');

    addChatMessage(result.answer, 'model');
    aiChatHistory.push({ role: 'model', text: result.answer });
  } catch (error) {
    addChatMessage(error.message, 'model');
  } finally {
    aiChatSend.disabled = false;
    aiChatSend.textContent = 'ส่ง';
    aiChatInput.focus();
  }
});

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
  try {
    const query = department ? `?department=${encodeURIComponent(department)}` : '';
    const response = await fetch(`/api/equipment-codes${query}`);
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

    equipmentHelp.textContent = department
      ? `เลือกอุปกรณ์จากแผนก ${department}`
      : 'เลือกอุปกรณ์ที่รองรับในระบบ';
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

logoutButton.addEventListener('click', () => {
  localStorage.removeItem('helpdeskAuth');
  window.location.href = '/';
});

// -----------------------------------------------------
// ส่วนเริ่มต้นหน้า
// -----------------------------------------------------
const auth = requireLogin();
if (auth) {
  loadSupportedCodes(auth.department);
}
