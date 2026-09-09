const { chromium }=require('playwright');
const { spawn }=require('node:child_process');
const { mkdtempSync,rmSync }=require('node:fs');
const { tmpdir }=require('node:os');
const { join }=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const dir=mkdtempSync(join(tmpdir(),'club33-'));
 const server=spawn('python',['server.py'],{env:{...process.env,PORT:'3334',DATABASE_PATH:join(dir,'test.sqlite3')},stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3334/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  browser=await chromium.launch();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3334');await page.getByRole('button',{name:'Cédric',exact:true}).click();
  await page.getByRole('button',{name:'＋ Une personne',exact:true}).click();await page.locator('#member-form input').fill('Test Browser');await page.locator('#member-form .primary').click();await page.locator('#member-dialog').waitFor({state:'hidden'});
  await page.locator('#change-profile').click();await page.getByRole('button',{name:'Test Browser',exact:true}).click();
  await page.locator('#add').click();await page.locator('#album-search').fill('Radiohead In Rainbows');
  await page.locator('.search-result').first().waitFor({timeout:20000});await page.locator('.search-result').first().click();
  assert((await page.locator('input[name="cover_url"]').inputValue()).startsWith('https://'));
  await page.locator('#album-form .primary').click();await page.locator('.card').waitFor();
  await page.getByRole('button',{name:'8 sur 10',exact:true}).click();await page.locator('[data-score="8"].selected').waitFor();
  assert.equal(await page.locator('.platforms a').count(),2);
  await page.locator('.history summary').click();assert.equal(await page.locator('.history-item').count(),1);
  const second=await browser.newPage();await second.goto('http://127.0.0.1:3334');await second.getByRole('button',{name:'Côme',exact:true}).click();await second.locator('.card').waitFor();assert((await second.locator('.votes').innerText()).includes('Test Browser : 8'));
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  assert.deepEqual(errors,[]);console.log('Browser OK: profiles, member creation, live Deezer search, artwork, album, rating, history, shared data, mobile.');
 }finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.once('exit',r));rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
