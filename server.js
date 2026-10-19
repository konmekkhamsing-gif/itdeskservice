// =====================================================
// ระบบ Hospital Helpdesk API
// - จัดการฐานข้อมูล MySQL
// - เปิดบริการ Express API และ static files
// - จัดการ login, ticket, notification, export Excel
// =====================================================
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const ExcelJS = require('exceljs');
const mysql = require('mysql2/promise');
const db = require('./db');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'hospital_helpdesk';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const ENABLE_DEMO_ACCOUNTS = process.env.ENABLE_DEMO_ACCOUNTS === 'true';

// -----------------------------------------------------
// ส่วน helper สำหรับ hash password
// -----------------------------------------------------
const hashPassword = (password) => crypto.createHash('sha256').update(String(password)).digest('hex');

// -----------------------------------------------------
// ส่วนตั้งค่าฐานข้อมูลและ schema
// - สร้าง database หากยังไม่มี
// - ตั้ง charset เป็น utf8mb4 เพื่อรองรับภาษาไทย
// - สร้างตาราง users, equipments, tickets หากยังไม่มี
// -----------------------------------------------------
async function ensureDatabaseSchema() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`ALTER DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${DB_NAME}\`;`);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      role VARCHAR(30) NOT NULL,
      department VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS equipments (
      equipment_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      equipment_code VARCHAR(100) NOT NULL UNIQUE,
      equipment_type VARCHAR(255) NOT NULL,
      department VARCHAR(255) NOT NULL,
      room VARCHAR(255) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS tickets (
      ticket_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      equipment_id INT UNSIGNED NOT NULL,
      issue_detail TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      admin_id INT UNSIGNED NULL,
      repair_note TEXT NULL,
      reporter_name VARCHAR(255) NULL,
      reporter_username VARCHAR(100) NULL,
      ticket_category VARCHAR(30) NOT NULL DEFAULT 'hardware',
      urgency VARCHAR(20) NOT NULL DEFAULT 'medium',
      reported_at DATETIME NULL,
      completed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_tickets_equipment FOREIGN KEY (equipment_id) REFERENCES equipments(equipment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_tickets_admin FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await connection.query(`ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`ALTER TABLE equipments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`ALTER TABLE tickets CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

  await connection.end();
}

// -----------------------------------------------------
// ส่วน seed ข้อมูลเริ่มต้น
// - สร้าง admin demo accounts only when explicitly enabled
// - เพิ่มข้อมูลอุปกรณ์เริ่มต้นลงในระบบ
// -----------------------------------------------------
async function seedInitialData() {
  try {
    const admins = [
      { username: 'admin02', password: 'admin123', fullName: 'Preecha IT', department: 'IT Support' },
      { username: 'admin03', password: 'admin123', fullName: 'Suda Tech', department: 'IT Support' },
      { username: 'admin04', password: 'admin123', fullName: 'Kittiya Admin', department: 'IT Support' },
      { username: 'admin05', password: 'admin123', fullName: 'Nattapong IT', department: 'IT Support' }
    ];

    if (ENABLE_DEMO_ACCOUNTS) {
      for (const admin of admins) {
        await db.query(
          `INSERT IGNORE INTO users (username, password_hash, full_name, role, department)
           VALUES (?, ?, ?, 'admin', ?)`,
          [admin.username, hashPassword(admin.password), admin.fullName, admin.department]
        );
      }
    }

    const equipments = [
      { equipment_code: 'PC-ER-02', equipment_type: 'Computer', department: 'ER', room: 'Room 2', status: 'active' },
      { equipment_code: 'MON-ER-06', equipment_type: 'Monitor', department: 'ER', room: 'Room 4', status: 'active' },
      { equipment_code: 'BP-ER-07', equipment_type: 'Blood Pressure Monitor', department: 'ER', room: 'Room 5', status: 'active' },
      { equipment_code: 'VENT-ER-08', equipment_type: 'Ventilator', department: 'ER', room: 'Room 2', status: 'active' },
      { equipment_code: 'ECG-ER-09', equipment_type: 'ECG Machine', department: 'ER', room: 'Room 5', status: 'active' },
      { equipment_code: 'DEF-ER-10', equipment_type: 'Defibrillator', department: 'ER', room: 'Room 1', status: 'active' },
      { equipment_code: 'PC-OPD-04', equipment_type: 'Computer', department: 'OPD', room: 'Counter 2', status: 'active' },
      { equipment_code: 'MON-OPD-05', equipment_type: 'Monitor', department: 'OPD', room: 'Counter 1', status: 'active' },
      { equipment_code: 'PR-OPD-06', equipment_type: 'Printer', department: 'OPD', room: 'Counter 3', status: 'active' },
      { equipment_code: 'ECG-OPD-07', equipment_type: 'ECG Machine', department: 'OPD', room: 'Room 4', status: 'active' },
      { equipment_code: 'XR-OPD-08', equipment_type: 'X-Ray Machine', department: 'OPD', room: 'Room 2', status: 'active' },
      { equipment_code: 'MON-ICU-05', equipment_type: 'Monitor', department: 'ICU', room: 'Room 1', status: 'active' },
      { equipment_code: 'VENT-ICU-06', equipment_type: 'Ventilator', department: 'ICU', room: 'Room 2', status: 'active' },
      { equipment_code: 'PUMP-ICU-07', equipment_type: 'Infusion Pump', department: 'ICU', room: 'Room 1', status: 'active' },
      { equipment_code: 'IV-ICU-08', equipment_type: 'IV Pump', department: 'ICU', room: 'Room 3', status: 'active' },
      { equipment_code: 'OXY-ICU-09', equipment_type: 'Oxygen Concentrator', department: 'ICU', room: 'Room 4', status: 'active' },
      { equipment_code: 'MIC-LAB-01', equipment_type: 'Microscope', department: 'Lab', room: 'Lab 1', status: 'active' },
      { equipment_code: 'HEM-LAB-02', equipment_type: 'Hematology Analyzer', department: 'Lab', room: 'Lab 2', status: 'active' },
      { equipment_code: 'BIO-LAB-03', equipment_type: 'Biochemistry Analyzer', department: 'Lab', room: 'Lab 3', status: 'active' },
      { equipment_code: 'CHEM-LAB-04', equipment_type: 'Chemical Analyzer', department: 'Lab', room: 'Lab 4', status: 'active' },
      { equipment_code: 'CENT-LAB-05', equipment_type: 'Centrifuge', department: 'Lab', room: 'Lab 1', status: 'active' },
      { equipment_code: 'XR-RAD-01', equipment_type: 'X-Ray Machine', department: 'Radiology', room: 'X-Ray Room 1', status: 'active' },
      { equipment_code: 'XR-RAD-02', equipment_type: 'X-Ray Machine', department: 'Radiology', room: 'X-Ray Room 2', status: 'active' },
      { equipment_code: 'CT-RAD-01', equipment_type: 'CT Scanner', department: 'Radiology', room: 'CT Room', status: 'active' },
      { equipment_code: 'MRI-RAD-01', equipment_type: 'MRI Scanner', department: 'Radiology', room: 'MRI Room', status: 'active' },
      { equipment_code: 'PC-PH-01', equipment_type: 'Computer', department: 'Pharmacy', room: 'Pharmacy Counter', status: 'active' },
      { equipment_code: 'FR-PH-02', equipment_type: 'Medical Refrigerator', department: 'Pharmacy', room: 'Pharmacy Storage', status: 'active' },
      { equipment_code: 'MED-PH-03', equipment_type: 'Automated Dispensing Cabinet', department: 'Pharmacy', room: 'Pharmacy', status: 'active' }
    ];

    for (const item of equipments) {
      await db.query(
        'INSERT IGNORE INTO equipments (equipment_code, equipment_type, department, room, status) VALUES (?, ?, ?, ?, ?)',
        [item.equipment_code, item.equipment_type, item.department, item.room, item.status]
      );
    }

    console.log('Ensured initial equipments exist in database');
    if (ENABLE_DEMO_ACCOUNTS) {
      console.warn('Demo accounts are enabled. Do not enable them on a public deployment.');
    }
  } catch (err) {
    console.warn('Could not seed initial database data:', err.message || err);
  }
}

// -----------------------------------------------------
// ส่วน initialize database ตอนเริ่มแอป
// - เรียก create schema และ seed data
// - ตรวจสอบ column เพิ่มเติมบน tickets table
// -----------------------------------------------------
async function initializeDatabase() {
  try {
    await ensureDatabaseSchema();
    await seedInitialData();

    try {
      await db.query(`ALTER TABLE tickets \
        ADD COLUMN IF NOT EXISTS reporter_name VARCHAR(255) NULL,\
        ADD COLUMN IF NOT EXISTS reporter_username VARCHAR(100) NULL,\
        ADD COLUMN IF NOT EXISTS ticket_category ENUM('hardware','software') DEFAULT 'hardware' NULL,\
        ADD COLUMN IF NOT EXISTS reported_at DATETIME NULL,\
        ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL`);
      await db.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS urgency ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium'`);
      await db.query(`
        UPDATE tickets t
        INNER JOIN equipments e ON e.equipment_id = t.equipment_id
        SET urgency = CASE
          WHEN LOWER(t.issue_detail) REGEXP 'เสียชีวิต|หยุดหายใจ|ฉุกเฉิน|ไฟไหม้|กระทบชีวิต'
            OR (LOWER(e.equipment_type) REGEXP 'ventilator|defibrillator|oxygen' AND LOWER(e.department) IN ('icu', 'er')) THEN 'critical'
          WHEN LOWER(t.issue_detail) REGEXP 'ใช้ไม่ได้|เปิดไม่ติด|ระบบล่ม|ด่วน|เร่งด่วน|ต้องรีบ|รีบ|กระทบทั้งแผนก|เครื่องเสีย|ไม่ทำงาน|ดับ'
            OR LOWER(e.equipment_type) REGEXP 'ventilator|defibrillator|oxygen|infusion|iv pump|ct scanner|mri scanner|x-ray'
            OR LOWER(e.department) IN ('icu', 'er') THEN 'high'
          WHEN LOWER(t.issue_detail) REGEXP 'ช้า|ผิดพลาด|แจ้งเตือน|พิมพ์ไม่ได้'
            OR LOWER(e.department) IN ('radiology', 'lab', 'pharmacy') THEN 'medium'
          ELSE 'low'
        END
      `);
      await db.query(`UPDATE tickets SET reported_at = COALESCE(reported_at, created_at) WHERE reported_at IS NULL`);
      console.log('Ensured tickets table has ticket metadata and urgency columns');
    } catch (err) {
      console.warn('Could not ensure reporter columns on tickets table:', err.message || err);
    }
  } catch (err) {
    console.warn('Database initialization failed:', err.message || err);
  }
}

