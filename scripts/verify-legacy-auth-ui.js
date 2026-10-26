const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../app.html'), 'utf8');
const flush = async () => { for (let i=0;i<15;i++) await Promise.resolve(); };
const start=html.indexOf('    useEffect(() => {\n        let mounted = true;\n        let authEventVersion');
const end=html.indexOf('    }, [loadUserProfile, authRetry]);',start)+'    }, [loadUserProfile, authRetry]);'.length;
assert.ok(start>0 && end>start);
(async()=>{
 let event,cleanup,complete;let profiles=0;const users=[],roles=[],timers=new Map();let id=0;
 const context={console,profileGeneration:{current:0},claimsLoadGeneration:{current:0},authRetry:0,
  sdlgSupabase:{auth:{getSession:()=>new Promise(r=>{complete=r;}),onAuthStateChange(fn){event=fn;return {data:{subscription:{unsubscribe(){}}}};}}},
  withTimeout:work=>Promise.resolve(work),loadUserProfile:async()=>{profiles++;},
  setUser:u=>users.push(u),setUserRole:r=>roles.push(r),setUserBranchId(){},setAuthLoading(){},setLoginError(){},
  useEffect:fn=>{cleanup=fn();},
  setTimeout(fn){const key=++id;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key)
 };
 vm.createContext(context);vm.runInContext(html.slice(start,end),context);
 const alice={id:'fixture-alice'},bob={id:'fixture-bob'};
 event('SIGNED_IN',{user:alice});assert.equal(context.claimsLoadGeneration.current,1,'auth event invalidates in-flight claim reads immediately');assert.equal(profiles,0,'no profile queries inside auth callback');
 event('SIGNED_IN',{user:bob});assert.equal(timers.size,1,'new auth events cancel queued profile work');
 for(const [key,fn] of [...timers]){timers.delete(key);fn();}await flush();
 assert.deepEqual(users,[bob]);assert.equal(profiles,1);assert.deepEqual(roles,['viewer']);
 complete({data:{session:{user:alice}}});await flush();assert.deepEqual(users,[bob],'old session result ignored');
 event('SIGNED_IN',{user:alice});cleanup();for(const fn of timers.values())fn();await flush();assert.equal(profiles,1,'unmounted component does not load profiles');
 // Run the real profile function to verify stale role responses cannot win.
 let resolveRole;let applied=0;const profileContext={profileGeneration:{current:0},useCallback:fn=>fn,
  sdlgSupabase:{from:()=>({select(){return this},eq(){return this},maybeSingle:()=>new Promise(r=>{resolveRole=r;})})},
  setUserRole(){applied++;},setUserBranchId(){},setLoginError(){},console};
 vm.createContext(profileContext);
 const a=html.indexOf('    const loadUserProfile = useCallback('),b=html.indexOf('    useEffect(() => {\n        let mounted = true;',a);
 vm.runInContext(html.slice(a,b)+'\nglobalThis.loadProfile=loadUserProfile;',profileContext);
 const work=profileContext.loadProfile(alice);profileContext.profileGeneration.current++;
 resolveRole({data:{role:'admin',is_active:true},error:null});await work;assert.equal(applied,0,'stale admin role must not update UI');
 console.log('LEGACY AUTH UI: PASS (deferred profile fetch, latest event wins, stale role ignored, unmount cleanup)');
})().catch(e=>{console.error(e);process.exitCode=1;});
