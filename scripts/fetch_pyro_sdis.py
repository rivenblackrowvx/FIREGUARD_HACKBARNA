"""Sample camera frames from the Pyronear PYRO-SDIS smoke dataset (HF).

Uses the Hugging Face datasets-server rows API so we only download the frames
we need. Each frame keeps its YOLO smoke annotations, which the app replays as
the demo inference layer (clearly labelled as such in the UI).
"""
import json
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "data" / "cameras"
OUT.mkdir(parents=True, exist_ok=True)
API = "https://datasets-server.huggingface.co/rows?dataset=pyronear/pyro-sdis&config=default&split=val"
PER_CAMERA = 6
MAX_CAMERAS = 12


def rows(offset, length=100):
    with urllib.request.urlopen(f"{API}&offset={offset}&length={length}", timeout=60) as r:
        return json.load(r)["rows"]


def main():
    by_cam = defaultdict(list)
    for offset in range(0, 4099, 100):
        for item in rows(offset):
            row = item["row"]
            by_cam[row["camera"]].append((item["row_idx"], row))
        if sum(1 for v in by_cam.values() if len(v) >= PER_CAMERA) >= MAX_CAMERAS * 2:
            break

    cams = sorted(by_cam.items(), key=lambda kv: -len(kv[1]))[:MAX_CAMERAS]
    manifest = []
    for cam, frames in cams:
        frames.sort(key=lambda f: f[1]["date"])
        picked = frames[:: max(1, len(frames) // PER_CAMERA)][:PER_CAMERA]
        out_frames = []
        for idx, row in picked:
            fname = f"{idx}.jpg"
            dst = OUT / fname
            if not dst.exists():
                urllib.request.urlretrieve(row["image"]["src"], dst)
            boxes = []
            for line in (row["annotations"] or "").strip().splitlines():
                parts = line.split()
                if len(parts) >= 5:
                    _, x, y, w, h = parts[:5]
                    boxes.append([round(float(v), 4) for v in (x, y, w, h)])
            out_frames.append({"file": fname, "date": row["date"], "boxes": boxes,
                               "w": row["image"]["width"], "h": row["image"]["height"]})
        manifest.append({"camera": cam, "partner": picked[0][1]["partner"], "frames": out_frames})
        print(cam, len(out_frames))
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    main()
