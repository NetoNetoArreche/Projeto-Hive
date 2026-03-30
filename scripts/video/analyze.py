#!/usr/bin/env python3
"""
YouTube Video Analyzer
Downloads a YouTube video, transcribes it with Whisper, and finds the best moments.

Usage:
    python analyze.py --url "https://youtube.com/watch?v=xxx" --output ./work
    python analyze.py --url "URL" --output ./work --whisper-model base --max-moments 10 --language pt
"""

import argparse
import json
import os
import re
import sys
import subprocess
from pathlib import Path

# ── Strong words for scoring ──
STRONG_WORDS_PT = [
    "nunca", "sempre", "ninguem", "todo mundo", "erro", "importante",
    "verdade", "segredo", "incrivel", "absurdo", "problema", "solucao",
    "dica", "truque", "atencao", "cuidado", "melhor", "pior", "gratis",
    "chocante", "surpreendente", "revelacao", "estrategia", "garantido",
]
STRONG_WORDS_EN = [
    "never", "always", "most people", "the truth", "secret", "nobody",
    "everyone", "mistake", "important", "amazing", "problem", "solution",
    "hack", "trick", "warning", "careful", "best", "worst", "free",
    "shocking", "surprising", "revelation", "strategy", "guaranteed",
]
STRONG_WORDS = STRONG_WORDS_PT + STRONG_WORDS_EN


COOKIES_PATH = os.environ.get("YT_COOKIES_PATH", "/app/cookies.txt")


def get_cookie_args() -> list:
    """Return yt-dlp cookie arguments if cookies file exists."""
    if os.path.exists(COOKIES_PATH):
        return ["--cookies", COOKIES_PATH]
    return []


