const $ = selector => document.querySelector(selector);
const page = document.body.dataset.page || 'week';
const historyPage = page === 'history';
const coversPage = page === 'covers';
const colors = ['#e4e8d7', '#f1dcd0', '#dce4ec', '#e6dded', '#f0e7ce'];
let member = null;
try { member = Number(sessionStorage.getItem('club33-profile')) || null; } catch {}
let state = { members: [], albums: [], history: [], leaderboard: [] };
let requestId = 0, toastTimer, searchTimer, searchController, searchVersion = 0;
let searchResults = [], deleteTarget = null, historyLimit = 12, coversLimit = 8, previewsLoading = false;
const previews = new Map();
const trashIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7M14 10v7"/></svg>';
const spotifyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><g fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round"><path d="M6 9c4-1.4 8-1 12 1M7 12c3-1 7-.6 10 1M8 15c2-.5 5-.2 8 1"/></g></svg>';
const deezerIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 14h3v7H2zM6 10h3v11H6zM10 4h3v17h-3zM14 8h3v13h-3zM18 12h3v9h-3z"/></svg>';

function monday(value = new Date()) {
  const d = new Date(value); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d;
}
function key(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
let week = monday();
const requestedWeek = new URLSearchParams(location.search).get('week');
if (requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)) {
  const requestedDate = new Date(requestedWeek + 'T12:00:00');
  if (!isNaN(requestedDate) && key(monday(requestedDate)) === requestedWeek) week = requestedDate;
}
function esc(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function dateLabel(value, options = {day:'numeric', month:'long', year:'numeric'}) { return new Date(value + 'T12:00:00').toLocaleDateString('fr-FR', options); }
function weekLabel(value) {
  const end = new Date(value + 'T12:00:00'); end.setDate(end.getDate() + 6);
  return `${dateLabel(value, {day:'numeric',month:'long'})} — ${end.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}`;
}
function tint(id) { return colors[(Number(id) - 1) % colors.length]; }
function avatar(person) { return `<span class="avatar" style="--tint:${tint(person.id)}" aria-hidden="true">${esc(person.name.slice(0,2).toUpperCase())}</span>`; }
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 4500); }
function storeProfile() { try { if (member) sessionStorage.setItem('club33-profile', String(member)); else sessionStorage.removeItem('club33-profile'); } catch {} }
function hdCover(raw) {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith('.dzcdn.net')) url.pathname = url.pathname.replace(/\/(?:250|500)x(?:250|500)-/, '/1000x1000-');
    if (url.hostname.endsWith('.mzstatic.com')) url.pathname = url.pathname.replace(/\/(?:100|600)x(?:100|600)bb\./, '/1200x1200bb.');
    return url.href;
  } catch { return ''; }
}
function coverImage(album, extra = '') {
  const src = hdCover(album.cover_url);
  return src ? `<img src="${esc(src)}" data-fallback="${esc(album.cover_url)}" alt="Pochette de ${esc(album.title)}" loading="lazy" decoding="async" ${extra}>` : '<div class="cover-placeholder" aria-hidden="true"><span>✳</span></div>';
}

