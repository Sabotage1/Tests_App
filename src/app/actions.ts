"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearSession, createSession, requireAdmin, requireUser } from "@/lib/auth";
import { gradeTestWithAi } from "@/lib/ai-grading";
import {
  archiveQuestion,
  authenticateUser,
  changeUserPassword,
  createTest,
  createUser,
  ensureShareToken,
  gradeTest,
  getDefaultTestDurationMinutes,
  sendGradeEmail,
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
  await requireUser();

  const id = formData.get("id")?.toString() || null;
  await upsertQuestion({
    id,
    text: formData.get("text")?.toString() ?? "",
    answer: formData.get("answer")?.toString() ?? "",
    questionType: formData.get("questionType")?.toString() ?? "open",
    source: formData.get("source")?.toString() ?? "הוזן ידנית",
    sourceReference: formData.get("sourceReference")?.toString() ?? null,
    subjectIds: getMany(formData, "subjectIds"),
    stageIds: getMany(formData, "stageIds"),
  });

  revalidatePath("/questions");
  redirect("/questions");
}

export async function archiveQuestionAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) {
    redirect("/questions");
  }

  await archiveQuestion(id);
  revalidatePath("/questions");
  redirect("/questions");
}

export async function saveLookupAction(formData: FormData) {
  await requireUser();
  const type = formData.get("type")?.toString();
  const name = formData.get("name")?.toString() ?? "";
  const id = formData.get("id")?.toString() || null;

  if (type !== "subjects" && type !== "stages") {
    redirect("/settings");
  }

  await upsertLookup(type, id, name);
  revalidatePath("/settings");
  revalidatePath("/questions");
  revalidatePath("/tests/new");
  redirect("/settings");
}

export async function saveUserAction(formData: FormData) {
  await requireAdmin();

  await createUser({
    username: formData.get("username")?.toString() ?? "",
    displayName: formData.get("displayName")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    role: (formData.get("role")?.toString() ?? "editor") as "admin" | "editor",
    password: formData.get("password")?.toString() ?? "",
  });

  revalidatePath("/settings");
  redirect("/settings");
}

export async function updateUserAction(formData: FormData) {
  await requireAdmin();

  await updateUser({
    id: formData.get("id")?.toString() ?? "",
    username: formData.get("username")?.toString() ?? "",
    displayName: formData.get("displayName")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    role: (formData.get("role")?.toString() ?? "editor") as "admin" | "editor",
    password: formData.get("password")?.toString() ?? "",
  });

  revalidatePath("/settings");
  redirect("/settings?userSaved=1");
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
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
  await requireUser();

  const rawValue = formData.get("defaultDurationMinutes")?.toString().trim() ?? "";
  const currentDefault = await getDefaultTestDurationMinutes();
  const durationMinutes = rawValue === "" ? currentDefault : Number(rawValue);

  await setDefaultTestDurationMinutes(Number.isNaN(durationMinutes) ? currentDefault : durationMinutes);
  revalidatePath("/settings");
  revalidatePath("/tests/new");
  redirect("/settings?durationSaved=1");
}

export async function createTestAction(formData: FormData) {
  const user = await requireUser();
  const rawDuration = formData.get("durationMinutes")?.toString().trim() ?? "";
  let id = "";

  try {
    id = await createTest({
      title: formData.get("title")?.toString() ?? "",
      createdBy: user.id,
      selectionMode: (formData.get("selectionMode")?.toString() ?? "random") as "random" | "filtered",
      questionCount: Number(formData.get("questionCount")?.toString() ?? "0"),
      durationMinutes: rawDuration === "" ? undefined : Number(rawDuration),
      sentAt: formData.get("sentAt")?.toString() ?? "",
      subjectIds: getMany(formData, "subjectIds"),
      stageIds: getMany(formData, "stageIds"),
      studentName: formData.get("studentName")?.toString() ?? "",
      studentEmail: formData.get("studentEmail")?.toString() ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "יצירת המבחן נכשלה";
    redirect(`/tests/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/tests/${id}`);
}

export async function createShareLinkAction(formData: FormData) {
  await requireUser();
  const id = formData.get("id")?.toString() ?? "";
  await ensureShareToken(id);
  revalidatePath(`/tests/${id}`);
  revalidatePath("/dashboard");
  redirect(`/tests/${id}`);
}

export async function updateTestDurationAction(formData: FormData) {
  await requireUser();
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
  await startTestByToken(
    token,
    formData.get("studentName")?.toString() ?? "",
    formData.get("studentEmail")?.toString() ?? "",
  );
  redirect(`/share/${token}`);
}

export async function submitSharedTestAction(formData: FormData) {
  const token = formData.get("token")?.toString() ?? "";
  const ids = getMany(formData, "questionIds");
  const answers = ids.map((id) => ({
    id,
    answer: formData.get(`answer:${id}`)?.toString() ?? "",
  }));

  await submitTestByToken({
    token,
    answers,
    studentName: formData.get("studentName")?.toString() ?? "",
    studentEmail: formData.get("studentEmail")?.toString() ?? "",
  });

  redirect(`/share/${token}?submitted=1`);
}

export async function gradeTestAction(formData: FormData) {
  await requireUser();

  const testId = formData.get("testId")?.toString() ?? "";
  const ids = getMany(formData, "questionIds");
  const grades = ids.map((id) => ({
    id,
    score: Number(formData.get(`score:${id}`)?.toString() ?? "0"),
    feedback: formData.get(`feedback:${id}`)?.toString() ?? "",
  }));

  await gradeTest({
    testId,
    gradingNotes: formData.get("gradingNotes")?.toString() ?? "",
    grades,
  });

  revalidatePath(`/tests/${testId}`);
  redirect(`/tests/${testId}`);
}

export async function gradeTestWithAiAction(formData: FormData) {
  await requireUser();
  const testId = formData.get("testId")?.toString() ?? "";

  try {
    await gradeTestWithAi(testId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "בדיקת AI נכשלה";
    redirect(`/tests/${testId}/grade?aiError=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/tests/${testId}`);
  revalidatePath(`/tests/${testId}/grade`);
  redirect(`/tests/${testId}/grade?aiSaved=1`);
}

export async function sendGradeEmailAction(formData: FormData) {
  await requireUser();
  const testId = formData.get("testId")?.toString() ?? "";

  try {
    await sendGradeEmail(testId);
    redirect(`/tests/${testId}?mail=sent`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שליחת המייל נכשלה";
    redirect(`/tests/${testId}?mailError=${encodeURIComponent(message)}`);
  }
}
