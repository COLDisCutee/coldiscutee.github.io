/* Short++ completion: an inline word popup, plus a Shift+Enter palette of parameterized templates. */

/* ---------- built-in C++ templates ---------- */
// {{name}} is a parameter, {{name:value}} also sets its default, and $0 is where the caret lands.
const BUILTIN_TEMPLATES=[
{id:'b-main',name:'main skeleton',desc:'bits/stdc++.h와 main 한 벌',body:'#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n\t$0\n}'},
{id:'b-fast',name:'fast I/O',desc:'입력이 많을 때만 쓴다. 숏코딩에서는 보통 뺀다.',body:'ios::sync_with_stdio(0);cin.tie(0);$0'},
{id:'b-tc',name:'test case loop',desc:'테스트케이스 수를 읽고 그만큼 반복한다.',body:'int {{t:t}};cin>>{{t}};\nwhile({{t}}--){\n\t$0\n}'},
{id:'b-readn',name:'read n numbers into an array',desc:'개수를 읽고 배열에 담는다.',body:'int {{n:n}};cin>>{{n}};\nint {{a:a}}[{{n}}];\nfor(int i=0;i<{{n}};i++)cin>>{{a}}[i];\n$0'},
{id:'b-readv',name:'read n numbers into a vector',desc:'크기를 정해 두고 범위 for로 채운다.',body:'int {{n:n}};cin>>{{n}};\nvector<int> {{v:v}}({{n}});\nfor(auto&x:{{v}})cin>>x;\n$0'},
{id:'b-readline',name:'read a whole line',desc:'공백이 섞인 한 줄을 통째로 읽는다.',body:'string {{s:s}};getline(cin,{{s}});$0'},
{id:'b-eof',name:'read until EOF',desc:'입력이 끝날 때까지 읽는다.',body:'int {{x:a}},{{y:b}};\nwhile(cin>>{{x}}>>{{y}}){\n\t$0\n}'},
{id:'b-grid',name:'read a 2D grid',desc:'행과 열을 읽고 격자를 채운다.',body:'int {{r:r}},{{c:c}};cin>>{{r}}>>{{c}};\nint {{g:g}}[{{r}}][{{c}}];\nfor(int i=0;i<{{r}};i++)for(int j=0;j<{{c}};j++)cin>>{{g}}[i][j];\n$0'},
{id:'b-for',name:'for loop',desc:'기본 반복문.',body:'for(int {{i:i}}=0;{{i}}<{{n:n}};{{i}}++){\n\t$0\n}'},
{id:'b-each',name:'range for',desc:'컨테이너를 훑는다. 참조로 받으면 값을 바꿀 수 있다.',body:'for(auto&{{x:x}}:{{v:v}}){\n\t$0\n}'},
{id:'b-print',name:'print a container',desc:'공백으로 이어서 한 줄에 출력한다.',body:'for(auto x:{{v:v}})cout<<x<<" ";\ncout<<"\\n";$0'},
{id:'b-sort',name:'sort',desc:'begin, end 대신 begin(v), end(v)를 쓰면 조금 짧다.',body:'sort(begin({{v:v}}),end({{v:v}}));$0'},
{id:'b-sortcmp',name:'sort with a comparator',desc:'람다로 정렬 기준을 준다.',body:'sort(begin({{v:v}}),end({{v}}),[](auto&a,auto&b){return {{cmp:a>b}};});$0'},
{id:'b-uniq',name:'sort and dedupe',desc:'정렬한 뒤 중복을 지우는 관용구.',body:'sort(begin({{v:v}}),end({{v}}));\n{{v}}.erase(unique(begin({{v}}),end({{v}})),end({{v}}));$0'},
{id:'b-sum',name:'sum a container',desc:'0LL로 시작하면 long long으로 더한다.',body:'long long {{s:s}}=accumulate(begin({{v:v}}),end({{v}}),0LL);$0'},
{id:'b-lb',name:'binary search',desc:'정렬된 컨테이너에서 위치를 찾는다.',body:'int {{i:i}}=lower_bound(begin({{v:v}}),end({{v}}),{{x:x}})-begin({{v}});$0'},
{id:'b-yesno',name:'Yes / No output',desc:'조건에 따라 두 문자열 중 하나를 출력한다.',body:'puts({{cond:a==b}}?"{{yes:Yes}}":"{{no:No}}");$0'},
{id:'b-prefix',name:'prefix sums',desc:'구간 합을 O(1)로 구하려고 미리 누적해 둔다.',body:'vector<long long> {{p:p}}({{n:n}}+1);\nfor(int i=0;i<{{n}};i++){{p}}[i+1]={{p}}[i]+{{a:a}}[i];\n$0'},
{id:'b-graph',name:'adjacency list',desc:'무방향 그래프의 간선을 읽는다.',body:'int {{n:n}},{{m:m}};cin>>{{n}}>>{{m}};\nvector<int> {{g:g}}[{{n}}+1];\nfor(int i=0;i<{{m}};i++){int a,b;cin>>a>>b;{{g}}[a].push_back(b);{{g}}[b].push_back(a);}\n$0'},
{id:'b-bfs',name:'BFS',desc:'인접 리스트를 너비 우선으로 훑는다.',body:'vector<int> {{d:d}}({{n:n}}+1,-1);\nqueue<int> q;q.push({{s:1}});{{d}}[{{s}}]=0;\nwhile(q.size()){\n\tint u=q.front();q.pop();\n\tfor(int v:{{g:g}}[u])if({{d}}[v]<0){{{d}}[v]={{d}}[u]+1;q.push(v);}\n}\n$0'},
{id:'b-dfs',name:'recursive DFS',desc:'방문 배열을 두고 재귀로 훑는다.',body:'vector<int> {{vis:vis}}({{n:n}}+1);\nfunction<void(int)> {{dfs:dfs}}=[&](int u){\n\t{{vis}}[u]=1;\n\tfor(int v:{{g:g}}[u])if(!{{vis}}[v]){{dfs}}(v);\n};\n{{dfs}}({{s:1}});$0'},
{id:'b-sieve',name:'sieve of Eratosthenes',desc:'소수를 미리 걸러 둔다.',body:'vector<int> {{p:p}}({{n:n}}+1,1);\nfor(int i=2;i*i<={{n}};i++)if({{p}}[i])for(int j=i*i;j<={{n}};j+=i){{p}}[j]=0;\n$0'},
{id:'b-golf',name:'golf skeleton',desc:'가장 짧은 뼈대. GCC에서만 컴파일된다.',body:'#import<bits/stdc++.h>\nint main(){$0}'},
];

