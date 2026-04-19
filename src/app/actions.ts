"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearSession, createSession, requireAdmin, requireEditor, requireUser } from "@/lib/auth";
import { gradeTestWithAi } from "@/lib/ai-grading";
import type { QuestionUnit } from "@/lib/constants";
import type { User } from "@/lib/types";
import {
  archiveQuestion,
  authenticateUser,
  changeUserPassword,
  cloneTestForNewStudent,
  createAuditLog,
  createTest,
  createUser,
  deleteLookup,
  deleteTest,
  deleteQuestion,
  deleteUser,
  deleteAllTests,
  ensureShareToken,
  getBonusQuestionDraft,
  gradeTest,
  getDefaultTestDurationMinutes,
  getBonusQuestionPoints,
  getQuestionById,
  getTestById,
  getTestDraftQuestions,
  sendGradeEmail,
  sendReviewNotificationEmails,
  sendTestInvitationEmail,
  setBonusQuestionPoints,
  setDefaultTestDurationMinutes,
  startTestByToken,
  submitTestByToken,
  updateUser,
  updateTestDuration,
  upsertLookup,
  upsertQuestion,
} from "@/lib/repository";

function getMany(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => value.toString())
    .filter(Boolean);
}

function getOptionalQuestionUnit(value: FormDataEntryValue | null) {
  const unit = value?.toString();
  return unit === "ifr" || unit === "vfr" ? unit : undefined;
}

function getQuestionsRedirectSuffix(formData: FormData) {
  const params = new URLSearchParams();
  const unit = formData.get("unitFilter")?.toString() === "ifr" ? "ifr" : "vfr";
  const bonusFilter = formData.get("bonusFilter")?.toString();
  const subjectFilter = formData.get("subjectFilter")?.toString().trim() ?? "";
  const stageFilter = formData.get("stageFilter")?.toString().trim() ?? "";

  params.set("unit", unit);

  if (bonusFilter === "bonus" || bonusFilter === "regular") {
    params.set("bonus", bonusFilter);
  }

  if (subjectFilter) {
    params.set("subject", subjectFilter);
  }

  if (stageFilter) {
    params.set("stage", stageFilter);
  }

  return `?${params.toString()}`;
}

function getLookupSettingsRedirect(formData: FormData, extra?: string): RedirectPath {
  const unit = formData.get("lookupUnit")?.toString() === "ifr" ? "ifr" : "vfr";
  const suffix = extra ? `&${extra}` : "";
  return `/settings?unit=${unit}${suffix}` as RedirectPath;
}

function appendMany(params: URLSearchParams, name: string, values: string[]) {
  for (const value of values) {
    params.append(name, value);
  }
}

type RedirectPath = Parameters<typeof redirect>[0];
const NEW_TEST_POOL_ERROR_MESSAGE = "אין מספיק שאלות במאגר בשביל ביצוע המשימה.";
type AuditActor = Pick<User, "id" | "displayName" | "role">;
type RecipientMode = "single" | "list";
type RecipientInput = {
  email: string;
  name: string;
};

function normalizeNewTestErrorMessage(message: string) {
  return message.includes("אין מספיק שאלות") ? NEW_TEST_POOL_ERROR_MESSAGE : message;
}

function getRecipientMode(value: FormDataEntryValue | null): RecipientMode {
  return value?.toString() === "list" ? "list" : "single";
}

function parseRecipientData(rawValue: string): RecipientInput[] {
  if (!rawValue) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error("רשימת הנבחנים אינה בפורמט תקין.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("רשימת הנבחנים אינה בפורמט תקין.");
  }

  const recipients = parsed.map((recipient) => ({
    name: typeof recipient?.name === "string" ? recipient.name.trim() : "",
    email: typeof recipient?.email === "string" ? recipient.email.trim() : "",
  }));
  const normalizedRecipients = recipients.filter((recipient) => recipient.name || recipient.email);

  if (normalizedRecipients.length === 0) {
    throw new Error("יש להזין לפחות תלמיד אחד ברשימת הנבחנים.");
  }

  const seenEmails = new Set<string>();

  for (const recipient of normalizedRecipients) {
    if (!recipient.name || !recipient.email) {
      throw new Error("לכל תלמיד ברשימה חייבים להזין גם שם וגם כתובת מייל.");
    }

    const normalizedEmail = recipient.email.toLowerCase();
    if (seenEmails.has(normalizedEmail)) {
      throw new Error("אי אפשר לשלוח פעמיים לאותה כתובת מייל באותה רשימה.");
    }

    seenEmails.add(normalizedEmail);
  }

  return normalizedRecipients;
}

