const ResponseMessageModel = require("../../patient-management-system-shared-models/models/responseMessage");
const {
  createError,
  sendResponse,
} = require("../../patient-management-system-shared-models/utils/utils");

const createResMsg = async (req, res, next) => {
  try {
    const { key, message, status, type, panel, module, description } = req.body;

    if (!key || !message || !status || !type || !panel || !module) {
      await createError({ key: "028" });
    }

    const existingResMsg = await ResponseMessageModel.findOne({ key });
    if (existingResMsg) await createError({ key: "029" });

    const responseMessage = await ResponseMessageModel.create({
      key,
      message,
      status,
      type,
      panel,
      module,
      description,
    });

    // console.log("res msg created successfully", responseMessage);

    await sendResponse(res, responseMessage, { key: "030" });
  } catch (error) {
    next(error);
  }
};

const getResMsg = async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!key) await createError({ key: "031" });

    const responseMsg = await ResponseMessageModel.findOne({ key });
    if (!responseMsg) {
      await createError({ key: "032" });
    }

    await sendResponse(res, responseMsg, null);
  } catch (error) {
    next(error);
  }
};

const getResMsgs = async (req, res, next) => {
  try {
    const { panel, type } = req.params;

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
            ...Object.keys(ResponseMessageModel.schema.paths)
              .filter(
                (field) =>
                  ResponseMessageModel.schema.paths[field].instance ===
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

    // console.log("the parsed filters are", parsedFilters);

    const result = await ResponseMessageModel.find({
      ...parsedFilters,
      ...searchFilter,
      company: { $exists: false },
      panel,
      type,
    })
      .sort(sortOptions)
      .limit(parseInt(n, 10))
      .skip((p - 1) * n);
    const count = await ResponseMessageModel.countDocuments({
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

const updateResMsg = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { message } = req.body;
    const resMsg = await ResponseMessageModel.findOne({ key });
    if (!resMsg) await createError({ key: "032" });

    resMsg.message = message || resMsg.message;

    await resMsg.save();
    await sendResponse(res, resMsg, { key: "033" });
  } catch (error) {
    next(error);
  }
};

module.exports = { createResMsg, getResMsg, getResMsgs, updateResMsg };
