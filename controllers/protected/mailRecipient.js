const MailRecipientModel = require("../../patient-management-system-shared-models/models/mailRecipient");
const {
  checkRequired,
  createError,
  sendResponse,
  applyQueryOptions,
  parseFilters,
} = require("../../patient-management-system-shared-models/utils/utils");

const createMailRecipient = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { name, email } = req.body;
    checkRequired({ name, email });

    const existing = await MailRecipientModel.findOne({
      email: email.trim().toLowerCase(),
    });
    if (existing) await createError({ name: "MailRecipientAlreadyExists_400" });

    const doc = new MailRecipientModel({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    await doc.save();
    await sendResponse(res, doc, { name: "MailRecipientCreated_200" });
  } catch (err) {
    next(err);
  }
};

const getAllMailRecipients = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: MailRecipientModel,
      query: req.query,
      populate: [
        ["createdBy", "Admin", "admins"],
        ["updatedBy", "Admin", "admins"],
      ],
    });
    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const getMailRecipient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await MailRecipientModel.findById(id);
    if (!doc) await createError({ name: "MailRecipientNotFound_400" });
    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updateMailRecipient = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const doc = await MailRecipientModel.findById(id);
    if (!doc) await createError({ name: "MailRecipientNotFound_400" });

    if (req.body.name !== undefined) doc.name = req.body.name.trim();
    if (req.body.email !== undefined)
      doc.email = req.body.email.trim().toLowerCase();
    const uniqueEmail = await MailRecipientModel.findOne({
      email: doc.email,
      _id: { $ne: id },
    });
    if (uniqueEmail)
      await createError({ name: "MailRecipientAlreadyExists_400" });
    doc.updatedBy = admin._id;

    await doc.save();
    await sendResponse(res, doc, { name: "MailRecipientUpdated_200" });
  } catch (err) {
    next(err);
  }
};

// const deleteMailRecipient = async (req, res, next) => {
//   try {
//  await bulkDelete({
//   model: MailRecipientModel,
//   req,
//   populate: [],
//   error: "NoMailRecipientSelected_400",
// });
//     await sendResponse(res, null, { name: "MailRecipientDeleted_200" });
//   } catch (err) {
//     next(err);
//   }
// };

module.exports = {
  createMailRecipient,
  getAllMailRecipients,
  getMailRecipient,
  updateMailRecipient,
  //   deleteMailRecipient,
};
