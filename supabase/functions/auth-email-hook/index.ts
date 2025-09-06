// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface AuthEmailPayload {
  type: "signup" | "recovery" | "email_change" | "magic_link";
  user: {
    id: string;
    email: string;
    email_confirmed_at?: string;
    created_at: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to?: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_API_URL = "https://api.resend.com/emails";
const SITE_URL = Deno.env.get("SITE_URL") || "https://sivera.in";

async function generatePasswordResetEmail(payload: AuthEmailPayload): Promise<{
  subject: string;
  html: string;
}> {
  const { email_data } = payload;
  const resetUrl = `${SITE_URL}/auth/callback?token_hash=${email_data.token_hash}&type=recovery&next=/reset-password`;

  let htmlContent = await Deno.readTextFile(
    "./functions/auth-email-hook/templates/password-reset.html",
  );
  htmlContent = htmlContent.replace(/\$\{SITE_URL\}/g, SITE_URL);
  htmlContent = htmlContent.replace(/\$\{resetUrl\}/g, resetUrl);

  return {
    subject: "[sivera] 비밀번호 재설정 요청",
    html: htmlContent,
  };
}

function generateSignupConfirmationEmail(payload: AuthEmailPayload): {
  subject: string;
  html: string;
} {
  const { user, email_data } = payload;
  const confirmUrl = `${SITE_URL}/auth/callback?token_hash=${email_data.token_hash}&type=signup&next=/dashboard`;

  return {
    subject: "[sivera] 이메일 주소를 확인해주세요",
    html: `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>이메일 확인 - sivera</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 32px;
            text-align: center;
          }
          .logo {
            color: white;
            font-size: 32px;
            font-weight: bold;
            text-decoration: none;
          }
          .content {
            padding: 40px;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            margin: 0 0 24px 0;
            color: #1a202c;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 24px 0;
          }
          .footer {
            background: #f7fafc;
            padding: 24px 40px;
            font-size: 14px;
            color: #718096;
            border-top: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <a href="${SITE_URL}" class="logo">sivera</a>
          </div>
          
          <div class="content">
            <h1 class="title">sivera에 오신 것을 환영합니다! 🎉</h1>
            
            <p>안녕하세요,</p>
            
            <p>sivera 계정 생성을 완료하려면 이메일 주소를 확인해주세요.</p>
            
            <div style="text-align: center;">
              <a href="${confirmUrl}" class="button">이메일 주소 확인</a>
            </div>
            
            <p style="font-size: 14px; color: #718096;">
              버튼이 작동하지 않는 경우, 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
              <a href="${confirmUrl}" style="color: #667eea; word-break: break-all;">${confirmUrl}</a>
            </p>
            
            <p style="font-size: 14px; color: #718096;">
              계정을 생성하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.
            </p>
          </div>
          
          <div class="footer">
            <p>이 메일은 sivera 시스템에서 자동으로 발송되었습니다.</p>
            <p>© 2025 sivera. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Check if API key is configured
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service is not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Parse webhook payload
    const payload: AuthEmailPayload = await req.json();
    console.log("Auth email hook triggered", {
      type: payload.type,
      userId: payload.user.id,
      email: payload.user.email,
    });

    let emailContent: { subject: string; html: string };

    // Generate email content based on type
    switch (payload.type) {
      case "recovery":
        emailContent = generatePasswordResetEmail(payload);
        break;
      case "signup":
        emailContent = generateSignupConfirmationEmail(payload);
        break;
      case "magic_link":
        // For magic link, use similar to signup but different messaging
        emailContent = generateSignupConfirmationEmail(payload);
        emailContent.subject = "[sivera] 마법 링크로 로그인하세요";
        break;
      default:
        console.warn("Unsupported email type", { type: payload.type });
        return new Response(
          JSON.stringify({ error: "Unsupported email type" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
    }

    // Send email via Resend
    const emailData = {
      from: "sivera <noreply@sivera.in>",
      to: [payload.user.email],
      subject: emailContent.subject,
      html: emailContent.html,
    };

    console.log("Sending auth email via Resend", {
      to: emailData.to,
      subject: emailData.subject,
      type: payload.type,
    });

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Resend API error", {
        status: response.status,
        statusText: response.statusText,
        responseData,
      });

      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: responseData,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    console.log("Auth email sent successfully", {
      id: responseData.id,
      type: payload.type,
      userId: payload.user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        id: responseData.id,
        type: payload.type,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Unexpected error in auth email hook", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
