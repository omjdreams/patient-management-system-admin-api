const FileObjectModel = require("../../patient-management-system-shared-models/models/fileObject");
const {
  uploadToS3,
} = require("../../patient-management-system-shared-models/utils/s3client");
const {
  applyQueryOptions,
  sendResponse,
  parseFilters,
  createError,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const getAllFileObjects = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: FileObjectModel,
      query: req.query,
      additionalFilters: {
        company: null,
        trashedAt: null,
        isDeleted: false,
      },
      populate: [["createdBy", "Admin", "admins"]],
      aggregationPipeline: [
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
          },
        },
        {
          $project: {
            createdUser: 0,
          },
        },
      ],
    });
    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const getFileObject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await FileObjectModel.findOne({
      _id: id,
      isDeleted: false,
      company: null,
    });
    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const deleteFileObjects = async (req, res, next) => {
  try {
    // DELETE FROM BUCKET
    // const files = await FileObjectModel.find(deleteFilters);

    // for (const file of files) {
    //   const response = await deleteBucketObject(
    //     file.bucket,
    //     file._id.toString() + path.extname(file.name)
    //   );
    //   console.log("response", response)
    // }
    const deleteFilters = await bulkDelete({
      model: FileObjectModel,
      req,
      populate: [["createdBy", "Admin", "admins"]],
      error: "NoFileObjectSelected_400",
      deleteAll: false,
    });

    await FileObjectModel.updateMany(deleteFilters, {
      $set: { trashedAt: Date.now(), trashedBy: member._id },
    });
    await sendResponse(res, null, { name: "FileObjectDeleted_200" });
  } catch (error) {
    next(err);
  }
};

const uploadFile = async (req, res, next) => {
  try {
    const { name, type, size } = req.body; // TODO: can ask buffer from frontend.
    checkRequired({ name, type, size });
    const admin = req.admin;
    const existingFile = await FileObjectModel.findOne({
      company: null,
      name: name.trim(),
    });
    if (existingFile)
      return await sendResponse(res, { data: existingFile, fileExists: true });

    const data = await uploadToS3(null, name, type, size, {
      createdBy: admin._id,
    });
    await sendResponse(res, data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllFileObjects,
  getFileObject,
  deleteFileObjects,
  uploadFile,
};
