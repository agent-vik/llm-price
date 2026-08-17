#!/usr/bin/env python3
"""Generate the OG share image for llm-price (1200x630).
A simplified rendering of the site's butterfly chart — data read from the
source of truth so the image never drifts from the page."""
import json, math, os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
models = json.load(open(f'{BASE}/data/models.json'))['models']
prices = json.load(open(f'{BASE}/data/prices.json'))['prices']

# representative spread: flagship, mid, budget, cheapest
PICK = ['Claude 5 Fable', 'GPT 5.6 Sol', 'Grok 4.6', 'Deepseek V4 Flash']

# ---- palette (mirrors assets/style.css) ----
BG = (13, 17, 23)
PANEL = (22, 27, 34)
BORDER = (43, 50, 64)
TEXT = (230, 232, 235)
DIM = (154, 164, 178)
FAINT = (107, 116, 132)
C_INPUT = (76, 154, 255)
C_OUTPUT = (56, 199, 147)
C_INPUT_FADE = (76, 154, 255, 90)

W, H = 1200, 630
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img, 'RGBA')

def font(path, size):
    return ImageFont.truetype(path, size)

F_TITLE = font('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 58)
F_SUB = font('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
F_NAME = font('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
F_TICK = font('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 18)
F_SMALL = font('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 20)
F_BADGE = font('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)

# header
d.text((72, 56), 'LLM Price', font=F_TITLE, fill=TEXT)
d.text((72, 132), 'Official API pricing of frontier models — USD / 1M tokens',
       font=F_SUB, fill=DIM)

# ---- simplified butterfly chart ----
# chart geometry
CX = W // 2                 # center axis
CHART_TOP, CHART_BOT = 200, 500
HALF = 430                  # px per side
NAME_W = 210                # center column width

# log domain from all data (same rule as the site)
vals = [prices[k][f] for k in prices for f in ('input', 'cached_input', 'output')
        if prices[k][f] is not None]
LOG_MIN = math.floor(math.log10(min(vals)))
LOG_MAX = max(LOG_MIN + 1, math.ceil(math.log10(max(vals))))

def px(v):
    t = (math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)
    return int(HALF * max(0.0, min(1.0, t)))

# gridlines every power of 10
for e in range(LOG_MIN, LOG_MAX + 1):
    off = px(10 ** e)
    for sign in (-1, 1):
        x = CX + sign * off
        if sign == -1 and off == 0:
            continue
        d.line([(x, CHART_TOP), (x, CHART_BOT)], fill=(255, 255, 255, 18), width=1)
        d.text((x - 12, CHART_BOT + 8), '$' + str(10 ** e), font=F_TICK, fill=FAINT)

# center axis line
d.line([(CX, CHART_TOP - 10), (CX, CHART_BOT + 10)], fill=BORDER, width=2)

# bars
rows = PICK
n = len(rows)
row_h = (CHART_BOT - CHART_TOP) // n
for i, name in enumerate(rows):
    p = prices[name]
    cy = CHART_TOP + row_h * i + row_h // 2
    bh = 22  # bar height

    # left: input (faded) with cached solid segment
    w_in = px(p['input'])
    d.rounded_rectangle([CX - w_in, cy - bh // 2, CX, cy + bh // 2],
                        radius=4, fill=C_INPUT_FADE)
    if p['cached_input'] is not None:
        w_c = px(p['cached_input'])
        d.rounded_rectangle([CX - w_c, cy - bh // 2, CX, cy + bh // 2],
                            radius=4, fill=C_INPUT)

    # right: output
    w_out = px(p['output'])
    d.rounded_rectangle([CX, cy - bh // 2, CX + w_out, cy + bh // 2],
                        radius=4, fill=C_OUTPUT)

    # model name on a background chip
    bbox = d.textbbox((0, 0), name, font=F_NAME)
    tw = bbox[2] - bbox[0]
    chip_x0, chip_x1 = CX - tw // 2 - 14, CX + tw // 2 + 14
    d.rounded_rectangle([chip_x0, cy - 20, chip_x1, cy + 20], radius=6, fill=BG)
    d.text((CX - tw // 2, cy - 13), name, font=F_NAME, fill=TEXT)

# footer
d.line([(72, 548), (W - 72, 548)], fill=BORDER, width=1)
d.text((72, 566), 'llm-price.victor42.work', font=F_BADGE, fill=DIM)
right = f'{len(models)} models · official list prices · refreshed on a schedule'
rb = d.textbbox((0, 0), right, font=F_BADGE)
d.text((W - 72 - (rb[2] - rb[0]), 566), right, font=F_BADGE, fill=FAINT)

out = f'{BASE}/assets/og-image.png'
img.save(out, 'PNG')
print('saved', out)
