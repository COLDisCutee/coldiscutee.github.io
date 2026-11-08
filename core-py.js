/* Short++ Python engine: lexer, indentation-aware minifier, name shortener, and golf suggestions. */
const PY=(()=>{
const isW=ch=>!!ch&&(/\w/.test(ch)||ch>'\x7f');
const OPS3=['**=','//=','>>=','<<=','...'];
const OPS2=['**','//','<<','>>','<=','>=','==','!=','->',':=','+=','-=','*=','/=','%=','&=','|=','^=','@='];
const STR_PREFIX=/^(?:[rRuUbBfF]|[bB][rR]|[rR][bB]|[fF][rR]|[rR][fF])$/;
const AUG=new Set(['+=','-=','*=','/=','//=','%=','**=','>>=','<<=','&=','|=','^=','@=']);

/* ---------- lexer ---------- */
function scanString(s,i,q3,q,isF){
  const n=s.length;
  while(i<n){
    const c=s[i];
    if(c==='\\'){i+=2;continue}
    if(!q3&&c==='\n')return i;
    if(isF&&c==='{'){if(s[i+1]==='{'){i+=2;continue}i=scanFExpr(s,i+1);continue}
    if(c===q){if(!q3)return i+1;if(s.startsWith(q+q+q,i))return i+3}
    i++;
  }
  return n;
}
function scanFExpr(s,i){
  let d=0;const n=s.length;
  while(i<n){
    const c=s[i];
    if('{[('.includes(c)){d++;i++;continue}
    if('}])'.includes(c)){if(c==='}'&&d===0)return i+1;d--;i++;continue}
    if(c==='"'||c==="'"){
      let k=i-1,pre='';while(k>=0&&/[rRbBuUfF]/.test(s[k])&&pre.length<2){pre=s[k]+pre;k--}
      const q3=s.startsWith(c+c+c,i);
      i=scanString(s,i+(q3?3:1),q3,c,/f/i.test(pre));continue;
    }
    i++;
  }
  return n;
}
function lex(s){
  const T=[],n=s.length;let i=0;
  const push=(t,j)=>{T.push({t,s:i,e:j,v:s.slice(i,j)});i=j};
  while(i<n){
    const c=s[i];
    if(c==='\n'){push('nl',i+1);continue}
    if(c===' '||c==='\t'||c==='\r'||c==='\f'){let j=i+1;while(j<n&&' \t\r\f'.includes(s[j]))j++;push('ws',j);continue}
    if(c==='\\'&&(s[i+1]==='\n'||(s[i+1]==='\r'&&s[i+2]==='\n'))){push('cont',i+(s[i+1]==='\r'?3:2));continue}
    if(c==='#'){let j=i;while(j<n&&s[j]!=='\n')j++;push('com',j);continue}
    let m=/^([rRuUbBfF]{0,2})(['"])/.exec(s.slice(i,i+3));
    if(m&&(m[1]===''||STR_PREFIX.test(m[1]))){
      const q=m[2],st=i+m[1].length,q3=s.startsWith(q+q+q,st);
      push('str',scanString(s,st+(q3?3:1),q3,q,/f/i.test(m[1])));continue;
    }
    if(/[A-Za-z_]/.test(c)||c>'\x7f'){let j=i+1;while(j<n&&isW(s[j]))j++;push('id',j);continue}
    if(/\d/.test(c)||(c==='.'&&/\d/.test(s[i+1]||''))){
      m=/^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?[jJ]?)/.exec(s.slice(i,i+80));
      push('num',i+(m?m[0].length:1));continue;
    }
    if(OPS3.includes(s.slice(i,i+3))){push('op',i+3);continue}
    if(OPS2.includes(s.slice(i,i+2))){push('op',i+2);continue}
    push('op',i+1);
  }
  return T;
}
const sig=T=>T.filter(t=>t.t!=='ws'&&t.t!=='nl'&&t.t!=='com'&&t.t!=='cont');
const isOp=(t,v)=>!!t&&t.t==='op'&&(v===undefined||t.v===v);
const isId=(t,v)=>!!t&&t.t==='id'&&(v===undefined||t.v===v);

/* ---------- logical lines and blocks ---------- */
function logicalLines(T){
  const lines=[];let cur=null,depth=0,indent='';
  for(const t of T){
    if(t.t==='nl'){if(depth===0){if(cur){lines.push(cur);cur=null}indent=''}continue}
    if(t.t==='ws'){if(!cur)indent=t.v;continue}
    if(t.t==='com'||t.t==='cont')continue;
    if(!cur)cur={indent,toks:[],lineStart:t.s-indent.length};
    cur.toks.push(t);
    if(t.t==='op'){if('([{'.includes(t.v))depth++;else if(')]}'.includes(t.v))depth=Math.max(0,depth-1)}
  }
  if(cur)lines.push(cur);
  const stack=[0];
  lines.forEach((L,li)=>{
    L.li=li;L.start=L.toks[0].s;L.end=L.toks[L.toks.length-1].e;
    const w=[...L.indent].reduce((a,ch)=>ch==='\t'?a+8-a%8:a+1,0);
    if(w>stack[stack.length-1])stack.push(w);
    else while(stack.length>1&&w<stack[stack.length-1])stack.pop();
    L.level=stack.length-1;
    let d=0;L.depth=L.toks.map(t=>{if(t.t==='op'&&')]}'.includes(t.v))d--;const r=d;if(t.t==='op'&&'([{'.includes(t.v))d++;return r});
    L.hdr=headerInfo(L);
  });
  return lines;
}
const COMPOUND=new Set(['if','elif','else','for','while','def','class','try','except','finally','with','async']);
function headerInfo(L){
  const tk=L.toks,f=tk[0];
  if(isOp(f,'@'))return {deco:true};
  let hdr=f.t==='id'&&COMPOUND.has(f.v);
  if(!hdr&&isId(f)&&(f.v==='match'||f.v==='case')&&tk.length>2&&isOp(tk[tk.length-1],':')&&!['=','.',',',')'].includes(tk[1].v)&&!AUG.has(tk[1].v))hdr=true;
  if(!hdr)return null;
  let lam=0;
  for(let k=0;k<tk.length;k++){
    if(L.depth[k]!==0)continue;
    if(isId(tk[k],'lambda'))lam++;
    else if(isOp(tk[k],':')){if(lam){lam--;continue}return {colon:k,inline:k<tk.length-1}}
  }
  return null;
}
function buildTree(lines){
  const root={children:[],L:{level:-1}},stack=[root];
  for(const L of lines){
    const nd={L,children:[],parent:null};
    while(stack.length>1&&stack[stack.length-1].L.level>=L.level)stack.pop();
    nd.parent=stack[stack.length-1];nd.parent.children.push(nd);stack.push(nd);
  }
  return root;
}
const walkTree=(nd,fn)=>nd.children.forEach(c=>{fn(c);walkTree(c,fn)});
const lastDesc=nd=>nd.children.length?lastDesc(nd.children[nd.children.length-1]):nd;
function matchIdx(tk,i){const o=tk[i].v,c={'(':')','[':']','{':'}'}[o];let d=0;for(let j=i;j<tk.length;j++){if(isOp(tk[j],o))d++;else if(isOp(tk[j],c)&&--d===0)return j}return -1}

/* ---------- compact rendering ---------- */
const PAIRS=new Set(['**','//','==','!=','<=','>=','<<','>>','->',':=','*=','/=','+=','-=','%=','&=','|=','^=','@=','..']);
function needSp(p,n){
  const a=p.v[p.v.length-1],b=n.v[0];
  if(isW(a)&&isW(b))return true;
  if(p.t==='num'&&(isW(b)||b==='.'))return true;
  if(p.t==='id'&&n.t==='str'&&STR_PREFIX.test(p.v))return true;
  if(p.t==='op'&&n.t==='op'&&PAIRS.has(a+b))return true;
  if(a==='.'&&n.t==='num')return true;
  return false;
}
function shortNum(v){
  if(!/^\d*\.\d*$/.test(v)||v==='.')return v;
  let [a,b]=v.split('.');
  b=b.replace(/0+$/,'');a=a.replace(/^0+(?=\d)/,'');
  if(a==='0'&&b)a='';
  return a+'.'+b;
}
function compact(toks,opt){
  let out='',prev=null;
  for(const t0 of toks){
    const t=opt&&opt.num&&t0.t==='num'?{...t0,v:shortNum(t0.v)}:t0;
    if(prev&&needSp(prev,t))out+=' ';
    out+=t.v;prev=t;
  }
  return out;
}
const compactText=t=>compact(sig(lex(t)));
const simple=nd=>!nd.L.hdr&&!nd.children.length;
function render(nodes,depth,opt,out){
  const ind=' '.repeat(depth);
  for(let i=0;i<nodes.length;){
    const nd=nodes[i];
    if(simple(nd)){
      const run=[];while(i<nodes.length&&simple(nodes[i]))run.push(nodes[i++]);
      if(opt.join&&depth>0)out.push(ind+run.map(r=>compact(r.L.toks,opt)).join(';'));
      else run.forEach(r=>out.push(ind+compact(r.L.toks,opt)));
      continue;
    }
    const text=compact(nd.L.toks,opt),h=nd.L.hdr;
    if(opt.join&&h&&!h.deco&&!h.inline&&nd.children.length&&nd.children.every(simple))out.push(ind+text+nd.children.map(c=>compact(c.L.toks,opt)).join(';'));
    else{out.push(ind+text);render(nd.children,depth+1,opt,out)}
    i++;
  }
}
function minify(code,opt){
  if(opt.ren)code=renameCode(code);
  const lines=logicalLines(lex(code));
  lines.forEach(L=>{while(L.toks.length&&isOp(L.toks[L.toks.length-1],';'))L.toks.pop()});
  const out=[];render(buildTree(lines.filter(L=>L.toks.length)).children,0,opt,out);
  return out.join('\n');
}

/* ---------- names ---------- */
const KW=new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
const SOFT=new Set(['match','case','_','type']);
const BUILTINS=new Set(`abs aiter all anext any ascii bin bool breakpoint bytearray bytes callable chr classmethod compile complex copyright credits delattr dict dir divmod enumerate eval exec exit filter float format frozenset getattr globals hasattr hash help hex id input int isinstance issubclass iter len license list locals map max memoryview min next object oct open ord pow print property quit range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip __import__ NotImplemented Ellipsis Exception BaseException ValueError TypeError KeyError IndexError StopIteration RuntimeError ZeroDivisionError AssertionError AttributeError NameError OverflowError RecursionError EOFError ImportError OSError IOError MemoryError SystemExit KeyboardInterrupt ArithmeticError LookupError NotImplementedError UnicodeError`.split(/\s+/));
const DYNAMIC=new Set(['eval','exec','globals','locals','vars','getattr','setattr','hasattr','delattr','__import__','__dict__']);
const EXPORTS={
  math:'acos acosh asin asinh atan atan2 atanh cbrt ceil comb copysign cos cosh degrees dist e erf erfc exp exp2 expm1 fabs factorial floor fmod frexp fsum gamma gcd hypot inf isclose isfinite isinf isnan isqrt lcm ldexp lgamma log log10 log1p log2 modf nan nextafter perm pi pow prod radians remainder sin sinh sqrt sumprod tan tanh tau trunc ulp',
  itertools:'accumulate batched chain combinations combinations_with_replacement compress count cycle dropwhile filterfalse groupby islice pairwise permutations product repeat starmap takewhile tee zip_longest',
  collections:'ChainMap Counter OrderedDict UserDict UserList UserString defaultdict deque namedtuple',
  heapq:'heapify heappop heappush heappushpop heapreplace merge nlargest nsmallest',
  bisect:'bisect bisect_left bisect_right insort insort_left insort_right',
  functools:'cache cached_property cmp_to_key lru_cache partial partialmethod reduce singledispatch singledispatchmethod total_ordering update_wrapper wraps WRAPPER_ASSIGNMENTS WRAPPER_UPDATES',
  string:'ascii_letters ascii_lowercase ascii_uppercase capwords digits hexdigits octdigits printable punctuation whitespace Formatter Template',
  operator:'abs add and_ attrgetter call concat contains countOf delitem eq floordiv ge getitem gt iadd iand iconcat ifloordiv ilshift imatmul imod imul index indexOf inv invert ior ipow irshift is_ is_not isub itemgetter itruediv ixor le length_hint lshift lt matmul methodcaller mod mul ne neg not_ or_ pos pow rshift setitem sub truediv truth xor',
  re:'A ASCII DEBUG DOTALL I IGNORECASE L LOCALE M MULTILINE NOFLAG S U UNICODE VERBOSE X compile error escape findall finditer fullmatch match purge search split sub subn template Match Pattern RegexFlag',
  random:'betavariate binomialvariate choice choices expovariate gauss getrandbits getstate lognormvariate normalvariate paretovariate randbytes randint random randrange sample seed setstate shuffle triangular uniform vonmisesvariate weibullvariate Random SystemRandom',
  fractions:'Fraction',
};
for(const k in EXPORTS)EXPORTS[k]=new Set(EXPORTS[k].split(' '));
const SAFE_MODULES=new Set([...Object.keys(EXPORTS),'sys','os','time','copy','decimal','string','array']);

// Text inside the {…} replacement fields of an f-string, nested fields included.
function fieldText(v){
  let d=0,out='';
  for(let i=0;i<v.length;i++){
    const ch=v[i];
    if(d===0){if(ch==='{'){if(v[i+1]==='{'){i++;continue}d=1}continue}
    if(ch==='{'){d++;out+=' ';continue}
    if(ch==='}'){d--;out+=' ';continue}
    out+=ch;
  }
  return out;
}
function analyzeNames(T,lines){
  const bound=new Set(),kw=new Set(),attr=new Set(),imported=new Set(),fnames=new Set(),starTaken=new Set();
  const lineBound=[];let unknownStar=false,dynamic=false;
  for(const t of T){
    if(t.t==='id'&&DYNAMIC.has(t.v))dynamic=true;
    if(t.t==='str'){const pm=/^([rRuUbBfF]{0,2})['"]/.exec(t.v);if(pm&&/f/i.test(pm[1]))(fieldText(t.v).match(/[A-Za-z_]\w*/g)||[]).forEach(x=>fnames.add(x))}
  }
  for(const L of lines){
    const tk=L.toks,dp=L.depth,f=tk[0],lb=new Set();lineBound[L.li]=lb;
    const add=n=>{bound.add(n);lb.add(n)};
    const lamParam=new Array(tk.length).fill(false);
    tk.forEach((t,k)=>{
      if(!isId(t,'lambda'))return;
      for(let j=k+1;j<tk.length;j++){
        if(isOp(tk[j],':')&&dp[j]===dp[k])break;
        lamParam[j]=true;
        if(isId(tk[j])&&dp[j]===dp[k]&&['lambda',',','*','**'].includes(tk[j-1].v))add(tk[j].v);
      }
    });
    let defP=-1,defC=-1;
    const di=isId(f,'async')?1:0;
    if(isId(tk[di],'def')&&isId(tk[di+1])){
      add(tk[di+1].v);
      if(isOp(tk[di+2],'(')){defP=di+2;defC=matchIdx(tk,defP);
        for(let j=defP+1;j<defC;j++)if(isId(tk[j])&&dp[j]===dp[defP]+1&&['(',',','*','**'].includes(tk[j-1].v))add(tk[j].v)}
    }
    if(isId(f,'class')&&isId(tk[1]))add(tk[1].v);
    if(isId(f,'global')||isId(f,'nonlocal'))tk.slice(1).filter(t=>isId(t)).forEach(t=>add(t.v));
    if(isId(f,'import')){
      for(let j=1;j<tk.length;j++){
        if(!isId(tk[j])||!['import',','].includes(tk[j-1].v))continue;
        let k=j;while(isOp(tk[k+1],'.'))k+=2;
        if(isId(tk[k+1],'as')&&isId(tk[k+2]))add(tk[k+2].v);else imported.add(tk[j].v);
      }
      continue;
    }
    if(isId(f,'from')){
      const ii=tk.findIndex(t=>isId(t,'import'));
      if(ii>0){
        const mod=tk.slice(1,ii).map(t=>t.v).join('');
        if(isOp(tk[ii+1],'*')){if(EXPORTS[mod])EXPORTS[mod].forEach(x=>starTaken.add(x));else unknownStar=true}
        for(let j=ii+1;j<tk.length;j++){
          if(!isId(tk[j])||isId(tk[j],'as')||!['import',',','('].includes(tk[j-1].v))continue;
          imported.add(tk[j].v);
          if(isId(tk[j+1],'as')&&isId(tk[j+2]))add(tk[j+2].v);
        }
      }
      continue;
    }
    for(let k=0;k<tk.length;k++){
      const t=tk[k];
      if(isId(t,'for')){
        for(let j=k+1;j<tk.length&&!(isId(tk[j],'in')&&dp[j]===dp[k]);j++)
          if(isId(tk[j])&&!KW.has(tk[j].v)&&!isOp(tk[j-1],'.')&&!(tk[j+1]&&['.','[','('].includes(tk[j+1].v)&&tk[j+1].t==='op'))add(tk[j].v);
      }
      if(isId(t,'as')&&isId(tk[k+1]))add(tk[k+1].v);
      if(isId(t)&&isOp(tk[k+1],':=')&&!isOp(tk[k-1],'.'))add(t.v);
      if(isOp(t,'.')&&isId(tk[k+1]))attr.add(tk[k+1].v);
      if(isId(t)&&isOp(tk[k+1],'=')&&dp[k]>0&&!lamParam[k]&&!(defP>=0&&k>defP&&k<defC)&&tk[k-1]&&['(',','].includes(tk[k-1].v))kw.add(t.v);
    }
    // assignment targets in each statement
    const h=L.hdr;let a0=h?(h.deco?tk.length:(h.inline?h.colon+1:tk.length)):0;
    const seg=(a,b)=>{
      if(a>=b)return;
      if(isId(tk[a])&&!KW.has(tk[a].v)&&isOp(tk[a+1],':'))add(tk[a].v);
      let last=-1;
      for(let k=a;k<b;k++){if(tk[k].t!=='op'||dp[k]!==0||lamParam[k])continue;if(tk[k].v==='=')last=k;else if(AUG.has(tk[k].v)){last=k;break}}
      if(last<0)return;
      const disp=[];
      for(let k=a;k<last;k++){
        const t=tk[k];
        if(t.t==='op'&&'([{'.includes(t.v)){const p=tk[k-1];disp.push(k===a||(p.t==='op'&&['=',',','(','[','*'].includes(p.v)));continue}
        if(t.t==='op'&&')]}'.includes(t.v)){disp.pop();continue}
        if(isId(t)&&!KW.has(t.v)&&disp.every(Boolean)&&!isOp(tk[k-1],'.')&&!(tk[k+1]&&tk[k+1].t==='op'&&['.','[','('].includes(tk[k+1].v)))add(t.v);
      }
    };
    for(let k=a0,s0=a0;k<=tk.length;k++)if(k===tk.length||(isOp(tk[k],';')&&dp[k]===0)){seg(s0,k);s0=k+1}
  }
  return {bound,lineBound,kw,attr,imported,fnames,starTaken,unknownStar,dynamic};
}
function renamePlan(code){
  const T=lex(code),lines=logicalLines(T),N=analyzeNames(T,lines);
  if(N.dynamic)return {items:[],skipped:[],save:0,reason:'eval, exec, getattr 같은 동적 기능이 있어서 이름을 바꾸지 않는다.'};
  if(N.unknownStar)return {items:[],skipped:[],save:0,reason:'어떤 이름을 가져오는지 모르는 import *가 있어서 이름을 바꾸지 않는다.'};
  const skipped=[];
  const cand=new Set();
  for(const n of N.bound){
    if(KW.has(n)||SOFT.has(n)||/^__.*__$/.test(n)||N.imported.has(n))continue;
    if(BUILTINS.has(n)||N.kw.has(n)||N.attr.has(n)||N.fnames.has(n)){skipped.push(n);continue}
    cand.add(n);
  }
  const occ=new Map(),taken=new Set([...N.starTaken]);
  for(const t of sig(T)){
    if(t.t!=='id')continue;
    if(cand.has(t.v)){if(!occ.has(t.v))occ.set(t.v,[]);occ.get(t.v).push({s:t.s,e:t.e})}
    else taken.add(t.v);
  }
  const used=new Set(taken),map=new Map();
  for(const n of occ.keys())if(n.length===1){map.set(n,n);used.add(n)}
  const L1='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',L2=L1+'0123456789_';
  const pool=(function*(){for(const a of L1)yield a;for(const a of L1)for(const b of L2)yield a+b})();
  const order=[...occ.keys()].filter(n=>!map.has(n)).sort((a,b)=>occ.get(b).length-occ.get(a).length||b.length-a.length);
  for(const n of order){
    let x;do{x=pool.next().value}while(x&&(used.has(x)||KW.has(x)||BUILTINS.has(x)||SOFT.has(x)));
    if(!x||x.length>=n.length){map.set(n,n);used.add(n);continue}
    map.set(n,x);used.add(x);
  }
  const items=[...occ.entries()].map(([from,ranges])=>({from,to:map.get(from),ranges})).filter(x=>x.to!==x.from)
    .sort((a,b)=>b.ranges.length*(b.from.length-b.to.length)-a.ranges.length*(a.from.length-a.to.length));
  return {items,skipped,save:items.reduce((s,x)=>s+x.ranges.length*(x.from.length-x.to.length),0)};
}
function renameCode(code){const pl=renamePlan(code);return applyEdits(code,pl.items.flatMap(x=>x.ranges.map(r=>({s:r.s,e:r.e,r:x.to}))))}

/* ---------- rule helpers ---------- */
function context(code){
  const T=lex(code),lines=logicalLines(T),tree=buildTree(lines),N=analyzeNames(T,lines);
  const plain=new Map();
  for(const L of lines)L.toks.forEach((t,k)=>{if(t.t==='id'&&!isOp(L.toks[k-1],'.')){plain.set(t.v,(plain.get(t.v)||0)+1)}});
  const taken=new Set();for(const t of T)if(t.t==='id')taken.add(t.v);
  return {T,lines,tree,N,plain,taken,code};
}
function stmts(L){
  const h=L.hdr,tk=L.toks,out=[];
  let a=h?(h.deco?tk.length:(h.inline?h.colon+1:tk.length)):0;
  for(let k=a,s0=a;k<=tk.length;k++)if(k===tk.length||(isOp(tk[k],';')&&L.depth[k]===0)){if(k>s0)out.push([s0,k]);s0=k+1}
  return out;
}
const BOOL_BEFORE=new Set(['if','elif','while','and','or','not']);
const BOOL_AFTER=new Set([':','and','or','else','if','for',']']);
function boolCtx(tk,a,b){const p=tk[a-1],n=tk[b];return !!p&&BOOL_BEFORE.has(p.v)&&(!n||BOOL_AFTER.has(n.v))}
const single=t=>!!t&&(t.t==='id'||t.t==='num')&&!KW.has(t.v);
const loneAt=(tk,k)=>single(tk[k])&&!isOp(tk[k-1],'.')&&!(tk[k+1]&&tk[k+1].t==='op'&&['.','(','['].includes(tk[k+1].v));
const txt=(c,a,b)=>c.slice(a.s,b.e);
const mk=(c,a,b,rep,extra={})=>{const s=a.s,e=b.e,before=c.slice(s,e);return {s,e,edits:[{s,e,r:rep}],save:Math.max(0,compactText(before).length-compactText(rep).length),...extra}};
function topLevel(tk,a,b,pred){let d=0;for(let k=a;k<b;k++){const t=tk[k];if(t.t==='op'&&'([{'.includes(t.v)){d++;continue}if(t.t==='op'&&')]}'.includes(t.v)){d--;continue}if(d===0&&pred(t,k))return k}return -1}
const LOW=new Set(['if','else','lambda','or','and','not','in','is','<','>','==','!=','<=','>=',':=','yield','for','=']);
const CMP={'==':'!=','!=':'==','<':'>=','>=':'<','>':'<=','<=':'>'};
function physLineEnd(c,i){const j=c.indexOf('\n',i);return j<0?c.length:j+1}

/* ---------- rules ---------- */
const RULES=[
{id:'rename',title:'Shorten variable and function names',unit:'name',
 run(c){
  const pl=renamePlan(c);if(!pl.items.length||pl.save<=0)return [];
  const top=pl.items.slice(0,3).map(x=>`${x.from}→${x.to}`).join(', ');
  const desc=`자주 쓰는 이름부터 짧은 이름으로 바꾼다. ${top}${pl.items.length>3?` 외 ${pl.items.length-3}개`:''}.`+(pl.skipped.length?` 키워드 인자나 속성으로도 쓰이는 ${pl.skipped.slice(0,3).join(', ')}는 그대로 둔다.`:'');
  return pl.items.map(x=>({s:x.ranges[0].s,e:x.ranges[0].e,ranges:x.ranges,edits:x.ranges.map(r=>({s:r.s,e:r.e,r:x.to})),save:x.ranges.length*(x.from.length-x.to.length),pv:[x.from,x.to],desc}));
 }},

{id:'main',title:'Drop the __main__ guard',desc:'제출한 파일은 스크립트로 실행되므로 if __name__=="__main__": 검사가 필요 없다. 블록을 한 단계 내어 쓴다.',
 run(c,M){
  const out=[];
  for(const nd of M.tree.children){
    const L=nd.L,tk=L.toks,h=L.hdr;if(!h||h.deco||h.colon!==4||!isId(tk[0],'if'))continue;
    const v=tk.map(t=>t.v),q=x=>/^['"]__main__['"]$/.test(x);
    if(!((v[1]==='__name__'&&v[2]==='=='&&q(v[3]))||(q(v[1])&&v[2]==='=='&&v[3]==='__name__')))continue;
    const hdrText=compact(tk.slice(0,5));
    if(h.inline){out.push({s:tk[0].s,e:L.end,edits:[{s:tk[0].s,e:tk[5].s,r:''}],save:hdrText.length,pv:[hdrText+'…','…']});continue}
    if(!nd.children.length)continue;
    const edits=[{s:L.lineStart,e:physLineEnd(c,tk[tk.length-1].e),r:''}];
    const d=nd.children[0].L.indent.length,end=lastDesc(nd).L.end;
    const strs=M.T.filter(t=>t.t==='str'&&t.v.includes('\n'));
    let p=physLineEnd(c,tk[tk.length-1].e),n=0;
    while(p<end){
      if(!strs.some(t=>t.s<p&&p<t.e)){let k=0;while(k<d&&(c[p+k]===' '||c[p+k]==='\t'))k++;if(k){edits.push({s:p,e:p+k,r:''});n++}}
      const nl=c.indexOf('\n',p);if(nl<0)break;p=nl+1;
    }
    out.push({s:tk[0].s,e:L.end,edits,save:hdrText.length+1,pv:[hdrText,'removed']});
  }
  return out;
 }},

{id:'lambda',title:'def → lambda',desc:'return 한 줄짜리 함수는 lambda로 쓰면 def, return, 괄호가 빠진다.',
 run(c,M){
  const out=[];
  walkTree(M.tree,nd=>{
    const L=nd.L,tk=L.toks,h=L.hdr;
    if(!h||h.deco||!isId(tk[0],'def')||!isId(tk[1])||!isOp(tk[2],'('))return;
    const cl=matchIdx(tk,2);if(cl<0||cl+1!==h.colon)return;
    if(topLevel(tk,3,cl,t=>isOp(t,':'))>=0)return;
    const sib=nd.parent.children,idx=sib.indexOf(nd);if(idx>0&&sib[idx-1].L.hdr&&sib[idx-1].L.hdr.deco)return;
    let body;
    if(h.inline)body=tk.slice(h.colon+1);
    else if(nd.children.length===1&&simple(nd.children[0]))body=nd.children[0].L.toks;
    else return;
    while(body.length&&isOp(body[body.length-1],';'))body=body.slice(0,-1);
    if(body.length<2||!isId(body[0],'return')||body.some(t=>isOp(t,';')||isId(t,'yield')))return;
    const params=cl>3?c.slice(tk[3].s,tk[cl-1].e):'';
    const expr=c.slice(body[1].s,body[body.length-1].e);
    const rep=`${tk[1].v}=lambda${params&&isW(params[0])?' ':''}${params}:${expr}`;
    const before=compact(tk)+(h.inline?'':compact(body));
    const save=before.length-compactText(rep).length;if(save<=0)return;
    const b=compactText(rep);
    out.push({s:tk[0].s,e:body[body.length-1].e,edits:[{s:tk[0].s,e:body[body.length-1].e,r:rep}],save,pv:[`def ${tk[1].v}(…):return …`,b.length>38?`${tk[1].v}=lambda…`:b]});
  });
  return out;
 }},

{id:'printjoin',title:'print(" ".join(…)) → print(*…)',desc:'print는 인자를 공백으로 이어 출력하므로 join과 map(str,…)이 필요 없다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      if(!isId(tk[i],'print')||isOp(tk[i-1],'.')||!isOp(tk[i+1],'('))continue;
      const cl=matchIdx(tk,i+1);if(cl<0)continue;
      const s=tk[i+2];if(!s||s.t!=='str'||!/^(['"])[^'"\\]*\1$|^(['"])\\n\2$/.test(s.v))continue;
      if(!isOp(tk[i+3],'.')||!isId(tk[i+4],'join')||!isOp(tk[i+5],'('))continue;
      const jc=matchIdx(tk,i+5);if(jc!==cl-1)continue;
      let a=i+6,b=jc;
      if(isId(tk[a],'map')&&isOp(tk[a+1],'(')&&isId(tk[a+2],'str')&&isOp(tk[a+3],',')&&matchIdx(tk,a+1)===b-1){a+=4;b-=1}
      if(a>=b||topLevel(tk,a,b,t=>isId(t,'for')||isOp(t,','))>=0)continue;
      const inner=c.slice(tk[a].s,tk[b-1].e),sep=s.v.slice(1,-1);
      const rep=`print(*${inner}${sep===' '?'':`,sep=${s.v}`})`;
      const m=mk(c,tk[i],tk[cl],rep);if(m.save>0)out.push(m);
    }}
  return out;
 }},

{id:'unpack',title:'list(x) → [*x]',desc:'list, tuple, set 호출은 언패킹이나 컴프리헨션 표기로 줄일 수 있다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      const f=tk[i];if(!isId(f)||!['list','tuple','set'].includes(f.v)||isOp(tk[i-1],'.')||!isOp(tk[i+1],'(')||M.N.bound.has(f.v))continue;
      const cl=matchIdx(tk,i+1);if(cl<0)continue;
      let rep=null;
      if(cl===i+2){if(f.v==='list')rep='[]';else if(f.v==='tuple')rep='()'}
      else{
        const a=i+2,b=cl,inner=c.slice(tk[a].s,tk[b-1].e);
        if(topLevel(tk,a,b,t=>isOp(t,',')||isOp(t,'*')||isOp(t,'**'))>=0)continue;
        if(topLevel(tk,a,b,t=>isId(t,'for'))>=0){if(f.v==='list')rep=`[${inner}]`;else if(f.v==='set')rep=`{${inner}}`}
        else if(topLevel(tk,a,b,t=>LOW.has(t.v))<0)rep=f.v==='list'?`[*${inner}]`:f.v==='tuple'?`(*${inner},)`:`{*${inner}}`;
      }
      if(!rep)continue;
      const m=mk(c,tk[i],tk[cl],rep);if(m.save>0)out.push(m);
    }}
  return out;
 }},

{id:'genarg',title:'sum([… for …]) → sum(… for …)',desc:'리스트를 한 번만 쓰는 함수에는 대괄호 없는 제너레이터를 넘겨도 된다.',
 run(c,M){
  const out=[],F=new Set(['sum','any','all','min','max','sorted','tuple','set','frozenset','list','join']);
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      const f=tk[i];if(!isId(f)||!F.has(f.v)||!isOp(tk[i+1],'(')||!isOp(tk[i+2],'['))continue;
      if(f.v==='join'?!isOp(tk[i-1],'.'):(isOp(tk[i-1],'.')||M.N.bound.has(f.v)))continue;
      const cl=matchIdx(tk,i+1),bc=matchIdx(tk,i+2);if(cl<0||bc!==cl-1)continue;
      if(topLevel(tk,i+3,bc,t=>isId(t,'for'))<0)continue;
      const inner=c.slice(tk[i+3].s,tk[bc-1].e);
      const rep=f.v==='list'?`[${inner}]`:f.v==='set'?`{${inner}}`:`${f.v}(${inner})`;
      out.push(mk(c,tk[i],tk[cl],rep));
    }}
  return out;
 }},

{id:'yesno',title:'"Yes" if c else "No" → "YNeos"[…::2]',desc:'두 문자열을 한 글자씩 섞어 두고 슬라이스로 골라낸다. 조건은 True/False여야 한다.',
 run(c,M){
  const out=[],plainStr=/^(['"])([^'"\\\n]*)\1$/;
  const OKB=new Set(['(',',','=','[','{',':','return']),OKA=new Set([')',',',']','}',';']);
  for(const L of M.lines){const tk=L.toks,dp=L.depth;
    for(let i=0;i<tk.length;i++){
      const s1=tk[i],m1=plainStr.exec(s1.v);if(s1.t!=='str'||!m1||!isId(tk[i+1],'if'))continue;
      if(tk[i-1]&&!OKB.has(tk[i-1].v))continue;
      let j=i+2;while(j<tk.length&&!(isId(tk[j],'else')&&dp[j]===dp[i]))j++;
      const s2=tk[j+1];if(!s2||s2.t!=='str')continue;const m2=plainStr.exec(s2.v);if(!m2)continue;
      if(tk[j+2]&&!OKA.has(tk[j+2].v))continue;
      const A=m1[2],B=m2[2],cs=i+2,ce=j;if(ce<=cs)continue;
      if(topLevel(tk,cs,ce,t=>isId(t,'and')||isId(t,'or')||isId(t,'if')||isId(t,'lambda'))>=0)continue;
      const cmp=[];for(let k=cs;k<ce;k++)if(dp[k]===dp[i]&&tk[k].t==='op'&&CMP[tk[k].v])cmp.push(k);
      const isBool=cmp.length===1||isId(tk[cs],'not');
      const cond=c.slice(tk[cs].s,tk[ce-1].e);
      const inv=()=>{if(isId(tk[cs],'not'))return c.slice(tk[cs+1].s,tk[ce-1].e);if(cmp.length===1){const k=cmp[0];return c.slice(tk[cs].s,tk[k].s)+CMP[tk[k].v]+c.slice(tk[k].e,tk[ce-1].e)}return `not ${cond}`};
      const mix=(x,y)=>{let r='';for(let k=0;k<x.length;k++)r+=x[k]+(y[k]||'');return r};
      const q=m1[1];let rep;
      if(A.length===B.length||A.length===B.length+1)rep=`${q}${mix(A,B)}${q}[${inv()}::2]`;
      else if(B.length===A.length+1&&isBool)rep=`${q}${mix(B,A)}${q}[${cond}::2]`;
      else continue;
      const m=mk(c,s1,s2,rep);if(m.save>0)out.push(m);
    }}
  return out;
 }},

{id:'append',title:'a.append(x) → a+=[x]',desc:'리스트에 하나를 붙일 때는 +=[x]가 짧다. 함수 안에서는 그 함수에서 만든 리스트일 때만 골랐다.',
 run(c,M){
  const out=[];
  const defOf=nd=>{let p=nd.parent;while(p&&p.L&&p.L.toks){if(isId(p.L.toks[0],'def')||(isId(p.L.toks[0],'async')&&isId(p.L.toks[1],'def')))return p;p=p.parent}return null};
  const scopeNames=d=>{const s=new Set(M.N.lineBound[d.L.li]);walkTree(d,x=>(M.N.lineBound[x.L.li]||[]).forEach(n=>s.add(n)));return s};
  walkTree(M.tree,nd=>{
    const L=nd.L,tk=L.toks;
    for(const [a,b] of stmts(L)){
      if(!isId(tk[a])||b-a<5||!isOp(tk[b-1],')'))continue;
      let k=a+1;
      while(k<b){if(isOp(tk[k],'.')&&isId(tk[k+1])&&!isId(tk[k+1],'append')){k+=2;continue}if(isOp(tk[k],'[')){const e=matchIdx(tk,k);if(e<0||e>=b)break;k=e+1;continue}break}
      if(!isOp(tk[k],'.')||!isId(tk[k+1],'append')||!isOp(tk[k+2],'(')||matchIdx(tk,k+2)!==b-1||k+3>=b-1)continue;
      if(topLevel(tk,k+3,b-1,t=>isOp(t,',')||isId(t,'for')||isOp(t,'*'))>=0)continue;
      if(k===a+1){const d=defOf(nd);if(d&&!scopeNames(d).has(tk[a].v))continue}
      const rep=`${c.slice(tk[a].s,tk[k-1].e)}+=[${c.slice(tk[k+3].s,tk[b-2].e)}]`;
      out.push(mk(c,tk[a],tk[b-1],rep));
    }
  });
  return out;
 }},

{id:'forunused',title:'for i in range(n) → for _ in[0]*n',desc:'반복 변수를 쓰지 않으면 range 대신 길이 n인 리스트를 돌면 된다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    if(!isId(tk[0],'for')||!isId(tk[1])||!isId(tk[2],'in')||!isId(tk[3],'range')||!isOp(tk[4],'(')||M.N.bound.has('range'))continue;
    const cl=matchIdx(tk,4);if(cl<0||!L.hdr||L.hdr.colon!==cl+1)continue;
    if(topLevel(tk,5,cl,t=>isOp(t,','))>=0||cl===5)continue;
    if((M.plain.get(tk[1].v)||0)>1)continue;
    let n=c.slice(tk[5].s,tk[cl-1].e);
    const lone=cl===6||(isId(tk[5])&&isOp(tk[6],'(')&&matchIdx(tk,6)===cl-1);
    if(!lone)n=`(${n})`;
    out.push(mk(c,tk[0],tk[cl],`for ${tk[1].v} in[0]*${n}`));
  }
  return out;
 }},

{id:'comp',title:'x=x+y → x+=y',desc:'복합 대입으로 변수 이름을 한 번 덜 쓴다. 리스트는 새로 만들지 않고 제자리에서 바뀐다.',
 run(c,M){
  const out=[],OPS=new Set(['+','-','*','/','//','%','**','<<','>>','&','|','^','@']);
  for(const L of M.lines){const tk=L.toks;
    for(const [a,b] of stmts(L)){
      if(b-a<5||!isId(tk[a])||!isOp(tk[a+1],'=')||!isId(tk[a+2],tk[a].v)||!OPS.has(tk[a+3].v)||tk[a+3].t!=='op')continue;
      if(b-a===5&&(tk[a+4].t==='id'||tk[a+4].t==='num'||tk[a+4].t==='str')){}
      else if(!(isId(tk[a+4])&&isOp(tk[a+5],'(')&&matchIdx(tk,a+5)===b-1))continue;
      out.push(mk(c,tk[a],tk[b-1],`${tk[a].v}${tk[a+3].v}=${c.slice(tk[a+4].s,tk[b-1].e)}`));
    }}
  return out;
 }},

{id:'len',title:'len(a)>0 → a',desc:'조건식 안에서는 빈 컬렉션이 거짓이므로 길이를 잴 필요가 없다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      if(!isId(tk[i],'len')||isOp(tk[i-1],'.')||!isOp(tk[i+1],'(')||M.N.bound.has('len'))continue;
      const cl=matchIdx(tk,i+1);if(cl<0||cl===i+2)continue;
      if(topLevel(tk,i+2,cl,t=>t.t==='op'&&!['.','(','[',')',']'].includes(t.v)||LOW.has(t.v))>=0)continue;
      const inner=c.slice(tk[i+2].s,tk[cl-1].e);
      const op=tk[cl+1],z=tk[cl+2];
      if(op&&op.t==='op'&&z&&((['>','!='].includes(op.v)&&z.v==='0')||(op.v==='>='&&z.v==='1'))&&boolCtx(tk,i,cl+3))out.push(mk(c,tk[i],z,inner));
      else if(op&&op.t==='op'&&z&&((op.v==='=='&&z.v==='0')||(op.v==='<'&&z.v==='1'))&&boolCtx(tk,i,cl+3)&&!isId(tk[i-1],'not'))out.push(mk(c,tk[i],z,`not ${inner}`));
      else if(boolCtx(tk,i,cl+1))out.push(mk(c,tk[i],tk[cl],inner));
    }}
  return out;
 }},

