import { useState, useRef, useEffect, useCallback } from "react";

// ── COLOUR & DESIGN TOKENS ──────────────────────────────────────────────
// Palette: deep carbon bg, electric-lime accent, soft white text, coral warning
const T = {
  bg: "#0D0D0D",
  surface: "#161616",
  card: "#1E1E1E",
  border: "#2A2A2A",
  lime: "#C8F135",
  coral: "#FF5A36",
  blue: "#4DA6FF",
  purple: "#A78BFA",
  muted: "#6B6B6B",
  text: "#F0F0F0",
  sub: "#9A9A9A",
};

// ── STATIC DATA ──────────────────────────────────────────────────────────
const DRINKS = [
  { name: "Water (500ml)", cal: 0, protein: 0, carbs: 0, fat: 0 },
  { name: "Monster Energy (500ml)", cal: 190, protein: 0, carbs: 47, fat: 0 },
  { name: "Red Bull (250ml)", cal: 113, protein: 1, carbs: 28, fat: 0 },
  { name: "Protein Shake (300ml)", cal: 180, protein: 30, carbs: 8, fat: 3 },
  { name: "Whole Milk (250ml)", cal: 149, protein: 8, carbs: 12, fat: 8 },
  { name: "Orange Juice (250ml)", cal: 112, protein: 2, carbs: 26, fat: 0 },
  { name: "Black Coffee (240ml)", cal: 5, protein: 0, carbs: 1, fat: 0 },
  { name: "Lucozade (500ml)", cal: 270, protein: 0, carbs: 67, fat: 0 },
  { name: "Coca Cola (330ml)", cal: 139, protein: 0, carbs: 35, fat: 0 },
  { name: "Oat Milk (250ml)", cal: 120, protein: 3, carbs: 16, fat: 5 },
  { name: "Gatorade (500ml)", cal: 130, protein: 0, carbs: 34, fat: 0 },
  { name: "Almond Milk (250ml)", cal: 39, protein: 1, carbs: 3, fat: 3 },
];

const MUSCLE_GROUPS = {
  chest: {
    label: "Chest",
    exercises: ["Bench Press", "Push-Ups", "Cable Fly", "Incline Dumbbell Press"],
    cx: 200, cy: 120, r: 38,
  },
  shoulders: {
    label: "Shoulders",
    exercises: ["Overhead Press", "Lateral Raises", "Front Raises", "Arnold Press"],
    cx: 200, cy: 85, r: 22,
  },
  biceps: {
    label: "Biceps",
    exercises: ["Barbell Curl", "Hammer Curl", "Concentration Curl", "Preacher Curl"],
    cx: 200, cy: 145, r: 18,
  },
  triceps: {
    label: "Triceps",
    exercises: ["Tricep Dips", "Skull Crushers", "Rope Pushdown", "Close-Grip Bench"],
    cx: 200, cy: 150, r: 16,
  },
  abs: {
    label: "Abs",
    exercises: ["Crunches", "Plank", "Leg Raises", "Russian Twists", "Cable Crunch"],
    cx: 200, cy: 180, r: 28,
  },
  quads: {
    label: "Quads",
    exercises: ["Squats", "Leg Press", "Lunges", "Leg Extension"],
    cx: 200, cy: 240, r: 30,
  },
  hamstrings: {
    label: "Hamstrings",
    exercises: ["Romanian Deadlift", "Leg Curl", "Stiff-Leg Deadlift", "Nordic Curls"],
    cx: 200, cy: 260, r: 24,
  },
  glutes: {
    label: "Glutes",
    exercises: ["Hip Thrust", "Glute Bridge", "Cable Kickback", "Bulgarian Split Squat"],
    cx: 200, cy: 220, r: 22,
  },
  back: {
    label: "Back",
    exercises: ["Pull-Ups", "Bent-Over Row", "Lat Pulldown", "Deadlift", "Seated Row"],
    cx: 200, cy: 140, r: 35,
  },
  calves: {
    label: "Calves",
    exercises: ["Standing Calf Raise", "Seated Calf Raise", "Donkey Calf Raise"],
    cx: 200, cy: 310, r: 18,
  },
};

// ── HELPERS ───────────────────────────────────────────────────────────────
function calcBMI(weight, height) {
  if (!weight || !height) return null;
  const h = height / 100;
  return (weight / (h * h)).toFixed(1);
}
function bmiCategory(bmi) {
  if (!bmi) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  return "Obese";
}
function tdee(weight, height, age, sex, activity) {
  if (!weight || !height || !age) return 2000;
  // prefer_not: use average of male and female BMR formulas
  let bmr =
    sex === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : sex === "female"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age - 78; // midpoint average
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 };
  return Math.round(bmr * (factors[activity] || 1.55));
}
function proteinTarget(weight, goal) {
  const mult = goal === "muscle" ? 2.2 : goal === "lose" ? 1.8 : 1.6;
  return Math.round(weight * mult);
}

// ── CLAUDE API CALL ───────────────────────────────────────────────────────
const API_KEY = "YOUR_API_KEY_HERE"; // ← paste your key from console.anthropic.com

async function callClaude(messages, systemPrompt = "") {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-calls": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.map((b) => b.text || "").join("\n") || null;
  } catch {
    return null;
  }
}

async function analyseImage(base64, mimeType) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-calls": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
              {
                type: "text",
                text: `Analyse this food photo and estimate nutritional values. Respond ONLY with a valid JSON object (no markdown, no explanation):
{"name":"<food name>","calories":<number>,"protein":<grams>,"carbs":<grams>,"fat":<grams>,"confidence":"<low|medium|high>","notes":"<brief tip>"}`,
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.content?.map((b) => b.text || "").join("") || "{}";
    try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
    catch { return null; }
  } catch {
    return null;
  }
}

