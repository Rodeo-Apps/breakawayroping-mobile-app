export type T_ContentModerationParams = {
  targetUserId?: string | string[];
  contentType?: string | string[];
  contentId?: string | string[];
  displayTitle?: string | string[];
};

export type T_ReportableContentType =
  | "user"
  | "post"
  | "comment"
  | "message"
  | "group";
