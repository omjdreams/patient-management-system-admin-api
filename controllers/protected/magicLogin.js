const crypto = require("crypto");
const {
  checkRequired,
  sendResponse,
} = require("../../patient-management-system-shared-models/utils/utils");
const CompanyModel = require("../../patient-management-system-shared-models/models/company");
const MemberModel = require("../../patient-management-system-shared-models/models/member");
const UserModel = require("../../patient-management-system-shared-models/models/user");

const MAGIC_LOGIN_TTL_MS = 10 * 60 * 1000;

const createHttpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getCompanyUserForMagicLogin = async (companyId) => {
  const member =
    (await MemberModel.findOne({
      company: companyId,
      status: "owner",
    }).lean()) ||
    (await MemberModel.findOne({
      company: companyId,
      status: "accepted",
    }).lean());

  if (!member) {
    throw createHttpError("No active member found for this company.", 404);
  }

  const user =
    (member.user && (await UserModel.findById(member.user))) ||
    (await UserModel.findOne({ email: member.email }));

  if (!user) {
    throw createHttpError("No user found for this company.", 404);
  }

  return { member, user };
};

const createMagicLogin = async (req, res, next) => {
  try {
    const { companyId } = req.body;
    checkRequired({ companyId });

    const company = await CompanyModel.findById(companyId).lean();
    if (!company) {
      throw createHttpError("Company not found.", 404);
    }

    const { member, user } = await getCompanyUserForMagicLogin(companyId);
    const hash = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + MAGIC_LOGIN_TTL_MS);

    user.magicLogin = {
      code: hash,
      company: company._id,
      member: member._id,
      createdAt: new Date(),
      expiresAt,
      usedAt: null,
    };
    await user.save();

    await sendResponse(res, {
      hash,
      companyId: company._id,
      memberId: member._id,
      expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createMagicLogin };