/* ---------- template storage ---------- */
const tplParams=body=>{
  const seen=new Map();
  String(body).replace(/\{\{([A-Za-z_]\w*)(?::([^{}]*))?\}\}/g,(_,n,d)=>{
    if(!seen.has(n)||(d!=null&&!seen.get(n)))seen.set(n,d==null?'':d);
    return '';
  });
  return [...seen].map(([name,def])=>({name,def}));
};
const fillTemplate=(body,vals)=>String(body).replace(/\{\{([A-Za-z_]\w*)(?::[^{}]*)?\}\}/g,(m,n)=>(vals&&vals[n]!=null&&vals[n]!==''?vals[n]:n));
const userTemplates=()=>Array.isArray(lib.templates)?lib.templates:(lib.templates=[]);
const allTemplates=()=>[...userTemplates(),...BUILTIN_TEMPLATES];
const tplById=id=>allTemplates().find(t=>t.id===id);

/* ---------- word list ---------- */
const CPP_WORDS=[...new Set([...KW,...TY,...STDN.split('|'),
 'printf','scanf','puts','putchar','getchar','memset','abs','swap','begin','end','size','push_back','emplace_back','pop_back','substr','length','back','front','insert','erase','count','find','first','second','make_pair','INT_MAX','INT_MIN','LLONG_MAX','LLONG_MIN','sync_with_stdio','tie','sqrt','pow','floor','ceil','round','accumulate','iota','function','array','tuple','unordered_map','unordered_set','priority_queue','long long','endl'])];