{id:'ne0',title:'x!=0 → x',desc:'조건식 안에서는 0이 아닌 값이 참이다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      if(!loneAt(tk,i)||!isOp(tk[i+1],'!=')||tk[i+2]?.v!=='0'||!boolCtx(tk,i,i+3))continue;
      out.push(mk(c,tk[i],tk[i+2],tk[i].v));
    }}
  return out;
 }},

{id:'mod2',title:'x%2==1 → x%2',desc:'2로 나눈 나머지는 0 아니면 1이다. 조건식에서는 x%2, 짝수 검사는 x%2<1로 쓴다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      if(!loneAt(tk,i)||!isOp(tk[i+1],'%')||tk[i+2]?.v!=='2'||!tk[i+3]||tk[i+3].t!=='op')continue;
      const op=tk[i+3].v,z=tk[i+4];if(!z)continue;
      if(((op==='=='&&z.v==='1')||(op==='!='&&z.v==='0'))&&boolCtx(tk,i,i+5))out.push(mk(c,tk[i],z,`${tk[i].v}%2`));
      else if((op==='=='&&z.v==='0')&&!(tk[i+5]&&tk[i+5].t==='op'&&CMP[tk[i+5].v]))out.push(mk(c,tk[i],z,`${tk[i].v}%2<1`));
    }}
  return out;
 }},

