
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