const wordsFor=lang=>lang==='py'?PY.words:CPP_WORDS;
// Identifiers already in the file, so a name you invented completes too.
function bufferWords(prefix){
  const out=new Set(),re=/[A-Za-z_]\w{1,}/g,v=src.value;
  let m,n=0;
  while((m=re.exec(v))&&n<4000){n++;if(m[0].length>prefix.length&&m[0].toLowerCase().startsWith(prefix))out.add(m[0])}
  return out;
}
function completionsFor(prefix){
  const p=prefix.toLowerCase(),seen=new Set(),hits=[];
  // Identifiers dedupe against each other; a template with the same name still gets its own row.
  const add=(text,kind,extra)=>{const k=(kind==='snippet'?'s:':'w:')+text;if(seen.has(k)||text===prefix)return;seen.add(k);hits.push({text,kind,...extra})};
  if(state.lang==='cpp')for(const t of allTemplates()){
    const n=t.name.toLowerCase();
    if(n.startsWith(p)||n.split(/\s+/).some(w=>w.startsWith(p)))add(t.name,'snippet',{tpl:t});
  }
  for(const w of wordsFor(state.lang))if(w.toLowerCase().startsWith(p))add(w,'word');
  for(const w of bufferWords(p))add(w,'local');
  // What you typed literally comes first; templates sit below the identifiers.
  const KR={word:0,local:1,snippet:2};
  const rank=h=>(h.text.toLowerCase().startsWith(p)?0:1)*100+KR[h.kind]*10+Math.min(h.text.length,9);
  return hits.sort((a,b)=>rank(a)-rank(b)||a.text.localeCompare(b.text)).slice(0,8);
}

/* ---------- inserting ---------- */
// Goes through execCommand so the edit lands in the normal undo history.
function replaceRange(start,end,text,caretOffset){
  src.focus();
  src.setSelectionRange(start,end);
  let ok=false;
  try{ok=document.execCommand('insertText',false,text)}catch(e){}
  if(!ok){src.setRangeText(text,start,end,'end');src.dispatchEvent(new Event('input',{bubbles:true}))}
  const at=start+(caretOffset==null?text.length:caretOffset);
  src.setSelectionRange(at,at);
  histLast=editState();histKind='';histAt=0;
  caret();scrollCaretIntoView();
}
const lineIndent=pos=>{const ls=src.value.lastIndexOf('\n',pos-1)+1;return (src.value.slice(ls,pos).match(/^[ \t]*/)||[''])[0]};
function insertTemplate(tpl,vals){
  const s=src.selectionStart,e=src.selectionEnd;
  let body=fillTemplate(tpl.body,vals);
  const ind=lineIndent(s);
  if(ind)body=body.split('\n').map((l,i)=>i?ind+l:l).join('\n');
  const at=body.indexOf('$0');
  const text=at<0?body:body.slice(0,at)+body.slice(at+2);
  replaceRange(s,e,text,at<0?null:at);
}