{id:'neq',title:'a!=b → a-b',desc:'조건식 안에서 정수끼리 비교할 때만 쓴다. 차가 0이 아니면 참이다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      if(!loneAt(tk,i)||!isOp(tk[i+1],'!=')||!loneAt(tk,i+2)||tk[i+2].v==='0'||!boolCtx(tk,i,i+3))continue;
      out.push(mk(c,tk[i],tk[i+2],`${tk[i].v}-${tk[i+2].v}`));
    }}
  return out;
 }},

{id:'chain',title:'a<b and b<c → a<b<c',desc:'파이썬은 비교를 이어 쓸 수 있고, 가운데 값은 한 번만 쓰면 된다.',
 run(c,M){
  const out=[],C=new Set(['<','<=','>','>=','==']);
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      const [A,o1,B,and,B2,o2,Cc]=tk.slice(i,i+7);
      if(!single(A)||!C.has(o1?.v)||!single(B)||!isId(and,'and')||B2?.v!==B.v||!C.has(o2?.v)||!single(Cc))continue;
      if(isOp(tk[i-1],'.')||(tk[i-1]&&C.has(tk[i-1].v))||(tk[i+7]&&tk[i+7].t==='op'&&(['.','(','['].includes(tk[i+7].v)||C.has(tk[i+7].v))))continue;
      out.push(mk(c,A,Cc,`${A.v}${o1.v}${B.v}${o2.v}${Cc.v}`));
    }}
  return out;
 }},

