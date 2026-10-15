import base64
import json
import threading
import unittest
from urllib.request import urlopen
from unittest.mock import Mock, patch

import server


class TelegramPostParserTests(unittest.TestCase):
    def test_extracts_post_text_date_and_permalink(self):
        parser = server.TelegramPostParser("Max Freelance UZ")
        parser.feed(
            '<div class="tgme_widget_message_wrap">'
            '<div class="tgme_widget_message js-widget_message" data-post="MaxFreelance_uz/42">'
            '<div class="tgme_widget_message_text">Stories Maker <b>kerak</b><br>Remote loyiha</div>'
            '<time datetime="2026-10-15T12:00:00+00:00"></time>'
            '</div></div>'
        )

        self.assertEqual(len(parser.posts), 1)
        self.assertEqual(parser.posts[0]["title"], "Stories Maker kerak")
        self.assertEqual(parser.posts[0]["url"], "https://t.me/MaxFreelance_uz/42")
        self.assertEqual(parser.posts[0]["publishedAt"], "2026-10-15T12:00:00+00:00")

    def test_ignores_message_without_public_post_id(self):
        parser = server.TelegramPostParser("Test")
        parser.feed(
            '<div class="tgme_widget_message"><div class="tgme_widget_message_text">Private text</div></div>'
        )
        self.assertEqual(parser.posts, [])


class ListingFilterTests(unittest.TestCase):
    def test_categorizes_selected_skill_areas(self):
        examples = {
            "Дизайнер для Figma и логотип": "design",
            "Video montajyor kerak": "video",
            "Instagram story maker uchun SMM": "content",
            "Python backend developer": "development",
            "Virtual assistant, Excel data entry": "admin",
            "Sotuv manager va savdo": "sales",
            "Ish qidirayotgan frilanser haqida maqola": "other",
        }
        for text, expected in examples.items():
            with self.subTest(text=text):
                self.assertEqual(server.categorize(text), expected)

    def test_classifies_freelance_job_and_unrelated_posts(self):
        freelance = {
            "title": "Ищу дизайнера превью",
            "description": "#freelance Нужен дизайнер для разового заказа",
            "kind": "telegram",
            "category": "design",
        }
        employment = {
            "title": "Stories Maker kerak",
            "description": "Ish haqi kelishiladi. Gibrid grafik, rezume yuboring.",
            "kind": "telegram",
            "category": "design",
        }
        unrelated = {
            "title": "Freelance dasturchi haqida maqola",
            "description": "Maqolada frilanserning faoliyati haqida hikoya qilinadi.",
            "kind": "telegram",
            "category": "development",
        }
        requirement_in_article = {
            "title": "Frilans dasturchi xalqaro kompaniyalarga moslashdi",
            "description": "Dasturlash asoslarini puxta bilish zarurligi ta’kidlanadi.",
            "kind": "telegram",
            "category": "development",
        }

        self.assertEqual(server.classify_listing(freelance), "freelance")
        self.assertEqual(server.classify_listing(employment), "employment")
        self.assertEqual(server.classify_listing(unrelated), "unrelated")
        self.assertEqual(server.classify_listing(requirement_in_article), "unrelated")

    def test_hides_expired_closed_and_stale_listings_and_deduplicates(self):
        now = server.datetime(2026, 10, 15, 12, tzinfo=server.timezone.utc)

        def listing(url, title, description, published):
            return {
                "id": url,
                "title": title,
                "description": description,
                "url": url,
                "kind": "telegram",
                "category": "design",
                "publishedAt": published,
            }

        fresh = listing(
            "https://t.me/channel/5",
            "Ищу дизайнера",
            "#freelance Нужен дизайнер для заказа",
            "2026-10-14T12:00:00+00:00",
        )
        duplicated = {
            **fresh,
            "id": "other-channel/9",
            "url": "https://t.me/other-channel/9",
            "publishedAt": "2026-10-13T12:00:00+00:00",
        }
        old = listing(
            "https://t.me/channel/1",
            "Ищу дизайнера",
            "#freelance Нужен дизайнер",
            "2026-09-14T11:00:00+00:00",
        )
        expired = listing(
            "https://t.me/channel/2",
            "Ищу дизайнера",
            "#freelance Нужен дизайнер. До 14.10.2026",
            "2026-10-14T10:00:00+00:00",
        )
        closed = listing(
            "https://t.me/channel/3",
            "Ищу дизайнера",
            "#freelance Нужен дизайнер. Исполнитель найден",
            "2026-10-14T09:00:00+00:00",
        )
        unrelated = listing(
            "https://t.me/channel/4",
            "Freelance haqida yangilik",
            "Maqolada frilanserlar haqida yozilgan.",
            "2026-10-14T08:00:00+00:00",
        )

        results, summary = server.filter_listings(
            [duplicated, fresh, old, expired, closed, unrelated],
            now,
        )

        self.assertEqual([job["url"] for job in results], [fresh["url"], unrelated["url"]])
        self.assertEqual(summary, {
            "freelance": 1,
            "employment": 0,
            "unrelated": 1,
            "expired": 3,
            "duplicates": 1,
        })

    def test_recognizes_russian_and_uzbek_deadlines(self):
        now = server.datetime(2026, 10, 15, 12, tzinfo=server.timezone.utc)
        self.assertEqual(server.parse_deadline("Отклик до 14 октября", now).isoformat(), "2026-10-14")
        self.assertEqual(server.parse_deadline("Ariza 14 oktabrgacha", now).isoformat(), "2026-10-14")


