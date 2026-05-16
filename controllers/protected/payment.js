const Payment = require("../../patient-management-system-shared-models/models/payment");
const CouponModel = require("../../patient-management-system-shared-models/models/coupon");
const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");
const Subscription = require("../../patient-management-system-shared-models/models/subscription");
const SeatsPaymentHistory = require("../../patient-management-system-shared-models/models/seatsPaymentHistory");
const { default: mongoose } = require("mongoose");
const {
  paymentSuccessInvoiceEmail,
} = require("../../patient-management-system-shared-models/utils/helper");
const {
  applySeatManagementChange,
} = require("../../patient-management-system-shared-models/utils/subscriptionLifecycle");

// Get All Payment
const getAllPayment = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: Payment,
      query: req.query,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
        ["company", "Company", "companies"],
        ["invoiceFile", "File", "Files"],
        ["subscription", "Subscription", "subscriptions"],
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
          $lookup: {
            from: "manualpaymentrequestmodals",
            let: { orderId: "$orderid" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", { $toObjectId: "$$orderId" }],
                  },
                },
              },
              {
                $lookup: {
                  from: "files",
                  localField: "proof", // field inside manualpaymentrequestmodals
                  foreignField: "_id",
                  as: "proof",
                },
              },
              {
                $unwind: {
                  path: "$proof",
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
            as: "orderid",
          },
        },
        {
          $unwind: {
            path: "$orderid",
            preserveNullAndEmptyArrays: true,
          },
        },
      ],
    });

    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

// Get Single Payment
const getPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await Payment.aggregate([
      { $match: { _id: mongoose.Types.ObjectId.createFromHexString(id) } },
      {
        $lookup: {
          from: "manualpaymentrequestmodals",
          let: { orderId: "$orderid" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$orderId" }],
                },
              },
            },
            {
              $lookup: {
                from: "files",
                localField: "proof", // field inside manualpaymentrequestmodals
                foreignField: "_id",
                as: "proof",
              },
            },
            {
              $unwind: {
                path: "$proof",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
          as: "orderid",
        },
      },
      {
        $unwind: {
          path: "$orderid",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "files",
          localField: "invoiceFile",
          foreignField: "_id",
          as: "invoiceFile",
        },
      },
      {
        $unwind: {
          path: "$invoiceFile",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);
    console.log("doc is", doc);
    if (!doc[0]) await createError({ name: "PaymentNotFound_400" });

    await sendResponse(res, doc[0]);
  } catch (err) {
    next(err);
  }
};

// Update Payment
const updatePayment = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;

    const doc = await Payment.findById(id).populate("createdBy");
    if (!doc) await createError({ name: "PaymentNotFound_400" });
    const wasActive = doc.status == "active";
    Object.entries({
      status: "status",
    }).forEach(([key, value]) => {
      if (req.body[key] !== undefined) doc[value] = req.body[key];
    });
    const [subscription, seatsPaymentHistory] = await Promise.all([
      Subscription.findOne({
        payment: doc._id,
      }),
      doc?.seatsPaymentHistory
        ? SeatsPaymentHistory.findById(doc.seatsPaymentHistory).populate(
            "subscriptionChange subscription",
          )
        : null,
    ]);
    if (!subscription && !seatsPaymentHistory)
      await createError({
        name: "SubscriptionNotFoundOrPaymentForSubscriptionNotFound_400",
      });
    const activeSubscriptionExists = await Subscription.find({
      company: doc.company,
      status: "active",
      _id: { $ne: subscription?._id },
    });
    console.log("activeSubscriptionExists is", activeSubscriptionExists);
    if (doc.paymentFor === "seats_upgrade" && seatsPaymentHistory) {
      if (req.body.status === "success") {
        await applySeatManagementChange({
          changeRequest: seatsPaymentHistory.subscriptionChange,
          updatedBy: admin._id,
        });
      }
      seatsPaymentHistory.status =
        req.body.status === "success" ? "success" : "failed";
      seatsPaymentHistory.updatedBy = admin._id;
      await seatsPaymentHistory.save();
      if (wasActive !== req.body.status && req.body.status == "success") {
        const invoiceSubscription =
          seatsPaymentHistory.subscription || subscription;
        if (invoiceSubscription) {
          await paymentSuccessInvoiceEmail(invoiceSubscription, doc);
        }
      }
    } else if (subscription) {
      const statusMap = {
        success: "active",
        pending: "pending",
        failed: "deactive",
      };
      if (activeSubscriptionExists?.length > 1) {
        await createError({ name: "ActiveSubscriptionExists_400" });
      } else if (activeSubscriptionExists?.length == 1) {
        subscription.status = "queued";
      } else {
        subscription.status = statusMap[doc.status];
      }
      await subscription.save();
      console.log("wasActive is", wasActive, req.body.status);
      if (wasActive !== req.body.status && req.body.status == "success") {
        const subscription = await Subscription.findOne({
          company: doc.company,
        }).populate("createdBy company");
        await paymentSuccessInvoiceEmail(subscription, doc);
      }
    }

    doc.updatedBy = admin._id;

    await doc.save();
    await sendResponse(res, doc, { name: "PaymentUpdated_200" });
  } catch (err) {
    next(err);
  }
};

// Delete Payment(s)
const deletePayment = async (req, res, next) => {
  try {
    await bulkDelete({
      model: Payment,
      req,
      populate: [],
      error: "NoPaymentSelected_400",
    });
    await sendResponse(res, null, { name: "PaymentDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllPayment,
  getPayment,
  updatePayment,
  deletePayment,
};
