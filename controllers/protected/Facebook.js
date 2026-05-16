const {
  getFacebookApps,
  getFacebookAppByID,
  createFacebookApp,
  updateFacebookApp,
} = require("../../patient-management-system-shared-models/apps/facebook");
const {
  createOpenAI,
  findAllOpenAI,
  findOpenAIById,
  updateOpenAI,
  deleteOpenAI,
  getAvailableOpenAIModels,
  setDefaultOpenAI,
  getDefaultOpenAI,
} = require("../../patient-management-system-shared-models/apps/openai");
const openai = require("../../patient-management-system-shared-models/apps/openai/models/openai");

const AppModel = require("../../patient-management-system-shared-models/models/app");

const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

/**
 * Create OpenAI Configuration
 */
const createFacebook = async (req, res, next) => {
  const { appId, secret } = req.body;
  checkRequired({ appId, secret });

  const newDoc = await createFacebookApp(undefined, appId, secret, null);

  await sendResponse(res, newDoc, {
    name: "OpenAIConfigurationUpdated_200",
  });
};

/**
 * Get All OpenAI Configurations
 */
const getAllFacebooks = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await getFacebookApps({ companyID: undefined }),
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

/**
 * Get Single OpenAI Configuration
 */
const getFacebook = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await getFacebookAppByID(id, null);

    if (!doc) await createError({ name: "OpenAIConfigurationNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

/**
 * Update OpenAI Configuration
 */
const updateFacebook = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { appID, secret } = req.body;

    const doc = await getFacebookAppByID(id, null);

    if (!doc) await createError({ name: "OpenAIConfigurationNotFound_400" });

    const updatedDoc = await updateFacebookApp(id, appID, secret, null);

    await sendResponse(res, updatedDoc, {
      name: "OpenAIConfigurationUpdated_200",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete OpenAI Configuration(s)
 */
const deleteFacebook = async (req, res, next) => {
  try {
    let { ids = [], nids = [], selectAll = false, filters = {} } = req.body;

    if (!Array.isArray(ids)) ids = [ids];
    if (!Array.isArray(nids)) nids = [nids];

    if (!ids.length && !selectAll)
      await createError({ name: "NoOpenAISelected_400" });

    const app = await AppModel.findOne({
      company: undefined,
    });

    const defaultOpenAIId = app?.defaultFacebook?.app?.toString() || "";

    await bulkDelete({
      model: openai,
      req,
      populate: [],
      error: "NoOpenAISelected_400",
      extra: {
        _id: { $nin: [...nids, defaultOpenAIId] },
      },
    });
    await sendResponse(res, null, { name: "OpenAIDeleted_200" });
  } catch (err) {
    next(err);
  }
};

/**
 * Set Default OpenAI Configuration
 */
const setDefaultFacebookController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findOpenAIById(id, null);

    if (!doc) await createError({ name: "OpenAIConfigurationNotFound_400" });

    const result = await setDefaultFacebook(null, id, true);

    await sendResponse(res, result, {
      name: "DefaultConfigurationSet_200",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createFacebook,
  getAllFacebooks,
  getFacebook,
  updateFacebook,
  deleteFacebook,
  setDefaultFacebookController,
};
