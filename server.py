from __future__ import annotations

import base64
import binascii
import json
import os
import re
import threading
import time
import unicodedata
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable, TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
CACHE_TTL_SECONDS = 600
MIN_REFRESH_INTERVAL_SECONDS = 60
MAX_RESPONSE_BYTES = 4_000_000
USER_AGENT = "VazifyJobSearchDemo/1.0 (public listing reader)"
CHANNELS = (
    ("freelancery_uz", "Freelancery UZ"),
    ("freelanceteam_uz", "Freelance Team UZ"),
    ("MaxFreelance_uz", "Max Freelance UZ"),
)
CATEGORY_KEYWORDS = {
    "video": ("video editing", "video editor", "videographer", "videograf", "videography", "videomontaj", "video montaj", "мобилограф", "мобилограф", "видеограф", "видеомонтаж", "reels", "motion graphics", "монтажер", "монтажёр"),
    "development": ("developer", "development", "programmer", "engineer", "software", "frontend", "backend", "javascript", "python", "wordpress", "разработчик", "программист", "dasturchi", "dasturlash"),
    "sales": ("sales", "sales manager", "account manager", "business development", "продаж", "менеджер по продажам", "sotuv", "sotuvchi", "savdo", "mijozlar bilan ishlash", "продавец"),
    "design": ("design", "designer", "figma", "logo", "illustrator", "photoshop", "ui ux", "графический дизайнер", "дизайн", "дизайнер", "dizayn", "dizayner"),
    "content": ("translation", "translator", "writing", "copywriter", "editor", "content", "stories maker", "story maker", "social media", "instagram", "smm", "marketing", "таржима", "таржимон", "матн", "копирайтер", "контент", "соцсети", "смм"),
    "admin": ("assistant", "data entry", "virtual assistant", "research", "operations", "excel", "administrator", "администратор", "помощник", "удаленный помощник", "remote assistant", "support", "customer service"),
}
SKILL_LABELS = {
    "design": "Dizayn",
    "video": "Video",
    "content": "Matn / SMM",
    "development": "Dasturlash",
    "admin": "Yordamchi ishlar",
    "sales": "Sotuv",
    "other": "Boshqa",
}
LISTING_TYPES = {
    "freelance": "Freelance zakaz",
    "employment": "Ish / vakansiya",
    "unrelated": "Ishga aloqasiz",
}
LISTING_MAX_AGE_DAYS = 30
UNRELATED_TERMS = (
    "looking for a job",
    "ищу работу",
    "ищу проект",
    "ищу заказы",
    "open to work",
)
EMPLOYMENT_TERMS = (
    "ваканс",
    "зарплат",
    "оклад",
    "полный день",
    "неполный день",
    "частичная занятость",
    "полная занятость",
    "график работы",
    "в штат",
    "сотрудник",
    "трудоустрой",
    "salary",
    "full-time",
    "full time",
    "part-time",
    "part time",
    "permanent position",
    "гибрид",
    "gibrid",
    "офис",
    "ish haqi",
    "oylik",
    "график работы",
    "иш ҳақи",
    "ойлик",
    "штат",
    "резюме",
    "rezyume",
    "rezume",
    "employment",
    "employee",
)
FREELANCE_TERMS = (
    "заказ",
    "zakaz",
    "подрядчик",
    "исполнитель",
    "per project",
    "за проект",
    "на проект",
    "разовая задача",
    "сдельная оплата",
    "стоимость услуг",
    "предложите цену",
    "назвать цену",
    "бюджет проекта",
)
HIRING_TERMS = (
    "нужен ",
    "нужна ",
    "нужны ",
    "ищем ",
    "ищу ",
    "требуется ",
    "требуются ",
    "ищем исполнителя",
    "хотим нанять",
    "hire ",
    "hiring ",
    "looking for ",
    "need a ",
    "need an ",
    "need someone",
    "kerak",
    "talab qilinadi",
    "ищем человека",
)
CLOSED_TERMS = (
    "вакансия закрыта",
    "заказ закрыт",
    "заказ выполнен",
    "исполнитель найден",
    "уже нашли",
    "набрали команду",
    "позиция закрыта",
    "position closed",
    "job closed",
    "hired already",
)
MONTH_NUMBERS = {
    "январ": 1, "yanvar": 1,
    "феврал": 2, "fevral": 2,
    "март": 3, "mart": 3,
    "апрел": 4, "aprel": 4,
    "май": 5, "may": 5,
    "июн": 6, "iyun": 6,
    "июл": 7, "iyul": 7,
    "август": 8, "avgust": 8,
    "сентябр": 9, "sentabr": 9,
    "октябр": 10, "oktabr": 10,
    "ноябр": 11, "noyabr": 11,
    "декабр": 12, "dekabr": 12,
}
NUMERIC_DEADLINE = re.compile(
    r"(?:deadline|дедлайн|до|qadar|gacha|muddat(?:i)?)\s*"
    r"(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?",
    re.IGNORECASE,
)
WORD_DEADLINE = re.compile(
    r"(?:до|дедлайн|qadar|gacha)\s*(\d{1,2})\s+([а-яёa-z]+)",
    re.IGNORECASE,
)
SUFFIX_DEADLINE = re.compile(
    r"(\d{1,2})\s+([а-яёa-z]+?)(?:гача|gacha)",
    re.IGNORECASE,
)


