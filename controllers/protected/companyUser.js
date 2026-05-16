const MemberModel = require("../../patient-management-system-shared-models/models/member");
const {
  sendResponse,
  applyQueryOptions,
} = require("../../patient-management-system-shared-models/utils/utils");
const getCompanyUsers = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: MemberModel,
      query: { ...req.query, sortBy: req.query.sortBy || "user.createdAt" },
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      aggregationPipeline: [
        {
          $match: {
            status: { $in: ["owner", "accepted", "blocked"] },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "email",
            foreignField: "email",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "companies",
            localField: "company",
            foreignField: "_id",
            as: "company",
          },
        },
        {
          $unwind: {
            path: "$company",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "roles",
            localField: "role",
            foreignField: "_id",
            as: "role",
          },
        },
        {
          $unwind: {
            path: "$role",
            preserveNullAndEmptyArrays: true,
          },
        },
      ],
    });

    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const deleteCompanyUsers = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const deleteMembers = await MemberModel.deleteMany({
      _id: { $in: ids },
    });
    sendResponse(res, null, { key: "051" });
  } catch (error) {
    next(error);
  }
};
module.exports = { getCompanyUsers, deleteCompanyUsers };
