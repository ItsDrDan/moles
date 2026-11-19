#!/usr/bin/env node
/* Deep-link checks: loads index.html?… in Chromium (Playwright) at a phone size (390×844, touch) and a
   desktop size, and checks that each demo link opens its lab, that the plain URL still opens the normal
   start screen, and that nothing logs a console error. Shared scripts from itsdrdan.github.io are served
   from the sibling clones (../games, ../questionbank); track.js is stubbed so tests send no stats.
   Usage: NODE_PATH=/path/to/node_modules node tools/check-deeplink.js   (needs the playwright package) */
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..'),SIB=path.join(ROOT,'..');
const page0='file://'+path.join(ROOT,'index.html');
const SIZES=[['phone',{viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3}],['desktop',{viewport:{width:1280,height:900}}]];
const inView=sel=>`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return r.height>0&&r.top>=-4&&r.top<innerHeight*.6;})()`;
let fails=0,checks=0;const ok=(c,m)=>{checks++;if(!c){fails++;console.log('FAIL',m);}};
async function run(CASES){
 const browser=await chromium.launch();
 for(const [size,opts] of SIZES){
  for(const [query,tests] of CASES){
   const ctx=await browser.newContext({...opts,reducedMotion:'reduce'});const page=await ctx.newPage();const errs=[];
   await ctx.route('https://itsdrdan.github.io/**',r=>{const u=new URL(r.request().url()),p=path.join(SIB,decodeURIComponent(u.pathname));
    if(u.pathname.endsWith('/track.js'))return r.fulfill({status:200,contentType:'text/javascript',body:''});
    if(fs.existsSync(p)&&fs.statSync(p).isFile())return r.fulfill({path:p});return r.abort();});
   await ctx.route(/^https?:\/\/(?!itsdrdan\.github\.io)/,r=>r.abort());
   page.on('console',m=>{if(m.type()==='error'&&!/net::ERR_FAILED|ERR_INTERNET|Failed to load resource/.test(m.text()))errs.push(m.text());});
   page.on('pageerror',e=>errs.push(String(e)));
   await page.goto(page0+query,{waitUntil:'load'});await page.waitForTimeout(400);
   const tag=size+' '+(query||'(plain)');
   for(const [expr,msg] of tests){let v;try{v=await page.evaluate(expr);}catch(e){v='threw '+e.message;}ok(v===true,tag+': '+msg+' ('+JSON.stringify(v)+')');}
   ok(errs.length===0,tag+': console errors: '+errs.join(' | '));
   await ctx.close();
  }
 }
 await browser.close();
 console.log((fails?'FAILED ':'OK ')+checks+' checks, '+fails+' failures');process.exit(fails?1:0);
}
const shown=id=>`(()=>{const e=document.getElementById('${id}');return !!e&&!e.hidden&&e.getClientRects().length>0;})()`;
const mm=[["byId('mmSection').open===true",'Mole Machine panel is open'],[inView('#mmSection'),'panel is scrolled into view'],
 ["byId('mmBody').getBoundingClientRect().height>100&&byId('mmSubs').children.length>0",'substance buttons and slider are showing'],
 ["(()=>{const s=byId('mmG'),before=byId('mmBody').textContent;s.value='100';s.dispatchEvent(new Event('input',{bubbles:true}));return byId('mmBody').textContent!==before;})()",'moving the mass slider updates the readouts']];
run([
 ['',[[shown('learnView'),'plain URL opens the Learn Trail'],["state.course==='3A'",'default course 3A'],["byId('mmSection').open===false",'Mole Machine stays closed']]],
 ['?open=molemachine',[...mm,[shown('learnView'),'start screen underneath is unchanged'],["state.course==='3A'",'course 3A']]],
 ['?course=1A&open=molemachine',[...mm,["state.course==='1A'",'course 1A kept']]],
]);
