import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const KERF = 0.125; // table saw kerf in inches
const SAND_LOSS = 0.0625; // per face sanding pass
const SQUARE_LOSS = 0.25; // trimming one end square

const WOODS = {
  W:  { name: "Walnut",         color: "#3d2510", grain: "#2e1a0a", endGrain: "#4a2f1a", price: 22, hardness: 1010 },
  HM: { name: "Hard Maple",     color: "#ddd0a8", grain: "#c8b888", endGrain: "#e8d8b4", price: 8,  hardness: 1450 },
  AM: { name: "Ambrosia Maple", color: "#c4a46a", grain: "#a8885a", endGrain: "#ccae78", price: 10, hardness: 1450 },
  Ch: { name: "Cherry",         color: "#7a2e14", grain: "#621f0a", endGrain: "#8b3820", price: 14, hardness: 950  },
  WO: { name: "White Oak",      color: "#c0a060", grain: "#a88840", endGrain: "#ccaa6a", price: 12, hardness: 1360 },
  PH: { name: "Purpleheart",    color: "#4e2460", grain: "#3d1850", endGrain: "#5c2e72", price: 28, hardness: 1860 },
  Pd: { name: "Padauk",         color: "#aa3808", grain: "#882800", endGrain: "#b84010", price: 24, hardness: 1725 },
  SM: { name: "Soft Maple",     color: "#eadcb8", grain: "#d4c89c", endGrain: "#f0e4c4", price: 6,  hardness: 950  },
  Teak:{ name: "Teak",          color: "#9a7840", grain: "#806030", endGrain: "#a88448", price: 32, hardness: 1000 },
  Bub: { name: "Bubinga",       color: "#6a2020", grain: "#581818", endGrain: "#782828", price: 26, hardness: 1980 },
};

// ─── Templates ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "weave_classic",
    name: "Classic Weave",
    tag: "Beginner",
    tagColor: "#2a6b3a",
    desc: "The signature walnut + maple weave. Great first end-grain project.",
    thumb: [["W",0.25],["HM",1],["W",0.25],["AM",1.5]],
    config: {
      method: "weave", pattern: ".25W 1HM .25W 1.5AM",
      boardW: 10.5, boardH: 16.5, thickness: 1.5,
    }
  },
  {
    id: "checkerboard_2",
    name: "Classic Checkerboard",
    tag: "Intermediate",
    tagColor: "#6b4a10",
    desc: "True end-grain checkerboard. Two glue-ups, two crosscuts.",
    thumb: [["W",1],["HM",1]],
    config: {
      method: "checkerboard", pattern: "1W 1HM",
      boardW: 12, boardH: 12, thickness: 1.5,
    }
  },
  {
    id: "checkerboard_3",
    name: "Tri-Color Checker",
    tag: "Intermediate",
    tagColor: "#6b4a10",
    desc: "Three-species checkerboard with a richer visual field.",
    thumb: [["W",1],["HM",1],["Ch",1]],
    config: {
      method: "checkerboard", pattern: "1W 1HM 1Ch",
      boardW: 12, boardH: 18, thickness: 1.5,
    }
  },
  {
    id: "end_grain_stripe",
    name: "End-Grain Stripe",
    tag: "Beginner",
    tagColor: "#2a6b3a",
    desc: "Clean parallel stripes in end grain. Minimal glue-ups, elegant result.",
    thumb: [["W",0.5],["HM",2],["W",0.5]],
    config: {
      method: "stripe", pattern: ".5W 2HM .5W",
      boardW: 9, boardH: 14, thickness: 1.5,
    }
  },
  {
    id: "herringbone",
    name: "Herringbone",
    tag: "Advanced",
    tagColor: "#6b1a1a",
    desc: "45° alternating strips. Requires miter cuts and careful alignment.",
    thumb: [["W",0.75],["AM",0.75],["HM",0.75]],
    config: {
      method: "herringbone", pattern: ".75W .75AM .75HM",
      boardW: 12, boardH: 16, thickness: 1.5,
    }
  },
  {
    id: "face_grain_butcher",
    name: "Butcher Block",
    tag: "Beginner",
    tagColor: "#2a6b3a",
    desc: "Face-grain edge-joined strips. Fastest build, great for large boards.",
    thumb: [["HM",2],["W",1],["HM",2],["AM",1.5]],
    config: {
      method: "face_grain", pattern: "2HM 1W 2HM 1.5AM",
      boardW: 14, boardH: 20, thickness: 1.75,
    }
  },
  {
    id: "purpleheart_accent",
    name: "Purpleheart Accent",
    tag: "Intermediate",
    tagColor: "#6b4a10",
    desc: "Bold color contrast using purpleheart as a thin accent line.",
    thumb: [["PH",0.25],["SM",1.5],["PH",0.25],["HM",2]],
    config: {
      method: "weave", pattern: ".25PH 1.5SM .25PH 2HM",
      boardW: 11, boardH: 17, thickness: 1.5,
    }
  },
  {
    id: "padauk_fire",
    name: "Padauk Fire",
    tag: "Advanced",
    tagColor: "#6b1a1a",
    desc: "High-contrast padauk and maple. Stunning end grain when finished.",
    thumb: [["Pd",0.5],["HM",1],["Pd",0.25],["SM",1.5]],
    config: {
      method: "weave", pattern: ".5Pd 1HM .25Pd 1.5SM",
      boardW: 10, boardH: 16, thickness: 1.5,
    }
  },
];

// ─── Simulation Engine ────────────────────────────────────────────────────────
function parsePattern(str) {
  const tokens = str.trim().split(/\s+/);
  const result = [];
  for (const tok of tokens) {
    const m = tok.match(/^([\d.]+)([A-Za-z]+)$/);
    if (!m) continue;
    const w = parseFloat(m[1]);
    const abbr = Object.keys(WOODS).find(k => k.toLowerCase() === m[2].toLowerCase());
    if (abbr && w > 0) result.push({ width: w, key: abbr });
  }
  return result;
}

function repeatStrips(strips, targetW) {
  if (!strips.length) return [];
  const patW = strips.reduce((s, st) => s + st.width, 0);
  const result = [];
  let x = 0;
  while (x < targetW + patW) {
    for (const st of strips) {
      result.push({ ...st, _startX: x });
      x += st.width;
    }
  }
  return result;
}

