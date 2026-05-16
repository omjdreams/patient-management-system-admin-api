const SubscriptionModel = require("../../patient-management-system-shared-models/models/subscription");
const PlanModel = require("../../patient-management-system-shared-models/models/plan");
const CouponModel = require("../../patient-management-system-shared-models/models/coupon");
const FeatureModel = require("../../patient-management-system-shared-models/models/feature");
const {
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
  getMemberCount,
} = require("../../patient-management-system-shared-models/utils/utils");
const MemberModel = require("../../patient-management-system-shared-models/models/member");

const BILLING_CYCLE_TYPES = ["Monthly", "Quarterly", "Half Yearly", "Yearly"];

const featureIdToString = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value?._id) return value._id.toString();
  if (value?.toString) return value.toString();
  return null;
};

const normalizeFeatureRows = (features = [], billingCycles = []) => {
  const selectedCycles = new Set(
    (Array.isArray(billingCycles) ? billingCycles : [])
      .map((cycle) => cycle?.type)
      .filter((cycle) => BILLING_CYCLE_TYPES.includes(cycle)),
  );

  return (Array.isArray(features) ? features : []).map((featureRow) => {
    const nextRow = { ...featureRow };
    const quantity =
      featureRow?.quantity === "" || featureRow?.quantity === undefined
        ? undefined
        : Number(featureRow?.quantity);
    nextRow.quantity = Number.isNaN(quantity) ? undefined : quantity;

    const cycleMap = new Map();
    (Array.isArray(featureRow?.billingCycleQuantities)
      ? featureRow.billingCycleQuantities
      : []
    ).forEach((item) => {
      const billingCycle = item?.billingCycle;
      if (!selectedCycles.has(billingCycle)) return;
      const qty =
        item?.quantity === "" || item?.quantity === undefined
          ? undefined
          : Number(item?.quantity);
      cycleMap.set(billingCycle, Number.isNaN(qty) ? undefined : qty);
    });

    nextRow.billingCycleQuantities = Array.from(selectedCycles).map(
      (billingCycle) => ({
        billingCycle,
        quantity: cycleMap.has(billingCycle)
          ? cycleMap.get(billingCycle)
          : nextRow.quantity,
      }),
    );

    return nextRow;
  });
};

const applyPlanDetailsPatch = (
  basePlanDetails = {},
  incomingPlanDetails = {},
  quantifiableFeatureIds = new Set(),
) => {
  const updated = { ...basePlanDetails };

  if (incomingPlanDetails?.maxUsersAllowed !== undefined) {
    const users = Number(incomingPlanDetails.maxUsersAllowed);
    if (!Number.isNaN(users)) updated.maxUsersAllowed = users;
  }

  if (Array.isArray(incomingPlanDetails?.features)) {
    const incomingMap = new Map();
    incomingPlanDetails.features.forEach((item) => {
      const id = featureIdToString(item?.feature);
      const qty = Number(item?.quantity);
      const billingCycleQuantities = Array.isArray(item?.billingCycleQuantities)
        ? item.billingCycleQuantities
        : [];
      if (id && (!Number.isNaN(qty) || billingCycleQuantities.length > 0)) {
        incomingMap.set(id, {
          quantity: Number.isNaN(qty) ? undefined : qty,
          billingCycleQuantities,
        });
      }
    });

    updated.features = (basePlanDetails?.features || []).map((feature) => {
      const id = featureIdToString(feature?.feature);
      if (!id || !incomingMap.has(id) || !quantifiableFeatureIds.has(id)) {
        return feature;
      }
      const incoming = incomingMap.get(id);
      return {
        ...feature,
        quantity: incoming?.quantity,
        billingCycleQuantities: incoming?.billingCycleQuantities,
      };
    });

    updated.features = normalizeFeatureRows(
      updated.features,
      basePlanDetails?.billingCycles,
    );
  }

  return updated;
};

