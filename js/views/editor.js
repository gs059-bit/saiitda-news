
import { db } from '../supabase.js';
import { $, esc, errorText } from '../utils.js';
import { state, isAdmin, canWrite, isMine, loadArticles } from '../state.js';
import { notice, notFound } from '../ui.js';
import { renderRichBody, countRichCharacters, bodyToEditorHtml, editorHtmlToBody } from '../rich-text.js';

const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_SIDE = 1600;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_DIR = '/article-images/';

const DRAFT_PREFIX = 'saiitda-draft:';
const DRAFT_FIELDS = ['title', 'summary', 'category', 'author', 'body'];

let editId = null;
let selectedFile = null;
let lastSavedCover = null;
let uploadingBodyPhotos = false;
let bodyCursor = null;

const draftKey = () =>
  `${DRAFT_PREFIX}${state.session.user.id}:${editId || 'new'}`;

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftKey()));
  } catch {
    return null;
  }
}

function writeDraft() {
  try {
    const fields = Object.fromEntries(
      DRAFT_FIELDS.map(f => [f, $('#' + f).value])
    );
    const saved = Date.now();

    localStorage.setItem(
      draftKey(),
      JSON.stringify({ ...fields, saved })
    );

    if ($('#autosaveState')) {
      const time = new Date(saved).toLocaleTimeString('ko-KR', {
        hour: 'numeric',
        minute: '2-digit'
      });
      $('#autosaveState').textContent =
        `이 기기에 자동 보관됨 · ${time}`;
    }
  } catch {
    if ($('#autosaveState')) {
      $('#autosaveState').textContent =
        '자동 보관에 실패했습니다. 원고를 다른 문서에도 보관해 주세요.';
    }
  }
}

function dropDraft() {
  try {
    localStorage.removeItem(draftKey());
  } catch {
    // 저장소에 접근할 수 없는 경우
  }
}

// 학교 공용 컴퓨터에서는 로그아웃 시 기기 보관 글을 지운다.
// 로그아웃 전 반드시 서버에 임시 저장해야 한다.
export function clearDrafts() {
  const prefix =
    `${DRAFT_PREFIX}${state.session?.user?.id}:`;

  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    // 저장소에 접근할 수 없는 경우
  }
}

function isArticlePhoto(url) {
  try {
    const u = new URL(url);
    const expected = new URL(
      db.storage
        .from('article-images')
        .getPublicUrl('__check__.jpg')
        .data.publicUrl
    );

    const prefix = expected.pathname.slice(
      0,
      -'__check__.jpg'.length
    );

    return (
      u.protocol === 'https:' &&
      u.origin === expected.origin &&
      u.pathname.startsWith(prefix)
    );
  } catch {
    return false;
  }
}

// 본문 사진은 [[사진:URL]] 형식으로 저장한다.
function renderBody(body) {
  const source = String(body || '');
  const marker = /\[\[사진:(https:\/\/[^\]\s]+)\]\]/g;

  let html = '';
  let last = 0;

  for (const match of source.matchAll(marker)) {
    html += esc(source.slice(last, match.index));

    const url = match[1];

    html += isArticlePhoto(url)
      ? `<figure style="
          margin:22px 0;
          text-align:center;
          white-space:normal;
        ">
          <img
            src="${esc(url)}"
            alt="기사 본문 사진"
            loading="lazy"
            style="
              display:block;
              max-width:100%;
              width:auto;
              height:auto;
              max-height:900px;
              margin:0 auto;
              border-radius:8px;
            "
          >
        </figure>`
      : esc(match[0]);

    last = match.index + match[0].length;
  }

  return html + esc(source.slice(last));
}

function renderPreview() {
  if ($('#bodyPreview')) $('#bodyPreview').innerHTML = renderRichBody($('#body').value);
}

function rememberCursor() {
  const t = $('#body');
  if (t) bodyCursor = t.value.length;
}

