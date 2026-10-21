import { mkdtemp, cp, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const executable=process.env.POWER_EAGLE_TEST_SAUCEPAN;
if(!executable) throw new Error('Set POWER_EAGLE_TEST_SAUCEPAN to a separately installed 0.10 executable');
const root=await mkdtemp(join(tmpdir(),'power-eagle-packaged-sdk-'));
try {
  await copyFile('dist/saucepan-host.cjs',join(root,'host.cjs'));
  await cp('examples/runtime-only',join(root,'source'),{recursive:true});
  await writeFile(join(root,'check.cjs'),String.raw`
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Client,EagleTransport,PowerEagleSaucepan,AcquiredPackageRepository}=require('./host.cjs');
(async()=>{
 const client=new Client({executable:process.argv[2],root:path.join(__dirname,'manager'),transport:new EagleTransport(require)});
 assert.deepEqual(await client.profiles(),['managed','explicit-update','temporary']);
 const options={client,stateRoot:path.join(__dirname,'state'),hostRequire:require};
 const app=new PowerEagleSaucepan(options);await app.initializeStore();await app.ensureRegistration();
 const refs=[crypto.randomUUID(),crypto.randomUUID()];
 const profile=await app.registerProfile('explicit-update',{catalog:[{uuid:refs[0],type:'update_policy',mode:'always'},{uuid:refs[1],type:'revision_policy',history:'none'}],acquisitionPolicyRefs:refs});
 assert.equal(profile.for_install,false);
 const explanation=await client.explainPolicies({operation:'retrieve',request:{source:{kind:'inline',source:{type:'local',path:path.join(__dirname,'source')}},selector:{type:'local'},policy_refs:profile.retrieval_policy_refs}},{policies:profile.catalog});
 assert.ok(explanation.axes);assert.ok(Array.isArray(explanation.restrictions));
 const request={source:{type:'local',path:path.join(__dirname,'source')},selector:{type:'local'},policyRefs:profile.combined_policy_refs};
 const repository=new AcquiredPackageRepository(app,require);
 const first=await repository.acquirePersistent(request);const reader=await repository.reader(first);
 fs.writeFileSync(path.join(__dirname,'source','manifest.json'),'{}');
 await assert.rejects(repository.acquirePersistent(request),/failed validation/);
 const otherApp=new PowerEagleSaucepan(options);const otherRepo=new AcquiredPackageRepository(otherApp,require);
 const restarted=await otherRepo.refreshPersistent();assert.equal(restarted.failures.length,0);assert.equal(restarted.packages[0].acquired.outputUuid,first.acquired.outputUuid);
 const otherReader=await otherRepo.reader(restarted.packages[0]);
 await repository.dispose(first);await client.reclaim();assert.ok(fs.existsSync(path.join(otherReader.directory,'manifest.json')));
 await reader.close();await client.reclaim();assert.ok(fs.existsSync(path.join(otherReader.directory,'manifest.json')));
 await otherReader.close();
 console.log(JSON.stringify({node:process.version,manager:process.argv[2],outsideCheckout:true,install:true,restart:true,failedReplacement:true,crossWindowReader:true,explicitRemoval:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
`);
  const result=spawnSync(process.env.POWER_EAGLE_TEST_NODE??process.execPath,[join(root,'check.cjs'),resolve(executable)],{cwd:root,encoding:'utf8',timeout:120000});
  process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Packaged SDK acceptance failed (${result.status})`);
} finally {await rm(root,{recursive:true,force:true});}