// Create Subscription
const createSubscription = async (req, res, next) => {
  try {
    const admin = req.admin;
    const {
      company,
      coupon,
      discount,
      plan,
      trial,
      billingCycle,
      users,
      payment,
      startDate,
      endDate,
      status,
      type,
    } = req.body;

    checkRequired({ company, plan, billingCycle, users, startDate, endDate });
    const planDoc = await PlanModel.findById(plan).lean();
    if (!planDoc) await createError({ name: "PlanNotFound_400" });
    const normalizedPlanDoc = {
      ...planDoc,
      features: normalizeFeatureRows(planDoc?.features, planDoc?.billingCycles),
    };
    const currentUserCount = await MemberModel.countDocuments({
      company,
      status: { $in: ["accepted", "owner", "invited", "blocked"] },
    });
    if (
      normalizedPlanDoc?.maxUsersAllowed < (users || 1) ||
      (users || 1) < currentUserCount
    ) {
      return await createError({ name: "SubscriptionUserLimitExceeded_400" });
    }
    if (coupon) {
      const couponDoc = await CouponModel.findById(coupon).lean();
      if (!couponDoc) await createError({ name: "CouponNotFound_400" });
    }

    const doc = new SubscriptionModel({
      company,
      coupon,
      discount,
      plan,
      trial,
      planDetails: normalizedPlanDoc,
      billingCycle,
      users,
      payment,
      startDate,
      endDate,
      status,
      type,
      createdBy: admin._id,
      updatedBy: admin._id,
    });

    await doc.save();
    await sendResponse(res, doc, { name: "SubscriptionCreated_200" });
  } catch (err) {
    next(err);
  }
};

// Get All Subscriptions
const getAllSubscription = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: SubscriptionModel,
      query: req.query,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
        ["company", "Company", "companies"],
        ["plan", "Plan", "plans"],
        ["coupon", "Coupon", "coupons"],
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

// Get Single Subscription
const getSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await SubscriptionModel.findById(id)
      .populate("planDetails.features.feature")
      .populate("company")
      .populate("plan")
      .populate("coupon")
      .populate("createdBy")
      .populate("updatedBy");

    if (!doc) await createError({ name: "SubscriptionNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

// Update Subscription
const updateSubscription = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;

    const doc = await SubscriptionModel.findById(id);
    if (!doc) await createError({ name: "SubscriptionNotFound_400" });

    let nextPlanDetails = doc?.planDetails?.toObject
      ? doc.planDetails.toObject()
      : { ...(doc.planDetails || {}) };

    if (req.body.plan !== undefined) {
      const planDoc = await PlanModel.findById(req.body.plan).lean();
      if (!planDoc) await createError({ name: "PlanNotFound_400" });
      nextPlanDetails = {
        ...planDoc,
        features: normalizeFeatureRows(
          planDoc?.features,
          planDoc?.billingCycles,
        ),
      };
    }

    if (req.body.planDetails !== undefined) {
      const incomingFeatureIds = (req.body?.planDetails?.features || [])
        .map((item) => featureIdToString(item?.feature))
        .filter(Boolean);
      const quantifiableDocs = incomingFeatureIds?.length
        ? await FeatureModel.find({
            _id: { $in: incomingFeatureIds },
            quantifiableBoolean: true,
          })
            .select("_id")
            .lean()
        : [];
      const quantifiableFeatureIds = new Set(
        quantifiableDocs.map((item) => item._id.toString()),
      );

      nextPlanDetails = applyPlanDetailsPatch(
        nextPlanDetails,
        req.body.planDetails,
        quantifiableFeatureIds,
      );
    }
    nextPlanDetails.features = normalizeFeatureRows(
      nextPlanDetails?.features,
      nextPlanDetails?.billingCycles,
    );
    doc.planDetails = nextPlanDetails;

    if (req.body.coupon !== undefined && req.body.coupon) {
      const couponDoc = await CouponModel.findById(req.body.coupon).lean();
      if (!couponDoc) await createError({ name: "CouponNotFound_400" });
    }

    Object.entries({
      company: "company",
      coupon: "coupon",
      discount: "discount",
      plan: "plan",
      trial: "trial",
      billingCycle: "billingCycle",
      users: "users",
      payment: "payment",
      startDate: "startDate",
      endDate: "endDate",
      status: "status",
      type: "type",
    }).forEach(([key, value]) => {
      if (req.body[key] !== undefined) doc[value] = req.body[key];
    });

    const currentUserCount = await MemberModel.countDocuments({
      company: doc.company,
      status: { $in: ["accepted", "owner", "invited", "blocked"] },
    });

    if (
      doc?.planDetails?.maxUsersAllowed < (doc.users || 1) ||
      (doc.users || 1) < currentUserCount
    ) {
      return await createError({ name: "SubscriptionUserLimitExceeded_400" });
    }

    doc.updatedBy = admin._id;

    await doc.save();
    await sendResponse(res, doc, { name: "SubscriptionUpdated_200" });
  } catch (err) {
    next(err);
  }
};

// Delete Subscription(s)
const deleteSubscription = async (req, res, next) => {
  try {
    await bulkDelete({
      model: SubscriptionModel,
      req,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
        ["company", "Company", "companies"],
        ["plan", "Plan", "plans"],
      ],
      error: "NoSubscriptionSelected_400",
    });
    await sendResponse(res, null, { name: "SubscriptionDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createSubscription,
  getAllSubscription,
  getSubscription,
  updateSubscription,
  deleteSubscription,
};
