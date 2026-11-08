const $=q=>document.querySelector(q);
const src=$('#src'),hl=$('#hl'),scroller=$('#scroller');
const enc=new TextEncoder(),bytes=t=>enc.encode(t).length;
const esc=t=>String(t).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

const EXAMPLE=String.raw`#include <iostream>
#include <cstdio>
using namespace std;

// value * times, the slow way
long long repeatAdd(long long value, long long times) {
    long long total = 0;
    for (int i = 0; i < times; i++) {
        total = total + value;
    }
    return total;
}

int main() {
    int testCount;
    cin >> testCount;
    while (testCount--) {
        long long a, b;
        cin >> a >> b;
        if (a == 0) puts("zero");
        long long result = repeatAdd(a, b);
        if (result != b) result += 1;
        cout << result * (b + 1) << endl;
    }
    printf("done\n");
    return 0;
}
`;

const state={results:[],active:null,target:null,base:null,quiet:false,opts:{cpp:{imp:true,bits:true,ret:true,ren:true},py:{join:true,num:true,ren:true}},lang:'cpp'};

/* ---------- rolling byte counter ---------- */
const odo=(()=>{
  const api={onTick:null};
  const root=$('#bytes');root.classList.add('odo');
  const wrap=document.createElement('span');wrap.className='dgs';wrap.setAttribute('aria-hidden','true');
  const pop=document.createElement('span');pop.className='pop';pop.setAttribute('aria-hidden','true');
  const sr=document.createElement('span');sr.className='sr';
  root.textContent='';root.append(wrap,pop,sr);
  const DH=1.02,cols=[];
  let v=0,to=0,raf=0,first=true,combo=0,comboT=0,pruneT=0;
  const nd=x=>Math.max(1,String(Math.floor(Math.max(0,x))).length);
  function col(p){
    while(cols.length<=p){
      const c=document.createElement('span');c.className='dg';
      const s=document.createElement('span');s.className='strip';
      s.innerHTML=[0,1,2,3,4,5,6,7,8,9,0].map(d=>`<span>${d}</span>`).join('');
      c.append(s);wrap.prepend(c);cols.push({c,s});
    }
    return cols[p];
  }
  function posFor(val,p){
    const P=10**p,base=val/P,d=Math.floor(base)%10;
    const sm=p===0?base-Math.floor(base):Math.max(0,(val%P)-(P-1));
    return d+sm;
  }
  function draw(val,dv){
    const n=nd(val),need=Math.max(n,nd(to));
    for(let p=0;p<need||p<cols.length;p++){
      const k=col(p);
      k.c.classList.toggle('gone',p>=n);
      k.s.style.transform=`translateY(${(-posFor(val,p)*DH).toFixed(4)}em)`;
      const sp=Math.abs(dv)/10**p;
      k.s.style.filter=sp>.3?`blur(${Math.min(2.4,sp*.9).toFixed(2)}px)`:'';
    }
    if(api.onTick)api.onTick(val);
  }
  function prune(){
    const n=nd(to);
    while(cols.length>n&&cols[cols.length-1].c.classList.contains('gone')){cols.pop().c.remove()}
  }
  function hit(a,from,n,goal){
    const reached=goal>0&&from>goal&&n<=goal;
    const tier=reached||a>=30?3:a>=5?2:1;
    const c1=reached?'#a7d48a':'#ff8a2b';
    root.animate([
      {color:c1,textShadow:tier===3?`0 0 26px ${c1}99`:'0 0 0 transparent'},
      {color:c1,offset:tier===1?.15:.3},
      {color:'#e6e6e8',textShadow:'0 0 0 transparent'}
    ],{duration:[0,560,900,1400][tier],easing:'cubic-bezier(.3,0,.2,1)'});
    const now=performance.now();
    combo=now-comboT<750?combo+a:a;comboT=now;
    pop.textContent=reached?'Target hit':'−'+combo;pop.style.color=c1;
    if(reduceMotion){pop.animate([{opacity:1},{opacity:1,offset:.6},{opacity:0}],{duration:900,fill:'forwards'});}
    else{
      const s=[1,1.07,1.12,1.18][tier];
      wrap.animate([
        {transform:'scale(1)'},
        {transform:`scale(${s}) translateY(-3%)`,offset:.16},
        {transform:'scale(.97)',offset:.48},
        {transform:'scale(1)'}
      ],{duration:[0,300,420,620][tier],easing:'cubic-bezier(.2,.9,.3,1)'});
      if(tier===3)root.animate([
        {transform:'translateX(0)'},{transform:'translateX(-7px) rotate(-1deg)'},{transform:'translateX(6px) rotate(.8deg)'},
        {transform:'translateX(-4px)'},{transform:'translateX(2px)'},{transform:'translateX(0)'}
      ],{duration:380,easing:'ease-out'});
      pop.getAnimations().forEach(x=>x.cancel());
      const ps=reached?1:Math.min(1.45,1+Math.log10(combo)*.2);
      pop.animate([
        {opacity:0,transform:'translateY(10px) scale(.5)'},
        {opacity:1,transform:`translateY(-4px) scale(${ps*1.18})`,offset:.14},
        {opacity:1,transform:`translateY(-8px) scale(${ps})`,offset:.55},
        {opacity:0,transform:`translateY(-20px) scale(${ps*.95})`}
      ],{duration:1050,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'});
    }
    if(reached)toast('Target reached!');
  }
  function set(n,goal,quiet){
    n=Math.max(0,n|0);
    sr.textContent=n;
    if(first||quiet){first=false;cancelAnimationFrame(raf);clearTimeout(pruneT);v=to=n;draw(n,0);prune();return}
    if(n===to)return;
    const prevTo=to,from=v;to=n;
    cancelAnimationFrame(raf);clearTimeout(pruneT);
    if(reduceMotion){v=n;draw(n,0);prune()}
    else{
      const dur=Math.min(1100,260+Math.log10(Math.abs(n-from)+1)*300),t0=performance.now();let last=from;
      const step=now=>{
        const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,4),val=k<1?from+(n-from)*e:n;
        v=val;draw(val,val-last);last=val;
        if(k<1)raf=requestAnimationFrame(step);else pruneT=setTimeout(prune,320);
      };
      raf=requestAnimationFrame(step);
    }
    if(n<prevTo)hit(prevTo-n,prevTo,n,goal);
  }
  return Object.assign(api,{set,value:()=>v});
})();
odo.onTick=updateCut;

/* ---------- highlight ---------- */
const KW=new Set('if else for while do return break continue switch case default goto using namespace struct class const constexpr static inline template typename sizeof new delete operator public private auto true false nullptr typedef this'.split(' '));
const TY=new Set('int long short char double float bool void unsigned signed string vector pair map set queue stack deque priority_queue array bitset size_t'.split(' '));
function tokCls(k){
  switch(k.t){case 'com':return 'cm';case 'str':case 'chr':return 'st';case 'num':return 'nu';case 'op':return 'op';
    case 'id':return KW.has(k.v)?'kw':TY.has(k.v)?'ty':'';default:return ''}
}
function segments(code){
  const segs=[];
  for(const k of lex(code)){
    if(k.t!=='pp'){segs.push({s:k.s,e:k.e,c:tokCls(k)});continue}
    const head=(k.v.match(/^#\s*[A-Za-z_]*/)||['#'])[0];
    segs.push({s:k.s,e:k.s+head.length,c:'pp'});
    const base=k.s+head.length,rest=k.v.slice(head.length),inc=/include|import/.test(head);
    for(const r of lex(rest,true))segs.push({s:base+r.s,e:base+r.e,c:inc&&r.t!=='com'&&r.t!=='ws'?'hd':tokCls(r)});
  }
  return segs;
}
function curMarks(){
  const a=state.active;if(!a)return [];
  const r=state.results.find(x=>x.id===a.id);if(!r)return [];
  return r.matches.flatMap((m,i)=>m.ranges?(i===a.idx?m.ranges.map(x=>({s:x.s,e:x.e,cur:true})):[]):[{s:m.s,e:m.e,cur:i===a.idx}]);
}
function renderHL(){
  const code=src.value,marks=curMarks();
  const cuts=new Set();marks.forEach(m=>{cuts.add(m.s);cuts.add(m.e)});
  const cutArr=[...cuts].sort((a,b)=>a-b);
  let html='<div class="l">';
  const emit=(a,b,c)=>{
    const mk=marks.find(m=>m.s<=a&&a<m.e);
    const cls=[c,mk?'mk':'',mk&&mk.cur?'cur':''].filter(Boolean).join(' ');
    code.slice(a,b).split('\n').forEach((part,i)=>{
      if(i)html+='</div><div class="l">';
      if(part)html+=cls?`<span class="${cls}">${esc(part)}</span>`:esc(part);
    });
  };
  for(const g of eng().segments(code)){
    let a=g.s;
    for(const x of cutArr){if(x>g.s&&x<g.e){emit(a,x,g.c);a=x}}
    emit(a,g.e,g.c);
  }
  hl.innerHTML=html+'</div>';
}

/* ---------- par / stats ---------- */
function updatePar(){
  const code=src.value,b=bytes(code),t=state.target;
  odo.set(b,t,state.quiet);state.quiet=false;
  const del=$('#delta');
  if(t>0){
    const d=b-t;
    del.className='delta '+(d>0?'over':'met');
    del.innerHTML=d>0?`<b>+${d}</b>B to go`:d===0?'<b>0</b>right on target':`<b>−${-d}</b>B under target`;
  }else{del.className='delta';del.textContent='Set a target'}
  if(!(state.base>=b))state.base=b;
  const base=state.base;
  $('#cutl').textContent=base>0?`from the ${base} B start`:'Start size is set as you type';
  $('#b-base').hidden=!(base>0)||base===b;
  $('#fill').classList.toggle('met',t>0&&b<=t);
  const tick=$('#tick');tick.hidden=!(t>0&&base>0);if(t>0&&base>0)tick.style.left=Math.min(100,t/base*100)+'%';
  updateCut(odo.value());
  const chars=[...code].length,ws=(code.match(/\s/g)||[]).length,lines=code?code.split('\n').length:0;
  $('#sub').textContent=`${chars} chars, ${ws} whitespace, ${lines} lines`+(chars!==b?'. Non-ASCII characters take 2–3 B each':'');
}
function updateCut(val){
  const base=state.base||0,p=base>0?Math.max(0,(base-val)/base*100):0,el=$('#cutp');
  el.textContent=p<.05?'0%':'−'+(p>=99.95?'100':p.toFixed(1))+'%';
  el.classList.toggle('zero',p<.05);
  $('#fill').style.width=(base>0?Math.min(100,val/base*100):0)+'%';
}
function updateSquash(){
  const code=src.value,after=eng().minify(code,curOpts()),d=bytes(code)-bytes(after);
  const btn=$('#b-min');btn.disabled=d<=0;
  $('#go-t').textContent=d>0?'Minify':'Nothing left to strip';
  $('#go-v').textContent=d>0?`−${d} B`:'';
}

/* ---------- suggestion list ---------- */
function lineOf(code,i){return code.slice(0,i).split('\n').length}
function renderList(){
  const L=$('#list'),res=state.results,code=src.value;
  const fixable=res.filter(r=>!r.info);
  $('#cnt').textContent=res.length||'';
  const tot=fixable.reduce((a,r)=>a+r.save,0);
  $('#tot').textContent=tot?`All together ≈ −${tot} B`:'';
  if(!res.length){L.innerHTML=`<p class="empty">${code.trim()?'Nothing else found. Check the cheat sheet for more tricks.':'Type or paste code to see what can be cut.'}</p>`;return}
  L.innerHTML=res.map((r,i)=>{
    const on=state.active&&state.active.id===r.id;
    const [b,a]=eng().preview(code,r.matches[0]);
    const n=r.matches.length;
    const u=r.unit==='name';
    const pl=(k,w)=>`${k} ${w}${k===1?'':'s'}`;
    const where=on?(u?`Name ${state.active.idx+1} of ${n}, used ${pl(r.matches[state.active.idx].ranges.length,'time')}`:`${state.active.idx+1} of ${n}, line ${lineOf(code,r.matches[state.active.idx].s)}`):(u?`${pl(n,'name')}, tap to step through`:`${pl(n,'spot')}, tap to locate`);
    return `<div class="row${on?' on':''}${r.info?' info':''}" data-i="${i}" role="button" tabindex="0">
      <div class="dl">${r.info?'~':'−'}${r.save}</div>
      <div>
        <div class="ttl">${esc(r.title)}</div>
        <div class="ds" lang="ko">${esc(r.desc)}</div>
        <div class="pv"><code class="b">${esc(b)}</code><span class="ar">→</span><code class="a">${a?esc(a):'removed'}</code></div>
        <div class="cnt">${where}</div>
      </div>
      ${r.fix?`<button class="apply" data-a="${i}">${n>1?'Apply all':'Apply'}</button>`:'<span></span>'}
    </div>`;
  }).join('');
}
function focusRule(i){
  const r=state.results[i];if(!r)return;
  const a=state.active,wasRow=document.activeElement&&document.activeElement.classList.contains('row');
  state.active=(a&&a.id===r.id)?{id:r.id,idx:(a.idx+1)%r.matches.length}:{id:r.id,idx:0};
  renderHL();renderList();
  if(wasRow){const el=document.querySelector(`.row[data-i="${i}"]`);el&&el.focus({preventScroll:true})}
  const mk=hl.querySelector('.mk.cur');if(!mk)return;
  const r1=mk.getBoundingClientRect(),r2=scroller.getBoundingClientRect();
  scroller.scrollTo({top:scroller.scrollTop+r1.top-r2.top-scroller.clientHeight/2+r1.height/2,behavior:reduceMotion?'auto':'smooth'});
}
function applyRule(i){
  const r=state.results[i];if(!r||!r.fix)return;
  const before=bytes(src.value);
  setCode(applyEdits(src.value,r.matches.flatMap(m=>m.edits)));
  const d=before-bytes(src.value);
  toast(d>0?`Cut ${d} B`:'Applied');
}

/* ---------- core flow ---------- */
let anT=0,svT=0;
function refreshAnalysis(){state.results=eng().analyze(src.value);if(state.active&&!state.results.find(r=>r.id===state.active.id))state.active=null;renderList();updateSquash()}
function onChange(){
  renderHL();updatePar();caret();
  syncUndo();
  updateTitle();
  clearTimeout(anT);anT=setTimeout(refreshAnalysis,120);
  scheduleSave();
}
// One history for everything: typing, Tab and Enter helpers, Minify, and applied suggestions.
// Runs of plain typing collapse into a single step, the way a normal editor behaves.
const HIST_MAX=200,HIST_GAP=700;
let undoStack=[],redoStack=[],histLast={text:'',s:0,e:0},histKind='',histAt=0,composing=false;
const editState=()=>({text:src.value,s:src.selectionStart,e:src.selectionEnd});
const TYPING=new Set(['insertText','insertCompositionText','deleteContentBackward','deleteContentForward']);
function histReset(){undoStack=[];redoStack=[];histLast=editState();histKind='';histAt=0;syncUndo()}
function syncUndo(){$('#undo').disabled=!undoStack.length;$('#redo').disabled=!redoStack.length}
function pushUndo(st){undoStack.push(st);if(undoStack.length>HIST_MAX)undoStack.shift();redoStack.length=0}
function noteInput(e){
  const kind=e&&e.inputType||'',now=performance.now();
  // A Hangul or other IME syllable is built from many events; the whole composition is one step.
  const run=composing||(TYPING.has(kind)&&kind===histKind&&now-histAt<HIST_GAP&&histLast.s===histLast.e&&!(e&&typeof e.data==='string'&&e.data.includes('\n')));
  if(!run)pushUndo(histLast);
  histLast=editState();histKind=kind;histAt=now;syncUndo();
}
function applyState(st){
  src.value=st.text;
  src.setSelectionRange(Math.min(st.s,st.text.length),Math.min(st.e,st.text.length));
  histLast=editState();histKind='';histAt=0;
  state.active=null;onChange();syncUndo();scrollCaretIntoView();
}
function setCode(t){
  if(t===src.value)return;
  const before=editState();
  pushUndo(before);
  src.value=t;
  const p=Math.min(before.s,t.length);src.setSelectionRange(p,p);
  histLast=editState();histKind='';histAt=0;
  state.active=null;onChange();syncUndo();
}
function undo(){
  if(composing)return;
  if(!undoStack.length){toast('Nothing to undo');return}
  redoStack.push(editState());
  applyState(undoStack.pop());
}
function redo(){
  if(composing)return;
  if(!redoStack.length){toast('Nothing to redo');return}
  undoStack.push(histLast);
  applyState(redoStack.pop());
}
function caret(){
  const p=src.selectionStart,q=src.selectionEnd,v=src.value,before=v.slice(0,p);
  let t=`Ln ${before.split('\n').length}, Col ${p-before.lastIndexOf('\n')}`;
  if(q>p)t+=`, ${bytes(v.slice(p,q))} B selected`;
  $('#pos').textContent=t;
}
let tt=0;
function toast(msg,action){
  const el=$('#toast');el.textContent='';
  const t=document.createElement('span');t.textContent=msg;el.append(t);
  if(action){const b=document.createElement('button');b.className='toast-act';b.textContent=action.text;b.onclick=()=>{el.classList.remove('show');action.run()};el.append(b)}
  el.classList.toggle('act',!!action);el.classList.add('show');
  clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),action?6000:1600);
}
function ins(t){
  src.focus();
  let ok=false;try{ok=document.execCommand('insertText',false,t)}catch(e){}
  if(!ok){src.setRangeText(t,src.selectionStart,src.selectionEnd,'end');src.dispatchEvent(new Event('input'))}
}

/* ---------- events ---------- */
let pasteReset=false;
src.addEventListener('paste',()=>{pasteReset=!src.value.trim()||(src.selectionStart===0&&src.selectionEnd===src.value.length)});
src.addEventListener('input',e=>{noteInput(e);if(pasteReset){state.base=bytes(src.value);pasteReset=false}state.active=null;onChange()});
src.addEventListener('compositionstart',()=>{pushUndo(histLast);composing=true;syncUndo()});
src.addEventListener('compositionend',()=>{composing=false;histLast=editState();histKind='';histAt=performance.now()});
src.addEventListener('scroll',()=>{src.scrollTop=0;src.scrollLeft=0});
['keyup','click','select'].forEach(ev=>src.addEventListener(ev,caret));
document.addEventListener('selectionchange',()=>{if(document.activeElement===src)caret()});
let tabFree=false;
src.addEventListener('focus',()=>{tabFree=false});
src.addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return;
  if(e.key==='Escape'){tabFree=true;return}
  if(e.key==='Tab'&&!tabFree&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();ins('\t');return}
  if(e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    const p=src.selectionStart,ls=src.value.lastIndexOf('\n',p-1)+1,ind=(src.value.slice(ls,p).match(/^[ \t]*/)||[''])[0];
    if(ind){e.preventDefault();ins('\n'+ind)}
  }
});
$('#undo').onclick=undo;
$('#redo').onclick=redo;
$('#b-base').onclick=()=>{state.base=bytes(src.value);updatePar();scheduleSave();toast(`Start set to ${state.base} B`)};
$('#b-copy').onclick=async()=>{try{await api.copy(src.value);toast('Copied')}catch(e){toast('Copy failed')}};
$('#b-min').onclick=()=>{const b=bytes(src.value);setCode(eng().minify(src.value,curOpts()));toast(`Cut ${b-bytes(src.value)} B`)};
$('#target').addEventListener('input',e=>{const v=e.target.value.replace(/\D/g,'');e.target.value=v;state.target=v?parseInt(v,10):null;updatePar();scheduleSave()});
$('#list').addEventListener('click',e=>{
  const ap=e.target.closest('.apply');if(ap){e.stopPropagation();applyRule(+ap.dataset.a);return}
  const row=e.target.closest('.row');if(row)focusRule(+row.dataset.i);
});
$('#list').addEventListener('keydown',e=>{
  const row=e.target.closest('.row');if(!row||e.target!==row)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();focusRule(+row.dataset.i)}
});
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',String(x===t)));
  $('#pane-an').hidden=t.dataset.p!=='an';$('#pane-tips').hidden=t.dataset.p!=='tips';
}));

