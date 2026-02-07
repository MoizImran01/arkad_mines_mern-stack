import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

const encryptField = (text) => {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'hex'), iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
};

const decryptField = (encryptedText) => {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'hex'), iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText;
  }
};

export const encryptSensitiveData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const encrypted = { ...data };
  if (encrypted.email) {
    encrypted.email = encryptField(encrypted.email);
  }
  return encrypted;
};

export const decryptSensitiveData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const decrypted = { ...data };
  if (decrypted.email && decrypted.email.includes(':')) {
    decrypted.email = decryptField(decrypted.email);
  }
  return decrypted;
};

const RETENTION_DAYS = Number.parseInt(process.env.ANALYTICS_RETENTION_DAYS || '365', 10);

export const cleanupOldAnalyticsLogs = async () => {
  try {
    // AuditLog is immutable (no deletes/updates). Skip retention cleanup for audit logs.
    console.log(`[DATA RETENTION] Skipping audit log cleanup (audit logs are immutable, retention: ${RETENTION_DAYS} days)`);
    return 0;
  } catch (error) {
    console.error('[DATA RETENTION] Error in retention job:', error);
    return 0;
  }
};

let retentionInterval = null;

export const startRetentionCleanup = () => {
  if (retentionInterval) return;
  
  cleanupOldAnalyticsLogs();
  
  retentionInterval = setInterval(() => {
    cleanupOldAnalyticsLogs();
  }, 24 * 60 * 60 * 1000);
  
  console.log(`[DATA RETENTION] Started cleanup job (runs daily, retention: ${RETENTION_DAYS} days)`);
};
