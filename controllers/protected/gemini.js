const {
  createGemini,
  findAllGemini,
  findGeminiById,
  updateGemini,
  deleteGemini,
  getAvailableModels,
  setDefaultGemini,
  getDefaultGemini,
} = require("../../patient-management-system-shared-models/apps/gemini");
const Gemini = require("../../patient-management-system-shared-models/apps/gemini/models/gemini");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

// Create Gemini Configuration
const createGeminiConfig = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { name, apiKey, selectedModel, modelSettings } = req.body;

    checkRequired({ name, apiKey, selectedModel });

    // Check existing configuration with same name
    const existing = await findAllGemini({
      name: name.trim(),
      companyID: null,
    });
    if (existing.length > 0)
      await createError({ name: "GeminiConfigurationAlreadyExists_400" });

    const payload = {
      name: name?.trim(),
      apiKey: apiKey?.trim(),
      selectedModel,
      modelSettings: modelSettings || {},
      companyID: null,
      createdBy: admin._id,
      updatedBy: admin._id,
    };

    const doc = await createGemini(payload);
    const allApps = await findAllGemini({ companyID: null });
    if (allApps.length === 1)
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultGemini: {
            app: doc._id,
          },
        },
      );
    await sendResponse(res, doc, { name: "GeminiConfigurationCreated_200" });
  } catch (err) {
    next(err);
  }
};

// Get All Gemini Configurations
const getAllGeminiConfigs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllGemini({ companyID: undefined }),
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

// Get Single Gemini Configuration
const getGeminiConfig = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findGeminiById(id, null);

    if (!doc) await createError({ name: "GeminiConfigurationNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

// Update Gemini Configuration
const updateGeminiConfig = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const {
      name,
      apiKey,
      selectedModel,
      modelSettings,
      isActive,
      defaultGemini,
    } = req.body;

    const doc = await findGeminiById(id, null);

    if (!doc) await createError({ name: "GeminiConfigurationNotFound_400" });

    // Check if name is already taken by another configuration
    if (name && name !== doc.name) {
      const existing = await findAllGemini({
        name: name.trim(),
        companyID: null,
        _id: { $ne: id },
      });
      if (existing.length > 0)
        await createError({ name: "GeminiConfigurationAlreadyExists_400" });
    }

    // Build update payload
    const payload = {};
    if (name) payload.name = name.trim();
    if (apiKey) payload.apiKey = apiKey.trim();
    if (selectedModel) payload.selectedModel = selectedModel;
    if (modelSettings)
      payload.modelSettings = { ...doc.modelSettings, ...modelSettings };
    if (typeof isActive === "boolean") payload.isActive = isActive;
    payload.updatedBy = admin._id;

    const updatedDoc = await updateGemini(id, payload, null);
    if (defaultGemini) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultGemini: {
            app: defaultGemini,
          },
        },
      );
    }
    await sendResponse(res, updatedDoc, {
      name: "GeminiConfigurationUpdated_200",
    });
  } catch (err) {
    next(err);
  }
};

// Delete Gemini Configuration
const deleteGeminiConfig = async (req, res, next) => {
  try {
    await bulkDelete({
      model: Gemini,
      req,
      populate: [],
      error: "NoGeminiSelected_400",
    });
    await sendResponse(res, null, { name: "GeminiDeleted_200" });
  } catch (err) {
    next(err);
  }
};

// Get Available Models
const getAvailableModelsController = async (req, res, next) => {
  try {
    const defaultConfig = getDefaultGemini(null);
    let useApiKey = defaultConfig?.apiKey;
    const models = await getAvailableModels(useApiKey);
    await sendResponse(res, models);
  } catch (err) {
    next(err);
  }
};

// Set Default Configuration - This will be handled through App model now
const setDefaultGeminiController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findGeminiById(id, null);

    if (!doc) await createError({ name: "GeminiConfigurationNotFound_400" });

    // Set default through the setDefaultGemini function (handles App model)
    // For global admin, we'll set it for null company (global default)
    const result = await setDefaultGemini(null, id, true);

    await sendResponse(res, result, { name: "DefaultConfigurationSet_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createGemini: createGeminiConfig,
  getAllGemini: getAllGeminiConfigs,
  getGemini: getGeminiConfig,
  updateGemini: updateGeminiConfig,
  deleteGemini: deleteGeminiConfig,
  getAvailableModels: getAvailableModelsController,
  setDefaultGemini: setDefaultGeminiController,
};
