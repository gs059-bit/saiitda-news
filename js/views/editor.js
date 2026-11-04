
import { db } from '../supabase.js';
import { $, esc, errorText } from '../utils.js';
import { state, isAdmin, canWrite, isMine, loadArticles } from '../state.js';
import { notice, notFound } from '../ui.js';

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
  if ($('#bodyPreview')) {
    $('#bodyPreview').innerHTML =
      renderBody($('#body').value);
  }
}

function rememberCursor() {
  const t = $('#body');
  if (t) bodyCursor = t.selectionStart;
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

          <textarea
            id="body"
            required
            style="min-height:340px"
            placeholder="취재한 내용을 문단별로 작성해 주세요."
          >${esc(a?.body || '')}</textarea>

          <div class="actions" style="margin-top:10px">
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

  const t = $('#body');

  t.addEventListener('click', rememberCursor);
  t.addEventListener('keyup', rememberCursor);
  t.addEventListener('select', rememberCursor);
  t.addEventListener('focus', rememberCursor);

  $('#editor').addEventListener('input', () => {
    rememberCursor();
    writeDraft();
    renderPreview();
  });

  $('#editor').addEventListener('change', writeDraft);

  $('#insertBodyPhoto').onclick = () => {
    rememberCursor();
    $('#bodyPhotos').click();
  };

  $('#bodyPhotos').onchange = async e => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await insertBodyPhotos(files);
  };

  offerDraft(a);
  renderPreview();
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

  const t = $('#body');

  let position = bodyCursor == null
    ? t.value.length
    : Math.min(bodyCursor, t.value.length);

  uploadingBodyPhotos = true;
  writeDraft();

  t.readOnly = true;
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
        const marker = `\n\n[[사진:${url}]]\n\n`;

        t.setRangeText(
          marker,
          position,
          position,
          'end'
        );

        position += marker.length;
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
    t.readOnly = false;

    $('#insertBodyPhoto').disabled = false;
    $('#draft').disabled = false;

    $('#editor')
      .querySelector('button[type="submit"]')
      .disabled = false;

    bodyCursor = position;
    t.focus();
    t.setSelectionRange(position, position);
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
  const body = $('#body').value.trim();
  const author = $('#author').value.trim();
  const category = $('#category').value;

  if (!title || !summary || !body || !author) {
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
