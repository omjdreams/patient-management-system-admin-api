const CouponModel = require("../../patient-management-system-shared-models/models/coupon");
const SettingModel = require("../../patient-management-system-shared-models/models/setting");
const {
  createError,
  sendResponse,
} = require("../../patient-management-system-shared-models/utils/utils");

const getDeveloperSettings = async (req, res, next) => {
  try {
    const doc = await SettingModel.findOne({ company: undefined }).lean();

    if (!doc) await createError({ name: "SettingNotFound_400" });

    await sendResponse(res, doc.developerSettings);
  } catch (err) {
    next(err);
  }
};

// Update Coupon
const updateDeveloperSettings = async (req, res, next) => {
  try {
    const admin = req.admin;

    const doc = await SettingModel.findOne({ company: undefined });
    if (!doc) await createError({ name: "SettingNotFound_400" });
    if (!doc.developerMode)
      await createError({ name: "DeveloperModeDisabled_400" });
    Object.entries({
      invoicePrefix: "invoicePrefix",
    }).forEach(([key, value]) => {
      if (req.body[key] !== undefined)
        doc.developerSettings[value] = req.body[key];
    });

    doc.updatedBy = admin._id;

    await doc.save();
    await sendResponse(res, doc, { name: "SettingsUpdated_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDeveloperSettings,
  updateDeveloperSettings,
};
