const {
  sendResponse,
  createError,
  parseFilters,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const {
  createRazorpay,
  findRazorpayById,
  findAllRazorpay,
  updateRazorpay,
  deleteRazorpay,
} = require("../../patient-management-system-shared-models/apps/razerpay");

const AppModel = require("../../patient-management-system-shared-models/models/app");
const Razorpay = require("../../patient-management-system-shared-models/apps/razerpay/models/razorpay");

// Create Razorpay
const createRazorpayHandler = async (req, res, next) => {
  try {
    const { name, clientId, clientSecret } = req.body;

    checkRequired({ name, clientId, clientSecret });

    const razorpay = await createRazorpay({
      name,
      clientId,
      clientSecret,
    });

    await sendResponse(res, razorpay, { name: "RazorpayCreated_201" });
  } catch (err) {
    next(err);
  }
};

// Get all Razorpay configs
const getAllRazorpayHandler = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllRazorpay({ companyID: undefined }),
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

// Get single Razorpay config
const getRazorpayHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findRazorpayById(id);
    if (!doc) await createError({ name: "RazorpayNotFound_404" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

// Update Razorpay config
const updateRazorpayHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isDefault, name, clientId, clientSecret } = req.body;

    if (isDefault) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        { defaultRazorpay: id },
      );
    }

    let doc = await findRazorpayById(id);
    if (!doc) await createError({ name: "RazorpayNotFound_404" });
    doc = await updateRazorpay(id, { name, clientId, clientSecret });

    await sendResponse(res, doc, { name: "RazorpayUpdated_200" });
  } catch (err) {
    next(err);
  }
};
// Delete Razorpay config(s)
const deleteRazorpayHandler = async (req, res, next) => {
  try {
    const app = await AppModel.findOne({
      company: undefined,
      defaultRazorpay: { $exists: true },
    });
    const extra = {};
    if (app?.defaultRazorpay) {
      extra._id = { $nin: [app.defaultRazorpay] };
    }
    await bulkDelete({
      model: Razorpay,
      req,
      populate: [],
      error: "NoRazorpaySelected_400",
      extra,
    });
    await sendResponse(res, null, { name: "RazorpayDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRazorpayHandler,
  getAllRazorpayHandler,
  getRazorpayHandler,
  updateRazorpayHandler,
  deleteRazorpayHandler,
};
