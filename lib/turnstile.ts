import "server-only";

export interface TurnstileVerificationResult {
  success: boolean;
  errorCodes?: string[];
  error?: string;
}

/**
 * Xác minh mã Turnstile token gửi lên từ client với Cloudflare API
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  clientIp?: string
): Promise<TurnstileVerificationResult> {
  const secretKey =
    process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA";

  if (!token || typeof token !== "string" || !token.trim()) {
    return {
      success: false,
      errorCodes: ["missing-input-response"],
      error: "Vui lòng hoàn tất xác thực chống bot trước khi đặt hàng.",
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    if (clientIp) {
      formData.append("remoteip", clientIp);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "[Turnstile] Cloudflare siteverify HTTP error:",
        response.status
      );
      return {
        success: false,
        errorCodes: [`http-${response.status}`],
        error: "Không thể kết nối đến máy chủ xác minh Turnstile.",
      };
    }

    const data = (await response.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!data.success) {
      return {
        success: false,
        errorCodes: data["error-codes"],
        error:
          "Xác minh chống bot không thành công hoặc phiên đã hết hạn. Vui lòng thử lại.",
      };
    }

    return { success: true };
  } catch (err) {
    console.error("[Turnstile] Lỗi kiểm tra token:", err);
    return {
      success: false,
      errorCodes: ["connection-error"],
      error: "Gặp sự cố khi kiểm tra bảo mật chống bot.",
    };
  }
}

