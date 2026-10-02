import { createInterface } from 'node:readline';
import { closeSync, openSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
const lines=createInterface({input:process.stdin});
for await (const line of lines) {
  const m=JSON.parse(line); if(!m.id) continue;
  let result={};
  if(m.method==='initialize') result={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1.0.0'}};
  if(m.method==='tools/list') result={tools:[{name:'echo',description:'Echo',inputSchema:{type:'object'}},...(process.env.DGOS_MCP_TEST_CREDENTIAL?[{name:'credential',description:'Credential check',inputSchema:{type:'object'}}]:[])]};
  if(m.method==='tools/call') result={structuredContent:{value:m.params.arguments.value,pid:process.pid}};
  if(m.method==='tools/call'&&m.params.name==='credential') result={structuredContent:{accepted:process.env.DGOS_MCP_TEST_CREDENTIAL==='fixture-secret'}};
  if(m.method==='tools/call'&&m.params.name==='probe') {
    let writeDenied=false; try { writeFileSync('/tmp/dgos-extension-sandbox-probe','x'); } catch { writeDenied=true; }
    const readDenied=(m.params.arguments?.readPaths??[]).map((path)=>{try{closeSync(openSync(path,'r'));return false;}catch{return true;}});
    const networkDenied=await new Promise((resolve)=>{ const socket=connect({host:'127.0.0.1',port:15141}); socket.on('connect',()=>{socket.destroy();resolve(false);}); socket.on('error',()=>resolve(true)); setTimeout(()=>{socket.destroy();resolve(true);},300); });
    result={structuredContent:{writeDenied,networkDenied,readDenied}};
  }
  process.stdout.write(`${JSON.stringify({jsonrpc:'2.0',id:m.id,result})}\n`);
}
