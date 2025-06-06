import { GoogleAdsIntegrationService } from "../google-ads/google-ads-integration.service";

import { BasePlatformService } from "./base-platform.service";

import {
  Campaign,
  CampaignMetrics,
  PlatformType,
  GoogleAdsCredentials,
} from "@/types";
import log from "@/utils/logger";
import { GoogleAdsApiCredentials } from "@/types/google-ads.types";

export class GooglePlatformService extends BasePlatformService {
  platform: PlatformType = "google";
  private googleAdsService?: GoogleAdsIntegrationService;
  private userId?: string;
  private accountId?: string;

  constructor() {
    super();
  }

  // Set user context for OAuth token retrieval
  setUserContext(userId: string, accountId: string) {
    this.userId = userId;
    this.accountId = accountId;
  }

  // Google Ads 서비스 초기화 with OAuth token
  private async getGoogleAdsService(): Promise<GoogleAdsIntegrationService> {
    if (!this.googleAdsService) {
      const credentials = this.credentials as GoogleAdsCredentials;

      // For OAuth platforms, the refresh token is used
      // The google-ads-api library handles token refresh automatically
      if (!credentials.refreshToken) {
        throw new Error("No refresh token available for Google Ads");
      }

      const googleAdsCredentials: GoogleAdsApiCredentials = {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        refreshToken: credentials.refreshToken,
        developerToken: credentials.developerToken,
        loginCustomerId: credentials.loginCustomerId,
      };

      this.googleAdsService = new GoogleAdsIntegrationService(
        googleAdsCredentials,
      );
    }

    return this.googleAdsService;
  }

  async validateCredentials(): Promise<boolean> {
    const { customerId } = this.credentials as GoogleAdsCredentials;

    if (!customerId) {
      return false;
    }

    try {
      // Google Ads 연결 테스트
      const service = await this.getGoogleAdsService();

      return await service.testConnection(customerId);
    } catch (error) {
      log.error("Google credential validation error:", error as Error);

      return false;
    }
  }

  async fetchCampaigns(): Promise<Campaign[]> {
    log.info("Fetching Google Ads campaigns");

    try {
      const { customerId } = this.credentials as GoogleAdsCredentials;
      const service = await this.getGoogleAdsService();
      const googleCampaigns = await service.getCampaigns(customerId);

      // Google Ads 캠페인을 플랫폼 공통 형식으로 변환
      return googleCampaigns.map((campaign) => ({
        id: `${customerId}_${campaign.id}`, // unique id
        teamId: this.teamId || "", // Will be set by service layer
        platform: "google" as PlatformType,
        platformCampaignId: campaign.id,
        accountId: customerId,
        name: campaign.name,
        status: this.mapStatus(campaign.status),
        budget: campaign.budgetAmountMicros / 1_000_000, // micros to currency
        isActive: campaign.status === "ENABLED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metrics: {
          impressions: campaign.metrics?.impressions || 0,
          clicks: campaign.metrics?.clicks || 0,
          cost: (campaign.metrics?.costMicros || 0) / 1_000_000,
          conversions: campaign.metrics?.conversions || 0,
          revenue: campaign.metrics?.conversionValue || 0,
        },
      }));
    } catch (error) {
      log.error("Failed to fetch Google Ads campaigns", error as Error);
      throw error;
    }
  }

  async fetchCampaignMetrics(
    campaignId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CampaignMetrics[]> {
    log.info("Fetching Google Ads campaign metrics", {
      campaignId,
      startDate,
      endDate,
    });

    try {
      const { customerId } = this.credentials as GoogleAdsCredentials;
      const service = await this.getGoogleAdsService();
      const metrics = await service.getCampaignMetrics(
        customerId,
        campaignId,
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
      );

      // 메트릭을 플랫폼 공통 형식으로 변환
      return metrics.map((metric) => ({
        impressions: metric.impressions,
        clicks: metric.clicks,
        cost: metric.costMicros / 1_000_000,
        conversions: metric.conversions,
        revenue: metric.conversionValue,
        ctr: metric.ctr,
        cpc: metric.averageCpc / 1_000_000,
        cpm: metric.averageCpm / 1_000_000,
        date: metric.date || new Date().toISOString().split("T")[0],
      }));
    } catch (error) {
      log.error("Failed to fetch campaign metrics", error as Error);
      throw error;
    }
  }

  async updateCampaignBudget(
    campaignId: string,
    budget: number,
  ): Promise<boolean> {
    log.info(`Updating Google Ads campaign ${campaignId} budget to ${budget}`);

    try {
      const { customerId } = this.credentials as GoogleAdsCredentials;
      const service = await this.getGoogleAdsService();

      await service.updateCampaignBudget(
        customerId,
        campaignId,
        budget * 1_000_000, // currency to micros
      );

      return true;
    } catch (error) {
      log.error("Failed to update campaign budget", error as Error);

      return false;
    }
  }

  async updateCampaignStatus(
    campaignId: string,
    isActive: boolean,
  ): Promise<boolean> {
    log.info(
      `Updating Google Ads campaign ${campaignId} status to ${isActive}`,
    );

    try {
      const { customerId } = this.credentials as GoogleAdsCredentials;
      const service = await this.getGoogleAdsService();

      await service.toggleCampaignStatus(customerId, campaignId, isActive);

      return true;
    } catch (error) {
      log.error("Failed to update campaign status", error as Error);

      return false;
    }
  }

  // 동기화 메서드 추가
  async syncData(syncType: "FULL" | "INCREMENTAL" = "INCREMENTAL") {
    try {
      const { customerId } = this.credentials as GoogleAdsCredentials;
      const service = await this.getGoogleAdsService();

      await service.triggerSync(customerId, syncType);
      log.info("Google Ads sync triggered", { syncType });
    } catch (error) {
      log.error("Failed to trigger sync", error as Error);
      throw error;
    }
  }

  // Google Ads 상태를 공통 상태로 매핑
  private mapStatus(
    googleStatus: "ENABLED" | "PAUSED" | "REMOVED",
  ): "active" | "paused" | "removed" {
    switch (googleStatus) {
      case "ENABLED":
        return "active";
      case "PAUSED":
        return "paused";
      case "REMOVED":
        return "removed";
      default:
        return "paused";
    }
  }
}
