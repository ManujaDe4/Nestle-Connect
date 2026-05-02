const SRI_LANKA_LOCATIONS = {
  "Western": {
    "Colombo": ["Colombo 1-15", "Dehiwala", "Moratuwa", "Kotte", "Maharagama", "Kesbewa", "Homagama", "Kaduwela", "Kolonnawa", "Avissawella", "Padukka", "Ratmalana"],
    "Gampaha": ["Gampaha", "Negombo", "Kelaniya", "Kadawatha", "Wattala", "Minuwangoda", "Peliyagoda", "Ja-Ela", "Mahara", "Dompe", "Biyagama", "Katana", "Divulapitiya", "Mirigama", "Attanagalla"],
    "Kalutara": ["Kalutara", "Panadura", "Horana", "Beruwala", "Bandaragama", "Matugama", "Agalawatta", "Bulathsinhala", "Dodangoda", "Walallawita"]
  },
  "Central": {
    "Kandy": ["Kandy City", "Peradeniya", "Katugastota", "Gampola", "Nawalapitiya", "Kundasale", "Akurana", "Kadugannawa", "Udunuwara", "Yatinuwara", "Pathadumbara", "Panvila"],
    "Matale": ["Matale", "Dambulla", "Sigiriya", "Galewela", "Ukuwela", "Rattota", "Naula", "Yatawatta", "Pallepola", "Wilgamuwa"],
    "Nuwara Eliya": ["Nuwara Eliya", "Hatton", "Talawakele", "Walapane", "Hanguranketha", "Ambagamuwa", "Kothmale"]
  },
  "Southern": {
    "Galle": ["Galle", "Ambalangoda", "Hikkaduwa", "Elpitiya", "Karandeniya", "Baddegama", "Neluwa", "Thawalama", "Akmeemana", "Bope-Poddala", "Habaraduwa", "Imaduwa"],
    "Matara": ["Matara", "Weligama", "Dikwella", "Akuressa", "Hakmana", "Kamburupitiya", "Deniyaya", "Pasgoda", "Pitabeddara", "Thihagoda"],
    "Hambantota": ["Hambantota", "Tangalle", "Tissamaharama", "Ambalantota", "Beliatta", "Angunakolapelessa", "Weeraketiya", "Lunugamvehera", "Walasmulla"]
  },
  "Northern": {
    "Jaffna": ["Jaffna", "Nallur", "Chavakachcheri", "Point Pedro", "Valvettithurai", "Kopay", "Sandilipay", "Tellippalai", "Uduvil", "Velanai", "Kayts"],
    "Kilinochchi": ["Kilinochchi", "Pallai", "Poonakary", "Karachchi", "Kandavalai"],
    "Mannar": ["Mannar", "Murunkan", "Nanaddan", "Musali", "Manthai West"],
    "Vavuniya": ["Vavuniya", "Nedunkeni", "Vavuniya North", "Vengalacheddikulam", "Vavuniya South"],
    "Mullaitivu": ["Mullaitivu", "Oddusuddan", "Maritimepattu", "Puthukkudiyiruppu", "Thunukkai", "Manthai East"]
  },
  "Eastern": {
    "Trincomalee": ["Trincomalee", "Kinniya", "Mutur", "Kantale", "Kuchchaveli", "Thampalakamam", "Gomarankadawala", "Padavi Sri Pura", "Morawewa"],
    "Batticaloa": ["Batticaloa", "Kattankudy", "Eravur", "Valaichchenai", "Kalkudah", "Kaluwanchikudy", "Paddiruppu", "Manmunai", "Porativu Pattu"],
    "Ampara": ["Ampara", "Kalmunai", "Samanthurai", "Akkaraipattu", "Pottuvil", "Uhana", "Maha Oya", "Dehiattakandiya", "Lahugala", "Thirukkovil"]
  },
  "North Western": {
    "Kurunegala": ["Kurunegala", "Kuliyapitiya", "Polgahawela", "Narammala", "Wariyapola", "Pannala", "Mawathagama", "Giriulla", "Alawwa", "Ibbagamuwa", "Bingiriya"],
    "Puttalam": ["Puttalam", "Chilaw", "Wennappuwa", "Nattandiya", "Anamaduwa", "Kalpitiya", "Dankotuwa", "Mundel", "Karuwalagaswewa"]
  },
  "North Central": {
    "Anuradhapura": ["Anuradhapura", "Kekirawa", "Medawachchiya", "Eppawala", "Tambuttegama", "Nochchiyagama", "Mihintale", "Galnewa", "Kahatagasdigiliya", "Horowpothana"],
    "Polonnaruwa": ["Polonnaruwa", "Hingurakgoda", "Kaduruwela", "Medirigiriya", "Welikanda", "Dimbulagala", "Elahera", "Thamankaduwa"]
  },
  "Uva": {
    "Badulla": ["Badulla", "Bandarawela", "Haputale", "Welimada", "Mahiyanganaya", "Passara", "Hali-Ela", "Uva-Paranagama", "Diyatalawa", "Ella"],
    "Moneragala": ["Moneragala", "Bibile", "Wellawaya", "Kataragama", "Buttala", "Siyambalanduwa", "Medagama", "Badalkumbura"]
  },
  "Sabaragamuwa": {
    "Ratnapura": ["Ratnapura", "Pelmadulla", "Balangoda", "Embilipitiya", "Kahawatta", "Rakwana", "Kuruwita", "Eheliyagoda", "Nivithigala", "Ayagama"],
    "Kegalle": ["Kegalle", "Mawanella", "Rambukkana", "Warakapola", "Ruwanwella", "Yatiyantota", "Deraniyagala", "Galigamuwa", "Aranayaka"]
  }
};

// Expose it globally if used in browser
if (typeof window !== 'undefined') {
  window.SRI_LANKA_LOCATIONS = SRI_LANKA_LOCATIONS;
}

// Export it for Node.js backend if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SRI_LANKA_LOCATIONS;
}
