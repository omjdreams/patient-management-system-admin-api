const CompanyModel = require("../../patient-management-system-shared-models/models/company");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const ContactModel = require("../../patient-management-system-shared-models/models/contact");
const ContactCategoryModel = require("../../patient-management-system-shared-models/models/contactCategory");
const EmailHistoryModel = require("../../patient-management-system-shared-models/models/emailHistory");
const FileObjectModel = require("../../patient-management-system-shared-models/models/fileObject");
const path = require("path");
const ImportModel = require("../../patient-management-system-shared-models/models/import");
const LeadModel = require("../../patient-management-system-shared-models/models/lead");
const MemberModel = require("../../patient-management-system-shared-models/models/member");
const RoleModel = require("../../patient-management-system-shared-models/models/role");
const S3BucketModel = require("../../patient-management-system-shared-models/apps/s3-bucket/models/bucket");
const SMTPModel = require("../../patient-management-system-shared-models/apps/smtp/models/smtp");
const TagModel = require("../../patient-management-system-shared-models/models/tag");
const SettingModel = require("../../patient-management-system-shared-models/models/setting");
const CustomFieldModel = require("../../patient-management-system-shared-models/models/customField");
const {
  sendResponse,
  applyQueryOptions,
  createError,
} = require("../../patient-management-system-shared-models/utils/utils");
const DashboardModel = require("../../patient-management-system-shared-models/models/dashboard");
const SegmentModel = require("../../patient-management-system-shared-models/models/segment");
const ProductServiceModel = require("../../patient-management-system-shared-models/models/productService");
const Smtp = require("../../patient-management-system-shared-models/apps/smtp/models/smtp");
const Bucket = require("../../patient-management-system-shared-models/apps/s3-bucket/models/bucket");
const MetaApp = require("../../patient-management-system-shared-models/apps/whatsapp-business/models/app");
const FacebookApp = require("../../patient-management-system-shared-models/apps/facebook/models/app");
const Gemini = require("../../patient-management-system-shared-models/apps/gemini/models/gemini");
const TelegramApp = require("../../patient-management-system-shared-models/apps/telegram/models/telegramApp");
const InstagramApp = require("../../patient-management-system-shared-models/apps/instagram/models/instagramApp");
const UnifiedMessage = require("../../patient-management-system-shared-models/models/UnifiedMessage");
const ocr = require("../../patient-management-system-shared-models/apps/legacy-vision-api/models/ocr");
const MetaTemplate = require("../../patient-management-system-shared-models/apps/whatsapp-business/models/template");
const EmailTemplateModel = require("../../patient-management-system-shared-models/models/emailTemplate");
const CampaignModel = require("../../patient-management-system-shared-models/models/campaign");
const SmtpMessage = require("../../patient-management-system-shared-models/apps/smtp/models/message");
const WhatsAppMessage = require("../../patient-management-system-shared-models/apps/whatsapp-business/models/message");
const GmailMessage = require("../../patient-management-system-shared-models/apps/gmail/models/message");
const InviteLogModel = require("../../patient-management-system-shared-models/models/inviteLog");
const APIModel = require("../../patient-management-system-shared-models/models/api");
const Payment = require("../../patient-management-system-shared-models/models/payment");
const Subscription = require("../../patient-management-system-shared-models/models/subscription");
const { default: mongoose } = require("mongoose");
const serverLog = require("../../patient-management-system-shared-models/models/serverLog");
const {
  AiLogModel,
} = require("../../patient-management-system-shared-models/models/aiLog");
const AnalyticsDashboardModel = require("../../patient-management-system-shared-models/models/analyticsDashboard");
const AnalyticsWidgetModel = require("../../patient-management-system-shared-models/models/analyticsWidget");
const CallLogModel = require("../../patient-management-system-shared-models/models/callLog");
const CampaignLogModel = require("../../patient-management-system-shared-models/models/campaignLog");
const ContactAIGeneratedModel = require("../../patient-management-system-shared-models/models/contactAIGenerated");
const CouponModel = require("../../patient-management-system-shared-models/models/coupon");
const CustomSectionModel = require("../../patient-management-system-shared-models/models/customSection");
const GlobalAILead = require("../../patient-management-system-shared-models/models/globalAILead");
const TempManualCampaignModel = require("../../patient-management-system-shared-models/models/tempManualCampaign");
const facebookLog = require("../../patient-management-system-shared-models/apps/facebook/models/facebookLog");
const FormModel = require("../../patient-management-system-shared-models/apps/facebook/models/forms");
const FacebookLead = require("../../patient-management-system-shared-models/apps/facebook/models/Lead");
const PageModel = require("../../patient-management-system-shared-models/apps/facebook/models/pages");
const syncJob = require("../../patient-management-system-shared-models/apps/facebook/models/syncJob");
const InstagramAccount = require("../../patient-management-system-shared-models/apps/instagram/models/InstagramAccount");
const InstagramComment = require("../../patient-management-system-shared-models/apps/instagram/models/instagramComment");
const InstagramMessage = require("../../patient-management-system-shared-models/apps/instagram/models/instagramMessage");
const manualPayment = require("../../patient-management-system-shared-models/apps/manual-payment/models/manualPayment");
const ManualPaymentRequest = require("../../patient-management-system-shared-models/apps/manual-payment/models/ManualPaymentRequest");
const openai = require("../../patient-management-system-shared-models/apps/openai/models/openai");
const Paypal = require("../../patient-management-system-shared-models/apps/paypal/models/paypal");
const Transaction = require("../../patient-management-system-shared-models/apps/paypal/models/transaction");
const Payu = require("../../patient-management-system-shared-models/apps/payu/models/payu");
const PayuTransaction = require("../../patient-management-system-shared-models/apps/payu/models/transaction");
const People = require("../../patient-management-system-shared-models/apps/people/models/people");
const Phonepe = require("../../patient-management-system-shared-models/apps/phonepe/models/phonepe");
const phonePeTransaction = require("../../patient-management-system-shared-models/apps/phonepe/models/transaction");
const Razorpay = require("../../patient-management-system-shared-models/apps/razerpay/models/razorpay");
const razorpayTransaction = require("../../patient-management-system-shared-models/apps/razerpay/models/transaction");
const Stripe = require("../../patient-management-system-shared-models/apps/stripe/models/stripe");
const StripeTransaction = require("../../patient-management-system-shared-models/apps/stripe/models/transaction");
const TelegramMessage = require("../../patient-management-system-shared-models/apps/telegram/models/telegramMessage");
const {
  deleteBucketObject,
} = require("../../patient-management-system-shared-models/apps/s3-bucket");
const Team = require("../../patient-management-system-shared-models/models/team");
const getCompanies = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: CompanyModel,
      query: req.query,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      aggregationPipeline: [
        {
          $lookup: {
            from: "members",
            let: { companyId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$company", "$$companyId"] },
                      { $eq: ["$status", "owner"] },
                    ],
                  },
                },
              },
            ],
            as: "member",
          },
        },
        {
          $unwind: {
            path: "$member",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "member.email",
            foreignField: "email",
            as: "admin",
          },
        },
        {
          $unwind: {
            path: "$admin",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "settings",
            localField: "_id",
            foreignField: "company",
            as: "setting",
          },
        },
        {
          $unwind: {
            path: "$setting",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "files",
            localField: "setting.assets.logo",
            foreignField: "_id",
            as: "setting.assets.logo",
          },
        },
        {
          $unwind: {
            path: "$setting.assets.logo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "subscriptions",
            let: { companyId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$company", "$$companyId"] },
                      { $eq: ["$status", "active"] },
                    ],
                  },
                },
              },
            ],
            as: "subscription",
          },
        },

        {
          $unwind: {
            path: "$subscription",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            contactNumber: 1,
            memberCount: 1,
            setting: 1,
            admin: 1,
            subscription: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ],
    });

    await sendResponse(res, null, null, docs);
  } catch (error) {
    next(error);
  }
};

