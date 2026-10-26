const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app.html'),'utf8');
const a=html.indexOf('    const loadClaims = useCallback(async () => {'),b=html.indexOf('    }, [user]);',a)+'    }, [user]);'.length;
assert.ok(a>0 && b>a);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
(async()=>{
 const pending=[],applied=[],errors=[],loading=[],limits=[];
 const context={console:{error() {},warn() {}},user:{id:'fixture-user'},sdlgSupabase:{},claimsLoadGeneration:{current:0},useCallback:fn=>fn,
  SDLG_REPOSITORY:{listClaimsPage:async()=>[],listClaims:()=>new Promise(r=>pending.push(r))},
  runSupabaseRead:async()=>({data:[],error:null}),withTimeout:(p,ms)=>{limits.push(ms);return p;},
  setClaims:r=>applied.push(r),setClaimsLoadError:e=>errors.push(e),setLoading:v=>loading.push(v),setActionCenterRows(){},setActionCenterLoadError(){},showToast(){}};
 vm.createContext(context);vm.runInContext(html.slice(a,b)+'\nglobalThis.load=loadClaims;',context);
 const first=context.load();await flush();const second=context.load();await flush();
 pending[1]([{claim_id:'NEW'}]);await second;pending[0]([{claim_id:'OLD'}]);await first;
 assert.equal(applied.length,1);assert.equal(applied[0][0].claim_id,'NEW');assert.deepEqual(loading,[true,true,false]);
 assert.ok(limits.includes(15000)&&limits.includes(20000));
 const third=context.load();await flush();context.claimsLoadGeneration.current++;pending[2]([{claim_id:'AFTER_LOGOUT'}]);await third;assert.equal(applied.length,1,'invalidated request must not repopulate claims');
 context.withTimeout=async(_p,ms)=>{if(ms===20000)throw new Error('fixture timeout');return [];};
 await context.load();assert.equal(errors.at(-1),'fixture timeout');assert.equal(loading.at(-1),false);
 console.log('LEGACY CLAIMS LOADING: PASS (latest request wins, logout invalidation, deadlines, recoverable timeout)');
})().catch(e=>{console.error(e);process.exitCode=1;});
