/** African countries for registration: ISO2 for flag emoji, ITU dial, display name */
export type AfricanCountry = { name: string; dial: string; iso2: string };

/** Unicode flag from ISO 3166-1 alpha-2 (e.g. RW → 🇷🇼). Works in modern browsers/OS. */
export function flagEmoji(iso2: string): string {
  const s = iso2.trim().toUpperCase();
  if (s.length !== 2 || !/^[A-Z]{2}$/u.test(s)) return "";
  const base = 0x1f1e6; // Regional Indicator Symbol Letter A
  return String.fromCodePoint(
    base + s.charCodeAt(0) - 65,
    base + s.charCodeAt(1) - 65,
  );
}

export const AFRICAN_COUNTRIES: AfricanCountry[] = [
  { name: "Algeria", dial: "+213", iso2: "DZ" },
  { name: "Angola", dial: "+244", iso2: "AO" },
  { name: "Benin", dial: "+229", iso2: "BJ" },
  { name: "Botswana", dial: "+267", iso2: "BW" },
  { name: "Burkina Faso", dial: "+226", iso2: "BF" },
  { name: "Burundi", dial: "+257", iso2: "BI" },
  { name: "Cameroon", dial: "+237", iso2: "CM" },
  { name: "Cape Verde", dial: "+238", iso2: "CV" },
  { name: "Central African Republic", dial: "+236", iso2: "CF" },
  { name: "Chad", dial: "+235", iso2: "TD" },
  { name: "Comoros", dial: "+269", iso2: "KM" },
  { name: "Côte d'Ivoire", dial: "+225", iso2: "CI" },
  { name: "Democratic Republic of the Congo", dial: "+243", iso2: "CD" },
  { name: "Djibouti", dial: "+253", iso2: "DJ" },
  { name: "Egypt", dial: "+20", iso2: "EG" },
  { name: "Equatorial Guinea", dial: "+240", iso2: "GQ" },
  { name: "Eritrea", dial: "+291", iso2: "ER" },
  { name: "Eswatini", dial: "+268", iso2: "SZ" },
  { name: "Ethiopia", dial: "+251", iso2: "ET" },
  { name: "Gabon", dial: "+241", iso2: "GA" },
  { name: "Gambia", dial: "+220", iso2: "GM" },
  { name: "Ghana", dial: "+233", iso2: "GH" },
  { name: "Guinea", dial: "+224", iso2: "GN" },
  { name: "Guinea-Bissau", dial: "+245", iso2: "GW" },
  { name: "Kenya", dial: "+254", iso2: "KE" },
  { name: "Lesotho", dial: "+266", iso2: "LS" },
  { name: "Liberia", dial: "+231", iso2: "LR" },
  { name: "Libya", dial: "+218", iso2: "LY" },
  { name: "Madagascar", dial: "+261", iso2: "MG" },
  { name: "Malawi", dial: "+265", iso2: "MW" },
  { name: "Mali", dial: "+223", iso2: "ML" },
  { name: "Mauritania", dial: "+222", iso2: "MR" },
  { name: "Mauritius", dial: "+230", iso2: "MU" },
  { name: "Morocco", dial: "+212", iso2: "MA" },
  { name: "Mozambique", dial: "+258", iso2: "MZ" },
  { name: "Namibia", dial: "+264", iso2: "NA" },
  { name: "Niger", dial: "+227", iso2: "NE" },
  { name: "Nigeria", dial: "+234", iso2: "NG" },
  { name: "Republic of the Congo", dial: "+242", iso2: "CG" },
  { name: "Rwanda", dial: "+250", iso2: "RW" },
  { name: "São Tomé and Príncipe", dial: "+239", iso2: "ST" },
  { name: "Senegal", dial: "+221", iso2: "SN" },
  { name: "Seychelles", dial: "+248", iso2: "SC" },
  { name: "Sierra Leone", dial: "+232", iso2: "SL" },
  { name: "Somalia", dial: "+252", iso2: "SO" },
  { name: "South Africa", dial: "+27", iso2: "ZA" },
  { name: "South Sudan", dial: "+211", iso2: "SS" },
  { name: "Sudan", dial: "+249", iso2: "SD" },
  { name: "Tanzania", dial: "+255", iso2: "TZ" },
  { name: "Togo", dial: "+228", iso2: "TG" },
  { name: "Tunisia", dial: "+216", iso2: "TN" },
  { name: "Uganda", dial: "+256", iso2: "UG" },
  { name: "Zambia", dial: "+260", iso2: "ZM" },
  { name: "Zimbabwe", dial: "+263", iso2: "ZW" },
].sort((a, b) => a.name.localeCompare(b.name));

export function findCountryByName(name: string): AfricanCountry | undefined {
  return AFRICAN_COUNTRIES.find((c) => c.name === name);
}
