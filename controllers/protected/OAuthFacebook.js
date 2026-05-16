const {
  createFacebookOAuthApp,
  findAllFacebookOAuthApps,
  findFacebookOAuthAppById,
  updateFacebookOAuthApp,
} = require("../../patient-management-system-shared-models/apps/oAuthFacebook");
const FacebookOAuthApp = require("../../patient-management-system-shared-models/apps/oAuthFacebook/models/app");
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

const createOAuthFacebook = async (req, res, next) => {
  try {
    const { appId, secret, isDefault, name } = req.body;

    checkRequired({
      name,
      appId,
      secret,
    });

    const doc = await createFacebookOAuthApp({
      name,
      appId,
      secret,
      companyID: null,
    });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const getAllOAuthFacebooks = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllFacebookOAuthApps({ companyID: undefined }),
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

const getOAuthFacebook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await findFacebookOAuthAppById(id, null);

    if (!doc) {
      throw createHttpError("Facebook OAuth configuration not found.", 404);
    }

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updateOAuthFacebook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { appID, appId, secret, isDefault } = req.body;

    const existingDoc = await findFacebookOAuthAppById(id, null);
    if (!existingDoc) {
      throw createHttpError("Facebook OAuth configuration not found.", 404);
    }

    const payload = {};
    const resolvedAppID = appID || appId;

    if (resolvedAppID !== undefined) {
      payload.appID = resolvedAppID.toString().trim();
      checkRequired({ appID: payload.appID });
    }

    if (secret !== undefined) {
      payload.secret = secret.toString().trim();
      checkRequired({ secret: payload.secret });
    }

    let updatedDoc = existingDoc;
    if (Object.keys(payload).length > 0) {
      updatedDoc = await updateFacebookOAuthApp(id, payload, null);
    }
    if (isDefault) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultFacebookOAuthApp: {
            app: id,
          },
        },
      );
    }

    await sendResponse(res, updatedDoc);
  } catch (err) {
    next(err);
  }
};

const deleteOAuthFacebook = async (req, res, next) => {
  try {
    await bulkDelete({
      model: FacebookOAuthApp,
      req,
      populate: [],
      error: "NoFacebookOAuthAppSelected_400",
    });
    await sendResponse(res, null, { name: "FacebookOAuthAppDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOAuthFacebook,
  getAllOAuthFacebooks,
  getOAuthFacebook,
  updateOAuthFacebook,
  deleteOAuthFacebook,
};
