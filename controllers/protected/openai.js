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
const createOpenAIConfig = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { name, apiKey, selectedModel, modelSettings } = req.body;

    checkRequired({ name, apiKey, selectedModel });

    // Check existing configuration with same name (global)
    const existing = await findAllOpenAI({
      name: name.trim(),
      companyID: null,
    });
    // console.log("existing is 2", existing);

    if (existing.length > 0)
      await createError({ name: "OpenAIConfigurationAlreadyExists_400" });

    const payload = {
      name: name.trim(),
      apiKey: apiKey.trim(),
      selectedModel,
      modelSettings: modelSettings || {},
      companyID: null,
      createdBy: admin._id,
      updatedBy: admin._id,
    };

    const doc = await createOpenAI(payload);

    const allApps = await findAllOpenAI({ companyID: null });
    if (allApps.length === 1) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultOpenAI: {
            app: doc._id,
          },
        },
      );
    }

    await sendResponse(res, doc, {
      name: "OpenAIConfigurationCreated_200",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get All OpenAI Configurations
 */
const getAllOpenAIConfigs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllOpenAI({
        $or: [
          { companyID: null },
          { companyID: undefined },
          { companyID: { $exists: false } },
        ],
      }),
      query: req.query,
    });
    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

/**
 * Get Single OpenAI Configuration
 */
const getOpenAIConfig = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findOpenAIById(id, null);

    if (!doc) await createError({ name: "OpenAIConfigurationNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

/**
 * Update OpenAI Configuration
 */
const updateOpenAIConfig = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;

    const {
      name,
      apiKey,
      selectedModel,
      modelSettings,
      isActive,
      defaultOpenAI,
    } = req.body;

    const doc = await findOpenAIById(id, null);

    if (!doc) await createError({ name: "OpenAIConfigurationNotFound_400" });

    // Check duplicate name
    if (name && name !== doc.name) {
      const existing = await findAllOpenAI({
        name: name.trim(),
        companyID: null,
        _id: { $ne: id },
      });

      if (existing.length > 0)
        await createError({ name: "OpenAIConfigurationAlreadyExists_400" });
    }

    const payload = {};

    if (name) payload.name = name.trim();
    if (apiKey) payload.apiKey = apiKey.trim();
    if (selectedModel) payload.selectedModel = selectedModel;
    if (modelSettings)
      payload.modelSettings = {
        ...doc.modelSettings,
        ...modelSettings,
      };
    if (typeof isActive === "boolean") payload.isActive = isActive;

    payload.updatedBy = admin._id;

    const updatedDoc = await updateOpenAI(id, payload, null);

    if (defaultOpenAI) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultOpenAI: {
            app: defaultOpenAI,
          },
        },
      );
    }

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
const deleteOpenAIConfig = async (req, res, next) => {
  try {
    let { ids = [], nids = [], selectAll = false, filters = {} } = req.body;

    if (!Array.isArray(ids)) ids = [ids];
    if (!Array.isArray(nids)) nids = [nids];

    if (!ids.length && !selectAll)
      await createError({ name: "NoOpenAISelected_400" });

    const app = await AppModel.findOne({
      company: undefined,
    });

    const defaultOpenAIId = app?.defaultOpenAI?.app?.toString() || "";

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
 * Get Available OpenAI Models
 */
const getAvailableOpenAIModelsController = async (req, res, next) => {
  try {
    const defaultConfig = await getDefaultOpenAI(null);
    const apiKey = defaultConfig?.apiKey;

    const models = await getAvailableOpenAIModels(apiKey);

    await sendResponse(res, models);
  } catch (err) {
    next(err);
  }
};

/**
 * Set Default OpenAI Configuration
 */
const setDefaultOpenAIController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findOpenAIById(id, null);

    if (!doc) await createError({ name: "OpenAIConfigurationNotFound_400" });

    const result = await setDefaultOpenAI(null, id, true);

    await sendResponse(res, result, {
      name: "DefaultConfigurationSet_200",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOpenAI: createOpenAIConfig,
  getAllOpenAI: getAllOpenAIConfigs,
  getOpenAI: getOpenAIConfig,
  updateOpenAI: updateOpenAIConfig,
  deleteOpenAI: deleteOpenAIConfig,
  getAvailableOpenAIModelsController,
  setDefaultOpenAI: setDefaultOpenAIController,
};
