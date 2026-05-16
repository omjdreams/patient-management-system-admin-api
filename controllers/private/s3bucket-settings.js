const {
  createError,
  sendResponse,
  applyQueryOptions,
} = require("../../patient-management-system-shared-models/utils/utils");
const {
  verifyS3Credentials,
} = require("../../patient-management-system-shared-models/utils/s3client");
const SettingModel = require("../../patient-management-system-shared-models/models/setting");
const S3BucketModel = require("../../patient-management-system-shared-models/apps/s3-bucket/models/bucket");

const createS3bucketSettings = async (req, res, next) => {
  try {
    const { name, awsRegion, awsBucket, awsAccess, awsSecret, awsPathRef } =
      req.body;

    if (!name || !awsRegion || !awsBucket || !awsAccess || !awsSecret)
      await createError({ key: "028" });

    const exists = await S3BucketModel.findOne({ awsBucket });
    if (exists) await createError({ key: "039", defaults: { awsBucket } });

    const verified = await verifyS3Credentials(
      awsRegion,
      awsBucket,
      awsAccess,
      awsSecret,
    );
    // console.log("verified", verified);

    if (!verified.success)
      await createError({ key: "040", defaults: { reason: verified.message } });

    const s3bucketSettings = new S3BucketModel({
      name,
      awsRegion,
      awsBucket,
      awsAccess,
      awsSecret,
      awsPathRef: awsPathRef || "Voracity",
    });

    await s3bucketSettings.save();
    sendResponse(res, s3bucketSettings, {
      key: "041",
      defaults: { awsBucket },
    });
  } catch (error) {
    next(error);
  }
};

const getS3bucketSetting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const setting = await S3BucketModel.findById(id);

    if (!setting) await createError({ key: "042" });

    sendResponse(res, setting);
  } catch (error) {
    next(error);
  }
};

const getS3bucketSettings = async (req, res, next) => {
  try {
    const settings = await applyQueryOptions({ data: S3BucketModel });

    if (!settings) await createError({ key: "042" });

    sendResponse(res, settings);
  } catch (error) {
    next(error);
  }
};

const updateS3bucketSetting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, awsRegion, awsBucket, awsAccess, awsSecret, awsPathRef } =
      req.body;

    const verified = await verifyS3Credentials(
      awsRegion,
      awsBucket,
      awsAccess,
      awsSecret,
    );

    if (!verified.success)
      await createError({ key: "040", defaults: { reason: verified.message } });

    const updatedSetting = await S3BucketModel.findByIdAndUpdate(
      id,
      {
        name,
        awsRegion,
        awsBucket,
        awsAccess,
        awsSecret,
        awsPathRef,
      },
      { new: true },
    );

    if (!updatedSetting) await createError({ key: "042" });

    sendResponse(res, updatedSetting, { key: "043" });
  } catch (error) {
    next(error);
  }
};

const deleteS3bucketSettings = async (req, res, next) => {
  try {
    const { ids } = req.body;

    const settingsToDel =
      ids === "selectAll"
        ? await S3BucketModel.find()
        : await S3BucketModel.find({ _id: { $in: ids } });

    if (settingsToDel.some((setting) => setting.default))
      await createError({ key: "044" });

    const deletedSetttings =
      ids === "selectAll"
        ? await S3BucketModel.deleteMany()
        : await S3BucketModel.deleteMany({ _id: { $in: ids } });

    sendResponse(res, deletedSetttings, { key: "045" });
  } catch (error) {
    next(error);
  }
};

const setDefaultS3bucket = async (req, res, next) => {
  try {
    // console.log("setDefaultS3bucket called");

    const { id } = req.params;
    // console.log(id);

    let s3bucket = await S3BucketModel.findById(id);
    if (!s3bucket) await createError({ key: "042" });

    const oldS3bucket = await S3BucketModel.findOne({
      company: null,
      default: true,
    });

    if (oldS3bucket) {
      oldS3bucket.default = false;
      await oldS3bucket.save();
    }

    await SettingModel.updateMany(
      {
        $or: [{ company: null }, { "defaultS3Bucket.app": oldS3bucket?._id }],
      },
      { "defaultS3Bucket.app": id },
    );

    s3bucket.default = true;
    await s3bucket.save();
    sendResponse(res, s3bucket, {
      key: "046",
      defaults: { name: s3bucket.name },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createS3bucketSettings,
  getS3bucketSetting,
  getS3bucketSettings,
  updateS3bucketSetting,
  deleteS3bucketSettings,
  setDefaultS3bucket,
};
