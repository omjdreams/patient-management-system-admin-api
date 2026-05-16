const {
  getAdminNotificationReport,
  getDownloadSheets,
  getDownloadRows,
  sendAdminNotificationReport,
} = require("../../patient-management-system-shared-models/utils/adminNotificationReports");
const {
  sendResponse,
} = require("../../patient-management-system-shared-models/utils/utils");

const getAdminNotificationReportController = async (req, res, next) => {
  try {
    const { reportType, period, startDate, endDate, email } = req.query;
    const recipients = Array.isArray(req.query.recipients)
      ? req.query.recipients
      : req.query.recipients
        ? [req.query.recipients]
        : [];

    if (email === "true") {
      const result = await sendAdminNotificationReport({
        reportType,
        period,
        startDate,
        endDate,
        recipients,
      });
      await sendResponse(res, result, {
        name: "AdminReportSent_200",
      });
      return;
    }

    const report = await getAdminNotificationReport({
      reportType,
      period,
      startDate,
      endDate,
    });

    await sendResponse(res, {
      ...report,
      downloadRows: getDownloadRows(report),
      downloadSheets: getDownloadSheets(report),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminNotificationReportController,
};
