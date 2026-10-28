const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { hashPassword, verifyPassword, isLegacyPasswordHash } = require('../lib/password');

test('hashPassword creates a salted scrypt hash that verifies the password', async () => {
  const password = 'correct horse battery staple';
  const storedHash = await hashPassword(password);

  assert.match(storedHash, /^scrypt\$16384\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPassword(password, storedHash), true);
  assert.equal(await verifyPassword('incorrect password', storedHash), false);
  assert.equal(isLegacyPasswordHash(storedHash), false);
});

test('hashPassword uses a unique salt for each password hash', async () => {
  const firstHash = await hashPassword('same password');
  const secondHash = await hashPassword('same password');

  assert.notEqual(firstHash, secondHash);
  assert.notEqual(firstHash.split('$')[2], secondHash.split('$')[2]);
});

test('verifyPassword accepts legacy SHA-256 hashes for migration', async () => {
  const password = 'legacy password';
  const legacyHash = crypto.createHash('sha256').update(password).digest('hex');

  assert.equal(isLegacyPasswordHash(legacyHash), true);
  assert.equal(await verifyPassword(password, legacyHash), true);
  assert.equal(await verifyPassword('wrong password', legacyHash), false);
});

test('verifyPassword rejects malformed and unsupported hashes', async () => {
  assert.equal(await verifyPassword('password', null), false);
  assert.equal(await verifyPassword('password', 'not-a-hash'), false);
  assert.equal(await verifyPassword('password', 'scrypt$32768$invalid$invalid'), false);
});
