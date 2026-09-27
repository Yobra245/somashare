/** Shared types used by both server routes and client components. */

export type ResourceType = "LECTURE_NOTES" | "PAST_PAPER" | "REVISION_SLIDES" | "ASSIGNMENT";

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  LECTURE_NOTES: "Lecture Notes",
  PAST_PAPER: "Past Paper",
  REVISION_SLIDES: "Revision Slides",
  ASSIGNMENT: "Assignment",
};

export const DRIVE_CONTRIBUTION_REQUIRED = 5;
export const DRIVE_PERKS_THRESHOLD = 2; // verified papers for unlimited downloads

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  department: string;
  yearOfStudy: string;
  driveConnected: boolean;
  driveEmail: string | null;
  isAdmin?: boolean; // moderation + mailing-list tools (ADMIN_EMAILS env)
}

export interface UnitDTO {
  id: string;
  code: string;
  title: string;
  department: string;
  shortLabel: string;
  resourceCount: number;
}

export interface ResourceDTO {
  id: string;
  title: string;
  type: ResourceType;
  academicYear: string;
  examYear: number;
  semester: number;
  uploaderName: string;
  verified: boolean;
  downloadCount: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  webViewLink: string | null;
  createdAt: string;
  unit: {
    id: string;
    code: string;
    title: string;
    department: string;
    shortLabel: string;
  };
}

export interface ProfileStats {
  contributionCount: number; // verified uploads
  totalUploads: number;
  requiredCount: number;
  perksUnlocked: boolean;
}

export interface ProfileResponse {
  user: SessionUser;
  stats: ProfileStats;
  uploads: ResourceDTO[];
}
