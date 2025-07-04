"use client";

import { useState, useActionState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { Divider } from "@heroui/divider";
import { Form } from "@heroui/form";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { useRouter } from "next/navigation";

import { clientLogin } from "@/app/[lang]/(auth)/login/client-actions";
import { signup, type ActionState } from "@/app/[lang]/(auth)/login/actions";
import { toast } from "@/utils/toast";
import { useDictionary } from "@/hooks/use-dictionary";

interface AuthFormProps {
  initialMode?: "login" | "signup";
  returnUrl?: string;
  defaultEmail?: string;
  inviteToken?: string;
}

export function AuthForm({
  initialMode = "login",
  returnUrl,
  defaultEmail,
  inviteToken,
}: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { dictionary: dict } = useDictionary();

  // For signup, we use server action with useActionState
  const initialState: ActionState = { errors: {} };
  const [signupState, signupAction, isSignupPending] = useActionState(
    signup,
    initialState,
  );

  // Handle login with client action
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await clientLogin(email, password, returnUrl, router);

      if (!result.success && result.error) {
        toast.error({
          title: dict.auth.login.errors.general,
          description: result.error,
        });
      }
    } catch {
      toast.error({
        title: dict.common.error,
        description: dict.errors.general,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isSignUp ? (
        // Signup form using server action
        <Form action={signupAction} validationErrors={signupState.errors}>
          {returnUrl && (
            <input name="returnUrl" type="hidden" value={returnUrl} />
          )}
          {inviteToken && (
            <input name="inviteToken" type="hidden" value={inviteToken} />
          )}
          <div className="flex flex-col gap-4 items-center w-full min-w-sm mx-auto">
            <Input
              isRequired
              autoComplete="email"
              data-test-id="signup-input-email"
              defaultValue={defaultEmail}
              errorMessage={signupState.errors?.email}
              isInvalid={!!signupState.errors?.email}
              label={dict.auth.signup.email}
              name="email"
              placeholder={dict.auth.signup.emailPlaceholder}
              startContent={<FaEnvelope className="text-default-400" />}
              type="email"
              variant="bordered"
            />
            <Input
              isRequired
              autoComplete="new-password"
              data-test-id="signup-input-password"
              errorMessage={signupState.errors?.password}
              isInvalid={!!signupState.errors?.password}
              label={dict.auth.signup.password}
              name="password"
              placeholder={dict.auth.signup.passwordPlaceholder}
              startContent={<FaLock className="text-default-400" />}
              type="password"
              variant="bordered"
            />

            {signupState.errors?.general && (
              <div
                className={`text-sm ${signupState.success ? "text-success" : "text-danger"}`}
              >
                {signupState.errors.general}
              </div>
            )}

            <Button
              fullWidth
              color="primary"
              data-test-id="signup-submit"
              isLoading={isSignupPending}
              type="submit"
            >
              {dict.auth.signup.submit}
            </Button>
          </div>
        </Form>
      ) : (
        // Login form using client action
        <form data-test-id="login-form" onSubmit={handleLogin}>
          <div className="flex flex-col gap-4 items-center w-full min-w-sm mx-auto">
            <Input
              isRequired
              autoComplete="email"
              data-test-id="login-input-id"
              defaultValue={defaultEmail}
              isDisabled={isLoading}
              label={dict.auth.login.email}
              name="email"
              placeholder={dict.auth.login.emailPlaceholder}
              startContent={<FaEnvelope className="text-default-400" />}
              type="email"
              variant="bordered"
            />
            <Input
              isRequired
              autoComplete="current-password"
              data-test-id="login-input-pw"
              isDisabled={isLoading}
              label={dict.auth.login.password}
              name="password"
              placeholder={dict.auth.login.passwordPlaceholder}
              startContent={<FaLock className="text-default-400" />}
              type="password"
              variant="bordered"
            />

            <Button
              fullWidth
              color="primary"
              data-test-id="login-submit"
              isDisabled={isLoading}
              isLoading={isLoading}
              type="submit"
            >
              {dict.auth.login.submit}
            </Button>
          </div>
        </form>
      )}

      <Divider className="my-4" />

      <div className="text-center">
        <p className="text-sm text-default-500">
          {isSignUp ? dict.auth.signup.hasAccount : dict.auth.login.noAccount}{" "}
          <Link
            className="cursor-pointer"
            size="sm"
            onPress={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? dict.auth.signup.login : dict.auth.login.signUp}
          </Link>
        </p>
      </div>

      {!isSignUp && (
        <div className="text-center mt-2">
          <Link href="/forgot-password" size="sm">
            {dict.auth.login.forgotPassword}
          </Link>
        </div>
      )}
    </>
  );
}
