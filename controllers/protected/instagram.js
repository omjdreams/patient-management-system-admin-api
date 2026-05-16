const {
  createInstagramApp,
  findAllInstagramApps,
  findInstagramAppById,
  updateInstagramApp,
  deleteInstagramApps,
} = require("../../patient-management-system-shared-models/apps/instagram");
const InstagramApp = require("../../patient-management-system-shared-models/apps/instagram/models/instagramApp");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");
const { randomBytes } = require("node:crypto");

// Create Instagram App Configuration
const createInstagramConfig = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { name, appId, pageId, appSecret, accessToken } = req.body;

    checkRequired({ name, appId, pageId, appSecret, accessToken });

    // Check existing configuration with same name
    const existing = await findAllInstagramApps({
      name: name.trim(),
      companyID: null,
    });
    if (existing.length > 0)
      await createError({ name: "InstagramConfigurationAlreadyExists_400" });

    const payload = {
      name: name?.trim(),
      appId: appId?.trim(),
      pageId: pageId?.trim(),
      appSecret: appSecret?.trim(),
      accessToken: accessToken?.trim(),
      companyID: null,
      verify: randomBytes(16).toString("hex"),
    };

    const doc = await createInstagramApp(payload);

    // Auto-set as default if this is the first Instagram app
    const allApps = await findAllInstagramApps({ companyID: null });
    if (allApps.length === 1) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultInstagram: {
            app: doc._id,
          },
        },
        { upsert: true },
      );
    }

    await sendResponse(res, doc, {
      name: "InstagramConfigurationCreated_200",
    });
  } catch (err) {
    next(err);
  }
};

// Get All Instagram App Configurations
const getAllInstagramConfigs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllInstagramApps({ companyID: undefined }),
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

// Get Single Instagram App Configuration
const getInstagramConfig = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findInstagramAppById(id);

    if (!doc) await createError({ name: "InstagramConfigurationNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

// Update Instagram App Configuration
const updateInstagramConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, appId, pageId, appSecret, accessToken } = req.body;

    const doc = await findInstagramAppById(id);

    if (!doc) await createError({ name: "InstagramConfigurationNotFound_400" });

    // Check if name is already taken by another configuration
    if (name && name !== doc.name) {
      const existing = await findAllInstagramApps({
        name: name.trim(),
        companyID: null,
      });
      // Filter out current doc
      const others = existing.filter(
        (app) => app._id.toString() !== id.toString(),
      );
      if (others.length > 0)
        await createError({ name: "InstagramConfigurationAlreadyExists_400" });
    }

    // Build update payload
    const payload = {};
    if (name) payload.name = name.trim();
    if (appId) payload.appId = appId.trim();
    if (pageId) payload.pageId = pageId.trim();
    if (appSecret) payload.appSecret = appSecret.trim();
    if (accessToken) payload.accessToken = accessToken.trim();

    const updatedDoc = await updateInstagramApp(id, payload);

    await sendResponse(res, updatedDoc, {
      name: "InstagramConfigurationUpdated_200",
    });
  } catch (err) {
    next(err);
  }
};

// Delete Instagram App Configuration
const deleteInstagramConfig = async (req, res, next) => {
  try {
    await bulkDelete({
      model: InstagramApp,
      req,
      populate: [],
      error: "NoInstagramSelected_400",
    });
    await sendResponse(res, null, { name: "InstagramDeleted_200" });
  } catch (err) {
    next(err);
  }
};

// Set Default Instagram Configuration
const setDefaultInstagramController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findInstagramAppById(id);

    if (!doc) await createError({ name: "InstagramConfigurationNotFound_400" });

    // Set as default for global admin (null company)
    const result = await AppModel.findOneAndUpdate(
      { company: undefined },
      {
        defaultInstagram: {
          app: id,
        },
      },
      { upsert: true, new: true },
    );

    await sendResponse(res, result, { name: "DefaultConfigurationSet_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createInstagram: createInstagramConfig,
  getAllInstagram: getAllInstagramConfigs,
  getInstagram: getInstagramConfig,
  updateInstagram: updateInstagramConfig,
  deleteInstagram: deleteInstagramConfig,
  setDefaultInstagram: setDefaultInstagramController,
};
