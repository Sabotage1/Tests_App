import { serializeChoiceAnswer } from "@/lib/multiple-choice";

function getMany(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => value.toString())
    .filter(Boolean);
}

export function getTestAnswersFromFormData(formData: FormData) {
  return getMany(formData, "questionIds").map((id) => ({
    id,
    answer:
      formData.get(`questionType:${id}`)?.toString() === "multiple_choice"
        ? serializeChoiceAnswer(formData.getAll(`answer:${id}`).map((value) => value.toString()))
        : formData.get(`answer:${id}`)?.toString() ?? "",
  }));
}
