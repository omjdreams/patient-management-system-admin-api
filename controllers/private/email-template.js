const EmailTemplateModel = require("../../patient-management-system-shared-models/models/emailTemplate");
const {
  createError,
  sendResponse,
  applyQueryOptions,
} = require("../../patient-management-system-shared-models/utils/utils");

const createEmailTemplate = async (req, res, next) => {
  try {
    const { category, subject, body } = req.body;
    if (!category || !subject || !body) await createError({ key: "028" });

    const template = await EmailTemplateModel.create({
      category,
      subject,
      body,
    });

    sendResponse(res, template, { key: "034" });
  } catch (error) {
    next(error);
  }
};

const getEmailTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) await createError({ key: "028" });

    const template = await EmailTemplateModel.findOne({ _id: id });
    if (!template) await createError({ key: "035" });

    await sendResponse(res, template, null);
  } catch (error) {
    next(error);
  }
};

const getEmailTemplates = async (req, res, next) => {
  try {
    const {
      p,
      n,
      sortBy = "updatedAt",
      order = "desc",
      search,
      filter,
    } = req.query;

    const parsedFilters = filter ? JSON.parse(filter) : {};
    const searchFilter = search
      ? {
          $or: [
            ...Object.keys(EmailTemplateModel.schema.paths)
              .filter(
                (field) =>
                  EmailTemplateModel.schema.paths[field].instance === "String",
              )
              .map((field) => ({
                [field]: { $regex: search, $options: "i" },
              })),
          ],
        }
      : {};

    const sortOrder = order === "asc" ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };

    const result = await EmailTemplateModel.find({
      ...parsedFilters,
      ...searchFilter,
      company: { $exists: false },
    })
      .sort(sortOptions)
      .limit(parseInt(n, 10))
      .skip((p - 1) * n);
    const count = await EmailTemplateModel.countDocuments({
      ...parsedFilters,
      ...searchFilter,
      company: { $exists: false },
    });

    const totalPages = Math.ceil(count / n);

    sendResponse(res, result, null, {
      totalPages,
      currentPage: parseInt(p, 10),
      totalCount: count,
    });
  } catch (error) {
    next(error);
  }
};

const updateEmailTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subject, body } = req.body;

    const template = await EmailTemplateModel.findOne({ _id: id });

    if (!template) await createError({ key: "035" });

    template.subject = subject || template.subject;
    template.body = body || template.body;
    await template.save();
    await sendResponse(res, template, { key: "036" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEmailTemplate,
  getEmailTemplate,
  getEmailTemplates,
  updateEmailTemplate,
};
