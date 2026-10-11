"""Extract independent icon sprites from the user supplied reference sheet.

The sheet is kept in art/source/ui. Only the transparent, cropped exports are
copied into runtime assets; the baked labels and paper background stay out of
the game so Cocos can render live text and state.
"""

from pathlib import Path
from PIL import Image
import json
import math

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art" / "source" / "ui" / "reference_icons_v01.png"
EXPORT = ROOT / "art" / "exports" / "ui" / "icons"
RUNTIME = ROOT / "assets" / "art" / "workbench" / "ui" / "icons"
LEDGER = ROOT / "art" / "figma" / "reference-ui-slicing.json"

NAMES = [
    ["workshop", "product", "procurement", "orders", "company"],
    ["calendar", "cash", "settings", "assembly", "testing"],
    ["labor", "monthly_report", "progress", "reputation", "supplier"],
    ["shipping", "warning", "featured", "back", "forward"],
]


def connected_background_alpha(image: Image.Image, tolerance: float = 38.0) -> Image.Image:
    """Remove only cream pixels connected to the crop border, retaining white icon fills."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    sample = [pixels[0, 0][:3], pixels[width - 1, 0][:3], pixels[0, height - 1][:3], pixels[width - 1, height - 1][:3]]
    base = tuple(sum(c[i] for c in sample) / len(sample) for i in range(3))
    pending = [(x, y) for x in range(width) for y in (0, height - 1)] + [(x, y) for y in range(height) for x in (0, width - 1)]
    seen = set()
    while pending:
        x, y = pending.pop()
        if (x, y) in seen:
            continue
        seen.add((x, y))
        color = pixels[x, y][:3]
        if math.sqrt(sum((color[i] - base[i]) ** 2 for i in range(3))) > tolerance:
            continue
        pixels[x, y] = (*color, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen:
                pending.append((nx, ny))
    return rgba


def main() -> None:
    image = Image.open(SOURCE).convert("RGB")
    cell_width = image.width / 5
    cell_height = image.height / 4
    EXPORT.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    records = []
    for row, names in enumerate(NAMES):
        for column, name in enumerate(names):
            left = round(column * cell_width)
            right = round((column + 1) * cell_width)
            top = round(row * cell_height)
            # Labels occupy the lower part of each cell; keep the icon and its shadow only.
            bottom = min(round(top + cell_height * 0.74), image.height)
            sprite = connected_background_alpha(image.crop((left, top, right, bottom)))
            bbox = sprite.getchannel("A").getbbox()
            if bbox:
                sprite = sprite.crop(bbox)
            out_name = f"{name}.png"
            export_path = EXPORT / out_name
            runtime_path = RUNTIME / out_name
            sprite.save(export_path, optimize=True)
            sprite.save(runtime_path, optimize=True)
            records.append({
                "name": name,
                "source": "art/source/ui/reference_icons_v01.png",
                "sourceCell": [column, row, 5, 4],
                "exportPath": f"art/exports/ui/icons/{out_name}",
                "runtimePath": f"assets/art/workbench/ui/icons/{out_name}",
                "status": "extracted_for_demo",
                "label": "Cocos Label, not part of the sprite",
            })
    LEDGER.write_text(json.dumps({
        "schemaVersion": 1,
        "source": "user-provided reference image",
        "sourcePath": "art/source/ui/reference_icons_v01.png",
        "grid": {"columns": 5, "rows": 4},
        "background": "removed by border-connected cream flood fill",
        "entries": records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