class TelegramPost(TypedDict):
    depth: int
    post: str
    text: list[str]
    date: str


class CachedSource(TypedDict):
    name: str
    jobs: list[dict[str, str]]
    checkedAt: float
    error: str
    stale: bool


class TelegramPostParser(HTMLParser):
    def __init__(self, channel: str) -> None:
        super().__init__(convert_charrefs=True)
        self.channel = channel
        self.div_depth = 0
        self.text_depth: int | None = None
        self.current: TelegramPost | None = None
        self.posts: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "div":
            self.div_depth += 1
            classes = set((attributes.get("class") or "").split())
            if self.current is None and "tgme_widget_message" in classes and attributes.get("data-post"):
                self.current = TelegramPost(
                    depth=self.div_depth,
                    post=attributes["data-post"] or "",
                    text=[],
                    date="",
                )
            elif self.current is not None and "tgme_widget_message_text" in classes:
                self.text_depth = self.div_depth
        elif self.current is not None and tag == "time":
            self.current["date"] = attributes.get("datetime") or ""
        elif self.current is not None and tag == "br" and self.text_depth is not None:
            self.current["text"].append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag != "div":
            return
        if self.current is not None:
            if self.text_depth == self.div_depth:
                self.text_depth = None
            if self.current["depth"] == self.div_depth:
                self._finish_post()
        self.div_depth = max(0, self.div_depth - 1)

    def handle_data(self, data: str) -> None:
        if self.current is not None and self.text_depth is not None:
            self.current["text"].append(data)

    def _finish_post(self) -> None:
        if self.current is None:
            return
        raw_text = "".join(self.current["text"]).replace("\xa0", " ")
        text = " ".join(raw_text.split())
        post = self.current["post"]
        if text and "/" in post:
            lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
            title = next((line for line in lines if len(line) > 12 and not line.startswith("#")), text)
            self.posts.append({
                "id": f"telegram:{post}",
                "title": title[:140] or "Telegram e’loni",
                "description": text[:1600],
                "url": f"https://t.me/{post}",
                "source": "Telegram · " + self.channel,
                "publishedAt": self.current["date"],
                "kind": "telegram",
                "category": categorize(text),
            })
        self.current = None
        self.text_depth = None


class PlainTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def categorize(text: str) -> str:
    normalized = normalize_text(text)
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return category
    return "other"


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text).casefold()
    normalized = re.sub(r"https?://\S+", " ", normalized)
    return " ".join(re.findall(r"[^\W_]+", normalized, flags=re.UNICODE))