// ── BUILT-IN FALLBACK WORKOUT GENERATOR (works with NO API key) ───────────
const WORKOUT_DB = {
  chest: [
    { name: "Bench Press", sets: "4x8", tip: "Drive feet into floor, retract shoulder blades" },
    { name: "Incline Dumbbell Press", sets: "3x10", tip: "30-45 degree incline targets upper chest" },
    { name: "Cable Fly", sets: "3x12", tip: "Keep slight elbow bend, squeeze at centre" },
    { name: "Push-Ups", sets: "3x15", tip: "Hands slightly wider than shoulder width" },
    { name: "Dips", sets: "3x10", tip: "Lean forward slightly to hit chest over triceps" },
  ],
  shoulders: [
    { name: "Overhead Press", sets: "4x8", tip: "Brace core, do not arch lower back" },
    { name: "Lateral Raises", sets: "4x12", tip: "Lead with elbows, slight forward lean" },
    { name: "Front Raises", sets: "3x12", tip: "Control the descent, do not swing" },
    { name: "Arnold Press", sets: "3x10", tip: "Rotate palms out as you press up" },
    { name: "Face Pulls", sets: "3x15", tip: "Pull to nose level, elbows high" },
  ],
  biceps: [
    { name: "Barbell Curl", sets: "4x10", tip: "Keep elbows pinned at sides" },
    { name: "Hammer Curl", sets: "3x12", tip: "Neutral grip hits brachialis too" },
    { name: "Incline Dumbbell Curl", sets: "3x10", tip: "Full stretch at bottom" },
    { name: "Concentration Curl", sets: "3x12", tip: "Elbow on inner thigh for isolation" },
    { name: "Cable Curl", sets: "3x15", tip: "Constant tension throughout range" },
  ],
  triceps: [
    { name: "Skull Crushers", sets: "4x10", tip: "Lower bar to forehead, elbows in" },
    { name: "Rope Pushdown", sets: "4x12", tip: "Flare hands out at bottom" },
    { name: "Close-Grip Bench", sets: "3x8", tip: "Hands shoulder-width, elbows in" },
    { name: "Overhead Tricep Extension", sets: "3x12", tip: "Keep elbows close to head" },
    { name: "Tricep Dips", sets: "3x10", tip: "Stay upright to isolate triceps" },
  ],
  abs: [
    { name: "Plank", sets: "3x45s", tip: "Squeeze glutes and brace core hard" },
    { name: "Cable Crunch", sets: "4x15", tip: "Round spine, crunch to hips" },
    { name: "Hanging Leg Raise", sets: "3x12", tip: "Control the swing, slow descent" },
    { name: "Russian Twists", sets: "3x20", tip: "Feet off floor for more challenge" },
    { name: "Ab Wheel Rollout", sets: "3x10", tip: "Brace hard, do not let hips sag" },
  ],
  back: [
    { name: "Deadlift", sets: "4x5", tip: "Bar over mid-foot, neutral spine" },
    { name: "Pull-Ups", sets: "4x8", tip: "Full hang at bottom, chin over bar" },
    { name: "Bent-Over Row", sets: "4x8", tip: "Hinge at hips, pull to belly button" },
    { name: "Lat Pulldown", sets: "3x12", tip: "Lean back slightly, pull to chest" },
    { name: "Seated Cable Row", sets: "3x12", tip: "Squeeze shoulder blades together" },
  ],
  quads: [
    { name: "Back Squat", sets: "4x8", tip: "Break at hips and knees simultaneously" },
    { name: "Leg Press", sets: "4x10", tip: "Feet shoulder-width, do not lock knees" },
    { name: "Lunges", sets: "3x12 each", tip: "Front shin vertical, torso upright" },
    { name: "Leg Extension", sets: "3x15", tip: "Slow on the way down, squeeze at top" },
    { name: "Bulgarian Split Squat", sets: "3x10 each", tip: "Back foot elevated, drop straight down" },
  ],
  hamstrings: [
    { name: "Romanian Deadlift", sets: "4x10", tip: "Hinge at hips, feel hamstring stretch" },
    { name: "Lying Leg Curl", sets: "4x12", tip: "Full range, control the return" },
    { name: "Stiff-Leg Deadlift", sets: "3x10", tip: "Keep legs nearly straight" },
    { name: "Nordic Curl", sets: "3x6", tip: "One of the best hamstring builders" },
    { name: "Good Mornings", sets: "3x12", tip: "Light weight, focus on hip hinge" },
  ],
  glutes: [
    { name: "Hip Thrust", sets: "4x12", tip: "Drive through heels, squeeze at top" },
    { name: "Glute Bridge", sets: "3x15", tip: "Hold 2s at top, full hip extension" },
    { name: "Cable Kickback", sets: "3x15 each", tip: "Keep hips level, squeeze hard" },
    { name: "Sumo Deadlift", sets: "4x8", tip: "Wide stance, toes out 45 degrees" },
    { name: "Step-Ups", sets: "3x12 each", tip: "Drive through heel of elevated foot" },
  ],
  calves: [
    { name: "Standing Calf Raise", sets: "4x15", tip: "Full stretch at bottom, pause at top", gym: true, home: true },
    { name: "Seated Calf Raise", sets: "4x20", tip: "Slow tempo, constant tension", gym: true, home: false },
    { name: "Donkey Calf Raise", sets: "3x15", tip: "Bent-over position stretches gastroc more", gym: true, home: true },
    { name: "Single-Leg Calf Raise", sets: "3x12 each", tip: "Hold wall for balance only", gym: true, home: true },
  ],
};

// Home-only exercise alternatives
const HOME_WORKOUTS = {
  chest: [
    { name: "Push-Ups", sets: "4x20", tip: "Hands shoulder-width, lower chest to floor" },
    { name: "Wide Push-Ups", sets: "3x15", tip: "Wide grip targets outer chest" },
    { name: "Diamond Push-Ups", sets: "3x12", tip: "Hands touching under chest, targets inner pec" },
    { name: "Decline Push-Ups", sets: "3x15", tip: "Feet elevated on chair targets upper chest" },
    { name: "Pike Push-Up", sets: "3x12", tip: "Hips high, targets shoulders and chest" },
  ],
  shoulders: [
    { name: "Pike Push-Up", sets: "4x12", tip: "Hips high in inverted V position" },
    { name: "Wall Handstand Hold", sets: "3x20s", tip: "Build pressing strength safely" },
    { name: "Lateral Raises (Water Bottles)", sets: "4x15", tip: "Use filled bottles as weights" },
    { name: "Arnold Press (Water Bottles)", sets: "3x12", tip: "Rotate palms as you press" },
    { name: "Rear Delt Circle", sets: "3x20", tip: "Arms out, small circles, feel the burn" },
  ],
  biceps: [
    { name: "Towel Curl", sets: "4x12", tip: "Loop towel under foot, curl up with both hands" },
    { name: "Backpack Curl", sets: "3x15", tip: "Fill a bag with books for resistance" },
    { name: "Isometric Bicep Hold", sets: "3x30s", tip: "Pull up on a table edge, hold" },
    { name: "Chin-Ups (door frame)", sets: "3x8", tip: "Use a door pull-up bar if available" },
    { name: "Hammer Curl (Bottles)", sets: "3x15", tip: "Neutral grip with water bottles" },
  ],
  triceps: [
    { name: "Chair Dips", sets: "4x15", tip: "Hands on chair behind you, lower body down" },
    { name: "Diamond Push-Ups", sets: "3x15", tip: "Hands close together under chest" },
    { name: "Tricep Push-Up", sets: "3x12", tip: "Elbows tight to sides throughout" },
    { name: "Overhead Tricep Extension (Bottle)", sets: "3x15", tip: "One arm at a time, keep elbow high" },
    { name: "Floor Tricep Press", sets: "3x12", tip: "Lower forearms to floor then press up" },
  ],
  abs: [
    { name: "Plank", sets: "3x60s", tip: "Squeeze glutes and brace core hard" },
    { name: "Crunches", sets: "4x25", tip: "Hands behind head, crunch up not sit up" },
    { name: "Leg Raises", sets: "4x15", tip: "Lying flat, raise legs to 90 degrees" },
    { name: "Mountain Climbers", sets: "3x30s", tip: "Fast pace for cardio effect" },
    { name: "Russian Twists", sets: "3x20", tip: "Feet off floor, twist side to side" },
  ],
  back: [
    { name: "Superman Hold", sets: "4x15", tip: "Lie face down, lift arms and legs together" },
    { name: "Door Pull-Up", sets: "4x8", tip: "Use a doorframe pull-up bar" },
    { name: "Towel Row", sets: "3x15", tip: "Loop towel around door handle, lean back and row" },
    { name: "Good Mornings (bodyweight)", sets: "3x20", tip: "Hinge at hips, feel hamstring and lower back" },
    { name: "Bird Dog", sets: "3x12 each", tip: "On all fours, extend opposite arm and leg" },
  ],
  quads: [
    { name: "Bodyweight Squat", sets: "4x20", tip: "Sit back into the squat, chest up" },
    { name: "Jump Squat", sets: "3x15", tip: "Explode up, land softly" },
    { name: "Lunges", sets: "3x15 each", tip: "Long step, front shin vertical" },
    { name: "Wall Sit", sets: "3x45s", tip: "Thighs parallel to floor, back flat" },
    { name: "Step-Ups (chair)", sets: "3x15 each", tip: "Drive through heel as you step up" },
  ],
  hamstrings: [
    { name: "Romanian Deadlift (Backpack)", sets: "3x15", tip: "Hinge at hips, feel the stretch" },
    { name: "Nordic Curl (sofa)", sets: "3x6", tip: "Hook feet under sofa, lower slowly" },
    { name: "Single-Leg Deadlift", sets: "3x12 each", tip: "Balance challenge, hinge with control" },
    { name: "Glute Bridge", sets: "4x20", tip: "Drive hips up, squeeze at the top" },
    { name: "Reverse Lunge", sets: "3x15 each", tip: "Step back, drop knee close to floor" },
  ],
  glutes: [
    { name: "Glute Bridge", sets: "4x20", tip: "Push through heels, hold 2s at top" },
    { name: "Donkey Kicks", sets: "4x15 each", tip: "On all fours, kick heel to ceiling" },
    { name: "Fire Hydrant", sets: "3x20 each", tip: "On all fours, lift knee out to side" },
    { name: "Single-Leg Glute Bridge", sets: "3x15 each", tip: "One leg extended, drive hip up" },
    { name: "Sumo Squat", sets: "4x15", tip: "Wide stance, toes out 45 degrees, squat deep" },
  ],
  calves: [
    { name: "Standing Calf Raise", sets: "4x25", tip: "Use a step for full range of motion" },
    { name: "Single-Leg Calf Raise", sets: "3x20 each", tip: "Hold wall for balance only" },
    { name: "Jump Rope (or mimic)", sets: "3x60s", tip: "Stay on toes throughout" },
    { name: "Stair Calf Raise", sets: "4x20", tip: "Use bottom step, full range" },
  ],
};

