function normalizeEquipmentInput(body, departments) {
  const equipmentCode = typeof body.equipmentCode === 'string' ? body.equipmentCode.trim().toUpperCase() : '';
  const equipmentType = typeof body.equipmentType === 'string' ? body.equipmentType.trim() : '';
  const department = typeof body.department === 'string' ? body.department.trim() : '';
  const room = typeof body.room === 'string' ? body.room.trim() : '';
  const status = typeof body.status === 'string' ? body.status : 'active';
  const codeParts = equipmentCode.match(/^([A-Z0-9]+)-(.+)-([0-9]+)$/u);

  if (equipmentCode.length > 50 || !codeParts) {
    return { error: 'รหัสอุปกรณ์ต้องอยู่ในรูปแบบ PREFIX-ชื่อแผนก-ลำดับ เช่น VENT-งานอุบัติเหตุฉุกเฉิน-08 และยาวไม่เกิน 50 ตัว' };
  }
  if (!equipmentType || equipmentType.length > 50) {
    return { error: 'กรุณาระบุประเภทอุปกรณ์ ไม่เกิน 50 ตัวอักษร' };
  }
  if (!departments.includes(department)) {
    return { error: 'กรุณาเลือกแผนกจากรายการที่กำหนด' };
  }
  if (codeParts[2] !== department) {
    return { error: 'ชื่อแผนกในรหัสอุปกรณ์ต้องตรงกับแผนกที่เลือก' };
  }
  if (!room || room.length > 100) {
    return { error: 'กรุณาระบุห้อง/สถานที่ ไม่เกิน 100 ตัวอักษร' };
  }
  if (!['active', 'inactive'].includes(status)) {
    return { error: 'สถานะอุปกรณ์ไม่ถูกต้อง' };
  }

  return { equipmentCode, equipmentType, department, room, status };
}

module.exports = { normalizeEquipmentInput };