export function editor(id) {
  if (!canWrite()) {
    location.href = 'login.html';
    return;
  }

  const a = id
    ? state.articles.find(x => x.id === id)
    : null;

  if (id && (!a || (!isAdmin() && !isMine(a)))) {
    notFound();
    return;
  }

  editId = id || null;
  selectedFile = null;
  lastSavedCover = a?.cover_url ?? null;
  uploadingBodyPhotos = false;
  bodyCursor = null;

  const review = a?.status === 'rejected'
    ? notice(
        `관리자 수정 요청: ${
          a.review_note || '내용을 다시 확인해 주세요.'
        }`,
        true
      )
    : '';

  $('#app').innerHTML = `
    <div class="page-head">
      <div>
        <h1>${a ? '기사 수정' : '새 기사 작성'}</h1>
        <small>기자실 · 기사 편집</small>
      </div>
      <button class="btn secondary" id="cancel">
        기자실로
      </button>
    </div>

    ${review}

    <div id="draftBox"></div>

    <div class="panel">
      <form id="editor">

        <div class="field">
          <label for="title">기사 제목 *</label>
          <input
            id="title"
            maxlength="160"
            required
            value="${esc(a?.title || '')}"
          >
        </div>

        <div class="field">
          <label for="summary">기사 요약 *</label>
          <textarea
            id="summary"
            maxlength="400"
            style="min-height:90px"
            required
          >${esc(a?.summary || '')}</textarea>
        </div>

        <div class="field">
          <label for="category">카테고리</label>
          <select id="category">
            ${state.categories.map(c => `
              <option
                ${c === a?.category ? 'selected' : ''}
              >${esc(c)}</option>
            `).join('')}
          </select>
        </div>

        <div class="field">
          <label for="author">
            기사에 표시할 기자 이름 또는 필명 *
          </label>
          <input
            id="author"
            maxlength="80"
            required
            value="${esc(
              a?.author_name ||
              state.profile?.display_name ||
              ''
            )}"
          >
        </div>

        <div class="field">
          <label for="body">기사 본문 *</label>

          <div class="rich-toolbar" role="toolbar" aria-label="기사 본문 꾸미기">
            <button type="button" data-wrap="**" title="굵게"><b>굵게</b></button>
            <button type="button" data-wrap="*" title="기울임"><i>기울임</i></button>
            <button type="button" data-wrap="__" title="밑줄"><u>밑줄</u></button>
            <button type="button" data-wrap="==" title="형광펜">형광펜</button>
            <select id="richSize" aria-label="글자 크기"><option value="">글자 크기</option>${[12,14,16,18,20,24,28,32].map(n=>`<option value="${n}">${n}px</option>`).join("")}</select>
            <select id="richColor" aria-label="글자 색"><option value="">글자 색</option><option value="#1b1b1b">검정</option><option value="#b42318">빨강</option><option value="#1457a3">파랑</option><option value="#087443">초록</option><option value="#7c3aed">보라</option><option value="#b45309">주황</option></select>
            <button type="button" data-line="## ">소제목</button><button type="button" data-line="### ">작은 제목</button><button type="button" data-line="> ">인용문</button><button type="button" data-line="- ">글머리</button><button type="button" data-line="1. ">번호 목록</button><button type="button" id="richLink">링크</button>
          </div>
          <div id="richEditor" class="rich-editable" contenteditable="true" role="textbox" aria-label="기사 본문" aria-multiline="true" spellcheck="true" data-placeholder="취재한 내용을 문단별로 작성해 주세요."></div>
          <textarea id="body" hidden aria-hidden="true"></textarea>

          <div class="actions" style="margin-top:10px"><span id="charCount" class="small muted" aria-live="polite"></span><button class="btn secondary small" type="button" id="spellHelp">맞춤법 확인 방법</button><button class="btn secondary small" type="button" id="mobilePreview">모바일 미리보기</button>
            <button
              class="btn secondary"
              type="button"
              id="insertBodyPhoto"
            >
              📷 커서 위치에 사진 넣기 (여러 장 가능)
            </button>

            <input
              type="file"
              id="bodyPhotos"
              accept="${PHOTO_TYPES.join(',')}"
              multiple
              hidden
            >
          </div>

          <span class="filehelp">
            먼저 본문에서 사진을 넣을 위치를 클릭하세요.
            사진을 여러 장 선택할 수 있습니다.
            사진 위치 표시는 직접 지울 수 있습니다.
          </span>

          <div
            id="photoStatus"
            role="status"
            aria-live="polite"
          ></div>
        </div>

        <details open style="margin:12px 0 24px">
          <summary style="
            cursor:pointer;
            font-weight:700;
          ">
            본문 미리보기 (사진 위치 확인)
          </summary>

          <div
            id="bodyPreview"
            style="
              padding:18px 10px;
              white-space:pre-wrap;
              overflow-wrap:anywhere;
              line-height:1.9;
            "
          ></div>
        </details>

        <div class="field">
          <label for="cover">
            대표 사진 (선택 · 기사 상단에 표시)
          </label>

          <input
            type="file"
            id="cover"
            accept="${PHOTO_TYPES.join(',')}"
          >

          <span class="filehelp">
            JPG, PNG, WEBP · 큰 사진은 자동으로 줄입니다.
            게시 동의가 확인된 사진만 사용하세요.
          </span>

          ${a?.cover_url ? `
            <img
              src="${esc(a.cover_url)}"
              alt="현재 대표 사진"
              style="
                width:220px;
                max-height:150px;
                object-fit:cover;
              "
            >
          ` : ''}
        </div>

        <div class="actions">
          <button
            class="btn secondary"
            type="button"
            id="draft"
          >
            임시 저장
          </button>

          <button class="btn" type="submit">
            ${isAdmin()
              ? '승인 요청으로 저장'
              : '관리자에게 승인 요청'}
          </button>
        </div>

        <p class="small muted" id="autosaveState">
          입력한 글은 이 기기에 자동 보관됩니다.
        </p>

        <p class="small muted">
          공용 컴퓨터에서는 로그아웃 시 기기 보관 글이
          삭제됩니다. 로그아웃 전에 반드시
          '임시 저장'을 눌러 주세요.
        </p>

        <div id="msg"></div>

      </form>
    </div>
  `;

  $('#cancel').onclick = () => {
    writeDraft();
    location.hash = '/dashboard';
  };

  $('#cover').onchange = e => {
    selectedFile = e.target.files[0] || null;
  };

  $('#draft').onclick = () => save('draft');

  $('#editor').onsubmit = e => {
    e.preventDefault();
    save('pending');
  };


  const t=$('#body'),rich=$('#richEditor');
  rich.innerHTML=bodyToEditorHtml(a?.body||'');
  const sync=()=>{
    t.value=editorHtmlToBody(rich.innerHTML);
    $('#charCount').textContent='본문 '+rich.innerText.trim().length+'자';
    writeDraft();renderPreview();
  };
  // Restore existing autosave data, including older plain-text drafts.
  offerDraft(a);
  rich.innerHTML=bodyToEditorHtml(t.value || a?.body || '');
  sync();
  rich.addEventListener('input',sync);
  $('#editor').addEventListener('input',ev=>{if(ev.target!==rich)writeDraft();});
  $('#editor').addEventListener('change',writeDraft);
  // Preserve the highlighted text when clicking a toolbar button.
  let savedRange=null;
  rich.addEventListener('mouseup',()=>{const s=getSelection();if(s.rangeCount&&rich.contains(s.anchorNode))savedRange=s.getRangeAt(0).cloneRange();});
  rich.addEventListener('keyup',()=>{const s=getSelection();if(s.rangeCount&&rich.contains(s.anchorNode))savedRange=s.getRangeAt(0).cloneRange();});
  const focusSelection=()=>{
    rich.focus();
    if(savedRange&&rich.contains(savedRange.commonAncestorContainer)){
      const s=getSelection();s.removeAllRanges();s.addRange(savedRange);
    }
  };
  const command=(cmd,value=null)=>{focusSelection();document.execCommand(cmd,false,value);sync();};
  const wrapSelection=(tag,style={})=>{
    focusSelection();
    const s=getSelection();if(!s.rangeCount)return;
    const range=s.getRangeAt(0),el=document.createElement(tag);
    Object.assign(el.style,style);
    if(range.collapsed){el.appendChild(document.createTextNode('\u200b'));range.insertNode(el);range.selectNodeContents(el);}
    else{el.appendChild(range.extractContents());range.insertNode(el);range.selectNodeContents(el);}
    s.removeAllRanges();s.addRange(range);savedRange=range.cloneRange();sync();
  };
  const toggleHighlight=()=>{
    focusSelection();
    const selection=getSelection();
    if(!selection.rangeCount)return;
    const range=selection.getRangeAt(0);
    const node=range.commonAncestorContainer;
    const element=node.nodeType===1?node:node.parentElement;
    const existing=element?.closest('mark');
    if(existing&&rich.contains(existing)){
      // Remove the highlight without removing the selected text or its other styles.
      const parent=existing.parentNode;
      while(existing.firstChild)parent.insertBefore(existing.firstChild,existing);
      parent.removeChild(existing);
      parent.normalize();
      savedRange=null;
      sync();
      rich.focus();
      return;
    }
    const marks=[...rich.querySelectorAll('mark')].filter(mark=>range.intersectsNode(mark));
    if(marks.length){
      marks.forEach(mark=>{
        const parent=mark.parentNode;
        while(mark.firstChild)parent.insertBefore(mark.firstChild,mark);
        parent.removeChild(mark);
      });
      savedRange=null;
      sync();
      rich.focus();
      return;
    }
    wrapSelection('mark');
  };
  document.querySelectorAll('[data-wrap]').forEach(b=>{
    b.addEventListener('mousedown',ev=>ev.preventDefault());
    b.onclick=()=>{
      const x=b.dataset.wrap;
      if(x==='**')command('bold');
      else if(x==='*')command('italic');
      else if(x==='__')command('underline');
      else if(x==='==')toggleHighlight();
    };
  });
  document.querySelectorAll('[data-line]').forEach(b=>{
    b.addEventListener('mousedown',ev=>ev.preventDefault());
    b.onclick=()=>{
      const x=b.dataset.line;
      if(x==='## ')command('formatBlock','h2');
      else if(x==='### ')command('formatBlock','h3');
      else if(x==='> ')command('formatBlock','blockquote');
      else if(x==='- ')command('insertUnorderedList');
      else if(x==='1. ')command('insertOrderedList');
    };
  });
  $('#richSize').onchange=ev=>{
    const size=Number(ev.target.value);
    if(size)wrapSelection('span',{fontSize:size+'px'});
    ev.target.value='';
  };
  $('#richColor').onchange=ev=>{
    if(ev.target.value)wrapSelection('span',{color:ev.target.value});
    ev.target.value='';
  };
  $('#richLink').onclick=()=>{
    const url=prompt('링크 주소를 입력하세요 (https://로 시작)');
    if(!url)return;
    try{const u=new URL(url);if(u.protocol!=='https:')throw Error();command('createLink',u.href);}
    catch{alert('https://로 시작하는 주소를 입력해 주세요.');}
  };
  $('#spellHelp').onclick=()=>alert('맞춤법은 브라우저에서 빨간 밑줄로 표시될 수 있습니다. 밑줄을 마우스 오른쪽 버튼으로 눌러 수정 제안을 확인하세요.');
  $('#mobilePreview').onclick=()=>{
    const el=$('#bodyPreview');el.classList.toggle('rich-mobile');
    $('#mobilePreview').textContent=el.classList.contains('rich-mobile')?'PC 미리보기':'모바일 미리보기';
  };
  $('#insertBodyPhoto').onclick = () => {
    $('#bodyPhotos').click();
  };

  $('#bodyPhotos').onchange = async e => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await insertBodyPhotos(files);
  };

  offerDraft(a);
  renderPreview();
  $('#charCount').textContent = '본문 ' + countRichCharacters(t.value) + '자';
}