/* ---------- cheat sheet ---------- */
const TIPS=[
 ['Skeleton',[
  ['#include<cstdio>','#import<cstdio>','−1','GCC에서만 동작한다. 경고는 뜨지만 컴파일된다.'],
  ['return 0;','','−9','main은 끝나면 0을 반환한다.'],
  ['int main(){int a=0;','int a;int main(){','−2','전역 변수는 0으로 초기화된다.'],
  ['using namespace std;','std::cin','','std 이름을 3번 이하로 쓰면 std::가 짧다. 4번이면 길이가 같다.'],
  ['long long ×3','using L=long long;','','세 번 이상 쓰면 별칭이 이득이다.'],
  ['int main(){}','main(){}','−4','C로 제출할 때만 가능하다.'],
 ]],
 ['I/O',[
  ['cout<<"Yes\\n";','puts("Yes");','−2','puts는 줄바꿈을 자동으로 붙인다.'],
  ['printf("Yes\\n");','puts("Yes");','−4',''],
  ['scanf("%d%d",&a,&b);','cin>>a>>b;','−10','using namespace std;가 있을 때 기준이다.'],
  ['printf("%d",a+b);','cout<<a+b;','−7',''],
  ["putchar('\\n')",'putchar(10)','−2',"' '는 32로 쓰면 1 B 줄어든다."],
  ['cin>>t;while(t--)','for(cin>>t;t--;)','−1',''],
  ['while(cin>>n)','while(~scanf("%d",&n))','','EOF까지 읽는 두 가지 방법이다.'],
 ]],
 ['Conditions',[
  ['if(a>b)puts("A");','a>b&&puts("A");','−2','반환형이 void인 함수에는 쓸 수 없다.'],
  ['if(c)x=1;else x=2;','x=c?1:2;','−10',''],
  ['a==0','!a','−2',''],
  ['x!=0','x','−3','조건식 안에서만 쓸 수 있다.'],
  ['a!=b','a-b','−1','조건식 안에서 정수끼리 비교할 때만 쓸 수 있다.'],
  ['true','1','−3','false는 0으로 쓰면 4 B 줄어든다.'],
 ]],
 ['Arithmetic',[
  ['(x+1)*2','-~x*2','−2','-~x는 x+1과 같다.'],
  ['(x-1)*2','~-x*2','−2','~-x는 x-1과 같다.'],
  ['x+=1','++x','−1',''],
  ['sum=sum+a','sum+=a','−3','변수 이름 길이만큼 줄어든다.'],
  ["c-'0'",'c-48','−1','아스키 코드로 쓰면 짧아진다.'],
  ['1000000','1e6','−4','실수형이 되므로 %나 배열 크기에는 쓸 수 없다.'],
 ]],
 ['Loops',[
  ['for(int i=0;i<n;i++)','for(i=0;i<n;i++)','−4','i를 전역에 선언해 둔 경우다.'],
  ['for(i=0;i<n;i++)s+=a[i];','for(;i<n;)s+=a[i++];','−4','i가 0인 전역 변수일 때 쓸 수 있다.'],
  ['for(int i=0;i<n;i++)','while(n--)','−10','n번 반복만 하면 될 때 쓴다. n의 값은 사라진다.'],
  ['if(c){a++;b++;}','if(c)a++,b++;','−2','콤마로 묶으면 중괄호가 필요 없다.'],
 ]],
 ['Myths',[
  ['x/2','x>>1','+1','오히려 1 B 길어진다.'],
  ['x%2','x&1','0','길이가 같다.'],
  ['endl',"'\\n'",'0','길이가 같고 속도만 다르다.'],
 ]],
];
/* ---------- languages ---------- */
const EXAMPLE_PY=String.raw`import math
import sys

# distance between two points, per test case
def distance(first_x, first_y, second_x, second_y):
    return math.sqrt((first_x - second_x) ** 2 + (first_y - second_y) ** 2)

def main():
    test_count = int(input())
    results = []
    for index in range(0, test_count):
        values = list(map(int, input().split()))
        answer = distance(values[0], values[1], values[2], values[3])
        results.append(round(answer, 3))
    print(" ".join(map(str, results)))
    total = sum([value for value in results])
    if len(results) > 0:
        print("Yes" if total > 10 else "No")

if __name__ == "__main__":
    main()
`;
const TIPS_PY=[
 ['Structure',[
  ['if __name__=="__main__":','','−24','제출 파일은 스크립트로 실행되므로 필요 없다.'],
  ['␣␣␣␣x=1','␣x=1','−3','들여쓰기는 한 단계에 공백 하나면 된다.'],
  ['if c:\\n␣x=1','if c:x=1','−2','본문이 단순한 문장뿐이면 콜론 뒤에 바로 쓴다.'],
  ['␣a=1\\n␣b=2','␣a=1;b=2','−1','같은 블록의 문장은 세미콜론으로 잇는다. 들여쓰기만큼 더 줄어든다.'],
  ['def f(x):return x*2','f=lambda x:x*2','−5','return 한 줄짜리 함수는 lambda로 쓴다.'],
  ['import math','from math import*','','모듈 이름을 두 번 이상 쓰면 *로 가져오는 쪽이 짧다.'],
  ['import a\\nimport b','import a,b','−7','import는 쉼표로 한 줄에 모은다.'],
 ]],
 ['I/O',[
  ['print(" ".join(map(str,a)))','print(*a)','−19','print는 인자를 공백으로 이어 출력한다.'],
  ['print("\\n".join(map(str,a)))','print(*a,sep="\\n")','−10','줄마다 출력할 때는 sep만 바꾼다.'],
  ['list(map(int,input().split()))','[*map(int,input().split())]','−3','언패킹이 list 호출보다 짧다.'],
  ['input() ×3','I=input','','세 번 이상 쓰면 한 글자 별칭이 이득이다.'],
  ['sys.stdin.read()','open(0).read()','−4','파일 서술자 0이 표준 입력이다. import sys도 필요 없다.'],
  ['[input() for _ in[0]*n]','[*open(0)]','','입력 전체를 줄 단위 리스트로 받는다. 각 줄 끝에 줄바꿈이 남는다.'],
 ]],
 ['Conditions',[
  ['"Yes"if a==b else"No"','"YNeos"[a!=b::2]','−4','두 단어를 한 글자씩 섞고 슬라이스로 고른다.'],
  ['x if c else y','[y,x][c]','−5','c가 True/False일 때 쓴다. 양쪽 값이 모두 계산된다.'],
  ['len(a)>0','a','−7','조건식 안에서 빈 컬렉션은 거짓이다.'],
  ['x%2==1','x%2','−3','조건식 안에서 쓴다. 짝수 검사는 x%2<1이다.'],
  ['a<b and b<c','a<b<c','−6','비교 연산은 이어 쓸 수 있다.'],
  ['a!=b','a-b','−1','조건식 안에서 정수끼리 비교할 때 쓴다.'],
  ['while True:','while 1:','−3','1도 참이다.'],
 ]],
 ['Arithmetic',[
  ['math.ceil(a/b)','-(-a//b)','−6','정수 나눗셈으로 올림을 구한다.'],
  ['math.sqrt(x)','x**.5','−7','제곱근은 0.5제곱이다.'],
  ['1000000','10**6','−2','결과가 정수 그대로다. C++의 1e6과 달리 실수가 되지 않는다.'],
  ['0.5','.5','−1','소수점 앞의 0은 생략한다.'],
  ['x=x+1','x+=1','−1','복합 대입을 쓴다.'],
  ['int(x/2)','x//2','−4','양수에서는 정수 나눗셈과 같다.'],
 ]],
 ['Loops and lists',[
  ['for i in range(n):','for _ in[0]*n:','−3','반복 변수를 쓰지 않을 때 range 대신 리스트를 돈다.'],
  ['for _ in[0]*n:a+=1','exec("a+=1;"*n)','−2','본문 문자열을 n번 이어 붙여 한 번에 실행한다.'],
  ['a.append(x)','a+=[x]','−5','리스트에 하나를 붙인다.'],
  ['sum([x for x in a])','sum(x for x in a)','−2','제너레이터를 바로 넘긴다.'],
  ['tuple(a)','(*a,)','−3','set(a)는 {*a}로 쓰면 2 B 줄어든다.'],
  ['a[len(a)-1]','a[-1]','−7','음수 인덱스는 뒤에서부터 센다.'],
  ['range(0,n)','range(n)','−2','range는 0부터 시작한다.'],
 ]],
 ['Myths',[
  ['1 if c else 2','1if c else 2','0','동작하지만 Python 3.12부터 경고가 뜬다. 에디터는 공백을 남긴다.'],
  ['print(True)','print(1)','0','출력 결과가 True에서 1로 바뀐다.'],
  ['a=a+[x]','a+=[x]','0','리스트는 새로 만들지 않고 제자리에서 바뀐다. 같은 리스트를 가리키는 다른 이름에도 반영된다.'],
 ]],
];
const CPP_ENGINE={
  id:'cpp',label:'C++ (GCC)',ext:'.cpp',
  title:'Strip whitespace and comments',
  opts:[{k:'imp',label:'#import'},{k:'bits',label:'Merge headers'},{k:'ret',label:'Drop return 0;'},{k:'ren',label:'Shorten names'}],
  minify:(c,o)=>minify(c,o),analyze:c=>analyze(c),preview:(c,m)=>preview(c,m),segments:c=>segments(c),
  tips:TIPS,example:EXAMPLE,
};
const PY_ENGINE={
  id:'py',label:'Python 3',ext:'.py',
  title:'Strip whitespace and comments',
  opts:[{k:'join',label:'Inline bodies'},{k:'num',label:'Trim numbers'},{k:'ren',label:'Shorten names'}],
  minify:(c,o)=>PY.minify(c,o),analyze:c=>PY.analyze(c),preview:(c,m)=>PY.preview(c,m),segments:c=>PY.segments(c),
  tips:TIPS_PY,example:EXAMPLE_PY,
};
const ENGINES={cpp:CPP_ENGINE,py:PY_ENGINE};
const eng=()=>ENGINES[state.lang]||CPP_ENGINE;
const curOpts=()=>state.opts[state.lang];
function renderTips(){
  $('#tips').innerHTML=eng().tips.map(([g,items])=>`<p class="tg">${g}</p>`+items.map(([b,a,d,note])=>{
    const dc=d.startsWith('+')?' bad':d==='0'?' eq':'';
    return `<div class="tip"><div class="tip-l"><code class="b">${esc(b)}</code><span class="ar">→</span><code class="a">${a?esc(a):'removed'}</code>${d?`<span class="d${dc}">${d==='0'?'±0':d}</span>`:''}</div>${note?`<p lang="ko">${esc(note)}</p>`:''}</div>`;
  }).join('')).join('');
}
function renderChips(){
  const e=eng(),o=curOpts();
  $('#sq-h').textContent=e.title;
  $('#opts').innerHTML=e.opts.map(x=>`<label class="opt"><input type="checkbox" data-k="${x.k}"${o[x.k]?' checked':''}><span>${esc(x.label)}</span></label>`).join('');
}
$('#opts').addEventListener('change',e=>{const k=e.target.dataset.k;if(!k)return;curOpts()[k]=e.target.checked;updateSquash();scheduleSave()});



