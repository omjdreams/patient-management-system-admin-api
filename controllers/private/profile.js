const AdminModel = require("../../patient-management-system-shared-models/models/admin");
const {
  sendResponse,
  createError,
} = require("../../patient-management-system-shared-models/utils/utils");

const getAdminProfile = async (req, res, next) => {
  try {
    const { admin } = req;
    delete admin.password;
    sendResponse(res, admin);
  } catch (error) {
    next(error);
  }
};

const updateAdminProfile = async (req, res, next) => {
  try {
    const { name, phone, isTwoFactorAuth, preferences } = req.body;

    const updateAdminProfile = await AdminModel.findByIdAndUpdate(
      req.admin._id,
      { name, phone, isTwoFactorAuth, preferences },
      { new: true },
    );

    if (!updateAdminProfile) await createError({ key: "049" });

    sendResponse(res, updateAdminProfile, { key: "048" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminProfile, updateAdminProfile };
