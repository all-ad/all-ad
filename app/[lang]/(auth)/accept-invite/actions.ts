"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters long"),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
  });

interface FormState {
  errors?: {
    password?: string[];
    passwordConfirmation?: string[];
    general?: string;
  };
  success?: boolean;
}

export async function updateInvitedUserPassword(
  _prevState: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();

  const validatedFields = passwordSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { password } = validatedFields.data;

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      errors: { general: `Failed to update password: ${error.message}` },
    };
  }

  // On success, redirect to the dashboard.
  redirect("/dashboard");
}