function renderAlbum(album, index) {
  const author = state.members.find(m => m.id === album.member_id);
  const own = album.member_id === member;
  const mine = album.ratings.find(r => r.member_id === member);
  const me = state.members.find(m => m.id === member);
  const average = album.ratings.length ? (album.ratings.reduce((sum,r) => sum + r.score, 0) / album.ratings.length).toLocaleString('fr-FR',{maximumFractionDigits:1}) : '—';
  const myReview = mine?.review || '';
  const query = encodeURIComponent(album.artist + ' ' + album.title);
  const spotify = album.spotify_url || 'https://open.spotify.com/search/' + query;
  const directDeezer = album.deezer_url || (album.link?.startsWith('https://www.deezer.com/') ? album.link : '');
  const deezer = directDeezer || 'https://www.deezer.com/search/' + query + '/album';
  return `<article class="card" data-card="${album.id}" style="animation-delay:${index * 40}ms">
    <div class="card-top"><div class="proposer">${author ? avatar(author) : ''}<span>${esc(author?.name || '')}${own ? '<small>TOI</small>' : ''}</span></div><span class="card-number">FACE ${String(index+1).padStart(2,'0')}</span></div>
    <div class="cover">${coverImage(album)}</div>
    <div class="card-body"><div class="album-info"><h2>${esc(album.title)}</h2><p class="artist">${esc(album.artist)}</p></div>
    <div class="platforms"><a class="spotify-link" href="${esc(spotify)}" target="_blank" rel="noopener noreferrer" aria-label="${album.spotify_url ? 'Écouter' : 'Rechercher'} ${esc(album.title)} sur Spotify">${spotifyIcon}${album.spotify_url ? 'Spotify' : 'Spotify · rechercher'} ↗</a><a class="deezer-link" href="${esc(deezer)}" target="_blank" rel="noopener noreferrer" aria-label="${directDeezer ? 'Écouter' : 'Rechercher'} ${esc(album.title)} sur Deezer">${deezerIcon}${directDeezer ? 'Deezer' : 'Deezer · rechercher'} ↗</a></div>
    <div class="rating"><div class="rating-heading"><span>Ta note · ${esc(me?.name || '')}</span><span class="personal-score">${mine ? `${mine.score} / 10` : 'À toi d’écouter'}</span></div>
    <div class="scores" role="group" aria-label="Note de ${esc(me?.name || '')} pour ${esc(album.title)}">${Array.from({length:11},(_,n) => `<button data-album="${album.id}" data-score="${n}" class="${mine?.score === n ? 'selected' : ''}" aria-pressed="${mine?.score === n}" aria-label="${n} sur 10">${n}</button>`).join('')}</div>
    <label class="review-box">Ta review<textarea data-review="${album.id}" maxlength="600" rows="3" placeholder="Ton avis sur l’album...">${esc(myReview)}</textarea></label>
    <button class="save-review" data-save-rating="${album.id}" ${mine ? '' : 'disabled'}>${mine ? 'Enregistrer review' : 'Choisis une note d’abord'}</button>
    <div class="reviews" aria-label="Reviews individuelles">${album.ratings.filter(r => r.review).map(r => { const voter = state.members.find(m => m.id === r.member_id); return `<blockquote class="review-chip ${r.member_id === member ? 'mine' : ''}"><strong>${esc(voter?.name || '')} · ${r.score}/10</strong><p>${esc(r.review)}</p></blockquote>`; }).join('')}</div>
    <div class="votes" aria-label="Notes individuelles">${state.members.map(m => { const rating = album.ratings.find(r => r.member_id === m.id); return `<span class="vote-chip ${m.id === member ? 'mine' : ''}" data-voter="${m.id}">${esc(m.name)} <b>${rating ? rating.score : '—'}</b></span>`; }).join('')}</div></div></div>
    <div class="rating-footer"><span class="average-label"><b>${average}</b><small>/10</small> · moyenne du club</span>${own ? `<button class="delete-album" data-delete="${album.id}" aria-label="Supprimer ma proposition ${esc(album.title)}">${trashIcon} Retirer</button>` : `<span class="rating-count">${album.ratings.length} note${album.ratings.length > 1 ? 's' : ''}</span>`}</div></article>`;
}

