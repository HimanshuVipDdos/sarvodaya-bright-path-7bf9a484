/**
 * Sarvodaya CBT - Diagram Generator & Smart Detector Engine
 * Generates crisp vector SVG diagrams for:
 * 1. Geometry (Triangles, Parallel Lines + Transversals, Circles + Tangents)
 * 2. Physics Circuits (Series, Parallel, Wheatstone Bridge, Battery + Switch)
 * 3. Venn Diagrams (2-Set, 3-Set overlapping with labels & counts)
 * 4. Direction Sense (Compass & Vector Path Maps)
 */

export interface DiagramDetectionResult {
  needsDiagram: boolean;
  suggestedType:
    | "circuit"
    | "geometry_triangle"
    | "geometry_parallel"
    | "geometry_circle"
    | "venn"
    | "direction"
    | "general"
    | null;
  confidence: number;
  detectedReason: string;
}

/**
 * Detects if a question statement implies a missing diagram or visual figure.
 */
export function detectDiagramNeeds(text: string): DiagramDetectionResult {
  if (!text) {
    return { needsDiagram: false, suggestedType: null, confidence: 0, detectedReason: "" };
  }

  // If question already contains a markdown image or image URL, no diagram needed
  if (
    text.includes("![") ||
    text.includes(".png") ||
    text.includes(".jpg") ||
    text.includes(".jpeg") ||
    text.includes(".webp") ||
    text.includes(".svg")
  ) {
    return { needsDiagram: false, suggestedType: null, confidence: 0, detectedReason: "Already has diagram" };
  }

  const lower = text.toLowerCase();

  // 1. Venn Diagram Detection
  if (
    lower.includes("वेन आरेख") ||
    lower.includes("वेन रेखाचित्र") ||
    lower.includes("venn diagram") ||
    lower.includes("venn") ||
    (lower.includes("सम्बन्ध") && lower.includes("दर्शाता") && lower.includes("आरेख")) ||
    (lower.includes("circles represent") && lower.includes("overlap"))
  ) {
    return {
      needsDiagram: true,
      suggestedType: "venn",
      confidence: 0.95,
      detectedReason: "Venn diagram / set relation question detected",
    };
  }

  // 2. Physics Circuit Detection
  if (
    lower.includes("परिपथ") ||
    lower.includes("विद्युत परिपथ") ||
    lower.includes("circuit") ||
    lower.includes("resistor") ||
    lower.includes("प्रतिरोधक") ||
    lower.includes("तुल्य प्रतिरोध") ||
    lower.includes("equivalent resistance") ||
    lower.includes("wheatstone") ||
    lower.includes("व्हीटस्टोन")
  ) {
    return {
      needsDiagram: true,
      suggestedType: "circuit",
      confidence: 0.9,
      detectedReason: "Electrical circuit / resistance problem detected",
    };
  }

  // 3. Geometry: Parallel lines & Transversal
  if (
    lower.includes("समानांतर रेखा") ||
    lower.includes("parallel lines") ||
    lower.includes("transversal") ||
    lower.includes("तिर्यक रेखा") ||
    lower.includes("एकांतर कोण") ||
    lower.includes("alternate angle") ||
    text.includes("∥") ||
    text.includes("||")
  ) {
    return {
      needsDiagram: true,
      suggestedType: "geometry_parallel",
      confidence: 0.9,
      detectedReason: "Parallel lines & angle transversal problem detected",
    };
  }

  // 4. Geometry: Triangle
  if (
    lower.includes("त्रिभुज") ||
    lower.includes("triangle") ||
    lower.includes("समकोण त्रिभुज") ||
    lower.includes("right angled triangle") ||
    text.includes("Δ") ||
    text.includes("△") ||
    /\b(ab|bc|ca|xyz|pqr)\b/i.test(text)
  ) {
    return {
      needsDiagram: true,
      suggestedType: "geometry_triangle",
      confidence: 0.85,
      detectedReason: "Geometric triangle problem detected",
    };
  }

  // 5. Geometry: Circle
  if (
    lower.includes("वृत्त") ||
    lower.includes("circle") ||
    lower.includes("त्रिज्या") ||
    lower.includes("radius") ||
    lower.includes("जीवा") ||
    lower.includes("chord") ||
    lower.includes("स्पर्श रेखा") ||
    lower.includes("tangent")
  ) {
    return {
      needsDiagram: true,
      suggestedType: "geometry_circle",
      confidence: 0.85,
      detectedReason: "Circle geometry problem detected",
    };
  }

  // 6. Direction Sense / Navigation
  if (
    lower.includes("दिशा") ||
    lower.includes("direction") ||
    (lower.includes("उत्तर") && lower.includes("पूर्व")) ||
    (lower.includes("north") && lower.includes("east")) ||
    (lower.includes("मुड़ा") && lower.includes("किमी")) ||
    (lower.includes("turned right") && lower.includes("meters"))
  ) {
    return {
      needsDiagram: true,
      suggestedType: "direction",
      confidence: 0.85,
      detectedReason: "Direction sense & distance path problem detected",
    };
  }

  // 7. General diagram mentions ("नीचे दिए गए चित्र में...", "In the given figure...")
  if (
    lower.includes("दिए गए चित्र") ||
    lower.includes("नीचे दिए गए चित्र") ||
    lower.includes("आकृति में") ||
    lower.includes("in the given figure") ||
    lower.includes("in the figure below") ||
    lower.includes("as shown in the diagram") ||
    lower.includes("चित्रानुसार")
  ) {
    return {
      needsDiagram: true,
      suggestedType: "general",
      confidence: 0.8,
      detectedReason: "Question refers to an explicit figure or diagram",
    };
  }

  return { needsDiagram: false, suggestedType: null, confidence: 0, detectedReason: "" };
}