// -----------------------------------------------------
// ส่วนสร้าง Express app และ state รันแอป
// -----------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const adminNotifications = [];
const DEMO_USERS = {
  admin01: { password: 'admin123', role: 'admin', userId: 1, fullName: 'Somchai IT', department: 'IT Support' },
  admin02: { password: 'admin123', role: 'admin', userId: 6, fullName: 'Preecha IT', department: 'IT Support' },
  admin03: { password: 'admin123', role: 'admin', userId: 7, fullName: 'Suda Tech', department: 'IT Support' },
  admin04: { password: 'admin123', role: 'admin', userId: 8, fullName: 'Kittiya Admin', department: 'IT Support' },
  admin05: { password: 'admin123', role: 'admin', userId: 9, fullName: 'Nattapong IT', department: 'IT Support' },
  nurse01: { password: 'user123', role: 'user', userId: 2, fullName: 'Somsri Nurse', department: 'ER' },
  nurse02: { password: 'user123', role: 'user', userId: 4, fullName: 'Nattaya Nurse', department: 'OPD' },
  nurse03: { password: 'user123', role: 'user', userId: 5, fullName: 'Kanya Nurse', department: 'ICU' }
};


// -----------------------------------------------------
// ส่วน middleware และ static file
// -----------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------------------------------
// ส่วนถามตอบด้วย Gemini API
// - เก็บ API key ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น
// - รับประวัติสนทนาได้ไม่เกิน 10 ข้อความ และคำถามไม่เกิน 4,000 ตัวอักษร
// -----------------------------------------------------
app.post('/api/ai/ask', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์' });
    }

    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const requestedHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = requestedHistory
      .filter((item) => item && ['user', 'model'].includes(item.role) && typeof item.text === 'string')
      .slice(-10)
      .map((item) => ({
        role: item.role,
        parts: [{ text: item.text.trim().slice(0, 4000) }]
      }))
      .filter((item) => item.parts[0].text);

    if (!question) {
      return res.status(400).json({ error: 'กรุณาระบุคำถาม' });
    }

    if (question.length > 4000) {
      return res.status(400).json({ error: 'คำถามต้องมีความยาวไม่เกิน 4,000 ตัวอักษร' });
    }

    const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const requestBody = {
      systemInstruction: {
        parts: [{
          text: 'คุณเป็นผู้ช่วยฝ่าย IT ของโรงพยาบาล ตอบภาษาไทยอย่างสุภาพ กระชับ และปลอดภัย หากไม่แน่ใจให้บอกว่าไม่แน่ใจ ห้ามวินิจฉัยหรือแนะนำการรักษาผู้ป่วย และหากเป็นเหตุฉุกเฉินให้แนะนำติดต่อเจ้าหน้าที่ที่เกี่ยวข้องทันที'
        }]
      },
      contents: [
        ...history,
        { role: 'user', parts: [{ text: question }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800
      }
    };

    let response;
    let result;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      result = await response.json();

      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }

    if (!response.ok) {
      console.error('Gemini API error:', result.error || result);
      return res.status(response.status >= 500 ? 502 : response.status).json({
        error: response.status === 429
          ? 'Gemini จำกัดโควตาหรือจำนวนคำขอชั่วคราว กรุณารอสักครู่ ตรวจสอบโควตา/API key แล้วลองใหม่'
          : response.status === 503
            ? 'ขณะนี้ Gemini มีผู้ใช้งานจำนวนมาก กรุณาลองใหม่อีกครั้ง'
            : 'ไม่สามารถขอคำตอบจาก Gemini ได้'
      });
    }

    const answer = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!answer) {
      return res.status(502).json({ error: 'Gemini ไม่ได้ส่งคำตอบกลับมา' });
    }

    return res.json({ answer, model: GEMINI_MODEL });
  } catch (error) {
    console.error('Gemini request failed:', error);
    return res.status(502).json({ error: 'ไม่สามารถเชื่อมต่อ Gemini ได้' });
  }
});

