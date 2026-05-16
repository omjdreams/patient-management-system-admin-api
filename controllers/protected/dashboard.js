const WidgetModel = require("../../patient-management-system-shared-models/models/widget");
const {
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const createWidget = async (req, res, next) => {
  try {
    const admin = req.admin;
    const {
      name,
      description,
      widgetColor,
      type,
      takeSpace,
      permissionType,
      permissionRoute,
      key,
      upsell,
      hidden,
      isDefault,
      order,
    } = req.body;

    checkRequired({ name, type, key });

    const existing = await WidgetModel.findOne({ name: name.trim() });
    if (existing) {
      const error = new Error("Widget name already exists");
      error.status = 400;
      throw error;
    }

    const doc = new WidgetModel({
      name: name.trim(),
      description,
      widgetColor,
      type,
      takeSpace,
      permissionType,
      permissionRoute,
      key,
      upsell,
      hidden,
      isDefault,
      order,
      createdBy: admin?._id,
      updatedBy: admin?._id,
    });

    await doc.save();
    await sendResponse(res, doc, { name: "WidgetCreated_200" });
  } catch (err) {
    next(err);
  }
};

const getAllWidget = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: WidgetModel,
      query: req.query,
      populate: [
        ["updatedBy", "Admin", "admins"],
        ["createdBy", "Admin", "admins"],
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
        {
          $sort: {
            order: 1,
          },
        },
      ],
    });
    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const getWidget = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await WidgetModel.findById(id);
    if (!doc) {
      const error = new Error("Widget not found");
      error.status = 404;
      throw error;
    }
    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const getWidgetOptions = async (req, res, next) => {
  try {
    const schemaPaths = WidgetModel.schema.paths;
    const enumOptions = (key) =>
      [...new Set(schemaPaths[key]?.enumValues || [])].map((value) => ({
        option: value,
        value,
      }));

    await sendResponse(res, {
      widgetTypeOptions: enumOptions("type"),
      permissionTypeOptions: enumOptions("permissionType"),
      permissionRouteOptions: enumOptions("permissionRoute"),
      widgetKeyOptions: enumOptions("key"),
    });
  } catch (err) {
    next(err);
  }
};

const updateWidget = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const doc = await WidgetModel.findById(id);

    if (!doc) {
      const error = new Error("Widget not found");
      error.status = 404;
      throw error;
    }

    const updatableFields = {
      name: "name",
      description: "description",
      widgetColor: "widgetColor",
      type: "type",
      takeSpace: "takeSpace",
      permissionType: "permissionType",
      permissionRoute: "permissionRoute",
      key: "key",
      upsell: "upsell",
      hidden: "hidden",
      isDefault: "isDefault",
      order: "order",
    };

    Object.entries(updatableFields).forEach(([key, value]) => {
      if (req.body[key] !== undefined) {
        doc[value] = key === "name" ? req.body[key]?.trim() : req.body[key];
      }
    });

    doc.updatedBy = admin?._id;

    await doc.save();
    await sendResponse(res, doc, { name: "WidgetUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const deleteWidget = async (req, res, next) => {
  try {
    await bulkDelete({
      model: WidgetModel,
      req,
      populate: [
        ["updatedBy", "Admin", "admins"],
        ["createdBy", "Admin", "admins"],
      ],
      error: "NoDashboardSelected_400",
    });
    // Third argument is the object
    await sendResponse(res, null, { name: "WidgetDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createWidget,
  getAllWidget,
  getWidget,
  getWidgetOptions,
  updateWidget,
  deleteWidget,
};
