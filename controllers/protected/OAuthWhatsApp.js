const {
  createWhatsAppOAuthApp,
  findAllWhatsAppOAuthApps,
  findWhatsAppOAuthAppById,
  updateWhatsAppOAuthApp,
} = require("../../patient-management-system-shared-models/apps/oAuthWhatsApp");
const WhatsAppOAuthApp = require("../../patient-management-system-shared-models/apps/oAuthWhatsApp/models/app");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const {
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const createHttpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const createOAuthWhatsApp = async (req, res, next) => {
  try {
    const {
      name,
      appId,
      appSecret,
      configurationId,
      systemUserAccessToken,
      systemUserId,
      businessId,
      webhookFields,
    } = req.body;

    checkRequired({
      name,
      appId,
      appSecret,
      configurationId,
    });

    const doc = await createWhatsAppOAuthApp({
      name,
      appId,
      appSecret,
      configurationId,
      systemUserAccessToken,
      systemUserId,
      businessId,
      webhookFields,
      companyID: null,
    });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const getAllOAuthWhatsApps = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllWhatsAppOAuthApps({
        $or: [{ companyID: { $exists: false } }, { companyID: null }],
      }),
      query: req.query,
    });

    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const getOAuthWhatsApp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await findWhatsAppOAuthAppById(id);

    if (!doc) {
      throw createHttpError("WhatsApp OAuth configuration not found.", 404);
    }

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updateOAuthWhatsApp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      appId,
      appSecret,
      configurationId,
      systemUserAccessToken,
      systemUserId,
      businessId,
      webhookFields,
      isDefault,
    } = req.body;

    const existingDoc = await findWhatsAppOAuthAppById(id);
    if (!existingDoc) {
      throw createHttpError("WhatsApp OAuth configuration not found.", 404);
    }

    const payload = {};

    if (name !== undefined) payload.name = `${name}`.trim();
    if (appId !== undefined) payload.appId = `${appId}`.trim();
    if (appSecret !== undefined) payload.appSecret = `${appSecret}`.trim();
    if (configurationId !== undefined) {
      payload.configurationId = `${configurationId}`.trim();
    }
    if (systemUserAccessToken !== undefined) {
      payload.systemUserAccessToken = `${systemUserAccessToken}`.trim();
    }
    if (systemUserId !== undefined)
      payload.systemUserId = `${systemUserId}`.trim();
    if (businessId !== undefined) payload.businessId = `${businessId}`.trim();
    if (webhookFields !== undefined) {
      payload.webhookFields = `${webhookFields}`.trim();
    }

    if (payload.name !== undefined) checkRequired({ name: payload.name });
    if (payload.appId !== undefined) checkRequired({ appId: payload.appId });
    if (payload.appSecret !== undefined) {
      checkRequired({ appSecret: payload.appSecret });
    }
    if (payload.configurationId !== undefined) {
      checkRequired({ configurationId: payload.configurationId });
    }

    let updatedDoc = existingDoc;
    if (Object.keys(payload).length > 0) {
      updatedDoc = await updateWhatsAppOAuthApp(id, payload);
    }

    if (isDefault) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultWhatsAppOAuthApp: {
            app: id,
          },
        },
        { upsert: true },
      );
    }

    await sendResponse(res, updatedDoc);
  } catch (err) {
    next(err);
  }
};

const deleteOAuthWhatsApp = async (req, res, next) => {
  try {
    await bulkDelete({
      model: WhatsAppOAuthApp,
      req,
      populate: [],
      error: "NoWhatsAppOAuthAppSelected_400",
    });
    await sendResponse(res, null, { name: "WhatsAppOAuthAppDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOAuthWhatsApp,
  getAllOAuthWhatsApps,
  getOAuthWhatsApp,
  updateOAuthWhatsApp,
  deleteOAuthWhatsApp,
};
