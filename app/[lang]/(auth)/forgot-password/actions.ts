"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { log } from "@/utils/logger";

// Define the state type directly in the action file to avoid import issues.
export type ForgotPasswordState = {
  errors?: {
    email?: string;
    general?: string;
  };
  success?: boolean;
};

export async function resetPassword(
  prevState: ForgotPasswordState | null,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const supabase = await createClient();
  const email = formData.get("email") as string;

  // Email validation
  if (!email || !email.includes("@")) {
    return {
      errors: {
        email: "유효한 이메일 주소를 입력해주세요.",
      },
    };
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      errors: {
        email: "올바른 이메일 형식을 입력해주세요.",
      },
    };
  }

  try {
    // Get base URL for redirect
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sivera.in";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    });

    if (error) {
      log.error("Password reset error:", error);

      // Handle specific error cases
      if (error.message.includes("Email not confirmed")) {
        return {
          errors: {
            general:
              "이메일 주소가 확인되지 않았습니다. 먼저 이메일을 확인해주세요.",
          },
        };
      }

      // For security, don't reveal if a user exists or not.
      // Always return a success-like message.
      return {
        success: true,
        errors: {
          general: "비밀번호 재설정 링크가 이메일로 전송되었습니다.",
        },
      };
    }

    return {
      success: true,
      errors: {
        general:
          "비밀번호 재설정 링크가 이메일로 전송되었습니다. 스팸함도 확인해보세요.",
      },
    };
  } catch (err) {
    log.error("Unexpected error during password reset:", err);

    return {
      errors: {
        general: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
    };
  }
}