{id:'mathimport',title:'import math → from math import*',desc:'모듈 이름을 여러 번 쓰면 *로 한 번에 가져오는 쪽이 짧다. 이름이 겹치지 않는 경우만 골랐다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    if(L.level!==0||tk.length!==2||!isId(tk[0],'import')||!isId(tk[1])||!EXPORTS[tk[1].v])continue;
    const mod=tk[1].v,ex=EXPORTS[mod],edits=[{s:tk[0].s,e:tk[1].e,r:`from ${mod} import*`}];let ok=true,k=0;
    for(const L2 of M.lines){if(L2===L)continue;L2.toks.forEach((t,j)=>{
      if(!isId(t))return;
      if(t.v===mod&&!isOp(L2.toks[j-1],'.')){if(isOp(L2.toks[j+1],'.')&&isId(L2.toks[j+2])&&ex.has(L2.toks[j+2].v)){edits.push({s:t.s,e:L2.toks[j+1].e,r:''});k++}else ok=false}
      else if(ex.has(t.v)&&!isOp(L2.toks[j-1],'.'))ok=false;
    })}
    const save=k*(mod.length+1)-6;
    if(ok&&k&&save>0)out.push({s:tk[0].s,e:tk[1].e,edits,save,pv:[`import ${mod} + ${mod}. ×${k}`,`from ${mod} import*`]});
  }
  return out;
 }},

