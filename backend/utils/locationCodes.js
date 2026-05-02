function getLocationPrefix(province, region) {
  // If either is missing, use GEN (General)
  if (!province || !region) {
    return 'GEN-GEN';
  }

  // Pre-defined known mapping for perfection
  const knownMap = {
    'Western': 'WES',
    'Central': 'CEN',
    'Southern': 'SOU',
    'Northern': 'NOR',
    'Eastern': 'EAS',
    'North Western': 'NWE',
    'North Central': 'NCE',
    'Uva': 'UVA',
    'Sabaragamuwa': 'SAB',
    'Colombo': 'COL',
    'Gampaha': 'GAM',
    'Kalutara': 'KAL',
    'Kandy': 'KAN',
    'Matale': 'MAT',
    'Nuwara Eliya': 'NUW',
    'Galle': 'GAL',
    'Matara': 'MTR', // MAT is Matale, so use MTR for Matara
    'Hambantota': 'HAM',
    'Jaffna': 'JAF',
    'Kilinochchi': 'KIL',
    'Mannar': 'MAN',
    'Vavuniya': 'VAV',
    'Mullaitivu': 'MUL',
    'Trincomalee': 'TRI',
    'Batticaloa': 'BAT',
    'Ampara': 'AMP',
    'Kurunegala': 'KUR',
    'Puttalam': 'PUT',
    'Anuradhapura': 'ANU',
    'Polonnaruwa': 'POL',
    'Badulla': 'BAD',
    'Moneragala': 'MON',
    'Ratnapura': 'RAT',
    'Kegalle': 'KEG'
  };

  const getAbbr = (name) => {
    if (knownMap[name]) return knownMap[name];
    // Fallback if it's a new or unknown region: take first 3 letters capitalized
    return name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  };

  const pCode = getAbbr(province);
  const rCode = getAbbr(region);

  return `${pCode}-${rCode}`;
}

module.exports = { getLocationPrefix };