/* ---------- home-row arrows ---------- */
// Ctrl+Shift turns the , . / L cluster into the arrow keys, laid out like the real ones:
// L is up, , is left, . is down, / (?) is right.
const HR_CODE={KeyL:'ArrowUp',Comma:'ArrowLeft',Period:'ArrowDown',Slash:'ArrowRight'};
const HR_KEY={l:'ArrowUp',L:'ArrowUp',',':'ArrowLeft','<':'ArrowLeft','.':'ArrowDown','>':'ArrowDown','/':'ArrowRight','?':'ArrowRight'};
function homeRowArrow(e){
  if(!e.ctrlKey||!e.shiftKey||e.altKey||e.metaKey)return null;
  return HR_CODE[e.code]||HR_KEY[e.key]||null;
}

// Caret geometry, measured on the highlight layer: it mirrors the textarea's text, font, and wrapping.
function hlEntries(){
  const out=[];let off=0;
  const lines=hl.children;
  for(let i=0;i<lines.length;i++){
    if(i)off++;
    const w=document.createTreeWalker(lines[i],NodeFilter.SHOW_TEXT);
    let n,any=false;
    while((n=w.nextNode())){out.push({node:n,start:off,len:n.length});off+=n.length;any=true}
    if(!any)out.push({node:lines[i],start:off,len:0,empty:true});
  }
  return out;
}
const rng=document.createRange();
function caretRect(ents,off){
  let e=null;
  for(const x of ents){if(x.start<=off&&off<=x.start+x.len){e=x;if(off<x.start+x.len)break}}
  if(!e)e=ents[ents.length-1];
  if(!e)return null;
  if(e.empty)rng.selectNodeContents(e.node);
  else{rng.setStart(e.node,Math.min(Math.max(off-e.start,0),e.len));rng.collapse(true)}
  let r=rng.getBoundingClientRect();
  if(!r.height&&e.empty)r=e.node.getBoundingClientRect();
  return r;
}
const lineH=()=>parseFloat(getComputedStyle(hl).lineHeight)||20;
// Largest offset whose caret sits at or before (x, y) in reading order.
function offsetAtPoint(ents,x,y){
  const before=off=>{const r=caretRect(ents,off);if(!r)return true;if(r.bottom<=y)return true;if(r.top>=y)return false;return r.left<=x};
  let lo=0,hi=src.value.length;
  if(!before(0))return 0;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(before(mid))lo=mid;else hi=mid-1}
  return lo;
}
function scrollCaretIntoView(){
  const r=caretRect(hlEntries(),src.selectionStart);if(!r)return;
  const box=scroller.getBoundingClientRect(),pad=lineH();
  if(r.top<box.top+pad)scroller.scrollTop+=r.top-box.top-pad;
  else if(r.bottom>box.bottom-pad)scroller.scrollTop+=r.bottom-box.bottom+pad;
}
let goalX=null;
function placeCaret(p){
  p=Math.max(0,Math.min(src.value.length,p));
  src.setSelectionRange(p,p);caret();scrollCaretIntoView();
}
const seg=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter():null;
// One grapheme cluster, so emoji and combining marks move as a unit.
function stepChar(p,dir){
  const v=src.value;
  if(dir<0){
    if(p<=0)return 0;
    if(seg){const from=Math.max(0,p-32);let prev=p;for(const s of seg.segment(v.slice(from,p)))prev=from+s.index;return prev}
    const c=v.codePointAt(p-2);
    return p-(c>0xffff?2:1);
  }
  if(p>=v.length)return v.length;
  if(seg){for(const s of seg.segment(v.slice(p,Math.min(v.length,p+32))))return p+s.segment.length}
  return p+(v.codePointAt(p)>0xffff?2:1);
}
function moveCaret(dir){
  const s=src.selectionStart,e=src.selectionEnd;
  if(dir==='ArrowLeft'||dir==='ArrowRight'){
    goalX=null;
    if(s!==e)return placeCaret(dir==='ArrowLeft'?s:e);
    return placeCaret(dir==='ArrowLeft'?stepChar(s,-1):stepChar(s,1));
  }
  const up=dir==='ArrowUp',ents=hlEntries(),cur=up?s:e;
  const r=caretRect(ents,cur);if(!r)return;
  const lh=lineH(),x=goalX==null?r.left:goalX;
  const p=offsetAtPoint(ents,x,up?r.top-lh/2:r.bottom+lh/2);
  placeCaret(p);goalX=x;
}
// Single-line inputs get the same cluster: left and right by one, up and down to the ends.
function moveInput(el,dir){
  const p=el.selectionStart,q=el.selectionEnd,n=el.value.length;
  const to=dir==='ArrowLeft'?(p!==q?p:Math.max(0,p-1)):dir==='ArrowRight'?(p!==q?q:Math.min(n,q+1)):dir==='ArrowUp'?0:n;
  el.setSelectionRange(to,to);
}
document.addEventListener('keydown',e=>{
  const dir=homeRowArrow(e);if(!dir)return;
  e.preventDefault();e.stopPropagation();
  const el=document.activeElement;
  if(el===src){if((dir==='ArrowUp'||dir==='ArrowDown')&&acMove(dir==='ArrowDown'?1:-1))return;moveCaret(dir);return}
  if(el&&el.tagName==='INPUT'&&el.dataset.arrows!=='dispatch'&&/text|search|tel|url|password|^$/.test(el.type||'')){moveInput(el,dir);return}
  // Everywhere else (the tree, menus) already handles the real arrow keys.
  (el||document.body).dispatchEvent(new KeyboardEvent('keydown',{key:dir,code:dir,bubbles:true,cancelable:true}));
},true);
['click','keyup','input'].forEach(ev=>src.addEventListener(ev,e=>{if(!e.isTrusted||!homeRowArrow(e))goalX=null}));

