const { chromium }=require('playwright');
const { spawn }=require('node:child_process');
const { mkdtempSync,rmSync,mkdirSync }=require('node:fs');
const { tmpdir }=require('node:os');
const { join }=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const dir=mkdtempSync(join(tmpdir(),'club33-'));
 const server=spawn('python',['server.py'],{env:{...process.env,PORT:'3334',DATABASE_PATH:join(dir,'test.sqlite3')},stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3334/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  browser=await chromium.launch({channel:process.env.CI?'chrome':undefined});const page=await browser.newPage({viewport:{width:1440,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  mkdirSync('test-artifacts',{recursive:true});
  await page.goto('http://127.0.0.1:3334');await page.getByRole('button',{name:'Cédric',exact:true}).waitFor();await page.screenshot({path:'test-artifacts/welcome.png',fullPage:true,animations:'disabled'});await page.getByRole('button',{name:'Cédric',exact:true}).click();
  await page.getByRole('button',{name:'Ajouter une personne',exact:true}).click();await page.locator('#member-form input').fill('Test Browser');await page.locator('#member-form .primary').click();await page.locator('#member-dialog').waitFor({state:'hidden'});
  await page.locator('#change-profile').click();await page.getByRole('button',{name:'Test Browser',exact:true}).click();
  await page.locator('#add').click();await page.locator('#album-search').fill('Radiohead In Rainbows');
  await page.locator('.search-result').first().waitFor({timeout:20000});await page.locator('.search-result').first().click();
  assert((await page.locator('input[name="cover_url"]').inputValue()).includes('1000x1000'));
  await page.locator('#album-form .primary').click();await page.locator('.card').waitFor();
  await page.getByRole('button',{name:'8 sur 10',exact:true}).click();await page.locator('[data-score="8"].selected').waitFor();
  assert.equal(await page.locator('.platforms a').count(),2);
  const second=await browser.newPage();await second.goto('http://127.0.0.1:3334');await second.getByRole('button',{name:'Côme',exact:true}).click();await second.locator('.card').waitFor();
  assert((await second.locator('[data-voter="4"]').innerText()).includes('8'));
  assert.equal(await second.locator('.scores .selected').count(),0);
  assert.equal(await second.locator('[data-delete]').count(),0);
  await second.getByRole('button',{name:'3 sur 10',exact:true}).click();await second.locator('[data-score="3"].selected').waitFor();
  await page.getByRole('button',{name:'0 sur 10',exact:true}).click();await page.locator('[data-score="0"].selected').waitFor();
  assert((await page.locator('[data-voter="2"]').innerText()).includes('3'));
  assert((await page.locator('[data-voter="4"]').innerText()).includes('0'));
  await second.reload();await second.locator('[data-score="3"].selected').waitFor();
  const seeded=await page.evaluate(async()=>{
   const snapshot=await clubApi('/api/week?week='+key(week));
   for(const [id,query] of [[1,'Daft Punk Random Access Memories'],[3,'Kendrick Lamar DAMN']]){
    const data=await clubApi('/api/search?q='+encodeURIComponent(query));
    if(data.results.length){const a=data.results[0];await clubApi('/api/album',{member_id:id,week:key(week),title:a.title,artist:a.artist,cover_url:a.cover_url,link:a.link,deezer_url:a.deezer_url,spotify_url:''});}
   }
   await refresh(true);return snapshot.albums[0].id;
  });
  await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('.cover img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:'test-artifacts/week-desktop.png',fullPage:true,animations:'disabled'});
  await page.locator('nav a[data-nav="history"]').click();await page.waitForURL('**/history.html');await page.locator('.history-item').waitFor();
  assert.equal(await page.locator('#welcome').isVisible(),false);
  await page.waitForFunction(()=>document.querySelector('.history-covers img')?.complete);
  await page.screenshot({path:'test-artifacts/history-desktop.png',fullPage:true,animations:'disabled'});
  await page.locator('.history-item').first().click();await page.waitForURL('**/index.html?week=*');await page.locator(`[data-card="${seeded}"] [data-score="0"].selected`).waitFor();
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:'test-artifacts/week-mobile.png',fullPage:true,animations:'disabled'});
  await page.locator(`[data-delete="${seeded}"]`).click();await page.getByRole('button',{name:'Garder l’album',exact:true}).click();assert.equal(await page.locator(`[data-card="${seeded}"]`).count(),1);
  await page.locator(`[data-delete="${seeded}"]`).click();await page.getByRole('button',{name:'Supprimer mon album',exact:true}).click();await page.locator(`[data-card="${seeded}"]`).waitFor({state:'detached'});
  assert.equal(await page.locator('#add').isEnabled(),true);
  assert.deepEqual(errors,[]);console.log('Browser OK: HD covers, independent ratings, profile navigation, history page, owner deletion, responsive layout.');
 }finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.once('exit',r));rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