def classify_listing(job: dict[str, str]) -> str:
    text = normalize_text(" ".join((
        job.get("title", ""),
        job.get("description", ""),
        job.get("details", ""),
    )))
    raw_text = " ".join((job.get("title", ""), job.get("description", ""), job.get("details", "")))
    if any(term in text for term in UNRELATED_TERMS):
        return "unrelated"

    has_hiring_intent = any(term in text for term in HIRING_TERMS)
    has_freelance_signal = (
        any(term in text for term in FREELANCE_TERMS)
        or re.search(r"#\s*(?:freelance|фриланс)\b", raw_text, re.IGNORECASE) is not None
    )
    has_employment_terms = any(term in text for term in EMPLOYMENT_TERMS)

    if has_employment_terms:
        return "employment"
    if has_hiring_intent and has_freelance_signal:
        return "freelance"
    if job.get("kind") == "job":
        return "freelance" if has_freelance_signal else "employment"
    if has_hiring_intent and job.get("category") != "other":
        return "employment"
    return "unrelated"


UZBEKISTAN_MARKERS = (
    "uzbekistan",
    "o'zbekiston",
    "o‘zbekiston",
    "tashkent",
    "toshkent",
    "samarkand",
    "samarqand",
    "bukhara",
    "buxoro",
    "andijan",
    "andijon",
    "namangan",
    "fergana",
    "farg'ona",
    "farg‘ona",
    "nukus",
    "qarshi",
    "karshi",
    "termez",
    "termiz",
    "urgench",
    "urganch",
    "jizzakh",
    "jizzax",
    "navoi",
    "navoiy",
    "khiva",
    "xiva",
    "узбекистан",
    "ташкент",
    "самарканд",
    "бухара",
    "андижан",
    "наманган",
    "фергана",
    "нукус",
    "карши",
    "термез",
    "ургенч",
    "джизак",
    "навои",
    "хива",
)


def listing_market(job: dict[str, str]) -> str:
    text = normalize_text(" ".join((
        job.get("title", ""),
        job.get("description", ""),
        job.get("location", ""),
        job.get("details", ""),
    )))
    return "uzbekistan" if any(normalize_text(marker) in text for marker in UZBEKISTAN_MARKERS) else "global"


def parse_posted_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def parse_deadline(text: str, today: datetime) -> date | None:
    normalized = unicodedata.normalize("NFKC", text).casefold()
    for match in NUMERIC_DEADLINE.finditer(normalized):
        day, month = int(match.group(1)), int(match.group(2))
        year_text = match.group(3)
        year = int(year_text) if year_text else today.year
        if year < 100:
            year += 2000
        try:
            return datetime(year, month, day, tzinfo=timezone.utc).date()
        except ValueError:
            continue
    for match in WORD_DEADLINE.finditer(normalized):
        day, month_word = int(match.group(1)), match.group(2)
        month = MONTH_NUMBERS.get(month_word)
        if not month:
            month = next(
                (
                    MONTH_NUMBERS[candidate]
                    for candidate in (month_word[:-1], month_word[:-2])
                    if candidate in MONTH_NUMBERS
                ),
                None,
            )
        if not month:
            continue
        year = today.year
        if month < today.month - 6:
            year += 1
        try:
            return datetime(year, month, day, tzinfo=timezone.utc).date()
        except ValueError:
            continue
    for match in SUFFIX_DEADLINE.finditer(normalized):
        day, month_word = int(match.group(1)), match.group(2)
        month = MONTH_NUMBERS.get(month_word)
        if not month:
            continue
        year = today.year
        if month < today.month - 6:
            year += 1
        try:
            return datetime(year, month, day, tzinfo=timezone.utc).date()
        except ValueError:
            continue
    return None


def is_expired(job: dict[str, str], now: datetime) -> bool:
    raw_text = " ".join((
        job.get("title", ""),
        job.get("description", ""),
        job.get("details", ""),
    ))
    text = normalize_text(raw_text)
    if any(term in text for term in CLOSED_TERMS):
        return True
    deadline = parse_deadline(raw_text, now)
    if deadline and deadline < now.date():
        return True
    published = parse_posted_date(job.get("publishedAt", ""))
    if published and (now - published).days > LISTING_MAX_AGE_DAYS:
        return True
    return bool(published and published - now > timedelta(days=1))


