// Prashna (horary) rules engine.
// Everything here is plain, deterministic rule-checking on the calculated chart.
// The AI never sees raw rules or does any scoring: it only explains the result in simple words.
//
// Houses are whole-sign (same as chart.js). The answer is always a SOFT signal:
//   anukool (favourable) / mishrit (mixed) / pratikool (unfavourable) - never a guarantee.

export const PRASHNA_RULES_VERSION = 1;

const RASHI_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
// Lord of each sign, Aries..Pisces.
const SIGN_LORD = ["Ma", "Ve", "Me", "Mo", "Su", "Me", "Ve", "Ma", "Ju", "Sa", "Sa", "Ju"];

const PLANET_HI = {
  Su: "Surya", Mo: "Chandra", Ma: "Mangal", Me: "Budh", Ju: "Guru",
  Ve: "Shukra", Sa: "Shani", Ra: "Rahu", Ke: "Ketu",
};

const BENEFICS = new Set(["Ju", "Ve", "Me"]); // Moon is added separately (only when waxing)
const MALEFICS = new Set(["Su", "Ma", "Sa", "Ra", "Ke"]);
// Houses where a malefic planet usually does fine (upachaya: they grow with effort).
const UPACHAYA = new Set([3, 6, 10, 11]);

const GOOD_HOUSES = new Set([1, 4, 5, 7, 9, 10, 11]);
const BAD_HOUSES = new Set([6, 8, 12]);

// Whole-sign aspects (graha drishti) as "n-th house from the planet". Nodes: conjunction only.
const ASPECTS = { Su: [7], Mo: [7], Me: [7], Ve: [7], Ma: [4, 7, 8], Ju: [5, 7, 9], Sa: [3, 7, 10] };

// The raw score is relative: some questions touch more "easy" houses than others, so each
// category has its own cut-offs. They were calibrated by scoring ~2,400 charts spread over
// several years and places, so that roughly 30% of moments read pratikool, ~35% mishrit and
// ~35% anukool. Re-run that calibration whenever the rules below change (bump the version).
//   score <= low  -> pratikool,  score >= high -> anukool,  otherwise mishrit
const THRESHOLDS = {
  lost: { low: 0, high: 3 },
  job: { low: 2.5, high: 5.5 },
  relationship: { low: 0, high: 3 },
  travel: { low: 1, high: 4.5 },
  work: { low: 1.5, high: 4.5 },
};

export const PRASHNA_CATEGORIES = {
  lost: {
    label: "Kho gayi cheez",
    houses: [2, 4], // 2nd (belongings) + 4th (home / safe keeping)
    karakas: [],
    keywords: /\b(kho|khoy|gum|gayab|chori|lost|missing|dhundh|dhoond|nahi\s+mil)\w*|खो|गुम|गायब|चोरी|ढूंढ|ढूँढ/i,
  },
  job: {
    label: "Naukri",
    houses: [6, 10, 11], // service, career, gains
    karakas: ["Su", "Sa"],
    keywords: /\b(naukri|nokri|job|interview|promotion|transfer|resign|offer\s+letter|selection)\w*|नौकरी|इंटरव्यू|प्रमोशन/i,
  },
  relationship: {
    label: "Rishta",
    houses: [7], // partner (the 1st/Moon are always checked)
    karakas: ["Ve"],
    keywords: /\b(rishta|rishte|shaadi|shadi|vivah|marriage|love|pyaar|pyar|breakup|girlfriend|boyfriend|partner|propose|sagai)\w*|रिश्ता|शादी|विवाह|प्यार|सगाई/i,
  },
  travel: {
    label: "Yatra",
    houses: [3, 9, 12], // short trips, long trips, foreign / distant places
    karakas: [],
    keywords: /\b(yatra|safar|travel|trip|visa|abroad|videsh|flight|tour|journey|pardes)\w*|यात्रा|सफर|विदेश|वीज़ा|वीजा/i,
  },
  work: {
    label: "Kaam hoga ya nahi",
    houses: [10, 11], // action + fulfilment; the 1st, its lord and the Moon are always checked
    karakas: [],
    keywords: null, // default
  },
};

export const CATEGORY_KEYS = Object.keys(PRASHNA_CATEGORIES);

