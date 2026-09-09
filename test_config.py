import unittest
from scripts.configure_pages import normalize_url


class ConfigTests(unittest.TestCase):
    def test_project_and_rest_urls_resolve_to_same_root(self):
        for value in ['https://example.supabase.co', 'https://example.supabase.co/',
                      ' https://example.supabase.co/rest/v1 ', 'https://example.supabase.co/rest/v1/']:
            self.assertEqual(normalize_url(value), 'https://example.supabase.co')

    def test_unconfigured_is_allowed(self):
        self.assertEqual(normalize_url(''), '')

    def test_invalid_config_is_not_published(self):
        for value in ['http://example.supabase.co', 'https://example.supabase.co/rest/v1/club_albums',
                      'https://example.supabase.co?apikey=secret', 'https://user:password@example.supabase.co']:
            with self.assertRaises(ValueError):
                normalize_url(value)
