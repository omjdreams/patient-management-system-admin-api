const {
  getUserPages,
  getPageLeadForms,
  getFormLeads,
} = require("../../patient-management-system-shared-models/apps/facebook");
const FormModel = require("../../patient-management-system-shared-models/apps/facebook/models/forms");
const PageModel = require("../../patient-management-system-shared-models/apps/facebook/models/pages");
const AppModel = require("../../patient-management-system-shared-models/models/app");
const CompanyModel = require("../../patient-management-system-shared-models/models/company");
const CronJobModel = require("../../patient-management-system-shared-models/models/cronJob");
const MemberModel = require("../../patient-management-system-shared-models/models/member");
const SubscriptionModel = require("../../patient-management-system-shared-models/models/subscription");
const adminEmailTemplates = require("../../patient-management-system-shared-models/constants/adminEmailTemplates.json");
const jobManager = require("../../patient-management-system-shared-models/utils/jobManager");
const {
  runAdminReportNotificationCron,
} = require("../../patient-management-system-shared-models/utils/adminNotificationReports");
const {
  generateTemplateBody,
  generateWholeMailBody,
  sendMail,
  socialIcons,
  getEmailLogo,
} = require("../../patient-management-system-shared-models/utils/mailer");
const {
  parseFilters,
  createError,
  sendResponse,
  applyQueryOptions,
  checkRequired,
  leadCreateFun,
  splitNumberCombo,
  bulkDelete,
} = require("../../patient-management-system-shared-models/utils/utils");

const createCronJob = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { name, description, schedule, isActive, data, type, variables } =
      req.body;
    checkRequired({ name, schedule });
    const existing = await CronJobModel.findOne({
      name: name.trim(),
      company: undefined,
    });
    if (existing) await createError({ name: "CronJobAlreadyExists_400" });
    const doc = new CronJobModel({
      name: name.trim(),
      description,
      schedule,
      isActive,
      data,
      variables,
      company: undefined,
      type,
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    await doc.save();
    jobManager.update(doc, cronJobsToRun);

    await sendResponse(res, doc, { name: "CronJobCreated_200" });
  } catch (err) {
    next(err);
  }
};
const getAllCronJobs = async (req, res, next) => {
  try {
    const docs = await applyQueryOptions({
      data: CronJobModel,
      query: req.query,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      aggregationPipeline: [
        {
          $lookup: {
            from: "users",
            localField: "updatedBy.email",
            foreignField: "email",
            as: "updatedUser",
          },
        },
        { $unwind: { path: "$updatedUser", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "createdBy.email",
            foreignField: "email",
            as: "createdUser",
          },
        },
        { $unwind: { path: "$createdUser", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            "createdBy.name": "$createdUser.name",
            "updatedBy.name": "$updatedUser.name",
          },
        },
        {
          $project: {
            createdUser: 0,
            updatedUser: 0,
          },
        },
      ],
      additionalFilters: { company: undefined },
    });
    await sendResponse(res, null, null, docs);
  } catch (err) {
    next(err);
  }
};

const getCronJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await CronJobModel.findOne({
      _id: id,
      company: undefined,
    });

    if (!doc) await createError({ name: "CronJobNotFound_400" });

    await sendResponse(res, doc);
  } catch (err) {
    next(err);
  }
};

const updateCronJob = async (req, res, next) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const doc = await CronJobModel.findOne({
      _id: id,
      company: undefined,
    });

    if (!doc) await createError({ name: "CronJobNotFound_400" });

    Object.entries({
      name: "name",
      description: "description",
      schedule: "schedule",
      isActive: "isActive",
      data: "data",
      variables: "variables",
      type: "type",
    }).forEach(([key, value]) => {
      if (req.body[key] !== undefined) doc[value] = req.body[key];
    });

    doc.updatedBy = admin._id;

    await doc.save();
    jobManager.update(doc, cronJobsToRun);

    await sendResponse(res, doc, { name: "CronJobUpdated_200" });
  } catch (err) {
    next(err);
  }
};

const deleteCronJob = async (req, res, next) => {
  try {
    const deleteFilters = await bulkDelete({
      model: CronJobModel,
      req,
      populate: [
        ["updatedBy", "Member", "members"],
        ["createdBy", "Member", "members"],
      ],
      error: "NoCronJobSelected_400",
    });
    const toBeDeleted = await CronJobModel.find(deleteFilters);
    toBeDeleted.forEach((cronJob) => {
      jobManager.remove(cronJob);
    });

    await sendResponse(res, null, { name: "CronJobDeleted_200" });
  } catch (err) {
    next(err);
  }
};