/** Pick a category from the question text. Order matters: most specific first. */
export function detectCategory(question) {
  const text = String(question ?? "").normalize("NFC");
  for (const key of ["lost", "job", "relationship", "travel"]) {
    if (PRASHNA_CATEGORIES[key].keywords.test(text)) return key;
  }
  return "work";
}

// ----------------------------------------------------------- chart access ----

const ordinal = (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const bhav = (n) => `${ordinal(n)} bhav`;

function chartIndex(chart) {
  const byCode = new Map(chart.planets.map((p) => [p.code, p]));
  const lagnaIdx = RASHI_NAMES.indexOf(chart.lagna);
  if (lagnaIdx < 0) throw new Error("Chart has no lagna.");
  const rashiOfHouse = (h) => (lagnaIdx + h - 1) % 12;
  const lordOfHouse = (h) => byCode.get(SIGN_LORD[rashiOfHouse(h)]);
  const occupants = (h) => chart.planets.filter((p) => p.house === h);
  /** Houses a planet looks at, whole-sign (the planet's own house is not included). */
  const aspectedHouses = (p) =>
    (ASPECTS[p.code] ?? []).map((n) => ((p.house - 1 + (n - 1)) % 12) + 1);
  const aspectorsOf = (h) => chart.planets.filter((p) => aspectedHouses(p).includes(h));
  return { byCode, lagnaIdx, rashiOfHouse, lordOfHouse, occupants, aspectorsOf, aspectedHouses };
}

const housePoints = (h) => (GOOD_HOUSES.has(h) ? 1 : BAD_HOUSES.has(h) ? -1 : 0);

// ------------------------------------------------------------ evaluation ----

/**
 * Evaluate a prashna chart for one category.
 * @param {object} chart  result of buildEventChart() (needs planets, lagna, panchang)
 * @param {string} category  key of PRASHNA_CATEGORIES
 */
export function evaluatePrashna(chart, category) {
  const cat = PRASHNA_CATEGORIES[category];
  if (!cat) throw new Error(`Unknown prashna category "${category}".`);

  const ix = chartIndex(chart);
  const factors = [];
  const add = (key, points, text) => {
    if (points !== 0) factors.push({ key, points, effect: points > 0 ? "+" : "-", text });
  };

  // --- 1) Lagna lord: the person / the question itself ------------------------------------
  const lagnaLord = ix.lordOfHouse(1);
  {
    const q = housePoints(lagnaLord.house);
    add(
      "lagnesh-house",
      q * 1.5,
      q > 0
        ? `Lagnesh ${PLANET_HI[lagnaLord.code]} ${bhav(lagnaLord.house)} mein hai (madadgaar sthaan): sawal poochhne wale ka paksh mazboot dikhta hai.`
        : `Lagnesh ${PLANET_HI[lagnaLord.code]} ${bhav(lagnaLord.house)} mein hai (mushkil wala sthaan): koshish mein rukawat ya thakaan ka sanket.`,
    );
  }

  // --- 2) Lagna (1st house) occupants -----------------------------------------------------
  for (const p of ix.occupants(1)) {
    if (BENEFICS.has(p.code)) add(`lagna-${p.code}`, 1, `Lagna mein ${PLANET_HI[p.code]} hai: shubh sahara.`);
    else if (MALEFICS.has(p.code)) add(`lagna-${p.code}`, -1, `Lagna mein ${PLANET_HI[p.code]} hai: thoda dabaav ya jaldbaazi ka sanket.`);
  }

  // --- 3) Moon: the mind and the course of the matter -------------------------------------
  const moon = ix.byCode.get("Mo");
  {
    const q = housePoints(moon.house);
    add(
      "moon-house",
      q * 1.5,
      q > 0
        ? `Chandra ${bhav(moon.house)} mein hai (madadgaar sthaan): mann sthir aur baat ka rukh sahayak.`
        : `Chandra ${bhav(moon.house)} mein hai (mushkil wala sthaan): mann mein uljhan ya baat mein rukawat ka sanket.`,
    );
    const waxing = chart.panchang?.tithi?.paksha === "Shukla";
    add(
      "moon-phase",
      waxing ? 0.5 : -0.5,
      waxing ? "Chandra badh raha hai (Shukla paksha): kaam ko badhawa dene wala samay." : "Chandra ghat raha hai (Krishna paksha): kaam dheere ya mehnat se banne ka sanket.",
    );
  }

  // --- 4) The houses that matter for THIS question ----------------------------------------
  const facts = [];
  for (const h of cat.houses) {
    const lord = ix.lordOfHouse(h);
    const occ = ix.occupants(h);
    facts.push({
      house: h,
      rashi: RASHI_NAMES[ix.rashiOfHouse(h)],
      lord: { code: lord.code, name: PLANET_HI[lord.code], house: lord.house },
      occupants: occ.map((p) => ({ code: p.code, name: PLANET_HI[p.code] })),
    });

    // lord of that house: where is it?
    const lq = housePoints(lord.house);
    add(
      `lord-${h}`,
      lq,
      lq > 0
        ? `${bhav(h)} ke swami ${PLANET_HI[lord.code]} ${bhav(lord.house)} mein hain: is maamle ko sahara milta dikhta hai.`
        : `${bhav(h)} ke swami ${PLANET_HI[lord.code]} ${bhav(lord.house)} mein hain: is maamle mein rukawat ya deri ka sanket.`,
    );

    // link between lagna lord and that house lord (same house, or facing each other)
    if (lord.code !== lagnaLord.code) {
      const together = lord.house === lagnaLord.house;
      const facing = Math.abs(lord.house - lagnaLord.house) === 6;
      if (together || facing) {
        add(
          `link-${h}`,
          1,
          `Lagnesh aur ${bhav(h)} ke swami ${together ? "ek hi bhav mein hain" : "ek-doosre ke saamne hain"}: sawal aur uske natije ke beech jodd bana hua hai.`,
        );
      }
    }

    // planets sitting in that house
    for (const p of occ) {
      if (BENEFICS.has(p.code)) add(`occ-${h}-${p.code}`, 1, `${bhav(h)} mein ${PLANET_HI[p.code]} hai: shubh sahara.`);
      else if (MALEFICS.has(p.code) && !UPACHAYA.has(h)) {
        add(`occ-${h}-${p.code}`, -1, `${bhav(h)} mein ${PLANET_HI[p.code]} hai: yahan ye rukawat ya tanav ka sanket deta hai.`);
      }
    }

    // planets looking at that house
    for (const p of ix.aspectorsOf(h)) {
      if (p.code === "Ju") add(`asp-${h}-Ju`, 1, `Guru ki drishti ${bhav(h)} par hai: margdarshan aur sahara.`);
      else if ((p.code === "Sa" || p.code === "Ma") && !UPACHAYA.has(h)) {
        add(`asp-${h}-${p.code}`, -0.5, `${PLANET_HI[p.code]} ki drishti ${bhav(h)} par hai: thodi rukawat ya deri ka sanket.`);
      }
    }
  }

  // --- 5) Natural significators (karakas) for this question -------------------------------
  for (const code of cat.karakas) {
    const p = ix.byCode.get(code);
    const q = housePoints(p.house);
    add(
      `karaka-${code}`,
      q * 0.5,
      q > 0
        ? `${PLANET_HI[code]} (is vishay ka karak) ${bhav(p.house)} mein hai: sahayak sthiti.`
        : `${PLANET_HI[code]} (is vishay ka karak) ${bhav(p.house)} mein hai: kamzor sthiti.`,
    );
  }

  const total = Math.round(factors.reduce((s, f) => s + f.points, 0) * 10) / 10;
  const { low, high } = THRESHOLDS[category];
  const verdict = total >= high ? "anukool" : total <= low ? "pratikool" : "mishrit";

  factors.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  return {
    version: PRASHNA_RULES_VERSION,
    category,
    categoryLabel: cat.label,
    verdict,
    score: total,
    factors: factors.slice(0, 8),
    facts: {
      lagna: chart.lagna,
      lagnesh: { code: lagnaLord.code, name: PLANET_HI[lagnaLord.code], house: lagnaLord.house },
      moon: { rashi: moon.rashi, house: moon.house, nakshatra: moon.nakshatra, pada: moon.pada },
      houses: facts,
    },
  };
}