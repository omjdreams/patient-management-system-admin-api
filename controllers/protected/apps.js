const ocr = require("../../patient-management-system-shared-models/apps/legacy-vision-api/models/ocr");
const Phonepe = require("../../patient-management-system-shared-models/apps/phonepe/models/phonepe");
const Razorpay = require("../../patient-management-system-shared-models/apps/razerpay/models/razorpay");
const Bucket = require("../../patient-management-system-shared-models/apps/s3-bucket/models/bucket");
const Gemini = require("../../patient-management-system-shared-models/apps/gemini/models/gemini");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const CouponModel = require("../../patient-management-system-shared-models/models/coupon");
const {
  createError,
  sendResponse,
  applyQueryOptions,
} = require("../../patient-management-system-shared-models/utils/utils");
const Timezone = require("../../patient-management-system-shared-models/models/timezone");
const InstagramApp = require("../../patient-management-system-shared-models/apps/instagram/models/instagramApp");
const openai = require("../../patient-management-system-shared-models/apps/openai/models/openai");
const ManualPayment = require("../../patient-management-system-shared-models/apps/manual-payment/models/manualPayment");
const FacebookOAuthApp = require("../../patient-management-system-shared-models/apps/oAuthFacebook/models/app");
const WhatsAppOAuthApp = require("../../patient-management-system-shared-models/apps/oAuthWhatsApp/models/app");

// Get All Coupons
const getAllApps = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: AppModel,
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
const getApp = async (req, res, next) => {
  try {
    const doc = await AppModel.findOne({
      company: undefined,
    }).lean();

    if (!doc) await createError({ name: "AppNotFound_400" });
    const s3buckets = await Bucket.countDocuments({ companyID: undefined });
    const razorpay = await Razorpay.countDocuments({ companyID: undefined });
    const phonepe = await Phonepe.countDocuments({ companyID: undefined });
    const ocrs = await ocr.countDocuments({ companyID: undefined });
    const gemini = await Gemini.countDocuments({ companyID: null });
    const manualPayment = await ManualPayment.countDocuments({
      companyID: null,
    });
    const timezone = await Timezone.countDocuments();
    const instagram = await InstagramApp.countDocuments({
      companyID: undefined,
    });
    const Openai = await openai.countDocuments({
      companyID: undefined,
    });
    const facebook = await FacebookOAuthApp.countDocuments({
      $or: [{ companyID: { $exists: false } }, { companyID: null }],
    });
    const whatsappOAuthApp = await WhatsAppOAuthApp.countDocuments({
      $or: [{ companyID: { $exists: false } }, { companyID: null }],
    });
    const facebookOAuthApp = await FacebookOAuthApp.findOne({
      $or: [{ companyID: { $exists: false } }, { companyID: null }],
    });
    await sendResponse(res, {
      ...doc,
      appCounts: {
        s3buckets,
        razorpay,
        phonepe,
        ocr: ocrs,
        gemini,
        timezone,
        instagram,
        openai: Openai,
        manualPayment,
        facebook: facebook,
        facebookOAuthApp,
        whatsappOAuthApp,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllApps,
  getApp,
};
