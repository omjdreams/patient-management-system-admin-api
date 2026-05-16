const {
  checkRequired,
  createError,
  sendResponse,
} = require("../../patient-management-system-shared-models/utils/utils");
const bcrypt = require("bcryptjs");
const AdminModel = require("../../patient-management-system-shared-models/models/admin");
const jwt = require("jsonwebtoken");
const AdminLoginLogsModel = require("../../patient-management-system-shared-models/models/adminLoginlogs");
const AdminForgetPassLogsModel = require("../../patient-management-system-shared-models/models/adminForgetPassLogs");
const AdminEmailVerificationLogModel = require("../../patient-management-system-shared-models/models/adminEmailVerificationLog");
const {
  generateOtp,
  handleBlockedAdmin,
  validateOtp,
} = require("../../utils/authUtils");

const EmailTemplateCategoryModel = require("../../patient-management-system-shared-models/models/emailTemplateCategory");
const {
  generateTemplateBody,
  sendMail,
  getEmailLogo,
  generateWholeMailBody,
  socialIcons,
} = require("../../patient-management-system-shared-models/utils/mailer");
// commented code
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    checkRequired({ email, password });

    const admin = await AdminModel.findOne({ email }).select("+password");

    if (!admin) {
      await AdminLoginLogsModel.create({
        email,
        status: "failure",
        reason: "Admin not found",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
      await createError({ key: "004" });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      await AdminLoginLogsModel.create({
        admin: admin._id,
        email,
        status: "failure",
        reason: "Invalid Credentials",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
      await createError({ key: "004" });
    }

    const adminDetails = admin.toObject();
    delete adminDetails.password;

    await AdminLoginLogsModel.create({
      admin: adminDetails._id,
      email: adminDetails.email,
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    if (!admin.isVerified) {
      await handleBlockedAdmin(admin);
      const otp = await generateOtp(admin);

      sendResponse(res, adminDetails, { key: "018" }, { hash: admin.hash });

      const { emailTemplate } =
        (await EmailTemplateCategoryModel.findOne({
          category: "email_verification",
        }).populate("emailTemplate")) || {};
      console.log("emailTemplate", emailTemplate);
      if (emailTemplate) {
        const { body, subject } = await generateTemplateBody(
          emailTemplate,
          [admin._id],
          { otp },
        );

        const emailLogo = await getEmailLogo();

        const actualBody = generateWholeMailBody(body, socialIcons, emailLogo);
        sendMail(admin.email, subject, actualBody);
        AdminEmailVerificationLogModel.create({
          admin: admin._id,
          email: admin.email,
          event: "sent",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        }).catch((error) =>
          console.error("Email verification sent log error:", error),
        );
      }
      return;
    }

    if (admin.isTwoFactorAuth) {
      const otp = await generateOtp(admin);
      // admin.name = "updated aname";
      await admin.save();
      sendResponse(res, adminDetails, { key: "005" }, { hash: admin.hash });

      const { emailTemplate } =
        (await EmailTemplateCategoryModel.findOne({
          category: "two_Factor_auth",
        }).populate("emailTemplate")) || {};
      console.log("emailTemplate", emailTemplate);

      if (emailTemplate) {
        const { body, subject } = await generateTemplateBody(
          emailTemplate,
          [],
          { otp, name: admin.name },
        );
        const emailLogo = await getEmailLogo();

        const actualBody = generateWholeMailBody(body, socialIcons, emailLogo);
        sendMail(admin.email, subject, actualBody);
      }
      return;
    }

    const token = jwt.sign(
      { _id: adminDetails._id, email: adminDetails.email },
      process.env.JWT_SECRET,
    );

    sendResponse(res, adminDetails, { key: "007" }, { token });
  } catch (error) {
    console.error("Error occurred in login function:", error);
    next(error);
  }
};

const emailVerification = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const admin = await AdminModel.findOne({ email });

    if (!admin) await createError({ key: "024" });

    await handleBlockedAdmin(admin);
    //TODO validate otp logic
    await validateOtp(admin, otp);

    const hash = `${admin._id}${Date.now() + 60 * 60 * 1000}`;
    admin.isVerified = true;
    admin.hash = hash;
    await admin.save();

    await AdminEmailVerificationLogModel.create({
      admin: admin._id,
      email: admin.email,
      event: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });
    sendResponse(res, null, { key: "021" }, { hash });
  } catch (err) {
    if (req.body?.email) {
      await AdminEmailVerificationLogModel.create({
        email: req.body.email,
        event: "failure",
        reason: err?.message,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      }).catch((error) =>
        console.error("Email verification failure log error:", error),
      );
    }
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { hash, password } = req.body;
    const admin = await AdminModel.findOne({ hash });

    if (!admin) await createError({ key: "023" });

    // const checkPass = await bcrypt.compare(password, admin.password);
    // // console.log("checkPass", checkPass);

    // if (checkPass) {
    //   await createError({ key: "026" });
    // }

    admin.password = password;
    admin.save();
    sendResponse(res, null, { key: "027" });

    const { emailTemplate } =
      (await EmailTemplateCategoryModel.findOne({
        category: "password_changed",
      }).populate("emailTemplate")) || {};

    if (emailTemplate) {
      const { body, subject } = await generateTemplateBody(emailTemplate, [
        admin._id,
      ]);
      const emailLogo = await getEmailLogo();

      const actualBody = generateWholeMailBody(body, socialIcons, emailLogo);
      sendMail(admin.email, subject, actualBody);
    }
    return;
  } catch (error) {
    next(error);
  }
};

const verify2FactAuth = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const admin = await AdminModel.findOne({ email });

    if (!admin) await createError({ key: "024" });

    await handleBlockedAdmin(admin);
    await validateOtp(admin, otp);
    const token = jwt.sign(admin.toObject(), process.env.JWT_SECRET);
    sendResponse(res, admin, { key: "013" }, { token });
  } catch (error) {
    next(error);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { email } = req.body;
    const admin = await AdminModel.findOne({ email });
    console.log(admin);

    if (!admin) await createError({ key: "024" });

    await handleBlockedAdmin(admin);

    let otp;
    if (admin.otp.validUntil > Date.now()) otp = admin.otp.code;
    else otp = await generateOtp(admin);

    sendResponse(res, null, { key: "025" });

    const { emailTemplate } =
      (await EmailTemplateCategoryModel.findOne({
        category: category,
      }).populate("emailTemplate")) || {};
    console.log("emailTemplate", emailTemplate, category);
    if (emailTemplate) {
      const { body, subject } = await generateTemplateBody(
        emailTemplate,
        [admin._id],
        { otp },
      );
      const emailLogo = await getEmailLogo();
      const actualBody = generateWholeMailBody(body, socialIcons, emailLogo);
      sendMail(admin.email, subject, actualBody);
      if (category === "email_verification") {
        AdminEmailVerificationLogModel.create({
          admin: admin._id,
          email: admin.email,
          event: "sent",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        }).catch((error) =>
          console.error("Email verification sent log error:", error),
        );
      }
    }
    return;
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const admin = await AdminModel.findOne({ email });
    if (!admin) {
      await AdminForgetPassLogsModel.create({
        email,
        status: "failure",
        reason: "Admin not found",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return sendResponse(res, null, { key: "014", defaults: { email } });
    }
    await handleBlockedAdmin(admin);
    const otp = await generateOtp(admin);

    await AdminForgetPassLogsModel.create({
      admin: admin._id,
      email: admin.email,
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    sendResponse(
      res,
      null,
      { key: "014", defaults: { email } },
      { otp, hash: admin.hash },
    );

    const { emailTemplate } =
      (await EmailTemplateCategoryModel.findOne({
        category: "forgot_password",
      }).populate("emailTemplate")) || {};

    if (emailTemplate) {
      const { body, subject } = await generateTemplateBody(
        emailTemplate,
        [admin._id],
        { otp, name: admin.name },
      );
      const emailLogo = await getEmailLogo();

      const actualBody = generateWholeMailBody(body, socialIcons, emailLogo);
      sendMail(admin.email, subject, actualBody);
    }
    return;
  } catch (err) {
    next(err);
  }
};

const verifyForgotOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    console.log("req.body", req.body);

    const admin = await AdminModel.findOne({ email });
    if (!admin) await createError({ key: "024" });

    await handleBlockedAdmin(admin);
    await validateOtp(admin, otp);

    const hash = `${admin._id}${Date.now() + 60 * 60 * 1000}`;
    admin.hash = hash;
    await admin.save();
    const changePasswordLink = `${process.env.VITE_APP_URL}/change-password/${admin.hash}`; //this is just an example & temporary
    sendResponse(
      res,
      null,
      { key: "015", defaults: { email: admin.email } },
      { hash },
    );
    const { emailTemplate } =
      (await EmailTemplateCategoryModel.findOne({
        category: "verify_forgot_pass",
      }).populate("emailTemplate")) || {};

    if (emailTemplate) {
      const { body, subject } = await generateTemplateBody(emailTemplate, [], {
        changePasswordLink,
      });
      const emailLogo = await getEmailLogo();

      const actualBody = generateWholeMailBody(body, socialIcons, emailLogo);
      sendMail(admin.email, subject, actualBody);
    }
    return;
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  forgotPassword,
  resendOtp,
  verify2FactAuth,
  verifyForgotOTP,
  emailVerification,
  changePassword,
};