function renderLeaderboard() {
  const rows = (state.leaderboard || []).map((entry, index) => {
    const person = state.members.find(m => m.id === entry.member_id) || entry;
    const average = entry.average === null ? '—' : Number(entry.average).toLocaleString('fr-FR', {maximumFractionDigits:1});
    const notes = Number(entry.rating_count);
    const albums = Number(entry.album_count);
    return `<div class="leaderboard-row ${person.id === member ? 'mine' : ''}" style="--tint:${tint(person.id)}">
      <span class="rank">${index + 1}</span>${avatar(person)}
      <span class="leader-name">${esc(person.name)}</span>
      <span class="leader-meta">${albums} album${albums > 1 ? 's' : ''} · ${notes} note${notes > 1 ? 's' : ''} reçue${notes > 1 ? 's' : ''}</span>
      <strong>${average}<small>/10</small></strong>
    </div>`;
  }).join('');
  $('#leaderboard').innerHTML = `<div class="leaderboard-heading"><div><span class="eyebrow"><i></i> CLASSEMENT</span><h2>Qui propose les meilleurs albums ?</h2></div><p>Moyenne des notes reçues sur tous les albums envoyés.</p></div><div class="leaderboard-list">${rows || '<p class="leaderboard-empty">Le classement apparaîtra dès les premières notes.</p>'}</div>`;
}

function render() {
  const me = state.members.find(m => m.id === member);
  if (member && !me) { member = null; storeProfile(); }
  $('#profiles').innerHTML = state.members.map(m => `<button data-member="${m.id}" aria-label="${esc(m.name)}">${avatar(m)}${esc(m.name)}</button>`).join('');
  $('#welcome').hidden = member !== null; $('#club').hidden = member === null;
  $('#change-profile').hidden = member === null;
  $('#change-profile').innerHTML = me ? `${avatar(me)}${esc(me.name)}<span>⌄</span>` : '';
  $('#change-profile').setAttribute('aria-label', 'Changer de profil');
  $('#week-view').hidden = page !== 'week'; $('#history-view').hidden = !historyPage; if ($('#covers-view')) $('#covers-view').hidden = !coversPage;
  renderLeaderboard();
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === page) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  $('#week-title').innerHTML = (key(week) === key(monday()) ? 'Cette semaine' : 'Une semaine à réécouter') + '<span>.</span>';
  $('#week-dates').textContent = weekLabel(key(week));
  $('#member-avatars').innerHTML = state.members.slice(0,5).map(m => avatar(m)).join('');
  $('#progress').innerHTML = `<strong>${state.albums.length}/${state.members.length}</strong> albums proposés`;
  const hasProposal = state.albums.some(a => a.member_id === member);
  $('#add').disabled = hasProposal;
  $('#my-proposal-status').textContent = hasProposal ? 'Ton album est sur la platine.' : 'Un disque qui mérite d’être partagé.';
  if (page === 'week') {
    $('#albums').innerHTML = state.albums.map(renderAlbum).join('');
    if (!hasProposal) $('#albums').insertAdjacentHTML('beforeend', `<div class="empty-card"><img src="./favicon.svg" alt=""><h2>Et toi, tu nous fais<br>écouter quoi ?</h2><p>Un coup de cœur, un classique ou une découverte. La prochaine piste est à toi.</p><button data-add-album>+ Proposer mon album</button></div>`);
  } else if (historyPage) { renderHistory(); loadPreviews(); }
  else if (coversPage) { renderCovers(); loadCoverWeeks(); }
}