function buildNewTestFormRedirectPath(formData: FormData, errorMessage: string): RedirectPath {
  const params = new URLSearchParams();
  const unit = formData.get("unit")?.toString() === "ifr" ? "ifr" : "vfr";
  const selectionMode = (formData.get("selectionMode")?.toString() ?? "random") as "random" | "filtered" | "manual";

  params.set("unit", unit);
  params.set("title", formData.get("title")?.toString() ?? "");
  params.set("selectionMode", selectionMode);
  params.set("questionCount", formData.get("questionCount")?.toString() ?? "0");
  params.set("bonusQuestionCount", formData.get("bonusQuestionCount")?.toString() ?? "0");
  params.set("durationMinutes", formData.get("durationMinutes")?.toString() ?? "");
  params.set("recipientMode", getRecipientMode(formData.get("recipientMode")));
  params.set("recipientData", formData.get("recipientData")?.toString() ?? "");
  params.set("sentAt", formData.get("sentAt")?.toString() ?? "");
  params.set("studentName", formData.get("studentName")?.toString() ?? "");
  params.set("studentEmail", formData.get("studentEmail")?.toString() ?? "");
  params.set("error", normalizeNewTestErrorMessage(errorMessage));

  if (formData.get("onlyAnswered")?.toString() === "on") {
    params.set("onlyAnswered", "1");
  }

  appendMany(params, "subjectIds", getMany(formData, "subjectIds"));
  appendMany(params, "stageIds", getMany(formData, "stageIds"));
  appendMany(params, "questionIds", getMany(formData, "questionIds"));

  return `/tests/new?${params.toString()}` as RedirectPath;
}

function buildTestsLibraryRedirectPath(unit: string | undefined, extra?: string): RedirectPath {
  const selectedUnit = unit === "ifr" ? "ifr" : "vfr";
  const suffix = extra ? `&${extra}` : "";
  return `/tests/library?unit=${selectedUnit}${suffix}` as RedirectPath;
}

function revalidateTestCollections() {
  revalidatePath("/dashboard");
  revalidatePath("/tests/library");
  revalidatePath("/tests/archive");
  revalidatePath("/tests/review");
  revalidatePath("/tests/graded");
}

async function logUserAudit(
  user: AuditActor,
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    entityLabel?: string | null;
    details?: Record<string, unknown> | null;
  },
) {
  await createAuditLog({
    actorUserId: user.id,
    actorDisplayName: user.displayName,
    actorRole: user.role,
    ...input,
  });
  revalidatePath("/admin/logs");
}

async function logAudit(input: {
  actorDisplayName: string;
  actorRole?: AuditActor["role"] | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  details?: Record<string, unknown> | null;
}) {
  await createAuditLog({
    actorDisplayName: input.actorDisplayName,
    actorRole: input.actorRole ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    details: input.details,
  });
  revalidatePath("/admin/logs");
}

