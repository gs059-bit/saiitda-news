import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8?bundle';
const cfg=window.SAIITDA_CONFIG||{};
const ready=Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey);
const db=ready?createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
const $=s=>document.querySelector(s);
const roleName={admin:'관리자',teacher:'선생님',reporter:'학생 기자',student:'일반 학생'};
const roleObj={admin:'를',teacher:'을',reporter:'를',student:'을'};
// 화면용 역할 ↔ DB 역할 이름
const dbRole={admin:'admin',teacher_admin:'teacher',reporter:'reporter'};
const requestRole={reporter:'reporter',student:'reader'};
function notice(target,msg,ok=false){const d=document.createElement('div');d.className='notice'+(ok?' ok':'');d.textContent=msg;$(target).replaceChildren(d)}
// 프로필이 없으면 승인 대기로, 승인 상태가 비어 있으면 승인된 것으로 본다
async function account(id){const {data}=await db.from('profiles').select('role,approval_status').eq('id',id).maybeSingle();return {role:dbRole[data?.role]||'student',status:data?(data.approval_status||'approved'):'pending'}}
const statusMsg={pending:'가입 승인을 기다리는 중입니다. 관리자가 승인한 뒤 로그인할 수 있어요.',rejected:'가입이 승인되지 않았습니다. 관리자에게 문의해 주세요.'};
function go(role){location.href=['admin','reporter'].includes(role)?'index.html#/dashboard':'index.html'}
function view(){const signup=location.hash==='#signup';$('#loginView').classList.toggle('hide',signup);$('#signupView').classList.toggle('hide',!signup);$('#msg').replaceChildren();$('#smsg').replaceChildren()}
// 선생님 계정은 DB 규칙상 스스로 가입할 수 없고 최고 관리자가 지정한다
function guardian(){const teacher=$('input[name=srole]:checked').value==='teacher';$('#teacherNote').classList.toggle('hide',!teacher);$('#signupFields').classList.toggle('hide',teacher);$('#signupFields').disabled=teacher}
async function init(){view();guardian();window.addEventListener('hashchange',view);document.querySelectorAll('input[name=srole]').forEach(r=>r.onchange=guardian);if(!ready){notice('#msg','먼저 Supabase 연결 설정을 완료해 주세요.');document.querySelectorAll('.btn').forEach(b=>b.disabled=true);return}const {data}=await db.auth.getSession();if(!data.session)return;const acc=await account(data.session.user.id);if(acc.status==='approved')go(acc.role);else await db.auth.signOut()}
$('#loginform').onsubmit=async e=>{e.preventDefault();$('#msg').replaceChildren();const b=$('#loginform button');b.disabled=true;const want=$('input[name=role]:checked').value;const {data,error}=await db.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error){b.disabled=false;notice('#msg','로그인할 수 없습니다. 이메일과 비밀번호를 확인해 주세요. 가입 직후라면 이메일 인증을 먼저 완료해 주세요.');return}const {role,status}=await account(data.user.id);if(status!=='approved'){await db.auth.signOut();b.disabled=false;notice('#msg',statusMsg[status]||statusMsg.pending);return}if(role!==want){await db.auth.signOut();b.disabled=false;notice('#msg',`이 계정은 ${roleName[role]} 계정입니다. 위에서 ${roleName[role]}${roleObj[role]} 선택한 뒤 다시 로그인해 주세요.`);return}go(role)};
$('#signupform').onsubmit=async e=>{e.preventDefault();$('#smsg').replaceChildren();const name=$('#sname').value.trim(),email=$('#semail').value.trim(),pw=$('#spass').value;if(pw!==$('#spass2').value){notice('#smsg','비밀번호와 비밀번호 확인이 서로 다릅니다.');return}const b=$('#signupform button');b.disabled=true;
// requested_role은 관리자가 참고할 신청 정보일 뿐, 실제 권한은 profiles.role로만 정해진다
const {data,error}=await db.auth.signUp({email,password:pw,options:{data:{display_name:name,requested_role:requestRole[$('input[name=srole]:checked').value]}}});b.disabled=false;if(error){notice('#smsg',`가입할 수 없습니다. (${error.message})`);return}if(data.session)await db.auth.signOut();$('#signupform').reset();guardian();notice('#smsg',data.session?'가입 신청이 완료되었습니다. 관리자가 승인하면 로그인할 수 있어요.':'가입 신청이 완료되었습니다. 이메일로 보낸 인증 링크를 누르고, 관리자가 승인하면 로그인할 수 있어요.',true)};
init();
