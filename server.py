import json
import os
import sqlite3
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import urlopen, Request
from urllib.error import URLError
from time import monotonic
from threading import Lock
import base64

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('DATABASE_PATH', str(ROOT / 'club33.sqlite3')))
ALLOWED_ORIGIN = os.environ.get('ALLOWED_ORIGIN', '')
SEARCH_CACHE = {}
SEARCH_LOCK = Lock()


def search_albums(query):
    with SEARCH_LOCK:
        cached = SEARCH_CACHE.get(query.casefold())
        if cached and monotonic() - cached[0] < 600:
            return cached[1]
    url = 'https://api.deezer.com/search/album?' + urlencode({'q': query, 'limit': 12})
    with urlopen(Request(url, headers={'User-Agent': 'Club33/1.0'}), timeout=12) as response:
        data = json.load(response)
    if 'error' in data:
        raise ValueError('Deezer indisponible')
    results = [{'title': row['title'], 'artist': row['artist']['name'],
                'cover_url': row.get('cover_big') or row.get('cover_medium', ''),
                'link': row.get('link', ''), 'deezer_url': row.get('link', ''),
                'spotify_url': '', 'source': 'Deezer'}
               for row in data.get('data', []) if row.get('title') and row.get('artist', {}).get('name')]
    if os.environ.get('SPOTIFY_CLIENT_ID') and os.environ.get('SPOTIFY_CLIENT_SECRET'):
        try:
            results.extend(search_spotify(query))
        except (URLError, OSError, ValueError, KeyError):
            pass  # Deezer remains usable when Spotify is temporarily unavailable.
    with SEARCH_LOCK:
        if len(SEARCH_CACHE) >= 200:
            SEARCH_CACHE.clear()
        SEARCH_CACHE[query.casefold()] = (monotonic(), results)
    return results


def search_spotify(query):
    credentials = (os.environ['SPOTIFY_CLIENT_ID'] + ':' + os.environ['SPOTIFY_CLIENT_SECRET']).encode()
    request = Request('https://accounts.spotify.com/api/token', data=b'grant_type=client_credentials',
                      headers={'Authorization': 'Basic ' + base64.b64encode(credentials).decode(),
                               'Content-Type': 'application/x-www-form-urlencoded'})
    with urlopen(request, timeout=12) as response:
        token = json.load(response)['access_token']
    request = Request('https://api.spotify.com/v1/search?' + urlencode({'q': query, 'type': 'album', 'limit': 10}),
                      headers={'Authorization': 'Bearer ' + token})
    with urlopen(request, timeout=12) as response:
        albums = json.load(response)['albums']['items']
    return [{'title': a['name'], 'artist': ', '.join(x['name'] for x in a['artists']),
             'cover_url': a['images'][0]['url'] if a['images'] else '',
             'link': a['external_urls']['spotify'], 'spotify_url': a['external_urls']['spotify'],
             'deezer_url': '', 'source': 'Spotify'} for a in albums]


