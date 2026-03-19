function randomDigits(length = 4) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function generateClaimId() {
  return `CLM${Date.now()}`;
}

function generateRedemptionId() {
  return `RED${Date.now()}`;
}

function generateVoucherCode() {
  return randomDigits(6);
}

function generateOtpCode() {
  return randomDigits(4);
}

module.exports = {
  generateClaimId,
  generateRedemptionId,
  generateVoucherCode,
  generateOtpCode,
};