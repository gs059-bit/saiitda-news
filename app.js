import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
const cfg=window.SAIITDA_CONFIG||{};
const ready=Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey);
const db=ready?createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaultCats=['우리를 잇다','오늘의 사이','세상을 잇다','책 사이를 잇다','마음을 잇다'];
let siteSettings={accent:'#0067bd',font:'classic',layout:'grid',logo_width:530,tagline:'우리 사이의 이야기를 찾아, 세상과 잇다',featured_id:null,site_title:'사이잇다'};
let session=null,profile=null,articles=[],categories=[...defaultCats],currentCat='전체기사',search='',selectedFile=null,editId=null;
const isAdmin=()=>profile?.role==='admin';const canWrite=()=>['admin','reporter'].includes(profile?.role);
const date=s=>s?new Date(s).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'}):'';
const statusName={draft:'임시 저장',pending:'승인 대기',published:'발행됨',rejected:'수정 요청'};
function notice(msg,bad=false){return `<div class="notice ${bad?'error':''}">${esc(msg)}</div>`}
function errorText(e){return e?.message||'오류가 발생했습니다.'}
function route(){return decodeURIComponent(location.hash.slice(1)||'/')}
function nav(){let items=['전체기사',...categories];$('#nav').innerHTML=items.map(c=>`<button class="${currentCat===c?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')+`<span class="push"></span><button data-route="${session?'dashboard':'login'}" class="pill">${session?'기자실':'기자 로그인'}</button>`;$('#nav').querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{currentCat=b.dataset.cat;location.hash='/';render()});$('#nav [data-route]').onclick=()=>location.hash='/'+(session?'dashboard':'login');$('#userbar').textContent=session?`${profile?.display_name||'기자'}님 · ${isAdmin()?'관리자':'학생 기자'}`:'학생 기자들의 목소리로 세상을 잇습니다'}
async function init(){document.querySelector('#school').textContent=(cfg.schoolName||'우리 학교')+' 어린이 기자단 웹진';$('#footSchool').textContent=cfg.schoolName||'우리 학교';$('#tagline').textContent=cfg.tagline||'';if(ready){try{const {data}=await db.auth.getSession();session=data.session;await loadProfile();await loadCategories();await loadSettings();await loadArticles();db.auth.onAuthStateChange((_event,s)=>{session=s;setTimeout(async()=>{await loadProfile();await loadArticles();render()},0)})}catch(e){console.error(e)}}render();window.addEventListener('hashchange',render)}
async function loadProfile(){profile=null;if(!session)return;const {data,error}=await db.from('profiles').select('id,display_name,role').eq('id',session.user.id).maybeSingle();if(error)throw error;profile=data}
async function loadCategories(){if(!ready)return;const {data,error}=await db.from('categories').select('name').order('sort_order');if(!error&&data?.length)categories=data.map(x=>x.name)}
async function loadSettings(){if(!ready){applySettings();return}const {data,error}=await db.from('site_settings').select('key,value').eq('key','main').maybeSingle();if(!error&&data?.value)siteSettings={...siteSettings,...data.value};applySettings()}
function applySettings(){const x=siteSettings;document.documentElement.style.setProperty('--blue',/^#[0-9a-fA-F]{6}$/.test(x.accent)?x.accent:'#0067bd');document.documentElement.style.setProperty('--logo-width',`${Math.min(700,Math.max(220,Number(x.logo_width)||530))}px`);document.body.dataset.font=['classic','modern'].includes(x.font)?x.font:'classic';document.body.dataset.layout=['grid','list'].includes(x.layout)?x.layout:'grid';$('#tagline').textContent=x.tagline||'';document.title=(x.site_title||'사이잇다')+' | 강서초등학교 어린이 기자단 웹진'}
async function loadArticles(){if(!ready)return;const {data,error}=await db.from('articles').select('id,title,summary,body,category,cover_url,author_name,author_id,status,created_at,published_at,updated_at').order('published_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(300);if(error){console.error(error);return}articles=data||[]}
function published(){return articles.filter(a=>a.status==='published')}
function card(a){return `<div class="story" role="link" tabindex="0" data-article="${a.id}">${a.cover_url?`<img loading="lazy" src="${esc(a.cover_url)}" alt="기사 대표 사진">`:''}<div class="eyebrow">${esc(a.category)}</div><h3>${esc(a.title)}</h3><p class="summary">${esc(a.summary||'')}</p><div class="meta">${esc(a.author_name||'사이잇다 신문부')} · ${date(a.published_at||a.created_at)}</div></div>`}
function wireCards(){document.querySelectorAll('[data-article]').forEach(el=>{el.onclick=()=>location.hash='/article/'+el.dataset.article;el.onkeydown=e=>{if(e.key==='Enter')el.click()}})}
function home(){let items=published().filter(a=>(currentCat==='전체기사'||a.category===currentCat)&&(!search||[a.title,a.summary,a.body,a.author_name].join(' ').toLowerCase().includes(search.toLowerCase())));items.sort((a,b)=>new Date(b.published_at||b.created_at)-new Date(a.published_at||a.created_at));let top=items[0];items=items.filter(a=>a.id!==top?.id);$('#app').innerHTML=`<div class="page-head"><div><h1>${esc(currentCat==='전체기사'?'전체기사':currentCat)}</h1><small>학생의 시선으로 기록한 우리 학교 이야기</small></div><input class="search" id="search" aria-label="기사 검색" placeholder="기사 제목이나 내용 검색" value="${esc(search)}"></div>${!ready?notice('현재는 설정 전 미리보기입니다. config.js에 Supabase 정보를 입력하고 database.sql을 실행하면 기사 발행과 로그인이 활성화됩니다.'):''}${top?`<section class="hero" data-article="${top.id}"><div>${top.cover_url?`<img class="photo" src="${esc(top.cover_url)}" alt="대표 기사 사진">`:`<div class="photo"></div>`}</div><div><div class="eyebrow">주요 기사 · ${esc(top.category)}</div><h2>${esc(top.title)}</h2><p class="summary">${esc(top.summary||'')}</p><div class="meta">${esc(top.author_name||'사이잇다 신문부')} · ${date(top.published_at||top.created_at)}</div></div></section><div class="grid">${items.map(card).join('')}</div>`:`<div class="empty"><h2>아직 등록된 기사가 없어요.</h2><p>신문부의 첫 번째 기사가 발행되면 이곳에 나타납니다.</p></div>`}`;$('#search').oninput=e=>{let pos=e.target.selectionStart;search=e.target.value;home();let s=$('#search');s.focus();s.setSelectionRange(pos,pos)};wireCards();}
function articleView(id){const a=articles.find(x=>x.id===id);if(!a||(a.status!=='published'&&!isAdmin()&&a.author_id!==session?.user?.id)){notFound();return}$('#app').innerHTML=`<article class="article"><div class="eyebrow">${esc(a.category)}</div><h1>${esc(a.title)}</h1><p class="lead">${esc(a.summary)}</p><div class="byline">${esc(a.author_name||'사이잇다 신문부')} · ${date(a.published_at||a.created_at)}</div>${a.cover_url?`<img class="cover" src="${esc(a.cover_url)}" alt="기사 대표 사진">`:''}<div class="body">${esc(a.body)}</div><div class="actions" style="margin-top:28px"><button class="btn secondary" id="back">기사 목록으로</button>${canWrite()&&(isAdmin()||a.author_id===session.user.id)?`<button class="btn" id="edit">기사 수정</button>`:''}</div></article>`;$('#back').onclick=()=>location.hash='/';if($('#edit'))$('#edit').onclick=()=>location.hash='/edit/'+a.id}
function login(){if(session){location.hash='/dashboard';return}$('#app').innerHTML=`<div class="panel" style="max-width:470px;margin:50px auto"><h2>신문부 기자 로그인</h2><p class="muted">선생님이 발급한 기자 계정으로 로그인하세요. 일반 방문자는 로그인하지 않아도 기사를 읽을 수 있어요.</p>${!ready?notice('먼저 Supabase 연결 설정을 완료해 주세요.',true):''}<form id="loginform"><div class="field"><label for="email">이메일</label><input id="email" type="email" required autocomplete="username"></div><div class="field"><label for="password">비밀번호</label><input id="password" type="password" required autocomplete="current-password"></div><button class="btn" ${!ready?'disabled':''}>로그인</button></form><div id="msg"></div></div>`;$('#loginform').onsubmit=async e=>{e.preventDefault();let b=$('#loginform button');b.disabled=true;const {error}=await db.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});b.disabled=false;if(error)$('#msg').innerHTML=notice('로그인할 수 없습니다. 계정 정보를 확인해 주세요.',true);else location.hash='/dashboard'}}
function dashboard(){if(!session){location.hash='/login';return}if(!canWrite()){$('#app').innerHTML=notice('기자 권한이 없는 계정입니다. 관리자에게 문의하세요.',true);return}let mine=isAdmin()?articles:articles.filter(a=>a.author_id===session.user.id);$('#app').innerHTML=`<div class="page-head"><div><h1>${isAdmin()?'편집국 관리자':'나의 기자실'}</h1><small>${esc(profile?.display_name||'기자')}님, 환영합니다.</small></div><div class="actions"><button class="btn" id="new">+ 새 기사 작성</button><button class="btn secondary" id="logout">로그아웃</button></div></div><div class="dashboard"><aside class="side"><strong>기자실 메뉴</strong><button id="articlesTab">기사 관리</button>${isAdmin()?'<button id="catsTab">카테고리 관리</button><button id="designTab">사이트 디자인 설정</button>':''}<p class="small muted">기사 발행 전 관리자 승인이 필요합니다.</p></aside><section id="workspace"><h2>기사 목록 (${mine.length})</h2>${mine.length?mine.map(a=>`<div class="entry"><div><span class="status">${statusName[a.status]||esc(a.status)}</span> <span class="eyebrow">${esc(a.category)}</span><h3>${esc(a.title)}</h3><div class="meta">${esc(a.author_name)} · ${date(a.updated_at)}</div></div><div class="actions"><button class="btn secondary" data-edit="${a.id}">수정</button>${isAdmin()&&a.status!=='published'?`<button class="btn" data-publish="${a.id}">승인·발행</button>`:''}${isAdmin()&&a.status==='published'?`<button class="btn secondary" data-unpublish="${a.id}">공개 취소</button>`:''}${isAdmin()&&a.status==='pending'?`<button class="btn secondary" data-reject="${a.id}">수정 요청</button>`:''}<button class="btn danger" data-delete="${a.id}">삭제</button></div></div>`).join(''):'<p class="muted">아직 작성한 기사가 없습니다.</p>'}</section></div>`;$('#new').onclick=()=>location.hash='/new';$('#logout').onclick=async()=>{await db.auth.signOut();location.hash='/'};$('#articlesTab').onclick=dashboard;if($('#catsTab'))$('#catsTab').onclick=categoryEditor;if($('#designTab'))$('#designTab').onclick=designEditor;document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>location.hash='/edit/'+b.dataset.edit);for(let action of ['publish','unpublish','reject','delete'])document.querySelectorAll(`[data-${action}]`).forEach(b=>b.onclick=()=>changeArticle(b.dataset[action],action))}
async function changeArticle(id,action){const messages={publish:'이 기사를 전체 방문자에게 공개할까요?',unpublish:'이 기사를 비공개 처리할까요?',reject:'이 기사를 수정 요청 상태로 변경할까요?',delete:'기사를 영구 삭제할까요?'};if(!confirm(messages[action]))return;let error;if(action==='delete'){({error}=await db.from('articles').delete().eq('id',id))}else{let fields=action==='publish'?{status:'published',published_at:new Date().toISOString()}:action==='unpublish'?{status:'draft',published_at:null}:{status:'rejected'};({error}=await db.from('articles').update(fields).eq('id',id))}if(error)alert(errorText(error));else{await loadArticles();dashboard()}}
function editor(id){if(!canWrite()){location.hash='/login';return}const a=id?articles.find(x=>x.id===id):null;if(id&&!a){notFound();return}if(a&&!isAdmin()&&a.author_id!==session.user.id){notFound();return}editId=id||null;selectedFile=null;$('#app').innerHTML=`<div class="page-head"><div><h1>${a?'기사 수정':'새 기사 작성'}</h1><small>기자실 · 기사 편집</small></div><button class="btn secondary" id="cancel">기자실로</button></div><div class="panel"><form id="editor"><div class="field"><label for="title">기사 제목 *</label><input id="title" maxlength="160" required value="${esc(a?.title||'')}"></div><div class="field"><label for="summary">기사 요약 *</label><textarea id="summary" maxlength="400" style="min-height:90px" required>${esc(a?.summary||'')}</textarea></div><div class="field"><label for="category">카테고리</label><select id="category">${categories.map(c=>`<option ${c===a?.category?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label for="author">기사에 표시할 기자 이름 또는 필명 *</label><input id="author" maxlength="80" required value="${esc(a?.author_name||profile?.display_name||'')}"></div><div class="field"><label for="body">기사 본문 *</label><textarea id="body" required style="min-height:340px" placeholder="취재한 내용을 문단별로 작성해 주세요.">${esc(a?.body||'')}</textarea></div><div class="field"><label for="cover">대표 사진 (선택)</label><input type="file" id="cover" accept="image/jpeg,image/png,image/webp"><span class="filehelp">JPG, PNG, WEBP · 5MB 이하 · 게시 동의가 확인된 사진만 사용하세요.</span>${a?.cover_url?`<img src="${esc(a.cover_url)}" alt="현재 대표 사진" style="width:220px;max-height:150px;object-fit:cover">`:''}</div><div class="actions"><button class="btn secondary" type="button" id="draft">임시 저장</button><button class="btn" type="submit">${isAdmin()?'승인 요청으로 저장':'선생님께 승인 요청'}</button></div><div id="msg"></div></form></div>`;$('#cancel').onclick=()=>location.hash='/dashboard';$('#cover').onchange=e=>selectedFile=e.target.files[0]||null;$('#draft').onclick=()=>save('draft');$('#editor').onsubmit=e=>{e.preventDefault();save('pending')}}
async function save(status){const title=$('#title').value.trim(),summary=$('#summary').value.trim(),body=$('#body').value.trim(),author=$('#author').value.trim(),category=$('#category').value;if(!title||!summary||!body||!author){$('#msg').innerHTML=notice('제목, 요약, 기자 이름, 본문을 모두 입력해 주세요.',true);return}const buttons=$('#editor').querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{let cover_url=editId?articles.find(a=>a.id===editId)?.cover_url:null;if(selectedFile){if(selectedFile.size>5*1024*1024)throw new Error('사진은 5MB 이하만 올릴 수 있습니다.');const allowed=['image/jpeg','image/png','image/webp'];if(!allowed.includes(selectedFile.type))throw new Error('JPG, PNG, WEBP 사진만 가능합니다.');let ext=selectedFile.type==='image/png'?'png':selectedFile.type==='image/webp'?'webp':'jpg';const path=`${session.user.id}/${crypto.randomUUID()}.${ext}`;const {error}=await db.storage.from('article-images').upload(path,selectedFile,{contentType:selectedFile.type,upsert:false});if(error)throw error;cover_url=db.storage.from('article-images').getPublicUrl(path).data.publicUrl}let payload={
  title,
  summary,
  body,
  author_name:author,
  category,
  cover_url,
  status:status==='pending'&&!isAdmin()?'draft':status
};let result;if(editId)result=await db.from('articles').update(payload).eq('id',editId);else result=await db.from('articles')
  .insert({...payload,author_id:session.user.id})
  .select('id')
  .single();if(result.error)throw result.error;

if(status==='pending'&&!isAdmin()){
  const articleId=editId || result.data?.id;

  if(!articleId){
    throw new Error('먼저 임시 저장한 뒤 승인 요청을 해 주세요.');
  }

  const {error:submitError}=await db.rpc('submit_article',{
    article_id:articleId
  });

  if(submitError)throw submitError;
}await loadArticles();location.hash='/dashboard'}catch(e){$('#msg').innerHTML=notice(errorText(e),true)}finally{buttons.forEach(b=>b.disabled=false)}}
function categoryEditor(){if(!isAdmin())return;$('#workspace').innerHTML=`<h2>카테고리 관리</h2><p class="muted">한 줄에 하나씩 카테고리를 입력하세요. 기존 기사에서 사용 중인 카테고리를 삭제하면 해당 기사는 예전 분류로 남을 수 있습니다.</p><div class="field"><label for="cats">카테고리 목록</label><textarea id="cats">${esc(categories.join('\n'))}</textarea></div><button class="btn" id="saveCats">저장</button><div id="catmsg"></div>`;$('#saveCats').onclick=async()=>{let names=[...new Set($('#cats').value.split('\n').map(x=>x.trim()).filter(Boolean))];if(!names.length||names.some(x=>x.length>40)){ $('#catmsg').innerHTML=notice('카테고리를 1~40자로 입력해 주세요.',true);return}let {error}=await db.from('categories').delete().neq('name','__never__');if(!error)({error}=await db.from('categories').insert(names.map((name,i)=>({name,sort_order:i}))));if(error){$('#catmsg').innerHTML=notice(errorText(error),true);return}categories=names;nav();$('#catmsg').innerHTML=notice('카테고리를 저장했습니다.')}}
function designEditor(){if(!isAdmin())return;const x=siteSettings;$('#workspace').innerHTML=`<h2>사이트 디자인 설정</h2><p class="muted">선생님만 수정할 수 있어요. 미리보기 후 저장하면 모든 방문자에게 적용됩니다.</p><form id="designForm"><div class="field"><label for="siteTitle">신문 이름 (브라우저 제목)</label><input id="siteTitle" maxlength="50" value="${esc(x.site_title)}"></div><div class="field"><label for="siteTagline">로고 아래 소개 문구</label><input id="siteTagline" maxlength="120" value="${esc(x.tagline)}"></div><div class="field"><label for="accent">강조 색상</label><input id="accent" type="color" value="${esc(x.accent)}" style="height:48px;width:110px"></div><div class="field"><label for="logoWidth">로고 크기: <output id="logoSize">${Number(x.logo_width)}</output>px</label><input id="logoWidth" type="range" min="220" max="700" step="10" value="${Number(x.logo_width)}"></div><div class="field"><label for="fontChoice">기사 제목 글꼴</label><select id="fontChoice"><option value="classic" ${x.font==='classic'?'selected':''}>정통 신문 스타일</option><option value="modern" ${x.font==='modern'?'selected':''}>현대적 뉴스 스타일</option></select></div><div class="field"><label for="layoutChoice">기사 목록 배치</label><select id="layoutChoice"><option value="grid" ${x.layout==='grid'?'selected':''}>사진 카드형 (3열)</option><option value="list" ${x.layout==='list'?'selected':''}>기사 목록형 (1열)</option></select></div><div class="field"><label for="featured">메인 대표 기사 (전체기사에서는 최신 발행 기사 자동 표시)</label><select id="featured"><option value="">최신 발행 기사 자동 선택</option>${published().map(a=>`<option value="${esc(a.id)}" ${x.featured_id===a.id?'selected':''}>${esc(a.title)}</option>`).join('')}</select></div><div class="actions"><button type="button" class="btn secondary" id="previewDesign">미리보기</button><button type="submit" class="btn">디자인 저장</button><button type="button" class="btn secondary" id="resetDesign">변경 취소</button></div><div id="designMsg"></div></form>`;const read=()=>({site_title:$('#siteTitle').value.trim().slice(0,50)||'사이잇다',tagline:$('#siteTagline').value.trim().slice(0,120),accent:$('#accent').value,logo_width:Number($('#logoWidth').value),font:$('#fontChoice').value,layout:$('#layoutChoice').value,featured_id:$('#featured').value||null});$('#logoWidth').oninput=()=>{$('#logoSize').textContent=$('#logoWidth').value};$('#previewDesign').onclick=()=>{siteSettings={...siteSettings,...read()};applySettings();$('#designMsg').innerHTML=notice('현재 화면에 미리 적용했습니다. 방문자에게 반영하려면 저장하세요.')};$('#resetDesign').onclick=async()=>{await loadSettings();designEditor()};$('#designForm').onsubmit=async e=>{e.preventDefault();if(!ready){$('#designMsg').innerHTML=notice('Supabase 연결 후 저장할 수 있습니다.',true);return}const value=read();const {error}=await db.from('site_settings').upsert({key:'main',value});if(error){$('#designMsg').innerHTML=notice(errorText(error),true);return}siteSettings={...siteSettings,...value};applySettings();$('#designMsg').innerHTML=notice('디자인을 저장했습니다. 모든 방문자에게 적용됩니다.')};}
function notFound(){$('#app').innerHTML='<div class="empty"><h2>페이지를 찾을 수 없어요.</h2><p>주소를 확인하거나 홈으로 돌아가 주세요.</p><a href="#/" class="btn">홈으로</a></div>'}
const originalLogin = login;

function loginWithSignup() {
  originalLogin();

  const panel = document.querySelector('#app .panel');
  if (!panel) return;

  const signupLink = document.createElement('p');
  signupLink.style.marginTop = '20px';
  signupLink.style.textAlign = 'center';
  signupLink.innerHTML =
    '<a href="#/signup"> 학생 회원가입하기</a>';

  panel.appendChild(signupLink);
}
async function showApprovals() {
  const app = document.querySelector('#app');

  // 로그인 여부 확인
  if (!session) {
    app.innerHTML = `
      <div class="panel">
        <h2>로그인이 필요합니다</h2>
        <p>학생 가입 신청을 확인하려면 먼저 로그인해 주세요.</p>
        <a href="#/login">로그인하기</a>
      </div>
    `;
    return;
  }

  // 데이터베이스에서 관리자 권한 확인
  const { data: myProfile, error: profileError } = await db
    .from('profiles')
    .select('role, approval_status, is_super_admin')
    .eq('id', session.user.id)
    .single();

  const isTeacherAdmin =
    myProfile?.role === 'teacher_admin' &&
    myProfile?.approval_status === 'approved';

  const isSuperAdmin =
    myProfile?.role === 'admin' &&
    myProfile?.is_super_admin === true &&
    myProfile?.approval_status === 'approved';

  if (profileError || (!isTeacherAdmin && !isSuperAdmin)) {
    app.innerHTML = `
      <div class="panel">
        <h2>접근 권한이 없습니다</h2>
        <p>이 페이지는 최고 관리자와 교사 관리자만 이용할 수 있습니다.</p>
        <a href="#/">홈으로 돌아가기</a>
      </div>
    `;
    return;
  }

  // 승인 대기 중인 학생 목록
  const { data: students, error } = await db
    .from('profiles')
    .select('id, display_name, requested_role, approval_status')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    app.innerHTML = `
      <div class="panel">
        <h2>학생 가입 승인 관리</h2>
        <p>가입 신청 목록을 불러오지 못했습니다.</p>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="panel">
      <h2>학생 가입 승인 관리</h2>
      <p>승인을 기다리는 학생들의 가입 신청 목록입니다.</p>
      <div id="approvalList"></div>
    </div>
  `;

  const list = document.querySelector('#approvalList');

  if (!students || students.length === 0) {
    list.textContent = '현재 승인 대기 중인 학생이 없습니다.';
    return;
  }

  students.forEach(student => {
    const item = document.createElement('div');
    item.className = 'panel';
    item.style.marginTop = '12px';

    const name = document.createElement('h3');
    name.textContent = student.display_name;

    const role = document.createElement('p');
    role.textContent =
      student.requested_role === 'reporter'
        ? '신청 유형: 학생 기자'
        : '신청 유형: 일반 학생';

    const status = document.createElement('p');
    status.textContent = '상태: 승인 대기';

       const buttons = document.createElement('div');
    buttons.className = 'actions';
    buttons.style.marginTop = '15px';

    const approveButton = document.createElement('button');
    approveButton.className = 'btn';
    approveButton.textContent = '가입 승인';
    approveButton.type = 'button';
        approveButton.onclick = async () => {
      if (!confirm(`${student.display_name} 학생의 가입을 승인할까요?`)) {
        return;
      }

      approveButton.disabled = true;

     const { error } = await db.rpc('approve_student_signup', {
        target_student_id: student.id
});

      if (error) {
         console.error('가입 승인 오류:', error);
         alert('승인에 실패했습니다: ' + error.message);
         approveButton.disabled = false;
         return;
}

      alert('가입 승인이 완료되었습니다.');
      showApprovals();
    };

    const rejectButton = document.createElement('button');
    rejectButton.className = 'btn secondary';
    rejectButton.textContent = '가입 거절';
    rejectButton.type = 'button';
    rejectButton.onclick = async () => {
  if (!confirm(`${student.display_name} 학생의 가입을 거절할까요?`)) {
    return;
  }

  rejectButton.disabled = true;

  const { data, error } = await db
    .from('profiles')
    .update({ approval_status: 'rejected' })
    .eq('id', student.id)
    .eq('approval_status', 'pending')
    .select('id');

  if (error || !data || data.length !== 1) {
    alert('거절 처리에 실패했습니다. 관리자 권한을 확인해 주세요.');
    rejectButton.disabled = false;
    return;
  }

  alert('가입 신청을 거절했습니다.');
  showApprovals();
};

    buttons.append(approveButton, rejectButton);
    item.append(name, role, status, buttons);
    list.appendChild(item);
  });
}
function render(){
  nav();
  let r = route();

  if(r === '/') home();
  else if(r === '/login') loginWithSignup();
  else if(r === '/signup') window.showStudentSignup();
  else if(r === '/approvals') showApprovals();  
  else if(r === '/dashboard') dashboard();
  else if(r === '/new') editor();
  else if(r.startsWith('/edit/')) editor(r.split('/')[2]);
  else if(r.startsWith('/article/')) articleView(r.split('/')[2]);
  else notFound();
}
init();