{id:'unusedimport',title:'Remove unused import',desc:'쓰지 않는 표준 모듈 import는 지워도 된다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    if(!isId(tk[0],'import')||L.hdr)continue;
    const mods=[];for(let j=1;j<tk.length;j++)if(isId(tk[j])&&['import',','].includes(tk[j-1].v)){if(isId(tk[j+1],'as')||isOp(tk[j+1],'.')){mods.length=0;break}mods.push(tk[j].v)}
    if(!mods.length||mods.some(m=>!SAFE_MODULES.has(m)))continue;
    if(mods.some(m=>(M.plain.get(m)||0)>1))continue;
    if(tk.some(t=>isOp(t,';')))continue;
    const s=L.lineStart,e=physLineEnd(c,L.end);
    out.push({s:tk[0].s,e:L.end,edits:[{s,e,r:''}],save:compact(tk).length+1,pv:[compact(tk),'removed']});
  }
  return out;
 }},

{id:'alias',title:'Alias repeated builtins',desc:'여러 번 부르는 내장 함수는 I=input처럼 한 글자 별칭을 두면 짧아진다.',
 run(c,M){
  const out=[],CAND=['input','range','print','sorted','enumerate','list','len','int','map','str','sum','abs','min','max','zip','ord','chr','set','tuple'];
  if(!M.lines.length)return out;
  const used=new Set(M.taken),pos=M.lines[0].lineStart;
  for(const name of CAND){
    if(M.N.bound.has(name))continue;
    const occ=[];
    for(const L of M.lines)L.toks.forEach((t,j)=>{if(isId(t,name)&&!isOp(L.toks[j-1],'.')&&!(isOp(L.toks[j+1],'=')&&L.depth[j]>0))occ.push(t)});
    const k=occ.length,save=k*(name.length-1)-(name.length+3);if(save<=0)continue;
    const pref=name[0].toUpperCase();
    const letter=[pref,...'IRPSLNMOTZKQJWVUYXBCDEFGHA'].find(x=>!used.has(x));if(!letter)continue;
    used.add(letter);
    out.push({s:occ[0].s,e:occ[0].e,ranges:occ.map(t=>({s:t.s,e:t.e})),edits:[{s:pos,e:pos,r:`${letter}=${name}\n`},...occ.map(t=>({s:t.s,e:t.e,r:letter}))],save,pv:[`${name} ×${k}`,`${letter}=${name}`]});
  }
  return out;
 }},