// Each stage returns { label, desc, panels: [{cells, w, h, label}], notes }
// cells: [{x, y, w, h, key, endGrain}]
function runSimulation(strips, method, boardW, boardH, thickness, stash) {
  if (!strips.length) return [];
  const patW = strips.reduce((s, st) => s + st.width, 0);
  if (patW <= 0) return [];

  const stages = [];
  const millThick = thickness + 0.175;
  const panelLen = boardH + 3;

  // Helper: build face-grain panel cells (strips run vertically, face grain shown)
  function facePanel(w, h, theStrips) {
    const cells = [];
    let x = 0;
    for (const st of repeatStrips(theStrips, w)) {
      const sw = Math.min(st.width, w - x);
      if (sw <= 0) break;
      cells.push({ x, y: 0, w: sw, h, key: st.key, endGrain: false });
      x += st.width;
      if (x >= w) break;
    }
    return cells;
  }

  // Helper: end-grain cell grid from a horizontal slice of panel
  function endGrainSlice(panelStrips, panelW, sliceH) {
    const cells = [];
    let x = 0;
    for (const st of repeatStrips(panelStrips, panelW)) {
      const sw = Math.min(st.width, panelW - x);
      if (sw <= 0) break;
      cells.push({ x, y: 0, w: sw, h: sliceH, key: st.key, endGrain: true });
      x += st.width;
      if (x >= panelW) break;
    }
    return cells;
  }

  if (method === "stripe") {
    // Stage 1: Milled stock
    const stockCells = strips.map((st, i) => ({
      x: i * 3, y: 0, w: 2.5, h: panelLen, key: st.key, endGrain: false
    }));
    stages.push({
      label: "Stage 1 — Mill & Rip Stock",
      desc: `Mill all species to ${millThick.toFixed(3)}" thickness. Rip strips to width. Panel will be ~${panelLen.toFixed(1)}" long.`,
      panels: [{ cells: facePanel(patW * 2.5, panelLen, strips), w: patW * 2.5, h: panelLen, label: "Milled strips (face grain)" }],
      notes: [`Kerf per rip cut: ${KERF}"`, `Sanding loss per face: ${SAND_LOSS}"`],
      losses: { kerf: KERF * strips.length, sanding: SAND_LOSS * 2 }
    });

    // Stage 2: Face glue-up
    const glueW = boardW + 0.5;
    stages.push({
      label: "Stage 2 — Face Glue-Up",
      desc: `Edge-glue strips into a ${glueW.toFixed(1)}" × ${panelLen.toFixed(1)}" panel. Cauls top and bottom to prevent bowing.`,
      panels: [{ cells: facePanel(glueW, panelLen, strips), w: glueW, h: panelLen, label: `Glued panel — ${glueW.toFixed(1)}" × ${panelLen.toFixed(1)}"` }],
      notes: ["Alternate clamp direction to prevent cupping", "Cure 60 min minimum before removing clamps"],
      losses: {}
    });

    // Stage 3: Flatten
    const flatH = panelLen - SAND_LOSS * 2;
    stages.push({
      label: "Stage 3 — Flatten Panel",
      desc: `Drum sand both faces. Remove ${SAND_LOSS}" per face → panel now ${(millThick - SAND_LOSS*2).toFixed(3)}" thick.`,
      panels: [{ cells: facePanel(glueW, flatH, strips), w: glueW, h: flatH, label: "Flattened panel" }],
      notes: [`Thickness after sanding: ${(millThick - SAND_LOSS * 2).toFixed(3)}"`, "Check flatness with straightedge — must be dead flat before crosscutting"],
      losses: { sanding: SAND_LOSS * 2 }
    });

    // Stage 4: Crosscut slices
    const numSlices = Math.ceil(boardH / thickness);
    const sliceThick = thickness + KERF;
    const sliceCells = endGrainSlice(strips, boardW, thickness);
    stages.push({
      label: `Stage 4 — Crosscut ${numSlices} End-Grain Slices`,
      desc: `Square one end (lose ${SQUARE_LOSS}"), then crosscut ${numSlices} slices at ${(thickness + 0.05).toFixed(2)}" each. Each slice loses ${KERF}" to kerf.`,
      panels: [
        { cells: sliceCells, w: boardW, h: thickness, label: `Slice (end grain) — ${boardW}" × ${thickness}"` },
        { cells: sliceCells, w: boardW, h: thickness, label: `×${numSlices} identical slices` },
      ],
      notes: [`Kerf per cut: ${KERF}"`, `Total panel length consumed: ${(numSlices * (thickness + KERF) + SQUARE_LOSS).toFixed(2)}"`, "Label slices 1–" + numSlices + " to maintain order"],
      losses: { kerf: KERF * numSlices, squaring: SQUARE_LOSS }
    });

    // Stage 5: Final glue-up
    const finalCells = [];
    for (let i = 0; i < numSlices; i++) {
      sliceCells.forEach(c => finalCells.push({ ...c, y: i * thickness, h: Math.min(thickness, boardH - i * thickness) }));
    }
    stages.push({
      label: "Stage 5 — Final Glue-Up",
      desc: `Glue all ${numSlices} end-grain slices together. Cure 24 hours. End grain requires full cure time.`,
      panels: [{ cells: finalCells, w: boardW, h: boardH, label: `Assembled board — ${boardW}" × ${boardH}"` }],
      notes: ["Use wax paper under cauls to prevent glue-up to bench", "Work in halves for large boards to stay within glue open time"],
      losses: {}
    });

    // Stage 6: Final
    const finalW = boardW - SAND_LOSS;
    const finalBoardH = boardH - SAND_LOSS;
    stages.push({
      label: "Stage 6 — Sand, Trim & Finish",
      desc: `Drum sand 80→120→180→220. Trim to ${boardW}" × ${boardH}". Chamfer edges. 4–5 coats mineral oil.`,
      panels: [{ cells: finalCells, w: boardW, h: boardH, label: `✓ Final board — ${boardW}" × ${boardH}" × ${thickness}"` }],
      notes: ["End grain drinks oil — 1st coat will absorb quickly", "Warm mineral oil penetrates better", "Finish with beeswax board cream"],
      losses: { sanding: SAND_LOSS * 2, trimming: SAND_LOSS }
    });

  } else if (method === "weave") {
    const numSlices = Math.ceil(boardH / thickness);

    // Stage 1: Mill
    stages.push({
      label: "Stage 1 — Mill & Rip Stock",
      desc: `Mill all species to ${millThick.toFixed(3)}". Rip strips per pattern. Panel length: ${panelLen.toFixed(1)}".`,
      panels: [{ cells: facePanel(patW * 2, panelLen, strips), w: patW * 2, h: panelLen, label: "Milled strips" }],
      notes: [`Pattern repeat: ${patW.toFixed(2)}"`, `Strips needed across ${boardW}": ~${Math.ceil(boardW / patW)} repeats`],
      losses: { kerf: KERF * strips.length }
    });

    // Stage 2: Face glue-up
    const glueW = boardW + 0.5;
    stages.push({
      label: "Stage 2 — Face Glue-Up",
      desc: `Edge-glue strips into a ${glueW.toFixed(1)}" × ${panelLen.toFixed(1)}" panel.`,
      panels: [{ cells: facePanel(glueW, panelLen, strips), w: glueW, h: panelLen, label: `Glued panel — ${glueW.toFixed(1)}" × ${panelLen.toFixed(1)}"` }],
      notes: ["Cauls top and bottom", "Cure 60 min minimum"],
      losses: {}
    });

    // Stage 3: Flatten
    stages.push({
      label: "Stage 3 — Flatten Panel",
      desc: `Drum sand both faces. Final thickness: ${(millThick - SAND_LOSS * 2).toFixed(3)}".`,
      panels: [{ cells: facePanel(glueW, panelLen - 0.1, strips), w: glueW, h: panelLen - 0.1, label: "Flattened panel" }],
      notes: ["Dead flat is critical — any taper = wedge-shaped slices"],
      losses: { sanding: SAND_LOSS * 2 }
    });

    // Stage 4: Crosscut slices
    const sliceCellsNormal = endGrainSlice(strips, boardW, thickness);
    const sliceCellsFlipped = endGrainSlice([...strips].reverse(), boardW, thickness);
    stages.push({
      label: `Stage 4 — Crosscut ${numSlices} Slices`,
      desc: `Crosscut ${numSlices} slices at ${(thickness + 0.05).toFixed(2)}" each. Label 1–${numSlices}. The weave comes from what happens next.`,
      panels: [
        { cells: sliceCellsNormal, w: boardW, h: thickness, label: "Even slices (normal)" },
        { cells: sliceCellsFlipped, w: boardW, h: thickness, label: "Odd slices (will flip 180°)" },
      ],
      notes: [`${KERF}" kerf per cut`, `Square one end first (lose ${SQUARE_LOSS}")`],
      losses: { kerf: KERF * numSlices, squaring: SQUARE_LOSS }
    });

    // Stage 5: Rotate & dry-fit
    const weaveCells = [];
    for (let i = 0; i < numSlices; i++) {
      const flipped = i % 2 === 1;
      const src = flipped ? sliceCellsFlipped : sliceCellsNormal;
      src.forEach(c => weaveCells.push({ ...c, y: i * thickness, h: Math.min(thickness, boardH - i * thickness) }));
    }
    stages.push({
      label: "Stage 5 — Rotate Alternating Slices 180°",
      desc: `Flip every other slice end-for-end. The reversed strip order offsets against the normal slices, creating the interlocking weave. Dry-fit all ${numSlices} slices and photograph before gluing.`,
      panels: [{ cells: weaveCells, w: boardW, h: boardH, label: `Dry-fit arrangement — weave visible` }],
      notes: ["Take a photo of the dry-fit arrangement", "Mark the top face on each slice before gluing"],
      losses: {}
    });

    // Stage 6: Final glue-up
    stages.push({
      label: "Stage 6 — Final Glue-Up",
      desc: `Glue all ${numSlices} slices in alternating orientation. Work in halves. Cure 24 hours.`,
      panels: [{ cells: weaveCells, w: boardW, h: boardH, label: `Assembled board — ${boardW}" × ${boardH}"` }],
      notes: ["Titebond III open time ~8 min — pre-set all clamps", "Wax paper under cauls"],
      losses: {}
    });

    // Stage 7: Final
    stages.push({
      label: "Stage 7 — Sand, Trim & Finish",
      desc: `Sand 80→120→180→220. Trim to ${boardW}" × ${boardH}". Chamfer. 4–5 coats mineral oil + beeswax.`,
      panels: [{ cells: weaveCells, w: boardW, h: boardH, label: `✓ Final board — ${boardW}" × ${boardH}" × ${thickness}"` }],
      notes: ["Warm oil for better end-grain penetration", "Finish with beeswax board cream", "Cure 24–48 hrs before use"],
      losses: { sanding: SAND_LOSS * 2 }
    });

  } else if (method === "checkerboard") {
    const sqSize = strips[0]?.width ?? 1;
    const cols = Math.round(boardW / sqSize);
    const rows = Math.round(boardH / sqSize);
    const numSlices1 = Math.ceil(boardW / sqSize);

    // Stage 1: Mill
    stages.push({
      label: "Stage 1 — Mill & Rip Stock",
      desc: `Mill all species to ${millThick.toFixed(3)}". Rip strips to ${sqSize}" wide — this is your checker square size. Panel length: ${(boardH + 3).toFixed(1)}".`,
      panels: [{ cells: facePanel(patW * 2, boardH + 3, strips), w: patW * 2, h: boardH + 3, label: "Milled strips (face grain)" }],
      notes: [`Square size = strip width = ${sqSize}"`, `Each crosscut slice must also be ${sqSize}" thick for squares to work`],
      losses: { kerf: KERF * strips.length }
    });

    // Stage 2: Glue-up #1 — striped panel
    const stripeW = boardW + 0.5;
    stages.push({
      label: "Stage 2 — Glue-Up #1 (Striped Panel)",
      desc: `Edge-glue alternating strips into a ${stripeW.toFixed(1)}" × ${(boardH+3).toFixed(1)}" striped panel.`,
      panels: [{ cells: facePanel(stripeW, boardH + 3, strips), w: stripeW, h: boardH + 3, label: `Striped panel — ${stripeW.toFixed(1)}" × ${(boardH+3).toFixed(1)}"` }],
      notes: ["Cauls top and bottom", "Cure 60 min"],
      losses: {}
    });

    // Stage 3: Flatten #1
    stages.push({
      label: "Stage 3 — Flatten Panel #1",
      desc: "Drum sand both faces flat. Verify with straightedge.",
      panels: [{ cells: facePanel(stripeW, boardH + 3, strips), w: stripeW, h: boardH + 3, label: "Flattened striped panel" }],
      notes: [`Thickness: ${(millThick - SAND_LOSS * 2).toFixed(3)}"`, "Square and measure before cutting slices"],
      losses: { sanding: SAND_LOSS * 2 }
    });

    // Stage 4: Crosscut slices #1
    const stripeCells = endGrainSlice(strips, stripeW, sqSize);
    const stripeFlipped = endGrainSlice([...strips].reverse(), stripeW, sqSize);
    stages.push({
      label: `Stage 4 — Crosscut Slices at ${sqSize}" (Kerf: ${KERF}")`,
      desc: `CRITICAL: Crosscut slices at exactly ${sqSize}" — same as strip width. This is what makes squares, not rectangles. ${numSlices1} slices total.`,
      panels: [
        { cells: stripeCells, w: stripeW, h: sqSize, label: `Slice A — ${stripeW.toFixed(1)}" × ${sqSize}"` },
        { cells: stripeFlipped, w: stripeW, h: sqSize, label: "Slice B (will rotate 90°)" },
      ],
      notes: [
        `Slice thickness MUST equal strip width (${sqSize}")`,
        `Actual cut: ${(sqSize + KERF).toFixed(3)}" to account for kerf`,
        `${KERF}" per cut × ${numSlices1} cuts = ${(KERF * numSlices1).toFixed(3)}" total kerf loss`
      ],
      losses: { kerf: KERF * numSlices1, squaring: SQUARE_LOSS }
    });

    // Stage 5: Rotate 90°
    const checkCells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (c + r) % strips.length;
        const key = strips[idx].key;
        checkCells.push({
          x: c * sqSize, y: r * sqSize,
          w: Math.min(sqSize, boardW - c * sqSize),
          h: Math.min(sqSize, boardH - r * sqSize),
          key, endGrain: false
        });
      }
    }
    stages.push({
      label: "Stage 5 — Rotate Alternating Slices 90°",
      desc: "Rotate every other slice 90° so stripes run perpendicular. When laid side by side, the checker pattern appears on the face. Dry-fit and verify before gluing.",
      panels: [{ cells: checkCells, w: boardW, h: boardH, label: "Checker pattern visible — dry fit" }],
      notes: ["Photograph the dry-fit", "The checker is visible on the face — end grain is what you'll see after the final crosscut"],
      losses: {}
    });

    // Stage 6: Glue-up #2
    stages.push({
      label: "Stage 6 — Glue-Up #2 (Checker Panel)",
      desc: "Glue all rotated slices together. The checker pattern is now locked in. Cure 24 hours.",
      panels: [{ cells: checkCells, w: boardW, h: boardH, label: `Checker panel — ${boardW}" × ${boardH}"` }],
      notes: ["This panel will be crosscut again — checker becomes end grain", "Cure 24 hours — don't rush this step"],
      losses: {}
    });

    // Stage 7: Flatten #2
    stages.push({
      label: "Stage 7 — Flatten Panel #2",
      desc: "Flatten the checker panel before the final crosscut. Both faces must be parallel.",
      panels: [{ cells: checkCells, w: boardW, h: boardH, label: "Flattened checker panel" }],
      notes: [`Final thickness after sanding: ${(millThick - SAND_LOSS*4).toFixed(3)}"`, "Measure thickness at corners — must be consistent"],
      losses: { sanding: SAND_LOSS * 2 }
    });

    // Stage 8: Final crosscut
    const finalSliceH = thickness;
    const endCheckCells = [];
    for (let r2 = 0; r2 < rows; r2++) {
      for (let c2 = 0; c2 < cols; c2++) {
        const idx = (c2 + r2) % strips.length;
        endCheckCells.push({
          x: c2 * sqSize, y: r2 * sqSize,
          w: Math.min(sqSize, boardW - c2 * sqSize),
          h: Math.min(sqSize, boardH - r2 * sqSize),
          key: strips[idx].key, endGrain: true
        });
      }
    }
    const numFinalSlices = Math.ceil(boardH / thickness);
    stages.push({
      label: `Stage 8 — Final Crosscut at ${thickness}" (End-Grain Faces)`,
      desc: `Crosscut the checker panel into ${numFinalSlices} slices at ${thickness}". NOW the end grain is exposed — you'll see the true checker end-grain pattern on both faces.`,
      panels: [
        { cells: endCheckCells, w: boardW, h: thickness, label: `End-grain slice — ${boardW}" × ${thickness}"` },
      ],
      notes: [`${numFinalSlices} slices × ${thickness}" = ${(numFinalSlices * thickness).toFixed(1)}" assembled length`, "End grain checker pattern now fully visible"],
      losses: { kerf: KERF * numFinalSlices }
    });

    // Stage 9: Final assembly
    const assembledCells = [];
    for (let si = 0; si < numFinalSlices; si++) {
      endCheckCells.forEach(c => assembledCells.push({
        ...c, y: si * thickness + (c.y / boardH * thickness),
        h: c.h / boardH * thickness
      }));
    }
    stages.push({
      label: "Stage 9 — Final Glue-Up & Assembly",
      desc: `Glue all ${numFinalSlices} end-grain slices together. Cure 24 hours. Then flatten, sand 80→120→180→220, trim to final ${boardW}" × ${boardH}", and finish.`,
      panels: [{ cells: endCheckCells, w: boardW, h: boardH, label: `✓ Final board — ${boardW}" × ${boardH}" × ${thickness}" (end grain checker)` }],
      notes: ["4–5 coats mineral oil", "The end grain checker will be vivid after oiling", "Cure 24–48 hrs before use"],
      losses: { sanding: SAND_LOSS * 2 }
    });

  } else if (method === "face_grain") {
    stages.push({
      label: "Stage 1 — Mill Stock",
      desc: `Mill all species to ${(thickness + 0.125).toFixed(3)}" thickness. Face grain construction — faster than end grain.`,
      panels: [{ cells: facePanel(patW * 2, 20, strips), w: patW * 2, h: 20, label: "Milled stock" }],
      notes: ["Face grain shows long wood figure, not end grain rings"],
      losses: { kerf: KERF * strips.length }
    });
    stages.push({
      label: "Stage 2 — Edge-Join & Glue-Up",
      desc: `Glue strips edge to edge to achieve ${boardW}" width. Cauls top and bottom. Cure 60 min.`,
      panels: [{ cells: facePanel(boardW, boardH, strips), w: boardW, h: boardH, label: `Face grain panel — ${boardW}" × ${boardH}"` }],
      notes: ["Use biscuits or dowels to aid alignment", "Alternate grain direction to minimize warping"],
      losses: {}
    });
    stages.push({
      label: "Stage 3 — Flatten, Trim & Finish",
      desc: `Flatten with drum sander or hand plane. Trim to ${boardW}" × ${boardH}". Sand 80→120→180→220. Oil finish.`,
      panels: [{ cells: facePanel(boardW, boardH, strips), w: boardW, h: boardH, label: `✓ Final board — ${boardW}" × ${boardH}" × ${thickness}"` }],
      notes: ["Face grain requires fewer oil coats than end grain", "Add rubber feet to protect counters"],
      losses: { sanding: SAND_LOSS * 2 }
    });

  } else if (method === "herringbone") {
    stages.push({
      label: "Stage 1 — Mill & Miter Stock",
      desc: `Mill all species to ${millThick.toFixed(3)}". Miter strips at 45° on both ends to create the herringbone angle. Each strip: ${patW.toFixed(2)}" wide.`,
      panels: [{ cells: facePanel(patW * 2, boardH, strips), w: patW * 2, h: boardH, label: "Mitered strips" }],
      notes: ["45° miter requires a reliable miter sled or miter saw setup", "Cut pairs: mirror-image miters for the V shape", "Add 10–15% extra material for miter waste"],
      losses: { miter: patW * 0.15 }
    });
    stages.push({
      label: "Stage 2 — Glue-Up in V-Pairs",
      desc: "Glue mirror-image strip pairs together first to form the V units. Then glue V units side by side.",
      panels: [{ cells: facePanel(boardW, boardH, strips), w: boardW, h: boardH, label: "Herringbone panel (approximate)" }],
      notes: ["Glue V-pairs first to keep alignment manageable", "Cauls must be parallel to miter angle"],
      losses: {}
    });
    stages.push({
      label: "Stage 3 — Crosscut End-Grain Slices & Finish",
      desc: `Flatten panel, crosscut ${Math.ceil(boardH/thickness)} end-grain slices at ${thickness}". Glue up, flatten, sand, finish.`,
      panels: [{ cells: facePanel(boardW, boardH, strips), w: boardW, h: boardH, label: `✓ Final board — ${boardW}" × ${boardH}" × ${thickness}"` }],
      notes: ["Herringbone end grain is striking but complex to execute cleanly", "Take extra care with alignment before final glue-up"],
      losses: { sanding: SAND_LOSS * 2 }
    });
  }

  return stages;
}