/* ---------- desktop bridge ---------- */
const api=window.shortpp||{
  platform:'web',
  store:{get:async k=>{try{return JSON.parse(localStorage.getItem('shortpp:'+k))}catch(e){return null}},set:async(k,v)=>localStorage.setItem('shortpp:'+k,JSON.stringify(v))},
  file:{open:async()=>{toast('Opening files from disk needs the desktop app');return null},read:async()=>null,save:async()=>{toast('Saving to disk needs the desktop app');return null},rename:async()=>({error:'Renaming a file on disk needs the desktop app'}),trash:async()=>false,reveal(){},exists:async ps=>ps.map(()=>true),pathFor:()=>''},
  ask:async o=>window.confirm(o.message)?0:1,
  win:{minimize(){},toggleMaximize(){},close(){},setDirty(){},onState(){}},
  run:{toolchain:async()=>null,code:async()=>({stage:'error',error:'Running code needs the desktop app.'}),stop(){}},
  copy:t=>navigator.clipboard.writeText(t),devtools(){},onMenu(){}
};
const isMac=api.platform==='darwin';
const top_=$('#top');
top_.classList.toggle('mac',isMac);
top_.classList.toggle('web',!window.shortpp); // a browser tab draws its own window frame
const REVEAL=isMac?'Reveal in Finder':api.platform==='win32'?'Show in File Explorer':'Show in folder';
const TRASH=isMac?'Move to Trash':'Delete from disk';

/* ---------- library model ---------- */
// Every file the editor has touched lives here. Folders are virtual and only exist in Short++.
const EXW_DEF=252,EXW_MIN=180;
const lib={nodes:{},active:null,expanded:{},sort:'name',sidebar:true,exWidth:EXW_DEF,runH:220,runOpen:true,templates:[]};
const histMap={};
const saveHist=id=>{if(id)histMap[id]={u:undoStack,r:redoStack}};
let selId=null;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const baseName=p=>p?p.split(/[\\/]/).pop():'';
const dirName=p=>{if(!p)return '';const parts=p.split(/[\\/]/);parts.pop();return parts.pop()||''};
const allNodes=()=>Object.values(lib.nodes);
const kids=pid=>allNodes().filter(n=>n.parent===pid);
const docName=d=>d.path?baseName(d.path):d.name;
const langOf=d=>d&&/\.pyw?$/i.test(docName(d))?'py':'cpp';
const activeDoc=()=>lib.nodes[lib.active]||null;
const docDirty=d=>!!d.path&&(d.id===lib.active?src.value:d.content)!==d.saved;
const fileName=()=>{const d=activeDoc();return d?docName(d):'Untitled'};
const isDirty=()=>{const d=activeDoc();return !!d&&docDirty(d)};
const cmpName=(a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});

function syncActive(){const d=activeDoc();if(!d)return;d.content=src.value;d.base=state.base;d.target=state.target}
const snapshot=()=>{syncActive();return {v:2,nodes:lib.nodes,active:lib.active,expanded:lib.expanded,sort:lib.sort,sidebar:lib.sidebar,exWidth:lib.exWidth,runH:lib.runH,runOpen:lib.runOpen,templates:lib.templates,opts:state.opts}};
function persist(){clearTimeout(svT);return api.store.set('library',snapshot()).catch(()=>{})}
function scheduleSave(){clearTimeout(svT);svT=setTimeout(persist,300)}
window.addEventListener('beforeunload',()=>{if(window.shortpp)api.store.set('library',snapshot())});

function uniqueName(base,parent,type){
  const taken=new Set(kids(parent).filter(n=>n.type===type).map(n=>type==='file'?docName(n):n.name));
  if(!taken.has(base))return base;
  let i=2;while(taken.has(`${base} ${i}`))i++;return `${base} ${i}`;
}
function nextUntitled(ext){const names=new Set(allNodes().map(n=>n.type==='file'?docName(n):n.name));let i=1;while(names.has(`Untitled ${i}${ext}`))i++;return `Untitled ${i}${ext}`}
function selectedFolder(){
  const n=lib.nodes[selId];
  if(!n)return null;
  return n.type==='folder'?n.id:n.parent;
}
function descendants(id){const out=[];const walk=p=>kids(p).forEach(k=>{out.push(k.id);walk(k.id)});walk(id);return out}
function mostRecentFile(except){return allNodes().filter(n=>n.type==='file'&&!except.has(n.id)).sort((a,b)=>(b.opened||b.updated||0)-(a.opened||a.updated||0))[0]||null}