/* ---------- inline popup ---------- */
const acEl=document.createElement('div');
acEl.className='ac';acEl.id='ac';acEl.hidden=true;acEl.setAttribute('role','listbox');
document.body.append(acEl);
const ac={open:false,items:[],idx:0,start:0,end:0};
const KIND={snippet:'template',word:'std',local:'in file'};
function acHide(){if(!ac.open)return;ac.open=false;acEl.hidden=true;acEl.innerHTML=''}
function acRender(){
  acEl.innerHTML=ac.items.map((h,i)=>`<div class="ac-i${i===ac.idx?' on':''}" role="option" aria-selected="${i===ac.idx}" data-i="${i}"><span class="ac-t">${esc(h.text)}</span><span class="ac-k">${KIND[h.kind]}</span></div>`).join('');
  const r=caretRect(hlEntries(),ac.start);if(!r)return acHide();
  acEl.hidden=false;
  const h=acEl.offsetHeight,w=acEl.offsetWidth,lh=lineH();
  const below=r.bottom+h+8<innerHeight;
  acEl.style.top=(below?r.bottom+4:r.top-h-4)+'px';
  acEl.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
  const on=acEl.querySelector('.on');if(on)on.scrollIntoView({block:'nearest'});
}
function acShow(){
  if(composing||src.selectionStart!==src.selectionEnd)return acHide();
  const p=src.selectionStart,v=src.value;
  let s=p;while(s>0&&/\w/.test(v[s-1]))s--;
  const prefix=v.slice(s,p);
  if(!/^[A-Za-z_]\w{1,}$/.test(prefix))return acHide();
  const items=completionsFor(prefix);
  if(!items.length)return acHide();
  Object.assign(ac,{open:true,items,idx:0,start:s,end:p});
  acRender();
}
function acAccept(){
  const h=ac.items[ac.idx];if(!h)return false;
  const {start,end}=ac;
  acHide();
  if(h.kind==='snippet'){
    src.setSelectionRange(start,end);
    const params=tplParams(h.tpl.body);
    if(params.length)openPalette(h.tpl.id);
    else insertTemplate(h.tpl,{});
    return true;
  }
  replaceRange(start,end,h.text);
  return true;
}
function acMove(d){if(!ac.open)return false;ac.idx=(ac.idx+d+ac.items.length)%ac.items.length;acRender();return true}
acEl.addEventListener('mousedown',e=>{const it=e.target.closest('.ac-i');if(!it)return;e.preventDefault();ac.idx=+it.dataset.i;acAccept()});

