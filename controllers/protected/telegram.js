const {
  sendResponse,
  createError,
  parseFilters,
  applyQueryOptions,
  checkRequired,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const {
  createTelegramApp,
  findTelegramAppById,
  findAllTelegramApps,
  updateTelegramApp,
  deleteTelegramApps,
  saveInboundMessage,
  sendText,
  setWebhookForTelegramApp,
} = require("../../patient-management-system-shared-models/apps/telegram");

const AppModel = require("../../patient-management-system-shared-models/models/app");
const TelegramApp = require("../../patient-management-system-shared-models/apps/telegram/models/telegramApp");

/* ============================================================
    CREATE TELEGRAM APP
============================================================ */
const createTelegramAppHandler = async (req, res, next) => {
  try {
    const { name, botToken } = req.body;

    checkRequired({ name, botToken });

    const doc = await createTelegramApp({ name, botToken });

    await sendResponse(res, doc, { name: "TelegramAppCreated_201" });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
    GET ALL TELEGRAM APPS
============================================================ */
const getAllTelegramAppsHandler = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: await findAllTelegramApps({ companyID: undefined }),
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

/* ============================================================
    GET SINGLE TELEGRAM APP
============================================================ */
const getTelegramAppHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await findTelegramAppById(id);
    if (!doc) await createError({ name: "TelegramAppNotFound_404" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

/* ============================================================
    UPDATE TELEGRAM APP
============================================================ */
const updateTelegramAppHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, botToken } = req.body;

    let doc = await findTelegramAppById(id);
    if (!doc) await createError({ name: "TelegramAppNotFound_404" });

    doc = await updateTelegramApp(id, { name, botToken });

    await sendResponse(res, doc, { name: "TelegramAppUpdated_200" });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
    DELETE TELEGRAM APPS
============================================================ */
const deleteTelegramAppsHandler = async (req, res, next) => {
  try {
    await bulkDelete({
      model: TelegramApp,
      req,
      populate: [],
      error: "NoTelegramAppSelected_400",
    });
    await sendResponse(res, null, { name: "TelegramAppsDeleted_200" });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
    TELEGRAM WEBHOOK RECEIVER
============================================================ */
const telegramWebhookReceiverHandler = async (req, res, next) => {
  try {
    const { id: appId } = req.params;
    const update = req.body;

    await saveInboundMessage(appId, update);

    // optional auto reply
    const messageText = update?.message?.text;
    if (messageText) {
      const chatId = update.message.chat.id;
      sendText(appId, chatId, `Echo: ${messageText}`).catch(console.error);
    }

    res.status(200).json({ ok: true }); // telegram requires fast response
  } catch (err) {
    console.error("Telegram Webhook Error:", err);
    res.status(200).json({ ok: false, error: err.message });
  }
};

/* ============================================================
    SET TELEGRAM WEBHOOK
============================================================ */
const setTelegramWebhookHandler = async (req, res, next) => {
  try {
    const { id: appId } = req.params;
    const { webhookUrl } = req.body;

    checkRequired({ webhookUrl });

    const result = await setWebhookForTelegramApp(appId, webhookUrl);

    await sendResponse(res, result, { name: "TelegramWebhookSet_200" });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
    SEND TELEGRAM MESSAGE
============================================================ */
const sendTelegramMessageHandler = async (req, res, next) => {
  try {
    const { id: appId } = req.params;
    const { chatId, text } = req.body;

    checkRequired({ chatId, text });

    const result = await sendTextMessage(appId, chatId, text);

    await sendResponse(res, result, { name: "TelegramMessageSent_200" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTelegramAppHandler,
  getAllTelegramAppsHandler,
  getTelegramAppHandler,
  updateTelegramAppHandler,
  deleteTelegramAppsHandler,
  telegramWebhookReceiverHandler,
  setTelegramWebhookHandler,
  sendTelegramMessageHandler,
};
