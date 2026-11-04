// 최고 관리자가 비밀번호 재설정 요청을 처리할 때 부르는 Supabase Edge Function.
// 임시 비밀번호를 만들어 회원 비밀번호를 바꾸고, 첫 로그인 때 새 비밀번호를 정하도록 표시한다(must_change_password).
// 비밀번호를 바꾸려면 service role 열쇠가 필요해서 브라우저가 아니라 여기서 처리한다. 배포 방법은 README의 "비밀번호 재설정" 참고.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// 헷갈리는 글자(0 O 1 l I)를 뺀 10자
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function tempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: '잘못된 요청입니다.' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 1) 부른 사람이 최고 관리자(admin + is_super_admin + 승인됨)인지 확인
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json({ error: '로그인이 필요합니다.' }, 401);
  const { data: me } = await admin
    .from('profiles')
    .select('role,is_super_admin,approval_status')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!me || me.role !== 'admin' || me.is_super_admin !== true || (me.approval_status ?? 'approved') !== 'approved') {
    return json({ error: '최고 관리자만 사용할 수 있습니다.' }, 403);
  }

  // 2) 기다리는 요청인지 확인
  const { request_id } = await req.json().catch(() => ({}));
  if (!request_id) return json({ error: '요청 번호가 없습니다.' }, 400);
  const { data: request } = await admin
    .from('password_reset_requests')
    .select('id,user_id,username,status')
    .eq('id', request_id)
    .maybeSingle();
  if (!request || request.status !== 'pending') return json({ error: '이미 처리했거나 없는 요청입니다.' }, 404);

  // 3) 관리자·선생님 계정은 바꾸지 않는다
  const { data: target } = await admin.from('profiles').select('role').eq('id', request.user_id).maybeSingle();
  if (!target || ['admin', 'teacher_admin'].includes(target.role)) {
    return json({ error: '이 계정은 여기서 바꿀 수 없습니다.' }, 403);
  }

  // 4) 임시 비밀번호로 바꾸고, 첫 로그인 때 새 비밀번호를 정하게 표시
  const { data: user } = await admin.auth.admin.getUserById(request.user_id);
  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(request.user_id, {
    password,
    user_metadata: { ...(user?.user?.user_metadata || {}), must_change_password: true }
  });
  if (error) return json({ error: '비밀번호를 바꾸지 못했습니다.' }, 500);

  await admin
    .from('password_reset_requests')
    .update({ status: 'done', handled_at: new Date().toISOString() })
    .eq('id', request.id);

  return json({ username: request.username, password });
});
