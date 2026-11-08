/* ---------- lexer ---------- */
const isW=ch=>!!ch&&(/[\w$]/.test(ch)||ch>'\x7f');
function lex(s,noPP){
  const T=[],n=s.length;let i=0,ls=!noPP;
  const push=(t,j)=>{T.push({t,s:i,e:j,v:s.slice(i,j)});i=j};
  while(i<n){
    const c=s[i];
    if(c==='\n'){push('nl',i+1);if(!noPP)ls=true;continue}
    if(c===' '||c==='\t'||c==='\r'||c==='\f'||c==='\v'){let j=i+1;while(j<n&&' \t\r\f\v'.includes(s[j]))j++;push('ws',j);continue}
    if(c==='\\'&&(s[i+1]==='\n'||(s[i+1]==='\r'&&s[i+2]==='\n'))){push('ws',i+(s[i+1]==='\r'?3:2));continue}
    if(ls&&c==='#'){
      let j=i+1;
      while(j<n&&s[j]!=='\n'){
        const d=s[j];
        if(d==='\\'&&s[j+1]==='\n'){j+=2;continue}
        if(d==='/'&&s[j+1]==='*'){const k=s.indexOf('*/',j+2);j=k<0?n:k+2;continue}
        if(d==='/'&&s[j+1]==='/'){while(j<n&&s[j]!=='\n')j++;break}
        if(d==='"'||d==="'"){let k=j+1;while(k<n&&s[k]!==d&&s[k]!=='\n'){if(s[k]==='\\')k++;k++}j=(k<n&&s[k]===d)?k+1:Math.min(k,n);continue}
        j++;
      }
      push('pp',j);ls=false;continue;
    }
    ls=false;
    if(c==='/'&&s[i+1]==='/'){let j=i+2;while(j<n&&s[j]!=='\n'){if(s[j]==='\\'&&s[j+1]==='\n'){j+=2;continue}j++}push('com',j);continue}
    if(c==='/'&&s[i+1]==='*'){const k=s.indexOf('*/',i+2);push('com',k<0?n:k+2);continue}
    if(c==='"'||c==="'"){let j=i+1;while(j<n&&s[j]!==c&&s[j]!=='\n'){if(s[j]==='\\')j++;j++}push(c==='"'?'str':'chr',(j<n&&s[j]===c)?j+1:Math.min(j,n));continue}
    if(/[A-Za-z_$]/.test(c)||c>'\x7f'){
      let j=i+1;while(j<n&&isW(s[j]))j++;
      const w=s.slice(i,j);
      if(s[j]==='"'&&/^(?:u8|u|U|L)?R$/.test(w)){const p=s.indexOf('(',j);if(p>0&&p-j<=17){const d=s.slice(j+1,p);const k=s.indexOf(')'+d+'"',p);push('str',k<0?n:k+d.length+2);continue}}
      push('id',j);continue;
    }
    if(/\d/.test(c)||(c==='.'&&/\d/.test(s[i+1]||''))){
      const hex=c==='0'&&/[xX]/.test(s[i+1]||'');let j=i+1;
      while(j<n){const d=s[j];
        if(/[\w.]/.test(d)){j++;continue}
        if(d==="'"&&/\w/.test(s[j+1]||'')){j++;continue}
        if((d==='+'||d==='-')&&(hex?/[pP]/:/[eE]/).test(s[j-1])){j++;continue}
        break}
      push('num',j);continue;
    }
    push('op',i+1);
  }
  return T;
}