class ArbeitnowTests(unittest.TestCase):
    def test_keeps_only_remote_jobs_with_trusted_source_links(self):
        response = {
            "data": [
                {
                    "slug": "remote-one",
                    "title": "Remote designer",
                    "remote": True,
                    "url": "https://www.arbeitnow.com/jobs/remote-one",
                    "description": "<p>Design <strong>work</strong></p>",
                    "company_name": "Example",
                    "location": "Worldwide",
                    "job_types": ["Freelance"],
                    "tags": ["Design"],
                    "created_at": 1792080000,
                },
                {
                    "slug": "onsite",
                    "title": "Onsite developer",
                    "remote": False,
                    "url": "https://www.arbeitnow.com/jobs/onsite",
                },
                {
                    "slug": "untrusted",
                    "title": "External link",
                    "remote": True,
                    "url": "https://example.com/job",
                },
            ]
        }
        with patch.object(server, "read_url", return_value=json.dumps(response).encode("utf-8")):
            jobs = server.fetch_arbeitnow()

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["title"], "Remote designer")
        self.assertEqual(jobs[0]["description"], "Design work")
        self.assertEqual(jobs[0]["source"], "Arbeitnow · masofaviy ish")
        self.assertEqual(jobs[0]["category"], "design")


class JobicyTests(unittest.TestCase):
    def test_keeps_public_source_links_and_attributes_jobicy(self):
        response = {
            "jobs": [
                {
                    "id": 101,
                    "jobTitle": "Remote Python developer",
                    "url": "https://jobicy.com/jobs/101-remote-python-developer",
                    "jobDescription": "<p>Build <strong>Python</strong> services for the sales organization.</p>",
                    "companyName": "Example",
                    "jobGeo": "Worldwide",
                    "jobIndustry": ["Software Development"],
                    "jobType": ["Full-Time"],
                    "jobLevel": "Midweight",
                    "pubDate": "2026-10-15T10:00:00+00:00",
                },
                {
                    "id": 102,
                    "jobTitle": "Untrusted link",
                    "url": "https://example.com/jobs/102",
                },
            ]
        }
        with patch.object(server, "read_url", return_value=json.dumps(response).encode("utf-8")):
            jobs = server.fetch_jobicy()

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["title"], "Remote Python developer")
        self.assertEqual(jobs[0]["description"], "Build Python services for the sales organization.")
        self.assertEqual(jobs[0]["source"], "Jobicy · masofaviy ish")
        self.assertEqual(jobs[0]["details"], "Software Development, Full-Time, Midweight")
        self.assertEqual(jobs[0]["category"], "development")