{id:'ceil',title:'math.ceil(a/b) → -(-a//b)',desc:'정수 나눗셈으로 올림을 계산한다. a, b가 정수일 때만 결과가 같다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      let j=i;if(isId(tk[i],'math')&&isOp(tk[i+1],'.')&&isId(tk[i+2],'ceil'))j=i+2;else if(!(isId(tk[i],'ceil')&&!isOp(tk[i-1],'.')&&!M.N.bound.has('ceil')))continue;
      if(!isOp(tk[j+1],'(')||!single(tk[j+2])||!isOp(tk[j+3],'/')||!single(tk[j+4])||!isOp(tk[j+5],')'))continue;
      out.push(mk(c,tk[i],tk[j+5],`-(-${tk[j+2].v}//${tk[j+4].v})`));
    }}
  return out;
 }},

{id:'sqrt',title:'math.sqrt(x) → x**.5',desc:'제곱근은 0.5제곱으로 계산할 수 있다.',
 run(c,M){
  const out=[];
  for(const L of M.lines){const tk=L.toks;
    for(let i=0;i<tk.length;i++){
      let j=i;if(isId(tk[i],'math')&&isOp(tk[i+1],'.')&&isId(tk[i+2],'sqrt'))j=i+2;else if(!(isId(tk[i],'sqrt')&&!isOp(tk[i-1],'.')&&!M.N.bound.has('sqrt')))continue;
      if(!isOp(tk[j+1],'(')||!single(tk[j+2])||!isOp(tk[j+3],')')||isOp(tk[j+4],'**'))continue;
      out.push(mk(c,tk[i],tk[j+3],`${tk[j+2].v}**.5`));
    }}
  return out;
 }},

