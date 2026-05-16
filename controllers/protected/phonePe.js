const {
  sendResponse,
  createError,
  parseFilters,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const AppModel = require("../../patient-management-system-shared-models/models/app");
const {
  createPhonepe,
  findAllPhonepe,
  findPhonepeById,
  deletePhonepe,
  updatePhonepe,
} = require("../../patient-management-system-shared-models/apps/phonepe");
const Phonepe = require("../../patient-management-system-shared-models/apps/phonepe/models/phonepe");

// Create Phonepe
const createPhonepeHandler = async (req, res, next) => {
  try {
    const { name = "", clientId = "", clientSecret = "" } = req.body;

    checkRequired({ name, clientId, clientSecret });

    const phonePe = await createPhonepe({
      name,
      clientId,
      clientSecret,
    });

    await sendResponse(res, phonePe, { name: "PhonepeCreated_201" });
  } catch (err) {
    next(err);
  }
};

// Get all Phonepe configs
const getAllPhonepeHandler = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllPhonepe({ companyID: undefined }),
      query: req.query,
      additionalFilters: {
        companyID: undefined,
      },
    });

    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

// Get single Phonepe config
const getPhonepeHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await findPhonepeById(id);

    if (!doc) await createError({ name: "PhonepeNotFound_404" });

    await sendResponse(res, doc, { name: "PhonepeFetchd_201" });
  } catch (err) {
    next(err);
  }
};

// Update Phonepe config
const updatePhonepeHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isDefault, name, clientId, clientSecret } = req.body;

    if (isDefault) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        { defaultPhonepe: id },
      );
    }

    let doc = await findPhonepeById(id);
    if (!doc) await createError({ name: "PhonepeNotFound_404" });

    doc = await updatePhonepe(id, { name, clientId, clientSecret });

    await sendResponse(res, doc, { name: "PhonepeUpdated_200" });
  } catch (err) {
    next(err);
  }
};

// Delete Phonepe config(s)
const deletePhonepeHandler = async (req, res, next) => {
  try {
    const app = await AppModel.findOne({
      company: undefined,
      defaultPhonepe: { $exists: true },
    });

    const extra = {};
    if (app?.defaultPhonepe) {
      extra._id = { $nin: [app.defaultPhonepe] };
    }

    await bulkDelete({
      model: Phonepe,
      req,
      populate: [],
      error: "NoPhonepeSelected_400",
      extra,
    });
    await sendResponse(res, null, { name: "PhonepeDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPhonepeHandler,
  getAllPhonepeHandler,
  getPhonepeHandler,
  updatePhonepeHandler,
  deletePhonepeHandler,
};
