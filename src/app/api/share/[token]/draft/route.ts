import { NextResponse } from "next/server";

import { saveTestDraftByToken } from "@/lib/repository";
import { getTestAnswersFromFormData } from "@/lib/test-form";

type DraftRouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, { params }: DraftRouteContext) {
  const { token } = await params;
  const formData = await request.formData();
  const formToken = formData.get("token")?.toString() ?? token;

  if (formToken !== token) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  try {
    await saveTestDraftByToken({
      token,
      answers: getTestAnswersFromFormData(formData),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שמירת הטיוטה נכשלה";
    const status = message.includes("זמן המבחן הסתיים") || message.includes("כבר הוגש") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
