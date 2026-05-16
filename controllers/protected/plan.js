const PlanModel = require("../../patient-management-system-shared-models/models/plan");
const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const BILLING_CYCLE_TYPES = ["Monthly", "Quarterly", "Half Yearly", "Yearly"];

const normalizeFeatureQuantities = (features = [], billingCycles = []) => {
  const selectedCycles = new Set(
    (Array.isArray(billingCycles) ? billingCycles : [])
      .map((cycle) => cycle?.type)
      .filter((cycle) => BILLING_CYCLE_TYPES.includes(cycle)),
  );

  return (Array.isArray(features) ? features : []).map((featureRow) => {
    const nextRow = { ...featureRow };
    const currentQuantity =
      featureRow?.quantity === "" || featureRow?.quantity === undefined
        ? undefined
        : Number(featureRow?.quantity);
    nextRow.quantity = Number.isNaN(currentQuantity)
      ? undefined
      : currentQuantity;

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
const checkForStatusActive = async (
  name,
  billingType,
  currency,
  countries,
  maxUsersAllowed,
  billingCycles,
  features,
) => {
  checkRequired({
    name,
    billingType,

    maxUsersAllowed,
    features,
  });
  if (billingType == "paid") {
    checkRequired({
      currency,
      countries,
      billingCycles,
    });
  }
  if (
    billingCycles?.find(
      (cycle) =>
        !cycle?.price ||
        (cycle?.enableSalePrice
          ? !cycle?.salePrice ||
            cycle?.salePrice > cycle?.price ||
            (cycle?.saleDurationType == "custom"
              ? !cycle?.saleStartDate || !cycle?.saleEndDate
              : false)
          : false),
    )
  ) {
    await createError({ name: "InvalidBillingCycle_400" });
  }
};
const createPlan = async (req, res, next) => {
  try {
    const admin = req.admin;
    const {
      name,
      description,
      billingType,
      currency,
      countries,
      billingCycles,
      maxUsersAllowed,
      features,
      enableTrial,
      trialDurationType,
      trialDurationCustom,
      enableAllowExtraDuration,
      allowExtraDuration,
      extraDurationCustom,
      isRecommended,
      status,
    } = req.body;

    checkRequired({
      name,
      billingType,
      maxUsersAllowed,
    });
    if (billingType == "paid") {
      checkRequired({
        currency,
        countries,
        billingCycles,
      });
    }

    const existing = await PlanModel.findOne({
      name: name.trim(),
      company: undefined,
    });
    if (existing) await createError({ name: "PlanNameAlreadyExists_400" });

    const doc = new PlanModel({
      name: name.trim(),
      description,
      billingType,
      currency,
      countries,
      billingCycles,
      maxUsersAllowed,
      features: normalizeFeatureQuantities(features, billingCycles),
      enableTrial,
      trialDurationType,
      trialDurationCustom,
      allowExtraDuration,
      enableAllowExtraDuration,
      extraDurationCustom,
      isRecommended,
      status,
      company: undefined,
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    if (req.body.status == "active") {
      await checkForStatusActive(
        name,
        billingType,
        currency,
        countries,
        maxUsersAllowed,
        billingCycles,
        normalizeFeatureQuantities(features, billingCycles),
      );
    }
    await doc.save();
    await sendResponse(res, doc, { name: "PlanCreated_200" });
  } catch (err) {
    next(err);
  }
};

const getAllPlan = async (req, res, next) => {
  try {
    const admin = req.admin;
    const docs = await applyQueryOptions({
      data: PlanModel,
      query: req.query,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      aggregationPipeline: [
        {
          $lookup: {
            from: "features",
            localField: "features.feature",
            foreignField: "_id",
            as: "featureDocs",
          },
        },
        {
          $addFields: {
            features: {
              $map: {
                input: "$features",
                as: "f",
                in: {
                  $mergeObjects: [
                    "$$f",
                    {
                      feature: {
                        $first: {
                          $filter: {
                            input: "$featureDocs",
                            as: "fd",
                            cond: { $eq: ["$$fd._id", "$$f.feature"] },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $project: {
            featureDocs: 0,
          },
        },

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
          $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "plan",
            as: "subscriptions",
          },
        },
        {
          $addFields: {
            subscriptionCount: {
              $size: "$subscriptions",
            },
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

const getPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await PlanModel.findOne({
      _id: id,
      company: undefined,
    }).populate("features.feature");

    if (!doc) await createError({ name: "PlanNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const doc = await PlanModel.findOne({
      _id: id,
      company: undefined,
    });

    if (!doc) await createError({ name: "PlanNotFound_400" });

    const updateFields = {
      name: "name",
      description: "description",
      billingType: "billingType",
      currency: "currency",
      countries: "countries",
      billingCycles: "billingCycles",
      maxUsersAllowed: "maxUsersAllowed",
      features: "features",
      enableTrial: "enableTrial",
      trialDurationType: "trialDurationType",
      trialDurationCustom: "trialDurationCustom",
      allowExtraDurationType: "allowExtraDurationType",
      enableAllowExtraDuration: "enableAllowExtraDuration",
      extraDurationCustom: "extraDurationCustom",
      isRecommended: "isRecommended",
      status: "status",
    };

    Object.entries(updateFields).forEach(([key, value]) => {
      if (req.body[key] !== undefined) {
        doc[value] = key === "name" ? req.body[key].trim() : req.body[key];
      }
    });
    if (
      req.body.features !== undefined ||
      req.body.billingCycles !== undefined
    ) {
      doc.features = normalizeFeatureQuantities(
        req.body.features !== undefined ? req.body.features : doc.features,
        req.body.billingCycles !== undefined
          ? req.body.billingCycles
          : doc.billingCycles,
      );
    }
    if (req.body.status == "active") {
      const {
        name,
        billingType,
        currency,
        countries,
        maxUsersAllowed,
        billingCycles,
        features,
      } = req.body;
      await checkForStatusActive(
        name ?? doc.name,
        billingType ?? doc.billingType,
        currency ?? doc.currency,
        countries ?? doc.countries,
        maxUsersAllowed ?? doc.maxUsersAllowed,
        billingCycles ?? doc.billingCycles,
        normalizeFeatureQuantities(
          features !== undefined ? features : doc.features,
          billingCycles !== undefined ? billingCycles : doc.billingCycles,
        ),
      );
    }

    doc.updatedBy = admin._id;

    await doc.save();
    await sendResponse(res, doc, { name: "PlanUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    await bulkDelete({
      model: PlanModel,
      req,
      populate: [],
      error: "NoPlanSelected_400",
    });
    await sendResponse(res, null, { name: "PlanDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPlan,
  getAllPlan,
  getPlan,
  updatePlan,
  deletePlan,
};
