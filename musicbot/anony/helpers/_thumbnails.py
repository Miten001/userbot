# Copyright (c) 2025 AnonymousX1025
# Licensed under the MIT License.
# This file is part of AnonXMusic
#
# Modernised "Now Playing" thumbnail renderer:
#  - blurred, darkened album-art backdrop
#  - vivid gradient border / progress bar (purple -> pink -> orange)
#  - glass panel with rounded corners for text
#  - neon accent circle + play glyph
#
# Everything is drawn with Pillow only (no external services), so it keeps
# working the same way on any host.

import os
import math
import aiohttp
from PIL import (Image, ImageDraw, ImageEnhance,
                 ImageFilter, ImageFont, ImageOps)

from anony import config
from anony.helpers import Track


def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _gradient(size, stops, vertical=False):
    """Smooth multi-stop linear gradient, horizontal by default."""
    w, h = size
    length = w if not vertical else h
    grad = Image.new("RGB", (length, 1) if not vertical else (1, length))
    px = grad.load()
    n = len(stops) - 1
    for i in range(length):
        t = i / max(length - 1, 1)
        seg = min(int(t * n), n - 1)
        local_t = (t - seg / n) * n
        color = _lerp(stops[seg], stops[seg + 1], local_t)
        if vertical:
            px[0, i] = color
        else:
            px[i, 0] = color
    return grad.resize(size)


def _rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255
    )
    return mask