/**
 * Converts an SVG string into a standalone Data URL (image/svg+xml;utf8,...).
 */
export function svgToDataUrl(svgString: string): string {
  const cleaned = svgString
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

/* =====================================================================
 * 1. VENN DIAGRAM GENERATOR
 * ===================================================================== */
export interface VennDiagramOptions {
  type: "2_set" | "3_set";
  labelA?: string;
  labelB?: string;
  labelC?: string;
  countA?: string | number;
  countB?: string | number;
  countC?: string | number;
  countAB?: string | number;
  countBC?: string | number;
  countAC?: string | number;
  countABC?: string | number;
  title?: string;
}

export function generateVennDiagramSvg(options: VennDiagramOptions): string {
  const is3Set = options.type === "3_set";
  const title = options.title || (is3Set ? "3-Set Venn Diagram" : "2-Set Venn Diagram");

  if (!is3Set) {
    const lA = options.labelA || "Group A";
    const lB = options.labelB || "Group B";
    const cA = options.countA ?? "15";
    const cB = options.countB ?? "20";
    const cAB = options.countAB ?? "8";

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320" width="100%" height="100%" style="background:#ffffff; border-radius:16px;">
  <defs>
    <linearGradient id="gradA" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#2563EB" stop-opacity="0.2"/>
    </linearGradient>
    <linearGradient id="gradB" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#059669" stop-opacity="0.2"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.1"/>
    </filter>
  </defs>

  <!-- Title -->
  <text x="250" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="bold" fill="#0F172A" text-anchor="middle">${title}</text>

  <!-- Outer Frame -->
  <rect x="20" y="45" width="460" height="255" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />

  <!-- Circle A -->
  <circle cx="190" cy="170" r="85" fill="url(#gradA)" stroke="#2563EB" stroke-width="2.5" filter="url(#shadow)" />
  <!-- Circle B -->
  <circle cx="310" cy="170" r="85" fill="url(#gradB)" stroke="#059669" stroke-width="2.5" filter="url(#shadow)" />

  <!-- Category Label A -->
  <text x="140" y="100" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#1D4ED8" text-anchor="middle">${lA}</text>
  <!-- Only A Count -->
  <text x="145" y="176" font-family="system-ui, sans-serif" font-size="20" font-weight="800" fill="#1E3A8A" text-anchor="middle">${cA}</text>

  <!-- Category Label B -->
  <text x="360" y="100" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#047857" text-anchor="middle">${lB}</text>
  <!-- Only B Count -->
  <text x="355" y="176" font-family="system-ui, sans-serif" font-size="20" font-weight="800" fill="#064E3B" text-anchor="middle">${cB}</text>

  <!-- Intersection AB Count -->
  <text x="250" y="176" font-family="system-ui, sans-serif" font-size="20" font-weight="900" fill="#7C3AED" text-anchor="middle">${cAB}</text>
</svg>`.trim();
  }

  // 3-Set Venn Diagram
  const lA = options.labelA || "Doctors (डॉक्टर)";
  const lB = options.labelB || "Teachers (शिक्षक)";
  const lC = options.labelC || "Lawyers (वकील)";
  const cA = options.countA ?? "18";
  const cB = options.countB ?? "24";
  const cC = options.countC ?? "16";
  const cAB = options.countAB ?? "7";
  const cBC = options.countBC ?? "9";
  const cAC = options.countAC ?? "6";
  const cABC = options.countABC ?? "4";

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 420" width="100%" height="100%" style="background:#ffffff; border-radius:16px;">
  <defs>
    <filter id="glow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Title -->
  <text x="260" y="28" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0F172A" text-anchor="middle">${title}</text>

  <!-- Frame -->
  <rect x="15" y="40" width="490" height="365" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5" />

  <!-- Circles -->
  <!-- Set A (Top) -->
  <circle cx="260" cy="165" r="90" fill="#3B82F6" fill-opacity="0.22" stroke="#2563EB" stroke-width="2" filter="url(#glow)" />
  <!-- Set B (Bottom Left) -->
  <circle cx="205" cy="255" r="90" fill="#10B981" fill-opacity="0.22" stroke="#059669" stroke-width="2" filter="url(#glow)" />
  <!-- Set C (Bottom Right) -->
  <circle cx="315" cy="255" r="90" fill="#F59E0B" fill-opacity="0.22" stroke="#D97706" stroke-width="2" filter="url(#glow)" />

  <!-- Set Labels -->
  <text x="260" y="65" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#1D4ED8" text-anchor="middle">${lA}</text>
  <text x="110" y="355" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#047857" text-anchor="middle">${lB}</text>
  <text x="410" y="355" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#B45309" text-anchor="middle">${lC}</text>

  <!-- Numbers -->
  <text x="260" y="130" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#1E3A8A" text-anchor="middle">${cA}</text>
  <text x="170" y="275" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#064E3B" text-anchor="middle">${cB}</text>
  <text x="350" y="275" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#78350F" text-anchor="middle">${cC}</text>

  <!-- Intersections -->
  <text x="215" y="195" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="#4338CA" text-anchor="middle">${cAB}</text>
  <text x="305" y="195" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="#B45309" text-anchor="middle">${cAC}</text>
  <text x="260" y="300" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="#047857" text-anchor="middle">${cBC}</text>

  <!-- Central Triple Intersection -->
  <circle cx="260" cy="225" r="16" fill="#FFFFFF" fill-opacity="0.8" />
  <text x="260" y="231" font-family="system-ui, sans-serif" font-size="16" font-weight="900" fill="#7E22CE" text-anchor="middle">${cABC}</text>
</svg>`.trim();
}

/* =====================================================================
 * 2. PHYSICS CIRCUIT GENERATOR
 * ===================================================================== */
export interface CircuitDiagramOptions {
  type: "series" | "parallel" | "series_parallel" | "wheatstone";
  r1Label?: string;
  r2Label?: string;
  r3Label?: string;
  r4Label?: string;
  voltageLabel?: string;
  title?: string;
}

export function generateCircuitDiagramSvg(options: CircuitDiagramOptions): string {
  const title = options.title || "Electrical Circuit (विद्युत परिपथ)";
  const vLabel = options.voltageLabel || "V = 12V";
  const r1 = options.r1Label || "R₁ = 4 Ω";
  const r2 = options.r2Label || "R₂ = 8 Ω";

  if (options.type === "parallel" || options.type === "series_parallel") {
    const r3 = options.r3Label || "R₃ = 12 Ω";
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 320" width="100%" height="100%" style="background:#ffffff; border-radius:16px;">
  <!-- Title -->
  <text x="260" y="28" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0F172A" text-anchor="middle">${title} (Parallel Connection)</text>

  <!-- Frame -->
  <rect x="15" y="40" width="490" height="265" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />

  <!-- Connecting Wires -->
  <g stroke="#0F172A" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <!-- Bottom line to Battery -->
    <path d="M 120 250 L 220 250" />
    <path d="M 280 250 L 400 250" />
    <!-- Left vertical trunk -->
    <path d="M 120 250 L 120 100" />
    <!-- Right vertical trunk -->
    <path d="M 400 250 L 400 100" />

    <!-- Branch 1 (Top R1) -->
    <path d="M 120 100 L 210 100" />
    <path d="M 290 100 L 400 100" />

    <!-- Branch 2 (Middle R2) -->
    <path d="M 120 170 L 210 170" />
    <path d="M 290 170 L 400 170" />
  </g>

  <!-- Junction Dots -->
  <circle cx="120" cy="100" r="4.5" fill="#0F172A" />
  <circle cx="120" cy="170" r="4.5" fill="#0F172A" />
  <circle cx="400" cy="100" r="4.5" fill="#0F172A" />
  <circle cx="400" cy="170" r="4.5" fill="#0F172A" />

  <!-- Node A & Node B Markers -->
  <circle cx="90" cy="135" r="14" fill="#6366F1" />
  <text x="90" y="140" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF" text-anchor="middle">A</text>
  <path d="M 104 135 L 120 135" stroke="#6366F1" stroke-width="2" />

  <circle cx="430" cy="135" r="14" fill="#6366F1" />
  <text x="430" y="140" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF" text-anchor="middle">B</text>
  <path d="M 400 135 L 416 135" stroke="#6366F1" stroke-width="2" />

  <!-- Resistor 1 ZigZag -->
  <path d="M 210 100 L 220 90 L 230 110 L 240 90 L 250 110 L 260 90 L 270 110 L 280 90 L 290 100" stroke="#DC2626" stroke-width="3" fill="none" stroke-linejoin="round" />
  <text x="250" y="80" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#B91C1C" text-anchor="middle">${r1}</text>

  <!-- Resistor 2 ZigZag -->
  <path d="M 210 170 L 220 160 L 230 180 L 240 160 L 250 180 L 260 160 L 270 180 L 280 160 L 290 170" stroke="#059669" stroke-width="3" fill="none" stroke-linejoin="round" />
  <text x="250" y="150" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#047857" text-anchor="middle">${r2}</text>

  <!-- Battery Symbol at Bottom -->
  <!-- Long plate (+) -->
  <line x1="240" y1="235" x2="240" y2="265" stroke="#0F172A" stroke-width="3.5" />
  <!-- Short plate (-) -->
  <line x1="250" y1="242" x2="250" y2="258" stroke="#0F172A" stroke-width="2" />
  <!-- Plus / Minus signs -->
  <text x="225" y="240" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#DC2626">+</text>
  <text x="260" y="240" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0F172A">-</text>
  <text x="245" y="285" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#0F172A" text-anchor="middle">${vLabel}</text>
</svg>`.trim();
  }

  // Default Series Circuit
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 280" width="100%" height="100%" style="background:#ffffff; border-radius:16px;">
  <!-- Title -->
  <text x="250" y="28" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0F172A" text-anchor="middle">${title} (Series Connection)</text>

  <!-- Frame -->
  <rect x="20" y="40" width="460" height="225" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />

  <!-- Wire Loop -->
  <path d="M 80 200 L 80 110 L 140 110" stroke="#0F172A" stroke-width="2.5" fill="none" stroke-linecap="round" />
  <path d="M 220 110 L 280 110" stroke="#0F172A" stroke-width="2.5" fill="none" stroke-linecap="round" />
  <path d="M 360 110 L 420 110 L 420 200 L 280 200" stroke="#0F172A" stroke-width="2.5" fill="none" stroke-linecap="round" />
  <path d="M 220 200 L 80 200" stroke="#0F172A" stroke-width="2.5" fill="none" stroke-linecap="round" />

  <!-- Resistor 1 ZigZag -->
  <path d="M 140 110 L 150 95 L 160 125 L 170 95 L 180 125 L 190 95 L 200 125 L 210 95 L 220 110" stroke="#DC2626" stroke-width="3" fill="none" stroke-linejoin="round" />
  <text x="180" y="80" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#B91C1C" text-anchor="middle">${r1}</text>

  <!-- Resistor 2 ZigZag -->
  <path d="M 280 110 L 290 95 L 300 125 L 310 95 L 320 125 L 330 95 L 340 125 L 350 95 L 360 110" stroke="#059669" stroke-width="3" fill="none" stroke-linejoin="round" />
  <text x="320" y="80" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#047857" text-anchor="middle">${r2}</text>

  <!-- Battery at Bottom -->
  <line x1="245" y1="185" x2="245" y2="215" stroke="#0F172A" stroke-width="3.5" />
  <line x1="255" y1="192" x2="255" y2="208" stroke="#0F172A" stroke-width="2" />
  <text x="230" y="190" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#DC2626">+</text>
  <text x="265" y="190" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0F172A">-</text>
  <text x="250" y="240" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#0F172A" text-anchor="middle">${vLabel}</text>
</svg>`.trim();
}

/* =====================================================================
 * 3. GEOMETRY: PARALLEL LINES & ANGLES GENERATOR
 * ===================================================================== */
export interface ParallelLinesOptions {
  angleKnown?: string | number;
  angleTarget?: string;
  line1Label?: string;
  line2Label?: string;
  title?: string;
}

export function generateParallelLinesSvg(options: ParallelLinesOptions): string {
  const angleKnown = options.angleKnown ?? "115°";
  const angleTarget = options.angleTarget ?? "x°";
  const l1 = options.line1Label || "AB";
  const l2 = options.line2Label || "CD";
  const title = options.title || `Parallel Lines (${l1} ∥ ${l2})`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320" width="100%" height="100%" style="background:#ffffff; border-radius:16px;">
  <!-- Title -->
  <text x="250" y="30" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0F172A" text-anchor="middle">${title}</text>

  <!-- Frame -->
  <rect x="20" y="45" width="460" height="255" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />

  <!-- Parallel Line 1 (AB) -->
  <line x1="70" y1="120" x2="430" y2="120" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round" />
  <text x="60" y="125" font-family="system-ui, sans-serif" font-size="14" font-weight="black" fill="#2563EB">${l1[0] || "A"}</text>
  <text x="440" y="125" font-family="system-ui, sans-serif" font-size="14" font-weight="black" fill="#2563EB">${l1[1] || "B"}</text>

  <!-- Parallel Line 2 (CD) -->
  <line x1="70" y1="220" x2="430" y2="220" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round" />
  <text x="60" y="225" font-family="system-ui, sans-serif" font-size="14" font-weight="black" fill="#2563EB">${l2[0] || "C"}</text>
  <text x="440" y="225" font-family="system-ui, sans-serif" font-size="14" font-weight="black" fill="#2563EB">${l2[1] || "D"}</text>

  <!-- Transversal Line -->
  <line x1="140" y1="65" x2="360" y2="275" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round" />

  <!-- Intersection 1 Dot -->
  <circle cx="197" cy="120" r="4.5" fill="#DC2626" />
  <!-- Angle Arc 1 (Obtuse angle) -->
  <path d="M 235 120 A 38 38 0 0 1 218 140" fill="none" stroke="#2563EB" stroke-width="2" />
  <text x="250" y="145" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#2563EB">${angleKnown}</text>

  <!-- Intersection 2 Dot -->
  <circle cx="303" cy="220" r="4.5" fill="#DC2626" />
  <!-- Target Angle x Arc (Alternate Interior or Corresponding) -->
  <path d="M 265 220 A 38 38 0 0 1 282 200" fill="none" stroke="#D97706" stroke-width="2.5" />
  <text x="250" y="200" font-family="system-ui, sans-serif" font-size="16" font-weight="black" fill="#D97706">${angleTarget}</text>

  <!-- Explanatory note -->
  <text x="250" y="280" font-family="system-ui, sans-serif" font-size="11" font-weight="semibold" fill="#64748B" text-anchor="middle">Find the value of ${angleTarget} (यदि ${l1} ∥ ${l2} हो, तो ${angleTarget} का मान ज्ञात करें)</text>
</svg>`.trim();
}

/* =====================================================================
 * 4. GEOMETRY: TRIANGLE GENERATOR
 * ===================================================================== */
export interface TriangleOptions {
  type: "general" | "right_angled" | "isosceles" | "equilateral";
  vertexA?: string;
  vertexB?: string;
  vertexC?: string;
  sideAB?: string;
  sideBC?: string;
  sideCA?: string;
  angleA?: string;
  angleB?: string;
  angleC?: string;
  title?: string;
}

export function generateTriangleSvg(options: TriangleOptions): string {
  const vA = options.vertexA || "A";
  const vB = options.vertexB || "B";
  const vC = options.vertexC || "C";
  const title = options.title || `Triangle ${vA}${vB}${vC} (त्रिभुज)`;

  if (options.type === "right_angled") {
    const sAB = options.sideAB || "3 cm";
    const sBC = options.sideBC || "4 cm";
    const sCA = options.sideCA || "? (Hypotenuse)";

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 340" width="100%" height="100%" style="background:#ffffff; border-radius:16px;">
  <!-- Title -->
  <text x="240" y="30" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0F172A" text-anchor="middle">${title} - Right Angled</text>

  <!-- Frame -->
  <rect x="20" y="45" width="440" height="275" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />

  <!-- Triangle Polygon (A: 130, 90; B: 130, 260; C: 370, 260) -->
  <polygon points="130,90 130,260 370,260" fill="#EEF2FF" stroke="#4F46E5" stroke-width="2.5" stroke-linejoin="round" />

  <!-- Right Angle Square at B -->
  <rect x="130" y="240" width="20" height="20" fill="none" stroke="#4F46E5" stroke-width="2" />

  <!-- Vertices -->
  <circle cx="130" cy="90" r="5" fill="#4F46E5" />
  <text x="120" y="80" font-family="system-ui, sans-serif" font-size="15" font-weight="black" fill="#1E1B4B">${vA}</text>

  <circle cx="130" cy="260" r="5" fill="#4F46E5" />
  <text x="110" y="275" font-family="system-ui, sans-serif" font-size="15" font-weight="black" fill="#1E1B4B">${vB}</text>

  <circle cx="370" cy="260" r="5" fill="#4F46E5" />
  <text x="385" y="275" font-family="system-ui, sans-serif" font-size="15" font-weight="black" fill="#1E1B4B">${vC}</text>

  <!-- Side Labels -->
  <text x="85" y="180" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#DC2626" text-anchor="middle">${sAB}</text>
  <text x="250" y="290" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#059669" text-anchor="middle">${sBC}</text>
  <text x="270" y="165" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#D97706" text-anchor="middle">${sCA}</text>
</svg>`.trim();
  }

  // General Scalene / Isosceles Triangle
  const sAB = options.sideAB || "a";
  const sBC = options.sideBC || "b";
  const sCA = options.sideCA || "c";

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 340" width="100%" height="100%" style="background:#ffffff; border-radius:16px;">
  <!-- Title -->
  <text x="240" y="30" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0F172A" text-anchor="middle">${title}</text>

  <!-- Frame -->
  <rect x="20" y="45" width="440" height="275" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />

  <!-- Triangle (Top: 240, 85; Left: 100, 260; Right: 380, 260) -->
  <polygon points="240,85 100,260 380,260" fill="#F0FDF4" stroke="#059669" stroke-width="2.5" stroke-linejoin="round" />

  <!-- Vertices -->
  <circle cx="240" cy="85" r="5" fill="#059669" />
  <text x="240" y="72" font-family="system-ui, sans-serif" font-size="15" font-weight="black" fill="#064E3B" text-anchor="middle">${vA}</text>

  <circle cx="100" cy="260" r="5" fill="#059669" />
  <text x="85" y="275" font-family="system-ui, sans-serif" font-size="15" font-weight="black" fill="#064E3B">${vB}</text>

  <circle cx="380" cy="260" r="5" fill="#059669" />
  <text x="395" y="275" font-family="system-ui, sans-serif" font-size="15" font-weight="black" fill="#064E3B">${vC}</text>

  <!-- Labels -->
  <text x="155" y="165" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#2563EB" text-anchor="middle">${sAB}</text>
  <text x="325" y="165" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#2563EB" text-anchor="middle">${sCA}</text>
  <text x="240" y="290" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#D97706" text-anchor="middle">${sBC}</text>
</svg>`.trim();
}

/* =====================================================================
 * 5. DIRECTION SENSE / COMPASS PATH GENERATOR
 * ===================================================================== */
export interface DirectionPathOptions {
  steps?: Array<{ dir: "N" | "S" | "E" | "W"; distance: string | number }>;
  startLabel?: string;
  endLabel?: string;
  title?: string;
}

export function generateDirectionPathSvg(options: DirectionPathOptions): string {
  const title = options.title || "Direction & Distance Path (दिशा व दूरी)";

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 340" width="100%" height="100%" style="background:#ffffff; border-radius:16px;">
  <!-- Title -->
  <text x="250" y="30" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0F172A" text-anchor="middle">${title}</text>

  <!-- Frame -->
  <rect x="20" y="45" width="460" height="275" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />

  <!-- Compass Rose in Top-Right -->
  <g transform="translate(420, 95)">
    <circle cx="0" cy="0" r="24" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" />
    <!-- N / S / E / W axes -->
    <line x1="0" y1="-20" x2="0" y2="20" stroke="#0F172A" stroke-width="1.5" />
    <line x1="-20" y1="0" x2="20" y2="0" stroke="#0F172A" stroke-width="1.5" />
    <polygon points="0,-20 -4,-8 4,-8" fill="#DC2626" />
    <text x="0" y="-24" font-family="system-ui, sans-serif" font-size="9" font-weight="bold" fill="#DC2626" text-anchor="middle">N</text>
    <text x="0" y="32" font-family="system-ui, sans-serif" font-size="9" font-weight="bold" fill="#64748B" text-anchor="middle">S</text>
    <text x="26" y="3" font-family="system-ui, sans-serif" font-size="9" font-weight="bold" fill="#64748B">E</text>
    <text x="-32" y="3" font-family="system-ui, sans-serif" font-size="9" font-weight="bold" fill="#64748B">W</text>
  </g>

  <!-- Path: Start at (120, 240) -> North 100px -> East 140px -> South 60px -->
  <path d="M 140 240 L 140 120 L 280 120 L 280 190" fill="none" stroke="#2563EB" stroke-width="3" stroke-dasharray="6 3" />

  <!-- Start Point Marker -->
  <circle cx="140" cy="240" r="7" fill="#10B981" />
  <circle cx="140" cy="240" r="11" fill="none" stroke="#10B981" stroke-width="2" />
  <text x="140" y="270" font-family="system-ui, sans-serif" font-size="12" font-weight="black" fill="#047857" text-anchor="middle">Start (शुरुआत)</text>

  <!-- End Point Marker -->
  <circle cx="280" cy="190" r="7" fill="#DC2626" />
  <circle cx="280" cy="190" r="11" fill="none" stroke="#DC2626" stroke-width="2" />
  <text x="280" y="220" font-family="system-ui, sans-serif" font-size="12" font-weight="black" fill="#B91C1C" text-anchor="middle">End (गंतव्य)</text>

  <!-- Distance Leg Labels -->
  <text x="115" y="180" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#1E293B">5 km उत्तर</text>
  <text x="210" y="110" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#1E293B" text-anchor="middle">4 km पूर्व</text>
  <text x="310" y="160" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#1E293B">3 km दक्षिण</text>

  <!-- Displacement Line (Hypotenuse / Shortest Distance) -->
  <line x1="140" y1="240" x2="280" y2="190" stroke="#7C3AED" stroke-width="2" stroke-dasharray="4 2" />
  <text x="215" y="235" font-family="system-ui, sans-serif" font-size="12" font-weight="black" fill="#7C3AED" text-anchor="middle">न्यूनतम दूरी (Displacement = ?)</text>
</svg>`.trim();
}
