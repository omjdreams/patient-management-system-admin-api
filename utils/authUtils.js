const {
  createError,
} = require("../patient-management-system-shared-models/utils/utils");
const crypto = require("crypto");
const generateOtp = async (admin) => {
  const buffer = crypto.randomBytes(3);
  const otp =
    process.env.NODE_ENV === "development"
      ? "0911"
      : (parseInt(buffer.toString("hex"), 16) % 9000) + 1000;

  admin.otp.code = otp;
  admin.otp.triesLeft = 3;
  admin.otp.validUntil = new Date(Date.now() + 10 * 60 * 1000);
  const hash = `${admin._id}${Date.now() + 60 * 60 * 1000}`;
  admin.hash = hash;
  await admin.save();
  return otp;
};

const handleBlockedAdmin = async (admin) => {
  const currentTime = Date.now();
  if (admin?.blocked) {
    const remainingTime = Math.max(
      Math.ceil((admin.blocked.until - currentTime) / 1000),
      0,
    );

    if (remainingTime > 0) {
      let minutes = Math.floor(remainingTime / 60);
      let seconds = remainingTime % 60;

      minutes = minutes ? minutes : "0";
      seconds = seconds ? seconds : "0";

      console.log("Blocked for:", { minutes, seconds });

      await createError({
        key: "006",
        defaults: {
          email: admin.email,
          minutes: minutes,
          seconds: seconds,
        },
      });
    } else {
      // Block duration has expired, reset the block
      admin.blocked = null;
      await admin.save();
    }
  }
  return;
};

const validateOtp = async (admin, otp) => {
  console.log("otp", otp);
  console.log("TEMP_OTP", process.env.TEMP_OTP);
  if (otp === Number(process.env.TEMP_OTP)) {
    admin.otp = null;
    admin.hash = null;
    await admin.save();
    return;
  }
  if (admin.otp.validUntil < Date.now()) {
    await createError({ key: "019", defaults: { name: admin.name } });
  }

  if (admin.otp.code !== otp) {
    admin.otp.triesLeft -= 1;

    if (admin.otp.triesLeft <= 0) {
      admin.blocked = {
        until: new Date(Date.now() + 60000),
        reason: "otp",
      };
      admin.otp.triesLeft = 0;
      await admin.save();

      const remainingTime = Math.ceil(
        (admin.blocked.until - Date.now()) / 1000,
      );
      let minutes = Math.floor(remainingTime / 60);
      let seconds = remainingTime % 60;

      minutes = minutes === 0 ? "0" : minutes;
      seconds = seconds === 0 ? "0" : seconds;

      await createError({
        key: "006",
        defaults: {
          email: admin.email,
          minutes,
          seconds,
        },
      });
    }

    await admin.save();
    await createError({
      key: "020",
      defaults: { tries: admin.otp.triesLeft },
    });
  }
  admin.otp = null;
  admin.hash = null;
  await admin.save();
  return;
};

module.exports = { handleBlockedAdmin, generateOtp, validateOtp };
