const {
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
} = require("../../patient-management-system-shared-models/utils/utils");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);
const tar = require("tar");
const SettingModel = require("../../patient-management-system-shared-models/models/setting");
const Timezone = require("../../patient-management-system-shared-models/models/timezone");
// Initialize Timezones
const initializeTimezonesController = async (req, res, next) => {
  try {
    const admin = req.admin;
    const {
      timezonesData,
      clearExisting = false,
      updateExisting = true,
    } = req.body;

    if (!timezonesData || !Array.isArray(timezonesData)) {
      await createError({
        name: "ValidationError",
        message: "timezonesData array is required",
      });
    }

    console.log(`Admin ${admin.email} initiated timezone initialization`);

    const result = await initializeTimezones(timezonesData, {
      clearExisting,
      updateExisting,
    });

    await sendResponse(res, result, {
      name: "TimezonesInitialized_200",
      defaults: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get All Timezones
const getAllTimezonesController = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllTimezones(),
      query: req.query,
    });

    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

// Search Timezones
const searchTimezonesController = async (req, res, next) => {
  try {
    const { searchTerm, companyId } = req.query;

    if (!searchTerm) {
      await createError({
        name: "ValidationError",
        message: "searchTerm is required",
      });
    }

    const timezones = await searchTimezones(searchTerm, companyId);

    await sendResponse(res, timezones);
  } catch (err) {
    next(err);
  }
};

// Get Timezones by Offset Range
const getTimezonesByOffsetController = async (req, res, next) => {
  try {
    const { minOffset, maxOffset, companyId } = req.query;

    if (minOffset === undefined || maxOffset === undefined) {
      await createError({
        name: "ValidationError",
        message: "minOffset and maxOffset are required",
      });
    }
    const timezones = await getTimezonesByOffsetRange(
      Number(minOffset),
      Number(maxOffset),
      companyId,
    );

    await sendResponse(res, timezones);
  } catch (err) {
    next(err);
  }
};

// Create Timezone
const createTimezoneController = async (req, res, next) => {
  try {
    const admin = req.admin;
    const {
      value,
      abbr,
      offset,
      isdst,
      text,
      utc,
      companyId = null,
    } = req.body;

    checkRequired({ value, abbr, offset, text });

    const payload = {
      value: value?.trim(),
      abbr: abbr?.trim(),
      offset: Number(offset),
      isdst: Boolean(isdst),
      text: text?.trim(),
      utc: utc || [],
      companyId,
      createdBy: admin._id,
      updatedBy: admin._id,
    };

    const timezone = await createTimezone(payload);
    await sendResponse(res, timezone, { name: "TimezoneCreated_200" });
  } catch (err) {
    next(err);
  }
};

// Update Timezone
const updateTimezoneController = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const { value, abbr, offset, isdst, text, utc, isActive } = req.body;

    const existingTimezone = await findTimezoneById(id);
    if (!existingTimezone) {
      await createError({ name: "TimezoneNotFound_400" });
    }

    const payload = {};
    if (value !== undefined) payload.value = value.trim();
    if (abbr !== undefined) payload.abbr = abbr.trim();
    if (offset !== undefined) payload.offset = Number(offset);
    if (isdst !== undefined) payload.isdst = Boolean(isdst);
    if (text !== undefined) payload.text = text.trim();
    if (utc !== undefined) payload.utc = utc;
    if (isActive !== undefined) payload.isActive = Boolean(isActive);
    payload.updatedBy = admin._id;

    const updatedTimezone = await updateTimezone(id, payload);
    await sendResponse(res, updatedTimezone, { name: "TimezoneUpdated_200" });
  } catch (err) {
    next(err);
  }
};

// Delete Timezone(s)
const deleteTimezoneController = async (req, res, next) => {
  try {
    const { ids = [], selectAll = false, filters = {} } = req.body;

    if (!Array.isArray(ids) && !selectAll) {
      await createError({
        name: "ValidationError",
        message: "ids must be an array or selectAll must be true",
      });
    }

    let deleteFilter;
    if (selectAll) {
      deleteFilter = { ...filters };
    } else {
      deleteFilter = { _id: { $in: ids } };
    }

    const result = await deleteTimezone(deleteFilter);
    await sendResponse(res, result, { name: "TimezonesDeleted_200" });
  } catch (err) {
    next(err);
  }
};

// Get Single Timezone
const getTimezoneController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const timezone = await findTimezoneById(id);
    if (!timezone) {
      await createError({ name: "TimezoneNotFound_400" });
    }

    await sendResponse(res, timezone);
  } catch (err) {
    next(err);
  }
};

