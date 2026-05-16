const FeatureModel = require("../../patient-management-system-shared-models/models/feature");
const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const createFeature = async (req, res, next) => {
  try {
    const admin = req.admin;
    const {
      name,
      keyName,
      description,
      type,
      status,
      quantifiableBoolean,
      resetOnBillingCycle,
      allowAddOnPurchase,
      addOnDurationModes,
      order,
    } = req.body;
    checkRequired({ name });

    const existing = await FeatureModel.findOne({
      name: name.trim(),
      company: undefined,
    });
    if (existing) await createError({ name: "FeatureNameAlreadyExists_400" });
    const doc = new FeatureModel({
      name: name?.trim(),
      keyName,
      description,
      type,
      status,
      quantifiableBoolean,
      resetOnBillingCycle,
      allowAddOnPurchase,
      addOnDurationModes,
      company: undefined,
      order,
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    await doc.save();
    await sendResponse(res, doc, { name: "FeatureCreated_200" });
  } catch (err) {
    next(err);
  }
};

const getAllFeature = async (req, res, next) => {
  try {
    const admin = req.admin;
    const docs = await applyQueryOptions({
      data: FeatureModel,
      query: req.query,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      aggregationPipeline: [
        {
          $lookup: {
            from: "users",
            localField: "updatedBy.email",
            foreignField: "email",
            as: "updatedUser",
          },
        },
        { $unwind: { path: "$updatedUser", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "createdBy.email",
            foreignField: "email",
            as: "createdUser",
          },
        },
        { $unwind: { path: "$createdUser", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            "createdBy.name": "$createdUser.name",
            "updatedBy.name": "$updatedUser.name",
          },
        },
        {
          $project: {
            createdUser: 0,
            updatedUser: 0,
          },
        },
      ],
      additionalFilters: { company: undefined },
    });
    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const getFeature = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await FeatureModel.findOne({
      _id: id,
      company: undefined,
    });

    if (!doc) await createError({ name: "FeatureNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updateFeature = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const doc = await FeatureModel.findOne({
      _id: id,
      company: undefined,
    });

    if (!doc) await createError({ name: "FeatureNotFound_400" });

    Object.entries({
      name: "name",
      description: "description",
      type: "type",
      status: "status",
      resetOnBillingCycle: "resetOnBillingCycle",
      allowAddOnPurchase: "allowAddOnPurchase",
      addOnDurationModes: "addOnDurationModes",
      order: "order",
    }).forEach(([key, value]) => {
      if (req.body[key] !== undefined) doc[value] = req.body[key];
    });

    doc.updatedBy = admin._id;

    await doc.save();
    await sendResponse(res, doc, { name: "FeatureUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const deleteFeature = async (req, res, next) => {
  try {
    await bulkDelete({
      model: FeatureModel,
      req,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      error: "NoDashboardPresetSelected_400",
    });
    await sendResponse(res, null, { name: "FeatureDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createFeature,
  getAllFeature,
  getFeature,
  updateFeature,
  deleteFeature,
};