/* ---------- minifier ---------- */
const PAIRS=new Set(['++','--','+=','-=','&&','||','<<','>>','==','!=','<=','>=','->','//','/*','*/','::','&=','|=','^=','%=','*=','/=','<:','<%','%:','%>',':>','##','..','.*']);
function needSpace(out,next,pt){
  const a=out[out.length-1],b=next[0];if(!a||!b)return false;
  if(isW(a)&&isW(b))return true;
  if(PAIRS.has(a+b))return true;
  if((a==='"'||a==="'")&&isW(b))return true;
  if(pt&&pt.t==='id'&&(b==='"'||b==="'")&&/^(?:u8|u|U|L)?R?$/.test(pt.v))return true;
  if(pt&&pt.t==='num'&&((/[eEpP]$/.test(pt.v)&&(b==='+'||b==='-'))||b==='.'||b==="'"))return true;
  if(a==='.'&&/\d/.test(b))return true;
  return false;
}
function joinTokens(T){
  let out='',pend=false,pt=null;
  for(const k of T){
    if(k.t==='ws'||k.t==='nl'||k.t==='com'){pend=true;continue}
    if(pend&&pt&&needSpace(out,k.v,pt))out+=' ';
    out+=k.v;pt=k;pend=false;
  }
  return out;
}
const CSTD=new Set('stdio.h stdlib.h string.h math.h ctype.h limits.h stdint.h assert.h time.h float.h stdbool.h'.split(' '));
const mergeable=h=>h==='bits/stdc++.h'||CSTD.has(h)||/^[a-z_]+$/.test(h);
function minPP(v,opt){
  v=v.replace(/\\\r?\n/g,' ');
  const m=v.match(/^#\s*([A-Za-z_]*)([\s\S]*)$/);if(!m)return v.trim();
  const dir=m[1];
  const rest=lex(m[2],true).map(k=>k.t==='com'?' ':k.v).join('');
  if(dir==='include'||dir==='import'){
    let body=rest.trim();if(body[0]==='<')body=body.replace(/\s+/g,'');
    const d=(dir==='include'&&opt.imp)?'import':dir;
    return '#'+d+(isW(body[0])?' ':'')+body;
  }
  if(dir==='define'){
    const mm=rest.match(/^[ \t]+([A-Za-z_$][\w$]*)(\([^)]*\))?([\s\S]*)$/);
    if(!mm)return ('#define '+joinTokens(lex(rest,true))).trim();
    const b=joinTokens(lex(mm[3],true));
    if(mm[2])return '#define '+mm[1]+joinTokens(lex(mm[2],true))+b;
    return '#define '+mm[1]+(b?' '+b:'');
  }
  const b=joinTokens(lex(rest,true));
  return '#'+dir+(b&&isW(b[0])?' ':'')+b;
}
function masks(code){
  const T=lex(code);let mk='',mp='';
  for(const k of T){
    let a=k.v,b=k.v;
    if(k.t==='com'){a=b=k.v.replace(/[^\n]/g,' ')}
    else if(k.t==='str'||k.t==='chr'){const q=k.v;a=b=q.length>1?q[0]+q.slice(1,-1).replace(/[^\n]/g,'§')+q[q.length-1]:q}
    else if(k.t==='pp'){b=k.v.replace(/[^\n]/g,' ')}
    mk+=a;mp+=b;
  }
  return {T,mk,mp};
}
function matchF(s,i){const o=s[i],c={'(':')','{':'}','[':']'}[o];let d=0;for(let j=i;j<s.length;j++){if(s[j]===o)d++;else if(s[j]===c){if(--d===0)return j}}return -1}
function matchB(s,i){const c=s[i],o={')':'(','}':'{',']':'['}[c];let d=0;for(let j=i;j>=0;j--){if(s[j]===c)d++;else if(s[j]===o){if(--d===0)return j}}return -1}
function prevNW(s,i){let j=i-1;while(j>=0&&/\s/.test(s[j]))j--;return j}
function nextNW(s,i){let j=i;while(j<s.length&&/\s/.test(s[j]))j++;return j}
function wordEnd(s,j){if(j<0||!isW(s[j]))return '';let k=j;while(k>0&&isW(s[k-1]))k--;return s.slice(k,j+1)}
const wordBefore=(s,i)=>wordEnd(s,prevNW(s,i));
function findRet0(mp){
  const m=/\breturn\s+0\s*;(?=\s*\}\s*$)/.exec(mp);if(!m)return null;
  const close=mp.search(/\}\s*$/),open=matchB(mp,close);if(open<0)return null;
  const p=prevNW(mp,open);if(mp[p]!==')')return null;
  const po=matchB(mp,p);if(po<0)return null;
  return wordBefore(mp,po)==='main'?m:null;
}
function minify(code,opt){
  if(opt.ren)code=renameCode(code);
  const parts=[];let cur=[];
  for(const k of lex(code)){
    if(k.t==='pp'){if(cur.length){parts.push({t:'c',toks:cur});cur=[]}parts.push({t:'p',v:minPP(k.v,opt)})}
    else cur.push(k);
  }
  if(cur.length)parts.push({t:'c',toks:cur});
  if(opt.bits){
    const hs=parts.filter(p=>{if(p.t!=='p')return false;const h=(p.v.match(/^#(?:include|import)<([^>]+)>$/)||[])[1];return h&&mergeable(h)});
    if(hs.length>=2){
      const one=(opt.imp?'#import':'#include')+'<bits/stdc++.h>';
      const cost=hs.reduce((a,p)=>a+p.v.length+1,0);
      if(one.length+1<cost)hs.forEach((p,i)=>{p.v=i?'':one});
    }
  }
  let out='';
  for(const p of parts){
    if(p.t==='p'){if(!p.v)continue;if(out&&!out.endsWith('\n'))out+='\n';out+=p.v+'\n'}
    else{const c=joinTokens(p.toks);if(!c)continue;if(out&&!out.endsWith('\n')&&needSpace(out,c,null))out+=' ';out+=c}
  }
  out=out.replace(/\s+$/,'');
  if(opt.ret){const m=findRet0(masks(out).mp);if(m)out=out.slice(0,m.index)+out.slice(m.index+m[0].length)}
  return out;
}
function applyEdits(text,edits){
  const es=[...edits].sort((a,b)=>(b.s-a.s)||(b.e-a.e));let lim=Infinity;
  for(const x of es){if(x.e>lim)continue;text=text.slice(0,x.s)+x.r+text.slice(x.e);lim=x.s}
  return text;
}

/* ---------- suggestion rules ---------- */
function each(re,str,fn){re.lastIndex=0;let m;while((m=re.exec(str))){fn(m);if(!m[0].length)re.lastIndex++}}
function boolCtx(s,i,e){
  const p=prevNW(s,i),pc=p<0?'':s[p];let ok=false;
  if(pc==='(')ok=/^(if|while)$/.test(wordBefore(s,p));
  else if((pc==='&'&&s[p-1]==='&')||(pc==='|'&&s[p-1]==='|'))ok=true;
  if(!ok)return false;
  const n=nextNW(s,e),nc=s[n]||'';
  return nc===')'||nc==='?'||(nc==='&'&&s[n+1]==='&')||(nc==='|'&&s[n+1]==='|');
}
function topLevelBad(t){
  let d=0;
  for(let k=0;k<t.length;k++){
    const ch=t[k];
    if('([{'.includes(ch))d++;
    else if(')]}'.includes(ch))d--;
    else if(d===0){
      if(ch===','||ch==='?')return true;
      if(ch==='|'&&t[k+1]==='|')return true;
      if(ch==='='){
        const a=t[k-1];
        if(t[k+1]==='='){k++;continue}
        if(a==='='||a==='!')continue;
        if(a==='<'||a==='>'){if(t[k-2]===a)return true;continue}
        return true;
      }
    }
  }
  return false;
}
function charVal(v){
  let m=v.match(/^'([^\\'])'$/);if(m){const x=m[1].charCodeAt(0);return x<128?x:null}
  m=v.match(/^'\\([ntr0\\'"])'$/);if(m)return {n:10,t:9,r:13,'0':0,'\\':92,"'":39,'"':34}[m[1]];
  return null;
}
function afterPP(M,before){let pos=0;for(const t of M.T)if(t.t==='pp'&&t.e<=before){pos=t.e;if(M.mk[pos]==='\n')pos++}return pos}
const STDN='cin|cout|cerr|endl|vector|string|pair|map|set|multiset|unordered_map|unordered_set|queue|priority_queue|stack|deque|bitset|sort|stable_sort|reverse|unique|max|min|swap|max_element|min_element|lower_bound|upper_bound|binary_search|fill|accumulate|next_permutation|getline|to_string|stoi|stoll|__gcd|gcd|lcm|ios|ios_base|make_pair|greater|less|abs|tuple|iota|nth_element|numeric_limits|stringstream|istringstream|setprecision|fixed';

/* ---------- identifier renamer ---------- */
const KEYWORDS=new Set(`alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq override final main defined`.split(/\s+/));
const BT=new Set(`int long short char double float bool void unsigned signed auto size_t string wstring vector pair map set multiset multimap unordered_map unordered_set unordered_multimap queue priority_queue stack deque array bitset tuple list complex int64_t uint64_t int32_t uint32_t int16_t uint16_t int8_t uint8_t __int128 wchar_t stringstream istringstream ostringstream function greater less`.split(/\s+/));
const QUAL=new Set('const static constexpr inline register volatile mutable extern unsigned signed typename struct class'.split(' '));
const EXTERN=new Set(STDN.split('|').concat(`std printf scanf puts putchar getchar gets fgets fputs fopen fclose freopen fflush sprintf sscanf memset memcpy memmove strlen strcmp strncmp strcpy strcat strchr strstr sqrt cbrt pow abs fabs labs llabs floor ceil round trunc log log2 log10 exp sin cos tan asin acos atan atan2 hypot fmod exit rand srand time clock malloc calloc free qsort bsearch EOF NULL INT_MAX INT_MIN LLONG_MAX LLONG_MIN UINT_MAX ULLONG_MAX CHAR_MAX stdin stdout stderr isdigit isalpha isalnum isspace isupper islower toupper tolower atoi atol atoll strtol strtoll assert M_PI y0 y1 j0 j1 jn yn count find tie array index signal errno`.split(/\s+/)));
const STD_MEMBERS=new Set(`first second size length push_back pop_back emplace_back emplace push pop top front back begin end rbegin rend cbegin cend insert erase find count clear empty c_str substr resize reserve assign at data swap real imag lower_bound upper_bound get set reset flip any none all test precision what value key`.split(/\s+/));
function matchTok(T,i){const o=T[i].v,c={'(':')','[':']','{':'}'}[o];let d=0;for(let j=i;j<T.length;j++){if(T[j].v===o)d++;else if(T[j].v===c){if(--d===0)return j}}return -1}
function sigTokens(code){
  const out=[];
  for(const k of lex(code)){
    if(k.t==='ws'||k.t==='nl'||k.t==='com')continue;
    if(k.t!=='pp'){out.push({t:k.t,v:k.v,s:k.s,e:k.e});continue}
    const m=k.v.match(/^#\s*([A-Za-z_]*)/),dir=m[1];
    if(!/^(define|undef|ifdef|ifndef|if|elif)$/.test(dir))continue;
    const base=k.s+m[0].length;
    const sub=lex(k.v.slice(m[0].length),true).filter(x=>x.t!=='ws'&&x.t!=='nl'&&x.t!=='com').map(x=>({t:x.t,v:x.v,s:base+x.s,e:base+x.e,pp:true}));
    if(dir==='define'&&sub[0]&&sub[0].t==='id')sub[0].macro=true;
    out.push({t:'ppstart',v:'',s:k.s,e:k.s},...sub,{t:'ppend',v:'',s:k.e,e:k.e});
  }
  return out;
}
function renamePlan(code){
  const T=sigTokens(code),N=T.length;
  const isId=k=>!!k&&k.t==='id';
  const userTypes=new Set(),decl=new Set(),members=new Set(),noRename=new Set(),strMacros=new Set();
  const isType=v=>BT.has(v)||userTypes.has(v);
  const bar=k=>!k||k.t==='ppstart'||k.t==='ppend';
  // pass 1: macros and user-defined type names
  for(let i=0;i<N;i++){
    const k=T[i];if(!isId(k))continue;
    if(k.macro){
      decl.add(k.v);
      const nx=T[i+1];
      if(nx&&nx.v==='('&&nx.s===k.e&&nx.pp){
        let j=i+2;for(;j<N&&T[j].pp&&T[j].v!==')';j++)if(isId(T[j]))decl.add(T[j].v);
        for(let q=j+1;q<N&&T[q].t!=='ppend';q++){if(T[q].v==='#'&&T[q+1]&&T[q+1].v!=='#'&&T[q-1].v!=='#'&&isId(T[q+1])){noRename.add(T[q+1].v);strMacros.add(k.v)}}
      }else{
        const body=[];for(let q=i+1;q<N&&T[q].t!=='ppend';q++)body.push(T[q]);
        if(body.length&&body.every(b=>isId(b)&&(BT.has(b.v)||QUAL.has(b.v))))userTypes.add(k.v);
      }
      continue;
    }
    if(/^(struct|class|union|enum|typename)$/.test(k.v)&&isId(T[i+1])&&!KEYWORDS.has(T[i+1].v))userTypes.add(T[i+1].v);
    if(k.v==='using'&&isId(T[i+1])&&T[i+2]&&T[i+2].v==='=')userTypes.add(T[i+1].v);
    if(k.v==='typedef'){
      let last=null,d=0;
      for(let j=i+1;j<N&&!bar(T[j]);j++){const v=T[j].v;
        if('([{'.includes(v))d++;else if(')]}'.includes(v))d--;else if(v===';'&&d<=0)break;
        if(isId(T[j])&&d===0&&!KEYWORDS.has(v)&&!BT.has(v))last=v}
      if(last)userTypes.add(last);
    }
  }
  // arguments of stringifying macros keep their names, since #x prints them
  for(let i=0;i<N;i++){if(isId(T[i])&&!T[i].macro&&strMacros.has(T[i].v)&&T[i+1]&&T[i+1].v==='('){const cl=matchTok(T,i+1);for(let q=i+2;q<cl;q++)if(isId(T[q]))noRename.add(T[q].v)}}
  // brace kinds: s = struct body, e = enum body, b = other block
  const kind=new Array(N),stack=[];
  for(let i=0;i<N;i++){
    const k=T[i];kind[i]=stack.length?stack[stack.length-1]:'g';
    if(k.pp)continue;
    if(k.v==='{'){
      let kd='b';
      for(let j=i-1;j>=0;j--){const v=T[j].v;
        if(v===';'||v==='{'||v==='}'||v===')'||bar(T[j]))break;
        if(v==='enum'){kd='e';break}
        if(v==='struct'||v==='class'||v==='union'){kd=T[j-1]&&T[j-1].v==='enum'?'e':'s';break}}
      stack.push(kd);
    }else if(k.v==='}')stack.pop();
  }
  const declare=(name,i)=>{if(KEYWORDS.has(name)||BT.has(name))return;(kind[i]==='s'?members:decl).add(name)};
  const skipPtr=j=>{while(T[j]&&(T[j].v==='*'||T[j].v==='&'))j++;return j};
  // pass 2: declarations
  for(let i=0;i<N;i++){
    const k=T[i];if(!isId(k))continue;
    if(kind[i]==='e'&&T[i-1]&&(T[i-1].v==='{'||T[i-1].v===',')){decl.add(k.v);continue}
    if(!isType(k.v))continue;
    let j=i+1;
    if(T[j]&&T[j].v==='<'){let d=0;for(;j<N;j++){const v=T[j].v;if(v==='<')d++;else if(v==='>'){if(--d===0){j++;break}}else if(v===';'||v==='{'||bar(T[j]))break}}
    while(T[j]&&T[j].v===':'&&T[j+1]&&T[j+1].v===':'&&isId(T[j+2]))j+=3;
    while(isId(T[j])&&(isType(T[j].v)||QUAL.has(T[j].v)))j++;
    j=skipPtr(j);
    if(isId(T[j])&&T[j].v==='const')j=skipPtr(j+1);
    if(T[j]&&T[j].v==='['&&k.v==='auto'){for(let q=j+1;q<N&&T[q].v!==']';q++)if(isId(T[q]))declare(T[q].v,q);continue}
    if(!isId(T[j])||KEYWORDS.has(T[j].v)||isType(T[j].v))continue;
    if(T[j+1]&&T[j+1].v===':'&&T[j+2]&&T[j+2].v===':')continue;
    declare(T[j].v,j);
    let q=j+1;
    if(T[q]&&T[q].v==='('){const cl=matchTok(T,q);if(cl<0)continue;q=cl+1;if(!T[q]||['{','const',';','->','noexcept','override'].includes(T[q].v))continue}
    for(let d=0;q<N;q++){const v=T[q].v;
      if(bar(T[q]))break;
      if(v==='('||v==='['||v==='{')d++;
      else if(v===')'||v===']'||v==='}'){if(!d)break;d--}
      else if(!d&&(v===';'||v===':'))break;
      else if(!d&&v===','){const r=skipPtr(q+1);if(isId(T[r])&&!KEYWORDS.has(T[r].v)&&!isType(T[r].v))declare(T[r].v,r);else break}
    }
  }
  // candidates
  const cand=new Set([...decl,...members,...userTypes]),skipped=[];
  for(const n of [...cand]){
    if(KEYWORDS.has(n)||BT.has(n)||noRename.has(n)){cand.delete(n);continue}
    if(EXTERN.has(n)||(members.has(n)&&STD_MEMBERS.has(n))){cand.delete(n);skipped.push(n)}
  }
  // occurrences
  const occ=new Map(),taken=new Set();
  for(let i=0;i<N;i++){
    const k=T[i];if(!isId(k))continue;
    let ren=cand.has(k.v);
    if(ren){
      const pv=T[i-1],pv2=T[i-2];
      const afterDot=pv&&(pv.v==='.'||(pv.v==='>'&&pv2&&pv2.v==='-'&&pv2.e===pv.s));
      if(afterDot&&!members.has(k.v))ren=false;
      if(pv&&pv.v===':'&&pv2&&pv2.v===':'&&pv2.e===pv.s){const ow=T[i-3];if(!(isId(ow)&&cand.has(ow.v)))ren=false}
      const nx=T[i+1];if(nx&&(nx.t==='str'||nx.t==='chr')&&nx.s===k.e)ren=false;
    }
    if(ren){if(!occ.has(k.v))occ.set(k.v,[]);occ.get(k.v).push({s:k.s,e:k.e})}
    else taken.add(k.v);
  }
  // assign shortest free names, most frequent first; one-letter names keep themselves
  const used=new Set(taken),map=new Map();
  for(const n of occ.keys())if(n.length===1){map.set(n,n);used.add(n)}
  const L='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',L2=L+'0123456789_';
  const pool=(function*(){for(const a of L)yield a;for(const a of L)for(const b of L2)yield a+b;for(const a of L)for(const b of L2)for(const c of L2)yield a+b+c})();
  const order=[...occ.keys()].filter(n=>!map.has(n)).sort((a,b)=>occ.get(b).length-occ.get(a).length||b.length-a.length);
  for(const n of order){
    let x;do{x=pool.next().value}while(x&&(used.has(x)||KEYWORDS.has(x)||EXTERN.has(x)||BT.has(x)));
    if(!x||x.length>=n.length){map.set(n,n);used.add(n);continue}
    map.set(n,x);used.add(x);
  }
  const items=[...occ.entries()].map(([from,ranges])=>({from,to:map.get(from),ranges})).filter(x=>x.to!==x.from)
    .sort((a,b)=>b.ranges.length*(b.from.length-b.to.length)-a.ranges.length*(a.from.length-a.to.length));
  return {items,skipped,save:items.reduce((a,x)=>a+x.ranges.length*(x.from.length-x.to.length),0)};
}
function renameCode(code){const pl=renamePlan(code);return applyEdits(code,pl.items.flatMap(x=>x.ranges.map(r=>({s:r.s,e:r.e,r:x.to}))))}

const RULES=[
{id:'rename',title:'Shorten variable and function names',desc:'',unit:'name',
 run(c,M){
  const pl=renamePlan(c);if(!pl.items.length||pl.save<=0)return [];
  const top=pl.items.slice(0,3).map(x=>`${x.from}→${x.to}`).join(', ');
  const desc=`자주 쓰는 이름부터 짧은 이름으로 바꾼다. ${top}${pl.items.length>3?` 외 ${pl.items.length-3}개`:''}.`+(pl.skipped.length?` 표준 라이브러리와 이름이 겹치는 ${pl.skipped.slice(0,3).join(', ')}는 그대로 둔다.`:'');
  return pl.items.map(x=>({s:x.ranges[0].s,e:x.ranges[0].e,ranges:x.ranges,edits:x.ranges.map(r=>({s:r.s,e:r.e,r:x.to})),save:x.ranges.length*(x.from.length-x.to.length),pv:[x.from,x.to],desc}));
 }},

{id:'import',title:'#include → #import',desc:'GCC에서는 경고만 뜨고 똑같이 동작한다.',
 run(c,M){const r=[];each(/#[ \t]*include\b/g,M.mk,m=>{const s=m.index,e=s+m[0].length;r.push({s,e,edits:[{s,e,r:'#import'}],save:1})});return r}},

{id:'bits',title:'Merge headers into bits/stdc++.h',desc:'표준 헤더가 여러 개면 bits/stdc++.h 하나가 더 짧다.',
 run(c,M){
  const hs=[];
  for(const k of M.T){if(k.t!=='pp')continue;const mm=k.v.match(/^#\s*(?:include|import)\s*<\s*([^>\s]+)\s*>/);if(mm&&mergeable(mm[1]))hs.push({k,h:mm[1]})}
  if(hs.length<2)return [];
  const save=hs.reduce((a,x)=>a+('#import<'+x.h+'>').length+1,0)-('#import<bits/stdc++.h>'.length+1);
  if(save<=0)return [];
  const dir=/import/.test(hs[0].k.v)?'#import':'#include';
  const edits=hs.map((x,i)=>{let e=x.k.e;if(i&&c[e]==='\n')e++;return i?{s:x.k.s,e,r:''}:{s:x.k.s,e:x.k.e,r:dir+'<bits/stdc++.h>'}});
  return [{s:hs[0].k.s,e:hs[hs.length-1].k.e,edits,save,pv:[hs.map(x=>'<'+x.h+'>').join(' '),'<bits/stdc++.h>']}];
 }},

{id:'ret',title:'Drop return 0;',desc:'main은 끝나면 자동으로 0을 반환한다.',
 run(c,M){const m=findRet0(M.mp);if(!m)return [];const s=m.index,e=s+m[0].length;return [{s,e,edits:[{s,e,r:''}],save:9}]}},

{id:'std',title:'',desc:'',
 run(c,M){
  const s=M.mp,occ=[];let userDecl=false;
  each(new RegExp('\\b(?:'+STDN+')\\b','g'),s,m=>{
    const p=prevNW(s,m.index),ch=p>=0?s[p]:'';
    if(ch==='.'||(ch===':'&&s[p-1]===':')||(ch==='>'&&s[p-1]==='-'))return;
    if(/^(int|long|short|char|double|float|bool|auto|void|unsigned|struct|class|const)$/.test(wordEnd(s,p)))userDecl=true;
    occ.push(m.index);
  });
  const u=/\busing\s+namespace\s+std\s*;/.exec(s);
  if(u){
    if(userDecl)return [];
    const k=occ.length,save=20-5*k;if(save<=0)return [];
    let e=u.index+u[0].length;while(c[e]===' '||c[e]==='\t')e++;if(c[e]==='\n')e++;
    return [{s:u.index,e:u.index+u[0].length,edits:[{s:u.index,e,r:''},...occ.map(i=>({s:i,e:i,r:'std::'}))],save,
      title:'Drop using namespace std;',desc:k?`std 이름을 ${k}번만 쓰므로 std::를 붙이는 쪽이 짧다(${5*k} B 대 20 B).`:'std 이름을 쓰지 않으므로 필요 없다.',
      pv:['using namespace std;',k?`std:: ×${k}`:'']}];
  }
  const q=[];each(/\bstd\s*::\s*/g,s,m=>q.push({s:m.index,e:m.index+m[0].length}));
  if(q.length<5)return [];
  const pos=afterPP(M,q[0].s);
  return [{s:q[0].s,e:q[0].e,edits:[...q.map(x=>({s:x.s,e:x.e,r:''})),{s:pos,e:pos,r:'using namespace std;\n'}],save:5*q.length-20,
    title:'Add using namespace std;',desc:`std::를 ${q.length}번 쓰므로 using 한 줄이 더 짧다.`,pv:[`std:: ×${q.length}`,'using namespace std;']}];
 }},

{id:'puts',title:'printf → puts',desc:'서식 없이 줄바꿈으로 끝나는 출력은 puts가 더 짧다.',
 run(c,M){const r=[];each(/\bprintf\s*\(\s*"((?:[^"\\\n]|\\.)*)\\n"\s*\)/g,c,m=>{
   if(M.mp[m.index]!=='p'||m[1].includes('%'))return;
   const s=m.index,e=s+m[0].length;r.push({s,e,edits:[{s,e,r:'puts("'+m[1]+'")'}],save:4});
 });return r}},

{id:'cout',title:'String cout → puts',desc:'고정된 문자열 한 줄 출력은 puts가 더 짧다. puts는 cstdio에 선언되어 있다.',
 run(c,M){const r=[];each(/\b(std\s*::\s*)?cout\s*<<\s*"((?:[^"\\\n]|\\.)*)"\s*(<<\s*(?:(?:std\s*::\s*)?endl|"\\n"|'\\n')\s*)?;/g,c,m=>{
   const i=m.index;if(M.mp[i]!==c[i])return;
   const p=prevNW(M.mp,i);
   if(p>=0){const pc=M.mp[p];if(pc==='.'||pc===':'||pc==='>')return;if(isW(pc)&&wordEnd(M.mp,p)!=='else')return}
   let t=m[2];
   if(!m[3]){const bs=(t.match(/\\+n$/)||[''])[0];if(!bs||(bs.length-1)%2!==1)return;t=t.slice(0,-2)}
   const before=(m[1]?'std::':'')+'cout<<"'+m[2]+'"'+(m[3]?'<<'+m[3].replace(/^<<\s*/,'').replace(/\s+/g,''):'')+';';
   const rep='puts("'+t+'");',save=before.length-rep.length;if(save<=0)return;
   r.push({s:i,e:i+m[0].length,edits:[{s:i,e:i+m[0].length,r:rep}],save});
 });return r}},

{id:'tc',title:'Test-case loop → for',desc:'입력과 반복 조건을 for 한 줄로 합친다.',
 run(c,M){const r=[],s=M.mp;
  each(/\b((?:std\s*::\s*)?cin\s*>>\s*([A-Za-z_]\w*))\s*;\s*while\s*\(\s*\2\s*--\s*\)/g,s,m=>{
    const i=m.index,e=i+m[0].length,p=prevNW(s,i);if(p>=0&&(s[p]==='.'||s[p]===':'))return;
    r.push({s:i,e,edits:[{s:i,e,r:`for(${m[1].replace(/\s+/g,'')};${m[2]}--;)`}],save:1});
  });
  each(/\bscanf\s*\(\s*"%d"\s*,\s*&\s*([A-Za-z_]\w*)\s*\)\s*;\s*while\s*\(\s*\1\s*--\s*\)/g,c,m=>{
    if(M.mp[m.index]!=='s')return;const i=m.index,e=i+m[0].length;
    r.push({s:i,e,edits:[{s:i,e,r:`for(scanf("%d",&${m[1]});${m[1]}--;)`}],save:1});
  });
  return r}},

{id:'sync',title:'Drop fast I/O setup',desc:'숏코딩에서는 보통 생략한다. 입력이 매우 많으면 시간 초과가 날 수 있다.',
 run(c,M){const r=[],s=M.mp;
  [/\b(?:std\s*::\s*)?ios(?:_base)?\s*::\s*sync_with_stdio\s*\(\s*\w*\s*\)\s*;/g,
   /\b(?:std\s*::\s*)?cin\s*\.\s*tie\s*\(\s*\w*\s*\)\s*(?:->\s*sync_with_stdio\s*\(\s*\w*\s*\)\s*)?;/g,
   /\b(?:std\s*::\s*)?cout\s*\.\s*tie\s*\(\s*\w*\s*\)\s*;/g].forEach(re=>each(re,s,m=>{
     const i=m.index,e=i+m[0].length;r.push({s:i,e,edits:[{s:i,e,r:''}],save:m[0].replace(/\s/g,'').length});
   }));
  return r.sort((a,b)=>a.s-b.s)}},

{id:'and',title:'if → &&',desc:'else 없는 한 줄 if는 단락 평가로 바꿀 수 있다. 반환형이 void인 함수 호출에는 쓸 수 없다.',
 run(c,M){const r=[],s=M.mp;
  each(/\bif\s*\(/g,s,m=>{
    const i=m.index,o=i+m[0].length-1,cl=matchF(s,o);if(cl<0)return;
    const st=nextNW(s,cl+1);if(!s[st]||s[st]==='{'||s[st]===';')return;
    let d=0,j=st,bad=false;
    for(;j<s.length;j++){const ch=s[j];
      if('([{'.includes(ch)){if(ch==='{'&&d===0){bad=true;break}d++}
      else if(')]}'.includes(ch)){if(d===0){bad=true;break}d--}
      else if(ch===';'&&d===0)break}
    if(bad||j>=s.length)return;
    const stmt=s.slice(st,j);
    if(/^(return|break|continue|goto|if|for|while|do|switch|int|long|short|char|double|float|bool|auto|unsigned|signed|const|static|string|vector|throw|else|case|default|delete)\b/.test(stmt))return;
    if(/^[A-Za-z_][\w:<>,\s]*\s+[A-Za-z_*&]/.test(stmt)&&!/^[A-Za-z_]\w*\s*(<<|>>)/.test(stmt))return;
    if(topLevelBad(stmt)||topLevelBad(s.slice(o+1,cl)))return;
    const nx=nextNW(s,j+1);if(/^else\b/.test(s.slice(nx,nx+5)))return;
    r.push({s:i,e:j,edits:[{s:i,e:st,r:c.slice(o+1,cl).trim()+'&&'}],save:2});
  });return r}},

{id:'brace',title:'Drop single-statement braces',desc:'문장이 하나뿐인 블록에는 중괄호가 필요 없다.',
 run(c,M){const s=M.mp,r=[];
  for(let i=0;i<s.length;i++){
    if(s[i]!=='{')continue;
    const p=prevNW(s,i);if(p<0)continue;
    let ok=false,wordPrev=false;
    if(s[p]===')'){const o=matchB(s,p);if(o>=0&&/^(if|for|while)$/.test(wordBefore(s,o)))ok=true}
    else if(/^(else|do)$/.test(wordEnd(s,p))){ok=true;wordPrev=p===i-1}
    if(!ok)continue;
    const e=matchF(s,i);if(e<0)continue;
    const inner=s.slice(i+1,e);
    let d=0,semi=0,last=-1,bad=false;
    for(let j=0;j<inner.length;j++){const ch=inner[j];
      if(ch==='{'&&d===0){bad=true;break}
      if('([{'.includes(ch))d++;else if(')]}'.includes(ch))d--;else if(ch===';'&&d===0){semi++;last=j}}
    if(bad||semi!==1||inner.slice(last+1).trim())continue;
    const nx=nextNW(s,e+1);if(/^else\b/.test(s.slice(nx,nx+5))&&/\bif\b/.test(inner))continue;
    const first=inner.trim()[0];const sp=wordPrev&&isW(first)?' ':'';
    r.push({s:i,e:e+1,edits:[{s:i,e:i+1,r:sp},{s:e,e:e+1,r:''}],save:sp?1:2});
  }
  return r}},

{id:'not',title:'x==0 → !x',desc:'0과 같은지 비교할 때는 논리 부정이 더 짧다.',
 run(c,M){const r=[],s=M.mp;
  each(/([A-Za-z_]\w*)\s*==\s*0(?![\w.])/g,s,m=>{
    const i=m.index,e=i+m[0].length;if(i>0&&isW(s[i-1]))return;
    const p=prevNW(s,i),pc=p<0?'':s[p];
    let ok=p<0||'(,;?{}&|'.includes(pc)||(pc===':'&&s[p-1]!==':')||(pc==='='&&!'=!<>'.includes(s[p-1]))||wordEnd(s,p)==='return';
    if(!ok)return;
    const nc=s[nextNW(s,e)]||'';if(nc&&!')&|?;,:'.includes(nc))return;
    r.push({s:i,e,edits:[{s:i,e,r:'!'+m[1]}],save:2});
  });return r}},

{id:'ne0',title:'x!=0 → x',desc:'조건식 안에서는 0이 아닌 값이 참으로 평가된다.',
 run(c,M){const r=[],s=M.mp;
  each(/([A-Za-z_]\w*)\s*!=\s*0(?![\w.])/g,s,m=>{const i=m.index,e=i+m[0].length;if(i>0&&/[\w.]/.test(s[i-1]))return;if(!boolCtx(s,i,e))return;r.push({s:i,e,edits:[{s:i,e,r:m[1]}],save:3})});
  return r}},

{id:'neq',title:'a!=b → a-b',desc:'조건식 안에서 정수끼리 비교할 때 쓴다. 실수형에서는 주의가 필요하다.',
 run(c,M){const r=[],s=M.mp;
  each(/([A-Za-z_]\w*|\d+)\s*!=\s*([A-Za-z_]\w*|\d+)(?![\w.(\[])/g,s,m=>{const i=m.index,e=i+m[0].length;if(i>0&&/[\w.]/.test(s[i-1]))return;if(m[2]==='0')return;if(!boolCtx(s,i,e))return;r.push({s:i,e,edits:[{s:i,e,r:m[1]+'-'+m[2]}],save:1})});
  return r}},

{id:'tilde',title:'(x+1) → -~x',desc:'-~x는 x+1, ~-x는 x-1과 같다. 괄호를 없앨 수 있다.',
 run(c,M){const r=[],s=M.mp;
  each(/\(\s*([A-Za-z_]\w*)\s*([+-])\s*1(?![\w.])\s*\)/g,s,m=>{
    const i=m.index,e=i+m[0].length,p=prevNW(s,i),pc=p<0?'':s[p];
    if(isW(pc)&&wordEnd(s,p)!=='return')return;
    if(pc===')'||pc===']'||pc==='>')return;
    const plus=m[2]==='+';if(plus&&pc==='-')return;
    const n=nextNW(s,e),nc=s[n]||'';
    if(nc&&'[(.'.includes(nc))return;
    if((nc==='-'&&(s[n+1]==='>'||s[n+1]==='-'))||(nc==='+'&&s[n+1]==='+'))return;
    r.push({s:i,e,edits:[{s:i,e,r:(plus?'-~':'~-')+m[1]}],save:2});
  });return r}},

{id:'inc',title:'x+=1 → ++x',desc:'1씩 더하거나 뺄 때는 증감 연산자가 더 짧다.',
 run(c,M){const r=[],s=M.mp;
  each(/([A-Za-z_]\w*(?:\s*\[[^\[\]\n]*\])?)\s*([+-])=\s*1(?![\w.])/g,s,m=>{
    const i=m.index,e=i+m[0].length;if(i>0&&isW(s[i-1]))return;
    const p=prevNW(s,i),pc=p<0?'':s[p];if(pc&&'.:>'.includes(pc))return;
    const nc=s[nextNW(s,e)]||'';if(!';,)'.includes(nc)||!nc)return;
    const lv=c.slice(i,i+m[1].length).replace(/\s+/g,'');
    r.push({s:i,e,edits:[{s:i,e,r:(m[2]==='+'?'++':'--')+lv}],save:1});
  });return r}},

{id:'comp',title:'x=x+y → x+=y',desc:'복합 대입 연산자를 쓰면 변수 이름을 한 번 덜 쓴다.',
 run(c,M){const r=[],s=M.mp;
  each(/([A-Za-z_]\w*)\s*=(?!=)\s*\1(?!\w)\s*(<<|>>|[-+*\/%&|^])(?!=)\s*([A-Za-z_]\w*(?:\s*\[[^\[\]\n]*\])*|\d+)(?![\w.(\[])/g,s,m=>{
    const i=m.index,e=i+m[0].length;if(i>0&&/[\w.]/.test(s[i-1]))return;
    const p=prevNW(s,i);if(p>=0&&((s[p]==='>'&&s[p-1]==='-')||(s[p]===':'&&s[p-1]===':')))return;
    const nc=s[nextNW(s,e)]||'';if(!nc||!';,)'.includes(nc))return;
    const rhs=c.slice(e-m[3].length,e).replace(/\s+/g,'');
    r.push({s:i,e,edits:[{s:i,e,r:m[1]+m[2]+'='+rhs}],save:m[1].length});
  });return r}},

{id:'bool',title:'true/false → 1/0',desc:'정수로 써도 똑같이 동작한다.',
 run(c,M){const r=[];each(/\b(true|false)\b/g,M.mp,m=>{const s=m.index,e=s+m[0].length;r.push({s,e,edits:[{s,e,r:m[1]==='true'?'1':'0'}],save:m[0].length-1})});return r}},

{id:'chr',title:'Char literal → ASCII code',desc:"'0'은 48, ' '는 32처럼 아스키 코드로 쓴다. 비교, 뺄셈, putchar 인자만 대상으로 한다.",
 run(c,M){const r=[],s=M.mp;
  for(const k of M.T){
    if(k.t!=='chr')continue;
    const v=charVal(k.v);if(v==null)continue;
    const ns=String(v),save=k.v.length-ns.length;if(save<=0)continue;
    const p=prevNW(s,k.s),pc=p<0?'':s[p],pp=p>0?s[p-1]:'';
    let ok=false;
    if(pc==='='&&pp&&'=!<>'.includes(pp))ok=true;
    else if(pc==='<'&&pp!=='<')ok=true;
    else if(pc==='>'&&pp!=='>'&&pp!=='-')ok=true;
    else if(pc==='-'&&pp!=='-'&&/[\w)\]]/.test(s[prevNW(s,p)]||''))ok=true;
    else if(pc==='('&&wordBefore(s,p)==='putchar')ok=true;
    if(ok)r.push({s:k.s,e:k.e,edits:[{s:k.s,e:k.e,r:ns}],save});
  }
  return r}},

{id:'ll',title:'Alias long long',desc:'세 번 이상 쓰면 using 한 줄을 추가하는 쪽이 이득이다.',
 run(c,M){const s=M.mp,occ=[];
  each(/\blong\s+long(?:\s+int)?\b/g,s,m=>{const w=wordBefore(s,m.index);if(w==='unsigned'||w==='signed')return;occ.push({s:m.index,e:m.index+m[0].length})});
  const k=occ.length,save=8*k-19;if(k<3||save<=0)return [];
  const name=[...'LQZYX'].find(ch=>!new RegExp('\\b'+ch+'\\b').test(s));if(!name)return [];
  const pos=afterPP(M,occ[0].s);
  return [{s:occ[0].s,e:occ[0].e,edits:[...occ.map(o=>({s:o.s,e:o.e,r:name})),{s:pos,e:pos,r:`using ${name}=long long;\n`}],save,pv:[`long long ×${k}`,`using ${name}=long long;`]}];
 }},

{id:'num',title:'Exponent notation for big numbers',desc:'짧아지지만 실수형이 된다. int에 대입할 때는 문제없지만 나눗셈, %, 배열 크기에는 쓸 수 없다.',info:true,
 run(c,M){const r=[],s=M.mk;
  each(/([1-9])(0{3,})(?![\w.'])/g,s,m=>{const i=m.index;if(i>0&&/[\w.']/.test(s[i-1]))return;const t=m[1]+'e'+m[2].length;r.push({s:i,e:i+m[0].length,edits:null,save:m[0].length-t.length,pv:[m[0],t]})});
  return r}},

{id:'forint',title:'Global loop variables',desc:'전역 변수는 0으로 초기화된다. int a,i;처럼 모아 두면 for마다 int를 쓰지 않아도 된다.',info:true,
 run(c,M){const r=[];each(/\bfor\s*\(\s*int\s+([A-Za-z_]\w*)\s*=/g,M.mp,m=>{const i=m.index+m[0].indexOf('int');r.push({s:i,e:i+3,edits:null,save:4,pv:[`for(int ${m[1]}=`,`for(${m[1]}=`]})});return r}},
];

function minPreview(t){return joinTokens(lex(t,true))}
function preview(c,m){
  let b,a;
  if(m.pv){[b,a]=m.pv}
  else{
    b=c.slice(m.s,m.e);a=b;
    if(m.edits){a=applyEdits(b,m.edits.filter(x=>x.s>=m.s&&x.e<=m.e).map(x=>({s:x.s-m.s,e:x.e-m.s,r:x.r})))}
    b=minPreview(b);a=minPreview(a);
  }
  const cut=t=>{t=t.replace(/\s+/g,' ').trim();return t.length>38?t.slice(0,37)+'…':t};
  return [cut(b),cut(a)];
}
function analyze(c){
  const M=masks(c),out=[];
  for(const R of RULES){
    let ms;try{ms=R.run(c,M)}catch(e){console.warn(R.id,e);continue}
    if(!ms||!ms.length)continue;
    const f=ms[0];
    out.push({id:R.id,unit:R.unit,title:f.title||R.title,desc:f.desc||R.desc,info:!!R.info,fix:!R.info&&ms.every(m=>m.edits),matches:ms,save:ms.reduce((a,m)=>a+(m.save||0),0)});
  }
  return out.sort((a,b)=>(a.info-b.info)||(b.save-a.save));
}
