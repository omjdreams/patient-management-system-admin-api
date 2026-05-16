const {
  findAllManualPayment,
  findManualPaymentById,
  createManualPayment,
  updateManualPayment,
  deleteManualPayment,
} = require("../../patient-management-system-shared-models/apps/manual-payment");

const {
  applyQueryOptions,
  sendResponse,
  createError,
  parseFilters,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const ManualPaymentRequest = require("../../patient-management-system-shared-models/apps/manual-payment/models/ManualPaymentRequest");
const {
  paymentSuccessInvoiceEmail,
} = require("../../patient-management-system-shared-models/utils/helper");
const Subscription = require("../../patient-management-system-shared-models/models/subscription");
const getAllManualPaymentHandler = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllManualPayment({ companyID: null }),
      query: req.query,
      additionalFilters: {
        companyID: null,
      },
    });

    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};
const getManualPaymentHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findManualPaymentById(id);
    // console.log("doc is", doc);
    if (!doc) await createError({ name: "ManualPaymentNotFound_404" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};
const createManualPaymentHandler = async (req, res, next) => {
  try {
    const { name, details, isActive, qrCode } = req.body;
    checkRequired({ name, details });
    const doc = await createManualPayment({ name, details, isActive, qrCode });
    if (!doc) await createError({ name: "ManualPaymentNotFound_404" });

    await sendResponse(res, doc, { name: "ManualPaymentCreated_200" });
  } catch (err) {
    next(err);
  }
};
const updateManualPaymentHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, details, isActive, qrCode, isDefault } = req.body;
    let doc = await findManualPaymentById(id);
    if (!doc) await createError({ name: "ManualPaymentNotFound_404" });
    doc = await updateManualPayment(id, { name, details, isActive, qrCode });
    if (isDefault) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultManualPayment: {
            app: id,
            isGlobal: true,
          },
        },
      );
    }

    await sendResponse(res, doc, { name: "ManualPaymentUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const deleteManualPaymentHandler = async (req, res, next) => {
  try {
    await bulkDelete({
      model: ManualPaymentRequest,
      req,
      populate: [],
      error: "NoManualPaymentSelected_400",
    });
    await sendResponse(res, null, { name: "ManualPaymentDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createManualPaymentHandler,
  getAllManualPaymentHandler,
  getManualPaymentHandler,
  updateManualPaymentHandler,
  deleteManualPaymentHandler,
};
