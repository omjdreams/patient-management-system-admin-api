require("dotenv").config();
const EmailTemplateModel = require("./patient-management-system-shared-models/models/emailTemplate");
const ResponseMessageModel = require("./patient-management-system-shared-models/models/responseMessage");

const responseMsgsAdminJson = require("./patient-management-system-shared-models/constants/responseMessagesAdmin.json");
const responseMsgsOrgJson = require("./patient-management-system-shared-models/constants/responseMessages.json");
const orgEmailTemplatesJson = require("./patient-management-system-shared-models/constants/orgEmailTemplates.json");
const adminEmailTemplatesJson = require("./patient-management-system-shared-models/constants/adminEmailTemplates.json");

const app = require("./app");
const connectDB = require("./config/db");
const { initiateEssentialData } = require("./controllers/test/initiateDB");
const WidgetModel = require("./patient-management-system-shared-models/models/widget");

const widgets = require("./patient-management-system-shared-models/constants/widgets.json");
const FacebookOAuthApp = require("./patient-management-system-shared-models/apps/oAuthFacebook/models/app");
const { PORT = 3000 } = process.env;
const { CronJob } = require("cron");
const CronJobModel = require("./patient-management-system-shared-models/models/cronJob");
const { cronJobsToRun } = require("./controllers/protected/cronJob");

connectDB()
  .then(() =>
    app.listen(PORT, () => {
      console.log(`🟢 Server running. Use our API on port: ${PORT}`);
    }),
  )
  .then(async () => {
    try {
      // await insertedResponse();
      // await insertTemplate();
      // all inside initiateEssentialData
      await initiateEssentialData();
      // await cronJobsToRun("plan-reminder", {
      //   "plan-reminder": {
      //     reminderType: "reminder",
      //     reminderDays: 26,
      //     reminderHours: 22,
      //     reminderMinutes: 37,
      //   },
      // });
      console.log("Essential data initialized successfully");
      // console.log("responseMsgsOrgJson is", responseMsgsOrgJson.slice(126));
      const responses = [...responseMsgsAdminJson, ...responseMsgsOrgJson];

      let insertedResponses = 0;
      await Promise.all(
        responses.map(async (response) => {
          const existing = await ResponseMessageModel.findOne({
            key: response.key,
          });
          // console.log("existing is", existing, insertedResponses);
          if (!existing) {
            await ResponseMessageModel.create(response);
            insertedResponses++;
          }
        }),
      );

      // console.log("Inserted response messages:", insertedResponses);

      const templates = [...orgEmailTemplatesJson, ...adminEmailTemplatesJson];

      let insertedTemplates = 0;
      await Promise.all(
        templates.map(async (template) => {
          const existing = await EmailTemplateModel.findOne({
            category: template.category,
          });
          if (!existing) {
            await EmailTemplateModel.create(template);
            insertedTemplates++;
          }
        }),
      );
      // console.log("Inserted email templates:", insertedTemplates);

      // await initSampleWidgets();
      console.log("Sample widgets initialized successfully");
      console.log("Template categories initialized successfully");
    } catch (error) {
      console.error("Error during database initialization:", error.message);
    }
  });