app.post('/api/ai/classify-ticket', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์' });
    }

    const issueDetail = typeof req.body?.issueDetail === 'string' ? req.body.issueDetail.trim() : '';
    const equipmentCode = typeof req.body?.equipmentCode === 'string' ? req.body.equipmentCode.trim() : '';
    const department = typeof req.body?.department === 'string' ? req.body.department.trim() : '';

    if (!issueDetail) {
      return res.status(400).json({ error: 'กรุณาระบุรายละเอียดปัญหาก่อนวิเคราะห์' });
    }
    if (issueDetail.length > 4000) {
      return res.status(400).json({ error: 'รายละเอียดปัญหาต้องมีความยาวไม่เกิน 4,000 ตัวอักษร' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'คุณเป็นผู้ช่วยคัดแยก Ticket ฝ่าย IT ของโรงพยาบาล วิเคราะห์เฉพาะข้อมูลที่ได้รับ ห้ามเดาข้อมูลที่ไม่พบ และหากเกี่ยวข้องกับความปลอดภัยผู้ป่วยให้จัดความเร่งด่วนเป็น high'
            }]
          },
          contents: [{
            role: 'user',
            parts: [{
              text: [
                `รายละเอียดปัญหา: ${issueDetail}`,
                `รหัสอุปกรณ์: ${equipmentCode || 'ไม่ระบุ'}`,
                `แผนกผู้แจ้ง: ${department || 'ไม่ระบุ'}`,
                'ตอบเป็น JSON เท่านั้น โดยใช้ค่า category เป็น hardware หรือ software, equipmentType เป็นชื่อประเภทอุปกรณ์ภาษาไทย, urgency เป็น low, medium, high หรือ critical, assignedDepartment เป็นชื่อแผนกที่ควรรับผิดชอบ และ reason เป็นเหตุผลสั้น ๆ ภาษาไทย'
              ].join('\n')
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const result = await response.json();
    if (!response.ok) {
      console.error('Gemini classify error:', result.error || result);
      return res.status(response.status >= 500 ? 502 : response.status).json({
        error: response.status === 429
          ? 'Gemini จำกัดโควตาหรือจำนวนคำขอชั่วคราว กรุณารอสักครู่ ตรวจสอบโควตา/API key แล้วลองใหม่'
          : response.status === 503
            ? 'ขณะนี้ Gemini มีผู้ใช้งานจำนวนมาก กรุณาลองใหม่อีกครั้ง'
            : 'ไม่สามารถจัดหมวดหมู่ Ticket ได้'
      });
    }

    const rawAnswer = result.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!rawAnswer) return res.status(502).json({ error: 'Gemini ไม่ได้ส่งผลวิเคราะห์กลับมา' });

    let classification;
    try {
      classification = JSON.parse(rawAnswer);
    } catch (_error) {
      return res.status(502).json({ error: 'รูปแบบผลวิเคราะห์จาก Gemini ไม่ถูกต้อง' });
    }

    const validCategories = ['hardware', 'software'];
    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    if (!validCategories.includes(classification.category) || !validUrgencies.includes(classification.urgency)) {
      return res.status(502).json({ error: 'ผลวิเคราะห์จาก Gemini ไม่ครบถ้วน' });
    }

    return res.json({
      category: classification.category,
      equipmentType: String(classification.equipmentType || 'ไม่ระบุ'),
      urgency: classification.urgency,
      assignedDepartment: String(classification.assignedDepartment || department || 'ไม่ระบุ'),
      reason: String(classification.reason || 'ไม่มีเหตุผลเพิ่มเติม')
    });
  } catch (error) {
    console.error('Gemini classify request failed:', error);
    return res.status(502).json({ error: 'ไม่สามารถเชื่อมต่อ Gemini ได้' });
  }
});

