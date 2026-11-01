// Copied into an independent installation; imports only the installed public API.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClaudeProvider, createCodexProvider } from '@power-eagle/agent-providers';

const require = createRequire(import.meta.url);
const fixture = resolve('synthetic-cli.cjs');
await writeFile(fixture, `
const args=process.argv.slice(2), provider=args.shift();
if(args[0]==='--version') { console.log(provider==='claude'?'2.9.0 (Claude Code)':'codex-cli 0.999.0'); process.exit(0); }
if(args.includes('stream-json')||args[0]==='app-server') {
  require('readline').createInterface({input:process.stdin}).on('line',line=>{
    const m=JSON.parse(line);
    if(provider==='claude') console.log(JSON.stringify({type:'control_response',response:{request_id:m.request_id,subtype:'success',response:{models:[{value:'fixture',displayName:'Fixture',supportsEffort:true,supportedEffortLevels:['low']}]}}}));
    else if(m.id) console.log(JSON.stringify({id:m.id,result:m.method==='initialize'?{}:{data:[{model:'fixture',displayName:'Fixture',isDefault:true,supportedReasoningEfforts:[{reasoningEffort:'low'}]}],nextCursor:null}}));
  });
} else {
  let prompt=''; process.stdin.on('data',data=>prompt+=data); process.stdin.on('end',()=>{
    if(prompt==='FAIL') { process.stderr.write('unauthorized'); process.exitCode=1; return; }
    console.log(JSON.stringify(provider==='claude'?{result:'Edited: '+prompt}:{type:'item.completed',item:{type:'agent_message',text:'Edited: '+prompt}}));
  });
}
`);
for (const [name, factory] of [['claude', createClaudeProvider], ['codex', createCodexProvider]]) {
  const directories = new Set(); let launches = 0;
  const hostRequire = id => id === 'node:child_process' ? {
    spawn(executable, args, options) {
      // No real CLI is reachable: every process must be this adapter's fixture.
      assert.equal(executable, process.execPath);
      assert.equal(options.shell, false);
      launches += 1;
      if (args[0] !== '--version') directories.add(options.cwd);
      return spawn(executable, [fixture, name, ...args], { ...options, env: { ...process.env, PATH: '' } });
    },
  } : require(id);
  const adapter = factory({ hostRequire, executable: process.execPath });
  assert.equal(launches, 0);
  assert.equal(await adapter.available(), true);
  assert.equal((await adapter.discover())[0].label, 'Fixture');
  assert.equal(await adapter.generate({ prompt: 'A document', model: 'fixture', effort: 'low' }), 'Edited: A document');
  await assert.rejects(adapter.generate({ prompt: 'FAIL' }), /authentication failed/);
  for (const directory of directories) await assert.rejects(access(directory));
  console.log(`${name}: installed API, real synthetic child, discovery, text generation, failure and cleanup passed`);
}