/* ---------- template palette ---------- */
const pal=document.createElement('div');
pal.className='ovl';pal.id='pal';pal.hidden=true;
pal.innerHTML=`<div class="dlg" role="dialog" aria-modal="true" aria-label="Templates">
  <div class="dlg-h"><input id="pal-q" class="dlg-q" placeholder="Search templates" spellcheck="false" data-arrows="dispatch" aria-label="Search templates"><button class="tbtn" id="pal-new">New</button><button class="tbtn" id="pal-close">Close</button></div>
  <div class="dlg-b">
    <div class="pal-list" id="pal-list" role="listbox" aria-label="Templates"></div>
    <div class="pal-side">
      <div class="pal-args" id="pal-args"></div>
      <pre class="pal-pv" id="pal-pv"></pre>
      <div class="pal-foot"><span class="dim" id="pal-hint">Enter inserts · Tab moves to the fields · Esc closes</span><span class="pal-acts" id="pal-acts"></span></div>
    </div>
  </div>
</div>`;
document.body.append(pal);
const palState={q:'',list:[],idx:0,vals:{},id:null};
const palQ=$('#pal-q');
function palFilter(){
  const q=palState.q.trim().toLowerCase();
  const all=allTemplates();
  palState.list=q?all.filter(t=>(t.name+' '+(t.desc||'')+' '+t.body).toLowerCase().includes(q)):all;
  if(palState.idx>=palState.list.length)palState.idx=0;
}
function palCurrent(){return palState.list[palState.idx]}
function palRenderList(){
  const L=$('#pal-list');
  L.innerHTML=palState.list.length?palState.list.map((t,i)=>`<div class="pal-i${i===palState.idx?' on':''}" role="option" aria-selected="${i===palState.idx}" data-i="${i}"><span class="pal-n">${esc(t.name)}${t.user?'<em>mine</em>':''}</span>${t.desc?`<span class="pal-d" lang="ko">${esc(t.desc)}</span>`:''}</div>`).join(''):'<p class="ex-empty">No template matches.</p>';
  const on=L.querySelector('.on');if(on)on.scrollIntoView({block:'nearest'});
}
function palRenderSide(){
  const t=palCurrent(),A=$('#pal-args'),P=$('#pal-pv'),acts=$('#pal-acts');
  if(!t){A.innerHTML='';P.textContent='';acts.innerHTML='';return}
  const params=tplParams(t.body);
  if(t.id!==palState.id){palState.id=t.id;palState.vals={};params.forEach(p=>palState.vals[p.name]=p.def||p.name)}
  A.innerHTML=params.length?params.map(p=>`<label class="arg"><span>${esc(p.name)}</span><input data-p="${esc(p.name)}" value="${esc(palState.vals[p.name]??'')}" spellcheck="false" data-arrows="dispatch"></label>`).join(''):'<p class="dim">No parameters.</p>';
  P.textContent=fillTemplate(t.body,palState.vals).replace('$0','');
  acts.innerHTML=t.user?'<button class="tbtn" data-a="edit">Edit</button><button class="tbtn danger" data-a="del">Delete</button>':'<button class="tbtn" data-a="copy">Duplicate as mine</button>';
}
function palRender(){palFilter();palRenderList();palRenderSide()}
function openPalette(selectId){
  palState.q='';palQ.value='';palState.idx=0;palState.id=null;
  palFilter();
  if(selectId){const i=palState.list.findIndex(t=>t.id===selectId);if(i>=0)palState.idx=i}
  pal.hidden=false;palRender();palQ.focus();palQ.select();
}
function closePalette(){if(pal.hidden)return;pal.hidden=true;src.focus()}
function palInsert(){
  const t=palCurrent();if(!t)return;
  closePalette();
  insertTemplate(t,palState.vals);
  toast(`Inserted ${t.name}`);
}
palQ.addEventListener('input',()=>{palState.q=palQ.value;palState.idx=0;palState.id=null;palRender()});
$('#pal-close').onclick=closePalette;
$('#pal-new').onclick=()=>openEditor(null);
$('#pal-list').addEventListener('click',e=>{const it=e.target.closest('.pal-i');if(!it)return;palState.idx=+it.dataset.i;palRenderList();palRenderSide()});
$('#pal-list').addEventListener('dblclick',e=>{if(e.target.closest('.pal-i'))palInsert()});
$('#pal-args').addEventListener('input',e=>{const k=e.target.dataset.p;if(!k)return;palState.vals[k]=e.target.value;$('#pal-pv').textContent=fillTemplate(palCurrent().body,palState.vals).replace('$0','')});
$('#pal-acts').addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const t=palCurrent();if(!t)return;
  if(b.dataset.a==='edit')openEditor(t);
  else if(b.dataset.a==='copy')openEditor({...t,id:null,name:t.name+' copy'});
  else if(b.dataset.a==='del'){
    lib.templates=userTemplates().filter(x=>x.id!==t.id);
    palState.id=null;palState.idx=Math.max(0,palState.idx-1);palRender();persist();toast('Template deleted');
  }
});
pal.addEventListener('mousedown',e=>{if(e.target===pal)closePalette()});
pal.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();closePalette();return}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    const n=palState.list.length;if(!n)return;
    palState.idx=(palState.idx+(e.key==='ArrowDown'?1:-1)+n)%n;
    palRenderList();palRenderSide();return;
  }
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();palInsert()}
});