def filter_listings(
    jobs: list[dict[str, str]],
    now: datetime | None = None,
) -> tuple[list[dict[str, str]], dict[str, int]]:
    reference_time = now or datetime.now(timezone.utc)
    if reference_time.tzinfo is None:
        reference_time = reference_time.replace(tzinfo=timezone.utc)
    reference_time = reference_time.astimezone(timezone.utc)
    counters = {"freelance": 0, "employment": 0, "unrelated": 0, "expired": 0, "duplicates": 0}

    def freshness(job: dict[str, str]) -> datetime:
        return parse_posted_date(job.get("publishedAt", "")) or datetime.min.replace(tzinfo=timezone.utc)

    unique: list[dict[str, str]] = []
    seen_keys: set[str] = set()
    for job in sorted(jobs, key=freshness, reverse=True):
        if is_expired(job, reference_time):
            counters["expired"] += 1
            continue
        normalized_url = job.get("url", "").split("?", 1)[0].rstrip("/").casefold()
        fingerprint = normalize_text(job.get("title", "") + " " + job.get("description", ""))
        duplicate_keys = {key for key in (normalized_url, fingerprint) if key}
        if not duplicate_keys:
            counters["duplicates"] += 1
            continue
        if duplicate_keys & seen_keys:
            counters["duplicates"] += 1
            continue
        seen_keys.update(duplicate_keys)
        listing_type = classify_listing(job)
        skill_category = job.get("category", "other")
        unique.append({
            **job,
            "category": skill_category,
            "market": listing_market(job),
            "skillLabel": SKILL_LABELS.get(skill_category, SKILL_LABELS["other"]),
            "listingType": listing_type,
            "listingLabel": LISTING_TYPES[listing_type],
        })
        counters[listing_type] += 1
    return unique, counters


