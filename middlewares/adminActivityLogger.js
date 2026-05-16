const ServerLog = require("../patient-management-system-shared-models/models/serverLog");

const adminActivityLogger = (req, res, next) => {
  const userAgent = req.get("User-Agent") || "Unknown";

  // OS detection
  let os = "Unknown";
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Mac")) os = "MacOS";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone")) os = "iOS";

  // Browser detection
  let browser = "Unknown";
  if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome"))
    browser = "Safari";
  else if (userAgent.includes("Edg")) browser = "Edge";

  req.log = new ServerLog({
    level: "info",
    message: `${req.method} ${req.originalUrl}`,
    adminUser: req.admin?._id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    requestBody: req.body,
    isAdminLog: true,
    meta: {
      userAgent: userAgent,
      location: req.ip,
      browser: browser,
      source: { os },
    },
  });

  next();
};

module.exports = adminActivityLogger;