class Thumbnail:
    # Signature vivid gradient used across the whole UI for this build.
    GRADIENT_STOPS = [
        (255, 45, 149),   # hot pink
        (147, 51, 234),   # violet
        (56, 132, 255),   # electric blue
        (0, 224, 194),    # teal/green accent
    ]

    def __init__(self):
        self.card_size = (900, 460)
        self.art_size = (400, 400)
        self.canvas_size = (1280, 720)
        self.fill = (255, 255, 255)
        self.muted = (200, 200, 210)
        try:
            self.font_title = ImageFont.truetype("anony/helpers/Raleway-Bold.ttf", 40)
            self.font_sub = ImageFont.truetype("anony/helpers/Inter-Light.ttf", 26)
            self.font_time = ImageFont.truetype("anony/helpers/Inter-Light.ttf", 22)
            self.font_brand = ImageFont.truetype("anony/helpers/Raleway-Bold.ttf", 24)
        except Exception:
            self.font_title = ImageFont.load_default()
            self.font_sub = ImageFont.load_default()
            self.font_time = ImageFont.load_default()
            self.font_brand = ImageFont.load_default()
        self.session: aiohttp.ClientSession | None = None

    async def start(self) -> None:
        self.session = aiohttp.ClientSession()

    async def close(self) -> None:
        if self.session:
            await self.session.close()

    async def save_thumb(self, output_path: str, url: str) -> str:
        async with self.session.get(url) as resp:
            with open(output_path, "wb") as f:
                f.write(await resp.read())
        return output_path

    def _truncate(self, draw, text, font, max_width):
        if draw.textlength(text, font=font) <= max_width:
            return text
        while text and draw.textlength(text + "…", font=font) > max_width:
            text = text[:-1]
        return text + "…"

    def _wrap_lines(self, draw, text, font, max_width, max_lines=2):
        """Word-wrap `text` into at most `max_lines`, ellipsising the tail."""
        words = text.split()
        lines: list[str] = []
        current = ""

        for idx, word in enumerate(words):
            trial = f"{current} {word}".strip()
            if draw.textlength(trial, font=font) <= max_width:
                current = trial
                continue

            lines.append(current)
            current = word

            if len(lines) == max_lines:
                # Ran out of room -> ellipsise whatever is left of `current`
                remainder = " ".join([current] + words[idx + 1:])
                current = self._truncate(draw, remainder, font, max_width)
                break

        if current and len(lines) < max_lines:
            lines.append(current)
        elif current and len(lines) == max_lines:
            lines[-1] = current

        return lines[:max_lines] or [""]

    async def generate(self, song: Track, size=None) -> str:
        try:
            size = size or self.canvas_size
            temp = f"cache/temp_{song.id}.jpg"
            output = f"cache/{song.id}.png"
            if os.path.exists(output):
                return output

            await self.save_thumb(temp, song.thumbnail)
            art = Image.open(temp).convert("RGB")

            # ---- Blurred, darkened, gradient-tinted backdrop ----
            bg = ImageOps.fit(art, size, method=Image.LANCZOS)
            bg = bg.filter(ImageFilter.GaussianBlur(40))
            bg = ImageEnhance.Brightness(bg).enhance(0.35)
            bg = ImageEnhance.Color(bg).enhance(1.4)

            tint = _gradient(size, self.GRADIENT_STOPS).convert("RGB")
            canvas = Image.blend(bg, tint, 0.22).convert("RGBA")

            # subtle vignette
            vignette = Image.new("L", size, 0)
            vd = ImageDraw.Draw(vignette)
            vd.ellipse(
                (-size[0] * 0.25, -size[1] * 0.35, size[0] * 1.25, size[1] * 1.35),
                fill=255,
            )
            vignette = vignette.filter(ImageFilter.GaussianBlur(120))
            dark_overlay = Image.new("RGBA", size, (0, 0, 0, 140))
            canvas = Image.composite(canvas, dark_overlay, vignette)

            draw = ImageDraw.Draw(canvas)

            # ---- Glass card ----
            card_x = (size[0] - self.card_size[0]) // 2
            card_y = (size[1] - self.card_size[1]) // 2
            card_box = (card_x, card_y, card_x + self.card_size[0], card_y + self.card_size[1])

            glass = Image.new("RGBA", size, (0, 0, 0, 0))
            gd = ImageDraw.Draw(glass)
            gd.rounded_rectangle(card_box, radius=32, fill=(18, 18, 26, 165))
            canvas = Image.alpha_composite(canvas, glass)

            # gradient border around the glass card
            border = Image.new("RGBA", size, (0, 0, 0, 0))
            bd = ImageDraw.Draw(border)
            bd.rounded_rectangle(card_box, radius=32, outline=(255, 255, 255, 60), width=2)
            canvas = Image.alpha_composite(canvas, border)

            draw = ImageDraw.Draw(canvas)

            # ---- Album art (rounded, with gradient glow ring) ----
            art_x = card_x + 40
            art_y = card_y + (self.card_size[1] - self.art_size[1]) // 2
            glow_pad = 10
            glow_box = (
                art_x - glow_pad, art_y - glow_pad,
                art_x + self.art_size[0] + glow_pad, art_y + self.art_size[1] + glow_pad,
            )
            glow = Image.new("RGBA", size, (0, 0, 0, 0))
            glow_grad = _gradient(
                (glow_box[2] - glow_box[0], glow_box[3] - glow_box[1]),
                self.GRADIENT_STOPS,
            ).convert("RGBA")
            glow_mask = _rounded_mask(glow_grad.size, 26)
            glow.paste(glow_grad, (glow_box[0], glow_box[1]), glow_mask)
            glow = glow.filter(ImageFilter.GaussianBlur(18))
            canvas = Image.alpha_composite(canvas, glow)

            art_fit = ImageOps.fit(
                art, self.art_size, method=Image.LANCZOS, centering=(0.5, 0.5)
            ).convert("RGBA")
            art_mask = _rounded_mask(self.art_size, 22)
            art_layer = Image.new("RGBA", size, (0, 0, 0, 0))
            art_layer.paste(art_fit, (art_x, art_y), art_mask)
            canvas = Image.alpha_composite(canvas, art_layer)

            draw = ImageDraw.Draw(canvas)
            draw.rounded_rectangle(
                (art_x, art_y, art_x + self.art_size[0], art_y + self.art_size[1]),
                radius=22, outline=(255, 255, 255, 90), width=2,
            )

            # ---- Text block ----
            text_x = art_x + self.art_size[0] + 40
            text_top = art_y + 10
            max_text_w = card_box[2] - 40 - text_x

            brand = "🎧 NOW PLAYING"
            draw.text((text_x, text_top), brand, font=self.font_brand, fill=(255, 140, 210))

            title_lines = self._wrap_lines(
                draw, song.title or "Unknown Track", self.font_title, max_text_w, max_lines=2
            )
            line_h = 50
            for i, line in enumerate(title_lines):
                draw.text(
                    (text_x, text_top + 46 + i * line_h),
                    line, font=self.font_title, fill=self.fill,
                )
            title_block_h = len(title_lines) * line_h

            channel = song.channel_name or "Unknown Artist"
            views = f" • {song.view_count}" if song.view_count else ""
            subtitle = self._truncate(draw, f"{channel}{views}", self.font_sub, max_text_w)
            sub_y = text_top + 46 + title_block_h + 8
            draw.text((text_x, sub_y), subtitle, font=self.font_sub, fill=self.muted)

            # ---- Progress bar with gradient fill + glowing knob ----
            bar_y = sub_y + 55
            bar_w = max_text_w
            bar_h = 8
            bar_x0 = text_x
            bar_x1 = text_x + bar_w

            draw.rounded_rectangle(
                (bar_x0, bar_y, bar_x1, bar_y + bar_h),
                radius=bar_h // 2, fill=(255, 255, 255, 40),
            )

            progress = 0.05  # start-of-track position; live position not tracked here
            fill_w = max(int(bar_w * progress), bar_h)
            bar_grad = _gradient((bar_w, bar_h), self.GRADIENT_STOPS)
            bar_grad_mask = Image.new("L", (bar_w, bar_h), 0)
            ImageDraw.Draw(bar_grad_mask).rounded_rectangle(
                (0, 0, fill_w, bar_h), radius=bar_h // 2, fill=255
            )
            canvas.paste(bar_grad.convert("RGBA"), (bar_x0, bar_y), bar_grad_mask)

            knob_r = 9
            knob_cx = bar_x0 + fill_w
            knob_cy = bar_y + bar_h // 2
            draw = ImageDraw.Draw(canvas)
            draw.ellipse(
                (knob_cx - knob_r, knob_cy - knob_r, knob_cx + knob_r, knob_cy + knob_r),
                fill=(255, 255, 255),
            )

            draw.text((bar_x0, bar_y + 18), "0:00", font=self.font_time, fill=self.muted)
            dur_text = song.duration or "0:00"
            dur_w = draw.textlength(dur_text, font=self.font_time)
            draw.text((bar_x1 - dur_w, bar_y + 18), dur_text, font=self.font_time, fill=self.muted)

            # ---- Play glyph badge (bottom-left of art, glassy circle) ----
            badge_r = 34
            badge_cx = art_x + 30
            badge_cy = art_y + self.art_size[1] - 30
            badge_grad = _gradient((badge_r * 2, badge_r * 2), self.GRADIENT_STOPS).convert("RGBA")
            badge_mask = Image.new("L", (badge_r * 2, badge_r * 2), 0)
            ImageDraw.Draw(badge_mask).ellipse((0, 0, badge_r * 2, badge_r * 2), fill=255)
            badge_layer = Image.new("RGBA", size, (0, 0, 0, 0))
            badge_layer.paste(badge_grad, (badge_cx - badge_r, badge_cy - badge_r), badge_mask)
            canvas = Image.alpha_composite(canvas, badge_layer)
            draw = ImageDraw.Draw(canvas)

            tri = [
                (badge_cx - 8, badge_cy - 14),
                (badge_cx - 8, badge_cy + 14),
                (badge_cx + 14, badge_cy),
            ]
            draw.polygon(tri, fill=(255, 255, 255))

            # ---- Brand watermark, bottom-right of the card ----
            watermark = "SPYDII MUSIC"
            wm_w = draw.textlength(watermark, font=self.font_time)
            draw.text(
                (card_box[2] - 24 - wm_w, card_box[3] - 34),
                watermark, font=self.font_time, fill=(255, 255, 255, 120),
            )

            canvas = canvas.convert("RGB")
            canvas.save(output, quality=95)
            try:
                os.remove(temp)
            except Exception:
                pass
            return output
        except Exception:
            return config.DEFAULT_THUMB