def read_url(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/json"})
    with urlopen(request, timeout=12) as response:
        content = response.read(MAX_RESPONSE_BYTES + 1)
    if len(content) > MAX_RESPONSE_BYTES:
        raise ValueError("Manba javobi ruxsat etilgan hajmdan katta.")
    return content


def fetch_telegram(channel: str, label: str) -> list[dict[str, str]]:
    content = read_url(f"https://t.me/s/{channel}")
    parser = TelegramPostParser(label)
    parser.feed(content.decode("utf-8", errors="replace"))
    return parser.posts[-15:]


def fetch_arbeitnow() -> list[dict[str, str]]:
    content = read_url("https://www.arbeitnow.com/api/job-board-api")
    payload = json.loads(content.decode("utf-8"))
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise ValueError("Arbeitnow API kutilgan e’lonlar ro‘yxatini qaytarmadi.")

    jobs: list[dict[str, str]] = []
    for row in rows:
        if not isinstance(row, dict) or row.get("remote") is not True:
            continue
        url = row.get("url")
        parsed_url = urlsplit(url) if isinstance(url, str) else None
        if (
            parsed_url is None
            or parsed_url.scheme != "https"
            or parsed_url.hostname not in {"arbeitnow.com", "www.arbeitnow.com"}
        ):
            continue
        text_parser = PlainTextParser()
        text_parser.feed(str(row.get("description") or ""))
        description = " ".join(" ".join(text_parser.parts).split())
        job_types = row.get("job_types")
        tags = row.get("tags")
        details = [str(value) for value in (job_types if isinstance(job_types, list) else [])]
        details.extend(str(value) for value in (tags if isinstance(tags, list) else []))
        created_at = row.get("created_at")
        published = ""
        if isinstance(created_at, (int, float)):
            published = datetime.fromtimestamp(created_at, timezone.utc).isoformat()
        jobs.append({
            "id": f"arbeitnow:{row.get('slug') or url}",
            "title": str(row.get("title") or "Remote ish"),
            "description": description[:1600],
            "url": url,
            "source": "Arbeitnow · masofaviy ish",
            "publishedAt": published,
            "kind": "job",
            "company": str(row.get("company_name") or ""),
            "location": str(row.get("location") or ""),
            "details": ", ".join(details[:5]),
            "category": categorize(" ".join([str(row.get("title") or ""), description, *details])),
        })
    return jobs[:40]


def fetch_jobicy() -> list[dict[str, str]]:
    content = read_url("https://jobicy.com/api/v2/remote-jobs?count=40")
    payload = json.loads(content.decode("utf-8"))
    rows = payload.get("jobs")
    if not isinstance(rows, list):
        raise ValueError("Jobicy API kutilgan e’lonlar ro‘yxatini qaytarmadi.")

    jobs: list[dict[str, str]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        url = row.get("url")
        parsed_url = urlsplit(url) if isinstance(url, str) else None
        if (
            parsed_url is None
            or parsed_url.scheme != "https"
            or parsed_url.hostname not in {"jobicy.com", "www.jobicy.com"}
        ):
            continue
        text_parser = PlainTextParser()
        text_parser.feed(str(row.get("jobDescription") or row.get("jobExcerpt") or ""))
        description = " ".join(" ".join(text_parser.parts).split())
        industries = row.get("jobIndustry")
        job_types = row.get("jobType")
        details = [str(value) for value in (industries if isinstance(industries, list) else [])]
        details.extend(str(value) for value in (job_types if isinstance(job_types, list) else []))
        if row.get("jobLevel"):
            details.append(str(row["jobLevel"]))
        published = str(row.get("pubDate") or "")
        jobs.append({
            "id": f"jobicy:{row.get('id') or url}",
            "title": str(row.get("jobTitle") or "Masofaviy ish"),
            "description": description[:1600],
            "url": url,
            "source": "Jobicy · masofaviy ish",
            "publishedAt": published,
            "kind": "job",
            "company": str(row.get("companyName") or ""),
            "location": str(row.get("jobGeo") or ""),
            "details": ", ".join(details[:5]),
            "category": categorize(" ".join([str(row.get("jobTitle") or ""), *details])),
        })
    return jobs[:40]


def fetch_remoteok() -> list[dict[str, str]]:
    content = read_url("https://remoteok.com/api")
    payload = json.loads(content.decode("utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Remote OK API kutilgan e’lonlar ro‘yxatini qaytarmadi.")

    jobs: list[dict[str, str]] = []
    for row in payload:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        url = row.get("url")
        parsed_url = urlsplit(url) if isinstance(url, str) else None
        if (
            parsed_url is None
            or parsed_url.scheme != "https"
            or parsed_url.hostname not in {"remoteok.com", "www.remoteok.com"}
        ):
            continue
        title = str(row.get("position") or row.get("title") or "Masofaviy ish")
        text_parser = PlainTextParser()
        text_parser.feed(str(row.get("description") or ""))
        description = " ".join(" ".join(text_parser.parts).split())
        tags = row.get("tags")
        details = [str(value) for value in tags if isinstance(value, str)] if isinstance(tags, list) else []
        jobs.append({
            "id": f"remoteok:{row['id']}",
            "title": title,
            "description": description[:1600],
            "url": url,
            "source": "Remote OK · masofaviy ish",
            "publishedAt": str(row.get("date") or ""),
            "kind": "job",
            "company": str(row.get("company") or ""),
            "location": str(row.get("location") or ""),
            "details": ", ".join(details[:5]),
            "category": categorize(" ".join([title, description, *details])),
        })
    return jobs[:40]


SOURCES: tuple[tuple[str, str, Callable[[], list[dict[str, str]]]], ...] = tuple(
    (f"telegram:{channel}", f"Telegram · {label}", lambda channel=channel, label=label: fetch_telegram(channel, label))
    for channel, label in CHANNELS
) + (
    ("arbeitnow", "Arbeitnow · masofaviy ish", fetch_arbeitnow),
    ("jobicy", "Jobicy · masofaviy ish", fetch_jobicy),
    ("remoteok", "Remote OK · masofaviy ish", fetch_remoteok),
)

_cache_lock = threading.Lock()
_cache: dict[str, CachedSource] = {}
_last_refresh = 0.0


def load_jobs(force: bool = False) -> dict[str, object]:
    global _last_refresh
    now = time.time()
    with _cache_lock:
        may_refresh = not force or now - _last_refresh >= MIN_REFRESH_INTERVAL_SECONDS
        if force and not may_refresh:
            refresh_note = "Juda tez yangilash so‘rovi. Kamida 60 soniyadan keyin qayta urinib ko‘ring."
        else:
            refresh_note = ""
        if may_refresh:
            did_refresh = False
            for source_id, label, fetcher in SOURCES:
                previous = _cache.get(source_id)
                checked_at = previous["checkedAt"] if previous else 0.0
                if not force and now - checked_at < CACHE_TTL_SECONDS:
                    continue
                did_refresh = True
                try:
                    jobs = fetcher()
                except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
                    _cache[source_id] = {
                        "name": label,
                        "jobs": previous["jobs"] if previous else [],
                        "checkedAt": now,
                        "error": f"Manbani o‘qib bo‘lmadi: {error}",
                        "stale": bool(previous and previous["jobs"]),
                    }
                else:
                    _cache[source_id] = {
                        "name": label,
                        "jobs": jobs,
                        "checkedAt": now,
                        "error": "",
                        "stale": False,
                    }
            if did_refresh:
                _last_refresh = now

        jobs: list[dict[str, str]] = []
        statuses: list[dict[str, object]] = []
        for source_id, label, _fetcher in SOURCES:
            source = _cache.get(source_id)
            source_jobs = source["jobs"] if source else []
            jobs.extend(source_jobs)
            checked_at = source["checkedAt"] if source else 0.0
            statuses.append({
                "name": source["name"] if source else label,
                "count": len(source_jobs),
                "error": source["error"] if source else "",
                "stale": source["stale"] if source else False,
                "checkedAt": datetime.fromtimestamp(checked_at, timezone.utc).isoformat() if checked_at else "",
            })
        filtered_jobs, summary = filter_listings(jobs)
        return {
            "jobs": filtered_jobs,
            "summary": summary,
            "sources": statuses,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "refreshNote": refresh_note,
        }


def public_supabase_config() -> dict[str, str]:
    project_url = os.environ.get("SUPABASE_URL", "").strip()
    public_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if not project_url and not public_key:
        return {"supabaseUrl": "", "supabaseAnonKey": "", "error": ""}
    if not project_url or not public_key:
        return {
            "supabaseUrl": "",
            "supabaseAnonKey": "",
            "error": "Supabase URL va public anon key ikkalasi ham sozlanishi kerak.",
        }

    try:
        parsed_url = urlsplit(project_url)
    except ValueError:
        parsed_url = None
    if (
        parsed_url is None
        or parsed_url.scheme != "https"
        or not parsed_url.hostname
        or parsed_url.username
        or parsed_url.password
    ):
        return {
            "supabaseUrl": "",
            "supabaseAnonKey": "",
            "error": "Supabase project URL xavfsiz HTTPS manzili bo‘lishi kerak.",
        }

    if public_key.startswith("sb_publishable_"):
        return {"supabaseUrl": project_url, "supabaseAnonKey": public_key, "error": ""}
    parts = public_key.split(".")
    if len(parts) == 3:
        try:
            payload = parts[1] + "=" * (-len(parts[1]) % 4)
            claims = json.loads(base64.urlsafe_b64decode(payload).decode("utf-8"))
        except (binascii.Error, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            claims = {}
        if isinstance(claims, dict) and claims.get("role") == "anon":
            return {"supabaseUrl": project_url, "supabaseAnonKey": public_key, "error": ""}

    return {
        "supabaseUrl": "",
        "supabaseAnonKey": "",
        "error": "SUPABASE_ANON_KEY faqat publishable/anon kalit bo‘lishi kerak; secret kalit chiqarilmadi.",
    }


class VazifyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Strict-Transport-Security", "max-age=31536000")
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path == "/health":
            self.send_json({"status": "ok"})
            return
        if parsed.path == "/api/config":
            self.send_json(public_supabase_config())
            return
        if parsed.path != "/api/jobs":
            asset_root = (ROOT / "assets").resolve()
            if parsed.path in {"/", "/index.html", "/app.js", "/styles.css"}:
                super().do_GET()
                return
            if parsed.path.startswith("/assets/"):
                requested = (ROOT / unquote(parsed.path.lstrip("/"))).resolve()
                if requested.is_file() and requested.is_relative_to(asset_root):
                    super().do_GET()
                    return
            self.send_error(404)
            return
        params = parse_qs(parsed.query)
        result = load_jobs(force=params.get("refresh") == ["1"])
        self.send_json(result)

    def send_json(self, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), VazifyHandler)
    print(f"Vazify server: http://{HOST}:{PORT}")
    print("To‘xtatish uchun Ctrl+C bosing.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
