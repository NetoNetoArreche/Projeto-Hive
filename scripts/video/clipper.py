#!/usr/bin/env python3
"""
YouTube Video Clipper
Cuts clips from a YouTube video with face detection, vertical layout, and subtitles.

Usage:
    # Auto-detect best moments
    python clipper.py --url "URL" --output ./clips --auto

    # Specific timestamps
    python clipper.py --url "URL" --output ./clips --clips '[{"start":30,"end":75,"title":"hook1"}]'

    # Burn subtitles after editing
    python clipper.py --output ./clips --burn-only

Options:
    --format vertical|square|horizontal
    --no-subtitles
    --burn-subs
    --no-face-layout
    --whisper-model tiny|base|small|medium
    --max-clips 5
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# ── Constants ──
OUTPUT_PRESETS = {
    "vertical": {"width": 1080, "height": 1920},
    "square": {"width": 1080, "height": 1080},
    "horizontal": {"width": 1920, "height": 1080},
}

COOKIES_PATH = os.environ.get("YT_COOKIES_PATH", "/app/cookies.txt")


def get_cookie_args() -> list:
    """Return yt-dlp cookie arguments if cookies file exists."""
    if os.path.exists(COOKIES_PATH):
        return ["--cookies", COOKIES_PATH]
    return []


def download_video(url: str, output_dir: str) -> str:
    """Download video if not already present."""
    video_path = os.path.join(output_dir, "video.mp4")
    if os.path.exists(video_path):
        return video_path

    cookies = get_cookie_args()
    cmd = [
        "yt-dlp",
        "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "--merge-output-format", "mp4",
        *cookies,
        "-o", video_path,
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp download failed: {result.stderr}")
    return video_path


def get_video_dimensions(video_path: str) -> tuple:
    """Get video width and height using ffprobe."""
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    info = json.loads(result.stdout)
    stream = info["streams"][0]
    return stream["width"], stream["height"]


def detect_face_region(video_path: str, sample_count: int = 10) -> dict:
    """Detect face region using OpenCV Haar Cascade."""
    try:
        import cv2
    except ImportError:
        return {"detected": False, "reason": "opencv not installed"}

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames == 0:
        cap.release()
        return {"detected": False, "reason": "no frames"}

    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    face_positions = []
    step = max(1, total_frames // sample_count)

    for i in range(0, total_frames, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
        )

        if len(faces) > 0:
            # Pick largest face
            largest = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = largest
            cx = (x + w / 2) / frame_w
            cy = (y + h / 2) / frame_h
            fw = w / frame_w
            fh = h / frame_h
            face_positions.append({"cx": cx, "cy": cy, "w": fw, "h": fh})

    cap.release()

    if len(face_positions) < sample_count * 0.3:
        return {"detected": False, "reason": "face detected in <30% of frames"}

    # Average position
    avg_cx = sum(f["cx"] for f in face_positions) / len(face_positions)
    avg_cy = sum(f["cy"] for f in face_positions) / len(face_positions)
    avg_w = sum(f["w"] for f in face_positions) / len(face_positions)
    avg_h = sum(f["h"] for f in face_positions) / len(face_positions)

    return {
        "detected": True,
        "center": {"x": avg_cx, "y": avg_cy},
        "size": {"w": avg_w, "h": avg_h},
        "confidence": len(face_positions) / sample_count,
    }


def cut_clip(video_path: str, start: float, end: float, output_path: str):
    """Cut a clip from the video."""
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start),
        "-to", str(end),
        "-i", video_path,
        "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg cut failed: {result.stderr[:500]}")


def create_vertical_layout(input_path: str, output_path: str, face_info: dict):
    """Create vertical 1080x1920 layout with content on top and face cam on bottom."""
    in_w, in_h = get_video_dimensions(input_path)
    out_w, out_h = 1080, 1920
    content_h = 1080  # top 56%
    face_h = 840      # bottom 44%

    if face_info.get("detected"):
        face_cx = face_info["center"]["x"]
        face_cy = face_info["center"]["y"]
        face_size_w = face_info["size"]["w"]

        # Content: crop away from face
        if face_cx > 0.5:
            content_crop = f"crop=iw*0.7:ih:0:0"
        else:
            content_crop = f"crop=iw*0.7:ih:iw*0.3:0"

        # Face: generous crop around face
        face_crop_w = min(face_size_w * 5, 1.0)
        face_crop_x = max(0, face_cx - face_crop_w / 2)
        face_crop_y = max(0, face_cy - 0.3)

        face_crop = f"crop=iw*{face_crop_w:.2f}:ih*0.6:{int(in_w * face_crop_x)}:{int(in_h * face_crop_y)}"

        filter_complex = (
            f"[0:v]split=2[top][bottom];"
            f"[top]{content_crop},scale={out_w}:{content_h}:force_original_aspect_ratio=decrease,"
            f"pad={out_w}:{content_h}:(ow-iw)/2:(oh-ih)/2:black[content];"
            f"[bottom]{face_crop},scale={out_w}:{face_h}:force_original_aspect_ratio=decrease,"
            f"pad={out_w}:{face_h}:(ow-iw)/2:(oh-ih)/2:black[face];"
            f"[content][face]vstack=inputs=2[v]"
        )
    else:
        # No face detected: center crop to vertical
        filter_complex = (
            f"[0:v]crop=ih*9/16:ih:(iw-ih*9/16)/2:0,"
            f"scale={out_w}:{out_h}[v]"
        )

    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-filter_complex", filter_complex,
        "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # Fallback: simple center crop
        print(f"Face layout failed, using simple crop: {result.stderr[:200]}")
        fallback_filter = f"crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale={out_w}:{out_h}"
        cmd_fallback = [
            "ffmpeg", "-y", "-i", input_path,
            "-vf", fallback_filter,
            "-c:v", "libx264", "-crf", "18", "-preset", "medium",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            output_path,
        ]
        subprocess.run(cmd_fallback, capture_output=True, text=True)


def transcribe_clip(video_path: str, model_name: str = "tiny", language: str = None) -> list:
    """Transcribe a clip with Whisper and return word-level segments."""
    import whisper

    model = whisper.load_model(model_name)
    options = {"word_timestamps": True, "verbose": False}
    if language:
        options["language"] = language

    result = model.transcribe(video_path, **options)
    words = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []):
            words.append({
                "start": w["start"],
                "end": w["end"],
                "text": w["word"].strip(),
            })
    return words


def generate_srt(words: list, output_path: str, max_words_per_line: int = 8):
    """Generate SRT subtitle file from word timestamps."""
    if not words:
        return

    groups = []
    current = []
    for w in words:
        current.append(w)
        if len(current) >= max_words_per_line:
            groups.append(current)
            current = []
    if current:
        groups.append(current)

    with open(output_path, "w", encoding="utf-8") as f:
        for idx, group in enumerate(groups, 1):
            start = group[0]["start"]
            end = group[-1]["end"]
            text = " ".join(w["text"] for w in group)

            # Break long lines
            if len(text) > 35:
                mid = len(text) // 2
                space_pos = text.find(" ", mid)
                if space_pos != -1:
                    text = text[:space_pos] + "\n" + text[space_pos + 1:]

            f.write(f"{idx}\n")
            f.write(f"{format_srt_time(start)} --> {format_srt_time(end)}\n")
            f.write(f"{text}\n\n")


def generate_ass(words: list, output_path: str, max_words_per_line: int = 8):
    """Generate ASS subtitle file with styling."""
    if not words:
        return

    groups = []
    current = []
    for w in words:
        current.append(w)
        if len(current) >= max_words_per_line:
            groups.append(current)
            current = []
    if current:
        groups.append(current)

    header = """[Script Info]