/* ---------- documents ---------- */
function openDoc(id){
  const d=lib.nodes[id];if(!d||d.type!=='file')return;
  if(lib.active&&lib.active!==id&&activeDoc()){syncActive();saveHist(lib.active)}
  const switching=lib.active!==id;
  lib.active=id;d.opened=Date.now();selId=id;
  if(switching){const h=histMap[id];undoStack=h?h.u:[];redoStack=h?h.r:[]}
  state.base=d.base??bytes(d.content);state.target=d.target||null;
  $('#target').value=state.target||'';
  state.active=null;state.quiet=true;
  src.value=d.content;
  setLang(langOf(d));
  let p=d.parent;while(p){lib.expanded[p]=true;p=lib.nodes[p]&&lib.nodes[p].parent}
  histLast=editState();histKind='';histAt=0;
  loadRunPane();
  onChange();refreshAnalysis();renderTree();persist();
  if(switching){src.setSelectionRange(0,0);scroller.scrollTop=0}
}
function newFile(parent,content='',name,lang=state.lang){
  const id=uid(),now=Date.now();
  lib.nodes[id]={id,type:'file',parent:parent||null,name:name||nextUntitled(ENGINES[lang].ext),path:null,content,saved:'',base:bytes(content),target:null,created:now,updated:now};
  openDoc(id);return id;
}
function newFolder(parent){
  const id=uid();
  lib.nodes[id]={id,type:'folder',parent:parent||null,name:uniqueName('New folder',parent||null,'folder')};
  if(parent)lib.expanded[parent]=true;
  lib.expanded[id]=true;selId=id;
  renderTree();persist();startRename(id);
  return id;
}
function addDiskFile(path,content,parent,open=true){
  const ex=allNodes().find(n=>n.type==='file'&&n.path===path);
  if(ex){
    ex.missing=false;
    if(!docDirty(ex)){ex.content=content;ex.saved=content;if(ex.id===lib.active)src.value=content}
    else if(content!==ex.saved)toast(`Showing your unsaved draft of ${docName(ex)}`);
    if(open)openDoc(ex.id);
    return ex.id;
  }
  const id=uid(),now=Date.now();
  lib.nodes[id]={id,type:'file',parent:parent||null,name:baseName(path),path,content,saved:content,base:bytes(content),target:null,created:now,updated:now};
  if(open)openDoc(id);else{renderTree();persist()}
  return id;
}
async function save(as){
  const d=activeDoc();if(!d)return false;
  const def=d.path?baseName(d.path):(/\.\w+$/.test(d.name)?d.name:d.name+'.cpp');
  const p=await api.file.save({path:d.path,content:src.value,as,name:def});
  if(!p)return false;
  const dup=allNodes().find(n=>n.type==='file'&&n.path===p&&n.id!==d.id);
  if(dup){if(!d.parent)d.parent=dup.parent;delete lib.nodes[dup.id]}
  Object.assign(d,{path:p,name:baseName(p),saved:src.value,content:src.value,missing:false,updated:Date.now()});
  updateTitle();setLang(langOf(d));renderTree();persist();
  toast(`Saved ${baseName(p)}`);
  return true;
}
function duplicate(id){
  const n=lib.nodes[id];if(!n||n.type!=='file')return;
  if(id===lib.active)syncActive();
  const nm=docName(n),dot=nm.lastIndexOf('.'),stem=dot>0?nm.slice(0,dot):nm,ext=dot>0?nm.slice(dot):'';
  const nid=uid(),now=Date.now();
  lib.nodes[nid]={id:nid,type:'file',parent:n.parent,name:uniqueName(`${stem} copy${ext}`,n.parent,'file'),path:null,content:n.content,saved:'',base:n.base??bytes(n.content),target:n.target||null,created:now,updated:now};
  openDoc(nid);startRename(nid);
}

/* ---------- destructive actions (undoable) ---------- */
function withUndo(label,mutate){
  syncActive();
  const snap={nodes:structuredClone(lib.nodes),active:lib.active};
  mutate();
  const gone=new Set(Object.keys(snap.nodes).filter(k=>!lib.nodes[k]));
  if(!activeDoc()){
    const next=mostRecentFile(gone);
    lib.active=null;
    if(next)openDoc(next.id);else newFile(null);
  }
  if(selId&&!lib.nodes[selId])selId=lib.active;
  renderTree();persist();
  toast(label,{text:'Undo',run(){
    syncActive();
    const cur=activeDoc();
    if(cur&&snap.nodes[cur.id])Object.assign(snap.nodes[cur.id],{content:cur.content,base:cur.base,target:cur.target,updated:cur.updated});
    lib.nodes=snap.nodes;
    gone.forEach(k=>delete histMap[k]);
    const a=snap.active;lib.active=null;
    openDoc(lib.nodes[a]?a:(mostRecentFile(new Set())||{}).id);
    toast('Restored');
  }});
}
function removeFromList(id){
  const n=lib.nodes[id];if(!n)return;
  withUndo(`Removed ${n.type==='file'?docName(n):n.name}`,()=>{[id,...descendants(id)].forEach(k=>delete lib.nodes[k])});
}
function ungroup(id){
  const n=lib.nodes[id];if(!n||n.type!=='folder')return;
  withUndo(`Ungrouped ${n.name}`,()=>{kids(id).forEach(k=>k.parent=n.parent);delete lib.nodes[id]});
}
async function trashFile(id){
  const n=lib.nodes[id];if(!n||!n.path)return;
  const r=await api.ask({type:'warning',message:isMac?`Move “${docName(n)}” to the Trash?`:`Delete “${docName(n)}” from disk?`,detail:`${n.path}\n\nThe file is removed from disk and from this list.`,buttons:[TRASH,'Cancel'],defaultId:1,cancelId:1});
  if(r!==0)return;
  if(!await api.file.trash(n.path)){toast('Couldn’t delete the file');return}
  delete lib.nodes[id];
  if(!activeDoc()){const next=mostRecentFile(new Set([id]));lib.active=null;if(next)openDoc(next.id);else newFile(null)}
  renderTree();persist();toast(`Deleted ${docName(n)}`);
}
const deleteDefault=id=>removeFromList(id);
async function renameNode(id,v){
  const n=lib.nodes[id];if(!n)return;
  if(n.type==='file'&&n.path){
    if(/[\\/:*?"<>|]/.test(v)){toast('That name has characters files can’t use');return}
    const r=await api.file.rename(n.path,v);
    if(!r||r.error){toast(r&&r.error?r.error:'Rename failed');return}
    n.path=r.path;n.name=baseName(r.path);
  }else n.name=v;
  if(id===lib.active){updateTitle();setLang(langOf(n))}
  persist();
}
async function checkMissing(){
  const ps=allNodes().filter(n=>n.type==='file'&&n.path);if(!ps.length)return;
  let r;try{r=await api.file.exists(ps.map(n=>n.path))}catch(e){return}
  let changed=false;
  ps.forEach((n,i)=>{const m=!r[i];if(!!n.missing!==m){n.missing=m;changed=true}});
  if(changed){renderTree();updateTitle()}
}

/* ---------- title ---------- */
let lastDirty=null;
function updateTitle(){
  const d=activeDoc(),dirty=isDirty();
  $('#fname').textContent=fileName();
  $('#fpath').textContent=d&&d.path?(d.missing?'missing on disk':dirName(d.path)):'draft';
  $('#title').title=d&&d.path?d.path:'Only in Short++. Save to write it to disk.';
  $('#dirty').hidden=!dirty;
  document.title=`${dirty?'• ':''}${fileName()} — Short++`;
  if(dirty!==lastDirty){lastDirty=dirty;api.win.setDirty(dirty)}
  const row=document.getElementById('n-'+lib.active);
  if(row){
    const d2=activeDoc();
    row.classList.toggle('unsaved',dirty);
    const m=row.querySelector('.meta');if(m)m.textContent=bytes(src.value)+' B';
    if(d2&&d2.content!==src.value){d2.content=src.value;d2.updated=Date.now()}
  }else if(d&&d.content!==src.value){d.content=src.value;d.updated=Date.now()}
}

/* ---------- explorer tree ---------- */
const tree=$('#tree');
let rows=[],renaming=null;
const I={
  chev:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.8 7.7 6 4.5 9.2"/></svg>',
  folder:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 3.8h4.3l1.5 1.6h6.6v7.4H1.8z"/></svg>',
  file:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.6 1.8h5.6l3.2 3.2v9.2H3.6z"/><path d="M9.2 1.8V5h3.2"/></svg>',
  py:'<svg class="lg" aria-hidden="true"><use href="#i-py"/></svg>',
  cpp:'<svg class="lg" aria-hidden="true"><use href="#i-cpp"/></svg>',
};
const CPP_EXT=/\.(cpp|cc|cxx|c\+\+|c|h|hpp|hh|hxx)$/i;
function fileIcon(n){const nm=docName(n);return /\.pyw?$/i.test(nm)?I.py:CPP_EXT.test(nm)?I.cpp:I.file}
function sorted(pid){
  const ch=kids(pid);
  const fo=ch.filter(n=>n.type==='folder').sort((a,b)=>cmpName(a.name,b.name));
  const fi=ch.filter(n=>n.type==='file').sort(lib.sort==='recent'?(a,b)=>(b.updated||0)-(a.updated||0):(a,b)=>cmpName(docName(a),docName(b)));
  return [...fo,...fi];
}
function fileCount(id){return descendants(id).filter(k=>lib.nodes[k].type==='file').length}
function renderTree(){
  if(renaming)return;
  rows=[];
  const walk=(pid,lvl)=>{for(const n of sorted(pid)){rows.push({n,lvl});if(n.type==='folder'&&lib.expanded[n.id])walk(n.id,lvl+1)}};
  walk(null,1);
  if(!rows.some(r=>r.n.id===selId))selId=lib.active;
  const focusId=rows.some(r=>r.n.id===selId)?selId:(rows[0]&&rows[0].n.id);
  tree.innerHTML=rows.length?rows.map(({n,lvl})=>{
    const folder=n.type==='folder',exp=folder&&!!lib.expanded[n.id];
    const cls=['tr',folder?'fo':'fi',n.id===lib.active?'on':'',n.id===selId?'sel':'',!folder&&!n.path?'draft':'',n.missing?'miss':'',!folder&&docDirty(n)?'unsaved':''].filter(Boolean).join(' ');
    const title=folder?`${n.name}`:n.path?(n.missing?`${n.path}\nNot found on disk`:n.path):'Only in Short++';
    const meta=folder?(fileCount(n.id)||''):`${bytes(n.id===lib.active?src.value:n.content)} B`;
    return `<div class="${cls}" id="n-${n.id}" data-id="${n.id}" role="treeitem" aria-level="${lvl}" aria-selected="${n.id===selId}"${folder?` aria-expanded="${exp}"`:''} tabindex="${n.id===focusId?0:-1}" draggable="true" title="${esc(title)}" style="--lvl:${lvl}">
      <span class="tw">${folder?I.chev:''}</span><span class="ic">${folder?I.folder:fileIcon(n)}</span><span class="nm"><i class="dd" aria-hidden="true"></i><span class="tx">${esc(folder?n.name:docName(n))}</span></span><span class="meta">${meta}</span></div>`;
  }).join(''):'<p class="ex-empty">No files yet. Create one or open a file from disk.</p>';
}
function focusRow(id,scroll=true){
  if(!id){selId=null;tree.querySelectorAll('.tr.sel').forEach(r=>{r.classList.remove('sel');r.setAttribute('aria-selected','false')});return}
  selId=id;
  tree.querySelectorAll('.tr').forEach(r=>{const me=r.dataset.id===id;r.tabIndex=me?0:-1;r.classList.toggle('sel',me);r.setAttribute('aria-selected',String(me))});
  const el=document.getElementById('n-'+id);if(el){el.focus({preventScroll:!scroll});if(scroll)el.scrollIntoView({block:'nearest'})}
}
function toggleFolder(id,open){lib.expanded[id]=open===undefined?!lib.expanded[id]:open;renderTree();focusRow(id);persist()}
function activate(id){const n=lib.nodes[id];if(!n)return;if(n.type==='folder')toggleFolder(id);else{openDoc(id);focusRow(id,false)}}

tree.addEventListener('click',e=>{
  if(e.target.closest('.rn'))return;
  const r=e.target.closest('.tr');
  if(!r){selId=null;focusRow(null);return}
  selId=r.dataset.id;activate(r.dataset.id);
});
tree.addEventListener('keydown',e=>{
  if(renaming||e.target.closest('.rn'))return;
  const r=e.target.closest('.tr');if(!r)return;
  const id=r.dataset.id,n=lib.nodes[id],ids=rows.map(x=>x.n.id),i=ids.indexOf(id);
  const k=e.key;let handled=true;
  if(k==='ArrowDown')focusRow(ids[Math.min(i+1,ids.length-1)]);
  else if(k==='ArrowUp')focusRow(ids[Math.max(i-1,0)]);
  else if(k==='Home')focusRow(ids[0]);
  else if(k==='End')focusRow(ids[ids.length-1]);
  else if(k==='ArrowRight'){if(n.type==='folder'){if(!lib.expanded[id])toggleFolder(id,true);else if(ids[i+1]&&lib.nodes[ids[i+1]].parent===id)focusRow(ids[i+1])}}
  else if(k==='ArrowLeft'){if(n.type==='folder'&&lib.expanded[id])toggleFolder(id,false);else if(n.parent)focusRow(n.parent)}
  else if(k==='Enter'||k===' ')activate(id);
  else if(k==='F2')startRename(id);
  else if(k==='Delete'||(isMac&&k==='Backspace'&&e.metaKey))deleteDefault(id);
  else if(k==='ContextMenu'||(k==='F10'&&e.shiftKey)){const b=r.getBoundingClientRect();showCtx(id,b.left+24,b.bottom)}
  else handled=false;
  if(handled){e.preventDefault();e.stopPropagation()}
});
tree.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const r=e.target.closest('.tr');
  if(r)focusRow(r.dataset.id,false);
  showCtx(r?r.dataset.id:null,e.clientX,e.clientY);
});

