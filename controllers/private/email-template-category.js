const {
  findByIdAndUpdate,
} = require("../../patient-management-system-shared-models/models/emailTemplate");
const EmailTemplateCategoryModel = require("../../patient-management-system-shared-models/models/emailTemplateCategory");
const {
  applyQueryOptions,
  sendResponse,
  createError,
} = require("../../patient-management-system-shared-models/utils/utils");

const getAllEmailTemplateCategories = async (req, res, next) => {
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
            ...Object.keys(EmailTemplateCategoryModel.schema.paths)
              .filter(
                (field) =>
                  EmailTemplateCategoryModel.schema.paths[field].instance ===
                  "String",
              )
              .map((field) => ({
                [field]: { $regex: search, $options: "i" },
              })),
          ],
        }
      : {};

    const sortOrder = order === "asc" ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };

    const result = await EmailTemplateCategoryModel.find({
      ...parsedFilters,
      ...searchFilter,
      company: { $exists: false },
    })
      .sort(sortOptions)
      .limit(parseInt(n, 10))
      .skip((p - 1) * n);
    const count = await EmailTemplateCategoryModel.countDocuments({
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

const getEmailTemplateCategories = async (req, res, next) => {
  try {
    const { category } = req.params;
    if (!category) await createError({ key: "028" });
    const templateCategory = await EmailTemplateCategoryModel.findOne({
      category,
    });

    if (!templateCategory) await createError({ key: "037" });

    sendResponse(res, templateCategory);
  } catch (error) {
    next(error);
  }
};

const updateEmailTemplateCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { templateId } = req.body;

    const templateCategory = await EmailTemplateCategoryModel.findOne({
      category,
    });
    if (!templateCategory) await createError({ key: "037" });
    templateCategory.emailTemplate = templateId;
    templateCategory.save();
    sendResponse(res, templateCategory, { key: "038" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllEmailTemplateCategories,
  getEmailTemplateCategories,
  updateEmailTemplateCategory,
};
