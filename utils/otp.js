import crypto from 'crypto';

export const generateOTP = () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = crypto.createHash('sha256').update(otp).digest('hex');
  const expires = Date.now() + 10 * 60 * 1000;

  return { otp, hashed, expires };
};

export const verifyOTP = (enteredOTP, storedHash) => {
  const hashed = crypto.createHash('sha256').update(enteredOTP).digest('hex');
  return hashed === storedHash;
};
