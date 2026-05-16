const CurrencyModel = require("../../patient-management-system-shared-models/models/currency");
const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const createCurrency = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { name, isoCode, symbol, paymentGateways } = req.body;
    checkRequired({ name, isoCode, symbol });

    const existing = await CurrencyModel.findOne({
      $or: [
        { name: name.trim(), company: undefined },
        { isoCode: isoCode.trim().toUpperCase(), company: undefined },
      ],
    });
    if (existing) await createError({ name: "CurrencyAlreadyExists_400" });

    const doc = new CurrencyModel({
      name: name.trim(),
      isoCode: isoCode.trim().toUpperCase(),
      symbol: symbol.trim(),
      createdBy: admin._id,
      updatedBy: admin._id,
      paymentGateways: paymentGateways,
    });
    await doc.save();
    await sendResponse(res, doc, { name: "CurrencyCreated_200" });
  } catch (err) {
    next(err);
  }
};

const getAllCurrency = async (req, res, next) => {
  try {
    const admin = req.admin;
    const docs = await applyQueryOptions({
      data: CurrencyModel,
      query: req.query,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      aggregationPipeline: [
        {
          $lookup: {
            from: "razorpays",
            localField: "paymentGateways.razorpays",
            foreignField: "_id",
            as: "paymentGateways.razorpays",
          },
        },
        {
          $lookup: {
            from: "phonepes",
            localField: "paymentGateways.phonepes",
            foreignField: "_id",
            as: "paymentGateways.phonepes",
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
      ],
      additionalFilters: { company: undefined },
    });
    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const getCurrency = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await CurrencyModel.findOne({
      _id: id,
      company: undefined,
    });
    if (!doc) await createError({ name: "CurrencyNotFound_400" });
    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updateCurrency = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const doc = await CurrencyModel.findOne({
      _id: id,
      company: undefined,
    });

    if (!doc) await createError({ name: "CurrencyNotFound_400" });

    Object.entries({
      name: "name",
      isoCode: "isoCode",
      symbol: "symbol",
    }).forEach(([key, value]) => {
      if (req.body[key] !== undefined) {
        doc[value] =
          key === "isoCode"
            ? req.body[key].trim().toUpperCase()
            : req.body[key].trim();
      }
    });
    if (req.body.paymentGateways) {
      doc.paymentGateways = req.body.paymentGateways;
    }

    doc.updatedBy = admin._id;

    await doc.save();
    await sendResponse(res, doc, { name: "CurrencyUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const deleteCurrency = async (req, res, next) => {
  try {
    await bulkDelete({
      model: CurrencyModel,
      req,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      error: "NoCurrencySelected_400",
    });
    await sendResponse(res, null, { name: "CurrencyDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCurrency,
  getAllCurrency,
  getCurrency,
  updateCurrency,
  deleteCurrency,
};
