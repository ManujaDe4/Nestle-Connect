const crypto = require("crypto");

function randomDigits(length = 4) {
  // crypto.randomInt is uniform; Math.random is not.
  let result = "";
  for (let i = 0; i < length; i++) {
    result += crypto.randomInt(0, 10);
  }
  return result;
}

function getPlatformPrefix(platform) {
  if (!platform) return '';
  const p = platform.toLowerCase();
  if (p === 'instagram') return 'IG';
  if (p === 'facebook') return 'FB';
  if (p === 'tiktok') return 'TT';
  if (p === 'twitter' || p === 'x') return 'X';
  if (p === 'youtube') return 'YT';
  return 'OTH';
}

function generateClaimId(platform = '') {
  const prefix = platform ? getPlatformPrefix(platform) + '-' : '';
  return `${prefix}CLM${Date.now()}`;
}

function generateRedemptionId() {
  return `RED${Date.now()}`;
}

function generateVoucherCode(platform = '') {
  const prefix = platform ? getPlatformPrefix(platform) + '-' : '';
  return `${prefix}${randomDigits(6)}`;
}

function generateOtpCode() {
  return randomDigits(6);
}

module.exports = {
  generateClaimId,
  generateRedemptionId,
  generateVoucherCode,
  generateOtpCode,
};
