import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import tempfile

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

HTML = open(os.path.join(os.path.dirname(__file__), "index.html"), encoding="utf-8").read()
SHARE_HTML = open(os.path.join(os.path.dirname(__file__), "share.html"), encoding="utf-8").read()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{self.command}] {self.path} {args[0] if args else ''}")

    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        content = SHARE_HTML if path == "/share" else HTML
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(content.encode("utf-8"))

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        if path == "/api/transcribe":
            self._transcribe(body)
        elif path == "/api/generate":
            self._generate(body)
        else:
            self.send_json(404, {"error": "not found"})

    def _transcribe(self, body: bytes):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_API_KEY)

            content_type = self.headers.get("Content-Type", "")
            boundary = None
            for part in content_type.split(";"):
                part = part.strip()
                if part.startswith("boundary="):
                    boundary = part[len("boundary="):].strip()

            if not boundary:
                self.send_json(400, {"error": "boundary 없음"})
                return

            # Parse multipart manually
            bnd = ("--" + boundary).encode()
            parts = body.split(bnd)
            audio_data = None
            for part in parts:
                if b"name=\"audio\"" in part:
                    # Split headers from body
                    idx = part.find(b"\r\n\r\n")
                    if idx != -1:
                        audio_data = part[idx+4:].rstrip(b"\r\n--")
                        break

            if not audio_data:
                self.send_json(400, {"error": "오디오 데이터 없음"})
                return

            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                f.write(audio_data)
                tmp_path = f.name

            with open(tmp_path, "rb") as f:
                result = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=("recording.webm", f, "audio/webm"),
                    language="ko",
                )

            os.unlink(tmp_path)
            self.send_json(200, {"text": result.text})

        except Exception as e:
            print(f"[transcribe error] {e}")
            self.send_json(500, {"error": str(e)})

    def _generate(self, body: bytes):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_API_KEY)

            data = json.loads(body)
            text = data.get("text", "")
            history = data.get("history", [])

            if not text.strip():
                self.send_json(400, {"error": "텍스트 없음"})
                return

            system_prompt = """당신은 사용자의 삶의 이야기를 아름다운 회고록으로 엮어주는 작가입니다.
사용자가 음성으로 말한 내용을 바탕으로 다음 두 가지를 JSON 형식으로 반환하세요.

1. chapter: 사용자의 말을 1인칭 회고록 챕터 초안으로 작성. 문학적이고 감동적인 문체로 200~400자 분량.
2. questions: 이야기를 더 풍부하게 만들 후속 질문 3개 배열. 구체적이고 감성적인 질문으로.

반드시 아래 JSON 형식만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.
{"chapter": "...", "questions": ["질문1", "질문2", "질문3"]}"""

            messages = [{"role": "system", "content": system_prompt}]
            for msg in history:
                messages.append({"role": msg["role"], "content": msg["content"]})
            messages.append({"role": "user", "content": f"다음 이야기를 회고록 챕터 초안과 후속 질문 3개로 만들어주세요:\n\n{text}"})

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                response_format={"type": "json_object"},
                max_tokens=1024,
            )

            parsed = json.loads(response.choices[0].message.content)
            self.send_json(200, parsed)

        except Exception as e:
            print(f"[generate error] {e}")
            self.send_json(500, {"error": str(e)})


if __name__ == "__main__":
    if not OPENAI_API_KEY:
        # Try loading from .env.local
        env_path = os.path.join(os.path.dirname(__file__), ".env.local")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("OPENAI_API_KEY="):
                        OPENAI_API_KEY = line.split("=", 1)[1]
                        break

    print(f"서버 시작: http://localhost:8000")
    print(f"API 키: {'설정됨' if OPENAI_API_KEY else '없음 - .env.local 확인 필요'}")
    HTTPServer(("", 8000), Handler).serve_forever()
