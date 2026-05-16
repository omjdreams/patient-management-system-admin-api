const { default: mongoose } = require("mongoose");
const {
  createError,
  sendResponse,
} = require("../../patient-management-system-shared-models/utils/utils");
const AdminModel = require("../../patient-management-system-shared-models/models/admin");
const EmailTemplateModel = require("../../patient-management-system-shared-models/models/emailTemplate");
const EmailTemplateCategoryModel = require("../../patient-management-system-shared-models/models/emailTemplateCategory");

const emailTemplateCategoryJson = require("../../patient-management-system-shared-models/constants/emailTemplateCategory.json");
const SmtpModel = require("../../patient-management-system-shared-models/apps/smtp/models/smtp");
const Bucket = require("../../patient-management-system-shared-models/apps/s3-bucket/models/bucket");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const SettingModel = require("../../patient-management-system-shared-models/models/setting");
const CategoryModel = require("../../patient-management-system-shared-models/models/category");
const waTemplateCategoriesJson = require("../../patient-management-system-shared-models/constants/waTemplateCategory.json");
const featuresJson = require("../../patient-management-system-shared-models/constants/features.json");
const FeatureModel = require("../../patient-management-system-shared-models/models/feature");
const { initializeTimezonesFromFile } = require("./initializeTimezones");
const Timezone = require("../../patient-management-system-shared-models/models/timezone");
const WidgetModel = require("../../patient-management-system-shared-models/models/widget");
const DashboardPresetsModel = require("../../patient-management-system-shared-models/models/dashboardPresets");
const PlanModel = require("../../patient-management-system-shared-models/models/plan");
const responseMsgsAdminJson = require("../../patient-management-system-shared-models/constants/responseMessagesAdmin.json");
const responseMsgsOrgJson = require("../../patient-management-system-shared-models/constants/responseMessages.json");
const orgEmailTemplatesJson = require("../../patient-management-system-shared-models/constants/orgEmailTemplates.json");
const adminEmailTemplatesJson = require("../../patient-management-system-shared-models/constants/adminEmailTemplates.json");
const widgets = require("../../patient-management-system-shared-models/constants/widgets.json");
const ResponseMessageModel = require("../../patient-management-system-shared-models/models/responseMessage");
const ocr = require("../../patient-management-system-shared-models/apps/legacy-vision-api/models/ocr");
const Razorpay = require("../../patient-management-system-shared-models/apps/razerpay/models/razorpay");
const Phonepe = require("../../patient-management-system-shared-models/apps/phonepe/models/phonepe");
const manualPayment = require("../../patient-management-system-shared-models/apps/manual-payment/models/manualPayment");
const CurrencyModel = require("../../patient-management-system-shared-models/models/currency");
const { cronJobsToRun } = require("../protected/cronJob");
const jobManager = require("../../patient-management-system-shared-models/utils/jobManager");

