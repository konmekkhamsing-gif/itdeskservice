// =====================================================
// ส่วน Logic หน้า Login
// - เปิด/ปิดโหมด Dark Mode
// - ส่งข้อมูลเข้าสู่ระบบและ redirect ตาม role
// =====================================================
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const themeToggleButton = document.getElementById('themeToggleButton');

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
// ส่วน Workflow การเข้าสู่ระบบ
// - ส่งข้อมูล username/password ไปยัง API
// - เก็บข้อมูล auth ลง localStorage
// - Redirect ไปยังหน้า User หรือ Admin ตาม role
// -----------------------------------------------------
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());

  loginMessage.textContent = 'กำลังเข้าสู่ระบบ...';
  loginMessage.className = 'mt-4 text-sm text-slate-600';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'ไม่สามารถเข้าสู่ระบบได้');
    }

    localStorage.setItem('helpdeskAuth', JSON.stringify({
      userId: result.userId,
      username: result.username,
      role: result.role,
      fullName: result.fullName,
      department: result.department || null
    }));

    loginMessage.textContent = result.message;
    loginMessage.className = 'mt-4 text-sm text-green-600';
    window.location.href = result.role === 'admin' ? '/admin-dashboard.html' : '/user.html';
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.className = 'mt-4 text-sm text-red-600';
  }
});
