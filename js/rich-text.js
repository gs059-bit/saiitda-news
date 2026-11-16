
import { esc } from './utils.js';

// Rich text uses a deliberately small, escaped markup format; no user HTML is executed.
// Legacy plain-text articles and [[사진:URL]] remain readable.
const IMAGE = /\[\[사진:(https:\/\/[^\]\s|]+)(?:\|([^\]]{0,160}))?\]\]/g;
const COLORS = new Set(['#1b1b1b','#b42318','#1457a3','#087443','#7c3aed','#b45309']);
const SIZES = new Set(['12','14','16','18','20','24','28','32']);
function photo(url, caption = '') {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.supabase.co') ||
        !u.pathname.includes('/storage/v1/object/public/article-images/')) return null;
    return '<figure class="article-photo"><img loading="lazy" alt="기사 본문 사진" src="' +
      esc(url) + '">' + (caption ? '<figcaption>' + esc(caption) + '</figcaption>' : '') + '</figure>';
  } catch { return null; }
}
function inline(text) {
  let x = esc(text);
  x = x.replace(/\[\[크기:(12|14|16|18|20|24|28|32)\]\]([\s\S]*?)\[\[\/크기\]\]/g,
    (_,n,t) => '<span style="font-size:'+n+'px">'+t+'</span>');
  x = x.replace(/\[\[색:((?:#[0-9a-fA-F]{6}))\]\]([\s\S]*?)\[\[\/색\]\]/g,
    (_,n,t) => COLORS.has(n.toLowerCase()) ? '<span style="color:'+n+'">'+t+'</span>' : t);
  x = x.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
  x = x.replace(/__([^_\n]+)__/g,'<u>$1</u>');
  x = x.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
  x = x.replace(/==([^=\n]+)==/g,'<mark>$1</mark>');
  x = x.replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)<"]+)\)/g,
    (_,label,url) => '<a href="'+url+'" target="_blank" rel="noopener noreferrer nofollow">'+label+'</a>');
  return x;
}
export function renderRichBody(body) {
  if(isRichHtml(body))return sanitizeRichHtml(String(body).slice(HTML_PREFIX.length));
  const source=String(body||'');
  const parts=[]; let last=0;
  for(const m of source.matchAll(IMAGE)){
    parts.push({text:source.slice(last,m.index)});
    parts.push({image:photo(m[1],m[2]||'')||esc(m[0])});
    last=m.index+m[0].length;
  }
  parts.push({text:source.slice(last)});
  return parts.map(p=>{
    if(p.image!==undefined)return p.image;
    return p.text.split(/\n/).map(line=>{
      if(/^### /.test(line))return '<h3>'+inline(line.slice(4))+'</h3>';
      if(/^## /.test(line))return '<h2>'+inline(line.slice(3))+'</h2>';
      if(/^> /.test(line))return '<blockquote>'+inline(line.slice(2))+'</blockquote>';
      if(/^[-*] /.test(line))return '<p class="rich-list">• '+inline(line.slice(2))+'</p>';
      if(/^\d+\. /.test(line))return '<p class="rich-list">'+inline(line)+'</p>';
      return inline(line);
    }).join('<br>');
  }).join('');
}
export function countRichCharacters(body){
  return String(body||'').replace(/\[\[사진:[^\]]+\]\]/g,'')
    .replace(/\[\[\/?(?:크기|색):?[^\]]*\]\]/g,'')
    .replace(/\*|_|==|^#{2,3} |^> /gm,'').trim().length;
}

const HTML_PREFIX='<!--saiitda-rich-v1-->';
const SAFE_TAGS=new Set(['P','DIV','BR','STRONG','B','EM','I','U','MARK','H2','H3','BLOCKQUOTE','UL','OL','LI','A','SPAN','FIGURE','IMG','FIGCAPTION']);
const SAFE_COLORS=new Set(['#1b1b1b','#b42318','#1457a3','#087443','#7c3aed','#b45309']);
function safePhotoUrl(url){
  try{const u=new URL(url);return u.protocol==='https:'&&u.hostname.endsWith('.supabase.co')&&u.pathname.includes('/storage/v1/object/public/article-images/');}
  catch{return false;}
}
function cleanNode(node,doc){
  if(node.nodeType===3)return doc.createTextNode(node.textContent);
  if(node.nodeType!==1)return doc.createTextNode('');
  const tag=node.tagName;
  if(!SAFE_TAGS.has(tag)){
    const fragment=doc.createDocumentFragment();
    node.childNodes.forEach(n=>fragment.appendChild(cleanNode(n,doc)));
    return fragment;
  }
  const out=doc.createElement(tag.toLowerCase());
  if(tag==='A'){
    try{const u=new URL(node.getAttribute('href')||'');if(u.protocol==='https:'){out.setAttribute('href',u.href);out.setAttribute('target','_blank');out.setAttribute('rel','noopener noreferrer nofollow');}}
    catch{/* invalid links become text */}
  }
  if(tag==='IMG'){
    const src=node.getAttribute('src')||'';
    if(!safePhotoUrl(src))return doc.createTextNode('');
    out.setAttribute('src',src);out.setAttribute('alt',(node.getAttribute('alt')||'기사 사진').slice(0,160));out.setAttribute('loading','lazy');
  }
  if(tag==='SPAN'){
    const style=node.style;
    const size=parseInt(style.fontSize,10);
    if([12,14,16,18,20,24,28,32].includes(size))out.style.fontSize=size+'px';
    const color=style.color.toLowerCase();
    if(SAFE_COLORS.has(color))out.style.color=color;
    // Browser execCommand may output rgb() colors.
    const rgb={'rgb(27, 27, 27)':'#1b1b1b','rgb(180, 35, 24)':'#b42318','rgb(20, 87, 163)':'#1457a3','rgb(8, 116, 67)':'#087443','rgb(124, 58, 237)':'#7c3aed','rgb(180, 83, 9)':'#b45309'};
    if(rgb[color])out.style.color=rgb[color];
  }
  node.childNodes.forEach(n=>out.appendChild(cleanNode(n,doc)));
  return out;
}
export function sanitizeRichHtml(html){
  const doc=new DOMParser().parseFromString('<main id="rich-root">'+html+'</main>','text/html');
  const root=doc.querySelector('#rich-root'),out=doc.createElement('div');
  [...root.childNodes].forEach(n=>out.appendChild(cleanNode(n,doc)));
  return out.innerHTML;
}
export function isRichHtml(body){return String(body||'').startsWith(HTML_PREFIX);}
export function bodyToEditorHtml(body){
  if(isRichHtml(body))return sanitizeRichHtml(String(body).slice(HTML_PREFIX.length));
  // Existing plain text and photo markers are converted once for editing.
  return renderRichBody(body).replace(/<br>/g,'<br>');
}
export function editorHtmlToBody(html){return HTML_PREFIX+sanitizeRichHtml(html);}
