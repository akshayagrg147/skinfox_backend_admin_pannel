# Hydrelle website slideshow banner

The generated lifestyle photograph is stored beside a deterministic typography pass. The render exports a 2880 × 960 PNG and WebP into `public/products`.

## Image-generation prompt

```text
Use case: ads-marketing
Asset type: ultra-wide website homepage slideshow banner
Primary request: Create an original SkinFox Hydrelle lifestyle campaign with the same broad playful beauty-ad energy, pastel split-color background, and left-subject/right-copy layout logic as Image 1, without copying its people, poses, wording, graphics, product designs, or exact composition.
Input images: Image 1 is a composition, mood, and palette reference only. Image 2 is the exact Hydrelle product-pack reference and must define the tube identity. Image 3 is supporting reference for how Hydrelle appears in a skincare context.
Scene/backdrop: A clean, graphic studio backdrop blending bubblegum pink on the left into airy powder blue on the right, with a soft diagonal color transition and subtle diffused glow. No room setting or clutter.
Subject: Two distinct joyful young adult Indian women standing close together on the left 56% of the frame, laughing toward camera in a fresh contemporary beauty campaign. Give them original faces, hairstyles, styling, and poses clearly different from Image 1. One woman holds one Hydrelle tube beside her face with the front label facing camera; the second woman makes a playful skincare gesture near her cheek and has a small neat dab of white lotion on the back of one hand. Clothing is cobalt blue and soft lilac, modest sleeveless summer styling, minimal jewelry, natural skin texture, colourful but refined eyeliner.
Product fidelity: Preserve the Hydrelle tube silhouette, navy-and-white color blocking, heart-shaped white lotion graphic, white ribbed top seal, white flip cap, 200 g marking, Hydrelle name, Dry Skin Specialist wording, Moisturising Lotion wording, and Skinfox logo placement from Image 2. The tube must remain clearly recognizable and photorealistic.
Style/medium: Premium high-key photorealistic Indian beauty campaign, cheerful Gen-Z energy, glossy commercial finish, natural skin texture, polished ecommerce photography.
Composition/framing: Extra-wide 3:1 panoramic banner. Crop subjects around mid-torso. Keep faces large and close together. Subjects and the single Hydrelle tube occupy the left half and can slightly overlap the center. Preserve the entire right 40% as uncluttered pink-to-blue negative space for exact headline and CTA to be added later. Leave safe margins around all edges.
Lighting/mood: Bright softbox beauty lighting, warm flattering highlights, crisp color, soft shadows, joyful and welcoming.
Color palette: Bubblegum pink, powder blue, cobalt blue, soft lilac, white, deep Hydrelle navy.
Constraints: Both models are adults. One Hydrelle tube only. Anatomically correct hands and fingers. Product label faces camera. Do not add any headline, caption, badge, button, price, claim, copied logo, carousel dots, webpage controls, watermark, or decorative text.
Avoid: copied identities or styling from Image 1, duplicated faces, extra arms or fingers, distorted tube, altered packaging colors, invented product claims, unreadable fake pack text beyond unavoidable microprint, medical imagery, before-and-after framing, exaggerated retouching, clutter in the right-side copy zone.
```

Run `python3 render.py` on macOS to regenerate the final files.
