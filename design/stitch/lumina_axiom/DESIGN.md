# Design System Specification: The Intelligence Layer

## 1. Overview & Creative North Star: "The Digital Curator"
This design system is not a UI kit; it is a cognitive environment. For an AI-native Brand Operating System, the interface must move beyond "tooling" and into "curation." 

**The Creative North Star: The Digital Curator.** 
We reject the cluttered, boxy aesthetic of traditional enterprise software. Instead, we embrace an editorial layout that feels like a premium data-journalism piece. We break the "template" look through:
*   **Intentional Asymmetry:** Using the 12-column grid not as a cage, but as a guide, allowing hero elements to bleed or offset.
*   **Tonal Depth:** Replacing harsh lines with sophisticated layering.
*   **Bilingual Authority:** Seamlessly transitioning between Inter (English) and Tajawal (Arabic) while maintaining the same weight and optical "gravity."

---

## 2. Colors & Surface Philosophy
We operate on a spectrum of "Midnight" depths. The interface should feel like deep space—infinite but structured.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section off content.
In this system, boundaries are defined by background shifts. To separate a sidebar from a main content area, use a transition from `surface` (#0c1321) to `surface_container_low` (#151b2a). Lines create visual noise; tonal shifts create focus.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each "inner" container should move up or down the tier to define its importance:
*   **Base:** `surface` (#0c1321)
*   **Secondary Sections:** `surface_container_low` (#151b2a)
*   **Active Cards/Modals:** `surface_container_high` (#232a39)
*   **Floating AI Elements:** `surface_bright` (#323949) with 80% opacity and 20px Backdrop Blur.

### The "Glass & Gradient" Rule
To signify "Intelligence," AI-driven components (like insights or assistant bubbles) should utilize **Glassmorphism**. 
*   **Fill:** `surface_variant` (#2e3544) at 60% opacity.
*   **Effect:** `Backdrop-filter: blur(12px)`.
*   **Accent:** Use a subtle linear gradient from `primary_container` (#2563eb) to `secondary_container` (#03b5d3) at 15% opacity as a background overlay to provide a "pulsing" soul to AI sections.

---

### 3. Typography: Editorial Authority
Typography is our primary tool for hierarchy. We use a high-contrast scale to ensure "The Digital Curator" feel.

| Role | Token | Font (EN/AR) | Size | Case/Style |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | Inter / Tajawal | 3.5rem | Tight Tracking (-0.02em) |
| **Headline**| `headline-md`| Inter / Tajawal | 1.75rem | Medium Weight |
| **Title**   | `title-lg`   | Inter / Tajawal | 1.375rem | Semi-Bold |
| **Body**    | `body-md`    | Inter / Tajawal | 0.875rem | Regular, Line-height 1.6 |
| **Label**   | `label-sm`   | Inter / Tajawal | 0.6875rem| Uppercase (EN only), Tracking +0.05 |

**Bilingual Strategy:** 
Tajawal is naturally taller than Inter. When rendering RTL layouts, increase the `line-height` by 15% across all tokens to maintain the same visual "breathability" as the English counterpart.

---

## 4. Elevation & Depth: Tonal Layering
We move away from the "shadow-heavy" look of 2010s SaaS. Depth is achieved through the **Layering Principle**.

*   **The Layering Principle:** Place a `surface_container_lowest` (#070e1c) card onto a `surface_container` (#19202e) background. This "sinking" effect creates a natural container without a single pixel of stroke.
*   **Ambient Shadows:** For floating elements (Modals/Popovers), use a "Deep Sea Shadow":
    *   `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);`
*   **The Ghost Border Fallback:** If a border is required for accessibility, use `outline_variant` (#434655) at **15% opacity**. It should feel felt, not seen.

---

## 5. Components

### Cards & Data Containers
*   **Styling:** Sharp edges with `rounded-md` (0.375rem) corners. High-end enterprise feels "engineered," not "bubbly."
*   **Spacing:** Use `spacing-6` (1.5rem) as the default internal padding.
*   **Rule:** Forbid divider lines. Use `spacing-4` (1rem) of vertical whitespace or a subtle background shift to `surface_container_low` to separate header from body.

### Buttons: The Kinetic Action
*   **Primary:** Background `primary_container` (#2563eb), Text `on_primary_container`. No border.
*   **Secondary (The Glass Button):** `surface_bright` at 20% opacity, Backdrop Blur 8px.
*   **States:** On hover, primary buttons should transition to `secondary` (#4cd7f6) for a high-contrast "glow" effect.

### Integrated AI Assistant Elements
*   **The "Insight" Chip:** A small, floating chip using `tertiary_container` (#007d55). It should always have a subtle glow (`box-shadow: 0 0 15px rgba(78, 222, 163, 0.3)`).
*   **The AI Sidebar:** Use `surface_container_lowest` (#070e1c) to create a "void" effect on the right (LTR) or left (RTL), signaling a space where the machine is thinking.

### Inputs & Refined Fields
*   **Idle:** `surface_container_highest` (#2e3544) with no border. 
*   **Focus:** A 1px "Ghost Border" of `primary` (#b4c5ff) at 50% opacity and a subtle inner glow.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetric Padding:** Allow for more whitespace on the leading side of a layout (Left for LTR, Right for RTL) to create a "starting point" for the eye.
*   **Embrace "Ink-Trap" logic:** Use `label-sm` sparingly and ensure high contrast against the background using `on_surface_variant` (#c3c6d7).
*   **Mirror Everything:** Ensure that logic flows perfectly. If a sidebar is fixed to the start in LTR, it must be fixed to the start in RTL.

### Don't:
*   **Don't use 100% Black:** Never use #000000. Use `surface_container_lowest` (#070e1c) to keep the "Midnight" brand soul.
*   **Don't use 1px Dividers:** This is the most important rule. If you feel you need a line, use a 4px gap of background color instead.
*   **Don't mix Corner Radii:** Stick strictly to `md` (0.375rem) for cards and `full` for chips. Consistency in "sharpness" is the key to an enterprise feel.