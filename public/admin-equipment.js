const equipmentForm = document.getElementById('equipmentForm');
const equipmentCodeInput = document.getElementById('equipmentCode');
const equipmentTypeInput = document.getElementById('equipmentType');
const equipmentDepartmentSelect = document.getElementById('equipmentDepartment');
const equipmentRoomInput = document.getElementById('equipmentRoom');
const equipmentStatusSelect = document.getElementById('equipmentStatus');
const equipmentTableBody = document.getElementById('equipmentTableBody');
const equipmentCount = document.getElementById('equipmentCount');
const equipmentSearch = document.getElementById('equipmentSearch');
const statusFilter = document.getElementById('statusFilter');
const equipmentMessage = document.getElementById('equipmentMessage');
const formTitle = document.getElementById('formTitle');
const saveEquipmentButton = document.getElementById('saveEquipmentButton');
const cancelEquipmentEditButton = document.getElementById('cancelEquipmentEditButton');
const reloadEquipmentButton = document.getElementById('reloadEquipmentButton');
const logoutButton = document.getElementById('logoutButton');
const themeToggleButton = document.getElementById('themeToggleButton');
const equipmentManager = document.getElementById('equipmentManager');

const departments = [
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

const auth = JSON.parse(localStorage.getItem('helpdeskAuth') || 'null');
let editingEquipmentId = null;
let equipmentRecords = [];

function showMessage(message, type = 'error') {
  equipmentMessage.textContent = message;
  equipmentMessage.className = `text-sm md:col-span-2 xl:col-span-3 ${type === 'success' ? 'text-green-700' : 'text-red-600'}`;
}

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  themeToggleButton.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('helpdeskTheme', theme);
}

setTheme(localStorage.getItem('helpdeskTheme') || 'light');
themeToggleButton.addEventListener('click', () => {
  setTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark');
});

function populateDepartmentSelect() {
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- เลือกแผนก --';
  equipmentDepartmentSelect.replaceChildren(placeholder);
  departments.forEach((department) => {
    const option = document.createElement('option');
    option.value = department;
    option.textContent = department;
    equipmentDepartmentSelect.appendChild(option);
  });
}

function getApiUrl(path) {
  return path;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (response.status === 404) {
      throw new Error('ไม่พบ API จัดการอุปกรณ์บนเซิร์ฟเวอร์ กรุณาหยุดแล้วเปิดเซิร์ฟเวอร์ใหม่ด้วย npm start');
    }
    throw new Error('เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่ถูกต้อง กรุณาตรวจสอบเซิร์ฟเวอร์แล้วลองใหม่');
  }
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'ไม่สามารถดำเนินการได้');
  }
  return result;
}

function resetForm() {
  equipmentForm.reset();
  editingEquipmentId = null;
  equipmentStatusSelect.value = 'active';
  formTitle.textContent = 'เพิ่มอุปกรณ์';
  saveEquipmentButton.textContent = 'เพิ่มอุปกรณ์';
  cancelEquipmentEditButton.classList.add('hidden');
  equipmentMessage.textContent = '';
}

function appendCell(row, value) {
  const cell = document.createElement('td');
  cell.className = 'px-4 py-3 text-sm text-slate-800';
  cell.textContent = value;
  row.appendChild(cell);
  return cell;
}

function createActionButton(label, action, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.className = `rounded-lg px-3 py-2 text-sm font-medium ${className}`;
  button.textContent = label;
  return button;
}

