
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://saiitda-news.vercel.app",
  "https://saiitda-news-c8ofqeqyx-gangseo1.vercel.app",
  "https://saiitda-news-c8ofqeqyx-gangseo1.vercel.app",
]);
function corsFor(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://saiitda-news.vercel.app",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function reply(status: number, body: object, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsFor(req),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsFor(req) });
  }

  if (req.method !== "POST") {
    return reply(405, { error: "허용되지 않은 요청입니다." }, req);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceKey) {
      console.error("Supabase 서버 환경 변수 없음");
      return reply(500, {
        error: "서버 설정을 확인해야 합니다.",
      }, req);
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 1. 로그인한 관리자 확인
    const token = (req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "");

    if (!token) {
      return reply(401, { error: "로그인이 필요합니다." }, req);
    }

    const { data: authData, error: authError } =
      await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return reply(401, {
        error: "관리자 로그인을 다시 해주세요.",
      }, req);
    }

    const currentUser = authData.user;

    // 2. 최고 관리자 권한 확인
    const { data: manager, error: managerError } = await admin
      .from("profiles")
      .select("role,is_super_admin,approval_status,deleted_at")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (managerError) {
      console.error("관리자 조회 실패:", managerError);
      return reply(500, {
        error: "관리자 정보를 확인하지 못했습니다.",
      }, req);
    }

    const allowed =
      manager?.approval_status === "approved" &&
      manager?.deleted_at == null &&
      manager?.role === "admin" &&
      manager?.is_super_admin === true;

    if (!allowed) {
      return reply(403, {
        error: "최고 관리자만 계정을 삭제할 수 있습니다.",
      }, req);
    }

    // 3. 삭제할 학생 계정 확인
    const body = await req.json().catch(() => null);
    const target = body?.target_id;

    if (
      typeof target !== "string" ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(target)
    ) {
      return reply(400, {
        error: "올바르지 않은 계정입니다.",
      }, req);
    }

    if (target === currentUser.id) {
      return reply(403, {
        error: "자기 계정은 삭제할 수 없습니다.",
      }, req);
    }

    const { data: student, error: studentError } = await admin
      .from("profiles")
      .select("id,role,is_super_admin,deleted_at")
      .eq("id", target)
      .maybeSingle();

    if (studentError) {
      console.error("학생 조회 실패:", studentError);
      return reply(500, {
        error: "학생 정보를 확인하지 못했습니다.",
      }, req);
    }

    if (
      !student ||
      !["reader", "reporter"].includes(student.role) ||
      student.is_super_admin === true ||
      student.deleted_at != null
    ) {
      return reply(403, {
        error: "삭제할 수 없는 계정이거나 이미 삭제된 계정입니다.",
      }, req);
    }

    // 4. Supabase 로그인 계정 존재 확인
    const { data: targetAuth, error: targetError } =
      await admin.auth.admin.getUserById(target);

    if (targetError || !targetAuth.user) {
      console.error("로그인 계정 조회 실패:", targetError);
      return reply(409, {
        error: "로그인 계정 상태를 확인할 수 없습니다.",
      }, req);
    }

    // 5. 로그인 계정 소프트 삭제
    // true = 기사·댓글 연결을 유지하기 위한 소프트 삭제
    const { error: deleteError } =
      await admin.auth.admin.deleteUser(target, true);

    if (deleteError) {
      console.error("Auth 삭제 실패:", {
        message: deleteError.message,
        status: deleteError.status,
      });

      return reply(500, {
        error: "로그인 계정 삭제 단계에서 실패했습니다.",
      }, req);
    }

    // 6. 회원 목록에서 삭제 처리
    const now = new Date().toISOString();

   
const { data: updated, error: updateError } =
  await admin.rpc(
    "finalize_deleted_student_profile",
    {
      target: target,
    }
  );


    if (updateError || !updated) {
      console.error("회원 목록 정리 실패:", updateError);

      return reply(500, {
        error:
          "로그인 계정은 삭제됐지만 회원 목록 정리에 실패했습니다. 다시 삭제하지 말고 관리자에게 확인해 주세요.",
      }, req);
    }

    // 7. 남아 있는 비밀번호 재설정 요청 정리
    const { error: resetError } = await admin
      .from("password_reset_requests")
      .update({
        status: "rejected",
        handled_at: now,
      })
      .eq("user_id", target)
      .eq("status", "pending");

    if (resetError) {
      console.error(
        "비밀번호 요청 정리 실패:",
        resetError.message
      );
    }

    // 8. 성공
    return reply(200, {
      success: true,
    }, req);

  } catch (error) {
    console.error("계정 삭제 중 예외:", error);

    return reply(500, {
      error: "계정 삭제 처리 중 오류가 발생했습니다.",
    }, req);
  }
});
