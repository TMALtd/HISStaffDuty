"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  TimetableBlock,
  TimetableBlockType,
  TimetableBuilderData,
  TimetableClassSummary,
  TimetableStaffOption
} from "@/lib/types";

type TimetableBuilderProps = {
  initialData: TimetableBuilderData;
};

type EditableBlockDraft = {
  blockId: string;
  title: string;
  blockType: TimetableBlockType;
  color: string;
  staffIds: string[];
};

type TimetableClassesResponse = {
  classes: TimetableClassSummary[];
};

const WEEKDAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" }
] as const;

const COLOR_OPTIONS = [
  "#ffffff",
  "#8be6a8",
  "#a8c7f0",
  "#d5b8ee",
  "#ffe97c",
  "#efbadf",
  "#ffd090",
  "#f79ca1",
  "#76ddd1",
  "#7c3aed",
  "#1d4ed8",
  "#111827"
];

const BLOCK_TYPE_LABELS: Record<TimetableBlockType, string> = {
  lesson: "Lesson",
  break: "Break",
  lunch: "Lunch",
  dismissal: "Dismissal",
  assembly: "Assembly",
  other: "Other"
};

function minutesBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function initialsForTeacher(teacher: { staff_first_name: string | null; staff_name: string }) {
  const source = teacher.staff_first_name || teacher.staff_name;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function displayTeacherName(teacher: { staff_first_name: string | null; staff_name: string }) {
  return teacher.staff_first_name || teacher.staff_name;
}

function blockSignature(block: TimetableBlock) {
  const normalizedTitle = block.title?.trim() ?? "";
  if (!normalizedTitle) {
    return `${block.id}`;
  }

  const teacherIds = block.teachers
    .map((teacher) => teacher.staff_id)
    .sort()
    .join("|");

  return [
    normalizedTitle,
    block.block_type,
    block.color ?? "",
    teacherIds
  ].join("::");
}