/* ---------- template editor ---------- */
const ed=document.createElement('div');
ed.className='ovl';ed.id='tpl-ed';ed.hidden=true;
ed.innerHTML=`<div class="dlg dlg-sm" role="dialog" aria-modal="true" aria-label="Edit template">
  <div class="dlg-h"><strong id="ed-title">New template</strong><span class="grow"></span><button class="tbtn" id="ed-cancel">Cancel</button><button class="go run-go" id="ed-save">Save</button></div>
  <div class="ed-b">
    <label class="fld"><span>Name</span><input id="ed-name" spellcheck="false" data-arrows="dispatch"></label>
    <label class="fld"><span>Description</span><input id="ed-desc" spellcheck="false" data-arrows="dispatch"></label>
    <label class="fld grow2"><span>Body</span><textarea id="ed-body" spellcheck="false" placeholder="int {{n:n}};cin>>{{n}};&#10;$0"></textarea></label>
    <p class="dim ed-hint" lang="ko">{{이름}}은 매개변수, {{이름:기본값}}은 기본값까지 정한다. $0은 삽입한 뒤 커서가 놓일 자리다.</p>
    <div class="ed-params" id="ed-params"></div>
  </div>
</div>`;
document.body.append(ed);
let edId=null;
function edParams(){
  const ps=tplParams($('#ed-body').value);
  $('#ed-params').innerHTML=ps.length?'<span class="dim">Parameters</span>'+ps.map(p=>`<span class="chip">${esc(p.name)}${p.def?`<em>${esc(p.def)}</em>`:''}</span>`).join(''):'<span class="dim">No parameters yet.</span>';
}
function openEditor(t){
  edId=t&&t.id||null;
  $('#ed-title').textContent=edId?'Edit template':'New template';
  $('#ed-name').value=t&&t.name||'';
  $('#ed-desc').value=t&&t.desc||'';
  $('#ed-body').value=t&&t.body||'';
  edParams();ed.hidden=false;$('#ed-name').focus();
}
const closeEditor=()=>{ed.hidden=true;if(!pal.hidden)palQ.focus()};
$('#ed-cancel').onclick=closeEditor;
$('#ed-body').addEventListener('input',edParams);
$('#ed-body').addEventListener('keydown',e=>{
  if(e.key==='Tab'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){
    e.preventDefault();
    const el=e.target,s=el.selectionStart;
    el.setRangeText('\t',s,el.selectionEnd,'end');el.dispatchEvent(new Event('input'));
  }
});
$('#ed-save').onclick=()=>{
  const name=$('#ed-name').value.trim(),body=$('#ed-body').value;
  if(!name){toast('Give the template a name');$('#ed-name').focus();return}
  if(!body.trim()){toast('The body is empty');$('#ed-body').focus();return}
  const rec={id:edId||'u-'+uid(),name,desc:$('#ed-desc').value.trim(),body,user:true};
  const list=userTemplates(),i=list.findIndex(x=>x.id===rec.id);
  i>=0?list[i]=rec:list.unshift(rec);
  persist();closeEditor();
  if(!pal.hidden){palState.id=null;palRender();const j=palState.list.findIndex(x=>x.id===rec.id);if(j>=0){palState.idx=j;palRenderList();palRenderSide()}}
  toast('Template saved');
};
ed.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();closeEditor()}
  else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();$('#ed-save').click()}
});
ed.addEventListener('mousedown',e=>{if(e.target===ed)closeEditor()});

/* ---------- editor keys ---------- */
src.addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return;
  if(e.key==='Enter'&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    e.preventDefault();e.stopPropagation();acHide();openPalette();return;
  }
  if(!ac.open)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();acHide();return}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();acMove(e.key==='ArrowDown'?1:-1);return}
  if((e.key==='Tab'||e.key==='Enter')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey){
    e.preventDefault();e.stopPropagation();acAccept();return;
  }
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Home'||e.key==='End')acHide();
},true);
src.addEventListener('input',e=>{
  const k=e.inputType||'';
  if(k.startsWith('insert')||k.startsWith('delete'))setTimeout(acShow,0);else acHide();
});
src.addEventListener('blur',()=>setTimeout(acHide,120));
scroller.addEventListener('scroll',()=>{if(ac.open)acRender()});
window.addEventListener('resize',acHide);
commands.templates=()=>openPalette();
