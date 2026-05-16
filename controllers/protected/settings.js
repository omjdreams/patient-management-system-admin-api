const CouponModel = require("../../patient-management-system-shared-models/models/coupon");
const SettingModel = require("../../patient-management-system-shared-models/models/setting");
const {
  createError,
  sendResponse,
} = require("../../patient-management-system-shared-models/utils/utils");

const DEFAULT_SUBSCRIPTION_POLICIES = {
  queue: {
    maxQueuedAllowed: -1,
    seatIncreasePricingMode: "charge_full_current_cycle",
  },
  scheduledPayment: { collectionMode: "pay_now" },
  upgrade: {
    prorataEnabled: true,
    validityMode: "preserve_billing_date",
    featureUsageResetMode: "carry_forward",
  },
  downgrade: {
    prorataEnabled: true,
    validityMode: "preserve_billing_date",
    featureUsageResetMode: "carry_forward",
    featureOverLimitMode: "block_purchase",
  },
};

const GLOBAL_SETTINGS_FILTER = {
  $or: [{ company: { $exists: false } }, { company: null }],
};

const mergeSubscriptionPolicies = (policies = {}) => ({
  queue: {
    ...DEFAULT_SUBSCRIPTION_POLICIES.queue,
    ...(policies?.queue || {}),
  },
  scheduledPayment: {
    ...DEFAULT_SUBSCRIPTION_POLICIES.scheduledPayment,
    ...(policies?.scheduledPayment || {}),
  },
  upgrade: {
    ...DEFAULT_SUBSCRIPTION_POLICIES.upgrade,
    ...(policies?.upgrade || {}),
  },
  downgrade: {
    ...DEFAULT_SUBSCRIPTION_POLICIES.downgrade,
    ...(policies?.downgrade || {}),
  },
});

const getSettings = async (req, res, next) => {
  try {
    const doc = await SettingModel.findOne(GLOBAL_SETTINGS_FILTER).lean();

    if (!doc) await createError({ name: "SettingNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const admin = req.admin;

    const doc = await SettingModel.findOne(GLOBAL_SETTINGS_FILTER);
    console.log("docis", doc, req.body);
    if (!doc) await createError({ name: "SettingNotFound_400" });

    Object.entries({
      developerMode: "developerMode",
    }).forEach(([key, value]) => {
      if (req.body[key] !== undefined) doc[value] = req.body[key];
    });

    // update maxmind settings
    if (req.body.maxmind) {
      doc.maxmind = doc.maxmind || {};
      const { accountId, licenseKey, databaseType } = req.body.maxmind;
      if (accountId !== undefined) doc.maxmind.accountId = accountId;
      if (licenseKey !== undefined) doc.maxmind.licenseKey = licenseKey;
      if (databaseType !== undefined) doc.maxmind.databaseType = databaseType;
    }

    if (req.body.teamSettings?.assignType !== undefined) {
      doc.teamSettings = doc.teamSettings || {};
      doc.teamSettings.assignType = req.body.teamSettings.assignType;
    }

    if (req.body.notificationSettings !== undefined) {
      doc.notificationSettings = {
        ...(doc.notificationSettings?.toObject
          ? doc.notificationSettings.toObject()
          : doc.notificationSettings || {}),
        ...req.body.notificationSettings,
        adminReports: {
          ...(doc.notificationSettings?.adminReports?.toObject
            ? doc.notificationSettings.adminReports.toObject()
            : doc.notificationSettings?.adminReports || {}),
          ...(req.body.notificationSettings?.adminReports || {}),
        },
      };
    }

    if (req.body.subscriptionPolicies) {
      doc.subscriptionPolicies = {
        ...(doc.subscriptionPolicies?.toObject
          ? doc.subscriptionPolicies.toObject()
          : doc.subscriptionPolicies || {}),
        ...req.body.subscriptionPolicies,
        queue: {
          ...(doc.subscriptionPolicies?.queue?.toObject
            ? doc.subscriptionPolicies.queue.toObject()
            : doc.subscriptionPolicies?.queue || {}),
          ...(req.body.subscriptionPolicies.queue || {}),
        },
        scheduledPayment: {
          ...(doc.subscriptionPolicies?.scheduledPayment?.toObject
            ? doc.subscriptionPolicies.scheduledPayment.toObject()
            : doc.subscriptionPolicies?.scheduledPayment || {}),
          ...(req.body.subscriptionPolicies.scheduledPayment || {}),
        },
        upgrade: {
          ...(doc.subscriptionPolicies?.upgrade?.toObject
            ? doc.subscriptionPolicies.upgrade.toObject()
            : doc.subscriptionPolicies?.upgrade || {}),
          ...(req.body.subscriptionPolicies.upgrade || {}),
        },
        downgrade: {
          ...(doc.subscriptionPolicies?.downgrade?.toObject
            ? doc.subscriptionPolicies.downgrade.toObject()
            : doc.subscriptionPolicies?.downgrade || {}),
          ...(req.body.subscriptionPolicies.downgrade || {}),
        },
      };
    }

    doc.updatedBy = admin._id;
    doc.timezone = req.body.timezone || doc.timezone || null;
    await doc.save();
    await sendResponse(res, doc, { name: "SettingsUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const getPlanGlobalSettings = async (req, res, next) => {
  try {
    let doc = await SettingModel.collection.findOne(GLOBAL_SETTINGS_FILTER);
    if (!doc) {
      await SettingModel.collection.insertOne({
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      doc = await SettingModel.collection.findOne(GLOBAL_SETTINGS_FILTER);
    }

    await sendResponse(res, {
      subscriptionPolicies: mergeSubscriptionPolicies(
        doc?.subscriptionPolicies,
      ),
    });
  } catch (err) {
    next(err);
  }
};

const updatePlanGlobalSettings = async (req, res, next) => {
  try {
    const admin = req.admin;
    const existingDoc = await SettingModel.collection.findOne(
      GLOBAL_SETTINGS_FILTER,
    );
    const mergedPolicies = mergeSubscriptionPolicies(
      req.body?.subscriptionPolicies || {},
    );

    if (existingDoc?._id) {
      await SettingModel.collection.updateOne(
        { _id: existingDoc._id },
        {
          $set: {
            subscriptionPolicies: mergedPolicies,
            updatedBy: admin?._id || null,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      await SettingModel.collection.insertOne({
        subscriptionPolicies: mergedPolicies,
        updatedBy: admin?._id || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await sendResponse(
      res,
      {
        subscriptionPolicies: mergedPolicies,
      },
      { name: "SettingsUpdated_200" },
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getPlanGlobalSettings,
  updatePlanGlobalSettings,
};
