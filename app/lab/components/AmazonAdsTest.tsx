"use client";

import { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Divider } from "@heroui/divider";
import { Code } from "@heroui/code";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Accordion, AccordionItem } from "@heroui/accordion";

import PlatformTestCard from "./PlatformTestCard";

import log from "@/utils/logger";

interface AmazonCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  profileId?: string;
  region: "NA" | "EU" | "FE";
}

interface TestItem {
  id: string;
  name: string;
  description: string;
  status: "pending" | "testing" | "success" | "error";
  error?: string;
}

export default function AmazonAdsTest() {
  const [credentials, setCredentials] = useState<AmazonCredentials>({
    clientId: "",
    clientSecret: "",
    refreshToken: "",
    accessToken: "",
    profileId: "",
    region: "NA",
  });

  const [authCode, setAuthCode] = useState("");
  const [apiResponse, setApiResponse] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testItems, setTestItems] = useState<TestItem[]>([
    {
      id: "auth",
      name: "인증 토큰 교환",
      description: "Authorization Code를 Access Token으로 교환",
      status: "pending",
    },
    {
      id: "profiles",
      name: "프로필 조회",
      description: "접근 가능한 광고 프로필 목록",
      status: "pending",
    },
    {
      id: "campaigns",
      name: "Sponsored Products 캠페인",
      description: "SP 캠페인 목록 조회 (v3)",
      status: "pending",
    },
  ]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const errorParam = urlParams.get("error");

    if (code) {
      setAuthCode(code);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (errorParam) {
      setError(`OAuth 오류: ${errorParam}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleGenerateAuthUrl = () => {
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      scope: "advertising::campaign_management",
      response_type: "code",
      redirect_uri: `${window.location.origin}/api/auth/callback/amazon-ads`,
    });

    const authUrl = `https://www.amazon.com/ap/oa?${params.toString()}`;

    window.open(authUrl, "_blank");
  };

  const runTest = async (testId: string) => {
    setTestItems((prev) =>
      prev.map((item) =>
        item.id === testId ? { ...item, status: "testing" } : item,
      ),
    );

    try {
      let result;

      switch (testId) {
        case "auth":
          result = await testTokenExchange();
          break;
        case "profiles":
          result = await testProfiles();
          break;
        case "campaigns":
          result = await testSponsoredProducts();
          break;
      }

      setTestItems((prev) =>
        prev.map((item) =>
          item.id === testId
            ? { ...item, status: "success", error: undefined }
            : item,
        ),
      );

      if (result) {
        setApiResponse(result);
      }
    } catch (error) {
      setTestItems((prev) =>
        prev.map((item) =>
          item.id === testId
            ? {
                ...item,
                status: "error",
                error: error instanceof Error ? error.message : "테스트 실패",
              }
            : item,
        ),
      );

      setError(error instanceof Error ? error.message : "Unknown error");
      log.error(`Test ${testId} failed`, error);
    }
  };

  const testTokenExchange = async () => {
    if (!authCode) {
      throw new Error("Authorization Code가 필요합니다");
    }

    // 실제 구현 시 서버 액션으로 처리
    const mockResponse = {
      access_token: "Atza|...",
      refresh_token: "Atzr|...",
      token_type: "bearer",
      expires_in: 3600,
    };

    setCredentials((prev) => ({
      ...prev,
      accessToken: mockResponse.access_token,
      refreshToken: mockResponse.refresh_token,
    }));

    return mockResponse;
  };

  const testProfiles = async () => {
    const mockData = {
      profiles: [
        {
          profileId: "123456789",
          countryCode: "US",
          currencyCode: "USD",
          dailyBudget: 1000.0,
          timezone: "America/Los_Angeles",
        },
      ],
    };

    return mockData;
  };

  const testSponsoredProducts = async () => {
    const mockData = {
      campaigns: [
        {
          campaignId: "SP123456789",
          name: "Holiday Sale - Electronics",
          state: "enabled",
          dailyBudget: 100.0,
        },
      ],
    };

    return mockData;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Amazon Ads API 설정</h2>
            <Chip color="warning" size="sm" variant="flat">
              Limited Access
            </Chip>
          </div>

          <Accordion defaultExpandedKeys={["guide"]}>
            <AccordionItem
              key="guide"
              aria-label="설정 가이드"
              title={
                <div className="flex items-center gap-2">
                  <span>📋</span>
                  <span className="font-medium">빠른 시작 가이드</span>
                </div>
              }
            >
              <div className="space-y-4 pb-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">
                    1. Amazon Advertising 계정 설정
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
                    <li>
                      <a
                        className="text-blue-600 hover:underline"
                        href="https://advertising.amazon.com/API/docs/en-us/get-started/register"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Amazon Advertising Console
                      </a>
                      에서 앱 등록
                    </li>
                    <li>API 액세스 승인 필요 (2-7 영업일)</li>
                    <li>Developer 또는 Agency 자격 필요</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">
                    2. 지원되는 API 버전
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
                    <li>Sponsored Products: v3 (완전 지원)</li>
                    <li>Sponsored Brands: v3 (완전 지원)</li>
                    <li>Sponsored Display: v3 (부분 지원)</li>
                    <li>DSP: 별도 API 필요</li>
                  </ul>
                </div>

                <Card className="bg-yellow-50 border-yellow-200">
                  <CardBody className="text-sm">
                    <p className="font-semibold text-yellow-800 mb-1">
                      ⚠️ 중요 사항
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-yellow-700">
                      <li>지역별로 다른 엔드포인트 사용 (NA/EU/FE)</li>
                      <li>프로필 ID별로 캠페인 관리</li>
                      <li>API 호출 제한: 분당 10회 (기본)</li>
                    </ul>
                  </CardBody>
                </Card>
              </div>
            </AccordionItem>

            <AccordionItem
              key="troubleshooting"
              aria-label="트러블슈팅"
              title={
                <div className="flex items-center gap-2">
                  <span>🔧</span>
                  <span className="font-medium">트러블슈팅 가이드</span>
                </div>
              }
            >
              <div className="space-y-4 pb-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">
                    흔한 오류와 해결방법
                  </h4>

                  <Card className="bg-gray-50">
                    <CardBody className="space-y-2">
                      <p className="font-medium text-sm">
                        1. &quot;401 Unauthorized&quot;
                      </p>
                      <p className="text-sm text-gray-600">
                        토큰이 만료되었거나 잘못된 토큰입니다. Refresh Token으로
                        갱신하세요.
                      </p>
                    </CardBody>
                  </Card>

                  <Card className="bg-gray-50">
                    <CardBody className="space-y-2">
                      <p className="font-medium text-sm">2. &quot;403 Forbidden&quot;</p>
                      <p className="text-sm text-gray-600">
                        해당 프로필에 대한 권한이 없습니다. 프로필 ID를
                        확인하세요.
                      </p>
                    </CardBody>
                  </Card>

                  <Card className="bg-gray-50">
                    <CardBody className="space-y-2">
                      <p className="font-medium text-sm">
                        3. &quot;429 Too Many Requests&quot;
                      </p>
                      <p className="text-sm text-gray-600">
                        API 호출 제한 초과. 요청 간격을 늘리거나 배치 처리를
                        사용하세요.
                      </p>
                    </CardBody>
                  </Card>
                </div>

                <Divider />

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">
                    프로필 타입 이해하기
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    <li>
                      <strong>Seller</strong>: 1P 판매자 계정
                    </li>
                    <li>
                      <strong>Vendor</strong>: 벤더 센트럴 계정
                    </li>
                    <li>
                      <strong>Agency</strong>: 대행사 계정 (여러 광고주 관리)
                    </li>
                  </ul>
                </div>
              </div>
            </AccordionItem>

            <AccordionItem
              key="api-reference"
              aria-label="API 레퍼런스"
              title={
                <div className="flex items-center gap-2">
                  <span>📚</span>
                  <span className="font-medium">주요 API 엔드포인트</span>
                </div>
              }
            >
              <div className="space-y-4 pb-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">인증 관련</h4>
                  <Code className="block p-2" size="sm">
                    POST https://api.amazon.com/auth/o2/token
                  </Code>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">프로필 관리</h4>
                  <Code className="block p-2" size="sm">
                    GET https://advertising-api-{"{region}"}
                    .amazon.com/v2/profiles
                  </Code>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">캠페인 관리 (v3)</h4>
                  <div className="space-y-1">
                    <Code className="block p-2" size="sm">
                      GET /sp/campaigns
                    </Code>
                    <Code className="block p-2" size="sm">
                      PUT /sp/campaigns
                    </Code>
                    <Code className="block p-2" size="sm">
                      POST /sp/campaigns
                    </Code>
                  </div>
                </div>

                <div className="mt-4">
                  <a
                    className="text-blue-600 hover:underline text-sm"
                    href="https://advertising.amazon.com/API/docs"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    전체 API 문서 보기 →
                  </a>
                </div>
              </div>
            </AccordionItem>
          </Accordion>

          <Select
            label="지역"
            placeholder="API 지역 선택"
            selectedKeys={[credentials.region]}
            onChange={(e) =>
              setCredentials({
                ...credentials,
                region: e.target.value as "NA" | "EU" | "FE",
              })
            }
          >
            <SelectItem key="NA">북미 (NA)</SelectItem>
            <SelectItem key="EU">유럽 (EU)</SelectItem>
            <SelectItem key="FE">극동 (FE)</SelectItem>
          </Select>

          <Input
            label="Client ID"
            placeholder="Amazon App Client ID"
            value={credentials.clientId}
            onChange={(e) =>
              setCredentials({ ...credentials, clientId: e.target.value })
            }
          />

          <Input
            label="Client Secret"
            placeholder="Amazon App Client Secret"
            type="password"
            value={credentials.clientSecret}
            onChange={(e) =>
              setCredentials({ ...credentials, clientSecret: e.target.value })
            }
          />

          <Divider />

          <h3 className="font-semibold">OAuth2 인증</h3>

          <Button
            color="primary"
            isDisabled={!credentials.clientId}
            onPress={handleGenerateAuthUrl}
          >
            Amazon OAuth 시작
          </Button>

          <Input
            label="Authorization Code"
            placeholder="OAuth 인증 후 자동 입력됩니다"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
          />
        </CardBody>
      </Card>

      <PlatformTestCard
        testItems={testItems}
        title="Amazon Ads API 연동 테스트"
        onRunTest={runTest}
      />

      <Card>
        <CardBody className="space-y-3">
          <h3 className="font-semibold">API 버전 정보</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Chip color="success" size="sm">
                v3
              </Chip>
              <span className="text-sm">Sponsored Products (완전 지원)</span>
            </div>
            <div className="flex items-center gap-2">
              <Chip color="warning" size="sm">
                v2
              </Chip>
              <span className="text-sm">Sponsored Brands, Display</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {(error || apiResponse) && (
        <Card>
          <CardBody>
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                <p className="font-semibold">오류:</p>
                <p>{error}</p>
              </div>
            )}

            {apiResponse && (
              <div className="space-y-2">
                <p className="font-semibold">응답 데이터:</p>
                <Code className="w-full p-4 overflow-auto max-h-96">
                  <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
                </Code>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
