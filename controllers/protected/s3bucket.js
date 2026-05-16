const {
  sendResponse,
  createError,
  parseFilters,
  applyQueryOptions,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");
const {
  createS3Bucket,
  findS3BucketById,
  updateS3Bucket,
  deleteS3Bucket,
  findAllS3Bucket,
} = require("../../patient-management-system-shared-models/apps/s3-bucket");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const Bucket = require("../../patient-management-system-shared-models/apps/s3-bucket/models/bucket");

const createS3BucketHandler = async (req, res, next) => {
  try {
    const { accesskey, secretkey, region, name, subpath } = req.body;
    console.log(
      "accesskey, secretkey, region, name, subpath",
      accesskey,
      secretkey,
      region,
      name,
      subpath,
    );

    const bucket = await createS3Bucket({
      accesskey,
      secretkey,
      region,
      name,
      subpath,
      companyID: null,
    });

    await AppModel.updateOne(
      { company: null, "defaultS3Bucket.app": { $exists: false } },
      {
        $set: { defaultS3Bucket: { isGlobal: false, app: bucket._id } },
        $setOnInsert: {},
      },
      { upsert: true },
    );

    await sendResponse(res, bucket, { name: "S3BucketCreated_201" });
  } catch (err) {
    next(err);
  }
};

const getAllS3BucketHandler = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllS3Bucket({ companyID: null }),
      query: req.query,
      additionalFilters: {
        companyID: null,
      },
    });

    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const getS3BucketHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await findS3BucketById(id);
    if (!doc) await createError({ name: "S3BucketNotFound_404" });
    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updateS3BucketHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    let doc = await findS3BucketById(id);
    if (!doc) await createError({ name: "S3BucketNotFound_404" });
    const { isDefault } = req.body;
    doc = await updateS3Bucket(id, req.body);
    if (isDefault) {
      await AppModel.findOneAndUpdate(
        { company: undefined },
        {
          defaultS3Bucket: {
            app: id,
          },
        },
      );
    }
    await sendResponse(res, doc, { name: "S3BucketUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const deleteS3BucketHandler = async (req, res, next) => {
  try {
    const app = await AppModel.findOne({
      company: null,
      "defaultS3Bucket.app": { $exists: true },
      "defaultS3Bucket.isGlobal": false,
    });

    const defaultS3BucketId = app?.defaultS3Bucket?.app?.toString() || "";

    await bulkDelete({
      model: Bucket,
      req,
      populate: [],
      error: "DefaultRoleNotFound_404",
      extra: {
        _id: { $nin: [defaultS3BucketId] },
      },
    });
    await sendResponse(res, null, { name: "S3BucketDeleted_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createS3BucketHandler,
  getAllS3BucketHandler,
  getS3BucketHandler,
  updateS3BucketHandler,
  deleteS3BucketHandler,
};
