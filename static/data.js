// Shared Supabase database on Pages; existing SQLite API when running locally.
async function clubApi(path, body, signal) {
  const config=window.CLUB33_CONFIG||{},url=new URL(path,location.origin);
  if(url.pathname==='/api/search')return deezerSearch(url.searchParams.get('q'),signal);
  if(config.supabaseUrl&&config.supabaseKey){
    let endpoint,method='POST',payload=body,prefer='return=minimal';
    if(url.pathname==='/api/week'){endpoint='rpc/club_week';payload={selected_week:url.searchParams.get('week')};}
    else if(url.pathname==='/api/member'){endpoint='club_members';payload={name:body.name.trim()};}
    else if(url.pathname==='/api/album'){endpoint='club_albums';}
    else if(url.pathname==='/api/rating'){endpoint='rpc/club_rate';payload={selected_album:body.album_id,selected_member:body.member_id,new_score:body.score};}
    else throw new Error('Action inconnue.');
    const headers={apikey:config.supabaseKey,'Content-Type':'application/json',Prefer:prefer};
    // Legacy anon JWTs require a Bearer header; publishable keys do not.
    if(config.supabaseKey.startsWith('eyJ'))headers.Authorization='Bearer '+config.supabaseKey;
    const response=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/'+endpoint,{method,headers,body:JSON.stringify(payload),signal});
    const text=await response.text();let data;try{data=text?JSON.parse(text):{};}catch{throw new Error('Réponse inattendue de Supabase.');}
    if(!response.ok){
      if(data.code==='23505')throw new Error(url.pathname==='/api/member'?'Ce prénom existe déjà.':'Tu as déjà proposé un album cette semaine.');
      if(['PGRST202','42P01','PGRST205'].includes(data.code))throw new Error('La base doit être initialisée avec le script SQL du guide Supabase.');
      throw new Error(data.message||'La base partagée ne répond pas.');
    }
    return data;
  }
  if(location.hostname.endsWith('.github.io'))throw new Error('La base partagée reste à connecter. Suis le guide SUPABASE.md du dépôt.');
  const response=await fetch(path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),signal});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Le serveur local ne répond pas.');
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Une erreur est survenue.');return data;
}

let deezerRequestId=0;
const deezerCache=new Map();
function deezerSearch(query,signal){
  if(signal?.aborted)return Promise.reject(new DOMException('Annulé','AbortError'));
  if(!query||query.trim().length<2)return Promise.resolve({results:[]});
  const cached=deezerCache.get(query);
  if(cached&&Date.now()-cached.time<600000)return Promise.resolve(cached.data);
  return new Promise((resolve,reject)=>{
    const callback='clubDeezer'+(++deezerRequestId),script=document.createElement('script');
    let timeout;
    function clean(){clearTimeout(timeout);script.remove();signal?.removeEventListener('abort',abort);window[callback]=()=>{};setTimeout(()=>delete window[callback],30000);}
    function abort(){clean();reject(new DOMException('Annulé','AbortError'));}
    window[callback]=data=>{
      clean();if(data.error){reject(new Error('Deezer est indisponible. Réessaie ou utilise la saisie manuelle.'));return;}
      const result={results:(data.data||[]).filter(a=>a.title&&a.artist?.name).map(a=>({title:a.title,artist:a.artist.name,cover_url:a.cover_big||a.cover_medium||'',link:a.link||'',deezer_url:a.link||'',spotify_url:'',source:'Deezer'}))};
      if(deezerCache.size>100)deezerCache.clear();deezerCache.set(query,{time:Date.now(),data:result});resolve(result);
    };
    script.onerror=()=>{clean();reject(new Error('Recherche Deezer indisponible. Vérifie ta connexion ou utilise la saisie manuelle.'));};
    timeout=setTimeout(()=>{clean();reject(new Error('Deezer met trop de temps à répondre. Réessaie.'));},12000);
    signal?.addEventListener('abort',abort,{once:true});
    script.src='https://api.deezer.com/search/album?'+new URLSearchParams({q:query,limit:'12',output:'jsonp',callback});
    document.head.append(script);
  });
}