function filteredHistory() {
  const query = $('#history-filter').value.toLocaleLowerCase('fr-FR').trim();
  return state.history.filter(h => !query || (h.week + ' ' + weekLabel(h.week)).toLocaleLowerCase('fr-FR').includes(query));
}
function renderHistory() {
  const totalAlbums = state.history.reduce((sum,h) => sum + Number(h.album_count), 0);
  const totalRatings = state.history.reduce((sum,h) => sum + Number(h.rating_count), 0);
  $('#history-stats').innerHTML = `<div class="stat"><b>${state.history.length}</b><span>semaines d’écoute</span></div><div class="stat"><b>${totalAlbums}</b><span>albums partagés</span></div><div class="stat"><b>${totalRatings}</b><span>notes échangées</span></div>`;
  const list = filteredHistory();
  $('#history').innerHTML = list.slice(0,historyLimit).map((h,i) => {
    const albums = previews.get(h.week)?.albums || [];
    const covers = albums.length ? albums.slice(0,3).map(a => coverImage(a)).join('') : '<span class="archive-record" aria-hidden="true">✳</span>';
    const status = h.week === key(monday()) ? 'EN COURS' : h.week > key(monday()) ? 'À VENIR' : 'DANS LES ARCHIVES';
    return `<a class="history-item" href="./index.html?week=${h.week}"><div class="history-covers" style="--tint:${colors[i%colors.length]}">${covers}</div><div class="history-card-body"><span class="eyebrow">${status}</span><h3>Semaine du ${dateLabel(h.week)}</h3><p>${albums.length ? albums.map(a => esc(a.title)).join(' · ') : `${h.album_count} albums à retrouver`}</p><div class="history-meta"><span>${h.album_count} albums · <b>${h.average === null ? 'Pas encore notés' : Number(h.average).toLocaleString('fr-FR') + '/10'}</b></span><span>↗</span></div></div></a>`;
  }).join('') || `<div class="empty-history"><img src="./favicon.svg" alt=""><p>${state.history.length ? 'Aucune semaine ne correspond à cette date.' : 'La collection commence avec votre premier album.'}</p><a href="./">Retour à cette semaine ↗</a></div>`;
  $('#more-history').hidden = list.length <= historyLimit;
}

