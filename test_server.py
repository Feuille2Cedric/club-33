import io
import json
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import server


class ClubTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_db = server.DB
        server.DB = Path(self.temp.name) / 'test.sqlite3'
        server.initialize()
        self.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.base = 'http://127.0.0.1:%s' % self.http.server_port

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        server.DB = self.original_db
        self.temp.cleanup()

    def call(self, path, data=None):
        req = Request(self.base + path, data=json.dumps(data).encode() if data is not None else None,
                      headers={'Content-Type': 'application/json'})
        try:
            with urlopen(req) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_cover_persistence_and_history_aggregation(self):
        album = dict(member_id=1, week='2026-09-07', title='In Rainbows', artist='Radiohead',
                     cover_url='https://example.com/cover.jpg')
        self.assertEqual(self.call('/api/album', album)[0], 200)
        self.assertEqual(self.call('/api/album', dict(album, member_id=2))[0], 200)
        self.assertEqual(self.call('/api/album', dict(album, week='2026-08-31'))[0], 200)
        current = self.call('/api/week?week=2026-09-07')[1]
        album_id = current['albums'][0]['id']
        for member, score in [(1, 0), (2, 10), (3, 8)]:
            self.assertEqual(self.call('/api/rating', dict(member_id=member, album_id=album_id, score=score))[0], 200)
        server.initialize()
        current = self.call('/api/week?week=2026-09-07')[1]
        self.assertEqual(current['albums'][0]['cover_url'], album['cover_url'])
        self.assertEqual(current['history'], [
            dict(week='2026-09-07', album_count=2, rating_count=3, average=6.0),
            dict(week='2026-08-31', album_count=1, rating_count=0, average=None)])
        self.assertEqual(len(self.call('/api/week?week=2026-08-31')[1]['albums']), 1)
        self.assertEqual(self.call('/api/album', dict(album, member_id=3, cover_url='javascript:bad'))[0], 400)

    def test_search_errors_and_validation(self):
        self.assertEqual(self.call('/api/search?q=a')[0], 400)
        with patch.object(server, 'search_albums', side_effect=URLError('offline')):
            self.assertEqual(self.call('/api/search?q=radiohead')[0], 502)
        with patch.object(server, 'search_albums', return_value=[]):
            self.assertEqual(self.call('/api/search?q=unknown'), (200, {'results': []}))

    def test_search_mapping_and_cache(self):
        server.SEARCH_CACHE.clear()
        upstream = {'data': [{'title': 'Album', 'artist': {'name': 'Artist'},
                             'cover_big': 'https://example.com/a.jpg',
                             'link': 'https://www.deezer.com/album/1'}]}
        with patch.object(server, 'urlopen', return_value=io.BytesIO(json.dumps(upstream).encode())) as request:
            result = server.search_albums('Album Artist')
            self.assertEqual(result[0]['source'], 'Deezer')
            self.assertEqual(result[0]['cover_url'], 'https://example.com/a.jpg')
            self.assertEqual(server.search_albums('album artist'), result)
            self.assertEqual(request.call_count, 1)

    def test_add_member_can_propose_and_rate(self):
        status, data = self.call('/api/member', {'name': 'New member'})
        self.assertEqual(status, 201)
        member = data['member_id']
        self.assertGreater(member, 3)
        self.assertEqual(self.call('/api/member', {'name': ' new MEMBER '})[0], 400)
        self.assertEqual(self.call('/api/member', {'name': ' '})[0], 400)
        self.assertEqual(self.call('/api/album', dict(member_id=member, week='2026-09-07', title='Album', artist='Artist'))[0], 200)
        album = self.call('/api/week?week=2026-09-07')[1]['albums'][0]
        self.assertEqual(self.call('/api/rating', dict(member_id=member, album_id=album['id'], score=8))[0], 200)

    def test_old_database_migration_preserves_data(self):
        legacy = Path(self.temp.name) / 'legacy.sqlite3'
        with sqlite3.connect(str(legacy)) as db:
            db.executescript('''CREATE TABLE members(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
                INSERT INTO members VALUES(1, 'Old name');
                CREATE TABLE albums(id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id),
                    week TEXT NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL, link TEXT NOT NULL DEFAULT '',
                    UNIQUE(member_id, week));
                INSERT INTO albums VALUES(7, 1, '2026-09-07', 'Existing album', 'Artist', '');
                CREATE TABLE ratings(album_id INTEGER REFERENCES albums(id), member_id INTEGER REFERENCES members(id),
                    score INTEGER, PRIMARY KEY(album_id, member_id));
                INSERT INTO ratings VALUES(7, 1, 9);''')
        with patch.object(server, 'DB', legacy):
            server.initialize()
            with server.connect() as db:
                self.assertEqual(db.execute('SELECT title, cover_url FROM albums').fetchone()[:], ('Existing album', ''))
                self.assertEqual(db.execute('SELECT score FROM ratings').fetchone()[0], 9)


if __name__ == '__main__':
    unittest.main()