const deleteCompanies = async (req, res, next) => {
  try {
    const { admin } = req;
    const { ids } = req.body;
    const id = ids[0];
    const { password } = req.query;
    // console.log("admin is", admin);

    if (
      !admin.isSuperAdmin ||
      !id?.trim() ||
      !password ||
      password !== process.env.DELETE_COMPANY_PASS
    )
      return await createError({ key: "066" });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const companyFiles = await FileObjectModel.find({ company: id })
        .select("_id name bucket")
        .lean();

      await Promise.all(
        companyFiles
          .filter((file) => file.bucket)
          .map((file) =>
            deleteBucketObject(
              file.bucket,
              `${file._id.toString()}${path.extname(file.name)}`,
            ),
          ),
      );

      const deletedCompanies = await CompanyModel.deleteOne(
        { _id: id },
        { session },
      );

      await Promise.all([
        AiLogModel.deleteMany({ company: id }, { session }),
        AnalyticsDashboardModel.deleteMany({ company: id }, { session }),
        AnalyticsWidgetModel.deleteMany({ company: id }, { session }),
        CallLogModel.deleteMany({ company: id }, { session }),
        CampaignLogModel.deleteMany({ company: id }, { session }),

        DashboardModel.deleteMany({ company: id }, { session }),
        ContactModel.deleteMany({ company: id }, { session }),
        ContactAIGeneratedModel.deleteMany({ company: id }, { session }),
        CouponModel.deleteMany({ company: id }, { session }),
        CustomSectionModel.deleteMany({ company: id }, { session }),
        GlobalAILead.deleteMany({ companyId: id }, { session }),

        ImportModel.deleteMany({ company: id }, { session }),
        Team.deleteMany({ company: id }, { session }),
        TagModel.deleteMany({ company: id }, { session }),
        ContactCategoryModel.deleteMany({ company: id }, { session }),
        SegmentModel.deleteMany({ company: id }, { session }),
        LeadModel.deleteMany({ company: id }, { session }),
        ProductServiceModel.deleteMany({ company: id }, { session }),
        TempManualCampaignModel.deleteMany({ company: id }, { session }),
        FileObjectModel.deleteMany({ company: id }, { session }),
        Bucket.deleteMany({ companyID: id }, { session }),

        // Apps
        AppModel.deleteMany({ company: id }, { session }),
        Smtp.deleteMany({ companyID: id }, { session }),
        MetaApp.deleteMany({ companyID: id }, { session }),
        FacebookApp.deleteMany({ companyID: id }, { session }),
        facebookLog.deleteMany({ companyID: id }, { session }),
        FormModel.deleteMany({ companyID: id }, { session }),
        FacebookLead.deleteMany({ companyID: id }, { session }),
        PageModel.deleteMany({ companyID: id }, { session }),
        syncJob.deleteMany({ companyID: id }, { session }),

        ocr.deleteMany({ companyID: id }, { session }),
        Gemini.deleteMany({ companyID: id }, { session }),
        TelegramApp.deleteMany({ companyID: id }, { session }),
        InstagramApp.deleteMany({ companyID: id }, { session }),
        InstagramAccount.deleteMany({ companyID: id }, { session }),
        InstagramComment.deleteMany({ companyID: id }, { session }),
        InstagramMessage.deleteMany({ companyID: id }, { session }),

        // Messages & templates
        UnifiedMessage.deleteMany({ companyID: id }, { session }),
        MetaTemplate.deleteMany({ companyID: id }, { session }),
        EmailTemplateModel.deleteMany({ companyID: id }, { session }),
        CampaignModel.deleteMany({ companyID: id }, { session }),

        // Settings & users
        SettingModel.deleteMany({ company: id }, { session }),
        RoleModel.deleteMany({ company: id }, { session }),
        MemberModel.deleteMany({ company: id }, { session }),
        CustomFieldModel.deleteMany({ company: id }, { session }),

        // Logs
        EmailHistoryModel.deleteMany({ company: id }, { session }),
        SmtpMessage.deleteMany({ companyID: id }, { session }),
        WhatsAppMessage.deleteMany({ companyID: id }, { session }),
        GmailMessage.deleteMany({ companyID: id }, { session }),
        InviteLogModel.deleteMany({ company: id }, { session }),
        // Billing
        APIModel.deleteMany({ company: id }, { session }),
        Payment.deleteMany({ company: id }, { session }),
        Subscription.deleteMany({ company: id }, { session }),
        manualPayment.deleteMany({ companyID: id }, { session }),
        ManualPaymentRequest.deleteMany({ companyID: id }, { session }),

        // apps
        openai.deleteMany({ companyID: id }, { session }),
        Paypal.deleteMany({ companyID: id }, { session }),
        Transaction.deleteMany({ companyID: id }, { session }),
        Payu.deleteMany({ companyID: id }, { session }),
        PayuTransaction.deleteMany({ companyID: id }, { session }),
        People.deleteMany({ companyID: id }, { session }),
        Phonepe.deleteMany({ companyID: id }, { session }),
        phonePeTransaction.deleteMany({ companyID: id }, { session }),
        Razorpay.deleteMany({ companyID: id }, { session }),
        razorpayTransaction.deleteMany({ companyID: id }, { session }),
        Stripe.deleteMany({ companyID: id }, { session }),
        StripeTransaction.deleteMany({ companyID: id }, { session }),
        TelegramMessage.deleteMany({ companyID: id }, { session }),
      ]);
      const deletedServerLogs = await serverLog.deleteMany(
        { company: id },
        { session },
      );
      await session.commitTransaction();
      session.endSession();
      sendResponse(res, deletedCompanies, { key: "050" });
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      session.endSession();
      next(error);
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getCompanies, deleteCompanies };