{id:'whiletrue',title:'while True → while 1',desc:'1도 참이므로 무한 반복에 그대로 쓸 수 있다.',
 run(c,M){const out=[];for(const L of M.lines){const tk=L.toks;if(isId(tk[0],'while')&&isId(tk[1],'True')&&isOp(tk[2],':'))out.push(mk(c,tk[0],tk[1],'while 1'))}return out}},

{id:'range0',title:'range(0,n) → range(n)',desc:'range는 0부터 시작하므로 시작값 0을 생략한다.',
 run(c,M){const out=[];for(const L of M.lines){const tk=L.toks;for(let i=0;i<tk.length;i++)if(isId(tk[i],'range')&&isOp(tk[i+1],'(')&&tk[i+2]?.v==='0'&&isOp(tk[i+3],',')&&topLevel(tk,i+4,matchIdx(tk,i+1),t=>isOp(t,','))<0)out.push({...mk(c,tk[i+2],tk[i+3],''),pv:['range(0,','range(']})}return out}},

{id:'bigint',title:'1000000 → 10**6',desc:'1 뒤에 0이 5개 이상이면 거듭제곱이 짧다. 정수 그대로라 결과가 같다.',
 run(c,M){const out=[];for(const L of M.lines){const tk=L.toks;tk.forEach((t,i)=>{const m=/^10{5,}$/.exec(t.v);if(t.t!=='num'||!m||isOp(tk[i-1],'.')||isOp(tk[i+1],'.')||isOp(tk[i+1],'**'))return;out.push(mk(c,t,t,`10**${t.v.length-1}`))})}return out}},