// ─── Materials Calculator ─────────────────────────────────────────────────────
function calcMaterials(strips, method, boardW, boardH, thickness) {
  if (!strips.length) return [];
  const patW = strips.reduce((s, st) => s + st.width, 0);
  const panelLen = boardH + 3;
  const millThick = thickness + 0.175;
  const repeats = Math.ceil(boardW / patW);
  const wasteMult = method === "checkerboard" ? 1.45 : method === "herringbone" ? 1.35 : 1.2;
  const byKey = {};
  for (const st of strips) {
    const vol = st.width * repeats * panelLen * millThick;
    byKey[st.key] = (byKey[st.key] || 0) + vol;
  }
  return Object.entries(byKey).map(([key, vol]) => {
    const fbm = (vol / 144) * wasteMult;
    return { key, fbm, cost: fbm * WOODS[key].price };
  });
}

// ─── Stash Manager ────────────────────────────────────────────────────────────
function calcStashCoverage(stash, materials) {
  return materials.map(m => {
    const owned = stash.filter(s => s.key === m.key).reduce((sum, s) => sum + s.fbm, 0);
    return { ...m, owned, sufficient: owned >= m.fbm, gap: Math.max(0, m.fbm - owned) };
  });
}

// ─── Board Canvas ─────────────────────────────────────────────────────────────
function BoardCanvas({ cells, boardW, boardH, pixelW = 280, mini = false }) {
  const canvasRef = useRef();
  const scale = pixelW / boardW;
  const pixelH = Math.round(boardH * scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, pixelW, pixelH);

    for (const cell of cells) {
      const wood = WOODS[cell.key];
      if (!wood) continue;
      const cx = cell.x * scale, cy = cell.y * scale;
      const cw = Math.max(1, cell.w * scale), ch = Math.max(1, cell.h * scale);
      const baseColor = cell.endGrain ? wood.endGrain : wood.color;

      ctx.fillStyle = baseColor;
      ctx.fillRect(cx, cy, cw, ch);

      if (!mini) {
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = cell.endGrain ? wood.endGrain : wood.grain;
        ctx.lineWidth = 0.6;
        if (cell.endGrain) {
          // Concentric ring suggestion for end grain
          for (let ring = 2; ring < Math.min(cw, ch) / 2; ring += 3) {
            ctx.beginPath();
            ctx.arc(cx + cw/2, cy + ch/2, ring, 0, Math.PI*2);
            ctx.stroke();
          }
        } else {
          for (let g = 0; g < cw; g += 3.5) {
            ctx.beginPath();
            ctx.moveTo(cx + g, cy);
            ctx.lineTo(cx + g + 1.5, cy + ch);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cx + 0.25, cy + 0.25, cw - 0.5, ch - 0.5);
    }

    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, pixelW - 2, pixelH - 2);

    const grad = ctx.createRadialGradient(pixelW/2, pixelH/2, pixelH*0.2, pixelW/2, pixelH/2, pixelH*0.75);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, pixelW, pixelH);
  }, [cells, boardW, boardH, pixelW, pixelH, scale, mini]);

  return (
    <canvas ref={canvasRef} width={pixelW} height={pixelH}
      style={{ borderRadius: mini ? 4 : 6, display: "block", maxWidth: "100%", height: "auto" }} />
  );
}

