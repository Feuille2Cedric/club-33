import json
import os
from pathlib import Path
from urllib.parse import urlparse

def normalize_url(value):
    value = value.strip().rstrip('/')
    if not value:
        return ''
    parsed = urlparse(value)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError('SUPABASE_URL must be an HTTPS project URL.')
    if parsed.path not in ('', '/rest/v1') or parsed.query or parsed.fragment:
        raise ValueError('Use the project URL or its /rest/v1 API URL, without extra paths or parameters.')
    return parsed._replace(path='').geturl()


def main():
    try:
        url = normalize_url(os.environ.get('SUPABASE_URL', ''))
    except ValueError as error:
        raise SystemExit(str(error))
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '').strip()
    if key.startswith('sb_secret_'):
        raise SystemExit('Do not publish a secret key. Use a publishable key.')
    if key.startswith('eyJ'):
        import base64
        try:
            part = key.split('.')[1]
            claims = json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))
            if claims.get('role') != 'anon':
                raise ValueError('Not an anon key')
        except (ValueError, IndexError):
            raise SystemExit('Only a legacy anon JWT can be published.')
    elif key and not key.startswith('sb_publishable_'):
        raise SystemExit('Expected a Supabase publishable key.')
    config = {'supabaseUrl': url, 'supabaseKey': key}
    path = Path(__file__).resolve().parents[1] / 'static' / 'config.js'
    path.write_text('window.CLUB33_CONFIG = ' + json.dumps(config) + ';\n', encoding='utf-8')
    print('Public configuration generated.' if url and key else 'Supabase not connected yet; the site will display a setup message.')


if __name__ == '__main__':
    main()