// YouTube search URLs — open in new tab, no embed blocking
function getVideoUrl(exerciseName) {
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(exerciseName + " exercise tutorial form");
}

function buildFallbackWorkout(muscleKey, profile) {
  const equipment = profile.equipment || "gym";
  const source = equipment === "home"
    ? (HOME_WORKOUTS[muscleKey] || WORKOUT_DB[muscleKey] || [])
    : WORKOUT_DB[muscleKey] || [];
  const goal = profile.goal;
  const picked = source.slice(0, goal === "lose" ? 5 : 4);
  const adjusted = picked.map(ex => {
    let sets = ex.sets;
    if (goal === "lose") sets = sets.replace(/x(\d+)/, (m, n) => `x${parseInt(n) + 2}`);
    if (goal === "muscle") sets = sets.replace(/(\d+)x/, (m, n) => `${Math.min(5, parseInt(n) + 1)}x`);
    return { ...ex, sets };
  });
  return adjusted;
}

// ── SUBCOMPONENTS ─────────────────────────────────────────────────────────

function MacroBar({ label, value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const over = value > max;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: T.sub }}>{label}</span>
        <span style={{ color: over ? T.coral : T.text, fontWeight: 600 }}>
          {value}g / {max}g {over && "⚠"}
        </span>
      </div>
      <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: over ? T.coral : color,
            borderRadius: 3,
            transition: "width .4s ease",
          }}
        />
      </div>
    </div>
  );
}

