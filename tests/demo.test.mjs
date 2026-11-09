import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('dummy preview serves the real frontend and fictional data without allowing edits',async()=>{
 const child=spawn(process.execPath,['tools/demo-server.mjs'],{env:{...process.env,DEMO_PORT:'0'},stdio:['ignore','pipe','pipe']});
 try{
  const base=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('Demo server did not start')),10000);
   child.once('error',reject);child.once('exit',code=>reject(new Error(`Demo exited: ${code}`)));
   child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});
  });
  const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/IITEG Workspace/);
  const login=await fetch(base+'/api/auth.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'demo@example.com',password:'demo'})});
  assert.equal((await login.json()).user.email,'demo@example.com');
  const spaces=await (await fetch(base+'/api/admin/workspace.php?resource=spaces')).json();assert.deepEqual(spaces.spaces.map(s=>s.name),['Product','Design','Operations']);
  const query=base+'/api/admin/workspace.php?resource=tasks&space_id=1';
  const before=await (await fetch(query)).json();assert.ok(before.tasks.length>0);
  const attempt=await fetch(base+'/api/admin/workspace.php?resource=tasks&id=1',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Changed'})});
  assert.equal(attempt.status,405);
  const after=await (await fetch(query)).json();assert.deepEqual(after.tasks,before.tasks);
 }finally{child.kill();}
});