export async function loginAction(formData: FormData) {
  const username = formData.get("username")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  const user = await authenticateUser(username, password);
  if (!user) {
    redirect("/login?error=1");
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function saveQuestionAction(formData: FormData) {
  const user = await requireEditor();
  const id = formData.get("id")?.toString() || null;
  const redirectSuffix = getQuestionsRedirectSuffix(formData);
  try {
    const questionId = await upsertQuestion({
      id,
      text: formData.get("text")?.toString() ?? "",
      answer: formData.get("answer")?.toString() ?? "",
      questionType: formData.get("questionType")?.toString() ?? "open",
      isBonusSource: formData.get("isBonusSource")?.toString() === "on",
      unit: (formData.get("unit")?.toString() ?? "vfr") as QuestionUnit,
      source: formData.get("source")?.toString() ?? "הוזן ידנית",
      sourceReference: formData.get("sourceReference")?.toString() ?? null,
      subjectIds: getMany(formData, "subjectIds"),
      stageIds: getMany(formData, "stageIds"),
    });
    const savedQuestion = await getQuestionById(questionId);
    await logUserAudit(user, {
      action: id ? "question.updated" : "question.created",
      entityType: "question",
      entityId: questionId,
      entityLabel: savedQuestion?.sourceReference ?? savedQuestion?.text.slice(0, 80) ?? null,
      details: savedQuestion
        ? {
            unit: savedQuestion.unit,
            source: savedQuestion.source,
            sourceReference: savedQuestion.sourceReference,
            isBonusSource: savedQuestion.isBonusSource,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שמירת השאלה נכשלה";
    redirect(`/questions${redirectSuffix}&error=${encodeURIComponent(message)}` as RedirectPath);
  }

  revalidatePath("/questions");
  redirect(`/questions${redirectSuffix}` as RedirectPath);
}

export async function archiveQuestionAction(formData: FormData) {
  const user = await requireAdmin();
  const redirectSuffix = getQuestionsRedirectSuffix(formData);
  const id = formData.get("id")?.toString();
  if (!id) {
    redirect(`/questions${redirectSuffix}` as RedirectPath);
  }

  const question = await getQuestionById(id);
  await archiveQuestion(id);
  await logUserAudit(user, {
    action: "question.archived",
    entityType: "question",
    entityId: id,
    entityLabel: question?.sourceReference ?? question?.text.slice(0, 80) ?? null,
    details: question
      ? {
          unit: question.unit,
          source: question.source,
          sourceReference: question.sourceReference,
        }
      : null,
  });
  revalidatePath("/questions");
  redirect(`/questions${redirectSuffix}` as RedirectPath);
}

export async function deleteQuestionAction(formData: FormData) {
  const user = await requireAdmin();
  const redirectSuffix = getQuestionsRedirectSuffix(formData);
  const id = formData.get("id")?.toString();
  if (!id) {
    redirect(`/questions${redirectSuffix}` as RedirectPath);
  }

  const question = await getQuestionById(id);
  await deleteQuestion(id);
  await logUserAudit(user, {
    action: "question.deleted",
    entityType: "question",
    entityId: id,
    entityLabel: question?.sourceReference ?? question?.text.slice(0, 80) ?? null,
    details: question
      ? {
          unit: question.unit,
          source: question.source,
          sourceReference: question.sourceReference,
        }
      : null,
  });
  revalidatePath("/questions");
  redirect(`/questions${redirectSuffix}` as RedirectPath);
}

export async function saveLookupAction(formData: FormData) {
  const user = await requireEditor();
  const type = formData.get("type")?.toString();
  const name = formData.get("name")?.toString() ?? "";
  const id = formData.get("id")?.toString() || null;
  const lookupUnit = (formData.get("lookupUnit")?.toString() === "ifr" ? "ifr" : "vfr") as QuestionUnit;

  if (type !== "subjects" && type !== "stages") {
    redirect("/settings");
  }

  try {
    const savedLookup = await upsertLookup(type, id, name, lookupUnit);
    await logUserAudit(user, {
      action: id ? "lookup.updated" : "lookup.created",
      entityType: "lookup",
      entityId: savedLookup?.id ?? null,
      entityLabel: savedLookup?.name ?? name.trim(),
      details: {
        lookupType: type,
        unit: savedLookup?.unit ?? lookupUnit,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שמירת הערך נכשלה";
    redirect(getLookupSettingsRedirect(formData, `lookupError=${encodeURIComponent(message)}`));
  }

  revalidatePath("/settings");
  revalidatePath("/questions");
  revalidatePath("/tests/new");
  redirect(getLookupSettingsRedirect(formData));
}

export async function deleteLookupAction(formData: FormData) {
  const user = await requireAdmin();
  const type = formData.get("type")?.toString();
  const id = formData.get("id")?.toString();

  if ((type !== "subjects" && type !== "stages") || !id) {
    redirect("/settings");
  }

  const deletedLookup = await deleteLookup(type, id);
  await logUserAudit(user, {
    action: "lookup.deleted",
    entityType: "lookup",
    entityId: deletedLookup?.id ?? id,
    entityLabel: deletedLookup?.name ?? null,
    details: {
      lookupType: type,
      unit: deletedLookup?.unit ?? formData.get("lookupUnit")?.toString() ?? null,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/questions");
  revalidatePath("/tests/new");
  redirect(getLookupSettingsRedirect(formData));
}

export async function saveUserAction(formData: FormData) {
  const user = await requireAdmin();

  try {
    const savedUser = await createUser({
      username: formData.get("username")?.toString() ?? "",
      displayName: formData.get("displayName")?.toString() ?? "",
      email: formData.get("email")?.toString() ?? "",
      role: (formData.get("role")?.toString() ?? "editor") as "admin" | "editor" | "viewer",
      reviewNotificationsEnabled: formData.get("reviewNotificationsEnabled")?.toString() === "on",
      units: getMany(formData, "units") as QuestionUnit[],
      password: formData.get("password")?.toString() ?? "",
    });
    await logUserAudit(user, {
      action: "user.created",
      entityType: "user",
      entityId: savedUser.id,
      entityLabel: savedUser.displayName,
      details: {
        username: savedUser.username,
        role: savedUser.role,
        units: savedUser.units,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שמירת המשתמש נכשלה";
    redirect(`/settings?userError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings");
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";

  try {
    const deletedUser = await deleteUser({
      id,
      actingUserId: currentUser.id,
    });
    await logUserAudit(currentUser, {
      action: "user.deleted",
      entityType: "user",
      entityId: deletedUser.id,
      entityLabel: deletedUser.displayName,
      details: {
        username: deletedUser.username,
        role: deletedUser.role,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "מחיקת המשתמש נכשלה";
    redirect(`/settings?userDeleteError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?userDeleted=1");
}

export async function deleteAllTestsAction(formData: FormData) {
  const user = await requireAdmin();
  const confirmation = formData.get("confirmation")?.toString().trim() ?? "";

  if (confirmation !== "מחק הכל") {
    redirect("/settings?testsClearError=1");
  }

  const deletedCount = await deleteAllTests();
  await logUserAudit(user, {
    action: "test.bulk_deleted",
    entityType: "test",
    entityLabel: "כל המבחנים",
    details: {
      deletedCount,
    },
  });

  revalidateTestCollections();
  revalidatePath("/tests/new");
  revalidatePath("/settings");
  redirect("/settings?testsCleared=1");
}

export async function deleteTestAction(formData: FormData) {
  const user = await requireAdmin();
  const testId = formData.get("testId")?.toString() ?? "";
  const unit = formData.get("unit")?.toString();

  if (!testId) {
    redirect(buildTestsLibraryRedirectPath(unit));
  }

  try {
    const deletedTest = await deleteTest(testId);
    await logUserAudit(user, {
      action: "test.deleted",
      entityType: "test",
      entityId: deletedTest.id,
      entityLabel: deletedTest.title,
      details: {
        unit: deletedTest.unit,
        status: deletedTest.status,
        studentName: deletedTest.studentName,
        studentEmail: deletedTest.studentEmail,
      },
    });

    revalidateTestCollections();
    revalidatePath(`/tests/${testId}`);
    if (deletedTest.shareToken) {
      revalidatePath(`/share/${deletedTest.shareToken}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "מחיקת המבחן נכשלה";
    redirect(buildTestsLibraryRedirectPath(unit, `deleteError=${encodeURIComponent(message)}`));
  }

  redirect(buildTestsLibraryRedirectPath(unit, "deleted=1"));
}

export async function updateUserAction(formData: FormData) {
  const user = await requireAdmin();

  try {
    const savedUser = await updateUser({
      id: formData.get("id")?.toString() ?? "",
      username: formData.get("username")?.toString() ?? "",
      displayName: formData.get("displayName")?.toString() ?? "",
      email: formData.get("email")?.toString() ?? "",
      role: (formData.get("role")?.toString() ?? "editor") as "admin" | "editor" | "viewer",
      reviewNotificationsEnabled: formData.get("reviewNotificationsEnabled")?.toString() === "on",
      units: getMany(formData, "units") as QuestionUnit[],
      password: formData.get("password")?.toString() ?? "",
    });
    await logUserAudit(user, {
      action: "user.updated",
      entityType: "user",
      entityId: savedUser.id,
      entityLabel: savedUser.displayName,
      details: {
        username: savedUser.username,
        role: savedUser.role,
        units: savedUser.units,
        passwordReset: Boolean(formData.get("password")?.toString()?.trim()),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "עדכון המשתמש נכשל";
    redirect(`/settings?userError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?userSaved=1");
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireEditor();
  const currentPassword = formData.get("currentPassword")?.toString() ?? "";
  const newPassword = formData.get("newPassword")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";

  if (newPassword !== confirmPassword) {
    redirect("/settings?passwordError=1");
  }

  try {
    await changeUserPassword({
      userId: user.id,
      currentPassword,
      newPassword,
    });
  } catch {
    redirect("/settings?passwordError=1");
  }

  revalidatePath("/settings");
  await logUserAudit(user, {
    action: "user.password_changed",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.displayName,
  });
  redirect("/settings?passwordSaved=1");
}

export async function saveDefaultDurationAction(formData: FormData) {
  const user = await requireEditor();

  const rawValue = formData.get("defaultDurationMinutes")?.toString().trim() ?? "";
  const currentDefault = await getDefaultTestDurationMinutes();
  const durationMinutes = rawValue === "" ? currentDefault : Number(rawValue);

  await setDefaultTestDurationMinutes(Number.isNaN(durationMinutes) ? currentDefault : durationMinutes);
  await logUserAudit(user, {
    action: "settings.default_duration_updated",
    entityType: "settings",
    entityId: "default_test_duration_minutes",
    entityLabel: "ברירת מחדל למשך מבחן",
    details: {
      value: Number.isNaN(durationMinutes) ? currentDefault : durationMinutes,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/tests/new");
  redirect("/settings?durationSaved=1");
}

export async function saveBonusQuestionPointsAction(formData: FormData) {
  const user = await requireAdmin();

  const rawValue = formData.get("bonusQuestionPoints")?.toString().trim() ?? "";
  const currentValue = await getBonusQuestionPoints();
  const points = rawValue === "" ? currentValue : Number(rawValue);

  await setBonusQuestionPoints(Number.isNaN(points) ? currentValue : points);
  await logUserAudit(user, {
    action: "settings.bonus_points_updated",
    entityType: "settings",
    entityId: "bonus_question_points",
    entityLabel: "שווי שאלת בונוס",
    details: {
      value: Number.isNaN(points) ? currentValue : points,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/tests/new");
  revalidatePath("/tests/new/review");
  revalidatePath("/tests/graded");
  redirect("/settings?bonusSaved=1");
}

export async function createTestAction(formData: FormData) {
  const user = await requireEditor();
  const rawDuration = formData.get("durationMinutes")?.toString().trim() ?? "";
  const selectedUnit = formData.get("unit")?.toString() === "ifr" ? "ifr" : "vfr";
  const recipientMode = getRecipientMode(formData.get("recipientMode"));
  const title = formData.get("title")?.toString() ?? "";
  const selectionMode = (formData.get("selectionMode")?.toString() ?? "random") as "random" | "filtered" | "manual";
  const questionCount = Number(formData.get("questionCount")?.toString() ?? "0");
  const bonusQuestionCount = Number(formData.get("bonusQuestionCount")?.toString() ?? "0");
  const sentAt = formData.get("sentAt")?.toString() ?? "";
  const subjectIds = getMany(formData, "subjectIds");
  const stageIds = getMany(formData, "stageIds");
  const questionIds = getMany(formData, "questionIds");
  const selectedQuestionIds = getMany(formData, "selectedQuestionIds");
  const bonusSelectedQuestionIds = getMany(formData, "bonusSelectedQuestionIds");
  const onlyAnswered = formData.get("onlyAnswered")?.toString() === "on";
  const singleStudentName = formData.get("studentName")?.toString() ?? "";
  const singleStudentEmail = formData.get("studentEmail")?.toString() ?? "";

  try {
    if (recipientMode === "list") {
      const recipients = parseRecipientData(formData.get("recipientData")?.toString() ?? "");
      let createdCount = 0;
      let failedCount = 0;
      let sentCount = 0;

      for (const recipient of recipients) {
        const testId = await createTest({
          title,
          createdBy: user.id,
          selectionMode,
          unit: (formData.get("unit")?.toString() ?? "vfr") as QuestionUnit,
          questionCount,
          bonusQuestionCount,
          bonusSourceUnit: getOptionalQuestionUnit(formData.get("bonusSourceUnit")),
          durationMinutes: rawDuration === "" ? undefined : Number(rawDuration),
          sentAt,
          onlyAnswered,
          subjectIds,
          stageIds,
          questionIds,
          selectedQuestionIds,
          bonusSelectedQuestionIds,
          studentName: recipient.name,
          studentEmail: recipient.email,
        });

        createdCount += 1;
        const createdTest = await getTestById(testId);
        await logUserAudit(user, {
          action: "test.created",
          entityType: "test",
          entityId: testId,
          entityLabel: createdTest?.title ?? title ?? null,
          details: {
            unit: createdTest?.unit ?? selectedUnit,
            selectionMode,
            questionCount: createdTest?.questionCount ?? null,
            studentName: createdTest?.studentName ?? recipient.name,
            studentEmail: createdTest?.studentEmail ?? recipient.email,
          },
        });

        try {
          await sendTestInvitationEmail(testId);
          sentCount += 1;
          const sentTest = await getTestById(testId);
          await logUserAudit(user, {
            action: "test.invitation_email_sent",
            entityType: "test",
            entityId: testId,
            entityLabel: sentTest?.title ?? title ?? null,
            details: {
              studentEmail: sentTest?.studentEmail ?? recipient.email,
            },
          });
        } catch (error) {
          failedCount += 1;
          console.error(`Bulk test invitation failed for ${recipient.email}`, error);
        }
      }

      await logUserAudit(user, {
        action: "test.bulk_dispatched",
        entityType: "test",
        entityLabel: title || "שליחה מרוכזת",
        details: {
          createdCount,
          failedCount,
          recipientMode,
          sentCount,
          unit: selectedUnit,
        },
      });

      revalidateTestCollections();
      revalidatePath("/tests/new");
      redirect(
        buildTestsLibraryRedirectPath(
          selectedUnit,
          `bulkCreated=${createdCount}&bulkSent=${sentCount}&bulkFailed=${failedCount}`,
        ),
      );
    }

    const id = await createTest({
      title,
      createdBy: user.id,
      selectionMode,
      unit: (formData.get("unit")?.toString() ?? "vfr") as QuestionUnit,
      questionCount,
      bonusQuestionCount,
      bonusSourceUnit: getOptionalQuestionUnit(formData.get("bonusSourceUnit")),
      durationMinutes: rawDuration === "" ? undefined : Number(rawDuration),
      sentAt,
      onlyAnswered,
      subjectIds,
      stageIds,
      questionIds,
      selectedQuestionIds,
      bonusSelectedQuestionIds,
      studentName: singleStudentName,
      studentEmail: singleStudentEmail,
    });
    const test = await getTestById(id);
    await logUserAudit(user, {
      action: "test.created",
      entityType: "test",
      entityId: id,
      entityLabel: test?.title ?? title ?? null,
      details: {
        unit: test?.unit ?? selectedUnit,
        selectionMode,
        questionCount: test?.questionCount ?? null,
        studentName: test?.studentName ?? singleStudentName ?? null,
        studentEmail: test?.studentEmail ?? singleStudentEmail ?? null,
      },
    });

    if (singleStudentEmail.trim()) {
      let redirectPath = `/tests/${id}?inviteMail=sent` as RedirectPath;

      try {
        await sendTestInvitationEmail(id);
        const sentTest = await getTestById(id);
        await logUserAudit(user, {
          action: "test.invitation_email_sent",
          entityType: "test",
          entityId: id,
          entityLabel: sentTest?.title ?? title ?? null,
          details: {
            studentEmail: sentTest?.studentEmail ?? singleStudentEmail,
          },
        });
        if (sentTest?.shareToken) {
          revalidatePath(`/share/${sentTest.shareToken}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "שליחת המבחן במייל נכשלה";
        redirectPath = `/tests/${id}?inviteMailError=${encodeURIComponent(message)}` as RedirectPath;
      }

      revalidateTestCollections();
      revalidatePath(`/tests/${id}`);
      redirect(redirectPath);
    }

    revalidatePath("/dashboard");
    revalidatePath("/tests/library");
    redirect(`/tests/${id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "יצירת המבחן נכשלה";
    redirect(buildNewTestFormRedirectPath(formData, message));
  }
}

export async function prepareTestDraftAction(formData: FormData) {
  await requireEditor();
  const selectionMode = (formData.get("selectionMode")?.toString() ?? "random") as "random" | "filtered" | "manual";
  const recipientMode = getRecipientMode(formData.get("recipientMode"));

  if (recipientMode === "list") {
    try {
      parseRecipientData(formData.get("recipientData")?.toString() ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "רשימת הנבחנים אינה תקינה";
      redirect(buildNewTestFormRedirectPath(formData, message));
    }
  }

  if (selectionMode === "manual") {
    return createTestAction(formData);
  }

  try {
    const unit = (formData.get("unit")?.toString() ?? "vfr") as QuestionUnit;
    const subjectIds = getMany(formData, "subjectIds");
    const stageIds = getMany(formData, "stageIds");
    const onlyAnswered = formData.get("onlyAnswered")?.toString() === "on";
    const questionCount = Number(formData.get("questionCount")?.toString() ?? "0");
    const bonusQuestionCount = Number(formData.get("bonusQuestionCount")?.toString() ?? "0");
    let redirectPath: RedirectPath | null = null;

    const draft = await getTestDraftQuestions({
      selectionMode,
      unit,
      questionCount,
      onlyAnswered,
      subjectIds,
      stageIds,
    });
    const bonusDraft =
      bonusQuestionCount > 0
        ? await getBonusQuestionDraft({
            questionCount: bonusQuestionCount,
            excludeQuestionIds: draft.selectedQuestions.map((question) => question.id),
          })
        : null;

    const params = new URLSearchParams();
    params.set("title", formData.get("title")?.toString() ?? "");
    params.set("selectionMode", selectionMode);
    params.set("unit", unit);
    params.set("questionCount", String(questionCount));
    params.set("bonusQuestionCount", String(Math.max(0, Number.isNaN(bonusQuestionCount) ? 0 : bonusQuestionCount)));
    params.set("durationMinutes", formData.get("durationMinutes")?.toString() ?? "");
    params.set("recipientMode", recipientMode);
    params.set("recipientData", formData.get("recipientData")?.toString() ?? "");
    params.set("sentAt", formData.get("sentAt")?.toString() ?? "");
    params.set("studentName", formData.get("studentName")?.toString() ?? "");
    params.set("studentEmail", formData.get("studentEmail")?.toString() ?? "");

    if (onlyAnswered) {
      params.set("onlyAnswered", "1");
    }

    appendMany(params, "subjectIds", subjectIds);
    appendMany(params, "stageIds", stageIds);
    appendMany(
      params,
      "selectedQuestionIds",
      draft.selectedQuestions.map((question) => question.id),
    );
    appendMany(
      params,
      "bonusSelectedQuestionIds",
      bonusDraft?.selectedQuestions.map((question) => question.id) ?? [],
    );
    if (bonusDraft?.sourceUnit) {
      params.set("bonusSourceUnit", bonusDraft.sourceUnit);
    }
    redirectPath = `/tests/new/review?${params.toString()}` as RedirectPath;

    if (!redirectPath) {
      redirect(buildNewTestFormRedirectPath(formData, "יצירת טיוטת המבחן נכשלה"));
    }

    redirect(redirectPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "יצירת טיוטת המבחן נכשלה";
    redirect(buildNewTestFormRedirectPath(formData, message));
  }
}

export async function createShareLinkAction(formData: FormData) {
  const user = await requireEditor();
  const id = formData.get("id")?.toString() ?? "";
  const shareToken = await ensureShareToken(id);
  const test = await getTestById(id);
  await logUserAudit(user, {
    action: "test.share_link_created",
    entityType: "test",
    entityId: id,
    entityLabel: test?.title ?? null,
    details: {
      shareToken,
      unit: test?.unit ?? null,
    },
  });
  revalidatePath(`/tests/${id}`);
  revalidatePath(`/share/${shareToken}`);
  revalidatePath("/dashboard");
  redirect(`/tests/${id}`);
}

export async function resendArchivedTestAction(formData: FormData) {
  const user = await requireEditor();
  const sourceTestId = formData.get("sourceTestId")?.toString() ?? "";
  let newTestId = "";

  try {
    newTestId = await cloneTestForNewStudent({
      sourceTestId,
      createdBy: user.id,
      studentName: formData.get("studentName")?.toString() ?? "",
      studentEmail: formData.get("studentEmail")?.toString() ?? "",
      sentAt: formData.get("sentAt")?.toString() ?? "",
    });

    const shareToken = await ensureShareToken(newTestId);
    const [newTest, sourceTest] = await Promise.all([getTestById(newTestId), getTestById(sourceTestId)]);
    await logUserAudit(user, {
      action: "test.cloned",
      entityType: "test",
      entityId: newTestId,
      entityLabel: newTest?.title ?? null,
      details: {
        sourceTestId,
        sourceTitle: sourceTest?.title ?? null,
        shareToken,
        studentName: newTest?.studentName ?? formData.get("studentName")?.toString() ?? null,
        studentEmail: newTest?.studentEmail ?? formData.get("studentEmail")?.toString() ?? null,
      },
    });
    revalidatePath("/tests/archive");
    revalidatePath("/tests/library");
    revalidatePath("/dashboard");
  } catch (error) {
    const message = error instanceof Error ? error.message : "שכפול המבחן נכשל";
    redirect(`/tests/archive?error=${encodeURIComponent(message)}`);
  }

  redirect(`/tests/${newTestId}?reused=1`);
}

export async function updateTestDurationAction(formData: FormData) {
  const user = await requireEditor();
  const testId = formData.get("testId")?.toString() ?? "";
  const shareToken = formData.get("shareToken")?.toString() ?? "";
  const rawValue = formData.get("durationMinutes")?.toString().trim() ?? "";

  await updateTestDuration({
    testId,
    durationMinutes: rawValue === "" ? undefined : Number(rawValue),
  });
  const test = await getTestById(testId);
  await logUserAudit(user, {
    action: "test.duration_updated",
    entityType: "test",
    entityId: testId,
    entityLabel: test?.title ?? null,
    details: {
      durationMinutes: test?.durationMinutes ?? null,
    },
  });

  revalidatePath(`/tests/${testId}`);
  if (shareToken) {
    revalidatePath(`/share/${shareToken}`);
  }
  redirect(`/tests/${testId}?durationSaved=1`);
}

export async function startSharedTestAction(formData: FormData) {
  const token = formData.get("token")?.toString() ?? "";
  let testId = "";
  try {
    testId = await startTestByToken(
      token,
      formData.get("studentName")?.toString() ?? "",
      formData.get("studentEmail")?.toString() ?? "",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "התחלת המבחן נכשלה";
    redirect(`/share/${token}?error=${encodeURIComponent(message)}`);
  }

  if (testId) {
    const test = await getTestById(testId);
    await logAudit({
      actorDisplayName:
        formData.get("studentName")?.toString().trim() ||
        formData.get("studentEmail")?.toString().trim() ||
        "נבחן/ת בקישור שיתוף",
      action: "test.started",
      entityType: "test",
      entityId: testId,
      entityLabel: test?.title ?? null,
      details: {
        studentName: test?.studentName ?? formData.get("studentName")?.toString() ?? null,
        studentEmail: test?.studentEmail ?? formData.get("studentEmail")?.toString() ?? null,
      },
    });
  }

  redirect(`/share/${token}`);
}

export async function submitSharedTestAction(formData: FormData) {
  const token = formData.get("token")?.toString() ?? "";
  const ids = getMany(formData, "questionIds");
  const answers = ids.map((id) => ({
    id,
    answer: formData.get(`answer:${id}`)?.toString() ?? "",
  }));
  let testId = "";

  try {
    testId = await submitTestByToken({
      token,
      answers,
      studentName: formData.get("studentName")?.toString() ?? "",
      studentEmail: formData.get("studentEmail")?.toString() ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שליחת המבחן נכשלה";
    redirect(`/share/${token}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/tests/review");
  revalidatePath("/tests/archive");
  revalidatePath("/tests/library");
  if (testId) {
    revalidatePath(`/tests/${testId}`);
    const submittedTest = await getTestById(testId);
    await logAudit({
      actorDisplayName:
        submittedTest?.studentName ||
        formData.get("studentName")?.toString().trim() ||
        submittedTest?.studentEmail ||
        formData.get("studentEmail")?.toString().trim() ||
        "נבחן/ת בקישור שיתוף",
      action: "test.submitted",
      entityType: "test",
      entityId: testId,
      entityLabel: submittedTest?.title ?? null,
      details: {
        studentName: submittedTest?.studentName ?? null,
        studentEmail: submittedTest?.studentEmail ?? null,
      },
    });
    try {
      await sendReviewNotificationEmails(testId);
    } catch (error) {
      console.error("Review notification email failed", error);
    }
  }

  redirect(`/share/${token}?submitted=1`);
}

export async function gradeTestAction(formData: FormData) {
  const user = await requireEditor();

  const testId = formData.get("testId")?.toString() ?? "";
  const ids = getMany(formData, "questionIds");
  const grades = ids.map((id) => ({
    id,
    score: Number(formData.get(`score:${id}`)?.toString() ?? "0"),
    feedback: formData.get(`feedback:${id}`)?.toString() ?? "",
  }));

  const gradedTest = await gradeTest({
    testId,
    gradedByName: user.displayName,
    gradingNotes: formData.get("gradingNotes")?.toString() ?? "",
    grades,
  });
  await logUserAudit(user, {
    action: "test.graded",
    entityType: "test",
    entityId: testId,
    entityLabel: gradedTest.title,
    details: {
      grade: gradedTest.grade,
      questionCount: gradedTest.questionCount,
    },
  });

  revalidatePath(`/tests/${testId}`);
  revalidatePath("/tests/graded");
  revalidatePath("/dashboard");

  let redirectPath = `/tests/${testId}?mail=sent` as RedirectPath;
  try {
    await sendGradeEmail(gradedTest);
  } catch (error) {
    const message = error instanceof Error ? error.message : "הבדיקה נשמרה, אך שליחת המייל לנבחן נכשלה";
    redirectPath = `/tests/${testId}?mailError=${encodeURIComponent(message)}` as RedirectPath;
  }

  redirect(redirectPath);
}

export async function gradeTestWithAiAction(formData: FormData) {
  const user = await requireEditor();
  const testId = formData.get("testId")?.toString() ?? "";

  try {
    await gradeTestWithAi(testId, user.displayName);
    const gradedTest = await getTestById(testId);
    await logUserAudit(user, {
      action: "test.graded_with_ai",
      entityType: "test",
      entityId: testId,
      entityLabel: gradedTest?.title ?? null,
      details: {
        grade: gradedTest?.grade ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "בדיקת AI נכשלה";
    redirect(`/tests/${testId}/grade?aiError=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/tests/${testId}`);
  revalidatePath(`/tests/${testId}/grade`);
  redirect(`/tests/${testId}/grade?aiSaved=1`);
}

export async function sendGradeEmailAction(formData: FormData) {
  const user = await requireEditor();
  const testId = formData.get("testId")?.toString() ?? "";

  let redirectPath = `/tests/${testId}?mail=sent` as RedirectPath;
  try {
    await sendGradeEmail(testId);
    const test = await getTestById(testId);
    await logUserAudit(user, {
      action: "test.grade_email_sent",
      entityType: "test",
      entityId: testId,
      entityLabel: test?.title ?? null,
      details: {
        studentEmail: test?.studentEmail ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שליחת המייל נכשלה";
    redirectPath = `/tests/${testId}?mailError=${encodeURIComponent(message)}` as RedirectPath;
  }

  redirect(redirectPath);
}

export async function sendTestInvitationEmailAction(formData: FormData) {
  const user = await requireEditor();
  const testId = formData.get("testId")?.toString() ?? "";

  let redirectPath = `/tests/${testId}?inviteMail=sent` as RedirectPath;
  try {
    await sendTestInvitationEmail(testId);
    const test = await getTestById(testId);
    await logUserAudit(user, {
      action: "test.invitation_email_sent",
      entityType: "test",
      entityId: testId,
      entityLabel: test?.title ?? null,
      details: {
        studentEmail: test?.studentEmail ?? null,
      },
    });
    revalidatePath(`/tests/${testId}`);
    revalidatePath("/dashboard");
  } catch (error) {
    const message = error instanceof Error ? error.message : "שליחת המבחן במייל נכשלה";
    redirectPath = `/tests/${testId}?inviteMailError=${encodeURIComponent(message)}` as RedirectPath;
  }

  redirect(redirectPath);
}