/* inline rename */
function startRename(id){
  const row=document.getElementById('n-'+id),n=lib.nodes[id];if(!row||!n)return;
  renaming=id;row.draggable=false;
  const cur=n.type==='file'?docName(n):n.name;
  const tx=row.querySelector('.tx');
  tx.innerHTML=`<input class="rn" spellcheck="false" aria-label="Rename">`;
  const inp=tx.querySelector('input');inp.value=cur;inp.focus();
  const dot=cur.lastIndexOf('.');inp.setSelectionRange(0,n.type==='file'&&dot>0?dot:cur.length);
  let done=false;
  const finish=async commit=>{
    if(done)return;done=true;
    const v=inp.value.trim();
    renaming=null;
    if(commit&&v&&v!==cur)await renameNode(id,v);
    renderTree();focusRow(id);
  };
  inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Escape'){e.preventDefault();finish(false)}});
  inp.addEventListener('blur',()=>finish(true));
  ['click','mousedown','dblclick'].forEach(ev=>inp.addEventListener(ev,e=>e.stopPropagation()));
}

/* drag and drop inside the tree */
// Dropping on a folder puts the item inside it. Dropping on a file puts it next to that file,
// so the whole destination folder (or the whole tree, for the top level) is outlined while dragging.
const NODE_MIME='application/x-shortpp-node';
let dragId=null,dropKey,hoverId=null,hoverT=0;
const hasFiles=e=>[...(e.dataTransfer?.types||[])].includes('Files');
const isNodeDrag=e=>[...(e.dataTransfer?.types||[])].includes(NODE_MIME);
function rowAt(target){return target.closest&&target.closest('.tr')}
function folderAt(target){const r=rowAt(target);if(!r)return null;const n=lib.nodes[r.dataset.id];return n?(n.type==='folder'?n.id:n.parent):null}
function canMove(id,to){
  const n=lib.nodes[id];if(!n||n.parent===to)return false;
  if(n.type==='folder'){let p=to;while(p){if(p===id)return false;p=lib.nodes[p]&&lib.nodes[p].parent}}
  return true;
}
function blockRows(folder){
  const i=rows.findIndex(r=>r.n.id===folder);if(i<0)return [];
  const out=[rows[i].n.id];
  for(let k=i+1;k<rows.length&&rows[k].lvl>rows[i].lvl;k++)out.push(rows[k].n.id);
  return out;
}
function paintDrop(){
  tree.querySelectorAll('.dz').forEach(r=>r.classList.remove('dz','dz-top','dz-bot'));
  tree.classList.toggle('drop-root',dropKey===null);
  if(!dropKey)return;
  const ids=blockRows(dropKey);
  ids.forEach((id,k)=>{const el=document.getElementById('n-'+id);if(!el)return;el.classList.add('dz');if(!k)el.classList.add('dz-top');if(k===ids.length-1)el.classList.add('dz-bot')});
}
function markDrop(folder){if(folder===dropKey)return;dropKey=folder;paintDrop()}
function clearDrop(){dropKey=undefined;paintDrop();clearTimeout(hoverT);hoverId=null}
function endDrag(){dragId=null;clearDrop();tree.classList.remove('dnd');tree.querySelectorAll('.dragging').forEach(r=>r.classList.remove('dragging'))}
function autoExpand(r){
  const id=r&&r.dataset.id,n=id&&lib.nodes[id];
  if(!n||n.type!=='folder'||lib.expanded[id]){clearTimeout(hoverT);hoverId=null;return}
  if(hoverId===id)return;
  hoverId=id;clearTimeout(hoverT);
  hoverT=setTimeout(()=>{
    lib.expanded[id]=true;renderTree();paintDrop();
    if(dragId){const el=document.getElementById('n-'+dragId);if(el)el.classList.add('dragging')}
    hoverId=null;
  },600);
}
tree.addEventListener('dragstart',e=>{
  const r=rowAt(e.target);if(!r||renaming)return;
  dragId=r.dataset.id;
  e.dataTransfer.setData(NODE_MIME,dragId);
  e.dataTransfer.effectAllowed='move';
  r.classList.add('dragging');tree.classList.add('dnd');
});
tree.addEventListener('dragend',endDrag);
tree.addEventListener('dragover',e=>{
  const internal=isNodeDrag(e);
  if(!internal&&!hasFiles(e))return;
  e.preventDefault();tree.classList.add('dnd');
  autoExpand(rowAt(e.target));
  const to=folderAt(e.target);
  if(internal&&!canMove(dragId,to)){e.dataTransfer.dropEffect='none';markDrop(undefined);return}
  e.dataTransfer.dropEffect=internal?'move':'copy';
  markDrop(to);
});
tree.addEventListener('dragleave',e=>{if(!tree.contains(e.relatedTarget)){clearDrop();if(!dragId)tree.classList.remove('dnd')}});
tree.addEventListener('drop',e=>{
  if(!isNodeDrag(e))return;
  e.preventDefault();
  const to=folderAt(e.target),id=dragId;
  endDrag();
  if(!id||!canMove(id,to))return;
  lib.nodes[id].parent=to;if(to)lib.expanded[to]=true;
  renderTree();focusRow(id);persist();
});
// If the dragged row was re-rendered (auto-expand), dragend never fires; the first mouse move after the drag cleans up.
tree.addEventListener('mousemove',e=>{if(tree.classList.contains('dnd')&&!e.buttons)endDrag()});

/* context menu */
const ctx=$('#ctx');
function showCtx(id,x,y){
  const n=id?lib.nodes[id]:null,items=[];
  const add=(label,run,opt={})=>items.push({label,run,...opt});
  const sep=()=>items.push({sep:true});
  if(!n){add('New C++ file',()=>newFile(null,'',null,'cpp'));add('New Python file',()=>newFile(null,'',null,'py'));add('New folder',()=>newFolder(null))}
  else if(n.type==='folder'){
    add('New C++ file',()=>newFile(n.id,'',null,'cpp'));add('New Python file',()=>newFile(n.id,'',null,'py'));add('New folder',()=>newFolder(n.id));sep();
    add('Rename',()=>startRename(n.id),{key:'F2'});
    add('Ungroup',()=>ungroup(n.id),{hint:'Keeps the files'});
    add('Delete folder',()=>removeFromList(n.id),{danger:true});
  }else{
    add('Open',()=>openDoc(n.id));sep();
    add('Rename',()=>startRename(n.id),{key:'F2'});
    add('Duplicate',()=>duplicate(n.id));
    if(n.path)add(REVEAL,()=>api.file.reveal(n.path),{disabled:n.missing});
    sep();
    add(n.path?'Remove from list':'Delete',()=>removeFromList(n.id),{key:isMac?'⌘⌫':'Del',danger:!n.path});
    if(n.path)add(TRASH+'…',()=>trashFile(n.id),{danger:true,disabled:n.missing});
  }
  ctx.innerHTML=items.map((it,i)=>it.sep?'<div class="sep" role="separator"></div>':`<button role="menuitem" data-i="${i}"${it.disabled?' disabled':''} class="${it.danger?'danger':''}"><span>${esc(it.label)}${it.hint?`<em>${esc(it.hint)}</em>`:''}</span><kbd>${it.key||''}</kbd></button>`).join('');
  ctx.hidden=false;
  const w=ctx.offsetWidth,h=ctx.offsetHeight;
  ctx.style.left=Math.min(x,innerWidth-w-8)+'px';
  ctx.style.top=Math.min(y,innerHeight-h-8)+'px';
  ctx._items=items;ctx._return=document.getElementById('n-'+id)||tree;
  const first=ctx.querySelector('button:not([disabled])');first&&first.focus();
}
function hideCtx(refocus){if(ctx.hidden)return;ctx.hidden=true;if(refocus&&ctx._return)ctx._return.focus()}
ctx.addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(!b||b.disabled)return;const it=ctx._items[+b.dataset.i];hideCtx(false);it.run()});
ctx.addEventListener('keydown',e=>{
  const items=[...ctx.querySelectorAll('button:not([disabled])')],i=items.indexOf(document.activeElement);
  if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus()}
  else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus()}
  else if(e.key==='Escape'){e.preventDefault();hideCtx(true)}
  else if(e.key==='Tab')hideCtx(false);
});

