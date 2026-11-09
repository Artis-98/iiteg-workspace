import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const read=p=>readFileSync(p,'utf8');
test('extension manifests have stable unique slugs and safe external destinations',()=>{
 const entries=JSON.parse(read('src/extensions/manifest.json'));const seen=new Set();
 for(const e of entries){assert.match(e.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);assert.ok(!seen.has(e.slug));seen.add(e.slug);assert.ok(e.name);assert.ok(e.description);if(e.url)assert.ok(['http:','https:'].includes(new URL(e.url).protocol));}
});
test('the distributable has no production hosts, business modules, or commercial fonts',()=>{
 const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(p,e.name)):[join(p,e.name)]);
 for(const p of [...walk('src'),...walk('backend'),...walk('public')]){
  assert.ok(!/\.(ttf|otf|woff2?)$/.test(p),'No proprietary font files');
  assert.doesNotMatch(read(p),/(?:admin|api|print)\.iiteg\.com|drive\.google\.com|TASK_INTAKE_SECRET|CODEX_TASK_INTAKE_SECRET|ws_andele_|spectrum_project_id/i,p);
 }
 for(const name of ['print','andele','spectrum'])assert.equal(existsSync(`src/routes/_authenticated/${name}.tsx`),false);
});
test('configuration generator refuses to overwrite existing credentials',async()=>{
 const {mkdtempSync,writeFileSync:write,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {spawnSync}=await import('node:child_process');const {resolve}=await import('node:path');
 const temp=mkdtempSync(join(tmpdir(),'workspace-config-'));try{
  const command=resolve('tools/configure.mjs');let result=spawnSync(process.execPath,[command],{cwd:temp});assert.equal(result.status,0);
  const env=read(join(temp,'.env'));assert.match(env,/APP_KEY=[a-f0-9]{64}/);assert.match(env,/ADMIN_PASSWORD=[a-f0-9]{64}/);
  result=spawnSync(process.execPath,[command],{cwd:temp});assert.notEqual(result.status,0);assert.equal(read(join(temp,'.env')),env);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
