const CouponModel = require("../../patient-management-system-shared-models/models/coupon");
const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

// Create Coupon
const createCoupon = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { name, type, value, startDate, endDate, status } = req.body;

    checkRequired({ name, type, value, startDate, endDate });

    // Check existing coupon (case-insensitive, since name is uppercase)
    const existing = await CouponModel.findOne({
      name: name.trim().toUpperCase(),
    });
    if (existing) await createError({ name: "CouponNameAlreadyExists_400" });

    const doc = new CouponModel({
      name: name?.trim(),
      type,
      value,
      startDate,
      endDate,
      status,
      createdBy: admin._id,
      updatedBy: admin._id,
    });

    await doc.save();
    await sendResponse(res, doc, { name: "CouponCreated_200" });
  } catch (err) {
    next(err);
  }
};
// Get All Coupons
const getAllCoupon = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: CouponModel,
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
    });

    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

// Get Single Coupon
const getCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await CouponModel.findById(id);

    if (!doc) await createError({ name: "CouponNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

// Update Coupon
const updateCoupon = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;

    const doc = await CouponModel.findById(id);
    if (!doc) await createError({ name: "CouponNotFound_400" });
    Object.entries({
      name: "name",
      type: "type",
      value: "value",
      startDate: "startDate",
      endDate: "endDate",
      status: "status",
    }).forEach(([key, value]) => {
      if (req.body[key] !== undefined) doc[value] = req.body[key];
    });

    doc.updatedBy = admin._id;

    await doc.save();
    await sendResponse(res, doc, { name: "CouponUpdated_200" });
  } catch (err) {
    next(err);
  }
};

// Delete Coupon(s)
const deleteCoupon = async (req, res, next) => {
  try {
    await bulkDelete({
      model: CouponModel,
      req,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      error: "NoCouponSelected_400",
    });
    await sendResponse(res, null, { name: "CouponDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCoupon,
  getAllCoupon,
  getCoupon,
  updateCoupon,
  deleteCoupon,
};
