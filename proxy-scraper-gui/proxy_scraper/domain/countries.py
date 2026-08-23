"""ISO 3166-1 alpha-2 country data for the searchable country selector.

Provides a mapping of country code -> country name and helpers used by both
the geolocation service (name lookups) and the presentation layer (populating
the searchable country selector, Requirement 6.1).
"""

from __future__ import annotations

# A broad (not exhaustive) list of ISO 3166-1 alpha-2 codes and names covering
# the countries most commonly seen in free-proxy lists.
COUNTRIES: dict[str, str] = {
    "AF": "Afghanistan", "AL": "Albania", "DZ": "Algeria", "AR": "Argentina",
    "AM": "Armenia", "AU": "Australia", "AT": "Austria", "AZ": "Azerbaijan",
    "BH": "Bahrain", "BD": "Bangladesh", "BY": "Belarus", "BE": "Belgium",
    "BO": "Bolivia", "BA": "Bosnia and Herzegovina", "BR": "Brazil",
    "BG": "Bulgaria", "KH": "Cambodia", "CM": "Cameroon", "CA": "Canada",
    "CL": "Chile", "CN": "China", "CO": "Colombia", "CR": "Costa Rica",
    "HR": "Croatia", "CY": "Cyprus", "CZ": "Czechia", "DK": "Denmark",
    "DO": "Dominican Republic", "EC": "Ecuador", "EG": "Egypt",
    "SV": "El Salvador", "EE": "Estonia", "ET": "Ethiopia", "FI": "Finland",
    "FR": "France", "GE": "Georgia", "DE": "Germany", "GH": "Ghana",
    "GR": "Greece", "GT": "Guatemala", "HN": "Honduras", "HK": "Hong Kong",
    "HU": "Hungary", "IS": "Iceland", "IN": "India", "ID": "Indonesia",
    "IR": "Iran", "IQ": "Iraq", "IE": "Ireland", "IL": "Israel", "IT": "Italy",
    "JM": "Jamaica", "JP": "Japan", "JO": "Jordan", "KZ": "Kazakhstan",
    "KE": "Kenya", "KR": "South Korea", "KW": "Kuwait", "KG": "Kyrgyzstan",
    "LA": "Laos", "LV": "Latvia", "LB": "Lebanon", "LY": "Libya",
    "LT": "Lithuania", "LU": "Luxembourg", "MK": "North Macedonia",
    "MY": "Malaysia", "MV": "Maldives", "MT": "Malta", "MX": "Mexico",
    "MD": "Moldova", "MN": "Mongolia", "ME": "Montenegro", "MA": "Morocco",
    "MM": "Myanmar", "NP": "Nepal", "NL": "Netherlands", "NZ": "New Zealand",
    "NG": "Nigeria", "NO": "Norway", "OM": "Oman", "PK": "Pakistan",
    "PS": "Palestine", "PA": "Panama", "PY": "Paraguay", "PE": "Peru",
    "PH": "Philippines", "PL": "Poland", "PT": "Portugal", "QA": "Qatar",
    "RO": "Romania", "RU": "Russia", "SA": "Saudi Arabia", "RS": "Serbia",
    "SG": "Singapore", "SK": "Slovakia", "SI": "Slovenia", "ZA": "South Africa",
    "ES": "Spain", "LK": "Sri Lanka", "SD": "Sudan", "SE": "Sweden",
    "CH": "Switzerland", "SY": "Syria", "TW": "Taiwan", "TJ": "Tajikistan",
    "TZ": "Tanzania", "TH": "Thailand", "TN": "Tunisia", "TR": "Turkey",
    "TM": "Turkmenistan", "UG": "Uganda", "UA": "Ukraine",
    "AE": "United Arab Emirates", "GB": "United Kingdom", "US": "United States",
    "UY": "Uruguay", "UZ": "Uzbekistan", "VE": "Venezuela", "VN": "Vietnam",
    "YE": "Yemen", "ZM": "Zambia", "ZW": "Zimbabwe",
}


def country_name_for_code(code: str) -> str:
    """Return the country name for an alpha-2 code, or the code itself."""
    if not code:
        return "Unknown"
    return COUNTRIES.get(code.upper(), code.upper())


def sorted_countries() -> list[tuple[str, str]]:
    """Return ``(code, name)`` tuples sorted by country name for the selector."""
    return sorted(COUNTRIES.items(), key=lambda kv: kv[1])
