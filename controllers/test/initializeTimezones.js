const mongoose = require("mongoose");
const timezonesData = require("../../patient-management-system-shared-models/constants/timezones.json");
const { initializeTimezonesFunction } = require("../protected/timezone");

/**
 * Validate timezone data before processing
 */
const validateTimezoneData = (timezones) => {
  const errors = [];

  timezones.forEach((tz, index) => {
    if (!tz.value) errors.push(`Index ${index}: Missing 'value' field`);
    if (!tz.abbr) errors.push(`Index ${index}: Missing 'abbr' field`);
    if (tz.offset === undefined || tz.offset === null)
      errors.push(`Index ${index}: Missing 'offset' field`);
    if (tz.isdst === undefined || tz.isdst === null)
      errors.push(`Index ${index}: Missing 'isdst' field`);
    if (!tz.text && !tz.option)
      errors.push(`Index ${index}: Missing both 'text' and 'option' fields`);
    if (!Array.isArray(tz.utc))
      errors.push(`Index ${index}: 'utc' field should be an array`);
  });

  return errors;
};

/**
 * Initialize timezones from the new comprehensive timezone data
 */
const initializeTimezonesFromFile = async (
  clearExisting = false,
  updateExisting = true,
) => {
  try {
    console.log("Starting timezone initialization...");
    console.log(`Found ${timezonesData.length} timezones to process`);

    // Validate data first
    console.log("Validating timezone data...");
    const validationErrors = validateTimezoneData(timezonesData);

    if (validationErrors.length > 0) {
      console.error("Validation errors found:");
      validationErrors.forEach((error) => console.error(`- ${error}`));
      throw new Error(
        `Data validation failed with ${validationErrors.length} errors`,
      );
    }

    console.log("Data validation passed. Proceeding with initialization...");

    const result = await initializeTimezonesFunction(
      timezonesData,
      {
        clearExisting: clearExisting,
        updateExisting: updateExisting,
      },
      () => {},
    );

    console.log("\n=== Timezone Initialization Results ===");
    console.log(`✅ Created: ${result?.created} new timezones`);
    console.log(`🔄 Updated: ${result?.updated} existing timezones`);
    console.log(`⏭️ Skipped: ${result?.skipped} timezones`);
    console.log(`❌ Errors: ${result?.errors?.length} errors`);

    if (result?.errors?.length > 0) {
      console.log("\nErrors encountered:");
      result.errors.forEach((error) => {
        console.log(`- ${error.timezone}: ${error.error}`);
      });
    }

    return result;
  } catch (error) {
    console.error("Failed to initialize timezones:", error);
    throw error;
  }
};

module.exports = {
  initializeTimezonesFromFile,
  validateTimezoneData,
};