def connect():
    db = sqlite3.connect(str(DB), timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db


def initialize():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS albums(
                id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id),
                week TEXT NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL,
                link TEXT NOT NULL DEFAULT '', UNIQUE(member_id, week));
            CREATE TABLE IF NOT EXISTS ratings(
                album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
                member_id INTEGER NOT NULL REFERENCES members(id),
                score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 10),
                PRIMARY KEY(album_id, member_id));
        ''')
        db.executemany('INSERT INTO members VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',
                       [(1, 'Cédric'), (2, 'Côme'), (3, 'Issa')])
        if 'cover_url' not in [row['name'] for row in db.execute('PRAGMA table_info(albums)')]:
            db.execute("ALTER TABLE albums ADD COLUMN cover_url TEXT NOT NULL DEFAULT ''")
        for column in ('spotify_url', 'deezer_url'):
            if column not in [row['name'] for row in db.execute('PRAGMA table_info(albums)')]:
                db.execute("ALTER TABLE albums ADD COLUMN " + column + " TEXT NOT NULL DEFAULT ''")


def valid_week(value):
    parsed = date.fromisoformat(value)
    if parsed.weekday() != 0 or parsed.isoformat() != value:
        raise ValueError('La semaine doit commencer un lundi.')
    return value


def field(data, key, limit):
    value = data.get(key, '')
    if not isinstance(value, str) or len(value.strip()) > limit:
        raise ValueError('Champ invalide : ' + key)
    return value.strip()


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if ALLOWED_ORIGIN and self.headers.get('Origin') == ALLOWED_ORIGIN:
            self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
            self.send_header('Vary', 'Origin')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'static'), **kwargs)

    def reply(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/health':
            return self.reply({'ok': True})
        if parsed.path == '/api/search':
            query = parse_qs(parsed.query).get('q', [''])[0].strip()
            if not 2 <= len(query) <= 160:
                return self.reply({'error': 'Saisis entre 2 et 160 caractères.'}, 400)
            try:
                return self.reply({'results': search_albums(query)})
            except (URLError, OSError, ValueError, KeyError):
                return self.reply({'error': 'Le catalogue est indisponible. Réessaie ou saisis ton album manuellement.'}, 502)
        if parsed.path != '/api/week':
            if parsed.path.startswith('/api/'):
                return self.reply({'error': 'Route inconnue.'}, 404)
            return super().do_GET()
        try:
            week = valid_week(parse_qs(parsed.query).get('week', [''])[0])
            with connect() as db:
                members = [dict(row) for row in db.execute('SELECT * FROM members ORDER BY id')]
                albums = [dict(row) for row in db.execute('SELECT * FROM albums WHERE week=? ORDER BY member_id', (week,))]
                for album in albums:
                    album['ratings'] = [dict(row) for row in db.execute(
                        'SELECT member_id, score FROM ratings WHERE album_id=?', (album['id'],))]
                history = [dict(row) for row in db.execute('''
                    SELECT a.week, COUNT(DISTINCT a.id) AS album_count,
                           COUNT(r.score) AS rating_count, ROUND(AVG(r.score), 1) AS average
                    FROM albums a LEFT JOIN ratings r ON r.album_id=a.id
                    GROUP BY a.week ORDER BY a.week DESC
                ''')]
            self.reply({'members': members, 'albums': albums, 'history': history})
        except (ValueError, TypeError):
            self.reply({'error': 'Semaine invalide.'}, 400)

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8192:
                raise ValueError('Requête trop grande ou vide.')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Requête invalide.')
            member = data.get('member_id')
            with connect() as db:
                if self.path == '/api/member':
                    name = field(data, 'name', 40)
                    if not name:
                        raise ValueError('Le prénom est obligatoire.')
                    db.execute('BEGIN IMMEDIATE')
                    if any(row['name'].casefold() == name.casefold() for row in db.execute('SELECT name FROM members')):
                        raise ValueError('Ce prénom existe déjà.')
                    cursor = db.execute('INSERT INTO members(name) VALUES (?)', (name,))
                    db.commit()
                    return self.reply({'ok': True, 'member_id': cursor.lastrowid}, 201)
                if type(member) is not int or not db.execute('SELECT id FROM members WHERE id=?', (member,)).fetchone():
                    raise ValueError('Profil invalide.')
                if self.path == '/api/album':
                    week = valid_week(field(data, 'week', 10))
                    title, artist = field(data, 'title', 120), field(data, 'artist', 120)
                    link = field(data, 'link', 2000)
                    cover_url = field(data, 'cover_url', 2000)
                    spotify_url, deezer_url = field(data, 'spotify_url', 2000), field(data, 'deezer_url', 2000)
                    for value, host in ((spotify_url, 'open.spotify.com'), (deezer_url, 'www.deezer.com')):
                        if value and (urlparse(value).scheme != 'https' or urlparse(value).hostname != host):
                            raise ValueError('Lien de plateforme invalide.')
                    if cover_url and (urlparse(cover_url).scheme != 'https' or not urlparse(cover_url).netloc):
                        raise ValueError('La pochette doit utiliser une adresse HTTPS.')
                    if not title or not artist:
                        raise ValueError('Indique un album et un artiste.')
                    if link and (urlparse(link).scheme not in ('http', 'https') or not urlparse(link).netloc):
                        raise ValueError('Le lien doit commencer par https:// ou http://.')
                    db.execute('INSERT INTO albums(member_id, week, title, artist, link, cover_url, spotify_url, deezer_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                               (member, week, title, artist, link, cover_url, spotify_url, deezer_url))
                elif self.path == '/api/rating':
                    score, album_id = data.get('score'), data.get('album_id')
                    if type(score) is not int or not 0 <= score <= 10 or type(album_id) is not int:
                        raise ValueError('La note doit être un entier entre 0 et 10.')
                    if not db.execute('SELECT id FROM albums WHERE id=?', (album_id,)).fetchone():
                        raise ValueError('Album introuvable.')
                    db.execute('INSERT INTO ratings VALUES (?, ?, ?) ON CONFLICT(album_id, member_id) DO UPDATE SET score=excluded.score',
                               (album_id, member, score))
                else:
                    return self.reply({'error': 'Route inconnue.'}, 404)
            self.reply({'ok': True})
        except sqlite3.IntegrityError:
            self.reply({'error': 'Ce profil a déjà proposé un album cette semaine.'}, 409)
        except (ValueError, TypeError, KeyError) as error:
            self.reply({'error': str(error)}, 400)


if __name__ == '__main__':
    initialize()
    port = int(os.environ.get('PORT', '3333'))
    print('Club 33 : http://localhost:%s — Ctrl+C pour arrêter' % port, flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
