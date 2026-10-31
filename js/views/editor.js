// 기사 작성·수정
import { db } from '../supabase.js';
import { $, esc, errorText } from '../utils.js';
import { state, isAdmin, canWrite, isMine, loadArticles } from '../state.js';
import { notice, notFound } from '../ui.js';

// 사진은 긴 변 1600px의 JPG로 줄여 올린다. 다시 그리면서 촬영 위치(GPS) 같은 사진 정보도 지워진다
const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_SIDE = 1600;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_DIR = '/article-images/';

// 쓰는 중인 글은 이 기기(localStorage)에 계속 보관해, 창을 닫거나 로그인이 끊겨도 되살릴 수 있게 한다
const DRAFT_PREFIX = 'saiitda-draft:';
const DRAFT_FIELDS = ['title', 'summary', 'category', 'author', 'body'];

let editId = null;
let selectedFile = null;

const draftKey = () => `${DRAFT_PREFIX}${state.session.user.id}:${editId || 'new'}`;

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftKey()));
  } catch {
    return null;
  }
}

function writeDraft() {
  try {
    const fields = Object.fromEntries(DRAFT_FIELDS.map(f => [f, $('#' + f).value]));
    localStorage.setItem(draftKey(), JSON.stringify({ ...fields, saved: Date.now() }));
  } catch {
    // 저장소를 쓸 수 없는 브라우저(사생활 보호 모드 등)에서는 보관 없이 쓴다
  }
}

function dropDraft() {
  try {
    localStorage.removeItem(draftKey());
  } catch {
    // 위와 같음
  }
}

// 로그아웃할 때 이 사람의 보관 글을 지운다(학교 컴퓨터를 여럿이 쓰므로)
export function clearDrafts() {
  const prefix = `${DRAFT_PREFIX}${state.session?.user?.id}:`;
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    // 위와 같음
  }
}