function renderEquipments() {
  const search = equipmentSearch.value.trim().toLocaleLowerCase();
  const selectedStatus = statusFilter.value;
  const visible = equipmentRecords.filter((equipment) => {
    const matchesSearch = [
      equipment.equipment_code,
      equipment.equipment_type,
      equipment.department,
      equipment.room
    ].some((value) => String(value || '').toLocaleLowerCase().includes(search));
    return matchesSearch && (!selectedStatus || equipment.status === selectedStatus);
  });

  equipmentTableBody.replaceChildren();
  equipmentCount.textContent = `แสดง ${visible.length} จาก ${equipmentRecords.length} รายการ`;
  if (!visible.length) {
    const row = document.createElement('tr');
    const cell = appendCell(row, 'ไม่พบอุปกรณ์');
    cell.colSpan = 7;
    cell.className += ' text-center text-slate-500';
    equipmentTableBody.appendChild(row);
    return;
  }

  visible.forEach((equipment) => {
    const row = document.createElement('tr');
    appendCell(row, equipment.equipment_code);
    appendCell(row, equipment.equipment_type);
    appendCell(row, equipment.department);
    appendCell(row, equipment.room);
    appendCell(row, String(equipment.ticket_count));
    const statusCell = appendCell(row, equipment.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน');
    statusCell.className += equipment.status === 'active' ? ' text-green-700' : ' text-slate-500';

    const actions = document.createElement('td');
    actions.className = 'flex flex-wrap gap-2 px-4 py-3';
    const editButton = createActionButton('แก้ไข', 'edit', 'bg-blue-600 text-white hover:bg-blue-700');
    editButton.dataset.equipmentId = String(equipment.equipment_id);
    actions.appendChild(editButton);

    if (equipment.status === 'active') {
      const deleteButton = createActionButton('ลบ/ปิดใช้งาน', 'deactivate', 'bg-rose-600 text-white hover:bg-rose-700');
      deleteButton.dataset.equipmentId = String(equipment.equipment_id);
      actions.appendChild(deleteButton);
    } else {
      const restoreButton = createActionButton('เปิดใช้งานอีกครั้ง', 'restore', 'bg-emerald-600 text-white hover:bg-emerald-700');
      restoreButton.dataset.equipmentId = String(equipment.equipment_id);
      actions.appendChild(restoreButton);
    }
    row.appendChild(actions);
    equipmentTableBody.appendChild(row);
  });
}

async function loadEquipments() {
  equipmentCount.textContent = 'กำลังโหลดรายการอุปกรณ์...';
  try {
    equipmentRecords = await apiRequest('/api/admin/equipments');
    equipmentManager.classList.remove('hidden');
    renderEquipments();
    return true;
  } catch (error) {
    equipmentCount.textContent = '';
    showMessage(error.message);
    return false;
  }
}

equipmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const wasEditing = Boolean(editingEquipmentId);
  const payload = {
    equipmentCode: equipmentCodeInput.value.trim(),
    equipmentType: equipmentTypeInput.value.trim(),
    department: equipmentDepartmentSelect.value,
    room: equipmentRoomInput.value.trim(),
    status: equipmentStatusSelect.value
  };
  saveEquipmentButton.disabled = true;
  try {
    await apiRequest(
      editingEquipmentId
        ? `/api/admin/equipments/${encodeURIComponent(editingEquipmentId)}`
        : '/api/admin/equipments',
      {
        method: editingEquipmentId ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      }
    );
    resetForm();
    showMessage(wasEditing ? 'บันทึกข้อมูลอุปกรณ์เรียบร้อยแล้ว' : 'เพิ่มอุปกรณ์เรียบร้อยแล้ว', 'success');
    await loadEquipments();
  } catch (error) {
    showMessage(error.message);
  } finally {
    saveEquipmentButton.disabled = false;
  }
});

equipmentTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const equipment = equipmentRecords.find((item) => String(item.equipment_id) === button.dataset.equipmentId);
  if (!equipment) return;

  if (button.dataset.action === 'edit') {
    editingEquipmentId = equipment.equipment_id;
    equipmentCodeInput.value = equipment.equipment_code;
    equipmentTypeInput.value = equipment.equipment_type;
    equipmentDepartmentSelect.value = equipment.department;
    equipmentRoomInput.value = equipment.room;
    equipmentStatusSelect.value = equipment.status;
    formTitle.textContent = `แก้ไขอุปกรณ์ ${equipment.equipment_code}`;
    saveEquipmentButton.textContent = 'บันทึกการแก้ไข';
    cancelEquipmentEditButton.classList.remove('hidden');
    equipmentMessage.textContent = '';
    equipmentCodeInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (button.dataset.action === 'deactivate') {
    if (!button.dataset.confirmed) {
      button.dataset.confirmed = 'true';
      button.textContent = 'ยืนยันปิดใช้งาน';
      button.className = 'rounded-lg bg-rose-800 px-3 py-2 text-sm font-medium text-white hover:bg-rose-900';
      const cancelButton = createActionButton('ยกเลิก', 'cancel-deactivate', 'border border-slate-300 text-slate-700 hover:bg-slate-50');
      cancelButton.dataset.equipmentId = String(equipment.equipment_id);
      button.after(cancelButton);
      const warning = document.createElement('span');
      warning.className = 'basis-full text-xs text-rose-700';
      warning.textContent = equipment.ticket_count
        ? `มี Ticket ${equipment.ticket_count} รายการ ระบบจะปิดใช้งานและเก็บประวัติไว้`
        : 'ระบบจะปิดใช้งานรายการนี้โดยไม่ลบข้อมูลถาวร';
      button.parentElement.appendChild(warning);
      return;
    }
    try {
      const result = await apiRequest(
        `/api/admin/equipments/${encodeURIComponent(equipment.equipment_id)}`,
        { method: 'DELETE' }
      );
      showMessage(result.message, 'success');
      await loadEquipments();
    } catch (error) {
      showMessage(error.message);
    }
    return;
  }

  if (button.dataset.action === 'cancel-deactivate') {
    renderEquipments();
    return;
  }

  if (button.dataset.action === 'restore') {
    try {
      await apiRequest(
        `/api/admin/equipments/${encodeURIComponent(equipment.equipment_id)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            equipmentCode: equipment.equipment_code,
            equipmentType: equipment.equipment_type,
            department: equipment.department,
            room: equipment.room,
            status: 'active'
          })
        }
      );
      showMessage('เปิดใช้งานอุปกรณ์อีกครั้งแล้ว', 'success');
      await loadEquipments();
    } catch (error) {
      showMessage(error.message);
    }
  }
});

cancelEquipmentEditButton.addEventListener('click', resetForm);
equipmentSearch.addEventListener('input', renderEquipments);
statusFilter.addEventListener('change', renderEquipments);
reloadEquipmentButton.addEventListener('click', loadEquipments);
logoutButton.addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem('helpdeskAuth');
    window.location.href = '/';
  }
});

if (!auth || auth.role !== 'admin') {
  window.location.href = '/';
} else {
  populateDepartmentSelect();
  loadEquipments();
}
