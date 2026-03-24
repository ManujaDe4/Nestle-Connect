function normalizeMobile(mobile) {
  if (!mobile) return "";

  let cleaned = mobile.replace(/\s+/g, "").replace(/-/g, "");

  if (cleaned.startsWith("+94")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("94")) {
    cleaned = "0" + cleaned.slice(2);
  }

  return cleaned;
}

module.exports = normalizeMobile;