export function editor(id) {
  if (!canWrite()) {
    location.href = 'login.html';
    return;
  }
  const a = id ? state.articles.find(x => x.id === id) : null;
  if (id && (!a || (!isAdmin() && !isMine(a)))) {
    notFound();
    return;
  }
  editId = id || null;
  selectedFile = null;
  const review =
    a?.status === 'rejected' ? notice(`관리자 수정 요청: ${a.review_note || '내용을 다시 확인해 주세요.'}`, true) : '';
  $('#app').innerHTML = `<div class="page-head">
      <div><h1>${a ? '기사 수정' : '새 기사 작성'}</h1><small>기자실 · 기사 편집</small></div>
      <button class="btn secondary" id="cancel">기자실로</button>
    </div>
    ${review}
    <div id="draftBox"></div>
    <div class="panel"><form id="editor">
      <div class="field">
        <label for="title">기사 제목 *</label>
        <input id="title" maxlength="160" required value="${esc(a?.title || '')}">
      </div>
      <div class="field">
        <label for="summary">기사 요약 *</label>
        <textarea id="summary" maxlength="400" style="min-height:90px" required>${esc(a?.summary || '')}</textarea>
      </div>
      <div class="field">
        <label for="category">카테고리</label>
        <select id="category">${state.categories.map(c => `<option ${c === a?.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="author">기사에 표시할 기자 이름 또는 필명 *</label>
        <input id="author" maxlength="80" required value="${esc(a?.author_name || state.profile?.display_name || '')}">
      </div>
      <div class="field">
        <label for="body">기사 본문 *</label>
        <textarea id="body" required style="min-height:340px" placeholder="취재한 내용을 문단별로 작성해 주세요.">${esc(a?.body || '')}</textarea>
      </div>
      <div class="field">
        <label for="cover">대표 사진 (선택)</label>
        <input type="file" id="cover" accept="${PHOTO_TYPES.join(',')}">
        <span class="filehelp">JPG, PNG, WEBP · 큰 사진은 자동으로 줄여서 올립니다 · 게시 동의가 확인된 사진만 사용하세요.</span>
        ${a?.cover_url ? `<img src="${esc(a.cover_url)}" alt="현재 대표 사진" style="width:220px;max-height:150px;object-fit:cover">` : ''}
      </div>
      <div class="actions">
        <button class="btn secondary" type="button" id="draft">임시 저장</button>
        <button class="btn" type="submit">${isAdmin() ? '승인 요청으로 저장' : '관리자에게 승인 요청'}</button>
      </div>
      <p class="small muted">쓰는 중인 글은 이 기기에 자동으로 보관됩니다. 사진은 보관되지 않습니다.</p>
      <div id="msg"></div>
    </form></div>`;
  $('#cancel').onclick = () => {
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
  offerDraft();
  $('#editor').oninput = writeDraft;
}

// 보관된 글이 지금 내용과 다르면 불러올지 묻는다. 그 사이 새로 쓰면 보관 글은 덮이지만, 고르기 전까지는 여기 남아 있다
function offerDraft() {
  const d = readDraft();
  if (!d || DRAFT_FIELDS.every(f => (d[f] ?? '') === $('#' + f).value)) return;
  const when = new Date(d.saved).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  $('#draftBox').innerHTML = `<div class="notice">저장하지 않은 글이 이 기기에 보관되어 있어요 (${esc(when)}).
    <div class="actions" style="margin-top:8px">
      <button class="btn small" id="restoreDraft">불러오기</button>
      <button class="btn secondary small" id="dropDraft">지우기</button>
    </div>
  </div>`;
  $('#restoreDraft').onclick = () => {
    for (const f of DRAFT_FIELDS) if (typeof d[f] === 'string') $('#' + f).value = d[f];
    writeDraft();
    $('#draftBox').replaceChildren();
  };
  $('#dropDraft').onclick = () => {
    dropDraft();
    $('#draftBox').replaceChildren();
  };
}

// 긴 변을 MAX_PHOTO_SIDE 이하로 줄인 JPG. 투명한 부분은 흰색으로 채운다
async function shrinkPhoto(file) {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('사진을 처리할 수 없습니다.'))), 'image/jpeg', 0.85);
  });
}

// 사진을 Storage(article-images/<내 id>/...)에 올리고 공개 주소를 돌려준다
async function uploadPhoto(file) {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('JPG, PNG, WEBP 사진만 가능합니다.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('사진 파일이 너무 큽니다. 30MB 이하 사진을 골라 주세요.');
  const photo = await shrinkPhoto(file);
  if (photo.size > MAX_PHOTO_BYTES) throw new Error('사진을 5MB 이하로 줄이지 못했습니다. 다른 사진을 골라 주세요.');
  const path = `${state.session.user.id}/${crypto.randomUUID()}.jpg`;
  const bucket = db.storage.from('article-images');
  const { error } = await bucket.upload(path, photo, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}

// 더 쓰지 않는 사진 파일을 Storage에서 지운다. 지우지 못해도(권한 등) 기사에는 영향이 없어 결과는 보지 않는다
export async function removePhoto(url) {
  const i = url ? url.indexOf(PHOTO_DIR) : -1;
  if (i < 0) return;
  await db.storage.from('article-images').remove([decodeURIComponent(url.slice(i + PHOTO_DIR.length))]);
}

async function save(status) {
  const title = $('#title').value.trim();
  const summary = $('#summary').value.trim();
  const body = $('#body').value.trim();
  const author = $('#author').value.trim();
  const category = $('#category').value;
  if (!title || !summary || !body || !author) {
    $('#msg').innerHTML = notice('제목, 요약, 기자 이름, 본문을 모두 입력해 주세요.', true);
    return;
  }
  const buttons = $('#editor').querySelectorAll('button');
  buttons.forEach(b => {
    b.disabled = true;
  });
  try {
    const current = editId ? state.articles.find(a => a.id === editId) : null;
    const cover_url = selectedFile ? await uploadPhoto(selectedFile) : (current?.cover_url ?? null);
    const payload = { title, summary, body, author_name: author, category, cover_url };
    if (isAdmin()) payload.status = status;
    const result = editId
      ? await db.from('articles').update(payload).eq('id', editId).select('id').single()
      : await db
          .from('articles')
          .insert({ ...payload, status: isAdmin() ? status : 'draft', author_id: state.session.user.id })
          .select('id')
          .single();
    if (result.error) throw result.error;
    dropDraft();
    if (selectedFile && current?.cover_url) await removePhoto(current.cover_url);
    // 학생 기자는 상태를 직접 바꿀 수 없어서(DB 트리거) 저장한 뒤 submit_article()로 승인 요청한다
    const wasPending = (current?.status ?? 'draft') === 'pending';
    if (!isAdmin() && status === 'pending' && !wasPending) {
      const { error } = await db.rpc('submit_article', { article_id: result.data.id });
      if (error) throw error;
    }
    await loadArticles();
    location.hash = '/dashboard';
  } catch (e) {
    $('#msg').innerHTML = notice(errorText(e), true);
  } finally {
    buttons.forEach(b => {
      b.disabled = false;
    });
  }
}