// 이전에 작성하던 글을 자동으로 복원한다.
function offerDraft(article) {
  const d = readDraft();

  if (
    !d ||
    DRAFT_FIELDS.every(
      f => (d[f] ?? '') === $('#' + f).value
    )
  ) {
    return;
  }

  for (const f of DRAFT_FIELDS) {
    if (typeof d[f] === 'string') {
      $('#' + f).value = d[f];
    }
  }

  const when = new Date(d.saved).toLocaleString(
    'ko-KR',
    {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }
  );

  $('#draftBox').innerHTML = `
    <div class="notice">
      이 기기에 보관된 작성 중 글을
      자동으로 불러왔어요 (${esc(when)}).

      <div class="actions" style="margin-top:8px">
        <button
          type="button"
          class="btn secondary small"
          id="discardRestored"
        >
          보관 글 지우고
          ${article ? '저장된 기사' : '빈 작성 화면'}로 돌아가기
        </button>
      </div>
    </div>
  `;

  $('#discardRestored').onclick = () => {
    if (!confirm(
      '이 기기에 보관된 작성 중 글을 지울까요?'
    )) {
      return;
    }

    dropDraft();
    editor(editId);
  };
}

// 사진을 JPG로 변환하고 크기를 줄인다.
async function shrinkPhoto(file) {
  const img = await createImageBitmap(
    file,
    { imageOrientation: 'from-image' }
  );

  const scale = Math.min(
    1,
    MAX_PHOTO_SIDE / Math.max(img.width, img.height)
  );

  const canvas = document.createElement('canvas');

  canvas.width = Math.max(
    1,
    Math.round(img.width * scale)
  );

  canvas.height = Math.max(
    1,
    Math.round(img.height * scale)
  );

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  img.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b
        ? resolve(b)
        : reject(new Error('사진을 처리할 수 없습니다.')),
      'image/jpeg',
      0.85
    );
  });
}