function albumAverage(album) {
  return album.ratings.length ? album.ratings.reduce((sum,r) => sum + r.score, 0) / album.ratings.length : null;
}
function coverWeekMatches(h, query) {
  if (!query) return true;
  const albums = previews.get(h.week)?.albums || [];
  const haystack = [h.week, weekLabel(h.week), ...albums.flatMap(a => {
    const author = state.members.find(m => m.id === a.member_id);
    return [a.title, a.artist, author?.name || ''];
  })].join(' ').toLocaleLowerCase('fr-FR');
  return haystack.includes(query);
}
function filteredCoverWeeks() {
  const query = $('#covers-filter')?.value.toLocaleLowerCase('fr-FR').trim() || '';
  return state.history.filter(h => coverWeekMatches(h, query));
}
function coverEntries() {
  const query = $('#covers-filter')?.value.toLocaleLowerCase('fr-FR').trim() || '';
  return filteredCoverWeeks().slice(0,coversLimit).flatMap(h => (previews.get(h.week)?.albums || []).map(album => ({album, week:h.week}))).filter(({album, week}) => {
    if (!query) return true;
    const author = state.members.find(m => m.id === album.member_id);
    const haystack = [week, weekLabel(week), album.title, album.artist, author?.name || ''].join(' ').toLocaleLowerCase('fr-FR');
    return haystack.includes(query);
  });
}
function coverTile(entry) {
  const album = entry.album || entry;
  const weekValue = entry.week;
  const average = albumAverage(album);
  const locked = average === null;
  return `<article class="cover-tile ${locked ? 'locked' : 'listened'}" title="${esc(album.title)} - ${esc(album.artist)}">
    <a class="cover-frame" href="./index.html?week=${esc(weekValue || key(week))}" aria-label="Voir ${esc(album.title)} pendant la semaine du ${esc(weekValue ? dateLabel(weekValue) : dateLabel(key(week)))}">${coverImage(album)}${locked ? '<span class="lock-badge" aria-label="Pas encore note">🔒</span>' : `<span class="score-badge">${average.toLocaleString('fr-FR',{maximumFractionDigits:1})}</span>`}</a>
    <div class="cover-caption"><strong>${esc(album.title)}</strong><span>${esc(album.artist)}</span><small>${weekValue ? dateLabel(weekValue) + ' · ' : ''}${locked ? 'pas encore note' : `${album.ratings.length} note${album.ratings.length > 1 ? 's' : ''}`}</small></div>
  </article>`;
}
function renderCovers() {
  const totalAlbums = state.history.reduce((sum,h) => sum + Number(h.album_count), 0);
  const loadedEntries = coverEntries();
  const lockedCount = loadedEntries.filter(({album}) => !album.ratings.length).length;
  const activeMembers = state.members.filter(m => loadedEntries.some(({album}) => album.member_id === m.id));
  $('#covers-stats').innerHTML = `<div class="stat"><b>${state.members.length}</b><span>personnes</span></div><div class="stat"><b>${totalAlbums}</b><span>pochettes</span></div><div class="stat"><b>${lockedCount}</b><span>verrouillees visibles</span></div>`;
  const loading = filteredCoverWeeks().slice(0,coversLimit).some(h => !previews.has(h.week));
  const sections = state.members.map(person => {
    const entries = loadedEntries.filter(({album}) => album.member_id === person.id);
    if (!entries.length && activeMembers.length) return '';
    const rated = entries.filter(({album}) => album.ratings.length);
    const receivedScores = entries.flatMap(({album}) => album.ratings.map(r => r.score));
    const personAverage = receivedScores.length ? (receivedScores.reduce((sum,score) => sum + score, 0) / receivedScores.length).toLocaleString('fr-FR',{maximumFractionDigits:1}) + '/10' : 'Pas encore note';
    const body = entries.length ? entries.map(coverTile).join('') : '<div class="covers-loading">Aucune pochette pour cette personne sur les semaines chargees.</div>';
    return `<section class="cover-week cover-person" style="--tint:${tint(person.id)}"><div class="cover-week-head"><div><span class="eyebrow"><i></i> ${esc(person.name).toUpperCase()}</span><h2>${esc(person.name)}</h2></div><p>${entries.length} album${entries.length > 1 ? 's' : ''} · ${rated.length} ecoute${rated.length > 1 ? 's' : ''} · ${personAverage}</p></div><div class="cover-grid">${body}</div></section>`;
  }).join('');
  $('#covers-wall').innerHTML = sections || (loading ? '<div class="covers-loading">Chargement des pochettes...</div>' : `<div class="empty-history"><img src="./favicon.svg" alt=""><p>${state.history.length ? 'Aucune pochette ne correspond a cette recherche.' : 'La collection commence avec votre premier album.'}</p><a href="./">Retour a cette semaine ↗</a></div>`);
  $('#more-covers').hidden = filteredCoverWeeks().length <= coversLimit;
}
async function loadCoverWeeks() {
  if (previewsLoading || !coversPage || !member) return;
  const needed = filteredCoverWeeks().slice(0,coversLimit).filter(h => !previews.has(h.week));
  if (!needed.length) return;
  previewsLoading = true;
  for (let i=0; i<needed.length; i+=3) {
    await Promise.all(needed.slice(i,i+3).map(async h => { try { const data = await clubApi('/api/week?week='+h.week); previews.set(h.week,{albums:data.albums}); } catch {} }));
    renderCovers();
  }
  previewsLoading = false; renderCovers();
}
async function loadPreviews() {
  if (previewsLoading || !historyPage || !member) return;
  const needed = filteredHistory().slice(0,historyLimit).filter(h => !previews.has(h.week));
  if (!needed.length) return;
  previewsLoading = true;
  for (let i=0; i<needed.length; i+=3) {
    await Promise.all(needed.slice(i,i+3).map(async h => { try { const data = await clubApi('/api/week?week='+h.week); previews.set(h.week,{albums:data.albums}); } catch {} }));
  }
  previewsLoading = false; renderHistory();
}

