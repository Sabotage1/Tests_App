import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { getQuestionBankExport } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();

  const payload = await getQuestionBankExport();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"question-bank-backup-${timestamp}.json\"`,
      "Cache-Control": "no-store",
    },
  });
}