const downloadGeoIP2Controller = async (req, res, next) => {
  try {
    let { accountId, licenseKey, databaseType } = req.body || {};

    // If credentials not provided in body, read from global settings
    if (!accountId || !licenseKey) {
      const settings = await SettingModel.findOne({
        company: undefined,
      }).lean();
      if (settings && settings.maxmind) {
        accountId = accountId || settings.maxmind.accountId;
        licenseKey = licenseKey || settings.maxmind.licenseKey;
        databaseType =
          databaseType || settings.maxmind.databaseType || "GeoLite2-Country";
      }
    }

    databaseType = databaseType || "GeoLite2-Country";

    if (!accountId || !licenseKey) {
      throw new Error(
        "Account ID and License Key are required (set them in MMDB settings or pass in request)",
      );
    }

    // Supported database URLs (extendable)
    const databaseUrls = {
      "GeoLite2-Country": `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${licenseKey}&suffix=tar.gz`,
      "GeoIP2-Country": `https://download.maxmind.com/app/geoip_download?edition_id=GeoIP2-Country&license_key=${licenseKey}&suffix=tar.gz`,
    };

    const downloadUrl = databaseUrls[databaseType];
    if (!downloadUrl) {
      throw new Error(
        `Unsupported database type: ${databaseType}. Supported types: ${Object.keys(
          databaseUrls,
        ).join(", ")}`,
      );
    }

    // Create downloads directory
    const downloadsDir = path.join(__dirname, "../../downloads");
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const archiveFilePath = path.join(downloadsDir, `${databaseType}.tar.gz`);
    const finalMmdbPath = path.join(downloadsDir, `${databaseType}.mmdb`);

    console.log(`Downloading MaxMind ${databaseType} database...`);

    // Curl command to download securely
    const curlCommand = `curl -L -f --silent --show-error -u "${accountId}:${licenseKey}" -o "${archiveFilePath}" "${downloadUrl}" -w "%{http_code}"`;

    const { stdout } = await execAsync(curlCommand);
    const httpCode = stdout.trim();

    if (httpCode !== "200") {
      throw new Error(`HTTP ${httpCode} - failed to download database`);
    }

    if (!fs.existsSync(archiveFilePath)) {
      throw new Error("Download failed - archive file not found");
    }

    // Validate tar.gz file signature (starts with 0x1f 0x8b for gzip)
    const fileBuffer = fs.readFileSync(archiveFilePath);
    const gzipSignature = Buffer.from([0x1f, 0x8b]);
    if (!fileBuffer.slice(0, 2).equals(gzipSignature)) {
      // Check if it might be an error response
      const fileStart = fileBuffer.slice(0, 100).toString("utf8");
      if (fileStart.includes("<html") || fileStart.includes("<!DOCTYPE")) {
        throw new Error(
          "Authentication failed. Received HTML error page instead of database file. Please check your MaxMind credentials.",
        );
      } else {
        throw new Error("Downloaded file is not a valid gzipped archive");
      }
    }

    // Extract tar.gz file
    const extractDir = path.join(downloadsDir, "extracted");
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    // Extract tar.gz file using node tar (cross-platform)
    await tar.x({ file: archiveFilePath, cwd: extractDir });

    // Locate .mmdb file
    const findMmdbFile = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const f of files) {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) {
          const nested = findMmdbFile(full);
          if (nested) return nested;
        } else if (f.name.endsWith(".mmdb")) {
          return full;
        }
      }
      return null;
    };

    const mmdbFile = findMmdbFile(extractDir);
    if (!mmdbFile) throw new Error(".mmdb file not found in extracted archive");

    fs.copyFileSync(mmdbFile, finalMmdbPath);
    const stats = fs.statSync(finalMmdbPath);

    console.log(`✅ ${databaseType} downloaded successfully: ${finalMmdbPath}`);

    // Update settings with last sync and mmdb path
    try {
      const settingsDoc = await SettingModel.findOne({ company: undefined });
      if (settingsDoc) {
        settingsDoc.maxmind = settingsDoc.maxmind || {};
        settingsDoc.maxmind.lastSyncAt = new Date();
        settingsDoc.maxmind.mmdbPath = finalMmdbPath;
        await settingsDoc.save();
      }
    } catch (settingsErr) {
      console.error("Failed to update settings with mmdb info:", settingsErr);
    }

    res.json({
      success: true,
      databaseType,
      filePath: finalMmdbPath,
      fileSize: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
      downloadedAt: new Date().toISOString(),
    });

    // Cleanup
    setTimeout(() => {
      try {
        if (fs.existsSync(archiveFilePath)) fs.unlinkSync(archiveFilePath);
        if (fs.existsSync(extractDir))
          fs.rmSync(extractDir, { recursive: true, force: true });
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    }, 5000);
  } catch (err) {
    console.error("GeoIP2 Country download error:", err);
    next(err);
  }
};

/**
 * Create a new timezone
 */
