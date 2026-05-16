const LoginLogModel = require("../../patient-management-system-shared-models/models/loginLogs");
const serverLog = require("../../patient-management-system-shared-models/models/serverLog");
const specialLog = require("../../patient-management-system-shared-models/models/specialLog");
const AdminLoginLogsModel = require("../../patient-management-system-shared-models/models/adminLoginlogs");
const AdminForgetPassLogsModel = require("../../patient-management-system-shared-models/models/adminForgetPassLogs");
const CronJobLogModel = require("../../patient-management-system-shared-models/models/cronJobLog");
const {
  applyQueryOptions,
  sendResponse,
} = require("../../patient-management-system-shared-models/utils/utils");

const getLoginLogs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: LoginLogModel,
      query: req.query,
      populate: [["user", "User", "users"]],
      aggregationPipeline: [
        {
          $lookup: {
            from: "members",
            localField: "email",
            foreignField: "email",
            as: "member",
            pipeline: [
              {
                $lookup: {
                  from: "roles",
                  localField: "role",
                  foreignField: "_id",
                  as: "role",
                },
              },
              { $unwind: { path: "$role", preserveNullAndEmptyArrays: true } },
            ],
          },
        },
        { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },
      ],
    });

    await sendResponse(res, null, null, docs);
  } catch (error) {
    next(error);
  }
};
const getLogs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: serverLog,
      query: req.query,
      additionalFilters: { defaults: { sortBy: "updatedAt" } },
    });
    await sendResponse(res, null, null, docs);
  } catch (error) {
    next(error);
  }
};
const getSpecialLogs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: specialLog,
      query: req.query,
      additionalFilters: { defaults: { sortBy: "updatedAt" } },
    });
    await sendResponse(res, null, null, docs);
  } catch (error) {
    next(error);
  }
};

const getAdminLoginLogs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: AdminLoginLogsModel,
      query: req.query,
      populate: [["admin", "Admin", "admins"]],
      aggregationPipeline: [
        {
          $lookup: {
            from: "roles",
            localField: "admin.roles",
            foreignField: "_id",
            as: "admin.roles",
          },
        },
        {
          $unwind: {
            path: "$admin.roles",
            preserveNullAndEmptyArrays: true,
          },
        },
      ],
      additionalFilters: { defaults: { sortBy: "createdAt" } },
    });
    await sendResponse(res, null, null, docs);
  } catch (error) {
    next(error);
  }
};

const getAdminActivityLogs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: serverLog,
      query: req.query,
      populate: [["adminUser", "Admin", "admins"]],
      additionalFilters: {
        adminUser: { $exists: true },
        defaults: { sortBy: "createdAt" },
      },
    });
    await sendResponse(res, null, null, docs);
  } catch (error) {
    next(error);
  }
};
const getAdminForgetPassLogs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: AdminForgetPassLogsModel,
      query: req.query,
      populate: [["admin", "Admin", "admins"]],
      additionalFilters: { defaults: { sortBy: "createdAt" } },
    });
    await sendResponse(res, null, null, docs);
  } catch (error) {
    next(error);
  }
};

const getCronJobLogs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: CronJobLogModel,
      query: req.query,
      populate: [["cronJob", "CronJob", "cronjobs"]],
      additionalFilters: { defaults: { sortBy: "createdAt" } },
    });
    await sendResponse(res, null, null, docs);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLoginLogs,
  getLogs,
  getSpecialLogs,
  getAdminLoginLogs,
  getAdminActivityLogs,
  getAdminForgetPassLogs,
  getCronJobLogs,
};