// ─── Template Thumbnail ───────────────────────────────────────────────────────
function TemplateThumbnail({ strips, method }) {
  const cells = useMemo(() => {
    if (!strips.length) return [];
    const bW = 6, bH = 8, thick = 1.5;
    return runSimulation(strips, method, bW, bH, thick, []).slice(-1)[0]?.panels[0]?.cells ?? [];
  }, [strips, method]);
  return <BoardCanvas cells={cells} boardW={6} boardH={8} pixelW={72} mini />;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const S = {
  bg: "#141210", bg2: "#1e1a14", bg3: "#272018", bg4: "#302818",
  text: "#f0e6d3", dim: "#a89278", muted: "#6e5a40",
  accent: "#c8a97a", gold: "#e8c870", border: "#3a2e1e", walnut: "#6b4226",
  green: "#2a6b3a", amber: "#6b4a10", red: "#6b1a1a",
};

const sec = (label) => (
  <div style={{ fontSize: 9, letterSpacing:"0.22em", textTransform:"uppercase", color: S.accent, marginBottom: 10, display:"flex", alignItems:"center", gap: 8 }}>
    {label}<div style={{ flex:1, height:1, background: S.border }}/>
  </div>
);

const card = (children, style={}) => (
  <div style={{ background: S.bg2, border:`1px solid ${S.border}`, borderRadius:8, padding:14, marginBottom:14, ...style }}>
    {children}
  </div>
);

export default function App() {
  const [view, setView] = useState("templates"); // templates | simulator
  const [activeTab, setActiveTab] = useState("simulate");
  const [config, setConfig] = useState(TEMPLATES[0].config);
  const [patternStr, setPatternStr] = useState(TEMPLATES[0].config.pattern);
  const [stash, setStash] = useState([]);
  const [stashInput, setStashInput] = useState({ key: "W", fbm: 2 });
  const [stageIdx, setStageIdx] = useState(0);
  const [patErr, setPatErr] = useState("");

  const strips = useMemo(() => {
    const p = parsePattern(patternStr);
    setPatErr(p.length === 0 && patternStr.trim() ? "Can't parse pattern" : "");
    return p;
  }, [patternStr]);

  const stages = useMemo(() =>
    runSimulation(strips, config.method, config.boardW, config.boardH, config.thickness, stash),
    [strips, config, stash]
  );

  const materials = useMemo(() =>
    calcMaterials(strips, config.method, config.boardW, config.boardH, config.thickness),
    [strips, config]
  );

  const coverage = useMemo(() => calcStashCoverage(stash, materials), [stash, materials]);

  const totalCost = materials.reduce((s, m) => s + m.cost, 0) + 15;

  const currentStage = stages[stageIdx] ?? null;

  const loadTemplate = (t) => {
    setConfig(t.config);
    setPatternStr(t.config.pattern);
    setStageIdx(0);
    setView("simulator");
    setActiveTab("simulate");
  };

  const update = (key, val) => {
    setConfig(c => ({ ...c, [key]: val }));
    setStageIdx(0);
  };

  useEffect(() => { setStageIdx(0); }, [config.method, patternStr]);

  const patW = strips.reduce((s, st) => s + st.width, 0);

  // ── TEMPLATES VIEW ──────────────────────────────────────────────────────────
  if (view === "templates") return (
    <div style={{ background: S.bg, minHeight:"100vh", color: S.text, fontFamily:"'DM Mono','Courier New',monospace", paddingBottom:48 }}>
      <div style={{ borderBottom:`1px solid ${S.border}`, padding:"22px 18px 16px", background:"linear-gradient(180deg,#1c1610,#141210)" }}>
        <div style={{ fontSize:9, letterSpacing:"0.25em", textTransform:"uppercase", color: S.walnut, marginBottom:5 }}>Greenville Woodworkers Guild</div>
        <div style={{ fontFamily:"Georgia,serif", fontSize:26, fontWeight:700, lineHeight:1.1 }}>
          Cutting Board<br/><span style={{ color: S.accent }}>Simulator</span>
        </div>
        <div style={{ fontSize:11, color: S.muted, marginTop:5 }}>Stage-by-stage process simulation · Material stash tracking · Live render</div>
      </div>

      <div style={{ padding:"18px 16px" }}>
        {sec("Choose a Template")}
        <div style={{ fontSize:11, color: S.muted, marginBottom:14, lineHeight:1.6 }}>
          Pick a starting point. You can customize everything once loaded.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => loadTemplate(t)} style={{
              display:"grid", gridTemplateColumns:"80px 1fr", gap:12, padding:12,
              background: S.bg2, border:`1px solid ${S.border}`, borderRadius:8,
              cursor:"pointer", textAlign:"left", transition:"border-color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = S.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = S.border}
            >
              <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"center" }}>
                <TemplateThumbnail strips={parsePattern(t.config.pattern)} method={t.config.method} />
                <span style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background: t.tagColor + "33", color: t.tagColor === S.green ? "#5aaa6a" : t.tagColor === S.amber ? "#e0a030" : "#e06060", letterSpacing:"0.1em" }}>
                  {t.tag}
                </span>
              </div>
              <div>
                <div style={{ fontFamily:"Georgia,serif", fontSize:15, color: S.text, marginBottom:4 }}>{t.name}</div>
                <div style={{ fontSize:11, color: S.muted, lineHeight:1.6, marginBottom:6 }}>{t.desc}</div>
                <div style={{ fontSize:10, color: S.walnut, fontFamily:"monospace" }}>
                  {t.config.method} · {t.config.boardW}" × {t.config.boardH}" · {t.config.pattern}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop:16, textAlign:"center" }}>
          <button onClick={() => { setView("simulator"); setActiveTab("design"); }} style={{
            padding:"10px 20px", borderRadius:6, border:`1px solid ${S.border}`,
            background: S.bg3, color: S.dim, fontSize:11, cursor:"pointer", fontFamily:"monospace",
          }}>
            Start from scratch →
          </button>
        </div>
      </div>
    </div>
  );

  // ── SIMULATOR VIEW ──────────────────────────────────────────────────────────
  return (
    <div style={{ background: S.bg, minHeight:"100vh", color: S.text, fontFamily:"'DM Mono','Courier New',monospace", paddingBottom:48 }}>
      {/* Header */}
      <div style={{ borderBottom:`1px solid ${S.border}`, padding:"16px 18px 12px", background:"linear-gradient(180deg,#1c1610,#141210)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={() => setView("templates")} style={{ fontSize:10, color: S.muted, background:"none", border:"none", cursor:"pointer", padding:0, letterSpacing:"0.1em" }}>
            ← Templates
          </button>
          <div style={{ fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color: S.walnut }}>Simulator</div>
          <div style={{ width:60 }}/>
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontSize:20, fontWeight:700, marginTop:8, lineHeight:1.1 }}>
          {config.method.charAt(0).toUpperCase() + config.method.slice(1)} Board
          <span style={{ color: S.accent, fontSize:14, fontWeight:400, marginLeft:8 }}>
            {config.boardW}" × {config.boardH}"
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:`1px solid ${S.border}`, background:"#1a1610" }}>
        {[["simulate","Simulate"],["design","Design"],["stash","Stash"],["materials","Materials"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            flex:1, padding:"10px 2px", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase",
            border:"none", cursor:"pointer",
            background: activeTab===id ? S.bg3 : "transparent",
            color: activeTab===id ? S.accent : S.muted,
            borderBottom: activeTab===id ? `2px solid ${S.accent}` : "2px solid transparent",
            transition:"all 0.15s",
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ padding:"18px 16px" }}>

        {/* ── SIMULATE TAB ── */}
        {activeTab === "simulate" && <>
          {stages.length === 0
            ? <div style={{ textAlign:"center", padding:32, color: S.muted, fontSize:12 }}>Enter a valid pattern in the Design tab to begin simulation.</div>
            : <>
              {/* Stage nav */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <button onClick={() => setStageIdx(i => Math.max(0, i-1))} disabled={stageIdx===0}
                  style={{ width:32, height:32, borderRadius:4, border:`1px solid ${S.border}`, background: stageIdx===0 ? S.bg : S.bg3, color: stageIdx===0 ? S.muted : S.text, cursor: stageIdx===0?"not-allowed":"pointer", fontSize:16 }}>‹</button>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:9, color: S.muted, letterSpacing:"0.15em", textTransform:"uppercase" }}>Stage {stageIdx+1} of {stages.length}</div>
                  <div style={{ display:"flex", gap:3, justifyContent:"center", marginTop:4 }}>
                    {stages.map((_,i) => (
                      <button key={i} onClick={() => setStageIdx(i)} style={{
                        width: i===stageIdx ? 16 : 6, height:6, borderRadius:3, border:"none", cursor:"pointer",
                        background: i===stageIdx ? S.accent : i < stageIdx ? S.walnut : S.border,
                        transition:"all 0.2s", padding:0,
                      }}/>
                    ))}
                  </div>
                </div>
                <button onClick={() => setStageIdx(i => Math.min(stages.length-1, i+1))} disabled={stageIdx===stages.length-1}
                  style={{ width:32, height:32, borderRadius:4, border:`1px solid ${S.border}`, background: stageIdx===stages.length-1 ? S.bg : S.bg3, color: stageIdx===stages.length-1 ? S.muted : S.text, cursor: stageIdx===stages.length-1?"not-allowed":"pointer", fontSize:16 }}>›</button>
              </div>

              {/* Stage card */}
              {currentStage && card(<>
                <div style={{ fontSize:9, color: S.accent, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:6 }}>
                  {currentStage.label}
                </div>
                <div style={{ fontSize:12, color: S.dim, lineHeight:1.7, marginBottom:12 }}>
                  {currentStage.desc}
                </div>

                {/* Panel renders */}
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {currentStage.panels.map((panel, pi) => (
                    <div key={pi} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                      <BoardCanvas cells={panel.cells} boardW={panel.w} boardH={panel.h} pixelW={300} />
                      <div style={{ fontSize:10, color: S.muted, textAlign:"center", letterSpacing:"0.04em" }}>{panel.label}</div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {currentStage.notes?.length > 0 && (
                  <div style={{ marginTop:12, borderTop:`1px solid ${S.border}`, paddingTop:10 }}>
                    <div style={{ fontSize:9, color: S.walnut, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:6 }}>Shop Notes</div>
                    {currentStage.notes.map((n,i) => (
                      <div key={i} style={{ display:"flex", gap:8, fontSize:11, color: S.muted, marginBottom:4, lineHeight:1.5 }}>
                        <span style={{ color: S.walnut, flexShrink:0 }}>→</span>{n}
                      </div>
                    ))}
                  </div>
                )}

                {/* Losses */}
                {currentStage.losses && Object.keys(currentStage.losses).length > 0 && (
                  <div style={{ marginTop:10, background: S.bg3, borderRadius:6, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color: S.muted, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:4 }}>Material Loss This Stage</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      {Object.entries(currentStage.losses).map(([type, amt]) => (
                        <span key={type} style={{ fontSize:10, color:"#c06040", fontFamily:"monospace" }}>
                          {type}: −{typeof amt === "number" ? amt.toFixed(3) : amt}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>)}

              {/* Final result shortcut */}
              {stageIdx < stages.length - 1 && (
                <button onClick={() => setStageIdx(stages.length - 1)} style={{
                  width:"100%", marginTop:8, padding:"10px", borderRadius:6,
                  border:`1px solid ${S.border}`, background: S.bg3,
                  color: S.muted, fontSize:11, cursor:"pointer", fontFamily:"monospace",
                  letterSpacing:"0.08em",
                }}>
                  Jump to final result →
                </button>
              )}
            </>
          }
        </>}

        {/* ── DESIGN TAB ── */}
        {activeTab === "design" && <>
          {sec("Construction Method")}
          {card(<>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[
                ["stripe",       "Simple Stripe",   "1 glue-up → crosscut → final glue-up"],
                ["weave",        "Weave",            "Glue-up → crosscut → flip alt slices → glue-up"],
                ["checkerboard", "Checkerboard",     "2 glue-ups · 2 crosscuts · true end-grain checker"],
                ["face_grain",   "Butcher Block",    "Face grain · fastest build · best for large boards"],
                ["herringbone",  "Herringbone",      "45° mitered strips · advanced · requires miter sled"],
              ].map(([id, lbl, desc]) => (
                <button key={id} onClick={() => update("method", id)} style={{
                  display:"flex", flexDirection:"column", alignItems:"flex-start",
                  padding:"8px 12px", borderRadius:6, cursor:"pointer", textAlign:"left",
                  border:`1.5px solid ${config.method===id ? S.accent : S.border}`,
                  background: config.method===id ? S.bg3 : S.bg, transition:"all 0.15s",
                }}>
                  <span style={{ fontSize:12, color: config.method===id ? S.accent : S.text }}>{lbl}</span>
                  <span style={{ fontSize:10, color: S.muted, marginTop:2 }}>{desc}</span>
                </button>
              ))}
            </div>
          </>)}

          {sec("Dimensions")}
          {card(
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              {[
                ["Width", config.boardW, v => update("boardW",v), 4, 24, 0.5],
                ["Length", config.boardH, v => update("boardH",v), 6, 36, 0.5],
                ["Thickness", config.thickness, v => update("thickness",v), 1, 2.5, 0.25],
              ].map(([lbl, val, set, mn, mx, step]) => (
                <div key={lbl}>
                  <div style={{ fontSize:9, color: S.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.1em" }}>{lbl}</div>
                  <input type="number" value={val} min={mn} max={mx} step={step}
                    onChange={e => set(parseFloat(e.target.value) || mn)}
                    style={{ width:"100%", background: S.bg, border:`1px solid ${S.border}`, borderRadius:4, padding:"6px 8px", color: S.text, fontSize:14, fontFamily:"Georgia,serif", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
              ))}
            </div>
          )}

          {sec("Strip Pattern")}
          {card(<>
            <div style={{ fontSize:9, color: S.muted, marginBottom:6 }}>
              Width + abbr pairs — e.g. <span style={{ color: S.accent }}>.25W 1HM .25W 1.5AM</span>
            </div>
            <input type="text" value={patternStr} onChange={e => setPatternStr(e.target.value)}
              style={{ width:"100%", background: S.bg, border:`1px solid ${patErr ? "#8b3a1f" : S.border}`, borderRadius:4, padding:"8px 10px", color: S.text, fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }}
            />
            {patErr && <div style={{ fontSize:10, color:"#c85a2a", marginTop:4 }}>{patErr}</div>}
            {strips.length > 0 && <>
              <div style={{ display:"flex", height:28, borderRadius:4, overflow:"hidden", border:`1px solid ${S.border}`, marginTop:10 }}>
                {strips.map((st,i) => (
                  <div key={i} style={{ flex: st.width, background: WOODS[st.key].color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"rgba(0,0,0,0.5)", fontWeight:"bold" }}>
                    {st.width > 0.35 ? st.key : ""}
                  </div>
                ))}
              </div>
              <div style={{ fontSize:9, color: S.walnut, marginTop:4 }}>
                Repeat: {patW.toFixed(2)}" · ~{Math.floor(config.boardW / patW)} full repeats across {config.boardW}"
              </div>
            </>}
          </>)}

          {sec("Wood Codes")}
          <div style={{ background:"#1a1610", border:`1px solid #28201a`, borderRadius:8, padding:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3 }}>
              {Object.entries(WOODS).map(([abbr, w]) => (
                <div key={abbr} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background: w.color, flexShrink:0 }}/>
                  <span style={{ fontSize:10, color: S.accent, fontFamily:"monospace", minWidth:28 }}>{abbr}</span>
                  <span style={{ fontSize:10, color: S.muted }}>{w.name}</span>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ── STASH TAB ── */}
        {activeTab === "stash" && <>
          {sec("Your Lumber Stash")}
          <div style={{ fontSize:11, color: S.muted, marginBottom:12, lineHeight:1.7 }}>
            Log what you have on hand. The simulator will compare against what your design requires and flag any gaps.
          </div>

          {/* Add to stash */}
          {card(<>
            <div style={{ fontSize:9, color: S.accent, textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:10 }}>Add Stock</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:8, alignItems:"flex-end" }}>
              <div>
                <div style={{ fontSize:9, color: S.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.1em" }}>Species</div>
                <select value={stashInput.key} onChange={e => setStashInput(s => ({ ...s, key: e.target.value }))}
                  style={{ width:"100%", background: S.bg, border:`1px solid ${S.border}`, borderRadius:4, padding:"6px 8px", color: S.text, fontSize:12, outline:"none" }}>
                  {Object.entries(WOODS).map(([k,w]) => <option key={k} value={k}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:9, color: S.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.1em" }}>Board Feet</div>
                <input type="number" value={stashInput.fbm} min={0.1} step={0.25}
                  onChange={e => setStashInput(s => ({ ...s, fbm: parseFloat(e.target.value) || 0 }))}
                  style={{ width:"100%", background: S.bg, border:`1px solid ${S.border}`, borderRadius:4, padding:"6px 8px", color: S.text, fontSize:14, fontFamily:"Georgia,serif", outline:"none", boxSizing:"border-box" }}
                />
              </div>
              <button onClick={() => {
                if (stashInput.fbm > 0) setStash(s => [...s, { ...stashInput, id: Date.now() }]);
              }} style={{ padding:"7px 14px", borderRadius:4, border:`1px solid ${S.accent}`, background: S.bg3, color: S.accent, fontSize:12, cursor:"pointer", fontFamily:"monospace", whiteSpace:"nowrap" }}>
                + Add
              </button>
            </div>
          </>)}

          {/* Stash list */}
          {stash.length > 0 && card(<>
            <div style={{ fontSize:9, color: S.accent, textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:10 }}>On Hand</div>
            {stash.map(item => (
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:`1px solid ${S.border}` }}>
                <div style={{ width:12, height:12, borderRadius:2, background: WOODS[item.key].color, flexShrink:0 }}/>
                <span style={{ flex:1, fontSize:12, color: S.text }}>{WOODS[item.key].name}</span>
                <span style={{ fontSize:12, color: S.accent, fontFamily:"monospace" }}>{item.fbm} fbm</span>
                <button onClick={() => setStash(s => s.filter(x => x.id !== item.id))}
                  style={{ padding:"2px 8px", borderRadius:3, border:`1px solid ${S.border}`, background:"none", color: S.muted, fontSize:11, cursor:"pointer" }}>×</button>
              </div>
            ))}
          </>)}

          {/* Coverage check */}
          {materials.length > 0 && <>
            {sec("Coverage Check")}
            {card(<>
              {coverage.map(m => (
                <div key={m.key} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background: WOODS[m.key].color, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color: S.text, flex:1 }}>{WOODS[m.key].name}</span>
                    <span style={{ fontSize:11, fontFamily:"monospace", color: m.sufficient ? "#5aaa6a" : "#e06060" }}>
                      {m.sufficient ? "✓ OK" : `−${m.gap.toFixed(2)} fbm`}
                    </span>
                  </div>
                  <div style={{ height:6, background: S.border, borderRadius:3, overflow:"hidden" }}>
                    <div style={{
                      height:"100%", borderRadius:3, transition:"width 0.3s",
                      background: m.sufficient ? "#2a6b3a" : "#8b3a1f",
                      width: `${Math.min(100, (m.owned / m.fbm) * 100).toFixed(1)}%`
                    }}/>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color: S.muted, marginTop:2 }}>
                    <span>Have: {m.owned.toFixed(2)} fbm</span>
                    <span>Need: {m.fbm.toFixed(2)} fbm</span>
                  </div>
                </div>
              ))}
            </>)}
          </>}
        </>}

        {/* ── MATERIALS TAB ── */}
        {activeTab === "materials" && <>
          {sec("Board Summary")}
          {card(
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Size", `${config.boardW}" × ${config.boardH}"`],
                ["Thickness", `${config.thickness}"`],
                ["Method", config.method],
                ["Stages", `${stages.length} stages`],
              ].map(([l,v]) => (
                <div key={l}>
                  <div style={{ fontSize:9, color: S.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>{l}</div>
                  <div style={{ fontSize:14, color: S.text, fontFamily:"Georgia,serif" }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          {sec(`Wood Required (incl. ${config.method === "checkerboard" ? "45" : config.method === "herringbone" ? "35" : "20"}% waste)`)}
          <div style={{ background: S.bg2, border:`1px solid ${S.border}`, borderRadius:8, overflow:"hidden", marginBottom:14 }}>
            {materials.length === 0
              ? <div style={{ padding:14, fontSize:11, color: S.walnut }}>Set a valid pattern in Design tab.</div>
              : materials.map((m, i) => (
                <div key={m.key} style={{ display:"grid", gridTemplateColumns:"14px 1fr auto", alignItems:"center", gap:10, padding:"12px 14px", borderBottom: i < materials.length-1 ? `1px solid ${S.border}` : "none" }}>
                  <div style={{ width:14, height:14, borderRadius:3, background: WOODS[m.key].color }}/>
                  <div>
                    <div style={{ fontSize:13, color: S.text }}>{WOODS[m.key].name}</div>
                    <div style={{ fontSize:10, color: S.muted, marginTop:2 }}>{m.fbm.toFixed(2)} fbm · ${WOODS[m.key].price}/fbm</div>
                  </div>
                  <div style={{ fontSize:12, color: S.accent, fontFamily:"monospace" }}>${m.cost.toFixed(2)}</div>
                </div>
              ))
            }
          </div>

          <div style={{ background: S.bg2, border:`1px solid ${S.border}`, borderRadius:8, overflow:"hidden" }}>
            {[["Titebond III","$8–12"],["Sandpaper sets","$8–12"],["Mineral oil + cream","$10–15"]].map(([l,c],i) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", borderBottom: i<2 ? `1px solid #28201a` : "none", fontSize:12 }}>
                <span style={{ color: S.dim }}>{l}</span>
                <span style={{ color: S.muted, fontFamily:"monospace" }}>{c}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:14, borderTop:`1px solid ${S.border}`, background: S.bg3 }}>
              <span style={{ fontSize:13, color: S.accent }}>Estimated Total</span>
              <span style={{ fontSize:22, color: S.accent, fontFamily:"Georgia,serif" }}>${totalCost.toFixed(2)}</span>
            </div>
          </div>
        </>}

      </div>
    </div>
  );
}
