# Rayyvia website slideshow banner

This folder contains the source image and the small deterministic typography pass for the finished banner.

## Image-generation prompt

```text
Use case: ads-marketing
Asset type: ultra-wide website homepage slideshow banner
Primary request: Create an original SkinFox Rayyvia Sun Protect lifestyle banner with the same broad visual energy and layout logic as the supplied website screenshot, without copying its brand, people, wording, graphics, or exact composition.
Input images: Image 1 is a composition-and-energy reference only. Image 2 is the exact product reference for SkinFox Rayyvia Sun Protect.
Scene/backdrop: Brilliant cloudless cyan-blue summer sky with a few soft wispy clouds and a subtle pale horizon glow; clean high-key commercial setting.
Subject: Two distinct joyful young adult Indian women standing close together on the left 55% of the frame, laughing naturally. One woman holds a single SkinFox Rayyvia tube toward camera; the other holds a second identical Rayyvia tube near her shoulder. Both wear simple pastel yellow and blush-pink summer tops, minimal jewelry, natural skin texture, and fresh understated makeup.
Style/medium: Premium photorealistic Indian beauty campaign, energetic, colourful, sunlit, playful, polished ecommerce photography.
Composition/framing: Extra-wide panoramic 3:1 banner. Models and products occupy the left half and may slightly overlap the centre. Keep the entire right 40% as clean blue negative space for later headline and CTA. Crop at mid-torso. Products large enough to recognise, angled dynamically but labels facing camera. Leave safe margins around every edge.
Lighting/mood: Bright natural-looking sunlight with soft fill, crisp cheerful contrast, warm highlights, no harsh shadows.
Color palette: Sky blue, sunshine yellow, blush pink, white, small purple SkinFox accents.
Constraints: Both models are adults. Preserve the exact Rayyvia package silhouette, pink-and-yellow colour blocks, white cap, SkinFox logo, 60 g marking, and label arrangement from Image 2. Hands must be anatomically correct. Add no headline, caption, button, badge, price, external logo, claim, carousel dots, webpage controls, or watermark.
Avoid: any copied people or brand elements from Image 1, duplicated faces, extra arms or fingers, distorted tubes, altered branding, unreadable invented package text, bikinis, medical imagery, beach clutter, sunglasses covering faces, exaggerated retouching.
```

Run `python3 render.py` on macOS to regenerate the 2880 × 960 PNG and WebP assets.