// 사진을 Supabase Storage에 업로드한다.
async function uploadPhoto(file) {
  if (!PHOTO_TYPES.includes(file.type)) {
    throw new Error(
      'JPG, PNG, WEBP 사진만 가능합니다.'
    );
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      '사진 파일이 너무 큽니다. 30MB 이하 사진을 골라 주세요.'
    );
  }

  const photo = await shrinkPhoto(file);

  if (photo.size > MAX_PHOTO_BYTES) {
    throw new Error(
      '사진을 5MB 이하로 줄이지 못했습니다.'
    );
  }

  const path =
    `${state.session.user.id}/${crypto.randomUUID()}.jpg`;

  const bucket = db.storage.from('article-images');

  const { error } = await bucket.upload(
    path,
    photo,
    {
      contentType: 'image/jpeg',
      upsert: false
    }
  );

  if (error) throw error;

  return bucket.getPublicUrl(path).data.publicUrl;
}

// 본문의 선택한 위치에 사진을 삽입한다.
async function insertBodyPhotos(files) {
  if (!files.length || uploadingBodyPhotos) return;

  const rich=$('#richEditor');
  let range=null;
  const selection=getSelection();
  if(selection.rangeCount&&rich.contains(selection.anchorNode))range=selection.getRangeAt(0).cloneRange();
  uploadingBodyPhotos = true;
  writeDraft();

  rich.contentEditable = 'false';
  $('#insertBodyPhoto').disabled = true;
  $('#draft').disabled = true;

  $('#editor')
    .querySelector('button[type="submit"]')
    .disabled = true;

  let added = 0;
  const failures = [];

  try {
    for (let i = 0; i < files.length; i++) {
      $('#photoStatus').textContent =
        `사진 올리는 중… ${i + 1}/${files.length} (${files[i].name})`;

      try {
        const url = await uploadPhoto(files[i]);
        const figure=document.createElement('figure');figure.className='article-photo';
        const img=document.createElement('img');img.src=url;img.alt='기사 본문 사진';
        const caption=document.createElement('figcaption');caption.contentEditable='true';caption.textContent='사진 설명을 입력하세요';
        figure.append(img,caption);
        if(range&&rich.contains(range.commonAncestorContainer)){
          range.collapse(false);range.insertNode(figure);range.setStartAfter(figure);range.collapse(true);
        }else rich.appendChild(figure);
        $('#body').value=editorHtmlToBody(rich.innerHTML);
        added++;

        writeDraft();
        renderPreview();
      } catch (e) {
        failures.push(
          `${files[i].name}: ${errorText(e)}`
        );
      }
    }
  } finally {
    uploadingBodyPhotos = false;
    rich.contentEditable = 'true';

    $('#insertBodyPhoto').disabled = false;
    $('#draft').disabled = false;

    $('#editor')
      .querySelector('button[type="submit"]')
      .disabled = false;

    rich.focus();
  }

  $('#photoStatus').innerHTML = `
    ${added
      ? notice(
          `본문에 사진 ${added}장을 넣었어요. 아래 미리보기에서 확인하세요.`
        )
      : ''}

    ${failures.length
      ? notice(
          `올리지 못한 사진: ${esc(failures.join(' / '))}`,
          true
        )
      : ''}
  `;
}