const syncPageForms = async (page, app) => {
  try {
    if (!app) throw new Error("App not found");
    if (!page) throw new Error("Page not found");
    const allForms = [];
    const forms = await getPageLeadForms(page.pageId, page.accessToken);
    for (const form of forms) {
      const formData = {
        formId: form.id,
        name: form.name,
        status: form.status,
        pageId: page._id,
        pageName: page.name,
        totalLeads: form.leads_count || 0,
        companyID: app.company,
      };
      const updatedForm = await FormModel.findOneAndUpdate(
        { formId: form.id, companyID: app.company },
        formData,
        {
          upsert: true,
          new: true,
        },
      );
      allForms.push(updatedForm);
    }

    await PageModel.findOneAndUpdate(
      { _id: page._id },
      { forms: allForms?.map((f) => f._id) },
    );
    return allForms;
  } catch (error) {
    throw error;
  }
};
const syncPagesForms = async (app) => {
  try {
    if (!app) throw new Error("App not found");

    const pages = await getUserPages(app?.defaultFacebook?.accessToken);
    let allPages = [];

    for (const facebookPage of pages) {
      const page = await PageModel.findOneAndUpdate(
        { pageId: facebookPage.id, companyID: app.company },
        {
          pageId: facebookPage.id,
          name: facebookPage.name,
          accessToken: facebookPage.accessToken,
          companyID: app.company,
        },
        {
          upsert: true,
          new: true,
        },
      ).lean();
      try {
        const allForms = await syncPageForms(page, app);
        allPages.push({ ...page, forms: allForms });
      } catch (pageError) {}
    }

    return allPages;
  } catch (error) {
    throw error;
  }
};
const updateUserPages = async (pageId, isActive) => {
  try {
    const page = await PageModel.findByIdAndUpdate(
      pageId,
      { isActive },
      { new: true },
    )?.lean();
    return page;
  } catch (error) {
    throw new Error("Failed to update user pages");
  }
};
const updateUserForm = async (matchBy, isActive, lastSyncedAt, syncing) => {
  try {
    const form = await FormModel.findByIdAndUpdate(
      matchBy,
      { isActive, lastSyncedAt, syncing },
      { new: true },
    )?.lean();
    return form;
  } catch (error) {
    throw new Error("Failed to update user pages");
  }
};
const syncFormLeads = async (accessToken, formId, companyID) => {
  try {
    if (!accessToken) throw new Error("Access Token not found");

    const form = await FormModel.findOne({ formId, companyID });
    if (!form) throw new Error("Form not found");

    let allLeads = [];
    let after = null;
    let hasNextPage = true;
    let newLeadsCount = 0;
    let leads = [];
    while (hasNextPage) {
      const response = await getFormLeads(formId, accessToken, 100, after);

      leads = response.data || [];

      if (response.paging && response.paging.next) {
        after = response.paging.cursors.after;
      } else {
        hasNextPage = false;
      }
    }

    const result = {
      leads,
      totalLeads: leads.length,
      formId: formId,
      formName: form.name,
    };

    return result;
  } catch (error) {
    throw error;
  }
};
const facebookLeadsToLeads = async (leads, form, newPage, member) => {
  console.log("newPage", newPage);
  leads?.forEach(async (lead) => {
    console.log("lead", lead);
    try {
      const sanitizePhoneNumber = (fieldName) => {
        const contactNumber = lead?.field_data?.find(
          (field) => field.name == fieldName,
        )?.values?.[0];
        console.log(" contactNumber 1", contactNumber);
        const sanitizedPhoneNumber = contactNumber?.replace(/\D/g, "");
        console.log("sanitizedPhoneNumber", sanitizedPhoneNumber);

        const spiltCheckPhoneNumber =
          sanitizedPhoneNumber && splitNumberCombo(sanitizedPhoneNumber);
        return spiltCheckPhoneNumber?.valid && sanitizedPhoneNumber;
      };

      const sanitizedContact = sanitizePhoneNumber("phone_number");
      const sanitizedWorkPhoneContact =
        sanitizePhoneNumber("work_phone_number");
      const sanitizedWhatsappContact = sanitizePhoneNumber(
        "whatsapp_contact_number",
      );

      const contactNumber = sanitizedContact;
      console.log("contactNumber final", contactNumber);
      const work_phone_number = sanitizedWorkPhoneContact;
      const whatsapp_contact_number = sanitizedWhatsappContact;
      const otherFields = lead?.field_data?.filter(
        (field) =>
          field.name !== "phone_number" &&
          field.name !== "email" &&
          field.name !== "full_name" &&
          field.name !== "work_phone_number" &&
          field.name !== "whatsapp_contact_number",
      );

      // for (const field of otherFields) {
      //   try {
      //     const exists = await CustomFieldModel.findOne({
      //       name: field.name,
      //       company: member.company._id,
      //     });
      //     if (!exists) {
      //       const sectionExists =
      //         await CustomSectionModel.findOne({
      //           name: "Leads",
      //           company: member.company._id,
      //         });
      //       let sectionId;
      //       if (sectionExists) {
      //         sectionId = sectionExists._id;
      //       } else {
      //         const section = await new CustomSectionModel({
      //           name: "Leads",
      //           panel: "lead",
      //           company: member.company._id,
      //           createdBy: member._id,
      //           updatedBy: member._id,
      //         }).save();
      //         sectionId = section._id;
      //       }
      //       await new CustomFieldModel({
      //         name: field.name,
      //         description: field.name,
      //         section: sectionId,
      //         order: 1,
      //         hide: false,
      //         valueType: "string",
      //         fieldType: "text",
      //         required: false,
      //         allowMultiple: false,
      //         placeholder: "",
      //         helpText: "",
      //         defaultValue: "",
      //         options: [],
      //         panel: "lead",
      //         company: member.company._id,
      //         createdBy: member._id,
      //         updatedBy: member._id,
      //       }).save();
      //     }
      //   } catch (err) {
      //     console.error("CustomField error:", err.message);
      //   }
      // }

      const leadFormattedData = {
        formData: {
          ...otherFields.reduce(
            (acc, field) => ({
              ...acc,
              [field.name]: field.values?.[0],
            }),
            {},
          ),
          formId: form._id,
          pageId: newPage._id,
          leadId: lead?.id,
          ad_id: lead.ad_id,
          ad_name: lead.ad_name,
          adset_id: lead.adset_id,
          adset_name: lead.adset_name,
          campaignId: lead.campaign_id,
          campaignName: lead.campaign_name,
          utmCampaignId: lead.campaign_id,
          utmCampaignName: lead.campaign_name,
          enquiryAt: lead?.created_time,
        },
        email: lead?.field_data?.find((field) => field.name == "email")
          ?.values?.[0],
        contactNumber: contactNumber ? contactNumber : undefined,
        work_phone_number: work_phone_number ? work_phone_number : undefined,
        whatsapp_contact_number: whatsapp_contact_number
          ? whatsapp_contact_number
          : undefined,
        name: lead?.field_data?.find((field) => field.name == "full_name")
          ?.values?.[0],
      };
      Object.keys(leadFormattedData).forEach((key) => {
        if (!leadFormattedData[key]) delete leadFormattedData[key];
      });
      // console.log("leadFormattedData", leadFormattedData);
      const syncedLeads = await leadCreateFun({
        ...leadFormattedData,
        source: "Facebook",
        member,
      });
      return syncedLeads;
    } catch (err) {
      console.error("Lead processing error:", err.message);
    }
  });
};
const syncAllLeadsByForm = async (form, newPage, member) => {
  if (form.isActive) {
    console.log("members", member);
    try {
      const result = await syncFormLeads(
        newPage?.accessToken,
        form.formId,
        member.company._id,
      );
      await facebookLeadsToLeads(result.leads, form, newPage, member);
    } catch (err) {
      console.error("syncFormLeads error:", err.message);
    }
  }
};
const syncAllFormsLeads = async (forms, newPage, member) => {
  const newForms = [];
  for (const form of forms) {
    const lastSynced = new Date();
    try {
      let newForm = await updateUserForm(
        { _id: form._id },
        undefined,
        lastSynced,
        true,
      );
      // console.log("newForm", newForm);
      const leads = await syncAllLeadsByForm(newForm, newPage, member);
      newForm = await updateUserForm(
        { _id: form._id },
        form.isActive,
        undefined,
        false,
      );
      newForms.push(newForm);
    } catch (err) {
      console.error("updateUserForm error:", err.message);
    }
  }
  return newForms;
};
const syncAllByPages = async (pages, member) => {
  const updatedPages = [];
  for (const page of pages) {
    try {
      const newPage = await updateUserPages(page._id, page.isActive);
      // console.log("newPage", newPage);
      newPage.forms = await syncAllFormsLeads(
        page.forms || newPage.forms,
        newPage,
        member,
      );

      updatedPages.push(newPage);
    } catch (err) {
      console.error("updateUserPages error:", err.message);
    }
  }
  return updatedPages;
};

