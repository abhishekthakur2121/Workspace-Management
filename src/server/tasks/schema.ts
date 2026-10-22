import { z } from "zod";
import { capitalizeFirst } from "@/lib/text";

// Input validation shared by the task actions.
export const id = z.string().min(1);
export const name = z.string().trim().min(1).max(500).transform(capitalizeFirst);
const priority = z.enum(["low", "medium", "high", "critical"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const patchSchema = z
  .object({
    name,
    accountableId: id.nullable(),
    responsibleIds: z.array(id).max(50),
    statusId: id.nullable(),
    dueDate: date.nullable(),
    priority: priority.nullable(),
    tagIds: z.array(id).max(50),
  })
  .partial();
export type TaskPatch = z.infer<typeof patchSchema>;