/* explorer header */
$('#ex-newfile').onclick=()=>newFile(selectedFolder());
$('#ex-newfolder').onclick=()=>newFolder(selectedFolder());
function syncSort(){const b=$('#ex-sort');b.textContent=lib.sort==='recent'?'Recent':'Name';b.title=`Sorted by ${lib.sort==='recent'?'last edited':'name'}. Click to switch.`}
$('#ex-sort').onclick=()=>{lib.sort=lib.sort==='recent'?'name':'recent';syncSort();renderTree();persist()};
function applySidebar(){
  $('.app').classList.toggle('noside',!lib.sidebar);
  document.body.classList.toggle('noside',!lib.sidebar);
  const b=$('#b-side');b.setAttribute('aria-pressed',String(lib.sidebar));b.title=(lib.sidebar?'Hide':'Show')+` explorer (${isMac?'⌘':'Ctrl+'}B)`;
}
/* resizing the explorer */
const rz=$('#ex-rz');
const exMax=()=>Math.max(EXW_MIN,Math.min(560,innerWidth-384-360));
function setExWidth(w,save){
  w=Math.round(Math.max(EXW_MIN,Math.min(exMax(),w||EXW_DEF)));
  lib.exWidth=w;document.body.style.setProperty('--exw-open',w+'px');
  rz.setAttribute('aria-valuenow',w);rz.setAttribute('aria-valuemin',EXW_MIN);rz.setAttribute('aria-valuemax',exMax());
  if(save)persist();
}
rz.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.preventDefault();rz.setPointerCapture(e.pointerId);
  const x0=e.clientX,w0=lib.exWidth;
  document.body.classList.add('resizing');
  const move=ev=>setExWidth(w0+ev.clientX-x0);
  const up=()=>{rz.removeEventListener('pointermove',move);rz.removeEventListener('pointerup',up);rz.removeEventListener('pointercancel',up);document.body.classList.remove('resizing');persist()};
  rz.addEventListener('pointermove',move);rz.addEventListener('pointerup',up);rz.addEventListener('pointercancel',up);
});
rz.addEventListener('dblclick',()=>setExWidth(EXW_DEF,true));
rz.addEventListener('keydown',e=>{
  const step=e.shiftKey?48:16,k=e.key;
  if(k==='ArrowLeft')setExWidth(lib.exWidth-step,true);
  else if(k==='ArrowRight')setExWidth(lib.exWidth+step,true);
  else if(k==='Home')setExWidth(EXW_MIN,true);
  else if(k==='End')setExWidth(exMax(),true);
  else if(k==='Enter')setExWidth(EXW_DEF,true);
  else return;
  e.preventDefault();
});
window.addEventListener('resize',()=>{if(lib.exWidth>exMax())setExWidth(lib.exWidth)});
$('#b-side').onclick=()=>{lib.sidebar=!lib.sidebar;applySidebar();persist()};

/* ---------- language switching ---------- */
function openExample(lang){const e=ENGINES[lang],f=selectedFolder();newFile(f,e.example,uniqueName('Example'+e.ext,f,'file'),lang);toast(`${e.label.split(' ')[0]} example opened`)}
function setLang(l){
  const changed=state.lang!==l;
  state.lang=l;
  syncTool();
  $('#ex-newfile').title=`New ${l==='py'?'Python':'C++'} file`;
  menu.querySelectorAll('[data-cmd=newCpp] kbd,[data-cmd=newPy] kbd').forEach(k=>k.textContent='');
  const kb=menu.querySelector(`[data-cmd=${l==='py'?'newPy':'newCpp'}] kbd`);if(kb)kb.textContent=isMac?'⌘N':'Ctrl+N';
  if(changed){renderChips();renderTips();state.active=null;renderHL();refreshAnalysis()}
}

/* ---------- commands ---------- */
const commands={
  new:()=>newFile(selectedFolder()),
  newFolder:()=>{if(!lib.sidebar){lib.sidebar=true;applySidebar()}newFolder(selectedFolder())},
  async open(){const r=await api.file.open();if(r){addDiskFile(r.path,r.content,selectedFolder());toast(`Opened ${baseName(r.path)}`)}},
  newCpp:()=>newFile(selectedFolder(),'',null,'cpp'),
  newPy:()=>newFile(selectedFolder(),'',null,'py'),
  example:()=>openExample(state.lang),
  exampleCpp:()=>openExample('cpp'),
  examplePy:()=>openExample('py'),
  save:()=>save(false),
  saveAs:()=>save(true),
  toggleSidebar:()=>$('#b-side').click(),
  run:runCode,
  stop:()=>api.run.stop(),
  undo:()=>editUndo(false),
  redo:()=>editUndo(true),
};
api.onMenu(cmd=>commands[cmd]&&commands[cmd]());

/* file menu */
const mBtn=$('#m-file'),menu=$('#file-menu');
menu.querySelectorAll('kbd[data-k]').forEach(k=>{k.textContent=isMac?('⌘'+k.dataset.k).replace('⌘Shift+','⇧⌘'):'Ctrl+'+k.dataset.k});
function openMenu(focusFirst){hideCtx(false);menu.hidden=false;mBtn.setAttribute('aria-expanded','true');if(focusFirst)menu.querySelector('button').focus()}
function closeMenu(refocus){if(menu.hidden)return;menu.hidden=true;mBtn.setAttribute('aria-expanded','false');if(refocus)mBtn.focus()}
mBtn.addEventListener('click',()=>menu.hidden?openMenu(false):closeMenu(false));
mBtn.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();openMenu(true)}});
menu.addEventListener('click',e=>{const b=e.target.closest('[data-cmd]');if(!b)return;closeMenu(false);commands[b.dataset.cmd]()});
menu.addEventListener('keydown',e=>{
  const items=[...menu.querySelectorAll('button')],i=items.indexOf(document.activeElement);
  if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus()}
  else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus()}
  else if(e.key==='Escape'||e.key==='Tab'){closeMenu(e.key==='Escape')}
});
document.addEventListener('mousedown',e=>{
  if(!e.target.closest('.menu-wrap'))closeMenu(false);
  if(!e.target.closest('#ctx'))hideCtx(false);
});
window.addEventListener('blur',()=>{closeMenu(false);hideCtx(false);top_.classList.add('blur')});
window.addEventListener('focus',()=>{top_.classList.remove('blur');checkMissing()});
tree.addEventListener('scroll',()=>hideCtx(false));

/* window controls */
$('#w-min').onclick=()=>api.win.minimize();
$('#w-max').onclick=()=>api.win.toggleMaximize();
$('#w-close').onclick=async()=>{await persist();api.win.close()};
api.win.onState(({maximized,fullscreen})=>{
  top_.classList.toggle('max',!!maximized);top_.classList.toggle('fs',!!fullscreen);
  $('#w-max').setAttribute('aria-label',maximized?'Restore':'Maximize');
});

/* shortcuts (macOS routes these through the native menu) */
// Other fields keep their own native undo; only the editor uses ours.
function editUndo(isRedo){
  const el=document.activeElement;
  if(el&&el!==src&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA')){try{document.execCommand(isRedo?'redo':'undo')}catch(err){}return}
  isRedo?redo():undo();
}
document.addEventListener('keydown',e=>{
  if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='i')){api.devtools();return}
  if((isMac?e.metaKey:e.ctrlKey)&&!e.altKey&&e.key==='Enter'){e.preventDefault();runCode();return}
  if((isMac?e.metaKey:e.ctrlKey)&&!e.altKey){
    const k=e.key.toLowerCase();
    if(k==='z'||(k==='y'&&!isMac)){
      const el=document.activeElement;
      if(el&&el!==src&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'))return;
      e.preventDefault();editUndo(k==='y'||e.shiftKey);return;
    }
  }
  if(isMac||!e.ctrlKey||e.altKey)return;
  const k=e.key.toLowerCase();
  const cmd=k==='n'?(e.shiftKey?'newFolder':'new'):k==='o'?'open':k==='s'?(e.shiftKey?'saveAs':'save'):k==='b'?'toggleSidebar':null;
  if(cmd){e.preventDefault();commands[cmd]()}
});

/* dropping files from the OS */
let dragDepth=0;
document.addEventListener('dragenter',e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth++;$('#drop').hidden=false});
document.addEventListener('dragleave',e=>{if(!hasFiles(e))return;if(--dragDepth<=0){dragDepth=0;$('#drop').hidden=true}});
document.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
document.addEventListener('drop',async e=>{
  if(!hasFiles(e))return;
  e.preventDefault();e.stopPropagation();
  dragDepth=0;$('#drop').hidden=true;
  const inTree=tree.contains(e.target),folder=inTree?folderAt(e.target):selectedFolder();
  endDrag();
  const files=[...e.dataTransfer.files];let last=null,failed=0;
  for(const f of files){
    const p=api.file.pathFor(f);
    const r=p?await api.file.read(p):{path:null,content:await f.text()};
    if(!r){failed++;continue}
    last=r.path?addDiskFile(r.path,r.content,folder,false):null;
    if(!r.path){const id=uid(),now=Date.now();lib.nodes[id]={id,type:'file',parent:folder,name:f.name,path:null,content:r.content,saved:'',base:bytes(r.content),target:null,created:now,updated:now};last=id}
  }
  if(last)openDoc(last);
  const ok=files.length-failed;
  toast(failed?`Opened ${ok}, couldn’t read ${failed}`:ok===1?`Opened ${files[0].name}`:`Opened ${ok} files`);
},true);

/* ---------- running the current file ---------- */
const RUN_DEF_H=220,RUN_MIN_H=140;
let toolchain=null,running=false;
const outEl=$('#out'),stdinEl=$('#stdin'),runEl=$('#run');
let outView='out',lastRun=null;

