# Project Instructions for MermaidFlow

## Global Standards
- Follow the architectural patterns defined below for all code generation.
- Use clean, modular code following SOLID principles.


# Frontend Engineering Standards: Mermaid-to-GIF Architect

## 1. Core Tech Stack
- **Framework:** Next.js 14+ (App Router) or React 18.
- **Styling:** Tailwind CSS (Utility-first, responsive).
- **Icons:** Lucide-React.
- **State Management:** Zustand (for global editor state and export status).
- **Editor:** @monaco-editor/react (for VS Code-like Mermaid editing).

## 2. Mermaid Integration & Animation Logic
- **Renderer:** `mermaid` npm package.
- **Live Preview:** Implement a "Render Loop" that updates the SVG preview with a 500ms debounce.
- **Animation Strategy:** - Use the `sequenceDiagram` and `flowchart` configurations to enable "Hand-drawn" or "Linear" looks.
    - **Step-through Logic:** The UI must allow users to define "steps" or "phases." The frontend will manipulate the CSS `opacity` or `stroke-dashoffset` of SVG elements by their DOM IDs (e.g., `#message1`, `#edge2`) to simulate motion.

---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.



## 3. UI/UX Requirements
- **Split-Pane Layout:** Resizable panes using `react-resizable-panels`.
- **Export Dashboard:** A sidebar to configure GIF settings:
    - FPS (Frames Per Second): 10, 24, 30.
    - Resolution: 720p, 1080p, or Custom.
    - Theme: Dark, Light, Forest, or Neutral.
- **Status Indicators:** Real-time progress bar during the backend "Stitching" phase.

## 4. Best Practices
- **SVG Optimization:** Use `svgo` logic if possible to clean up Mermaid output before sending it to the backend.
- **Error Handling:** Catch Mermaid syntax errors and display them in a "Toast" notification rather than crashing the preview.



# Backend Engineering Standards: GIF Generation Engine

## 1. Core Tech Stack
- **Runtime:** Node.js (High-performance I/O).
- **API:** Express.js or Fastify.
- **Headless Browser:** Puppeteer (for frame capture).
- **Media Processing:** FFmpeg (via `fluent-ffmpeg`) for GIF encoding.

## 2. The Generation Pipeline (The "Engine")
1. **Endpoint:** `POST /api/generate-gif`
2. **Body:** Accepts `{ mermaidCode: string, frames: number, delay: number }`.
3. **Execution Steps:**
    - Launch a **Puppeteer** instance.
    - Inject the Mermaid code into a clean HTML template.
    - **Frame Capture:** Use a loop to toggle SVG element visibility (Step 1, then Step 1+2, etc.) and take a `page.screenshot()` for each state.
    - **Buffer Storage:** Save frames to a temporary `/tmp` directory.
    - **FFmpeg Stitching:** Run FFmpeg command to combine PNGs into a `.gif` with a specific palette for high-quality color (avoiding the "grainy" GIF look).
    - **Cleanup:** Delete temp files immediately after the response is sent.

## 3. Performance & Security
- **Concurrency:** Limit the number of Puppeteer instances to prevent CPU spikes (use a worker pool).
- **Validation:** Sanitize the Mermaid string to prevent XSS/Script injection via the headless browser.
- **Quality:** Use `split` and `palettegen` filters in FFmpeg to ensure the GIF looks professional and crisp.

## 4. Scalability
- Use **Redis/BullMQ** if the process takes longer than 10 seconds, allowing for an "Asynchronous Job" pattern where the user gets a webhook or polling URL.