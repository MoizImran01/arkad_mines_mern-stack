const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  
  if (localPart.length <= 1) {
    return `${localPart}@${domain}`;
  }
  
  const maskedLocal = localPart[0] + '*'.repeat(Math.min(localPart.length - 1, 3));
  return `${maskedLocal}@${domain}`;
};

export const analyticsDTO = (data) => {
  if (!data) return data;
  
  const sanitized = { ...data };
  
  if (sanitized.topClients && Array.isArray(sanitized.topClients)) {
    sanitized.topClients = sanitized.topClients.map(client => ({
      ...client,
      email: maskEmail(client.email)
    }));
  }
  
  return sanitized;
};
