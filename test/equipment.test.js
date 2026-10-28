const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeEquipmentInput } = require('../lib/equipment');

const departments = ['งานอุบัติเหตุฉุกเฉิน', 'งานผู้ป่วยนอก'];
const validEquipment = {
  equipmentCode: 'VENT-งานอุบัติเหตุฉุกเฉิน-08',
  equipmentType: 'Ventilator',
  department: 'งานอุบัติเหตุฉุกเฉิน',
  room: 'Room 2',
  status: 'active'
};

test('normalizeEquipmentInput accepts a valid Thai department equipment code', () => {
  assert.deepEqual(normalizeEquipmentInput(validEquipment, departments), validEquipment);
});

test('normalizeEquipmentInput trims fields and normalizes equipment code', () => {
  const result = normalizeEquipmentInput({
    ...validEquipment,
    equipmentCode: ' vent-งานอุบัติเหตุฉุกเฉิน-08 ',
    equipmentType: ' Ventilator ',
    department: ' งานอุบัติเหตุฉุกเฉิน ',
    room: ' Room 2 '
  }, departments);

  assert.deepEqual(result, validEquipment);
});

test('normalizeEquipmentInput rejects a department that does not match the code', () => {
  const result = normalizeEquipmentInput({
    ...validEquipment,
    department: 'งานผู้ป่วยนอก'
  }, departments);

  assert.match(result.error, /ชื่อแผนกในรหัสอุปกรณ์ต้องตรง/u);
});

test('normalizeEquipmentInput rejects unknown departments and invalid statuses', () => {
  assert.match(
    normalizeEquipmentInput({ ...validEquipment, department: 'ICU' }, departments).error,
    /เลือกแผนกจากรายการ/u
  );
  assert.match(
    normalizeEquipmentInput({ ...validEquipment, status: 'deleted' }, departments).error,
    /สถานะอุปกรณ์ไม่ถูกต้อง/u
  );
});

test('normalizeEquipmentInput rejects malformed and oversized equipment codes', () => {
  assert.match(
    normalizeEquipmentInput({ ...validEquipment, equipmentCode: 'VENT-08' }, departments).error,
    /รูปแบบ PREFIX/u
  );
  assert.match(
    normalizeEquipmentInput({ ...validEquipment, equipmentCode: `VENT-${'x'.repeat(50)}-08` }, departments).error,
    /ยาวไม่เกิน 50/u
  );
});
