const jwt = require("jsonwebtoken");
const {
  createError,
} = require("../patient-management-system-shared-models/utils/utils");
const AdminModel = require("../patient-management-system-shared-models/models/admin");

const authenticate = async (req, res, next) => {
  try {
    const { authorization } = req?.headers;
    if (!authorization || !authorization.startsWith("Bearer "))
      await createError({ key: "047" });

    const token = authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await AdminModel.findById(decodedToken._id).lean();

    if (!admin) await createError({ key: "003" });

    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticate;