// -----------------------------------------------------
// ส่วน health check endpoint
// -----------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// -----------------------------------------------------
// ส่วน analytics สำหรับ Dashboard Admin
// - รายงานตามแผนก/ประเภทอุปกรณ์/ประเภท ticket
// - คำนวณค่า SLA เฉลี่ย
// -----------------------------------------------------
app.get('/api/admin/analytics', async (_req, res) => {
  try {
    const [departmentRows] = await db.query(
      `SELECT e.department, COUNT(*) AS ticket_count
       FROM tickets t
       INNER JOIN equipments e ON e.equipment_id = t.equipment_id
       GROUP BY e.department
       ORDER BY ticket_count DESC, e.department ASC`
    );

    const [equipmentTypeRows] = await db.query(
      `SELECT e.equipment_type, COUNT(*) AS ticket_count
       FROM tickets t
       INNER JOIN equipments e ON e.equipment_id = t.equipment_id
       GROUP BY e.equipment_type
       ORDER BY ticket_count DESC, e.equipment_type ASC`
    );

    const [categoryRows] = await db.query(
      `SELECT t.ticket_category AS category, COUNT(*) AS ticket_count
       FROM tickets t
       GROUP BY t.ticket_category
       ORDER BY FIELD(t.ticket_category, 'hardware', 'software')`
    );

    const [slaRows] = await db.query(
      `SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.updated_at)), 2) AS average_sla_hours
       FROM tickets t
       WHERE t.status = 'completed'
         AND t.created_at IS NOT NULL
         AND t.updated_at IS NOT NULL`
    );

    res.json({
      byDepartment: departmentRows,
      byEquipmentType: equipmentTypeRows,
      byCategory: categoryRows,
      averageSlaHours: Number(slaRows[0]?.average_sla_hours || 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ไม่สามารถดึงสถิติ Dashboard ได้' });
  }
});

// -----------------------------------------------------
// ส่วนแจ้งเตือนสำหรับ Admin
// -----------------------------------------------------
app.get('/api/admin/notifications', (_req, res) => {
  res.json({
    count: adminNotifications.length,
    items: adminNotifications.slice(0, 10)
  });
});

app.delete('/api/admin/notifications', (_req, res) => {
  adminNotifications.length = 0;
  res.json({ message: 'ล้างแจ้งเตือนเรียบร้อยแล้ว' });
});

// -----------------------------------------------------
// ส่วน login API
// - ตรวจสอบ username/password จากฐานข้อมูลก่อน
// - fallback ไปที่ DEMO_USERS เฉพาะเมื่อเปิดใช้งาน demo accounts อย่างชัดเจน
// -----------------------------------------------------
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' });
    }

    const [dbUserRows] = await db.query(
      'SELECT user_id, username, full_name, role, department, password_hash FROM users WHERE username = ?',
      [username]
    );

    const dbUser = dbUserRows[0];
    if (dbUser && dbUser.password_hash === hashPassword(password)) {
      return res.json({
        message: 'เข้าสู่ระบบสำเร็จ',
        userId: dbUser.user_id,
        username: dbUser.username,
        role: dbUser.role,
        fullName: dbUser.full_name,
        department: dbUser.department || null
      });
    }

    const userRecord = ENABLE_DEMO_ACCOUNTS ? DEMO_USERS[username] : null;
    if (!userRecord || userRecord.password !== password) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    res.json({
      message: 'เข้าสู่ระบบสำเร็จ',
      userId: userRecord.userId,
      username,
      role: userRecord.role,
      fullName: userRecord.fullName,
      department: userRecord.department || null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ไม่สามารถเข้าสู่ระบบได้' });
  }
});

// -----------------------------------------------------
// ส่วนดึงข้อมูลรหัสอุปกรณ์ตามแผนก
// -----------------------------------------------------
app.get('/api/equipment-codes', async (req, res) => {
  try {
    const { department } = req.query;
    const baseSql = 'SELECT equipment_code, equipment_type, department, room FROM equipments WHERE status = ?';
    const params = ['active'];

    const sql = department
      ? `${baseSql} AND department = ? ORDER BY equipment_code ASC`
      : `${baseSql} ORDER BY equipment_code ASC`;

    if (department) params.push(department);

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลรหัสอุปกรณ์ได้' });
  }
});

function inferTicketUrgency(issueDetail, equipment = {}) {
  const text = String(issueDetail || '').toLowerCase();
  const equipmentType = String(equipment.equipment_type || '').toLowerCase();
  const department = String(equipment.department || '').toLowerCase();
  if (/เสียชีวิต|หยุดหายใจ|เครื่องช่วยหายใจ|ฉุกเฉิน|ไฟไหม้|ผู้ป่วย|กระทบชีวิต/.test(text)) return 'critical';
  if ((/ventilator|defibrillator|oxygen/.test(equipmentType) && ['icu', 'er'].includes(department))
    || /ใช้ไม่ได้|เปิดไม่ติด|ระบบล่ม|ด่วน|เร่งด่วน|ต้องรีบ|รีบ|กระทบทั้งแผนก|เครื่องเสีย|ไม่ทำงาน|ดับ/.test(text)) return 'high';
  if (/ventilator|defibrillator|oxygen|infusion|iv pump|ct scanner|mri scanner|x-ray/.test(equipmentType)
    || ['icu', 'er'].includes(department)) return 'high';
  if (/ช้า|ผิดพลาด|แจ้งเตือน|พิมพ์ไม่ได้/.test(text) || ['radiology', 'lab', 'pharmacy'].includes(department)) return 'medium';
  return 'low';
}

// -----------------------------------------------------
// ส่วนสร้าง ticket จาก User
// - ตรวจสอบข้อมูลอุปกรณ์และ issue detail
// - บันทึก reporter name/username และส่งแจ้งเตือนไปยัง Admin
// -----------------------------------------------------
app.post('/api/tickets', async (req, res) => {
  try {
    const { equipmentCode, issueDetail, userId = 2 } = req.body;
    const ticketCategoryRaw = req.body && typeof req.body.ticketCategory === 'string' ? String(req.body.ticketCategory).trim().toLowerCase() : '';
    const ticketCategory = ['hardware', 'software'].includes(ticketCategoryRaw) ? ticketCategoryRaw : 'hardware';

    if (!equipmentCode || !issueDetail) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสอุปกรณ์และรายละเอียดปัญหา' });
    }

    const normalizedCode = equipmentCode.trim().toUpperCase();
    const [equipmentRow] = await db.query(
      'SELECT equipment_id, equipment_type, department, room FROM equipments WHERE equipment_code = ?',
      [normalizedCode]
    );

    if (!equipmentRow.length) {
      const [codes] = await db.query(
        'SELECT equipment_code FROM equipments WHERE status = ? ORDER BY equipment_code ASC',
        ['active']
      );

      const supportedCodes = codes.map(code => code.equipment_code).join(', ');
      return res.status(404).json({
        error: `ไม่พบรหัสอุปกรณ์ "${equipmentCode}" ในระบบ กรุณาใช้รหัสที่เป็นของระบบ: ${supportedCodes}`
      });
    }

    // Fetch user display name for fallback if reporterName not provided
    const [userRows] = await db.query(
      'SELECT full_name FROM users WHERE user_id = ?',
      [Number(userId)]
    );

    const rawReporterName = req.body && typeof req.body.reporterName === 'string' ? String(req.body.reporterName).trim() : '';
    const rawReporterUsername = req.body && typeof req.body.reporterUsername === 'string' ? String(req.body.reporterUsername).trim() : '';

    const reporterName = rawReporterName.length > 0 ? rawReporterName : (userRows[0]?.full_name || 'Unknown User');
    const reporterUsername = rawReporterUsername.length > 0 ? rawReporterUsername : null;
    const urgency = inferTicketUrgency(issueDetail, equipmentRow[0]);

    const [result] = await db.query(
      `INSERT INTO tickets (user_id, equipment_id, issue_detail, status, admin_id, repair_note, reporter_name, reporter_username, ticket_category, urgency)
       VALUES (?, ?, ?, 'pending', NULL, NULL, ?, ?, ?, ?)`,
      [Number(userId), equipmentRow[0].equipment_id, issueDetail.trim(), reporterName, reporterUsername, ticketCategory, urgency]
    );

    // Re-query the inserted ticket to ensure we use the exact stored reporter_name/reporter_username
    const [savedRows] = await db.query(
      `SELECT t.reporter_name, t.reporter_username FROM tickets t WHERE t.ticket_id = ?`,
      [result.insertId]
    );
    const savedReporterName = savedRows[0]?.reporter_name || reporterName;
    const savedReporterUsername = savedRows[0]?.reporter_username || reporterUsername;

    adminNotifications.unshift({
      id: Date.now(),
      ticketId: result.insertId,
      userName: savedReporterName,
      reporterUsername: savedReporterUsername,
      issueDetail: issueDetail.trim(),
      createdAt: new Date().toISOString()
    });

    if (adminNotifications.length > 20) {
      adminNotifications.splice(20);
    }

    res.status(201).json({
      message: 'สร้าง Ticket สำเร็จ',
      ticketId: result.insertId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ไม่สามารถสร้าง Ticket ได้' });
  }
});

// -----------------------------------------------------
// ส่วนดึงข้อมูล ticket
// - รองรับ filter ตาม userId, status, category, date, search
// - ใช้สำหรับหน้า User และหน้า Admin
// -----------------------------------------------------
app.get('/api/tickets', async (req, res) => {
  try {
    const { userId, status, category, createdFrom, createdTo, search, activeOnly, pendingOnly, workingOnly, completedOnly } = req.query;
    const baseQuery = `
      SELECT
        t.ticket_id,
        t.user_id,
        t.equipment_id,
        t.issue_detail,
        t.status,
        t.admin_id,
        t.repair_note,
        t.reporter_name,
        t.reporter_username,
        t.ticket_category,
        t.urgency,
        t.reported_at,
        t.completed_at,
        t.created_at,
        t.updated_at,
        e.equipment_code,
        e.equipment_type,
        e.department,
        e.room,
        u.full_name AS user_name,
        admin.full_name AS admin_name
      FROM tickets t
      INNER JOIN equipments e ON e.equipment_id = t.equipment_id
      INNER JOIN users u ON u.user_id = t.user_id
      LEFT JOIN users admin ON admin.user_id = t.admin_id`;

    const queryParams = [];
    const conditions = [];

    if (userId) {
      conditions.push('t.user_id = ?');
      queryParams.push(Number(userId));
    }

    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      conditions.push('t.status = ?');
      queryParams.push(status);
    }

    if (activeOnly === '1') {
      conditions.push(`t.status IN ('pending', 'in_progress')`);
    }

    if (pendingOnly === '1') {
      conditions.push(`t.status = 'pending'`);
    }

    if (workingOnly === '1') {
      conditions.push(`t.status = 'in_progress'`);
    }

    if (completedOnly === '1') {
      conditions.push(`t.status = 'completed'`);
    }

    if (category && ['hardware', 'software'].includes(category)) {
      conditions.push('t.ticket_category = ?');
      queryParams.push(category);
    }

    if (search && String(search).trim()) {
      const rawSearch = String(search).trim();
      const searchTerms = rawSearch.split(/\s+/).filter(Boolean);
      const searchClauses = [];

      for (const term of searchTerms) {
        const likeTerm = `%${term}%`;
        searchClauses.push(`(
          e.equipment_code LIKE ? OR
          e.department LIKE ? OR
          e.equipment_type LIKE ? OR
          t.issue_detail LIKE ? OR
          t.repair_note LIKE ? OR
          t.reporter_name LIKE ? OR
          t.reporter_username LIKE ? OR
          u.full_name LIKE ? OR
          admin.full_name LIKE ?
        )`);
        queryParams.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
      }

      const rawTerm = `%${rawSearch}%`;
      searchClauses.push(`(
        e.equipment_code LIKE ? OR
        e.department LIKE ? OR
        e.equipment_type LIKE ? OR
        t.issue_detail LIKE ? OR
        t.repair_note LIKE ? OR
        t.reporter_name LIKE ? OR
        t.reporter_username LIKE ? OR
        u.full_name LIKE ? OR
        admin.full_name LIKE ?
      )`);
      queryParams.push(rawTerm, rawTerm, rawTerm, rawTerm, rawTerm, rawTerm, rawTerm, rawTerm, rawTerm);

      conditions.push(`(${searchClauses.join(' OR ')})`);
    }

    const normalizeDateParam = (value, endOfDay = false) => {
      if (!value) return null;
      const simpleDateMatch = value.match(/^\d{4}-\d{2}-\d{2}$/);
      if (simpleDateMatch) {
        return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`;
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      if (endOfDay) {
        parsed.setHours(23, 59, 59, 999);
      } else {
        parsed.setHours(0, 0, 0, 0);
      }
      return parsed.toISOString().slice(0, 19).replace('T', ' ');
    };

    const fromDateTime = normalizeDateParam(String(createdFrom || ''));
    if (fromDateTime) {
      conditions.push('t.created_at >= ?');
      queryParams.push(fromDateTime);
    }

    const toDateTime = normalizeDateParam(String(createdTo || ''), true);
    if (toDateTime) {
      conditions.push('t.created_at <= ?');
      queryParams.push(toDateTime);
    }

    const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db.query(
      `${baseQuery}${whereClause} ORDER BY FIELD(t.status, 'pending', 'in_progress', 'completed'), FIELD(t.urgency, 'critical', 'high', 'medium', 'low'), t.created_at ASC`,
      queryParams
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูล ticket ได้' });
  }
});

// -----------------------------------------------------
// ส่วน export ข้อมูล ticket เป็น Excel
// - ตรวจสอบสิทธิ์ Admin
// - ใช้ current filter จาก UI และดาวน์โหลดไฟล์ Excel
// -----------------------------------------------------
app.get('/api/admin/tickets/export', async (req, res) => {
  try {
    const adminId = Number(req.query.adminId || 0);
    if (!adminId) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนดาวน์โหลด' });
    }

    const [adminRows] = await db.query('SELECT user_id FROM users WHERE user_id = ? AND role = ?', [adminId, 'admin']);
    if (!adminRows.length) {
      return res.status(403).json({ error: 'ไม่อนุญาตให้ดาวน์โหลดไฟล์นี้' });
    }

    const { status, category, createdFrom, createdTo, search } = req.query;
    const baseQuery = `
      SELECT
        t.ticket_id,
        u.full_name AS user_name,
        t.reporter_name,
        t.reporter_username,
        e.equipment_code,
        e.department,
        e.equipment_type,
        t.ticket_category,
        t.issue_detail,
        t.status,
        t.repair_note,
        admin.full_name AS admin_name,
        t.reported_at,
        t.completed_at,
        t.created_at,
        t.updated_at
      FROM tickets t
      INNER JOIN equipments e ON e.equipment_id = t.equipment_id
      INNER JOIN users u ON u.user_id = t.user_id
      LEFT JOIN users admin ON admin.user_id = t.admin_id`;

    const queryParams = [];
    const conditions = [];

    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      conditions.push('t.status = ?');
      queryParams.push(status);
    }

    if (category && ['hardware', 'software'].includes(category)) {
      conditions.push('t.ticket_category = ?');
      queryParams.push(category);
    }

    if (search && String(search).trim()) {
      const rawSearch = String(search).trim();
      const searchTerms = rawSearch.split(/\s+/).filter(Boolean);
      const searchClauses = [];

      for (const term of searchTerms) {
        const likeTerm = `%${term}%`;
        searchClauses.push(`(
          e.equipment_code LIKE ? OR
          e.department LIKE ? OR
          e.equipment_type LIKE ? OR
          t.issue_detail LIKE ? OR
          t.repair_note LIKE ? OR
          t.reporter_name LIKE ? OR
          t.reporter_username LIKE ? OR
          u.full_name LIKE ? OR
          admin.full_name LIKE ?
        )`);
        queryParams.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
      }

      const rawTerm = `%${rawSearch}%`;
      searchClauses.push(`(
        e.equipment_code LIKE ? OR
        e.department LIKE ? OR
        e.equipment_type LIKE ? OR
        t.issue_detail LIKE ? OR
        t.repair_note LIKE ? OR
        t.reporter_name LIKE ? OR
        t.reporter_username LIKE ? OR
        u.full_name LIKE ? OR
        admin.full_name LIKE ?
      )`);
      queryParams.push(rawTerm, rawTerm, rawTerm, rawTerm, rawTerm, rawTerm, rawTerm, rawTerm, rawTerm);

      conditions.push(`(${searchClauses.join(' OR ')})`);
    }

    const normalizeDateParam = (value, endOfDay = false) => {
      if (!value) return null;
      const simpleDateMatch = value.match(/^\d{4}-\d{2}-\d{2}$/);
      if (simpleDateMatch) {
        return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`;
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      if (endOfDay) {
        parsed.setHours(23, 59, 59, 999);
      } else {
        parsed.setHours(0, 0, 0, 0);
      }
      return parsed.toISOString().slice(0, 19).replace('T', ' ');
    };

    const fromDateTime = normalizeDateParam(String(createdFrom || ''));
    if (fromDateTime) {
      conditions.push('t.created_at >= ?');
      queryParams.push(fromDateTime);
    }

    const toDateTime = normalizeDateParam(String(createdTo || ''), true);
    if (toDateTime) {
      conditions.push('t.created_at <= ?');
      queryParams.push(toDateTime);
    }

    const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db.query(`${baseQuery}${whereClause} ORDER BY t.created_at DESC`, queryParams);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ticket Log');

    sheet.columns = [
      { header: 'Ticket ID', key: 'ticket_id', width: 12 },
      { header: 'ชื่อผู้ใช้ระบบ', key: 'user_name', width: 24 },
      { header: 'ชื่อผู้แจ้ง', key: 'reporter_name', width: 24 },
      { header: 'ชื่อผู้ใช้ผู้แจ้ง', key: 'reporter_username', width: 20 },
      { header: 'อุปกรณ์', key: 'equipment_code', width: 18 },
      { header: 'แผนก', key: 'department', width: 16 },
      { header: 'ประเภทอุปกรณ์', key: 'equipment_type', width: 18 },
      { header: 'ประเภท Ticket', key: 'ticket_category', width: 14 },
      { header: 'รายละเอียด', key: 'issue_detail', width: 45 },
      { header: 'สถานะ', key: 'status', width: 18 },
      { header: 'หมายเหตุ', key: 'repair_note', width: 35 },
      { header: 'แอดมินที่ดูแล', key: 'admin_name', width: 24 },
      { header: 'วันที่แจ้ง', key: 'reported_at', width: 24 },
      { header: 'วันที่เสร็จ', key: 'completed_at', width: 24 },
      { header: 'วันที่สร้าง', key: 'created_at', width: 24 },
      { header: 'อัปเดตล่าสุด', key: 'updated_at', width: 24 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    rows.forEach((row) => {
      sheet.addRow({
        ticket_id: row.ticket_id,
        user_name: row.user_name || '—',
        reporter_name: row.reporter_name || '—',
        reporter_username: row.reporter_username || '—',
        equipment_code: row.equipment_code || '—',
        department: row.department || '—',
        equipment_type: row.equipment_type || '—',
        ticket_category: row.ticket_category === 'software' ? 'Software' : 'Hardware',
        issue_detail: row.issue_detail || '—',
        status: row.status || '—',
        repair_note: row.repair_note || '—',
        admin_name: row.admin_name || '—',
        reported_at: row.reported_at ? new Date(row.reported_at) : '—',
        completed_at: row.completed_at ? new Date(row.completed_at) : '—',
        created_at: row.created_at ? new Date(row.created_at) : '—',
        updated_at: row.updated_at ? new Date(row.updated_at) : '—'
      });
    });

    sheet.autoFilter = {
      from: 'A1',
      to: `${String.fromCharCode(64 + sheet.columns.length)}${sheet.rowCount}`
    };

    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'top', wrapText: true };
      });
      if (rowNumber > 1) {
        row.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="admin-ticket-log.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ไม่สามารถสร้างไฟล์ Excel ได้' });
  }
});

// -----------------------------------------------------
// ส่วนอัปเดต ticket โดย Admin
// - เปลี่ยนสถานะ, repair note, completedAt
// -----------------------------------------------------
app.put('/api/tickets/:ticketId', async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);
    const { status, repairNote, adminId = 1, reportedAt, completedAt } = req.body;

    if (status !== undefined && !['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    }

    const fields = [];
    const params = [];

    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }

    if (reportedAt !== undefined) {
      const reportedAtValue = reportedAt ? new Date(reportedAt) : null;
      if (reportedAt && Number.isNaN(reportedAtValue.getTime())) {
        return res.status(400).json({ error: 'วันที่แจ้งไม่ถูกต้อง' });
      }
      fields.push('reported_at = ?');
      params.push(reportedAtValue ? reportedAtValue.toISOString().slice(0, 19).replace('T', ' ') : null);
    }

    if (status === 'completed') {
      const completedAtValue = completedAt ? new Date(completedAt) : null;
      if (completedAt && Number.isNaN(completedAtValue.getTime())) {
        return res.status(400).json({ error: 'วันที่เสร็จงานไม่ถูกต้อง' });
      }
      fields.push('completed_at = ?');
      params.push(completedAtValue
        ? completedAtValue.toISOString().slice(0, 19).replace('T', ' ')
        : new Date().toISOString().slice(0, 19).replace('T', ' '));
    } else if (status !== undefined) {
      fields.push('completed_at = ?');
      params.push(null);
    } else if (completedAt !== undefined) {
      const completedAtValue = completedAt ? new Date(completedAt) : null;
      if (completedAt && Number.isNaN(completedAtValue.getTime())) {
        return res.status(400).json({ error: 'วันที่เสร็จงานไม่ถูกต้อง' });
      }
      fields.push('completed_at = ?');
      params.push(completedAtValue ? completedAtValue.toISOString().slice(0, 19).replace('T', ' ') : null);
    }

    fields.push('repair_note = ?');
    params.push(repairNote?.trim() || null);

    fields.push('admin_id = ?');
    params.push(Number(adminId));

    await db.query(
      `UPDATE tickets
       SET ${fields.join(', ')}
       WHERE ticket_id = ?`,
      [...params, ticketId]
    );

    res.json({ message: 'อัปเดตสถานะ ticket สำเร็จ' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ไม่สามารถอัปเดต ticket ได้' });
  }
});

// -----------------------------------------------------
// ส่วนสร้าง ticket โดย Admin
// - ใช้สำหรับสร้าง issue ใหม่จากหน้า Admin
// - บันทึก Ticket ที่สร้างเป็นงานเสร็จสิ้น พร้อมวันที่แจ้งและวันที่เสร็จงาน
// -----------------------------------------------------
app.post('/api/admin/tickets', async (req, res) => {
  try {
    const { reporterName, reporterUsername, equipmentCode, ticketCategory, issueDetail, repairNote, createdDate, completedDate, adminId = 1 } = req.body;

    if (!reporterName || !equipmentCode || !issueDetail) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้แจ้ง อุปกรณ์ และรายละเอียดปัญหา' });
    }

    const ticketCategoryRaw = String(ticketCategory || '').trim().toLowerCase();
    const finalCategory = ['hardware', 'software'].includes(ticketCategoryRaw) ? ticketCategoryRaw : 'hardware';

    const normalizedCode = String(equipmentCode).trim().toUpperCase();
    const [equipmentRow] = await db.query(
      'SELECT equipment_id FROM equipments WHERE equipment_code = ?',
      [normalizedCode]
    );

    if (!equipmentRow.length) {
      const [codes] = await db.query(
        'SELECT equipment_code FROM equipments WHERE status = ? ORDER BY equipment_code ASC',
        ['active']
      );
      const supportedCodes = codes.map(c => c.equipment_code).join(', ');
      return res.status(404).json({
        error: `ไม่พบรหัสอุปกรณ์ "${equipmentCode}" ในระบบ: ${supportedCodes}`
      });
    }

    const reportedAt = createdDate ? new Date(createdDate) : new Date();
    if (Number.isNaN(reportedAt.getTime())) {
      return res.status(400).json({ error: 'วันที่แจ้งไม่ถูกต้อง' });
    }

    const completedAtValue = completedDate ? new Date(completedDate) : new Date();
    if (completedDate && Number.isNaN(completedAtValue.getTime())) {
      return res.status(400).json({ error: 'วันที่เสร็จงานไม่ถูกต้อง' });
    }

    const reportedAtStr = reportedAt.toISOString().slice(0, 19).replace('T', ' ');
    const completedAtStr = completedAtValue.toISOString().slice(0, 19).replace('T', ' ');

    const [result] = await db.query(
      `INSERT INTO tickets (user_id, equipment_id, issue_detail, status, admin_id, repair_note, reporter_name, reporter_username, ticket_category, reported_at, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, equipmentRow[0].equipment_id, issueDetail.trim(), Number(adminId), repairNote?.trim() || null, reporterName.trim(), reporterUsername?.trim() || null, finalCategory, reportedAtStr, completedAtStr, reportedAtStr, completedAtStr]
    );

    res.status(201).json({
      message: 'สร้าง Ticket และบันทึกเป็นงานเสร็จสิ้นแล้ว',
      ticketId: result.insertId,
      status: 'completed'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ไม่สามารถสร้าง Ticket ได้' });
  }
});

// -----------------------------------------------------
// ส่วนจัดการ error จาก Express
// -----------------------------------------------------
app.use((error, _req, res, _next) => {
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  res.status(500).json({ error: 'Unexpected server error.' });
});

// -----------------------------------------------------
// ส่วนเริ่มต้นเซิร์ฟเวอร์
// - initialize database ก่อนเปิด port
// - เรียก app.listen() เพื่อเปิดใช้งานแอป
// -----------------------------------------------------
async function startServer() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Hospital Helpdesk API running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err.message || err);
  process.exit(1);
});
