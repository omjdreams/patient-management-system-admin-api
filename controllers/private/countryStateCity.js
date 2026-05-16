const countries = require("../../patient-management-system-shared-models/constants/country.json");
const states = require("../../patient-management-system-shared-models/constants/state.json");
const cities = require("../../patient-management-system-shared-models/constants/city.json");
const {
  sendResponse,
} = require("../../patient-management-system-shared-models/utils/utils");

const countryStateCityHandler = async (req, res, next) => {
  try {
    const { country, state } = req.query;
    let result = countries;
    if (state) {
      const selectedState = states.find((s) => s.name === state.trim());
      if (!selectedState) return createError({ name: "StateNotFound_400" });
      result = cities.filter((c) => c.stateCode === selectedState.isoCode);
    } else if (country) {
      const selectedCountry = countries.find((c) => c.name === country.trim());
      if (!selectedCountry) return createError({ name: "CountryNotFound_400" });
      result = states.filter((s) => s.countryCode === selectedCountry.isoCode);
    }
    sendResponse(res, result);
  } catch (err) {
    next(err);
  }
};
module.exports = { countryStateCityHandler };
