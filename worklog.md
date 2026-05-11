---
Task ID: 1
Agent: Main Agent
Task: Generate unique menu images for all duplicate items in RestaurantOS POS

Work Log:
- Analyzed all 253 menu images and found 142 were duplicates (only 111 unique)
- Each category had one template image copied for all items in that category
- Created scripts/generate-missing-images.mjs with 164 items needing unique images
- First attempt with z-ai-generate CLI failed due to API rate limiting (429)
- Rewrote script to use programmatic SVG generation + Sharp for instant PNG conversion
- Each image has unique: color scheme, decorative elements (based on MD5 hash of item name), category-specific silhouette (wine bottle/beer glass/cocktail/spirit bottle/coffee cup/glass bottle), item name and subtitle
- Successfully generated 161/164 images on first run
- Fixed 3 remaining failures (Cuba Libre, Mango Mojito, Strawberry Mojito) caused by unescaped & in XML
- Final verification: 253 unique images, 0 duplicate groups

Stage Summary:
- All 253 menu item images are now unique (no duplicates)
- Script: scripts/generate-missing-images.mjs
- Technology: SVG generation + Sharp PNG conversion
- Categories covered: bela-vina, rdeca-vina, rose-vino, penine, tuja-vina, likersko-vino, toceno-pivo, pivo, craft-piva, brezalk-pivo, viski, gin, likerji, grencice, destilati, topli-napitki, mesane-pijace, vode, naravni-sokovi, sokovi, gazirane-pijace