const getReminderConfig = (config = {}) => ({
  reminderType: config.reminderType,
  days: Number(config.days ?? config.reminderDays ?? 0),
  hours: Number(config.hours ?? config.reminderHours ?? 0),
  minutes: Number(config.minutes ?? config.reminderMinutes ?? 0),
});

const getReminderOffsetMs = ({ days = 0, hours = 0, minutes = 0 } = {}) =>
  ((days * 24 + hours) * 60 + minutes) * 60 * 1000;

const getReminderToleranceMs = ({ hours = 0, minutes = 0 } = {}) => {
  if (minutes) return 60 * 1000;
  if (hours) return 60 * 60 * 1000;

  return 24 * 60 * 60 * 1000;
};

const getReminderOffsetParts = (deltaMs) => {
  if (deltaMs < 0) return null;

  const totalMinutes = Math.round(deltaMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return {
    reminderDays: days,
    reminderHours: hours,
    reminderMinutes: minutes,
  };
};

const matchesReminderTime = (
  endDate,
  { reminderType = "reminder", days, hours, minutes } = {},
) => {
  const endTime = new Date(endDate).getTime();
  if (Number.isNaN(endTime)) return false;

  const now = Date.now();
  const offsetMs = getReminderOffsetMs({ days, hours, minutes });
  const toleranceMs = getReminderToleranceMs({ hours, minutes });
  const isAfterExpiry = ["expired", "after", "after-expiry"].includes(
    reminderType,
  );
  const deltaMs = isAfterExpiry ? now - endTime : endTime - now;

  return deltaMs >= 0 && Math.abs(deltaMs - offsetMs) < toleranceMs;
};

const getCompanyRecipient = async (company) => {
  const owner = await MemberModel.findOne({
    company: company._id,
    status: "owner",
  }).lean();

  return owner?.email || company?.email;
};

const getAdminEmailTemplate = (category) =>
  adminEmailTemplates.find((template) => template.category === category);

const getPlanExpiryDurationText = (endDate, reminderType) => {
  const endTime = new Date(endDate).getTime();
  if (Number.isNaN(endTime)) return "";

  const isAfterExpiry = ["expired", "after", "after-expiry"].includes(
    reminderType,
  );
  const diffMinutes = Math.floor(Math.abs(Date.now() - endTime) / (60 * 1000));
  const label = isAfterExpiry ? "passed" : "remaining";
  if (diffMinutes < 1) return `Less than 1 minute ${label}`;

  const days = Math.floor(diffMinutes / (24 * 60));
  const hours = Math.floor((diffMinutes % (24 * 60)) / 60);
  const minutes = diffMinutes % 60;
  const parts = [
    [days, "day"],
    [hours, "hour"],
    [minutes, "minute"],
  ]
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value} ${unit}${value === 1 ? "" : "s"}`);

  return `${parts.join(" ")} ${label}`;
};

const sendPlanCronEmail = async ({
  company,
  subscription,
  queuedSubscription,
  type,
  reminderType,
}) => {
  const recipient = await getCompanyRecipient(company);
  if (!recipient) return { company: company._id, sent: false };

  const planName = subscription?.planDetails?.name || "your current plan";
  const queuedPlanName =
    queuedSubscription?.planDetails?.name || "your queued plan";
  const formattedEndDate = subscription?.endDate
    ? new Date(subscription.endDate).toLocaleString()
    : "";
  const isQueuePlan = type === "queue-plan";
  const expiryDurationText = getPlanExpiryDurationText(
    subscription?.endDate,
    isQueuePlan ? "reminder" : reminderType,
  );
  const subject = isQueuePlan
    ? `Queued plan reminder - ${company.name}`
    : `Plan ${reminderType === "expired" ? "expired" : "expiry"} reminder - ${
        company.name
      }`;
  const message = isQueuePlan
    ? `Your queued plan ${queuedPlanName} is scheduled to start after ${planName} ends on ${formattedEndDate}.`
    : reminderType === "expired"
      ? `Your plan ${planName} expired on ${formattedEndDate}.`
      : `Your plan ${planName} will expire on ${formattedEndDate}.`;
  const emailTemplate = getAdminEmailTemplate(
    isQueuePlan ? "queue_plan_reminder" : "plan_expiry_reminder",
  );
  const { body, subject: templateSubject } = await generateTemplateBody(
    emailTemplate,
    [],
    {
      orgName: company.name,
      email: recipient,
      planName,
      queuedPlanName,
      endDate: formattedEndDate,
      expiryDurationText,
      planStatus: reminderType === "expired" ? "expired" : "expiry",
      message,
    },
  );
  const logo = await getEmailLogo(company._id);
  const actualBody = generateWholeMailBody(body, socialIcons, logo);

  await sendMail(
    recipient,
    templateSubject || subject,
    actualBody,
    company._id,
  );
  return {
    company: company._id,
    email: recipient,
    sent: true,
    subscription: subscription?._id,
    queuedSubscription: queuedSubscription?._id,
  };
};

const cronJobsToRun = async (type, variables) => {
  console.log("running cron");
  switch (type) {
    case "facebook-forms-leads": {
      const companies = await CompanyModel.find({});

      const allForms = (
        await Promise.all(
          companies.map(async (company) => {
            const app = await AppModel.findOne({ company: company._id });
            if (app?.defaultFacebook?.accessToken) {
              return await syncPagesForms(app);
            }
            return [];
          }),
        )
      ).flat();

      const allLeads = (
        await Promise.all(
          companies.map(async (company) => {
            const pages = await PageModel.find({ companyID: company._id })
              .populate("forms")
              .lean();
            const member = await MemberModel.findOne({
              company: company._id,
              status: "owner",
            }).populate("company");
            console.log("members parent", member);
            return await syncAllByPages(pages, member);
          }),
        )
      ).flat();

      return { forms: allForms, leads: allLeads };
    }
    case "plan-reminder": {
      console.log("running plan reminder");
      const companies = await CompanyModel.find({}).select("+email");
      const config = getReminderConfig(variables?.["plan-reminder"]);
      console.log("companies is", companies);
      const planReminders = (
        await Promise.all(
          companies.map(async (company) => {
            const queuedSubscription = await SubscriptionModel.findOne({
              company: company._id,
              status: "queued",
            }).lean();
            if (queuedSubscription) return null;

            const isExpiredReminder = [
              "expired",
              "after",
              "after-expiry",
            ].includes(config.reminderType);
            const subscription = await SubscriptionModel.findOne({
              company: company._id,
              status: isExpiredReminder
                ? { $in: ["active", "deactive"] }
                : "active",
            })
              .sort({ endDate: -1 })
              .lean();

            if (!subscription?.endDate) return null;
            const endTime = new Date(subscription.endDate).getTime();
            if (Number.isNaN(endTime)) return false;

            const now = Date.now();
            const offsetMs = getReminderOffsetMs(config);
            const toleranceMs = getReminderToleranceMs(config);
            const isAfterExpiry = ["expired", "after", "after-expiry"].includes(
              config.reminderType,
            );
            const deltaMs = isAfterExpiry ? now - endTime : endTime - now;
            const requiredReminderOffset = getReminderOffsetParts(deltaMs);
            console.log(
              "company.email ",
              company.email,
              queuedSubscription,
              subscription.endDate,
              matchesReminderTime(subscription.endDate, config),
              endTime,
              now,
              offsetMs,
              toleranceMs,
              deltaMs,
              "requiredReminderOffset",
              requiredReminderOffset,
            );
            if (!matchesReminderTime(subscription.endDate, config)) return null;

            return sendPlanCronEmail({
              company,
              subscription,
              type,
              reminderType: config.reminderType,
            });
          }),
        )
      ).filter(Boolean);

      return { planReminders };
    }
    case "queue-plan": {
      const companies = await CompanyModel.find({}).select("+email");
      const config = getReminderConfig(variables?.["queue-plan"]);

      const planReminders = (
        await Promise.all(
          companies.map(async (company) => {
            const [subscription, queuedSubscription] = await Promise.all([
              SubscriptionModel.findOne({
                company: company._id,
                status: "active",
              })
                .sort({ endDate: -1 })
                .lean(),
              SubscriptionModel.findOne({
                company: company._id,
                status: "queued",
              })
                .sort({ startDate: 1, effectiveAt: 1 })
                .lean(),
            ]);

            if (!subscription?.endDate || !queuedSubscription) return null;
            if (!matchesReminderTime(subscription.endDate, config)) return null;

            return sendPlanCronEmail({
              company,
              subscription,
              queuedSubscription,
              type,
              reminderType: config.reminderType,
            });
          }),
        )
      ).filter(Boolean);

      return { planReminders };
    }
    case "admin-report-notification": {
      return runAdminReportNotificationCron();
    }
    default:
      return {};
  }
};

// cronJobsToRun("facebook-forms-leads");
module.exports = {
  createCronJob,
  getAllCronJobs,
  getCronJob,
  updateCronJob,
  deleteCronJob,
  cronJobsToRun,
};
