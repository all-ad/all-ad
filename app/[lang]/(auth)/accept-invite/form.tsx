"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { updateInvitedUserPassword } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button color="primary" type="submit" isLoading={pending} fullWidth>
      Set Password and Join
    </Button>
  );
}

export function AcceptInviteForm() {
  const [state, formAction] = useFormState(updateInvitedUserPassword, null);

  return (
    <form action={formAction} className="space-y-4">
      <Input
        type="password"
        name="password"
        label="New Password"
        placeholder="Enter your new password"
        isRequired
        isInvalid={!!state?.errors?.password}
        errorMessage={state?.errors?.password?.[0]}
      />
      <Input
        type="password"
        name="passwordConfirmation"
        label="Confirm New Password"
        placeholder="Confirm your new password"
        isRequired
        isInvalid={!!state?.errors?.passwordConfirmation}
        errorMessage={state?.errors?.passwordConfirmation?.[0]}
      />
      {state?.errors?.general && (
        <p className="text-sm text-danger">{state.errors.general}</p>
      )}
      {state?.success && (
        <p className="text-sm text-success">
          Password updated successfully! Redirecting...
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