// The status bar names the compiler that will actually run the code.
function toolLabel(){
  const t=toolchain&&(state.lang==='py'?toolchain.py:toolchain.cpp);
  if(!t)return eng().label;
  const m=t.version.match(/(\d+\.\d+(?:\.\d+)?)\s*$/)||t.version.match(/(\d+\.\d+(?:\.\d+)?)/);
  return t.cmd+(m?' '+m[1]:'');
}
function syncTool(){
  const t=toolchain&&(state.lang==='py'?toolchain.py:toolchain.cpp),el=$('#lang');
  el.textContent=toolLabel();
  el.title=t?t.version:(toolchain?`No ${state.lang==='py'?'Python':'C++ compiler'} found on this machine`:'');
}
function setVerdict(cls,text){const v=$('#verdict');v.className='verdict'+(text?' on '+cls:'');v.textContent=text||''}
function runMeta(t){$('#run-meta').textContent=t||''}
function fmtMs(ms){return ms<1000?`${ms} ms`:`${(ms/1000).toFixed(2)} s`}
// The first line where the two outputs differ, so a broken golf edit is easy to spot.
function firstDiff(a,b){
  const x=a.split('\n'),y=b.split('\n');
  for(let i=0;i<Math.max(x.length,y.length);i++)if(x[i]!==y[i])return i+1;
  return 0;
}
const trimEnd=s=>String(s==null?'':s).replace(/[ \t]+$/gm,'').replace(/\n+$/,'');
function paintOut(){
  const d=activeDoc();
  if(outView==='exp'){outEl.innerHTML=d&&d.expected!=null?esc(d.expected):'<span class="dim">No expected output saved yet. Run the code, then press “Set as expected”.</span>';return}
  if(!lastRun){outEl.innerHTML='<span class="dim">Press Run to build and run this file.</span>';return}
  const r=lastRun;
  let html='';
  if(r.stage==='missing')html=`<span class="e">${esc(r.tool==='python'?'Python was not found on this machine.':'No C++ compiler was found on this machine.')}</span>\n<span class="dim">${esc(r.hint||'')}</span>`;
  else if(r.error)html=`<span class="e">${esc(r.error)}</span>`;
  else{
    if(r.stage==='compile')html+=`<span class="e">${esc(r.err||'Compilation failed.')}</span>`;
    else{
      const exp=r.expected;
      if(exp!=null&&r.diffLine){
        const lines=(r.out||'').split('\n');
        html+=lines.map((l,i)=>i+1===r.diffLine?`<span class="diff">${esc(l)||' '}</span>`:esc(l)).join('\n');
      }else html+=esc(r.out||'');
      if(r.err)html+=(html?'\n':'')+`<span class="e">${esc(r.err)}</span>`;
      if(!r.out&&!r.err)html='<span class="dim">(no output)</span>';
    }
    if(r.capped)html+='\n<span class="dim">… output truncated</span>';
    if(r.timedOut)html+='\n<span class="e">Stopped: took too long.</span>';
  }
  outEl.innerHTML=html;
}
function syncOutTabs(){
  const d=activeDoc(),has=d&&d.expected!=null;
  $('#out-tabs').hidden=!has;
  if(!has)outView='out';
  $('#out-tabs').querySelectorAll('.t2').forEach(b=>b.classList.toggle('on',b.dataset.o===outView));
  $('#b-expect').textContent=has?'Update expected':'Set as expected';
  $('#b-expect').disabled=!lastRun||lastRun.stage!=='run'||!!lastRun.error;
}
$('#out-tabs').addEventListener('click',e=>{const b=e.target.closest('.t2');if(!b)return;outView=b.dataset.o;syncOutTabs();paintOut()});
function loadRunPane(){
  const d=activeDoc();
  stdinEl.value=d&&d.stdin||'';
  lastRun=null;outView='out';setVerdict('','');runMeta('');
  syncOutTabs();paintOut();
}
stdinEl.addEventListener('input',()=>{const d=activeDoc();if(d){d.stdin=stdinEl.value;scheduleSave()}});

async function ensureToolchain(force){
  try{toolchain=await api.run.toolchain(force)}catch(e){toolchain=null}
  syncTool();
  return toolchain;
}
const TOOL_HINT={
  darwin:{cpp:'Install the Xcode command line tools: xcode-select --install',py:'Install Python from python.org, then restart Short++.'},
  win32:{cpp:'Install MinGW-w64 (for example through MSYS2) and add g++ to PATH.',py:'Install Python from python.org with “Add to PATH” checked.'},
  linux:{cpp:'Install a compiler, for example: sudo apt install g++',py:'Install Python, for example: sudo apt install python3'},
};
async function runCode(){
  if(running)return;
  const d=activeDoc();if(!d)return;
  const lang=state.lang;
  running=true;$('#b-run').disabled=true;$('#b-stop').hidden=false;
  setVerdict('','');runMeta('Running…');
  if(runEl.classList.contains('closed'))toggleRun(true);
  let r;
  try{r=await api.run.code({lang,code:src.value,input:stdinEl.value,timeout:5000})}
  catch(e){r={stage:'error',error:String(e&&e.message||e)}}
  running=false;$('#b-run').disabled=false;$('#b-stop').hidden=true;
  if(r&&r.stage==='missing'){
    const h=TOOL_HINT[(toolchain&&toolchain.platform)||api.platform]||TOOL_HINT.linux;
    r.hint=r.tool==='python'?h.py:h.cpp;
    setVerdict('err',r.tool==='python'?'No Python':'No compiler');runMeta('');
  }else if(!r||r.error){setVerdict('err','Error');runMeta('')}
  else if(r.stage==='compile'){setVerdict('err','Compile error');runMeta(r.ms?fmtMs(r.ms):'')}
  else{
    const exp=d.expected;
    r.expected=exp;
    const parts=[];
    if(r.compileMs)parts.push(`build ${fmtMs(r.compileMs)}`);
    parts.push(`run ${fmtMs(r.ms)}`);
    if(r.code!==0&&r.code!=null)parts.push(`exit ${r.code}`);
    else if(r.signal)parts.push(String(r.signal));
    runMeta(parts.join(' · '));
    if(r.timedOut)setVerdict('err','Timed out');
    else if(exp!=null){
      const ok=trimEnd(r.out)===trimEnd(exp);
      r.diffLine=ok?0:firstDiff(trimEnd(r.out),trimEnd(exp));
      setVerdict(ok?'pass':'fail',ok?'Matches expected':`Differs at line ${r.diffLine}`);
    }
    else if(r.code!==0&&r.code!=null)setVerdict('err','Non-zero exit');
    else setVerdict('pass','Done');
  }
  lastRun=r;outView='out';syncOutTabs();paintOut();
}
$('#b-run').onclick=runCode;
$('#b-stop').onclick=()=>api.run.stop();
$('#b-expect').onclick=()=>{
  const d=activeDoc();if(!d||!lastRun||lastRun.stage!=='run')return;
  d.expected=lastRun.out||'';
  lastRun.expected=d.expected;lastRun.diffLine=0;
  setVerdict('pass','Matches expected');syncOutTabs();paintOut();persist();
  toast('Saved as the expected output');
};
function toggleRun(open){
  const o=open===undefined?runEl.classList.contains('closed'):open;
  runEl.classList.toggle('closed',!o);
  $('#run-toggle').setAttribute('aria-expanded',String(o));
  lib.runOpen=o;persist();
}
$('#run-toggle').onclick=()=>toggleRun();
function setRunH(h,save){
  h=Math.round(Math.max(RUN_MIN_H,Math.min(Math.max(RUN_MIN_H,innerHeight-260),h||RUN_DEF_H)));
  lib.runH=h;document.body.style.setProperty('--runh',h+'px');
  if(save)persist();
}
const rrz=$('#run-rz');
rrz.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.preventDefault();rrz.setPointerCapture(e.pointerId);
  const y0=e.clientY,h0=lib.runH;
  document.body.classList.add('rowsize');
  const move=ev=>setRunH(h0-(ev.clientY-y0));
  const up=()=>{rrz.removeEventListener('pointermove',move);rrz.removeEventListener('pointerup',up);rrz.removeEventListener('pointercancel',up);document.body.classList.remove('rowsize');persist()};
  rrz.addEventListener('pointermove',move);rrz.addEventListener('pointerup',up);rrz.addEventListener('pointercancel',up);
});
rrz.addEventListener('dblclick',()=>setRunH(RUN_DEF_H,true));
rrz.addEventListener('keydown',e=>{
  const step=e.shiftKey?48:16;
  if(e.key==='ArrowUp')setRunH(lib.runH+step,true);
  else if(e.key==='ArrowDown')setRunH(lib.runH-step,true);
  else return;
  e.preventDefault();
});
window.addEventListener('resize',()=>setRunH(lib.runH));

/* ---------- init ---------- */
function syncOpts(){renderChips();renderTips();syncTool()}
(async function init(){
  let L=null;try{L=await api.store.get('library')}catch(e){}
  if(L&&L.nodes&&Object.keys(L.nodes).length){
    Object.assign(lib,{nodes:L.nodes,active:L.active,expanded:L.expanded||{},sort:L.sort||'name',sidebar:L.sidebar!==false,exWidth:L.exWidth||EXW_DEF,runH:L.runH||RUN_DEF_H,runOpen:L.runOpen!==false,templates:Array.isArray(L.templates)?L.templates:[]});
    if(L.opts){if('imp' in L.opts)Object.assign(state.opts.cpp,L.opts);else{Object.assign(state.opts.cpp,L.opts.cpp||{});Object.assign(state.opts.py,L.opts.py||{})}}
  }else{
    // first launch, or migrating the single-buffer version
    let old=null;try{old=await api.store.get('state')}catch(e){}
    const id=uid(),now=Date.now();
    if(old&&typeof old.code==='string'){
      const p=old.file&&old.file.path;
      lib.nodes[id]={id,type:'file',parent:null,name:p?baseName(p):'Untitled 1',path:p||null,content:old.code,saved:(old.file&&old.file.saved)||'',base:old.base??bytes(old.code),target:old.target||null,created:now,updated:now};
      if(old.opts)Object.assign(state.opts.cpp,old.opts);
    }else lib.nodes[id]={id,type:'file',parent:null,name:'Example.cpp',path:null,content:EXAMPLE,saved:'',base:bytes(EXAMPLE),target:null,created:now,updated:now};
    lib.active=id;
  }
  const start=lib.nodes[lib.active]&&lib.nodes[lib.active].type==='file'?lib.active:(mostRecentFile(new Set())||{}).id;
  // Detach the active document first: the setup below can persist, and persisting copies the
  // still-empty editor into whatever document is active.
  lib.active=null;
  setExWidth(lib.exWidth);setRunH(lib.runH);toggleRun(lib.runOpen!==false);applySidebar();syncSort();syncOpts();
  histReset();
  if(start)openDoc(start);else newFile(null);
  checkMissing();ensureToolchain();
  $('#run-kbd').textContent=isMac?'⌘⏎':'Ctrl+Enter';
})();