Title: InstaPost Clip Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, StrikeOut, Underline, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat,68,&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,0,0,1,4,2,2,60,60,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(header)
        for group in groups:
            start = group[0]["start"]
            end = group[-1]["end"]
            text = " ".join(w["text"] for w in group)

            if len(text) > 35:
                mid = len(text) // 2
                space_pos = text.find(" ", mid)
                if space_pos != -1:
                    text = text[:space_pos] + "\\N" + text[space_pos + 1:]

            f.write(f"Dialogue: 0,{format_ass_time(start)},{format_ass_time(end)},Default,,0,0,0,,{text}\n")


def burn_subtitles(video_path: str, ass_path: str, output_path: str):
    """Burn ASS subtitles into the video."""
    # Escape path for ffmpeg filter (Windows backslashes)
    escaped_ass = ass_path.replace("\\", "/").replace(":", "\\:")

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"ass={escaped_ass}",
        "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Warning: burn subtitles failed: {result.stderr[:200]}")
        return False
    return True


def format_srt_time(seconds: float) -> str:
    """Format seconds to SRT timestamp."""
    h = int(seconds) // 3600
    m = (int(seconds) % 3600) // 60
    s = int(seconds) % 60
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_ass_time(seconds: float) -> str:
    """Format seconds to ASS timestamp."""
    h = int(seconds) // 3600
    m = (int(seconds) % 3600) // 60
    s = int(seconds) % 60
    cs = int((seconds - int(seconds)) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def process_clip(
    video_path: str,
    clip_info: dict,
    clip_index: int,
    output_dir: str,
    fmt: str = "vertical",
    face_info: dict = None,
    whisper_model: str = "tiny",
    language: str = None,
    no_subtitles: bool = False,
    burn_subs: bool = False,
    no_face_layout: bool = False,
) -> dict:
    """Process a single clip: cut, layout, transcribe, subtitles."""
    start = clip_info["start"]
    end = clip_info["end"]
    title = clip_info.get("title", f"clip-{clip_index:02d}")
    safe_title = re.sub(r'[^\w\-]', '_', title)[:50]

    prefix = f"clip-{clip_index:02d}"

    # Step 1: Cut raw clip
    raw_path = os.path.join(output_dir, f"{prefix}-raw.mp4")
    print(f"  Cutting [{start:.1f}s - {end:.1f}s]...")
    cut_clip(video_path, start, end, raw_path)

    # Step 2: Apply layout
    final_path = os.path.join(output_dir, f"{prefix}.mp4")
    if fmt == "vertical" and not no_face_layout and face_info:
        print(f"  Creating vertical layout...")
        create_vertical_layout(raw_path, final_path, face_info)
    else:
        preset = OUTPUT_PRESETS.get(fmt, OUTPUT_PRESETS["vertical"])
        w, h = preset["width"], preset["height"]
        if fmt == "vertical":
            vf = f"crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale={w}:{h}"
        elif fmt == "square":
            vf = f"crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2,scale={w}:{h}"
        else:
            vf = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"

        cmd = [
            "ffmpeg", "-y", "-i", raw_path,
            "-vf", vf,
            "-c:v", "libx264", "-crf", "18", "-preset", "medium",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            final_path,
        ]
        subprocess.run(cmd, capture_output=True, text=True)

    # Clean raw
    if os.path.exists(raw_path) and os.path.exists(final_path):
        os.remove(raw_path)

    result = {
        "index": clip_index,
        "title": title,
        "start": start,
        "end": end,
        "duration": round(end - start, 1),
        "video": final_path,
    }

    # Step 3: Subtitles
    if not no_subtitles:
        print(f"  Generating subtitles...")
        words = transcribe_clip(final_path, model_name=whisper_model, language=language)

        srt_path = os.path.join(output_dir, f"{prefix}.srt")
        ass_path = os.path.join(output_dir, f"{prefix}.ass")

        generate_srt(words, srt_path)
        generate_ass(words, ass_path)

        result["srt"] = srt_path
        result["ass"] = ass_path

        # Step 4: Burn subtitles (optional)
        if burn_subs and os.path.exists(ass_path):
            print(f"  Burning subtitles...")
            burned_path = os.path.join(output_dir, f"{prefix}-burned.mp4")
            if burn_subtitles(final_path, ass_path, burned_path):
                os.replace(burned_path, final_path)

    return result


def burn_only(output_dir: str):
    """Burn subtitles for all clips that have .ass files."""
    clips = sorted(Path(output_dir).glob("clip-*.mp4"))
    burned = 0

    for clip_path in clips:
        if "-raw" in clip_path.name or "-burned" in clip_path.name:
            continue

        ass_path = clip_path.with_suffix(".ass")
        if not ass_path.exists():
            continue

        print(f"Burning subtitles for {clip_path.name}...")
        burned_path = clip_path.with_name(clip_path.stem + "-burned.mp4")
        if burn_subtitles(str(clip_path), str(ass_path), str(burned_path)):
            os.replace(str(burned_path), str(clip_path))
            burned += 1

    print(f"Burned subtitles for {burned} clips.")
    return burned


def main():
    parser = argparse.ArgumentParser(description="Cut YouTube video clips with face cam and subtitles")
    parser.add_argument("--url", help="YouTube video URL")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--clips", help='JSON array of clips: [{"start":30,"end":75,"title":"hook"}]')
    parser.add_argument("--auto", action="store_true", help="Auto-detect best moments")
    parser.add_argument("--format", default="vertical", choices=["vertical", "square", "horizontal"])
    parser.add_argument("--no-subtitles", action="store_true")
    parser.add_argument("--burn-subs", action="store_true", help="Burn subtitles into video")
    parser.add_argument("--burn-only", action="store_true", help="Only burn subtitles for existing clips")
    parser.add_argument("--no-face-layout", action="store_true")
    parser.add_argument("--whisper-model", default="tiny", choices=["tiny", "base", "small", "medium", "large"])
    parser.add_argument("--max-clips", type=int, default=5)
    parser.add_argument("--language", default=None)
    args = parser.parse_args()

    output_dir = os.path.abspath(args.output)
    os.makedirs(output_dir, exist_ok=True)

    # Burn-only mode
    if args.burn_only:
        burn_only(output_dir)
        return

    if not args.url:
        print("Error: --url is required (unless using --burn-only)", file=sys.stderr)
        sys.exit(1)

    try:
        # Download video
        print(f"Downloading: {args.url}")
        video_path = download_video(args.url, output_dir)

        # Get clips to process
        if args.clips:
            clips_list = json.loads(args.clips)
        elif args.auto:
            # Run analysis inline
            print("Auto-detecting best moments...")
            from analyze import transcribe_video, find_best_moments
            transcription = transcribe_video(video_path, model_name=args.whisper_model, language=args.language)
            moments = find_best_moments(transcription, max_moments=args.max_clips)
            clips_list = [{"start": m["start"], "end": m["end"], "title": f"moment-{m['rank']}"} for m in moments]
            if not clips_list:
                print("No moments found.")
                sys.exit(0)
        else:
            print("Error: provide --clips or --auto", file=sys.stderr)
            sys.exit(1)

        # Detect face
        face_info = None
        if not args.no_face_layout and args.format == "vertical":
            print("Detecting face...")
            face_info = detect_face_region(video_path)
            if face_info.get("detected"):
                print(f"  Face detected (confidence: {face_info['confidence']:.0%})")
            else:
                print(f"  No face detected: {face_info.get('reason', 'unknown')}")

        # Process each clip
        results = []
        for idx, clip_info in enumerate(clips_list, 1):
            print(f"\nProcessing clip {idx}/{len(clips_list)}: {clip_info.get('title', '')}")
            result = process_clip(
                video_path=video_path,
                clip_info=clip_info,
                clip_index=idx,
                output_dir=output_dir,
                fmt=args.format,
                face_info=face_info,
                whisper_model=args.whisper_model,
                language=args.language,
                no_subtitles=args.no_subtitles,
                burn_subs=args.burn_subs,
                no_face_layout=args.no_face_layout,
            )
            results.append(result)

        output = {
            "success": True,
            "total_clips": len(results),
            "clips": results,
            "output_dir": output_dir,
        }

        # Save result
        result_path = os.path.join(output_dir, "clips-result.json")
        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        print(json.dumps(output, ensure_ascii=False, indent=2))

    except Exception as e:
        error_result = {"success": False, "error": str(e)}
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
