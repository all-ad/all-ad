import { redirect } from "next/navigation";

import { DashboardDataProvider } from "./DashboardDataProvider";

import { createClient } from "@/utils/supabase/server";
import { CampaignDashboard } from "@/components/dashboard/CampaignDashboard";
import { SyncButton } from "@/components/dashboard/SyncButton";
import { PageHeader } from "@/components/common";
import log from "@/utils/logger";

async function getCampaignData(supabase: any, teamId: string) {
  // First fetch campaigns
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error) {
    log.error("Error fetching campaigns:", error);

    return [];
  }

  if (!campaigns || campaigns.length === 0) {
    return [];
  }

  // Then fetch platform credentials separately if needed
  const { data: credentials } = await supabase
    .from("platform_credentials")
    .select("*")
    .eq("team_id", teamId);

  // Map credentials to campaigns
  const campaignsWithCredentials = campaigns.map((campaign: any) => {
    const credential = credentials?.find(
      (c: any) =>
        c.platform === campaign.platform && c.team_id === campaign.team_id,
    );

    return {
      ...campaign,
      platform_credentials: credential || { platform: campaign.platform },
    };
  });

  return campaignsWithCredentials;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's team
  let teamId = null;

  // Check if user is master of any team
  const { data: masterTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("master_user_id", user.id)
    .maybeSingle();

  if (masterTeam) {
    teamId = masterTeam.id;
  } else {
    // Get user's team membership
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership) {
      teamId = membership.team_id;
    }
  }

  if (!teamId) {
    // Create team if doesn't exist
    const { data: newTeamId } = await supabase.rpc("create_team_for_user", {
      user_id: user.id,
    });

    teamId = newTeamId;
  }

  // Fetch initial data
  const campaigns = await getCampaignData(supabase, teamId);

  // Calculate statistics
  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c: any) => c.is_active).length,
    totalBudget: campaigns.reduce(
      (sum: number, c: any) => sum + (c.budget || 0),
      0,
    ),
    totalClicks: campaigns.reduce(
      (sum: number, c: any) => sum + (c.clicks || 0),
      0,
    ),
    totalImpressions: campaigns.reduce(
      (sum: number, c: any) => sum + (c.impressions || 0),
      0,
    ),
    platforms: Array.from(
      new Set(campaigns.map((c: any) => c.platform_credentials?.platform)),
    ).filter(Boolean).length,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <PageHeader
          pageSubtitle="모든 광고 플랫폼의 캠페인을 한눈에 관리하세요."
          pageTitle="대시보드"
        />
        <SyncButton />
      </div>

      <DashboardDataProvider initialCampaigns={campaigns} initialStats={stats}>
        <CampaignDashboard />
      </DashboardDataProvider>
    </div>
  );
}
