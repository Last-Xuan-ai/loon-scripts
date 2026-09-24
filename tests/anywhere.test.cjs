const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "anywhere/zmq.js"), "utf8");
const loonCode = fs.readFileSync(path.join(root, "zmq.js"), "utf8");
const ruleSet = fs.readFileSync(path.join(root, "anywhere/zmq.amrs"), "utf8");
const domains = JSON.parse(fs.readFileSync(path.join(root, "anywhere/zmq-domains.json")));
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const url = "https://www2.zimuquan32.uk/index.php/vod/play/id/123/sid/1/nid/1.html";
const poster = "https://cdn.example:8443/sp/m3u8/current/vod.jpg?token=x%2Fy&amp;expires=1";
let passed = 0;
function test(name, fn) { fn(); console.log("PASS " + name); passed++; }
function page(mobile = false) {
  const placeholder = '<div class="' + (mobile ? "show_poster" : "popup") +
    '"><div title=">">placeholder</div><script>var nested="</div>";</script><!-- </div> --></div>';
  const shell = mobile ? '<div class="play_video"><i class="back"></i>' : '<div class="container">';
  return "<html><body>" + shell + placeholder + "</div>" +
    '<div class="play_scroll">KEEP 100% 中文 😀</div>' +
    '<span class="mac_history_set" data-pic="' + poster + '"></span></body></html>';
}
function wrap(html) {
  return '<script>document.write(decodeURIComponent(atob("' +
    Buffer.from(encodeURIComponent(html)).toString("base64") + '")));</script>';
}
function unwrap(html) {
  const match = /atob\("([^"]+)"\)/.exec(html);
  return match ? decodeURIComponent(Buffer.from(match[1], "base64").toString("utf8")) : html;
}
function invoke(input, overrides = {}, codecOverride = {}) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  const ctx = {body: bytes};
  const fields = {phase:"response", method:"GET", url, originalUrl:url, status:200,
    headers:Object.freeze([Object.freeze(["Content-Type","text/html; charset=utf-8"]),
      Object.freeze(["Set-Cookie","a=1"]),Object.freeze(["Set-Cookie","b=2"])]), ...overrides};
  for (const [name,value] of Object.entries(fields)) {
    Object.defineProperty(ctx,name,{value,writable:false,enumerable:true});
  }
  const original = Buffer.from(bytes);
  const codec = {encode: text=>encoder.encode(text), decode: data=>decoder.decode(data), ...codecOverride};
  const sandbox = {Uint8Array, Anywhere:{codec:{utf8:codec},log:{info(){}}},ctx};
  vm.runInNewContext('(function(){"use strict";\n' + code + "\nreturn process;})()(ctx);", sandbox,{timeout:3000});
  assert.deepEqual(Buffer.from(bytes),original,"original byte buffer must not be mutated");
  for (const [name,value] of Object.entries(fields)) assert.equal(ctx[name],value);
  return {ctx,bytes,text:decoder.decode(ctx.body),changed:ctx.body!==bytes};
}
function loon(body) {
  let result;
  vm.runInNewContext(loonCode,{$request:{url},$response:{status:200,body},$done:r=>result=r,console:{log(){}}},{timeout:3000});
  return result.body || body;
}
test("self-contained AMRS embeds the exact native script",()=>{
  const line = ruleSet.split("\n").find(x=>x.startsWith("1,100,"));
  const fields = line.split(",");
  assert.equal(fields.length,4);
  assert.equal(Buffer.from(fields[3],"base64").toString("utf8"),code);
  assert(code.includes("function process(ctx)"));
  assert(!/\$(?:done|request|response)\b/.test(code));
  new vm.Script(code);
});
test("explicit hostname suffixes are scoped and include legacy/current roots",()=>{
  const values=ruleSet.match(/^hostname = (.*)$/m)[1].split(", ");
  assert.deepEqual(values,domains);
  for (const domain of values) assert(/^(?:zimuquan|zmqurl|zmqsite)\d*\.(?:top|com|uk)$/.test(domain));
  for (const domain of ["zimuquan.top","zimuquan28.uk","zimuquan32.uk","zimuquan6.top","zimuquan16.com","zmqurl3.top"]) assert(values.includes(domain));
});
test("HTML URL gate excludes media, unrelated domains and publisher home",()=>{
  const raw=ruleSet.split("\n").find(x=>x.startsWith("1,100,")).split(",")[2];
  assert(raw.startsWith("(?i)"));
  const gate=new RegExp(raw.slice(4),"i");
  for (const domain of domains) assert(gate.test("https://www6."+domain+"/vod/play/id/1/sid/2/nid/3.html?q=1"));
  for (const address of ["https://www.zmqurl3.top/","https://cdn.example/a/index.m3u8",
    "https://zimuquan.top/video/a/0000.ts","https://zimuquan.top.evil.test/index.php/vod/play/id/1/sid/1/nid/1.html"]) assert(!gate.test(address));
});
for (const mobile of [false,true]) for (const wrapped of [false,true]) {
  test((mobile?"mobile":"desktop")+" "+(wrapped?"wrapped":"plain")+" preserves Loon repair behavior",()=>{
    const input=wrapped?wrap(page(mobile)):page(mobile);
    const result=invoke(input);
    assert(result.changed);
    assert.equal(result.text,loon(input));
    const html=unwrap(result.text);
    assert(html.includes('id="zmq-player-repair"'));
    assert(html.includes("https://cdn.example:8443/sp/m3u8/current/index.m3u8?token=x%2Fy&amp;expires=1"));
    assert(html.includes("KEEP 100% 中文 😀"));
    if(mobile){assert(html.includes('class="back"'));assert(html.includes('class="play_video"'));}
    assert(!invoke(result.ctx.body).changed);
  });
}
test("phase, method and status guards leave exact bytes unchanged",()=>{
  for(const fields of [{phase:"request"},{method:"HEAD"},{method:"POST"},{status:403},{status:null},
    {url:null},{url:"https://example.com/index.php/vod/play/id/1/sid/1/nid/1.html"}]) {
    assert(!invoke(page(),fields).changed);
  }
});
test("binary/non-HTML, empty and invalid UTF-8 are preserved",()=>{
  assert(!invoke(page(),{headers:[["Content-Type","application/octet-stream"]]}).changed);
  assert(!invoke(new Uint8Array()).changed);
  const valid=encoder.encode(page());
  const invalid=new Uint8Array(valid.length+1);invalid.set(valid);invalid[valid.length]=0xff;
  assert(!invoke(invalid).changed);
});
test("missing Content-Type and XHTML are supported",()=>{
  assert(invoke(page(),{headers:[]}).changed);
  assert(invoke(page(),{headers:[["content-type","application/xhtml+xml; charset=UTF-8"]]}).changed);
});
test("unknown template and malformed base64 pass through",()=>{
  for(const input of ["<html>unrelated</html>",'<script>atob("%%%");</script>']) assert(!invoke(input).changed);
});
test("codec exceptions do not replace original bytes",()=>{
  assert(!invoke(page(),{}, {decode(){throw new Error("decode");}}).changed);
  let calls=0;
  assert(!invoke(page(),{}, {encode(text){if(++calls===2)throw new Error("encode");return encoder.encode(text);}}).changed);
});
test("oversize input and expanded output keep original bytes",()=>{
  assert(!invoke(new Uint8Array(4*1024*1024+1)).changed);
  let calls=0;
  assert(!invoke(page(),{}, {encode(text){return ++calls===2?new Uint8Array(4*1024*1024+1):encoder.encode(text);}}).changed);
});
test("headers are read-only and duplicates are preserved",()=>{
  const result=invoke(page());
  assert.equal(result.ctx.headers.length,3);
  assert.deepEqual(result.ctx.headers.slice(1),[["Set-Cookie","a=1"],["Set-Cookie","b=2"]]);
});
console.log(passed+" Anywhere checks passed");