async function refresh(force = false) {
  const id = ++requestId;
  try {
    const data = await clubApi('/api/week?week=' + key(week)); if (id !== requestId) return;
    $('#connection').textContent = ''; document.querySelectorAll('.add-person').forEach(b => b.disabled = false);
    if (force || JSON.stringify(data) !== JSON.stringify(state)) {
      state = data; previews.clear(); previews.set(key(week),{albums:data.albums}); render();
    }
  } catch (error) { if (id === requestId) { $('#connection').textContent = error.message; document.querySelectorAll('.add-person').forEach(b => b.disabled = true); } }
}
$('#profiles').onclick = e => { const b = e.target.closest('[data-member]'); if (b) { member = Number(b.dataset.member); storeProfile(); render(); } };
$('#change-profile').onclick = () => { member = null; storeProfile(); render(); };
function navigate(days) {
  week.setDate(week.getDate()+days); state.albums = []; render(); $('#add').disabled = true;
  history.replaceState(null,'',key(week) === key(monday()) ? './index.html' : './index.html?week='+key(week)); refresh(true);
}
$('#previous').onclick = () => navigate(-7); $('#next').onclick = () => navigate(7);
$('#today').onclick = () => { week = monday(); navigate(0); };
if ($('#history-filter')) $('#history-filter').oninput = () => { historyLimit = 12; renderHistory(); loadPreviews(); };
if ($('#more-history')) $('#more-history').onclick = () => { historyLimit += 12; renderHistory(); loadPreviews(); };
if ($('#covers-filter')) $('#covers-filter').oninput = () => { coversLimit = 8; renderCovers(); loadCoverWeeks(); };
if ($('#more-covers')) $('#more-covers').onclick = () => { coversLimit += 8; renderCovers(); loadCoverWeeks(); };
document.querySelectorAll('.add-person').forEach(b => b.onclick = () => { $('#member-form').reset(); $('#member-form .form-error').textContent = ''; $('#member-dialog').showModal(); });
function openAlbumForm() { $('#album-form').reset(); $('#album-form .form-error').textContent = ''; $('#manual-fields').open = false; $('#album-dialog').showModal(); }
$('#add').onclick = openAlbumForm;
document.querySelectorAll('.close,.close-dialog').forEach(b => b.onclick = () => b.closest('dialog').close());
$('#member-form').onsubmit = async e => {
  e.preventDefault(); const form = e.target, b = form.querySelector('.primary'); b.disabled = true;
  try { await clubApi('/api/member',{name:form.elements.name.value}); form.closest('dialog').close(); await refresh(true); toast('Une nouvelle oreille dans le club.'); }
  catch (error) { form.querySelector('.form-error').textContent = error.message; } finally { b.disabled = false; }
};
$('#albums').onclick = async e => {
  if (e.target.closest('[data-add-album]')) return openAlbumForm();
  const remove = e.target.closest('[data-delete]');
  if (remove) {
    const album = state.albums.find(a => a.id === Number(remove.dataset.delete));
    if (!album || album.member_id !== member) return;
    deleteTarget = {album_id:album.id, member_id:member};
    $('#delete-description').textContent = `${album.title} — ${album.artist}`;
    $('#delete-form .form-error').textContent = ''; $('#delete-dialog').showModal(); return;
  }
  const saveReview = e.target.closest('[data-save-rating]');
  if (saveReview && member !== null) {
    const albumId = Number(saveReview.dataset.saveRating);
    const album = state.albums.find(a => a.id === albumId);
    const mine = album?.ratings.find(r => r.member_id === member);
    if (!mine) return;
    const review = document.querySelector(`[data-review="${albumId}"]`)?.value || '';
    saveReview.disabled = true;
    try { await clubApi('/api/rating',{member_id:member,album_id:albumId,score:mine.score,review}); await refresh(true); toast('Review enregistrée.'); }
    catch (error) { toast(error.message); } finally { saveReview.disabled = false; }
    return;
  }
  const button = e.target.closest('[data-score]'); if (!button || member === null) return;
  const voter = member, albumId = Number(button.dataset.album), score = Number(button.dataset.score);
  const review = document.querySelector(`[data-review="${albumId}"]`)?.value || '';
  const buttons = button.closest('.scores').querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
  try { await clubApi('/api/rating',{member_id:voter,album_id:albumId,score,review}); await refresh(true); }
  catch (error) { toast(error.message); } finally { buttons.forEach(b => b.disabled = false); }
};
$('#delete-form').onsubmit = async e => {
  e.preventDefault(); if (!deleteTarget || deleteTarget.member_id !== member) return;
  const b = e.target.querySelector('.danger'); b.disabled = true;
  try { await clubApi('/api/album/delete',deleteTarget); $('#delete-dialog').close(); deleteTarget = null; await refresh(true); toast('Album retiré. La place est libre pour une nouvelle découverte.'); }
  catch (error) { $('#delete-form .form-error').textContent = error.message; } finally { b.disabled = false; }
};
$('#album-form').addEventListener('invalid', () => $('#manual-fields').open = true, true);
$('#album-form').onsubmit = async e => {
  e.preventDefault(); const form = e.target, b = form.querySelector('.primary'); b.disabled = true;
  const payload = {member_id:member,week:key(week),...Object.fromEntries(new FormData(form))};
  try { await clubApi('/api/album',payload); form.closest('dialog').close(); await refresh(true); toast('Ton album est sur la platine.'); }
  catch (error) { form.querySelector('.form-error').textContent = error.message; } finally { b.disabled = false; }
};
function clearSearch() { clearTimeout(searchTimer); searchController?.abort(); searchVersion++; searchResults = []; $('#search-results').innerHTML = ''; }
$('#album-form').addEventListener('reset', () => { clearSearch(); $('#selected-album').hidden = true; $('#selected-album').innerHTML = ''; $('#search-status').textContent = ''; });
$('#album-dialog').addEventListener('close',clearSearch);
$('#album-search').oninput = () => {
  clearSearch(); const query = $('#album-search').value.trim(), version = searchVersion;
  if (query.length<2) { $('#search-status').textContent = 'Saisis au moins 2 caractères.'; return; }
  $('#search-status').textContent = 'On fouille dans les bacs…';
  searchTimer = setTimeout(async () => {
    searchController = new AbortController();
    try {
      const data = await clubApi('/api/search?q='+encodeURIComponent(query),undefined,searchController.signal); if (version !== searchVersion) return;
      searchResults = data.results;
      $('#search-status').textContent = searchResults.length ? 'Choisis un disque · Catalogue Deezer' : 'Aucun résultat. Essaie le nom de l’artiste.';
      $('#search-results').innerHTML = searchResults.map((a,i) => `<button type="button" class="search-result" data-result="${i}">${coverImage(a)}<span><strong>${esc(a.title)}</strong><small>${esc(a.artist)}</small></span></button>`).join('');
    } catch (error) { if (error.name !== 'AbortError' && version === searchVersion) $('#search-status').textContent = error.message; }
  },450);
};
$('#search-results').onclick = e => {
  const button = e.target.closest('[data-result]'); if (!button) return;
  const album = searchResults[Number(button.dataset.result)], form = $('#album-form'); if (!album) return;
  for (const name of ['title','artist','link','cover_url','spotify_url','deezer_url']) form.elements[name].value = album[name] || '';
  $('#selected-album').innerHTML = `${coverImage(album)}<span><strong>${esc(album.title)}</strong><small>${esc(album.artist)}</small></span>`;
  $('#selected-album').hidden = false; clearSearch(); $('#search-status').textContent = ''; form.querySelector('.primary').focus();
};
['title','artist'].forEach(name => $('#album-form').elements[name].addEventListener('input', () => { for (const field of ['cover_url','spotify_url','deezer_url','link']) $('#album-form').elements[field].value = ''; $('#selected-album').hidden = true; }));
document.addEventListener('error', e => {
  const img = e.target; if (img.tagName !== 'IMG') return;
  if (img.dataset.fallback && img.src !== img.dataset.fallback) { const fallback = img.dataset.fallback; delete img.dataset.fallback; img.src = fallback; return; }
  img.hidden = true; if (img.parentElement.classList.contains('cover')) img.parentElement.innerHTML = '<div class="cover-placeholder" aria-hidden="true"><span>✳</span></div>';
},true);
refresh(true); setInterval(() => { if (!document.hidden && !document.querySelector('dialog[open]')) refresh(); },10000);