function Card({ title, children, accent }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${accent || T.border}`,
        borderRadius: 16,
        padding: "20px 22px",
        marginBottom: 18,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: accent || T.lime,
            marginBottom: 14,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", small, disabled, style: sx = {} }) {
  const bg = variant === "primary" ? T.lime : variant === "danger" ? T.coral : T.border;
  const col = variant === "primary" ? "#000" : T.text;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? T.border : bg,
        color: disabled ? T.muted : col,
        border: "none",
        borderRadius: 10,
        padding: small ? "7px 14px" : "11px 20px",
        fontSize: small ? 12 : 14,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity .2s",
        ...sx,
      }}
    >
      {children}
    </button>
  );
}

// ── BODY SVG SELECTOR ─────────────────────────────────────────────────────
function BodySelector({ onSelect, sex = "male" }) {
  const [hovered, setHovered] = useState(null);
  const [view, setView] = useState("front");

  const frontMuscles = ["chest", "shoulders", "biceps", "abs", "quads", "calves"];
  const backMuscles = ["back", "triceps", "hamstrings", "glutes"];
  const shown = view === "front" ? frontMuscles : backMuscles;

  // ── MALE front silhouette (broad shoulders, narrow waist, flat chest)
  const maleFrontBody = `
    M174,68 Q174,52 200,48 Q226,52 226,68
    L238,72 Q252,76 254,92 L258,115 Q260,128 250,132
    L246,158 Q248,180 246,210 L248,255 L244,310
    L240,345 Q238,358 228,360 L222,360 L220,375 L200,375 L180,375
    L178,360 L172,360 Q162,358 160,345
    L156,310 L152,255 L154,210 L152,158
    L150,132 Q140,128 142,115 L146,92 Q148,76 162,72 Z
  `;
  const maleFrontHead = { cx: 200, cy: 38, rx: 18, ry: 20 };

  // ── MALE back silhouette
  const maleBackBody = maleFrontBody;
  const maleBackHead = maleFrontHead;

  // ── FEMALE front silhouette (narrower shoulders, wider hips, defined waist)
  const femaleFrontBody = `
    M178,68 Q178,52 200,48 Q222,52 222,68
    L232,72 Q244,76 246,90 L250,112 Q252,124 242,128
    L240,148 Q244,162 242,174 Q240,186 228,192
    L232,215 Q240,238 242,268 L240,310
    L236,345 Q234,358 224,360 L218,360 L216,375 L200,375 L184,375
    L182,360 L176,360 Q166,358 164,345
    L160,310 L158,268 Q160,238 168,215
    L172,192 Q160,186 158,174 Q156,162 160,148
    L158,128 Q148,124 150,112 L154,90 Q156,76 168,72 Z
  `;
  const femaleFrontHead = { cx: 200, cy: 37, rx: 16, ry: 19 };

  const isMale = sex !== "female"; // prefer_not defaults to male silhouette
  const bodyPath = view === "front"
    ? (isMale ? maleFrontBody : femaleFrontBody)
    : (isMale ? maleBackBody : femaleFrontBody);
  const headProps = isMale ? maleFrontHead : femaleFrontHead;

  // Hair for female
  const femaleHair = `M184,24 Q186,14 200,12 Q214,14 216,24 Q220,18 218,28 Q212,20 200,18 Q188,20 182,28 Q180,18 184,24 Z`;

  // Muscle zone positions — slightly adjusted per sex
  const maleZones = {
    chest:      { x: 181, y: 98,  w: 38, h: 32, label: "Chest" },
    shoulders:  { x: 148, y: 72,  w: 24, h: 24, label: "Shoulders" },
    biceps:     { x: 143, y: 118, w: 18, h: 32, label: "Biceps" },
    abs:        { x: 182, y: 142, w: 36, h: 44, label: "Abs" },
    quads:      { x: 158, y: 215, w: 52, h: 50, label: "Quads" },
    calves:     { x: 159, y: 298, w: 50, h: 38, label: "Calves" },
    back:       { x: 181, y: 93,  w: 38, h: 58, label: "Back" },
    triceps:    { x: 143, y: 116, w: 16, h: 30, label: "Triceps" },
    hamstrings: { x: 158, y: 225, w: 52, h: 46, label: "Hamstrings" },
    glutes:     { x: 181, y: 198, w: 38, h: 30, label: "Glutes" },
  };

  const femaleZones = {
    chest:      { x: 183, y: 100, w: 34, h: 28, label: "Chest" },
    shoulders:  { x: 152, y: 72,  w: 22, h: 22, label: "Shoulders" },
    biceps:     { x: 146, y: 118, w: 16, h: 30, label: "Biceps" },
    abs:        { x: 183, y: 142, w: 34, h: 38, label: "Abs" },
    quads:      { x: 160, y: 218, w: 50, h: 48, label: "Quads" },
    calves:     { x: 161, y: 296, w: 48, h: 38, label: "Calves" },
    back:       { x: 183, y: 95,  w: 34, h: 52, label: "Back" },
    triceps:    { x: 146, y: 116, w: 15, h: 28, label: "Triceps" },
    hamstrings: { x: 160, y: 228, w: 50, h: 44, label: "Hamstrings" },
    glutes:     { x: 183, y: 200, w: 34, h: 32, label: "Glutes" },
  };

  const zones = isMale ? maleZones : femaleZones;

  return (
    <div>
      {/* Gender indicator */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
        padding: "8px 12px", background: T.surface, borderRadius: 10,
        border: `1px solid ${T.border}`
      }}>
        <span style={{ fontSize: 22 }}>{isMale ? "♂" : "♀"}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: isMale ? T.blue : T.purple }}>
            {isMale ? "Male Body" : "Female Body"}
          </div>
          <div style={{ fontSize: 10, color: T.muted }}>
            Based on your profile · change in Profile tab
          </div>
        </div>
      </div>

      {/* Front / Back toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["front", "back"].map((v) => (
          <Btn key={v} variant={view === v ? "primary" : "ghost"} small onClick={() => setView(v)}>
            {v === "front" ? "Front View" : "Back View"}
          </Btn>
        ))}
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: 320, margin: "0 auto" }}>
        <svg viewBox="130 5 140 385" width="100%" style={{ display: "block" }}>
          {/* Glow bg */}
          <defs>
            <radialGradient id="bodyglow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={isMale ? T.blue : T.purple} stopOpacity="0.08" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="url(#bodyglow)" />

          {/* Body silhouette */}
          <path d={bodyPath} fill="#252525" stroke={isMale ? T.blue : T.purple} strokeWidth="1.5" strokeOpacity="0.6" />

          {/* Head */}
          <ellipse
            cx={headProps.cx} cy={headProps.cy}
            rx={headProps.rx} ry={headProps.ry}
            fill="#252525" stroke={isMale ? T.blue : T.purple} strokeWidth="1.5" strokeOpacity="0.6"
          />

          {/* Neck */}
          <rect x="194" y={headProps.cy + headProps.ry - 2} width="12" height="14"
            fill="#252525" stroke={isMale ? T.blue : T.purple} strokeWidth="1" strokeOpacity="0.4" />

          {/* Female hair */}
          {!isMale && (
            <path d={femaleHair} fill={T.purple} fillOpacity="0.5" stroke={T.purple} strokeWidth="1" strokeOpacity="0.7" />
          )}

          {/* Male facial detail - jaw line hint */}
          {isMale && (
            <path
              d={`M${headProps.cx - 10},${headProps.cy + 8} Q${headProps.cx},${headProps.cy + headProps.ry + 2} ${headProps.cx + 10},${headProps.cy + 8}`}
              fill="none" stroke={T.blue} strokeWidth="1" strokeOpacity="0.3"
            />
          )}

          {/* Female body curves - hip/waist lines */}
          {!isMale && view === "front" && (
            <>
              <path d="M172,192 Q162,200 164,215" fill="none" stroke={T.purple} strokeWidth="1.5" strokeOpacity="0.4" />
              <path d="M228,192 Q238,200 236,215" fill="none" stroke={T.purple} strokeWidth="1.5" strokeOpacity="0.4" />
            </>
          )}

          {/* Male body lines - pec/ab definition */}
          {isMale && view === "front" && (
            <>
              <line x1="200" y1="100" x2="200" y2="186" stroke={T.blue} strokeWidth="1" strokeOpacity="0.2" />
              <line x1="182" y1="132" x2="218" y2="132" stroke={T.blue} strokeWidth="1" strokeOpacity="0.2" />
            </>
          )}

          {/* Muscle zones */}
          {shown.map((key) => {
            const z = zones[key];
            if (!z) return null;
            const isHov = hovered === key;
            const accentCol = isMale ? T.blue : T.purple;
            return (
              <g key={key}>
                <rect
                  x={z.x} y={z.y} width={z.w} height={z.h}
                  rx="7"
                  fill={isHov ? accentCol : "#3A3A3A"}
                  fillOpacity={isHov ? 0.88 : 0.55}
                  stroke={isHov ? accentCol : T.border}
                  strokeWidth={isHov ? 2 : 1}
                  style={{ cursor: "pointer", transition: "all .15s" }}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelect(key)}
                />
                <text
                  x={z.x + z.w / 2} y={z.y + z.h / 2 + 4}
                  textAnchor="middle" fontSize="7.5"
                  fill={isHov ? "#fff" : T.sub}
                  style={{ pointerEvents: "none", fontWeight: 700, letterSpacing: ".03em" }}
                >
                  {z.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hovered ? (
        <div style={{
          fontSize: 12, color: T.sub, marginTop: 10, textAlign: "center",
          padding: "8px 12px", background: T.surface, borderRadius: 8
        }}>
          Tap <strong style={{ color: isMale ? T.blue : T.purple }}>{MUSCLE_GROUPS[hovered]?.label}</strong> to generate a personalised workout
        </div>
      ) : (
        <div style={{ fontSize: 12, color: T.muted, marginTop: 10, textAlign: "center" }}>
          Hover or tap a muscle zone
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────
export default function FitTrackPro() {
  // Profile
  const [profile, setProfile] = useState(() => {
    try { const s = localStorage.getItem("fittrack_profile"); return s ? JSON.parse(s) : { name: "", weight: "", height: "", age: "", sex: "male", activity: "moderate", goal: "muscle", bodyFat: "", desiredWeight: "", desiredBodyFat: "", equipment: "gym" }; }
    catch { return { name: "", weight: "", height: "", age: "", sex: "male", activity: "moderate", goal: "muscle", bodyFat: "", desiredWeight: "", desiredBodyFat: "", equipment: "gym" }; }
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // Tabs
  const [tab, setTab] = useState("dashboard");

  // Today's log — persisted
  const todayKey = "fittrack_food_" + new Date().toISOString().slice(0,10);
  const exKey = "fittrack_ex_" + new Date().toISOString().slice(0,10);
  const [foodLog, setFoodLog] = useState(() => {
    try { const s = localStorage.getItem(todayKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [exerciseLog, setExerciseLog] = useState(() => {
    try { const s = localStorage.getItem(exKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // Drink picker
  const [selectedDrink, setSelectedDrink] = useState(null);

  // Photo AI
  const [photoResult, setPhotoResult] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileRef = useRef();

  // Workout AI
  const [muscleSelected, setMuscleSelected] = useState(null);
  const [workoutPlan, setWorkoutPlan] = useState("");
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workoutTab, setWorkoutTab] = useState("ai"); // "ai" | "custom"
  const [customInput, setCustomInput] = useState("");
  const [customPlan, setCustomPlan] = useState([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [savedWorkouts, setSavedWorkouts] = useState(() => {
    try { const s = localStorage.getItem("fittrack_saved_workouts"); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // Overflow AI
  const [overflowPlan, setOverflowPlan] = useState("");
  const [overflowLoading, setOverflowLoading] = useState(false);

  // Manual food entry
  const [manualFood, setManualFood] = useState({ name: "", cal: "", protein: "", carbs: "", fat: "" });

  // ── Computed values ────────────────────────────────────────────────────
  const bmi = calcBMI(profile.weight, profile.height);
  const bmiCat = bmiCategory(bmi);
  const dailyCalories = tdee(profile.weight, profile.height, profile.age, profile.sex, profile.activity);
  const adjustedCalories =
    profile.goal === "muscle" ? dailyCalories + 300 :
    profile.goal === "lose" ? dailyCalories - 500 : dailyCalories;
  const proteinG = proteinTarget(profile.weight || 75, profile.goal);
  const carbsG = Math.round(((adjustedCalories * 0.45) / 4));
  const fatG = Math.round(((adjustedCalories * 0.25) / 9));

  const totals = foodLog.reduce(
    (acc, item) => ({
      cal: acc.cal + (item.cal || 0),
      protein: acc.protein + (item.protein || 0),
      carbs: acc.carbs + (item.carbs || 0),
      fat: acc.fat + (item.fat || 0),
    }),
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const calOver = totals.cal > adjustedCalories;
  const proteinOver = totals.protein > proteinG;

  // ── Handlers ──────────────────────────────────────────────────────────
  function addFood(item) {
    setFoodLog((f) => {
      const next = [...f, { ...item, id: Date.now() }];
      try { localStorage.setItem(todayKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function removeFood(id) {
    setFoodLog((f) => {
      const next = f.filter((x) => x.id !== id);
      try { localStorage.setItem(todayKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoLoading(true);
    setPhotoResult(null);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(",")[1];
        const mime = file.type;
        const result = await analyseImage(base64, mime);
        setPhotoResult(result);
        setPhotoLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setPhotoLoading(false);
    }
  }

  async function handleMuscleSelect(key) {
    setMuscleSelected(key);
    setWorkoutLoading(true);
    setWorkoutPlan("");
    setWorkoutExercises([]);
    setTab("workout");
    const mg = MUSCLE_GROUPS[key];

    // Always build fallback immediately so user sees something instantly
    const fallback = buildFallbackWorkout(key, profile);
    setWorkoutExercises(fallback);
    setWorkoutLoading(false);

    // Try AI enhancement in background
    const prompt = `The user wants to train their ${mg.label}.
Profile: Goal=${profile.goal}, BMI=${bmi}(${bmiCat}), Weight=${profile.weight}kg, Activity=${profile.activity}.
${profile.desiredWeight ? "Desired weight: " + profile.desiredWeight + "kg." : ""}
${profile.desiredBodyFat ? "Desired body fat: " + profile.desiredBodyFat + "%." : ""}
Give a 2-sentence personalised coaching note for this specific person doing ${mg.label} training. Be direct and motivating. Max 60 words.`;
    const aiNote = await callClaude([{ role: "user", content: prompt }]);
    if (aiNote) setWorkoutPlan(aiNote);
  }

  async function handleCustomWorkout() {
    if (!customInput.trim()) return;
    setCustomLoading(true);
    setCustomPlan([]);

    // Try AI first
    const equipLabel = profile.equipment === "home" ? "home (no equipment, bodyweight only)" : profile.equipment === "both" ? "gym or home" : "gym (full equipment)";
    const prompt = `The user wants to do this workout: "${customInput}"
Their profile: Goal=${profile.goal}, Weight=${profile.weight}kg, BMI=${bmi}, Equipment: ${equipLabel}.
${profile.desiredWeight ? "Desired weight: " + profile.desiredWeight + "kg." : ""}
${profile.desiredBodyFat ? "Desired body fat: " + profile.desiredBodyFat + "%." : ""}
IMPORTANT: Only suggest exercises appropriate for ${equipLabel}.
Return ONLY a JSON array of 4-6 exercise objects like:
[{"name":"Exercise Name","sets":"3x12","tip":"coaching tip here"}]
No markdown, no explanation, just the JSON array.`;

    const aiResult = await callClaude([{ role: "user", content: prompt }]);
    let exercises = [];
    if (aiResult) {
      try {
        const clean = aiResult.replace(/\`\`\`json|\`\`\`/g, "").trim();
        exercises = JSON.parse(clean);
      } catch {}
    }

    // Fallback: parse keywords and match from WORKOUT_DB
    if (!exercises.length) {
      const input = customInput.toLowerCase();
      const allExercises = Object.values(WORKOUT_DB).flat();
      exercises = allExercises.filter(ex =>
        input.split(/\s+/).some(word => ex.name.toLowerCase().includes(word))
      ).slice(0, 5);
      if (!exercises.length) {
        // Generic fallback based on goal
        exercises = buildFallbackWorkout("abs", profile).concat(buildFallbackWorkout("chest", profile)).slice(0, 5);
      }
    }

    setCustomPlan(exercises);
    setCustomLoading(false);
  }

  async function handleOverflowPlan() {
    setOverflowLoading(true);
    setOverflowPlan("");
    const exceeded = [];
    if (totals.cal > adjustedCalories)
      exceeded.push(`Calories exceeded by ${totals.cal - adjustedCalories}kcal`);
    if (totals.protein > proteinG)
      exceeded.push(`Protein exceeded by ${totals.protein - proteinG}g`);
    if (totals.carbs > carbsG)
      exceeded.push(`Carbs exceeded by ${totals.carbs - carbsG}g`);
    if (totals.fat > fatG)
      exceeded.push(`Fat exceeded by ${totals.fat - fatG}g`);

    const prompt = `A person has exceeded their daily targets. Here is their situation:
Goal: ${profile.goal === "muscle" ? "Build muscle" : profile.goal === "lose" ? "Lose weight" : "Maintain weight"}
BMI: ${bmi} (${bmiCat})
${profile.desiredWeight ? "Desired weight: " + profile.desiredWeight + "kg (currently " + profile.weight + "kg)" : ""}
${profile.desiredBodyFat ? "Desired body fat: " + profile.desiredBodyFat + "% (currently " + (profile.bodyFat || "unknown") + "%)" : ""}
What they exceeded: ${exceeded.join(", ")}
Today's food log: ${foodLog.map((f) => f.name).join(", ")}
Exercise done today: ${exerciseLog.join(", ") || "None"}

Give them:
1. A brief explanation of what this means for their specific goal and desired targets
2. 2-3 practical ways to balance this (not guilt-tripping)
3. A specific bonus workout to help offset the excess, tailored to their goal
Keep it supportive, direct, and actionable. Max 250 words.`;

    const plan = await callClaude([{ role: "user", content: prompt }]);
    setOverflowPlan(plan);
    setOverflowLoading(false);
  }

  // ── Nav ───────────────────────────────────────────────────────────────
  const tabs = [
    { id: "dashboard", label: "Today" },
    { id: "log", label: "Log Food" },
    { id: "body", label: "Muscles" },
    { id: "workout", label: "Workout" },
    { id: "profile", label: "Profile" },
  ];

  function saveProfile() {
    try { localStorage.setItem("fittrack_profile", JSON.stringify(profile)); } catch {}
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: T.bg,
        minHeight: "100vh",
        color: T.text,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        maxWidth: 480,
        margin: "0 auto",
        position: "relative",
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: "18px 22px 14px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: T.lime, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.01em" }}>FitTrack Pro</div>
            {profile.name && <div style={{ fontSize: 11, color: T.sub }}>Hey, {profile.name} 👋</div>}
          </div>
          {bmi && (
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.lime }}>{bmi}</div>
              <div style={{ fontSize: 10, color: T.sub }}>BMI · {bmiCat}</div>
              {profile.desiredWeight && <div style={{ fontSize: 10, color: T.purple }}>🎯 {profile.desiredWeight}kg goal</div>}
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ padding: "20px 16px 0" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            {/* Calorie ring summary */}
            <Card accent={calOver ? T.coral : T.lime}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {/* Circle */}
                <svg width="90" height="90" viewBox="0 0 90 90">
                  <circle cx="45" cy="45" r="38" fill="none" stroke={T.border} strokeWidth="7" />
                  <circle
                    cx="45" cy="45" r="38" fill="none"
                    stroke={calOver ? T.coral : T.lime} strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 38}
                    strokeDashoffset={2 * Math.PI * 38 * (1 - Math.min(1, totals.cal / adjustedCalories))}
                    strokeLinecap="round"
                    transform="rotate(-90 45 45)"
                    style={{ transition: "stroke-dashoffset .6s ease" }}
                  />
                  <text x="45" y="41" textAnchor="middle" fontSize="14" fontWeight="800" fill={T.text}>{totals.cal}</text>
                  <text x="45" y="54" textAnchor="middle" fontSize="9" fill={T.sub}>/ {adjustedCalories}</text>
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>Today's macros</div>
                  <MacroBar label="Protein" value={totals.protein} max={proteinG} color={T.blue} />
                  <MacroBar label="Carbs" value={totals.carbs} max={carbsG} color={T.purple} />
                  <MacroBar label="Fat" value={totals.fat} max={fatG} color="#FFB347" />
                </div>
              </div>
              {calOver && (
                <div style={{ marginTop: 14 }}>
                  <Btn onClick={() => { setTab("dashboard"); handleOverflowPlan(); }} variant="danger" style={{ width: "100%" }} disabled={overflowLoading}>
                    {overflowLoading ? "Analysing..." : "⚠ Over target — get a recovery plan"}
                  </Btn>
                </div>
              )}
            </Card>

            {/* Overflow plan */}
            {overflowPlan && (
              <Card title="Recovery Plan" accent={T.coral}>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: T.sub, whiteSpace: "pre-wrap" }}>
                  {overflowPlan}
                </div>
              </Card>
            )}

            {/* Today's log */}
            <Card title="Food Log">
              {foodLog.length === 0 ? (
                <div style={{ fontSize: 13, color: T.muted, textAlign: "center", padding: "14px 0" }}>
                  Nothing logged yet — tap <strong style={{ color: T.lime }}>Log Food</strong>
                </div>
              ) : (
                foodLog.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 0", borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: T.sub }}>
                        P:{item.protein}g · C:{item.carbs}g · F:{item.fat}g
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.lime }}>{item.cal}kcal</span>
                      <button
                        onClick={() => removeFood(item.id)}
                        style={{ background: "none", border: "none", color: T.coral, cursor: "pointer", fontSize: 16 }}
                      >×</button>
                    </div>
                  </div>
                ))
              )}
            </Card>

            {/* Exercises today */}
            <Card title="Exercises Today">
              {exerciseLog.length === 0 ? (
                <div style={{ fontSize: 13, color: T.muted, textAlign: "center", padding: "8px 0" }}>
                  No exercises logged
                </div>
              ) : (
                exerciseLog.map((e, i) => (
                  <div key={i} style={{ fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                    ✅ {e}
                  </div>
                ))
              )}
            </Card>
          </div>
        )}

        {/* ── LOG FOOD ── */}
        {tab === "log" && (
          <div>
            {/* Drink picker */}
            <Card title="Add a Drink / Energy Drink">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DRINKS.map((d) => (
                  <div
                    key={d.name}
                    onClick={() => setSelectedDrink(d)}
                    style={{
                      padding: "10px 14px",
                      background: selectedDrink?.name === d.name ? "#2A2A2A" : T.surface,
                      border: `1px solid ${selectedDrink?.name === d.name ? T.lime : T.border}`,
                      borderRadius: 10,
                      cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                    <span style={{ fontSize: 12, color: T.sub }}>{d.cal}kcal</span>
                  </div>
                ))}
              </div>
              {selectedDrink && (
                <div style={{ marginTop: 12, padding: "12px 14px", background: T.surface, borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{selectedDrink.name}</div>
                  <div style={{ fontSize: 12, color: T.sub, marginBottom: 10 }}>
                    P:{selectedDrink.protein}g · C:{selectedDrink.carbs}g · F:{selectedDrink.fat}g
                  </div>
                  <Btn onClick={() => { addFood(selectedDrink); setSelectedDrink(null); }} style={{ width: "100%" }}>
                    + Add to Log
                  </Btn>
                </div>
              )}
            </Card>

            {/* Photo AI */}
            <Card title="📷 Snap & Track with AI">
              <div
                onClick={() => fileRef.current.click()}
                style={{
                  border: `2px dashed ${T.border}`,
                  borderRadius: 12,
                  padding: "28px",
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: 12,
                  background: "#181818",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                <div style={{ fontSize: 13, color: T.sub }}>
                  Take a photo or upload your meal — AI will estimate the macros
                </div>
              </div>
              <input
                type="file" accept="image/*" capture="environment"
                ref={fileRef} style={{ display: "none" }}
                onChange={handlePhoto}
              />
              {photoLoading && (
                <div style={{ textAlign: "center", padding: 16, color: T.sub, fontSize: 13 }}>
                  🔍 Analysing your meal...
                </div>
              )}
              {photoResult && (
                <div style={{ padding: "14px", background: T.surface, borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{photoResult.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
                    {[
                      { l: "Calories", v: photoResult.calories, u: "kcal" },
                      { l: "Protein", v: photoResult.protein, u: "g" },
                      { l: "Carbs", v: photoResult.carbs, u: "g" },
                      { l: "Fat", v: photoResult.fat, u: "g" },
                    ].map((m) => (
                      <div key={m.l} style={{ background: T.card, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: T.lime }}>{m.v}</div>
                        <div style={{ fontSize: 10, color: T.sub }}>{m.u}</div>
                        <div style={{ fontSize: 10, color: T.muted }}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: T.sub, marginBottom: 10 }}>
                    Confidence: <strong>{photoResult.confidence}</strong> · {photoResult.notes}
                  </div>
                  <Btn
                    onClick={() => {
                      addFood({
                        name: photoResult.name, cal: photoResult.calories,
                        protein: photoResult.protein, carbs: photoResult.carbs, fat: photoResult.fat,
                      });
                      setPhotoResult(null);
                    }}
                    style={{ width: "100%" }}
                  >
                    + Add to Log
                  </Btn>
                </div>
              )}
            </Card>

            {/* Manual entry */}
            <Card title="Manual Entry">
              {["name", "cal", "protein", "carbs", "fat"].map((field) => (
                <input
                  key={field}
                  placeholder={field === "name" ? "Food name" : `${field.charAt(0).toUpperCase() + field.slice(1)} (${field === "cal" ? "kcal" : "g"})`}
                  value={manualFood[field]}
                  onChange={(e) => setManualFood((m) => ({ ...m, [field]: e.target.value }))}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: T.surface, border: `1px solid ${T.border}`,
                    color: T.text, borderRadius: 10, padding: "10px 14px",
                    fontSize: 13, marginBottom: 8, outline: "none",
                  }}
                />
              ))}
              <Btn
                onClick={() => {
                  if (!manualFood.name) return;
                  addFood({
                    name: manualFood.name,
                    cal: +manualFood.cal || 0,
                    protein: +manualFood.protein || 0,
                    carbs: +manualFood.carbs || 0,
                    fat: +manualFood.fat || 0,
                  });
                  setManualFood({ name: "", cal: "", protein: "", carbs: "", fat: "" });
                }}
                style={{ width: "100%" }}
              >
                + Add Entry
              </Btn>
            </Card>
          </div>
        )}

        {/* ── MUSCLES ── */}
        {tab === "body" && (
          <div>
            <Card title="Select a Muscle to Train">
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, padding:"8px 12px", background:T.surface, borderRadius:8, border:`1px solid ${T.border}` }}>
                <span style={{ fontSize:18 }}>
                  {profile.equipment === "gym" ? "🏋" : profile.equipment === "home" ? "🏠" : "🔀"}
                </span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.lime }}>
                    {profile.equipment === "gym" ? "Gym Workouts" : profile.equipment === "home" ? "Home Workouts (no equipment)" : "Gym + Home Mix"}
                  </div>
                  <div style={{ fontSize:10, color:T.muted }}>Change in Profile tab</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }}>
                Tap a highlighted zone to get a personalised workout for that muscle group.
              </div>
              <BodySelector onSelect={handleMuscleSelect} sex={profile.sex} />
            </Card>

            {/* Quick muscle buttons */}
            <Card title="Quick Select">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(MUSCLE_GROUPS).map(([key, mg]) => (
                  <Btn key={key} small onClick={() => handleMuscleSelect(key)} variant="ghost">
                    {mg.label}
                  </Btn>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── WORKOUT ── */}
        {tab === "workout" && (
          <div>
            {/* Equipment badge + Sub-tabs */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, padding:"8px 12px", background:T.surface, borderRadius:8, border:`1px solid ${T.border}` }}>
              <span style={{ fontSize:16 }}>
                {profile.equipment === "gym" ? "🏋" : profile.equipment === "home" ? "🏠" : "🔀"}
              </span>
              <span style={{ fontSize:12, color:T.sub }}>
                {profile.equipment === "gym" ? "Gym mode" : profile.equipment === "home" ? "Home mode — no equipment needed" : "Gym + Home mix"}
              </span>
              <span
                onClick={() => setTab("profile")}
                style={{ marginLeft:"auto", fontSize:11, color:T.lime, cursor:"pointer", fontWeight:600 }}
              >
                Change →
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[{id:"ai",label:"💪 AI Workout"},{id:"custom",label:"✏️ Build My Own"}].map(t => (
                <button key={t.id} onClick={() => setWorkoutTab(t.id)} style={{
                  flex:1, padding:"10px 0", borderRadius:10, border:"none", cursor:"pointer",
                  fontWeight:700, fontSize:13,
                  background: workoutTab===t.id ? T.lime : T.card,
                  color: workoutTab===t.id ? "#000" : T.sub,
                  borderBottom: workoutTab===t.id ? "none" : `1px solid ${T.border}`,
                }}>{t.label}</button>
              ))}
            </div>

            {/* ── AI WORKOUT SUB-TAB ── */}
            {workoutTab === "ai" && (
              <div>
                {workoutLoading ? (
                  <Card accent={T.blue}>
                    <div style={{padding:"28px 0",textAlign:"center",color:T.sub}}>
                      <div style={{fontSize:28,marginBottom:10}}>⚡</div>
                      Building your workout plan...
                    </div>
                  </Card>
                ) : workoutExercises.length > 0 ? (
                  <div>
                    <Card title={`${MUSCLE_GROUPS[muscleSelected]?.label || ""} Workout`} accent={T.blue}>
                      {workoutPlan && (
                        <div style={{fontSize:13,lineHeight:1.7,color:T.lime,marginBottom:14,padding:"10px 12px",background:T.surface,borderRadius:8}}>
                          🤖 {workoutPlan}
                        </div>
                      )}
                      {workoutExercises.map((ex, i) => (
                        <div key={i} style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${T.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                            <div>
                              <div style={{fontWeight:700,fontSize:14}}>{ex.name}</div>
                              <div style={{fontSize:12,color:T.lime,fontWeight:600}}>{ex.sets}</div>
                            </div>
                            <div style={{fontSize:10,color:T.muted,background:T.surface,padding:"3px 7px",borderRadius:6}}>Exercise {i+1}</div>
                          </div>
                          <div style={{fontSize:12,color:T.sub,marginBottom:8}}>💡 {ex.tip}</div>
                          <a href={getVideoUrl(ex.name)} target="_blank" rel="noreferrer" style={{
                            display:"inline-flex", alignItems:"center", gap:6,
                            background:"#FF0000", color:"#fff", borderRadius:8,
                            padding:"6px 12px", fontSize:12, fontWeight:700,
                            textDecoration:"none", marginTop:4
                          }}>
                            ▶ Watch on YouTube
                          </a>
                        </div>
                      ))}
                      <div style={{display:"flex",gap:8,marginTop:4}}>
                        <Btn small onClick={() => {
                          const names = workoutExercises.map(e => `${e.name} ${e.sets} (${MUSCLE_GROUPS[muscleSelected]?.label || "Workout"})`);
                          setExerciseLog(l => {
                            const next = [...l, ...names];
                            try { localStorage.setItem(exKey, JSON.stringify(next)); } catch {}
                            return next;
                          });
                        }}>✓ Log this workout</Btn>
                        <Btn small variant="ghost" onClick={() => {
                          const w = { name: `${MUSCLE_GROUPS[muscleSelected]?.label} Workout`, exercises: workoutExercises, date: new Date().toLocaleDateString() };
                          setSavedWorkouts(s => {
                            const next = [w, ...s].slice(0, 10);
                            try { localStorage.setItem("fittrack_saved_workouts", JSON.stringify(next)); } catch {}
                            return next;
                          });
                        }}>💾 Save workout</Btn>
                        <Btn small variant="ghost" onClick={() => { setMuscleSelected(null); setWorkoutExercises([]); setTab("body"); }}>
                          Change
                        </Btn>
                      </div>
                    </Card>

                    {/* Saved workouts */}
                    {savedWorkouts.length > 0 && (
                      <Card title="Saved Workouts">
                        {savedWorkouts.map((w, i) => (
                          <div key={i} onClick={() => setWorkoutExercises(w.exercises)} style={{
                            padding:"10px 12px", borderRadius:8, background:T.surface, marginBottom:8, cursor:"pointer",
                            border:`1px solid ${T.border}`
                          }}>
                            <div style={{fontWeight:600,fontSize:13}}>{w.name}</div>
                            <div style={{fontSize:11,color:T.muted}}>{w.date} · {w.exercises.length} exercises</div>
                          </div>
                        ))}
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card>
                    <div style={{textAlign:"center",padding:"28px 0"}}>
                      <div style={{fontSize:32,marginBottom:10}}>💪</div>
                      <div style={{fontSize:14,color:T.sub,marginBottom:14}}>
                        Go to <strong style={{color:T.lime}}>Muscles</strong> and tap a body part to generate your workout
                      </div>
                      <Btn onClick={() => setTab("body")}>Select Muscle Group</Btn>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ── CUSTOM WORKOUT SUB-TAB ── */}
            {workoutTab === "custom" && (
              <div>
                <Card title="Build Your Own Workout" accent={T.purple}>
                  <div style={{fontSize:13,color:T.sub,marginBottom:12}}>
                    Type what you want to train — e.g. "chest and triceps", "leg day", "full body HIIT", "back and biceps"
                  </div>
                  <textarea
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    placeholder="e.g. I want to do chest and biceps today, I have dumbbells and a bench"
                    rows={3}
                    style={{
                      width:"100%", boxSizing:"border-box",
                      background:T.surface, border:`1px solid ${T.border}`,
                      color:T.text, borderRadius:10, padding:"12px 14px",
                      fontSize:13, outline:"none", resize:"none", marginBottom:10,
                    }}
                  />
                  <Btn onClick={handleCustomWorkout} disabled={customLoading} style={{width:"100%"}}>
                    {customLoading ? "Building your workout..." : "⚡ Generate Workout"}
                  </Btn>
                </Card>

                {customPlan.length > 0 && (
                  <Card title="Your Custom Workout" accent={T.lime}>
                    {customPlan.map((ex, i) => (
                      <div key={i} style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${T.border}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:14}}>{ex.name}</div>
                            <div style={{fontSize:12,color:T.lime,fontWeight:600}}>{ex.sets}</div>
                          </div>
                        </div>
                        {ex.tip && <div style={{fontSize:12,color:T.sub,marginBottom:8}}>💡 {ex.tip}</div>}
                        <a href={getVideoUrl(ex.name)} target="_blank" rel="noreferrer" style={{
                          display:"inline-flex", alignItems:"center", gap:6,
                          background:"#FF0000", color:"#fff", borderRadius:8,
                          padding:"6px 12px", fontSize:12, fontWeight:700,
                          textDecoration:"none", marginTop:4
                        }}>
                          ▶ Watch on YouTube
                        </a>
                      </div>
                    ))}
                    <div style={{display:"flex",gap:8}}>
                      <Btn small onClick={() => {
                        const names = customPlan.map(e => `${e.name} ${e.sets}`);
                        setExerciseLog(l => {
                          const next = [...l, ...names];
                          try { localStorage.setItem(exKey, JSON.stringify(next)); } catch {}
                          return next;
                        });
                      }}>✓ Log this workout</Btn>
                      <Btn small variant="ghost" onClick={() => {
                        const w = { name: customInput.slice(0,30), exercises: customPlan, date: new Date().toLocaleDateString() };
                        setSavedWorkouts(s => {
                          const next = [w, ...s].slice(0, 10);
                          try { localStorage.setItem("fittrack_saved_workouts", JSON.stringify(next)); } catch {}
                          return next;
                        });
                      }}>💾 Save workout</Btn>
                    </div>
                  </Card>
                )}

                {savedWorkouts.length > 0 && (
                  <Card title="Saved Workouts">
                    {savedWorkouts.map((w, i) => (
                      <div key={i} onClick={() => { setCustomPlan(w.exercises); }} style={{
                        padding:"10px 12px", borderRadius:8, background:T.surface, marginBottom:8, cursor:"pointer",
                        border:`1px solid ${T.border}`
                      }}>
                        <div style={{fontWeight:600,fontSize:13}}>{w.name}</div>
                        <div style={{fontSize:11,color:T.muted}}>{w.date} · {w.exercises.length} exercises · tap to reload</div>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab === "profile" && (
          <div>
            <Card title="Your Profile">
              {[
                { field: "name", label: "Name", type: "text", placeholder: "Your name" },
                { field: "weight", label: "Current Weight (kg)", type: "number", placeholder: "75" },
                { field: "height", label: "Height (cm)", type: "number", placeholder: "175" },
                { field: "age", label: "Age", type: "number", placeholder: "25" },
                { field: "bodyFat", label: "Current Body Fat % (optional)", type: "number", placeholder: "20" },
                { field: "desiredWeight", label: "🎯 Desired Weight (kg)", type: "number", placeholder: "70" },
                { field: "desiredBodyFat", label: "🎯 Desired Body Fat %", type: "number", placeholder: "15" },
              ].map(({ field, label, type, placeholder }) => (
                <div key={field} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: T.sub, display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={profile[field]}
                    onChange={(e) => setProfile((p) => ({ ...p, [field]: e.target.value }))}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: T.surface, border: `1px solid ${T.border}`,
                      color: T.text, borderRadius: 10, padding: "10px 14px",
                      fontSize: 14, outline: "none",
                    }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: T.sub, display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Sex</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {[
                    { v: "male", l: "Male" },
                    { v: "female", l: "Female" },
                    { v: "prefer_not", l: "Prefer not to say" },
                  ].map(({ v, l }) => (
                    <Btn key={v} small variant={profile.sex === v ? "primary" : "ghost"} onClick={() => setProfile((p) => ({ ...p, sex: v }))}>
                      {l}
                    </Btn>
                  ))}
                </div>
                {profile.sex === "prefer_not" && (
                  <div style={{
                    fontSize: 12, lineHeight: 1.6, color: T.sub,
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 8, padding: "10px 12px",
                  }}>
                    ℹ️ For the most accurate calorie, macro and BMR targets, selecting <strong style={{ color: T.lime }}>Male</strong> or <strong style={{ color: T.lime }}>Female</strong> is recommended — biological sex affects how your body burns calories, processes nutrients and builds muscle at any given age and weight. Your choice is only used for calculations and is never shared.
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: T.sub, display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Activity Level</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { v: "sedentary", l: "Sedentary" },
                    { v: "light", l: "Light" },
                    { v: "moderate", l: "Moderate" },
                    { v: "active", l: "Active" },
                    { v: "very", l: "Very Active" },
                  ].map(({ v, l }) => (
                    <Btn key={v} small variant={profile.activity === v ? "primary" : "ghost"} onClick={() => setProfile((p) => ({ ...p, activity: v }))}>
                      {l}
                    </Btn>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: T.sub, display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Goal</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { v: "muscle", l: "Build Muscle" },
                    { v: "lose", l: "Lose Weight" },
                    { v: "maintain", l: "Maintain" },
                  ].map(({ v, l }) => (
                    <Btn key={v} small variant={profile.goal === v ? "primary" : "ghost"} onClick={() => setProfile((p) => ({ ...p, goal: v }))}>
                      {l}
                    </Btn>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: T.sub, display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
                  Where do you train?
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { v: "gym", l: "🏋 Gym", desc: "Full equipment" },
                    { v: "home", l: "🏠 Home", desc: "No equipment" },
                    { v: "both", l: "🔀 Both", desc: "Mix it up" },
                  ].map(({ v, l, desc }) => (
                    <div
                      key={v}
                      onClick={() => setProfile((p) => ({ ...p, equipment: v }))}
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                        background: profile.equipment === v ? T.lime : T.surface,
                        border: `1px solid ${profile.equipment === v ? T.lime : T.border}`,
                      }}
                    >
                      <div style={{ fontSize: 16 }}>{l.split(" ")[0]}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: profile.equipment === v ? "#000" : T.text }}>{l.split(" ")[1]}</div>
                      <div style={{ fontSize: 10, color: profile.equipment === v ? "#333" : T.muted }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <Btn onClick={saveProfile} style={{ width: "100%" }}>Save Profile</Btn>
              {profileSaved && (
                <div style={{ marginTop: 10, fontSize: 12, color: T.lime, textAlign: "center" }}>
                  ✓ Profile saved — workouts and targets updated
                </div>
              )}
            </Card>

            {/* Stats breakdown */}
            {bmi && (
              <Card title="Your Stats" accent={T.purple}>
                {[
                  { l: "BMI", v: `${bmi} — ${bmiCat}` },
                  { l: "Daily Target", v: `${adjustedCalories} kcal` },
                  { l: "Protein Target", v: `${proteinG}g/day` },
                  { l: "Carbs Target", v: `${carbsG}g/day` },
                  { l: "Fat Target", v: `${fatG}g/day` },
                  ...(profile.bodyFat ? [{ l: "Current Body Fat", v: `${profile.bodyFat}%` }] : []),
                  ...(profile.desiredWeight ? [{ l: "🎯 Target Weight", v: `${profile.desiredWeight}kg ${profile.weight ? `(${(profile.weight - profile.desiredWeight) > 0 ? "-" : "+"}${Math.abs(profile.weight - profile.desiredWeight)}kg to go)` : ""}` }] : []),
                  ...(profile.desiredBodyFat ? [{ l: "🎯 Target Body Fat", v: `${profile.desiredBodyFat}%${profile.bodyFat ? ` (${(profile.bodyFat - profile.desiredBodyFat).toFixed(1)}% to lose)` : ""}` }] : []),
                ].map(({ l, v }) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                    <span style={{ color: T.sub }}>{l}</span>
                    <span style={{ fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div
        style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 480,
          background: T.surface,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          zIndex: 20,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, background: "none", border: "none", cursor: "pointer",
              padding: "12px 4px 10px",
              color: tab === t.id ? T.lime : T.muted,
              fontSize: 11, fontWeight: tab === t.id ? 700 : 500,
              borderTop: tab === t.id ? `2px solid ${T.lime}` : "2px solid transparent",
              transition: "color .2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
