"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearSession, createSession, requireAdmin, requireEditor, requireUser } from "@/lib/auth";
import { gradeTestWithAi } from "@/lib/ai-grading";
import type { QuestionUnit } from "@/lib/constants";
import {
  archiveQuestion,
  authenticateUser,
  changeUserPassword,
  cloneTestForNewStudent,
  createTest,
  createUser,
  deleteLookup,
  deleteQuestion,
  deleteUser,
  deleteAllTests,
  ensureShareToken,
  gradeTest,
  getDefaultTestDurationMinutes,
  getBonusQuestionPoints,
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

function getUnitRedirectSuffix(formData: FormData) {
  const unit = formData.get("unitFilter")?.toString();
  return unit === "ifr" ? "?unit=ifr" : "?unit=vfr";
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
  await requireEditor();

  const id = formData.get("id")?.toString() || null;
  const redirectSuffix = getUnitRedirectSuffix(formData);
  try {
    await upsertQuestion({
      id,
      text: formData.get("text")?.toString() ?? "",
      answer: formData.get("answer")?.toString() ?? "",
      questionType: formData.get("questionType")?.toString() ?? "open",
      unit: (formData.get("unit")?.toString() ?? "vfr") as QuestionUnit,
      source: formData.get("source")?.toString() ?? "הוזן ידנית",
      sourceReference: formData.get("sourceReference")?.toString() ?? null,
      subjectIds: getMany(formData, "subjectIds"),
      stageIds: getMany(formData, "stageIds"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שמירת השאלה נכשלה";
    redirect(`/questions${redirectSuffix}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/questions");
  redirect(`/questions${redirectSuffix}`);
}

export async function archiveQuestionAction(formData: FormData) {
  await requireAdmin();
  const redirectSuffix = getUnitRedirectSuffix(formData);
  const id = formData.get("id")?.toString();
  if (!id) {
    redirect(`/questions${redirectSuffix}`);
  }

  await archiveQuestion(id);
  revalidatePath("/questions");
  redirect(`/questions${redirectSuffix}`);
}

export async function deleteQuestionAction(formData: FormData) {
  await requireAdmin();
  const redirectSuffix = getUnitRedirectSuffix(formData);
  const id = formData.get("id")?.toString();
  if (!id) {
    redirect(`/questions${redirectSuffix}`);
  }

  await deleteQuestion(id);
  revalidatePath("/questions");
  redirect(`/questions${redirectSuffix}`);
}

export async function saveLookupAction(formData: FormData) {
  await requireEditor();
  const type = formData.get("type")?.toString();
  const name = formData.get("name")?.toString() ?? "";
  const id = formData.get("id")?.toString() || null;
  const lookupUnit = (formData.get("lookupUnit")?.toString() === "ifr" ? "ifr" : "vfr") as QuestionUnit;

  if (type !== "subjects" && type !== "stages") {
    redirect("/settings");
  }

  try {
    await upsertLookup(type, id, name, lookupUnit);
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
  await requireAdmin();
  const type = formData.get("type")?.toString();
  const id = formData.get("id")?.toString();

  if ((type !== "subjects" && type !== "stages") || !id) {
    redirect("/settings");
  }

  await deleteLookup(type, id);
  revalidatePath("/settings");
  revalidatePath("/questions");
  revalidatePath("/tests/new");
  redirect(getLookupSettingsRedirect(formData));
}

export async function saveUserAction(formData: FormData) {
  await requireAdmin();

  await createUser({
    username: formData.get("username")?.toString() ?? "",
    displayName: formData.get("displayName")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    role: (formData.get("role")?.toString() ?? "editor") as "admin" | "editor" | "viewer",
    reviewNotificationsEnabled: formData.get("reviewNotificationsEnabled")?.toString() === "on",
    password: formData.get("password")?.toString() ?? "",
  });

  revalidatePath("/settings");
  redirect("/settings");
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";

  try {
    await deleteUser({
      id,
      actingUserId: currentUser.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "מחיקת המשתמש נכשלה";
    redirect(`/settings?userDeleteError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?userDeleted=1");
}

export async function deleteAllTestsAction(formData: FormData) {
  await requireAdmin();
  const confirmation = formData.get("confirmation")?.toString().trim() ?? "";

  if (confirmation !== "מחק הכל") {
    redirect("/settings?testsClearError=1");
  }

  await deleteAllTests();

  revalidatePath("/dashboard");
  revalidatePath("/tests/library");
  revalidatePath("/tests/archive");
  revalidatePath("/tests/review");
  revalidatePath("/tests/graded");
  revalidatePath("/tests/new");
  revalidatePath("/settings");
  redirect("/settings?testsCleared=1");
}

export async function updateUserAction(formData: FormData) {
  await requireAdmin();

  await updateUser({
    id: formData.get("id")?.toString() ?? "",
    username: formData.get("username")?.toString() ?? "",
    displayName: formData.get("displayName")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    role: (formData.get("role")?.toString() ?? "editor") as "admin" | "editor" | "viewer",
    reviewNotificationsEnabled: formData.get("reviewNotificationsEnabled")?.toString() === "on",
    password: formData.get("password")?.toString() ?? "",
  });

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
  redirect("/settings?passwordSaved=1");
}

export async function saveDefaultDurationAction(formData: FormData) {
  await requireEditor();

  const rawValue = formData.get("defaultDurationMinutes")?.toString().trim() ?? "";
  const currentDefault = await getDefaultTestDurationMinutes();
  const durationMinutes = rawValue === "" ? currentDefault : Number(rawValue);

  await setDefaultTestDurationMinutes(Number.isNaN(durationMinutes) ? currentDefault : durationMinutes);
  revalidatePath("/settings");
  revalidatePath("/tests/new");
  redirect("/settings?durationSaved=1");
}

export async function saveBonusQuestionPointsAction(formData: FormData) {
  await requireAdmin();

  const rawValue = formData.get("bonusQuestionPoints")?.toString().trim() ?? "";
  const currentValue = await getBonusQuestionPoints();
  const points = rawValue === "" ? currentValue : Number(rawValue);

  await setBonusQuestionPoints(Number.isNaN(points) ? currentValue : points);
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
  let id = "";

  try {
    id = await createTest({
      title: formData.get("title")?.toString() ?? "",
      createdBy: user.id,
      selectionMode: (formData.get("selectionMode")?.toString() ?? "random") as "random" | "filtered" | "manual",
      unit: (formData.get("unit")?.toString() ?? "vfr") as QuestionUnit,
      questionCount: Number(formData.get("questionCount")?.toString() ?? "0"),
      bonusQuestionCount: Number(formData.get("bonusQuestionCount")?.toString() ?? "0"),
      durationMinutes: rawDuration === "" ? undefined : Number(rawDuration),
      sentAt: formData.get("sentAt")?.toString() ?? "",
      onlyAnswered: formData.get("onlyAnswered")?.toString() === "on",
      subjectIds: getMany(formData, "subjectIds"),
      stageIds: getMany(formData, "stageIds"),
      questionIds: getMany(formData, "questionIds"),
      selectedQuestionIds: getMany(formData, "selectedQuestionIds"),
      bonusSelectedQuestionIds: getMany(formData, "bonusSelectedQuestionIds"),
      studentName: formData.get("studentName")?.toString() ?? "",
      studentEmail: formData.get("studentEmail")?.toString() ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "יצירת המבחן נכשלה";
    redirect(`/tests/new?unit=${selectedUnit}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/tests/library");
  redirect(`/tests/${id}`);
}

export async function prepareTestDraftAction(formData: FormData) {
  await requireEditor();
  const selectionMode = (formData.get("selectionMode")?.toString() ?? "random") as "random" | "filtered" | "manual";

  if (selectionMode === "manual") {
    return createTestAction(formData);
  }

  const unit = (formData.get("unit")?.toString() ?? "vfr") as QuestionUnit;
  const subjectIds = getMany(formData, "subjectIds");
  const stageIds = getMany(formData, "stageIds");
  const onlyAnswered = formData.get("onlyAnswered")?.toString() === "on";
  const questionCount = Number(formData.get("questionCount")?.toString() ?? "0");
  const bonusQuestionCount =
    unit === "vfr" ? Number(formData.get("bonusQuestionCount")?.toString() ?? "0") : 0;
  let redirectPath: RedirectPath | null = null;

  try {
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
        ? await getTestDraftQuestions({
            selectionMode: "random",
            unit: "ifr",
            questionCount: bonusQuestionCount,
            subjectIds: [],
            stageIds: [],
          })
        : { selectedQuestions: [] };

    const params = new URLSearchParams();
    params.set("title", formData.get("title")?.toString() ?? "");
    params.set("selectionMode", selectionMode);
    params.set("unit", unit);
    params.set("questionCount", String(questionCount));
    params.set("bonusQuestionCount", String(Math.max(0, Number.isNaN(bonusQuestionCount) ? 0 : bonusQuestionCount)));
    params.set("durationMinutes", formData.get("durationMinutes")?.toString() ?? "");
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
      bonusDraft.selectedQuestions.map((question) => question.id),
    );
    redirectPath = `/tests/new/review?${params.toString()}` as RedirectPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : "יצירת טיוטת המבחן נכשלה";
    redirect(`/tests/new?unit=${unit}&error=${encodeURIComponent(message)}`);
  }

  if (!redirectPath) {
    redirect(`/tests/new?unit=${unit}&error=${encodeURIComponent("יצירת טיוטת המבחן נכשלה")}`);
  }

  redirect(redirectPath);
}

export async function createShareLinkAction(formData: FormData) {
  await requireEditor();
  const id = formData.get("id")?.toString() ?? "";
  await ensureShareToken(id);
  revalidatePath(`/tests/${id}`);
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

    await ensureShareToken(newTestId);
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
  await requireEditor();
  const testId = formData.get("testId")?.toString() ?? "";
  const shareToken = formData.get("shareToken")?.toString() ?? "";
  const rawValue = formData.get("durationMinutes")?.toString().trim() ?? "";

  await updateTestDuration({
    testId,
    durationMinutes: rawValue === "" ? undefined : Number(rawValue),
  });

  revalidatePath(`/tests/${testId}`);
  if (shareToken) {
    revalidatePath(`/share/${shareToken}`);
  }
  redirect(`/tests/${testId}?durationSaved=1`);
}

export async function startSharedTestAction(formData: FormData) {
  const token = formData.get("token")?.toString() ?? "";
  try {
    await startTestByToken(
      token,
      formData.get("studentName")?.toString() ?? "",
      formData.get("studentEmail")?.toString() ?? "",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "התחלת המבחן נכשלה";
    redirect(`/share/${token}?error=${encodeURIComponent(message)}`);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "בדיקת AI נכשלה";
    redirect(`/tests/${testId}/grade?aiError=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/tests/${testId}`);
  revalidatePath(`/tests/${testId}/grade`);
  redirect(`/tests/${testId}/grade?aiSaved=1`);
}

export async function sendGradeEmailAction(formData: FormData) {
  await requireEditor();
  const testId = formData.get("testId")?.toString() ?? "";

  let redirectPath = `/tests/${testId}?mail=sent` as RedirectPath;
  try {
    await sendGradeEmail(testId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שליחת המייל נכשלה";
    redirectPath = `/tests/${testId}?mailError=${encodeURIComponent(message)}` as RedirectPath;
  }

  redirect(redirectPath);
}

export async function sendTestInvitationEmailAction(formData: FormData) {
  await requireEditor();
  const testId = formData.get("testId")?.toString() ?? "";

  let redirectPath = `/tests/${testId}?inviteMail=sent` as RedirectPath;
  try {
    await sendTestInvitationEmail(testId);
    revalidatePath(`/tests/${testId}`);
    revalidatePath("/dashboard");
  } catch (error) {
    const message = error instanceof Error ? error.message : "שליחת המבחן במייל נכשלה";
    redirectPath = `/tests/${testId}?inviteMailError=${encodeURIComponent(message)}` as RedirectPath;
  }

  redirect(redirectPath);
}
