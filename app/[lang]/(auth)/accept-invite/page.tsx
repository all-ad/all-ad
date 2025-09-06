import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AcceptInviteForm } from "./form";

export default async function AcceptInvitePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // This page should only be accessible to users who have been invited
  // and have not yet set their password. We can check for the presence
  // of the team_id in the user_metadata which is only added upon invitation.
  if (!user || !user.user_metadata.team_id) {
    // If the user is not an invited user, redirect them to the dashboard.
    return redirect("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="max-w-md w-full p-8 space-y-6 bg-content1 rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Set Your Password</h1>
          <p className="text-default-500 mt-2">
            You have been invited to join. Please set a password to continue.
          </p>
        </div>
        <AcceptInviteForm />
      </div>
    </div>
  );
}
