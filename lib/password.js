const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const PASSWORD_HASH_ALGORITHM = 'scrypt';
const PASSWORD_SCRYPT_COST = 16384;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(String(password), salt, 64, {
    N: PASSWORD_SCRYPT_COST,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024
  });
  return `${PASSWORD_HASH_ALGORITHM}$${PASSWORD_SCRYPT_COST}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;

  const parts = storedHash.split('$');
  if (
    parts.length === 4
    && parts[0] === PASSWORD_HASH_ALGORITHM
    && parts[1] === String(PASSWORD_SCRYPT_COST)
    && /^[a-f0-9]{32}$/i.test(parts[2])
    && /^[a-f0-9]{128}$/i.test(parts[3])
  ) {
    const salt = Buffer.from(parts[2], 'hex');
    const expectedHash = Buffer.from(parts[3], 'hex');
    const submittedHash = await scrypt(String(password), salt, expectedHash.length, {
      N: PASSWORD_SCRYPT_COST,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024
    });
    return crypto.timingSafeEqual(submittedHash, expectedHash);
  }

  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const submittedHash = crypto.createHash('sha256').update(String(password)).digest();
    const expectedHash = Buffer.from(storedHash, 'hex');
    return crypto.timingSafeEqual(submittedHash, expectedHash);
  }

  return false;
}

function isLegacyPasswordHash(storedHash) {
  return typeof storedHash === 'string' && /^[a-f0-9]{64}$/i.test(storedHash);
}

module.exports = { hashPassword, verifyPassword, isLegacyPasswordHash };