// 사용하지 않는 대표 사진 삭제
export async function removePhoto(url) {
  const i = url
    ? url.indexOf(PHOTO_DIR)
    : -1;

  if (i < 0) return;

  await db.storage
    .from('article-images')
    .remove([
      decodeURIComponent(
        url.slice(i + PHOTO_DIR.length)
      )
    ]);
}

// 기사 저장
async function save(status) {
  if (uploadingBodyPhotos) {
    $('#msg').innerHTML = notice(
      '사진 업로드가 끝난 뒤 저장해 주세요.',
      true
    );
    return;
  }

  const title = $('#title').value.trim();
  const summary = $('#summary').value.trim();
  const body = editorHtmlToBody($('#richEditor').innerHTML);
  const hasBody = $('#richEditor').innerText.trim().length > 0 || Boolean($('#richEditor img'));
  const author = $('#author').value.trim();
  const category = $('#category').value;

  if (!title || !summary || !hasBody || !author) {
    writeDraft();

    $('#msg').innerHTML = notice(
      status === 'draft'
        ? '아직 빈 칸이 있어 이 기기에만 임시 보관했어요. 서버에 임시 저장하려면 제목, 요약, 기자 이름, 본문을 모두 입력해 주세요.'
        : '제목, 요약, 기자 이름, 본문을 모두 입력해 주세요.',
      status !== 'draft'
    );

    return;
  }

  const buttons =
    $('#editor').querySelectorAll('button');

  buttons.forEach(b => {
    b.disabled = true;
  });

  let uploadedCover = null;
  let articleSaved = false;

  try {
    const current = editId
      ? state.articles.find(a => a.id === editId)
      : null;

    const previousDraftKey = draftKey();

    const cover_url = selectedFile
      ? (uploadedCover = await uploadPhoto(selectedFile))
      : (current?.cover_url ?? lastSavedCover);

    const payload = {
      title,
      summary,
      body,
      author_name: author,
      category,
      cover_url
    };

    if (isAdmin()) {
      payload.status = status;
    }

    const result = editId
      ? await db
          .from('articles')
          .update(payload)
          .eq('id', editId)
          .select('id')
          .single()
      : await db
          .from('articles')
          .insert({
            ...payload,
            status: isAdmin() ? status : 'draft',
            author_id: state.session.user.id
          })
          .select('id')
          .single();

    if (result.error) throw result.error;

    articleSaved = true;
    lastSavedCover = cover_url;
    selectedFile = null;

    if (!editId) {
      editId = result.data.id;

      try {
        localStorage.removeItem(previousDraftKey);
      } catch {
        // 접근 불가
      }
    }

    const wasPending =
      (current?.status ?? 'draft') === 'pending';

    if (
      !isAdmin() &&
      status === 'pending' &&
      !wasPending
    ) {
      const { error } = await db.rpc(
        'submit_article',
        { article_id: result.data.id }
      );

      if (error) throw error;
    }

    await loadArticles();
    dropDraft();

    if (
      uploadedCover &&
      current?.cover_url &&
      current.cover_url !== uploadedCover
    ) {
      try {
        await removePhoto(current.cover_url);
      } catch {
        // 저장 결과에는 영향 없음
      }
    }

    location.hash = '/dashboard';
  } catch (e) {
    if (uploadedCover && !articleSaved) {
      try {
        await removePhoto(uploadedCover);
      } catch {
        // 정리 실패
      }
    }

    $('#msg').innerHTML =
      notice(errorText(e), true);

    writeDraft();
  } finally {
    buttons.forEach(b => {
      b.disabled = false;
    });
  }
}