const createTimezone = async (payload) => {
  const timezone = await Timezone.create(payload);
  return timezone;
};

/**
 * Find all timezones with optional filters
 */
const findAllTimezones = async (
  filter = {},
  sort = { offset: 1, option: 1 },
  limit,
  skip,
) => {
  const q = Timezone.find(filter).sort(sort);
  if (typeof skip !== "undefined") q.skip(Number(skip));
  if (typeof limit !== "undefined") q.limit(Number(limit));
  const items = await q.lean();
  return items;
};

/**
 * Find timezone by ID
 */
const findTimezoneById = async (id) => {
  const timezone = await Timezone.findById(id);
  return timezone;
};

/**
 * Update timezone
 */
const updateTimezone = async (id, payload) => {
  const timezone = await Timezone.findByIdAndUpdate(id, payload, { new: true });
  return timezone;
};

/**
 * Delete timezone(s)
 */
const deleteTimezone = async (idOrFilters) => {
  let filter;

  if (
    typeof idOrFilters === "object" &&
    idOrFilters !== null &&
    !idOrFilters._bsontype
  ) {
    // It's a filters object for bulk delete
    filter = idOrFilters;
    const result = await Timezone.deleteMany(filter);
    return result;
  } else {
    // It's an id for single delete
    const result = await Timezone.findByIdAndDelete(idOrFilters);
    return result;
  }
};

/**
 * Initialize global timezones from provided data
 */
const initializeTimezones = async (timezonesData, options = {}) => {
  try {
    const { clearExisting = false, updateExisting = true } = options;

    // Clear existing global timezones if requested
    if (clearExisting) {
      console.log("Clearing existing global timezones...");
      await Timezone.deleteMany();
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    console.log(`Processing ${timezonesData.length} timezone records...`);

    for (const tzData of timezonesData) {
      try {
        // Validate required fields
        if (
          !tzData.value ||
          !tzData.abbr ||
          tzData.offset === undefined ||
          tzData.isdst === undefined
        ) {
          throw new Error(
            `Missing required fields: value=${tzData.value}, abbr=${tzData.abbr}, offset=${tzData.offset}, isdst=${tzData.isdst}`,
          );
        }

        if (!tzData.text && !tzData.option) {
          throw new Error(`Missing text/option field`);
        }

        // Transform the data to match our schema
        const payload = {
          value: tzData.value,
          abbr: tzData.abbr,
          offset: tzData.offset,
          isdst: tzData.isdst,
          text: tzData.text || tzData.option, // Handle both 'option' and 'text' fields
          utc: tzData.utc || [],
        };

        // Check if timezone already exists
        const existing = await Timezone.findOne({
          value: tzData.value,
        });

        if (existing) {
          if (updateExisting) {
            await Timezone.findByIdAndUpdate(existing._id, payload);
            results.updated++;
            console.log(`✓ Updated timezone: ${tzData.value}`);
          } else {
            results.skipped++;
            console.log(`⏭️ Skipped existing timezone: ${tzData.value}`);
          }
        } else {
          await Timezone.create(payload);
          results.created++;
          console.log(`✅ Created timezone: ${tzData.value}`);
        }
      } catch (error) {
        results.errors.push({
          timezone: tzData.value,
          error: error.message,
        });
        console.error(
          `Error processing timezone ${tzData.value}:`,
          error.message,
        );
      }
    }

    console.log("Timezone initialization completed:");
    console.log(`Created: ${results.created}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Errors: ${results.errors.length}`);

    return results;
  } catch (error) {
    console.error("Error initializing timezones:", error);
    throw error;
  }
};

/**
 * Get timezones by offset range
 */
const getTimezonesByOffsetRange = async (
  minOffset,
  maxOffset,
  companyId = null,
) => {
  const filter = {
    offset: { $gte: minOffset, $lte: maxOffset },
    isActive: true,
  };

  if (companyId) {
    filter.$or = [{ companyId: companyId }, { companyId: null }];
  } else {
    filter.companyId = null;
  }

  return await Timezone.find(filter).sort({ offset: 1, option: 1 });
};

/**
 * Search timezones by text
 */
const searchTimezones = async (searchTerm, companyId = null) => {
  return await Timezone.searchTimezones(searchTerm, companyId);
};
module.exports = {
  initializeTimezones: initializeTimezonesController,
  initializeTimezonesFunction: initializeTimezones,
  getAllTimezones: getAllTimezonesController,
  searchTimezones: searchTimezonesController,
  getTimezonesByOffset: getTimezonesByOffsetController,
  createTimezone: createTimezoneController,
  updateTimezone: updateTimezoneController,
  deleteTimezone: deleteTimezoneController,
  getTimezone: getTimezoneController,
  downloadGeoIP2: downloadGeoIP2Controller,
};
