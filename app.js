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

  // v3: 投稿支援はローカルのルールベース。外部AIに商品情報は送信しません。
  // 商品名の表記と価格はショップが変えられるため、仕様・クーポンの確認を促します。
  const HOOK_KINDS = [
    ['risk','⚠️ 失敗回避'],['value','💰 損しない'],['switch','💡 常識転換'],
    ['surprise','😮 意外性'],['empathy','😊 共感']
  ];
  let hookKind='risk';
  let manualHook='';
  function productBrief(item) {
    const raw=String(item.name||'').normalize('NFKC');
    const isCar=/車載|車内|車用|カー用品|シガーソケット|ドライブレコーダー|洗車|車中泊|車用充電|カーチャージャー/i.test(raw);
    let category='便利グッズ';
    if (/モバイルバッテリー|モバ充|充電宝/.test(raw)) category='モバイルバッテリー';
    else if (/スマホホルダー|スマートフォンホルダー|車載ホルダー/.test(raw)) category=isCar?'車載スマホホルダー':'スマホホルダー';
    else if (/充電器|チャージャー|ACアダプタ/.test(raw)) category=isCar?'車載充電器':'充電器';
    else if (/USB.C|Type.C|ライトニング|ケーブル/.test(raw)) category='充電ケーブル';
    else if (/ケース|カバー/.test(raw)) category='スマホケース';
    else if (/洗車|クリーナー|掃除/.test(raw)) category=isCar?'車内・洗車用品':'お掃除グッズ';
    else if (/スタンド|タブレット台/.test(raw)) category=isCar?'車載スタンド':'スマホスタンド';
    const cap=raw.match(/\b(\d[\d,]{3,6})\s*mAh\b/i);
    const capNum=cap ? Number(cap[1].replace(/,/g,'')) : null;
    const capacity=capNum>=1000 && capNum<=99999 && /バッテリー/.test(category) ? `${capNum.toLocaleString('ja-JP')}mAh` : '';
    const magnetic=/マグネット|MagSafe/i.test(raw) && /バッテリー|充電器|ホルダー/.test(category);
    const hasCoupon=/クーポン|coupon|割引|半額|OFF|セール|ポイント\s*\d+\s*倍/i.test(raw);
    const label = [category,capacity,magnetic?'（マグネット式と記載）':''].filter(Boolean).join(' ').slice(0,55);
    const focus = /モバイルバッテリー/.test(category) ? '対応機種・出力・重さ・安全表示' :
      /ホルダー|スタンド/.test(category) ? (isCar?'設置場所・固定方法・視界への影響':'対応サイズ・固定方法・設置場所') :
      /充電器/.test(category) ? '充電規格・最大出力・対応機種' :
      /ケーブル/.test(category) ? '端子形状・充電規格・長さ' :
      /ケース/.test(category) ? '対応機種・本体サイズ・装着方法' :
      isCar?'車種・設置方法・サイズ':'対応機種・サイズ・仕様';
    const firstCheck=focus.split('・')[0];
    const shortCat=isCar ? category.replace(/^車載/,'車載') : category;
    return {raw,label,category,shortCat,capacity,magnetic,hasCoupon,isCar,focus,firstCheck};
  }
  function hookOptions(item) {
    const b=productBrief(item), c=b.shortCat;
    const capacityCue=b.capacity && /モバイルバッテリー/.test(b.category);
    const messages={
      risk:capacityCue?'モバイルバッテリー、容量だけで選んでない？':`${c}、買う前に確認したいこと。`,
      value:`${c}、安さだけで決めていない？`,
      switch:capacityCue?'モバイルバッテリーは、出力や重さも見て選びたい。':`${c}は、${b.firstCheck}も見て選びたい。`,
      surprise:`意外と見落とす、${c}のチェックポイント。`,
      empathy:`${c}、何を基準に選べばいいか迷わない？`
    };
    return messages;
  }
  function money(item) {return Number(item.price)>0?'¥'+fmt(item.price):'商品ページで確認';}
  function caution(item) {const b=productBrief(item);return b.hasCoupon?'※商品名に割引・クーポン表記あり。適用条件と支払額は未確認。':'※価格・仕様・送料は購入前に確認。';}
  function draftText(item, where, givenHook) {
    const b=productBrief(item), link=linkFor(item);
    const hook=String(givenHook || hookOptions(item)[hookKind] || '').trim();
    const shop=String(item.shopName||'').trim();
    const price=money(item), note=caution(item);
    const linkLine=link?'\n'+link:'\n（商品リンクを確認）';
    const lead=hook || `${b.category}、選ぶ前に確認したいこと。`;
    if (where==='x') {
      const candidates=[
        `${lead}\n【PR】${b.label}｜表示${price}\n${b.focus}を確認👇${linkLine}`,
        `${lead}\n【PR】${b.category}｜表示${price}\n購入前に仕様を確認👇${linkLine}`,
        `${lead}\n【PR】表示${price}\n詳細・条件を確認👇${linkLine}`
      ];
      return candidates.find(x=>xWeightedLength(x)<=280) || candidates[candidates.length-1];
    }
    if (where==='threads') {
      return `${lead}\n\n【PR】楽天で見つけた「${b.label}」。\n\n気になるのは、${b.focus}。\n表示価格：${price}${shop?'\n販売店：'+shop:''}\n\n商品名の売り文句だけで決めず、条件まで確認したいね😊\n${note}${linkLine}\n\n${b.isCar?'#カー用品 #車内グッズ':'#スマホ周辺機器 #便利グッズ'}`;
    }
    return `${lead}\n\n【PR】${b.isCar?'🚗':'📱'} ${b.label}\n🏪 ${shop||'販売店は商品ページで確認'}\n💰 楽天表示価格：${price}\n\n購入前の確認ポイント：${b.focus}。\n${note}${linkLine}\n\n${b.isCar?'#カー用品 #楽天ROOM':'#スマホ周辺機器 #楽天ROOM'}`;
  }
  function xWeightedLength(text) {
    // XはURLを短縮するため、概算23文字として計算。最終的にはXの投稿画面でも確認してください。
    const urls=String(text||'').match(/https?:\/\/\S+/g)||[];
    let other=String(text||'').replace(/https?:\/\/\S+/g,'');
    let weight=urls.length*23;
    for(const ch of other){weight+= /[\u0000-\u007f\u00a0-\u024f]/u.test(ch)?1:2;}
    return weight;
  }
  function installV3UI(){
    if(document.getElementById('v3Hooks')) return;
    const sheet=document.createElement('style');
    sheet.textContent=`
      #draftDialog{width:min(94vw,780px);max-width:780px;max-height:91vh;overflow:auto}
      .v3-box{margin:16px 0;padding:15px;border-radius:14px;background:#122b3b;border:1px solid #326078}
      .v3-label{font-size:13px;font-weight:800;color:#d8f4fa;margin:0 0 8px}
      .v3-note{font-size:11px;line-height:1.65;color:#a9c0d0;margin:6px 0 0}
      .v3-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      .v3-choice{white-space:normal;text-align:left;min-height:76px;border:1px solid #355768;border-radius:10px;background:#0b2030;color:#d7e9f4;padding:10px 11px}
      .v3-choice span{display:block;font-size:12px;font-weight:750;color:#6fe1eb;margin-bottom:4px}
      .v3-choice small{display:block;font-size:11px;line-height:1.5;color:#c8dae2}
      .v3-choice[aria-pressed=true]{border:2px solid #60e4ed;background:#153c50;box-shadow:inset 0 0 0 1px #2d99a6}
      .v3-choice:focus-visible,#v3CustomHook:focus-visible{outline:2px solid #7ff7ff;outline-offset:3px}
      .v3-facts{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}
      .v3-fact{font-size:11px;padding:5px 8px;border-radius:30px;background:#183a49;color:#dcf1f5}
      .v3-alert{font-size:12px;color:#f7d3a1;background:#3b3026;padding:8px 10px;border-radius:8px;margin-top:9px;line-height:1.6}
      #v3CustomHook{box-sizing:border-box;width:100%;margin:5px 0 0;background:#081b2a;color:#eff9ff;border:1px solid #477083;border-radius:9px;padding:10px;font-size:14px}
      .v3-meta{margin-top:7px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:11px;color:#a9c4d1}
      .v3-meta .warn{color:#ffcb9b;font-weight:750}
      .v3-h2{font-size:14px;font-weight:750;margin-bottom:4px;color:#d3f0f8}
      #draftDialog .draft-tabs{margin-top:14px}
      @media(max-width:550px){.v3-grid{grid-template-columns:1fr}.v3-choice{min-height:55px}#draftDialog{max-width:96vw}}
    `;
    document.head.appendChild(sheet);
    const box=document.createElement('section');box.id='v3Hooks';box.className='v3-box';
    const hdr=addText(box,'div','v3-h2','🎯 5種類の冒頭フックを選ぶ');
    addText(box,'p','v3-note','商品の情報をもとにした文章テンプレートです。外部AIは未接続。フック選択後も文章を自由に編集できます。');
    const grid=node('div','v3-grid');grid.id='v3HookGrid';grid.setAttribute('role','group');grid.setAttribute('aria-label','フックの種類');box.appendChild(grid);
    const customLabel=node('label','v3-label','✍ 冒頭の1行を自由に編集');customLabel.setAttribute('for','v3CustomHook');customLabel.style.display='block';customLabel.style.marginTop='14px';box.appendChild(customLabel);
    const input=node('input');input.id='v3CustomHook';input.type='text';input.maxLength=110;input.placeholder='選択したフックをここで調整';box.appendChild(input);
    addText(box,'p','v3-note','冒頭を変更すると投稿文へ反映します。本文の手動編集は最後に行うのがおすすめ。');
    const facts=node('div','v3-facts');facts.id='v3Facts';box.appendChild(facts);
    const safety=node('div','v3-alert');safety.id='v3Safety';safety.setAttribute('role','note');box.appendChild(safety);
    el('draftDialog').insertBefore(box,el('draftText').previousElementSibling);
    const meta=node('div','v3-meta');meta.id='v3Meta';meta.setAttribute('role','status');
    el('draftText').insertAdjacentElement('afterend',meta);
    input.addEventListener('input',()=>{manualHook=input.value.trim();if(selected) updateDraft();});
    el('draftText').addEventListener('input',updateDraftCounter);
    el('draftTitle').textContent='投稿文作成 v3｜フック選択';
    const footer=el('draftDialog').querySelector('.dialog-foot small');
    if(footer) footer.textContent='文章は自動生成の下書きです。クーポン・対応機種・安全性は公式の商品情報と照合してください。';
  }
  function renderV3Suggestions(){
    if(!selected)return;
    const grid=el('v3HookGrid');grid.replaceChildren();
    const options=hookOptions(selected);
    for(const [kind,label] of HOOK_KINDS){
      const b=node('button','v3-choice');b.type='button';b.dataset.hook=kind;b.setAttribute('aria-pressed',String(kind===hookKind));
      addText(b,'span','',label);addText(b,'small','',options[kind]);
      b.addEventListener('click',()=>{hookKind=kind;manualHook=options[kind];el('v3CustomHook').value=manualHook;renderV3Suggestions();updateDraft();});grid.appendChild(b);
    }
    const b=productBrief(selected);
    const facts=el('v3Facts');facts.replaceChildren();
    const tags=[`分類：${b.category}`,`楽天表示価格：${money(selected)}`];
    if(b.capacity)tags.push(`商品名に${b.capacity}と記載`);
    if(b.magnetic)tags.push('商品名にマグネット式の記載');
    tags.push(`確認点：${b.focus}`);
    for(const tag of tags) addText(facts,'span','v3-fact',tag);
    el('v3Safety').textContent=b.hasCoupon?'⚠️ 商品名にクーポン・値引きの表記があります。適用条件・実際の支払額は未確認。数字を断定する投稿は避けましょう。':'⚠️ 商品タイトルは販売店の表現です。出力・対応機種・安全性・実売価格は商品ページで確認してください。';
  }
  function updateDraftCounter(){
    const text=el('draftText').value;
    const count=[...text].length;
    const label=platform==='x'?`𝕏 文字数目安：${xWeightedLength(text)} / 280（URL短縮換算・概算）`:`${platform==='room'?'ROOM':'Threads'}：${count}文字`;
    const warn=platform==='x'&&xWeightedLength(text)>280;
    const meta=el('v3Meta');meta.replaceChildren();
    addText(meta,'span',warn?'warn':'',warn?'⚠️ 長すぎる可能性があります。X投稿画面で確認してください。':label);
    addText(meta,'span','','【PR】表示・リンク・価格を投稿前に確認');
  }
  function updateDraft(){
    if(!selected)return;
    const hook=manualHook||hookOptions(selected)[hookKind];
    el('draftText').value=draftText(selected,platform,hook);
    updateDraftCounter();
  }
  function openDraft(item){
    selected=item;platform='room';hookKind='risk';
    installV3UI();manualHook=hookOptions(item)[hookKind];el('v3CustomHook').value=manualHook;
    el('draftProduct').textContent=item.name;
    el('draftDialog').querySelectorAll('[data-platform]').forEach(b=>b.classList.toggle('active',b.dataset.platform==='room'));
    renderV3Suggestions();updateDraft();el('draftDialog').showModal();
  }
  function setTab(which) { ['search','saved'].forEach(k=>{el('panel-'+k).classList.toggle('hidden',k!==which);el('tab-'+k).setAttribute('aria-selected',String(k===which));}); if (which==='saved') renderSaved(); }
  el('searchForm').addEventListener('submit',e=>{e.preventDefault();search();});
  document.querySelectorAll('[data-keyword]').forEach(b=>b.addEventListener('click',()=>{el('keyword').value=b.dataset.keyword;setTab('search');search();}));
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  el('prevPage').addEventListener('click',()=>{if(page>1){page--;search(false);window.scrollTo({top:320,behavior:'smooth'});}});
  el('nextPage').addEventListener('click',()=>{if(page<totalPages){page++;search(false);window.scrollTo({top:320,behavior:'smooth'});}});
  el('closeDraft').addEventListener('click',()=>el('draftDialog').close());
  el('draftDialog').querySelectorAll('[data-platform]').forEach(b=>b.addEventListener('click',()=>{platform=b.dataset.platform;el('draftDialog').querySelectorAll('[data-platform]').forEach(x=>x.classList.toggle('active',x===b));updateDraft();}));
  el('copyDraft').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(el('draftText').value);notify('投稿文をコピーしました');}catch{el('draftText').focus();el('draftText').select();notify('文章を選択しました。⌘C でコピーしてください');}});
  el('openProduct').addEventListener('click',()=>{if(selected&&linkFor(selected)) window.open(linkFor(selected),'_blank','noopener,noreferrer');});
  el('exportSaved').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),items:saved},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='room-navi-saved.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
  el('importSaved').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw new Error('ファイルが大きすぎます');const data=JSON.parse(await file.text());if(!Array.isArray(data.items))throw new Error('保存形式が違います');saved=data.items.filter(item=>item && typeof item.itemCode==='string' && typeof item.name==='string').slice(0,300);persist();renderSaved();notify('保存データを読み込みました');}catch(err){notify('読込失敗：'+err.message);}e.target.value='';});
  persist();
})();
