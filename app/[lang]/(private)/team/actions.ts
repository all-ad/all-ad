"use server";

import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";
import log from "@/utils/logger";
import { UserRole } from "@/types";
import { createTeamForUser } from "@/lib/data/teams";

export async function inviteTeamMemberAction(email: string, role: UserRole) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("No user logged in");
    }

    // Get user's team and role
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: masterTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("master_user_id", user.id)
      .maybeSingle();

    const teamId = membership?.team_id || masterTeam?.id;
    const userRole = masterTeam ? "master" : membership?.role;

    if (!teamId) {
      throw new Error("No team found");
    }

    if (userRole !== "master" && userRole !== "team_mate") {
      throw new Error("Insufficient permissions to invite members");
    }

    // Check if user with this email is already a member
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("profiles!inner(email)")
      .eq("team_id", teamId)
      .eq("profiles.email", email)
      .maybeSingle();

    if (existingMember) {
      throw new Error("User is already a team member");
    }

    // Check if there's already a pending invitation for this team
    const { data: existingInvite } = await supabase
      .from("team_invitations")
      .select("id")
      .eq("team_id", teamId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      log.info("Resending invitation email to existing invitation", {
        email,
        teamId,
      });
    }

    // Create a separate admin client for the invite
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Use Supabase's built-in invite functionality with the admin client
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          team_id: teamId,
          role: role === "master" ? "viewer" : role, // Can't invite as master
          invited_by: user.id,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invite`,
      });

    if (inviteError) {
      log.error("Failed to invite user", inviteError);
      // Return the raw error message for debugging
      throw new Error(`메일 발송 실패: ${inviteError.message}`);
    }

    // If this is a new invitation, create a record for tracking.
    if (!existingInvite && inviteData.user) {
      const { error: invitationError } = await supabase
        .from("team_invitations")
        .insert({
          team_id: teamId,
          email,
          role: role === "master" ? "viewer" : role,
          invited_by: user.id,
          user_id: inviteData.user.id,
          status: "pending",
        });

      if (invitationError) {
        log.error(
          "Failed to create tracking record in team_invitations",
          invitationError,
        );
      }
    }

    log.info("Team invitation email sent successfully via Supabase Auth", {
      email,
      role,
      teamId,
    });

    revalidatePath("/team");

    return {
      success: true,
      message: "초대 이메일이 발송되었습니다.",
    };
  } catch (error) {
    log.error(
      "Error in inviteTeamMemberAction",
      error instanceof Error ? error : new Error(String(error)),
    );

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to invite team member",
    };
  }
}

export async function updateTeamMemberRoleAction(
  memberId: string,
  role: UserRole,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("No user logged in");
    }

    // Check if user is master and owns the team member
    const { data: teamMember } = await supabase
      .from("team_members")
      .select(
        `
        team_id,
        teams!inner (
          master_user_id
        )
      `,
      )
      .eq("id", memberId)
      .single();

    if (!teamMember) {
      throw new Error("Team member not found");
    }

    // Type assertion for the joined data
    const teamData = teamMember.teams as unknown as {
      master_user_id: string;
    };

    if (teamData.master_user_id !== user.id) {
      throw new Error("Only team master can update roles");
    }

    if (!teamMember.team_id) {
      throw new Error("Team member does not have a valid team_id");
    }

    const { error } = await supabase
      .from("team_members")
      .update({ role })
      .eq("id", memberId)
      .eq("team_id", teamMember.team_id); // Additional safety check

    if (error) {
      log.error("Failed to update team member role", error);
      throw error;
    }

    log.info("Team member role updated", { memberId, role });

    revalidatePath("/team");

    return { success: true, message: "권한이 성공적으로 변경되었습니다." };
  } catch (error) {
    log.error(
      "Error in updateTeamMemberRoleAction",
      error instanceof Error ? error : new Error(String(error)),
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update role",
    };
  }
}

export async function removeTeamMemberAction(memberId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("No user logged in");
    }

    // Check if user is master and owns the team member
    const { data: teamMember } = await supabase
      .from("team_members")
      .select(
        `
        team_id,
        teams!inner (
          master_user_id
        )
      `,
      )
      .eq("id", memberId)
      .single();

    if (!teamMember) {
      throw new Error("Team member not found");
    }

    // Type assertion for the joined data
    const teamData = teamMember.teams as unknown as {
      master_user_id: string;
    };

    if (teamData.master_user_id !== user.id) {
      throw new Error("Only team master can remove members");
    }

    if (!teamMember.team_id) {
      throw new Error("Team member does not have a valid team_id");
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", memberId)
      .eq("team_id", teamMember.team_id); // Additional safety check

    if (error) {
      log.error("Failed to remove team member", error);
      throw error;
    }

    log.info("Team member removed", { memberId });

    revalidatePath("/team");

    return { success: true, message: "팀원이 성공적으로 제거되었습니다." };
  } catch (error) {
    log.error(
      "Error in removeTeamMemberAction",
      error instanceof Error ? error : new Error(String(error)),
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove member",
    };
  }
}

export async function createTeamForUserAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("No user logged in");
    }

    const result = await createTeamForUser(user.id);

    revalidatePath("/team");

    return result;
  } catch (error) {
    log.error(
      "Error in createTeamForUserAction",
      error instanceof Error ? error : new Error(String(error)),
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create team",
    };
  }
}

export async function syncAllPlatformDataAction() {
  try {
    // Import DataSyncService only when needed to avoid client/server issues
    const { DataSyncService } = await import(
      "@/services/sync/data-sync.service"
    );
    const dataSyncService = new DataSyncService();
    const result = await dataSyncService.syncAllPlatformData();

    revalidatePath("/team");

    return result;
  } catch (error) {
    log.error(
      "Error in syncAllPlatformDataAction",
      error instanceof Error ? error : new Error(String(error)),
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync data",
    };
  }
}
