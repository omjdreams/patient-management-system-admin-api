const fs = require("fs");
const path = require("path");
const {
  SettingModel,
} = require("../../patient-management-system-shared-models/models/setting");
const countries = require("../../patient-management-system-shared-models/constants/country.json");
// MaxMind database reader
let mmdb;
try {
  mmdb = require("mmdb.js");
} catch (error) {
  console.warn(
    "mmdb.js not installed. Geolocation service will not work until installed.",
  );
}

const getCountryFromIP = async (req, res) => {
  try {
    const xff = req.headers["x-forwarded-for"];
    let ip = xff ? xff.split(",")[0].trim() : req.socket.remoteAddress;
    // ip = ip === "::1" ? "102.177.124.0" : ip;

    // console.log("ip is", ip);

    // Check if it's a private IP address
    const isPrivateIP = (ip) => {
      const parts = ip.split(".").map(Number);
      return (
        // 10.0.0.0/8
        parts[0] === 10 ||
        // 172.16.0.0/12
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        // 192.168.0.0/16
        (parts[0] === 192 && parts[1] === 168) ||
        // 127.0.0.0/8 (localhost)
        parts[0] === 127
      );
    };

    // Validate IP format (basic validation)
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip) && ip !== "::1") {
      return res.status(400).json({
        success: false,
        message: "Invalid IP address format",
      });
    }

    // Check for private IP addresses
    if (isPrivateIP(ip) || ip === "::1") {
      return res.status(400).json({
        success: false,
        message:
          "Private IP addresses cannot be geolocated. MaxMind databases only contain public IP addresses.",
        data: {
          ip: ip,
          type: "private",
          explanation:
            "IP addresses like 192.168.x.x, 10.x.x.x, 172.16-31.x.x, and 127.x.x.x are private/local addresses that are not included in geolocation databases.",
        },
      });
    }

    // Fallback to default path if settings not configured
    const dbPath = path.resolve(
      __dirname,
      "../../downloads/GeoLite2-Country.mmdb",
    );

    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      return res.status(503).json({
        success: false,
        message:
          "Geolocation database file not found. Please sync the database.",
        debug: {
          dbPath: dbPath,
        },
      });
    }

    // Check if mmdb.js is available
    if (!mmdb) {
      return res.status(503).json({
        success: false,
        message:
          "Geolocation service requires mmdb.js dependency to be installed. Run: npm install mmdb.js",
        debug: {
          ip: ip,
          dbPath: dbPath,
          dbExists: fs.existsSync(dbPath),
        },
      });
    }

    // Read the MaxMind database
    const db = fs.readFileSync(dbPath);
    const reader = new mmdb.Reader(db);

    // Get country information from IP
    const result = reader.get(ip);
    console.log("result", result);

    if (!result || !result.country) {
      return res.status(404).json({
        success: false,
        message: "Country information not found for this IP address",
        data: {
          ip: ip,
          found: false,
        },
      });
    }
    const details = countries.find(
      (c) =>
        c.iso_code === result.country.iso_code ||
        c.name.toLocaleLowerCase() ===
          result?.country?.names?.en?.toLocaleLowerCase(),
    );
    // Extract country information
    const countryInfo = {
      ip: ip,
      country: {
        iso_code: result.country.iso_code,
        name: result.country.names ? result.country.names.en : null,
        geoname_id: result.country.geoname_id,
        details,
      },
      continent: result.continent
        ? {
            code: result.continent.code,
            name: result.continent.names ? result.continent.names.en : null,
            geoname_id: result.continent.geoname_id,
          }
        : null,
      registered_country: result.registered_country
        ? {
            iso_code: result.registered_country.iso_code,
            name: result.registered_country.names
              ? result.registered_country.names.en
              : null,
            geoname_id: result.registered_country.geoname_id,
          }
        : null,
      // Add city information if available (for City databases)
      city: result.city
        ? {
            name: result.city.names ? result.city.names.en : null,
            geoname_id: result.city.geoname_id,
          }
        : null,
      // Add location information if available
      location: result.location
        ? {
            latitude: result.location.latitude,
            longitude: result.location.longitude,
            time_zone: result.location.time_zone,
            accuracy_radius: result.location.accuracy_radius,
          }
        : null,
    };

    return res.status(200).json({
      success: true,
      message: "Country information retrieved successfully",
      data: countryInfo,
    });
  } catch (error) {
    console.error("Error in getCountryFromIP:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while processing geolocation request",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

module.exports = {
  getCountryFromIP,
};
