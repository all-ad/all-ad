import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { PlatformSyncServiceFactory } from "@/lib/sync/platform-sync-service";
import { PlatformType } from "@/types";
import log from "@/utils/logger";

// Manual sync trigger endpoint
export async function POST(request: NextRequest) {
  try {
    // Get current user and team
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Get user's current team
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_team_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.current_team_id) {
      return NextResponse.json({ error: "Team not found" }, { status: 400 });
    }

    const teamId = profile.current_team_id;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      platforms,
      syncCampaigns = true,
      syncMetrics = true,
      dateRange,
    } = body as {
      platforms?: PlatformType[];
      syncCampaigns?: boolean;
      syncMetrics?: boolean;
      dateRange?: { start: string; end: string };
    };

    // Convert date strings to Date objects
    const parsedDateRange = dateRange
      ? {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end),
        }
      : undefined;

    log.info("Manual sync triggered", {
      teamId,
      platforms,
      syncCampaigns,
      syncMetrics,
      dateRange: parsedDateRange,
    });

    // Trigger sync for all platforms
    const results = await PlatformSyncServiceFactory.syncAllPlatforms(teamId, {
      platforms,
      syncCampaigns,
      syncMetrics,
      dateRange: parsedDateRange,
    });

    // Calculate summary statistics
    const summary = Object.values(results).reduce(
      (acc, result) => ({
        totalPlatforms: acc.totalPlatforms + 1,
        successfulPlatforms: acc.successfulPlatforms + (result.success ? 1 : 0),
        totalRecords: acc.totalRecords + result.recordsProcessed,
        totalErrors: acc.totalErrors + result.errors.length,
      }),
      {
        totalPlatforms: 0,
        successfulPlatforms: 0,
        totalRecords: 0,
        totalErrors: 0,
      },
    );

    log.info("Manual sync completed", {
      teamId,
      summary,
      results,
    });

    return NextResponse.json({
      success: summary.totalErrors === 0,
      summary,
      results,
      message: `Synced ${summary.totalRecords} records across ${summary.successfulPlatforms}/${summary.totalPlatforms} platforms`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Sync failed";
    const errorStack = error instanceof Error ? error.stack : undefined;

    log.error("Manual sync failed", {
      error: errorMessage,
      stack: errorStack,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}

// Get sync status and history
export async function GET(_request: NextRequest) {
  try {
    // Get current user and team
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Get user's current team
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_team_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.current_team_id) {
      return NextResponse.json({ error: "Team not found" }, { status: 400 });
    }

    const teamId = profile.current_team_id;

    // Get platform credentials and their last sync status
    const { data: credentials, error: credentialsError } = await supabase
      .from("platform_credentials")
      .select("*")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("last_sync_at", { ascending: false });

    if (credentialsError) {
      throw new Error(
        `Failed to fetch credentials: ${credentialsError.message}`,
      );
    }

    // Get recent sync logs (you might want to create a sync_logs table)
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("platform, updated_at")
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (campaignsError) {
      log.warn("Failed to fetch campaign sync status", { campaignsError });
    }

    // Calculate sync statistics
    const syncStats = credentials.reduce(
      (stats, cred) => {
        const platform = cred.platform;

        if (!stats[platform]) {
          stats[platform] = {
            platform,
            accountName: cred.account_name,
            lastSyncAt: cred.last_sync_at,
            hasError: !!cred.error_message,
            errorMessage: cred.error_message,
            isActive: cred.is_active,
            campaignCount: 0,
          };
        }

        return stats;
      },
      {} as Record<
        string,
        {
          platform: string;
          accountName: string;
          lastSyncAt: string | null;
          hasError: boolean;
          errorMessage: string | null;
          isActive: boolean;
          campaignCount: number;
        }
      >,
    );

    // Add campaign counts
    if (campaigns) {
      campaigns.forEach((campaign) => {
        if (syncStats[campaign.platform]) {
          syncStats[campaign.platform].campaignCount++;
        }
      });
    }

    const platformStats = Object.values(syncStats);
    const totalCredentials = credentials.length;
    const activeCredentials = credentials.filter((c) => c.is_active).length;
    const credentialsWithErrors = credentials.filter(
      (c) => c.error_message,
    ).length;
    const lastSyncTime = credentials[0]?.last_sync_at;

    return NextResponse.json({
      summary: {
        totalCredentials,
        activeCredentials,
        credentialsWithErrors,
        lastSyncTime,
      },
      platforms: platformStats,
      credentials: credentials.map((cred) => ({
        id: cred.id,
        platform: cred.platform,
        accountName: cred.account_name,
        isActive: cred.is_active,
        lastSyncAt: cred.last_sync_at,
        hasError: !!cred.error_message,
        errorMessage: cred.error_message,
        expiresAt: cred.expires_at,
      })),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get sync status";

    log.error("Failed to get sync status", {
      error: errorMessage,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