const initiateDB = async (req, res, next) => {
  if (process.env.NODE_ENV !== "development") {
    return createError({ key: "003" });
  }
  try {
    const { password } = req.params;
    if (password !== process.env.CLEAR_DB_PASSWORD) {
      createError({ key: "003" });
    }
    await dropAllCollections();

    await initiateEssentialData();
    sendResponse(res, {}, { key: "000" });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const buildEmailTemplateCategories = (categoryData = [], templates = []) => {
  const templatesByCategory = new Map(
    templates
      .filter((template) => template?.category)
      .map((template) => [template.category, template]),
  );

  return categoryData
    .filter((entry) => entry?.category)
    .map((entry) => {
      const template = templatesByCategory.get(entry.category);

      return {
        category: entry.category,
        name: entry.name,
        panel: entry.panel,
        ...(template?._id ? { emailTemplate: template._id } : {}),
      };
    });
};

const initiateEssentialData = async () => {
  try {
    console.log("aaaaaaaaaaaaa");
    await insertedResponse();
    await insertTemplate();
    let admin = await AdminModel.findOne({ email: "leadxcrm@gmail.com" });
    if (!admin) {
      admin = await AdminModel.create({
        name: "Super Admin",
        email: "leadxcrm@gmail.com",
        password: "Om@123123",
        phone: { code: "91", number: "9175180106" },
        status: "Active",
        isVerified: false,
        isSuperAdmin: true,
        isTwoFactorAuth: true,
      });
      console.log("Super admin created successfully.");
    }

    let smtp = await SmtpModel.findOne({ name: "Global SMTP Settings" });
    if (!smtp && process.env.smtpPass) {
      smtp = await SmtpModel.create({
        name: "Global SMTP Settings",
        host: "smtp-relay.brevo.com",
        port: "587",
        secure: false,
        fromEmail: `noreply@leadx.com`,
        fromName: "LeadX CRM",
        username: "6eef12002@smtp-brevo.com",
        password: process.env.smtpPass,
      });
    }

    let aws = await Bucket.findOne({ name: "leadxcrm" });
    if (!aws) {
      aws = await Bucket.create({
        region: "ap-south-1",
        name: "leadxcrm",
        accesskey: process.env.awsAccesskey,
        secretkey: process.env.awsSecretkey,
        subpath: process.env.PROJECT_NAME,
      });
    }
    let defaultOCR = await ocr.findOne({ name: "Default OCR" });
    console.log("defaultOCR is", defaultOCR);
    if (!defaultOCR) {
      defaultOCR = await ocr.create({
        name: "Default OCR",
        key: "AIzaSyBX-Gt-MrOcxlN-9jyo1G_w1KzvI0gnlFs",
      });
    }
    console.log("OCr after is", defaultOCR);
    const app = await AppModel.findOne({ company: { $exists: false } });

    if (
      !app ||
      !app.defaultSMTPServer?.app ||
      !app.defaultS3Bucket?.app ||
      !app.defaultOcr?.app
    ) {
      await AppModel.findOneAndUpdate(
        { company: { $exists: false } },
        {
          $setOnInsert: {
            createdAt: new Date(),
          },
          $set: {
            ...(smtp?._id &&
              !app?.defaultSMTPServer?.id && {
                defaultSMTPServer: { isGlobal: true, id: smtp._id },
              }),
            ...(aws?._id &&
              !app?.defaultS3Bucket?.app && {
                defaultS3Bucket: { app: aws._id },
              }),
            ...(defaultOCR?._id &&
              !app?.defaultOcr?.app && {
                defaultOcr: { app: defaultOCR._id },
              }),
          },
        },
        { upsert: true, new: true },
      );
    }

    const inviteMemberTemplate = await EmailTemplateModel.findOne({
      category: "org_member_invited",
    });

    const settings = await SettingModel.findOne({
      company: { $exists: false },
    });

    if (!settings?.emailTemplates?.inviteMember && inviteMemberTemplate?._id) {
      await SettingModel.findOneAndUpdate(
        { company: { $exists: false } },
        {
          $set: {
            "emailTemplates.inviteMember": inviteMemberTemplate._id,
          },
        },
        { upsert: true, new: true },
      );
    }
    const initCategoryData = async () => {
      const categoryCount = await CategoryModel.countDocuments();
      console.log("categoryCount is", categoryCount);
      if (categoryCount === 0) {
        await CategoryModel.insertMany([
          ...emailTemplateCategoryJson,
          ...waTemplateCategoriesJson,
        ]);
      } else {
        for (const categoryData of [
          ...emailTemplateCategoryJson,
          ...waTemplateCategoriesJson,
        ]) {
          const existingCategory = await CategoryModel.findOne({
            category: categoryData.category,
            type: categoryData.type,
            panel: categoryData.panel,
          });
          // console.log("existingCategory is", existingCategory, categoryData);
          if (!existingCategory) {
            // console.log("categoryData is", categoryData);
            await CategoryModel.create(categoryData);
          } else {
            await CategoryModel.findOneAndUpdate(
              { _id: existingCategory._id },
              categoryData,
            );
          }
        }
      }
    };
    await initCategoryData();
    const existingTimezoneCount = await Timezone.countDocuments();
    console.log("existingTimezoneCount", existingTimezoneCount);
    if (!existingTimezoneCount) await initializeTimezonesFromFile(false, true);
    const initEmailTemplateCategoryData = async () => {
      await EmailTemplateCategoryModel.deleteMany({});
      const emailTemplateCategoryCount =
        await EmailTemplateCategoryModel.countDocuments();
      let emailTemplates = await EmailTemplateModel.find();
      // console.log("emailTemplates is", emailTemplates, emailTemplates.length);
      if (emailTemplates.length === 0) {
        emailTemplates = await insertTemplate();
      }
      if (emailTemplateCategoryCount === 0) {
        const categoriesToCreate = buildEmailTemplateCategories(
          emailTemplateCategoryJson,
          emailTemplates,
        );
        await EmailTemplateCategoryModel.insertMany(categoriesToCreate);
      }
      // if (emailTemplateCategoryCount !== emailTemplateCategoryJson.length) {
      //   for (const categoryData of emailTemplateCategoryJson) {
      //     const existingCategory = await EmailTemplateCategoryModel.findOne({
      //       category: categoryData.category,
      //     });
      //     console.log("!existingCategory is", !existingCategory);
      //     if (!existingCategory) {
      //       await EmailTemplateCategoryModel.create(categoryData);
      //     }
      //   }
      // }
    };
    await initEmailTemplateCategoryData();
    const initFeaturesData = async () => {
      const featuresCount = await FeatureModel.countDocuments();
      if (featuresCount === 0) {
        // console.log("featuresJson", featuresJson);
        await FeatureModel.insertMany(featuresJson);
        console.log("Features added successfully.");
      }
    };
    await initFeaturesData();
    await initDefaultPlansData(admin);

    await initSampleWidgets();
    await initDashboardPresets(admin);
    await loadCronJobs();
    await initializePaymentGateways();
  } catch (error) {
    console.error("Error during essential data initialization:", error);
    throw error;
  }
};
const razorpays = [
  {
    name: "Og",
    clientId: "rzp_test_3xN8l6VR6UUcug",
    clientSecret: "Zq56LFsf3nnnhYpwvbNaSooq",
  },
];
const phonepays = [
  {
    name: "Phonepe  1 edited",
    clientId: "TEST-M22VM7HKDS1RR_25041",
    clientSecret: "NDdlOWFkYWQtMjYwYi00ZmNiLTg5NDYtODkwYzNlMjVmNDkz",
  },
];
const manualPayments = [
  {
    name: "Manual Payment Name",
    details: "Manual Payment Name",
    isActive: true,
  },
];
const initializePaymentGateways = async () => {
  let razorpayCount = await Razorpay.findOne();
  let phonepeCount = await Phonepe.findOne();
  let manualPaymentCount = await manualPayment.findOne();

  if (!razorpayCount) razorpayCount = await Razorpay.insertMany(razorpays);
  razorpayCount = (await Razorpay.find())?.map((r) => r._id);
  if (!phonepeCount) phonepeCount = await Phonepe.insertMany(phonepays);
  phonepeCount = (await Phonepe.find())?.map((r) => r._id);
  if (!manualPaymentCount)
    manualPaymentCount = await manualPayment.insertMany(manualPayments);
  manualPaymentCount = (await manualPayment.find())?.map((r) => r._id);
  const currenciesCount = await CurrencyModel.countDocuments();
  if (!currenciesCount)
    await CurrencyModel.create({
      name: "INR",
      isoCode: "INR",
      symbol: "₹",
      paymentGateways: {
        razorpays: razorpayCount,
        phonepes: phonepeCount,
        manualPayments: manualPaymentCount,
      },
    });
};

const DEFAULT_SEED_PLAN_NAMES = ["Free", "Basic", "Pro"];

const buildSeedPlanFeatures = (features = [], tier = "free") => {
  const quantifiableLimitsByTier = {
    free: 100,
    basic: 1000,
    pro: 10000,
  };

  const limit = quantifiableLimitsByTier[tier] || quantifiableLimitsByTier.free;

  return (Array.isArray(features) ? features : [])
    .filter((feature) => feature?.status === "active")
    .map((feature) => ({
      feature: feature._id,
      quantity: feature?.quantifiableBoolean ? limit : 1,
    }));
};

const initDefaultPlansData = async (admin = null) => {
  const existingSeedPlans = await PlanModel.find();

  if (existingSeedPlans.length > 0) {
    console.log(
      "Some default seed plans already exist, skipping creation to avoid duplicates.",
      existingSeedPlans.map((plan) => plan.name),
    );
    return;
  }
  if (existingSeedPlans.length === DEFAULT_SEED_PLAN_NAMES.length) {
    console.log("Default seed plans already exist.");
    return;
  }

  const globalFeatures = await FeatureModel.find({
    company: { $exists: false },
    status: "active",
  }).sort({ order: 1, createdAt: 1 });

  if (!globalFeatures.length) {
    console.log("No global features found. Skipping default plan seed.");
    return;
  }

  const sharedMeta = {
    company: undefined,
    createdBy: admin?._id,
    updatedBy: admin?._id,
  };

  await PlanModel.insertMany([
    {
      name: "Free",
      description: "Starter free plan for basic CRM usage.",
      billingType: "free",
      maxUsersAllowed: -1,
      features: buildSeedPlanFeatures(globalFeatures, "free"),
      status: "active",
      ...sharedMeta,
    },
    {
      name: "Basic",
      description: "Entry-level paid plan for growing teams.",
      billingType: "paid",
      currency: "INR",
      countries: ["IN"],
      billingCycles: [
        {
          type: "Monthly",
          price: 499,
          enableSalePrice: false,
          saleDurationType: "noDate",
        },
        {
          type: "Yearly",
          price: 4990,
          enableSalePrice: false,
          saleDurationType: "noDate",
        },
      ],
      maxUsersAllowed: 10,
      features: buildSeedPlanFeatures(globalFeatures, "basic"),
      status: "active",
      ...sharedMeta,
    },
    {
      name: "Pro",
      description: "Advanced paid plan for larger teams and higher usage.",
      billingType: "paid",
      currency: "INR",
      countries: ["IN"],
      billingCycles: [
        {
          type: "Monthly",
          price: 999,
          enableSalePrice: false,
          saleDurationType: "noDate",
        },
        {
          type: "Yearly",
          price: 9990,
          enableSalePrice: false,
          saleDurationType: "noDate",
        },
      ],
      maxUsersAllowed: 25,
      features: buildSeedPlanFeatures(globalFeatures, "pro"),
      isRecommended: true,
      status: "active",
      ...sharedMeta,
    },
  ]);

  console.log("Default seed plans created successfully.");
};

async function dropAllCollections() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  for (const { name } of collections) {
    try {
      await db.collection(name).drop();
      console.log(`Dropped collection: ${name}`);
    } catch (error) {
      if (error.codeName === "NamespaceNotFound") {
        console.log(`Collection ${name} does not exist.`);
      } else {
        console.error(`Error dropping collection ${name}:`, error);
      }
    }
  }
}
const initSampleWidgets = async () => {
  const widgetCount = await WidgetModel.countDocuments();
  // originalLog("widgetCount", widgetCount);
  if (widgetCount === 0) {
    await WidgetModel.insertMany(widgets);
  }
};

const buildPresetWidgets = (widgetDocs = [], predicate, includeType = true) => {
  const widgetByName = new Map(
    widgetDocs.map((widget) => [widget.name, widget]),
  );

  return widgets
    .filter(predicate)
    .map((widgetConfig) => {
      const widget = widgetByName.get(widgetConfig.name);
      if (!widget?._id) return null;

      return {
        widget: widget._id,
        ...(includeType ? { type: widgetConfig.type } : {}),
      };
    })
    .filter(Boolean);
};

const initDashboardPresets = async (admin = null) => {
  const presetCount = await DashboardPresetsModel.countDocuments();
  if (presetCount > 0) {
    console.log("Dashboard presets already exist, skipping seed.");
    return;
  }

  const widgetDocs = await WidgetModel.find();
  if (!widgetDocs.length) {
    console.log("No widgets found. Skipping dashboard preset seed.");
    return;
  }

  const presetMeta = {
    admin: admin?._id,
    createdBy: admin?._id,
    updatedBy: admin?._id,
  };

  await DashboardPresetsModel.insertMany([
    {
      name: "All",
      widgets: buildPresetWidgets(widgetDocs, () => true, false),
      ...presetMeta,
    },
    {
      name: "Sidebar Data",
      widgets: buildPresetWidgets(
        widgetDocs,
        (widget) => widget.type === "sidebar",
      ),
      ...presetMeta,
    },
    {
      name: "Stats",
      widgets: buildPresetWidgets(widgetDocs, (widget) =>
        ["count", "percent", "composed", "area", "pie"].includes(widget.type),
      ),
      ...presetMeta,
    },
  ]);

  console.log("Dashboard presets seeded successfully.");
};

async function loadCronJobs() {
  const jobs = await jobManager.loadAll(cronJobsToRun);
  console.log(`Loading ${jobs.length} active cron job(s).`);
}
const insertedResponse = async () => {
  const count = await ResponseMessageModel.countDocuments();
  if (count > 0) return;
  let insertedResponses = [];
  try {
    insertedResponses = await ResponseMessageModel.insertMany(
      [...responseMsgsAdminJson, ...responseMsgsOrgJson],
      {
        ordered: false,
      },
    );
  } catch (error) {
    console.log("error is", error);
    if (error.insertedDocs) insertedResponses = error.insertedDocs;
  }
  // console.log(
  //   "Inserted response messages:",
  //   [...responseMsgsAdminJson, ...responseMsgsOrgJson]?.length,
  //   insertedResponses,
  // );
  return insertedResponses;
};
const insertTemplate = async () => {
  const count = await EmailTemplateModel.countDocuments();

  if (count > 0) return;
  let insertedTemplates = [];
  try {
    insertedTemplates = await EmailTemplateModel.insertMany(
      [...orgEmailTemplatesJson, ...adminEmailTemplatesJson],
      { ordered: false },
    );
  } catch (error) {
    if (error.insertedDocs) insertedTemplates = error.insertedDocs;
  }
  // console.log("Inserted email templates:", insertedTemplates.length);
  return insertedTemplates;
};
module.exports = {
  initiateDB,
  initiateEssentialData,
  initSampleWidgets,
  initDashboardPresets,
  loadCronJobs,
  insertedResponse,
  insertTemplate,
  initializePaymentGateways,
};
