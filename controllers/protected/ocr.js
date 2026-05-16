const {
  findOcrById,
  updateOcr,
  deleteOcr,
  findAllOcr,
  createOcr,
  doOCR,
} = require("../../patient-management-system-shared-models/apps/legacy-vision-api");
const ocr = require("../../patient-management-system-shared-models/apps/legacy-vision-api/models/ocr");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const FileObjectModel = require("../../patient-management-system-shared-models/models/fileObject");
const {
  applyQueryOptions,
  sendResponse,
  createError,
  parseBusinessCardData,
  parseFilters,
  leadCreateFun,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");
const getAllOcrHandler = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllOcr({ companyID: undefined }),
      query: req.query,
      additionalFilters: {
        companyID: undefined,
      },
    });

    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};
const getOcrHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findOcrById(id);
    if (!doc || doc.companyID !== undefined)
      await createError({ name: "OcrNotFound_404" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};
const createOcrHandler = async (req, res, next) => {
  try {
    const { name, key } = req.body;
    const doc = await createOcr(undefined, name, key);
    if (!doc || doc.companyID !== undefined)
      await createError({ name: "OcrNotFound_404" });
    const app = await AppModel.findOne({ company: undefined });
    if (!app.defaultOcr.app) {
      app.defaultOcr.app = doc._id;
      await app.save();
    }
    await sendResponse(res, doc, { name: "OcrCreated_200" });
  } catch (err) {
    next(err);
  }
};
const updateOcrHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    let doc = await findOcrById(id);
    if (!doc || doc.companyID !== undefined)
      await createError({ name: "OcrNotFound_404" });
    const { isDefault, name, key } = req.body;
    doc = await updateOcr(id, { name, key });
    if (isDefault) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultOcr: {
            app: id,
          },
        },
      );
    }
    await sendResponse(res, doc, { name: "OcrUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const deleteOcrHandler = async (req, res, next) => {
  try {
    const { ids = [], nids = [], selectAll = false, filters = {} } = req.body;

    if (!Array.isArray(ids)) ids = [ids];
    if (!Array.isArray(nids)) nids = [nids];
    if (!ids.length && !selectAll)
      await createError({ name: "NoOcrSelected_400" });

    const app = await AppModel.findOne({
      company: undefined,
    });

    const defaultOcrId = app?.defaultOcr?.app?.toString() || "";

    await bulkDelete({
      model: ocr,
      req,
      populate: [],
      error: "NoOcrSelected_400",
      extra: {
        companyID: undefined,
        _id: { $nin: [...nids, defaultOcrId] },
      },
    });
    await sendResponse(res, null, { name: "OcrDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOcrHandler,
  getAllOcrHandler,
  getOcrHandler,
  updateOcrHandler,
  deleteOcrHandler,
};