{id:'retnone',title:'return None → return',desc:'값 없는 return은 None을 돌려준다.',
 run(c,M){const out=[];for(const L of M.lines){const tk=L.toks;for(const [a,b] of stmts(L))if(b-a===2&&isId(tk[a],'return')&&isId(tk[a+1],'None'))out.push(mk(c,tk[a],tk[a+1],'return'))}return out}},

{id:'imports',title:'Join import lines',desc:'import 여러 줄은 쉼표로 한 줄에 모을 수 있다.',
 run(c,M){
  const out=[],ok=L=>L.level===0&&!L.hdr&&isId(L.toks[0],'import')&&!L.toks.some(t=>isOp(t,';'));
  for(let i=0;i<M.lines.length;i++){
    if(!ok(M.lines[i]))continue;
    let j=i;while(j+1<M.lines.length&&ok(M.lines[j+1]))j++;
    if(j>i){
      const grp=M.lines.slice(i,j+1),parts=grp.map(L=>c.slice(L.toks[1].s,L.end));
      const rep='import '+parts.join(',');
      out.push({s:grp[0].start,e:grp[grp.length-1].end,edits:[{s:grp[0].start,e:grp[grp.length-1].end,r:rep}],save:7*(grp.length-1),pv:[`import ×${grp.length}`,compactText(rep)]});
    }
    i=j;
  }
  return out;
 }},

{id:'num',title:'0.5 → .5',desc:'실수 앞의 0과 소수점 뒤의 0은 생략해도 값이 같다.',
 run(c,M){const out=[];for(const L of M.lines)L.toks.forEach(t=>{if(t.t!=='num')return;const s=shortNum(t.v);if(s.length<t.v.length)out.push({s:t.s,e:t.e,edits:[{s:t.s,e:t.e,r:s}],save:t.v.length-s.length})});return out}},

{id:'truefalse',title:'True/False → 1/0',desc:'계산이나 조건에서는 1과 0으로 써도 되지만, 그대로 출력하면 결과가 달라진다.',info:true,
 run(c,M){const out=[];for(const L of M.lines)L.toks.forEach(t=>{if(isId(t,'True')||isId(t,'False'))out.push({s:t.s,e:t.e,edits:null,save:t.v.length-1,pv:[t.v,t.v==='True'?'1':'0']})});return out}},
];

function analyze(code){
  const M=context(code),out=[];
  for(const R of RULES){
    let ms;try{ms=R.run(code,M)}catch(e){console.warn('py rule',R.id,e);continue}
    if(!ms||!ms.length)continue;
    const f=ms[0];
    out.push({id:R.id,unit:R.unit,title:f.title||R.title,desc:f.desc||R.desc,info:!!R.info,fix:!R.info&&ms.every(m=>m.edits),matches:ms,save:ms.reduce((a,m)=>a+(m.save||0),0)});
  }
  return out.sort((a,b)=>(a.info-b.info)||(b.save-a.save));
}
function preview(c,m){
  let b,a;
  if(m.pv)[b,a]=m.pv;
  else{
    b=c.slice(m.s,m.e);a=b;
    if(m.edits)a=applyEdits(b,m.edits.filter(x=>x.s>=m.s&&x.e<=m.e).map(x=>({s:x.s-m.s,e:x.e-m.s,r:x.r})));
    b=compactText(b);a=compactText(a);
  }
  const cut=t=>{t=t.replace(/\s+/g,' ').trim();return t.length>38?t.slice(0,37)+'…':t};
  return [cut(b),cut(a)];
}

/* ---------- highlighting ---------- */
const HL_BUILTIN=new Set([...BUILTINS,'self','cls']);
function segments(code){
  const T=lex(code);
  return T.map((t,i)=>{
    let c='';
    if(t.t==='com')c='cm';else if(t.t==='str')c='st';else if(t.t==='num')c='nu';
    else if(t.t==='id')c=KW.has(t.v)?'kw':(isOp(T[i-1],'@')?'pp':HL_BUILTIN.has(t.v)&&!isOp(T[i-1],'.')?'ty':'');
    else if(t.t==='op')c=t.v==='@'&&T[i+1]&&T[i+1].t==='id'?'pp':'op';
    return {s:t.s,e:t.e,c};
  });
}

return {lex,minify,analyze,preview,segments,renamePlan,compactText,shortNum,words:[...KW,...BUILTINS]};
})();