def download_video(url: str, output_dir: str) -> dict:
    """Download video with yt-dlp and return metadata."""
    video_path = os.path.join(output_dir, "video.mp4")
    cookies = get_cookie_args()

    # Get metadata first
    meta_cmd = [
        "yt-dlp", "--dump-json", "--no-download", *cookies, url
    ]
    result = subprocess.run(meta_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp metadata failed: {result.stderr}")

    meta = json.loads(result.stdout)
    info = {
        "title": meta.get("title", "Unknown"),
        "channel": meta.get("channel", meta.get("uploader", "Unknown")),
        "duration": meta.get("duration", 0),
        "views": meta.get("view_count", 0),
        "url": url,
    }

    # Download video
    if not os.path.exists(video_path):
        dl_cmd = [
            "yt-dlp",
            "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "--merge-output-format", "mp4",
            *cookies,
            "-o", video_path,
            url,
        ]
        result = subprocess.run(dl_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"yt-dlp download failed: {result.stderr}")

    info["video_path"] = video_path
    return info


def transcribe_video(video_path: str, model_name: str = "tiny", language: str = None) -> dict:
    """Transcribe video with Whisper."""
    import whisper

    print(f"Loading Whisper model '{model_name}'...")
    model = whisper.load_model(model_name)

    print("Transcribing...")
    options = {"word_timestamps": True, "verbose": False}
    if language:
        options["language"] = language

    result = model.transcribe(video_path, **options)
    return result


def score_segment(text: str) -> tuple:
    """Score a transcript segment. Returns (score, reasons)."""
    score = 0
    reasons = []
    lower = text.lower()

    # Questions
    if "?" in text:
        score += 3
        reasons.append("question")

    # Numbers / data
    if re.search(r'\d+[%$€]|\d{2,}', text):
        score += 3
        reasons.append("data/numbers")

    # Strong statements
    for word in STRONG_WORDS:
        if word in lower:
            score += 2
            reasons.append("strong_statement")
            break

    # Exclamation
    if "!" in text:
        score += 1
        reasons.append("exclamation")

    # Dense content (long segment with substance)
    if len(text) > 80:
        score += 1
        reasons.append("dense_content")

    return score, reasons


def find_best_moments(transcription: dict, max_moments: int = 10, window_sec: float = 40.0) -> list:
    """Find best moments by scoring and grouping transcript segments."""
    segments = transcription.get("segments", [])
    if not segments:
        return []

    # Score each segment
    scored = []
    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue
        s, reasons = score_segment(text)
        scored.append({
            "start": seg["start"],
            "end": seg["end"],
            "text": text,
            "score": s,
            "reasons": reasons,
        })

    # Group into windows of ~window_sec
    moments = []
    i = 0
    while i < len(scored):
        window_start = scored[i]["start"]
        window_end = window_start + window_sec
        window_score = 0
        window_reasons = set()
        window_texts = []
        j = i

        while j < len(scored) and scored[j]["start"] < window_end:
            window_score += scored[j]["score"]
            window_reasons.update(scored[j]["reasons"])
            window_texts.append(scored[j]["text"])
            j += 1

        if window_score > 0:
            actual_end = min(scored[j - 1]["end"] if j > i else window_end, window_end)
            hook_text = window_texts[0][:100] if window_texts else ""
            moments.append({
                "start": window_start,
                "end": actual_end,
                "duration": round(actual_end - window_start, 1),
                "score": window_score,
                "hook": hook_text,
                "hook_reasons": list(window_reasons),
                "preview": " ".join(window_texts)[:300],
                "start_formatted": format_time(window_start),
                "end_formatted": format_time(actual_end),
            })

        # Advance by half window to allow overlap detection
        advance = max(1, (j - i) // 2) if j > i else 1
        i += advance

    # Remove overlapping windows (keep higher score)
    moments.sort(key=lambda m: m["score"], reverse=True)
    filtered = []
    for m in moments:
        overlap = False
        for existing in filtered:
            if m["start"] < existing["end"] and m["end"] > existing["start"]:
                overlap = True
                break
        if not overlap:
            filtered.append(m)
        if len(filtered) >= max_moments:
            break

    # Add rank
    for idx, m in enumerate(filtered):
        m["rank"] = idx + 1

    return filtered


def format_time(seconds: float) -> str:
    """Format seconds to MM:SS."""
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m:02d}:{s:02d}"


def main():
    parser = argparse.ArgumentParser(description="Analyze YouTube video for best moments")
    parser.add_argument("--url", required=True, help="YouTube video URL")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--whisper-model", default="tiny", choices=["tiny", "base", "small", "medium", "large"],
                        help="Whisper model size (default: tiny)")
    parser.add_argument("--max-moments", type=int, default=10, help="Max moments to return (default: 10)")
    parser.add_argument("--language", default=None, help="Force language (e.g., pt, en)")
    args = parser.parse_args()

    output_dir = os.path.abspath(args.output)
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Step 1: Download
        print(f"Downloading: {args.url}")
        video_info = download_video(args.url, output_dir)
        print(f"Video: {video_info['title']} ({video_info['duration']}s)")

        # Step 2: Transcribe
        transcription = transcribe_video(
            video_info["video_path"],
            model_name=args.whisper_model,
            language=args.language,
        )

        detected_language = transcription.get("language", "unknown")
        segments = transcription.get("segments", [])

        # Save transcript
        transcript_path = os.path.join(output_dir, "transcript.txt")
        with open(transcript_path, "w", encoding="utf-8") as f:
            for seg in segments:
                f.write(f"[{format_time(seg['start'])} - {format_time(seg['end'])}] {seg['text'].strip()}\n")

        # Step 3: Find best moments
        moments = find_best_moments(transcription, max_moments=args.max_moments)

        # Build output
        result = {
            "success": True,
            "video": video_info,
            "language": detected_language,
            "total_segments": len(segments),
            "moments": moments,
        }

        # Remove video_path from output (internal)
        result["video"].pop("video_path", None)

        # Save moments.json
        moments_path = os.path.join(output_dir, "moments.json")
        with open(moments_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        # Print result
        print(json.dumps(result, ensure_ascii=False, indent=2))

    except Exception as e:
        error_result = {"success": False, "error": str(e)}
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
