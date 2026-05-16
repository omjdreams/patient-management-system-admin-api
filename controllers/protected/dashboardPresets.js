const DashboardPresetsModel = require("../../patient-management-system-shared-models/models/dashboardPresets");
const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const createDashboardPreset = async (req, res, next) => {
  try {
    const admin = req.admin;
    // console.log("req.body", req.body);
    const { name, description, order, widgets } = req.body;
    checkRequired({ name });

    const existing = await DashboardPresetsModel.findOne({ name: name.trim() });
    if (existing)
      await createError({ name: "DashboardPresetAlreadyExists_400" });
    const doc = new DashboardPresetsModel({
      name: name.trim(),
      description,
      order,
      widgets,
      admin: admin._id,
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    await doc.save();
    await sendResponse(res, doc, { name: "DashboardPresetCreated_200" });
  } catch (err) {
    next(err);
  }
};

const getAllDashboardPresets = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: DashboardPresetsModel,
      query: req.query,
      populate: [
        ["updatedBy", "Admin", "admins"],
        ["createdBy", "Admin", "admins"],
        ["widgets.widget", "Widget", "widgets"],
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
    });
    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const getDashboardPreset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await DashboardPresetsModel.findOne({ _id: id }).populate(
      "widgets.widget",
    );
    if (!doc) await createError({ name: "DashboardPresetNotFound_400" });
    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updateDashboardPreset = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const doc = await DashboardPresetsModel.findOne({ _id: id });
    if (!doc) await createError({ name: "DashboardPresetNotFound_400" });

    Object.entries({
      name: "name",
      description: "description",
      order: "order",
      widgets: "widgets",
    }).forEach(([key, value]) => {
      if (req.body[key] !== undefined) doc[value] = req.body[key];
    });

    doc.updatedBy = admin._id;
    await doc.save();
    await sendResponse(res, doc, { name: "DashboardPresetUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const deleteDashboardPreset = async (req, res, next) => {
  try {
    await bulkDelete({
      model: DashboardPresetsModel,
      req,
      populate: [
        ["updatedBy", "Admin", "admins"],
        ["createdBy", "Admin", "admins"],
        ["widgets.widget", "Widget", "widgets"],
      ],
      error: "NoDashboardPresetSelected_400",
    });
    await sendResponse(res, null, { name: "DashboardPresetDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createDashboardPreset,
  getAllDashboardPresets,
  getDashboardPreset,
  updateDashboardPreset,
  deleteDashboardPreset,
};
