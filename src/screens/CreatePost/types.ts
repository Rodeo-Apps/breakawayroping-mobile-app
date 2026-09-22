import * as yup from "yup";

export type T_POST_TYPE =
  | "text"
  | "run"
  | "achievement"
  | "photo"
  | "video";

export type T_PRIVACY = "public" | "followers" | "private";

export type T_CREATE_POST_FORM = {
  content: string;
  postType: T_POST_TYPE;
  privacy: T_PRIVACY;
  location: string;
  selectedRunId: string;
  selectedHorseId: string;
  /** Local URI after picking image/video (uploaded on submit). */
  localMediaUri: string;
};

export const T_CREATE_POST_SCHEMA: yup.ObjectSchema<T_CREATE_POST_FORM> = yup
  .object({
    content: yup
      .string()
      .default("")
      .test(
        "content-required-for-text",
        "Please write something in your post",
        function (value) {
          const { postType } = this.parent as T_CREATE_POST_FORM;
          if (postType !== "text") return true;
          return !!value?.trim();
        },
      ),
    postType: yup
      .mixed<T_POST_TYPE>()
      .oneOf(["text", "run", "achievement", "photo", "video"])
      .required(),
    privacy: yup
      .mixed<T_PRIVACY>()
      .oneOf(["public", "followers", "private"])
      .required(),
    location: yup.string().default(""),
    selectedRunId: yup
      .string()
      .default("")
      .test("run-required", "Please select a run to share", function (value) {
        const { postType } = this.parent as T_CREATE_POST_FORM;
        if (postType !== "run") return true;
        return !!value;
      }),
    selectedHorseId: yup.string().default(""),
    localMediaUri: yup
      .string()
      .default("")
      .test(
        "photo-requires-media",
        "Choose a photo to post",
        function (value) {
          const { postType } = this.parent as T_CREATE_POST_FORM;
          if (postType !== "photo") return true;
          return !!value?.trim();
        },
      )
      .test(
        "video-requires-media",
        "Choose a video to post",
        function (value) {
          const { postType } = this.parent as T_CREATE_POST_FORM;
          if (postType !== "video") return true;
          return !!value?.trim();
        },
      ),
  })
  .required();

