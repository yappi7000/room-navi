(() => {
  'use strict';
  const KEY = 'yappi-room-navi-saved-v1';
  const el = id => document.getElementById(id);
  const config = window.ROOM_NAVI_CONFIG || {};
  const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('ja-JP') : '—';
  const safeUrl = url => { try { const u = new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  let saved = readSaved();
  let page = 1, totalPages = 0, lastKeyword = '', products = [], selected = null, platform = 'room';
  let toastTimer;
  function readSaved() { try { const data = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(data) ? data.filter(x => x && typeof x.itemCode === 'string').slice(0,300) : []; } catch { return []; } }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { notify('ブラウザの保存容量を確認してください'); } el('savedCount').textContent = String(saved.length); }
  function notify(message) { el('toast').textContent = message; el('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el('toast').classList.remove('show'), 2700); }
  function node(tag, className, text) { const x = document.createElement(tag); if (className) x.className = className; if (text !== undefined) x.textContent = String(text); return x; }
  function addText(parent, tag, cls, text) { const n = node(tag, cls, text); parent.appendChild(n); return n; }
  function createCard(item, fromSaved=false) {
    const card = node('article','product');
    const imgUrl = safeUrl(item.imageUrl);
    if (imgUrl) { const img = node('img'); img.src = imgUrl; img.loading = 'lazy'; img.alt = item.name || '商品'; img.referrerPolicy = 'no-referrer'; card.appendChild(img); }
    else addText(card,'div','no-img','📦 画像なし');
    const body = node('div','prod-body'); card.appendChild(body);
    addText(body,'div','prod-category','楽天市場 · 商品情報');
    addText(body,'h3','prod-title', item.name || '商品名なし');
    addText(body,'div','prod-shop',item.shopName || 'ショップ情報なし');
    const price = addText(body,'div','prod-price','¥' + fmt(item.price)); addText(price,'small','','税込表記は商品ページで確認');
    const meta = node('div','prod-meta'); body.appendChild(meta);
    if (Number(item.reviewCount) > 0) addText(meta,'span','',`★ ${item.reviewAverage || '—'}（${fmt(item.reviewCount)}件）`);
    if (Number(item.postageFlag) === 0) addText(meta,'span','','送料込み表示');
    const buttons = node('div','prod-buttons'); body.appendChild(buttons);
    const draft = addText(buttons,'button','','✍ 紹介文を作成'); draft.type='button'; draft.addEventListener('click',()=>openDraft(item));
    const a = addText(buttons,'a','','楽天で確認 ↗'); a.href = safeUrl(item.url) || 'https://www.rakuten.co.jp/'; a.target='_blank'; a.rel='noopener noreferrer sponsored';
    const s = addText(buttons,'button','save', saved.some(x => x.itemCode === item.itemCode) ? '★ 保存済み・解除' : '☆ 商品を保存'); s.type='button';
    s.addEventListener('click',()=>{ const isSaved = saved.some(x=>x.itemCode===item.itemCode); if (isSaved) saved = saved.filter(x=>x.itemCode!==item.itemCode); else saved.unshift(item); saved = saved.slice(0,300); persist(); s.textContent = isSaved ? '☆ 商品を保存' : '★ 保存済み・解除'; if (fromSaved) renderSaved(); notify(isSaved ? '保存を解除しました' : '商品を保存しました'); });
    return card;
  }
  async function search(newSearch = true) {
    const keyword = el('keyword').value.trim();
    if (!keyword) { notify('検索キーワードを入力してください'); return; }
    if (newSearch) page=1;
    lastKeyword=keyword;
    el('searchButton').disabled = true;
    el('searchButton').textContent='検索中…';
    el('status').hidden=false;
    el('status').textContent='楽天市場の商品を検索しています…';
    el('results').replaceChildren();
    el('resultMeta').textContent='読み込み中';
    el('prevPage').disabled=true; el('nextPage').disabled=true;
    try {
      const base=(config.API_BASE || '').replace(/\/$/,'');
      if (!base.startsWith('https://') || base.includes('YOUR-WORKER')) throw new Error('Cloudflare WorkerのURLが未設定です。config.js の API_BASE を編集してください。');
      const params=new URLSearchParams({keyword,sort:el('sort').value,page:String(page),postageFlag:el('freeShipping').checked?'1':'0',hasReviewFlag:el('hasReview').checked?'1':'0'});
      const resp=await fetch(base+'/api/search?'+params, {headers:{Accept:'application/json'},cache:'no-store'});
      const json=await resp.json().catch(()=>({}));
      if (!resp.ok) throw new Error(json.error || '商品情報を取得できませんでした（HTTP '+resp.status+'）');
      products=Array.isArray(json.items)?json.items:[];
      totalPages=Math.min(100, Number(json.pageCount)||0);
      if (!products.length) { el('status').textContent='商品が見つかりませんでした。別のキーワードでお試しください。'; }
      else { el('status').hidden=true; products.forEach(item=>el('results').appendChild(createCard(item))); }
      el('resultMeta').textContent = `${fmt(json.count)}件の候補 · ${fmt(page)}ページ目`;
      el('pageLabel').textContent=`${fmt(page)} / ${fmt(totalPages)}`;
      el('prevPage').disabled=page<=1;
      el('nextPage').disabled=page>=totalPages;
    } catch(e) { el('status').textContent='⚠ '+(e.message||'接続エラー。Workerの設定を確認してください。'); el('resultMeta').textContent='検索できませんでした'; }
    finally { el('searchButton').disabled=false; el('searchButton').textContent='商品を検索 →'; }
  }
  function renderSaved(){ const holder=el('savedResults'); holder.replaceChildren(); el('savedEmpty').hidden=saved.length>0; saved.forEach(item=>holder.appendChild(createCard(item,true))); }
  function linkFor(item){return safeUrl(item.url) || ''}
  function draftText(item,where) {
    const link=linkFor(item);
    const p=Number.isFinite(Number(item.price)) ? `¥${fmt(item.price)}` : '価格は商品ページで確認';
    const title = (item.name||'').trim();
    const shop = (item.shopName||'').trim();
    if (where==='x') {
      const prefix=`PR｜気になるアイテム📱🚗\n${title.slice(0,38)}\n参考価格：${p}\n購入前に仕様・価格を確認👇\n`;
      return prefix+link; // 商品名・価格・URLの長さによっては140字を超えるため投稿前に編集してください。
    }
    if (where==='threads') return `【PR／気になる便利グッズ】\n\n${title}\n\n参考価格：${p}\nショップ：${shop}\n\n商品情報を比較して、使い方や対応機種が自分に合うかチェックしてみてね😊\n\n${link}\n\n#スマホ周辺機器 #カー用品 #楽天市場`;
    return `【PR】📱🚗 便利アイテムをチェック！\n\n${title}\n\n🛍️ ショップ：${shop}\n💰 参考価格：${p}\n\n充電環境やカーライフを見直したい人向けに商品情報をピックアップしました。対応機種・仕様・送料・価格を商品ページで確認してください😊\n\n${link}\n\n#スマホ周辺機器 #便利グッズ #楽天ROOM`;
  }
  function openDraft(item){selected=item;platform='room';el('draftProduct').textContent=item.name;el('draftDialog').querySelectorAll('[data-platform]').forEach(b=>b.classList.toggle('active',b.dataset.platform==='room'));el('draftText').value=draftText(item,platform);el('draftDialog').showModal();}
  function setTab(which) { ['search','saved'].forEach(k=>{el('panel-'+k).classList.toggle('hidden',k!==which);el('tab-'+k).setAttribute('aria-selected',String(k===which));}); if (which==='saved') renderSaved(); }
  el('searchForm').addEventListener('submit',e=>{e.preventDefault();search();});
  document.querySelectorAll('[data-keyword]').forEach(b=>b.addEventListener('click',()=>{el('keyword').value=b.dataset.keyword;setTab('search');search();}));
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  el('prevPage').addEventListener('click',()=>{if(page>1){page--;search(false);window.scrollTo({top:320,behavior:'smooth'});}});
  el('nextPage').addEventListener('click',()=>{if(page<totalPages){page++;search(false);window.scrollTo({top:320,behavior:'smooth'});}});
  el('closeDraft').addEventListener('click',()=>el('draftDialog').close());
  el('draftDialog').querySelectorAll('[data-platform]').forEach(b=>b.addEventListener('click',()=>{platform=b.dataset.platform;el('draftDialog').querySelectorAll('[data-platform]').forEach(x=>x.classList.toggle('active',x===b));if(selected) el('draftText').value=draftText(selected,platform);}));
  el('copyDraft').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(el('draftText').value);notify('投稿文をコピーしました');}catch{el('draftText').focus();el('draftText').select();notify('文章を選択しました。⌘C でコピーしてください');}});
  el('openProduct').addEventListener('click',()=>{if(selected&&linkFor(selected)) window.open(linkFor(selected),'_blank','noopener,noreferrer');});
  el('exportSaved').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),items:saved},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='room-navi-saved.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
  el('importSaved').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw new Error('ファイルが大きすぎます');const data=JSON.parse(await file.text());if(!Array.isArray(data.items))throw new Error('保存形式が違います');saved=data.items.filter(item=>item && typeof item.itemCode==='string' && typeof item.name==='string').slice(0,300);persist();renderSaved();notify('保存データを読み込みました');}catch(err){notify('読込失敗：'+err.message);}e.target.value='';});
  persist();
})();