class RemoteOKTests(unittest.TestCase):
    def test_keeps_trusted_remoteok_jobs_and_attributes_source(self):
        response = [
            {"legal": "Link back to Remote OK"},
            {
                "id": "123",
                "position": "Remote Python developer",
                "url": "https://remoteok.com/remote-jobs/remote-python-developer-123",
                "description": "<p>Build <strong>Python</strong> services.</p>",
                "company": "Example",
                "location": "Worldwide",
                "tags": ["python", "development"],
                "date": "2026-10-15T10:00:00+00:00",
            },
            {
                "id": "124",
                "position": "Untrusted link",
                "url": "https://example.com/jobs/124",
            },
            {
                "id": "125",
                "position": "Insecure link",
                "url": "http://remoteok.com/jobs/125",
            },
        ]
        with patch.object(server, "read_url", return_value=json.dumps(response).encode("utf-8")):
            jobs = server.fetch_remoteok()

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["title"], "Remote Python developer")
        self.assertEqual(jobs[0]["description"], "Build Python services.")
        self.assertEqual(jobs[0]["source"], "Remote OK · masofaviy ish")
        self.assertEqual(jobs[0]["details"], "python, development")
        self.assertEqual(jobs[0]["category"], "development")


class HttpEndpointTests(unittest.TestCase):
    def setUp(self):
        self.http_server = server.ThreadingHTTPServer(("127.0.0.1", 0), server.VazifyHandler)
        self.thread = threading.Thread(target=self.http_server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.http_server.shutdown()
        self.thread.join()
        self.http_server.server_close()

    def test_config_exposes_only_public_supabase_credentials(self):
        with patch.dict("os.environ", {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_ANON_KEY": "sb_publishable_test-key",
            "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_private-key",
        }):
            with urlopen(f"http://127.0.0.1:{self.http_server.server_port}/api/config") as response:
                config = json.loads(response.read())

        self.assertEqual(config, {
            "supabaseUrl": "https://example.supabase.co",
            "supabaseAnonKey": "sb_publishable_test-key",
            "error": "",
        })
        self.assertNotIn("sb_secret_private-key", json.dumps(config))

    def test_config_refuses_a_secret_key_in_the_public_setting(self):
        with patch.dict("os.environ", {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_ANON_KEY": "sb_secret_do_not_expose",
        }):
            config = server.public_supabase_config()
        self.assertEqual(config["supabaseUrl"], "")
        self.assertEqual(config["supabaseAnonKey"], "")
        self.assertIn("secret kalit chiqarilmadi", config["error"])

    def test_config_accepts_legacy_anon_jwt(self):
        claims = base64.urlsafe_b64encode(json.dumps({"role": "anon"}).encode()).decode().rstrip("=")
        public_anon_jwt = f"header.{claims}.signature"
        with patch.dict("os.environ", {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_ANON_KEY": public_anon_jwt,
        }):
            config = server.public_supabase_config()
        self.assertEqual(config["supabaseAnonKey"], public_anon_jwt)
        self.assertEqual(config["error"], "")

    def test_health_check_does_not_need_external_sources(self):
        with urlopen(f"http://127.0.0.1:{self.http_server.server_port}/health") as response:
            payload = json.loads(response.read())
        self.assertEqual(payload, {"status": "ok"})


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.old_sources = server.SOURCES
        self.old_cache = server._cache
        self.old_last_refresh = server._last_refresh
        server._cache = {}
        server._last_refresh = 0.0

    def tearDown(self):
        server.SOURCES = self.old_sources
        server._cache = self.old_cache
        server._last_refresh = self.old_last_refresh

    def test_reuses_cache_and_exposes_source_status(self):
        fetcher = Mock(return_value=[{
            "id": "sample",
            "title": "Sample",
            "description": "Description",
            "url": "https://t.me/sample/1",
            "source": "Telegram · Sample",
            "publishedAt": "",
            "kind": "telegram",
        }])
        server.SOURCES = (("sample", "Telegram · Sample", fetcher),)

        first = server.load_jobs(force=True)
        second = server.load_jobs()

        self.assertEqual(len(first["jobs"]), 1)
        self.assertEqual(second["sources"][0]["count"], 1)
        self.assertEqual(fetcher.call_count, 1)

    def test_force_refresh_is_rate_limited(self):
        fetcher = Mock(return_value=[])
        server.SOURCES = (("sample", "Sample", fetcher),)
        server._last_refresh = server.time.time()

        response = server.load_jobs(force=True)

        self.assertIn("60 soniyadan", response["refreshNote"])
        self.assertEqual(fetcher.call_count, 0)


if __name__ == "__main__":
    unittest.main()
