import type { QuestionUnit, TestStatus, UserRole } from "@/lib/constants";

export type User = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  reviewNotificationsEnabled: boolean;
  units: QuestionUnit[];
};

export type Option = {
  label: string;
  value: string;
  unit?: QuestionUnit;
};

export type QuestionRow = {
  id: string;
  text: string;
  answer: string;
  questionType: string;
  isBonusSource: boolean;
  unit: QuestionUnit;
  source: string;
  sourceReference: string | null;
  subjectIds: string[];
  stageIds: string[];
  subjectNames: string[];
  stageNames: string[];
  updatedAt: string;
  isActive: number;
};

export type TestBuilderQuestion = {
  id: string;
  text: string;
  answer: string;
  questionType: string;
  isBonusSource: boolean;
  unit: QuestionUnit;
  source: string;
  sourceReference: string | null;
  subjectIds: string[];
  stageIds: string[];
  subjectNames: string[];
  stageNames: string[];
};

export type TestListItem = {
  id: string;
  title: string;
  status: TestStatus;
  selectionMode: string;
  unit: QuestionUnit;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  questionCount: number;
  creatorName: string;
  studentName: string | null;
  studentEmail: string | null;
  grade: number | null;
  subjectNames: string[];
  stageNames: string[];
};

export type TestQuestion = {
  id: string;
  orderIndex: number;
  isBonus: boolean;
  prompt: string;
  expectedAnswer: string;
  studentAnswer: string | null;
  score: number | null;
  feedback: string | null;
  subjectNames: string[];
  stageNames: string[];
};

export type TestDetails = {
  id: string;
  title: string;
  status: TestStatus;
  selectionMode: string;
  unit: QuestionUnit;
  questionCount: number;
  durationMinutes: number;
  shareToken: string | null;
  shareUrl: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  gradedByName: string | null;
  grade: number | null;
  gradingNotes: string | null;
  studentName: string | null;
  studentEmail: string | null;
  creatorName: string;
  questions: TestQuestion[];
};

export type DashboardStats = {
  questions: number;
  generated: number;
  sent: number;
  completed: number;
  graded: number;
  failed: number;
};

export type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  actorDisplayName: string;
  actorRole: UserRole | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};
