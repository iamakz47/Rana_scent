import type { Localized } from "@/i18n/config";
import type { Category, Product, ProductImage } from "./types";

// SAMPLE CATALOG for the visual prototype. Device photos are Rana Scent's
// own; names, prices, stock and specifications are PROVISIONAL assumptions
// until Rana Scent supplies the real details. Replaced by Supabase data in
// Phase 3.

// Real product photography (public/images/products), processed for the web.
const PHOTO = {
  mini: "/images/products/rana-mini.jpg",
  aura: "/images/products/rana-aura.jpg",
  auraSide: "/images/products/rana-aura-side.jpg",
  majlis: "/images/products/rana-majlis.jpg",
  tower: "/images/products/rana-tower.jpg",
  aromaOil: "/images/products/aroma-oil-500ml.jpg",
};

function photos(name: Localized, srcs: string[]): ProductImage[] {
  return srcs.map((src, index) => ({
    src,
    alt: {
      ar: index === 0 ? name.ar : `${name.ar}: زاوية ${index + 1}`,
      en: index === 0 ? name.en : `${name.en}: view ${index + 1}`,
    },
  }));
}

const spec = (label: Localized, value: Localized) => ({ label, value });

const ALL_DEVICES = ["rana-mini", "rana-aura", "rana-majlis", "rana-tower", "rana-drive"];

export const categories: Category[] = [
  {
    slug: "diffusers",
    type: "diffuser",
    name: { ar: "الفواحات الإلكترونية", en: "Electronic Diffusers" },
    description: {
      ar: "فواحات تنشر العطر بهدوء في المجلس والبيت والسيارة.",
      en: "Devices that carry fragrance quietly through majlis, home and car.",
    },
    image: { src: PHOTO.aura, alt: { ar: "فواح رنا أورا", en: "Rana Aura diffuser" } },
    position: 0,
    enabled: true,
    showOnHome: true,
  },
  {
    slug: "refills",
    type: "refill",
    name: { ar: "عبوات العطر", en: "Fragrance Refills" },
    description: {
      ar: "عبوات عطرية مصممة لفواحات رنا سنت.",
      en: "Fragrance cartridges made for Rana Scent diffusers.",
    },
    image: { src: PHOTO.aromaOil, alt: { ar: "عبوة زيت عطري 500 مل", en: "500 ml aroma oil refill" } },
    position: 1,
    enabled: true,
    showOnHome: true,
  },
  {
    slug: "accessories",
    type: "accessory",
    name: { ar: "إكسسوارات الفواحات", en: "Diffuser Accessories" },
    description: {
      ar: "قطع تكمل تجربة التعطير.",
      en: "Pieces that complete the ritual.",
    },
    position: 2,
    enabled: true,
    showOnHome: true,
  },
  {
    slug: "bundles",
    type: "bundle",
    name: { ar: "المجموعات", en: "Sets" },
    description: {
      ar: "فواح وعطور مختارة في مجموعة واحدة.",
      en: "A diffuser and chosen fragrances, together.",
    },
    position: 3,
    enabled: true,
    showOnHome: false,
  },
];

function refill(
  id: string,
  slug: string,
  family: NonNullable<Product["scentFamily"]>,
  name: Localized,
  tagline: Localized,
  notes: NonNullable<Product["notes"]>,
  priceFils: number,
  stock: [number, number],
  extra: Partial<Product> = {},
): Product {
  return {
    id,
    slug,
    type: "refill",
    name,
    tagline,
    description: {
      ar: `${tagline.ar} زيت عطري مصمم لفواحات رنا سنت.`,
      en: `${tagline.en} Aroma oil made for Rana Scent diffusers.`,
    },
    scentFamily: family,
    notes,
    compatibleWith: ALL_DEVICES,
    spaces: ["majlis", "living", "bedroom", "office", "car"],
    // Every scent ships in the same Aroma Oil bottle, so they share a photo.
    images: photos(name, [PHOTO.aromaOil]),
    variants: [
      {
        id: `${id}-200`,
        sku: `RS-${id.toUpperCase()}-200`,
        label: { ar: "200 مل", en: "200 ml" },
        priceFils,
        stock: stock[0],
      },
      {
        id: `${id}-500`,
        sku: `RS-${id.toUpperCase()}-500`,
        label: { ar: "500 مل", en: "500 ml" },
        priceFils: priceFils * 2,
        stock: stock[1],
      },
    ],
    isSample: true,
    ...extra,
  };
}

export const products: Product[] = [
  {
    id: "dev-tower",
    slug: "rana-tower",
    type: "diffuser",
    name: { ar: "رنا تاور", en: "Rana Tower" },
    tagline: { ar: "حضور عطري يملأ المكان.", en: "A presence that fills the room." },
    description: {
      ar: "فواح أرضي بتصميم عمودي من الأسود اللامع والبرونز، للمجالس والصالات الواسعة.",
      en: "A floor-standing tower in gloss black and bronze, for majlis and generous halls.",
    },
    compatibleWith: [],
    spaces: ["majlis", "living", "office"],
    images: photos({ ar: "رنا تاور", en: "Rana Tower" }, [PHOTO.tower]),
    variants: [
      {
        id: "dev-tower-bronze",
        sku: "RS-DEV-TOWER-BRZ",
        label: { ar: "أسود وبرونز", en: "Black & bronze" },
        priceFils: 119000,
        stock: 4,
      },
    ],
    specs: [
      spec({ ar: "النوع", en: "Type" }, { ar: "فواح أرضي", en: "Floor-standing diffuser" }),
      spec({ ar: "التغطية", en: "Coverage" }, { ar: "حتى 1,000 م²", en: "Up to 1,000 m²" }),
      spec({ ar: "سعة العبوة", en: "Refill" }, { ar: "زيت عطري 500 مل", en: "500 ml aroma oil" }),
      spec({ ar: "التحكم", en: "Controls" }, { ar: "زر لمس", en: "Touch button" }),
      spec({ ar: "اللون", en: "Finish" }, { ar: "أسود لامع مع جوانب برونزية", en: "Gloss black with bronze sides" }),
    ],
    featured: true,
    isNew: true,
    isSample: true,
  },
  {
    id: "dev-majlis",
    slug: "rana-majlis",
    type: "diffuser",
    name: { ar: "رنا مجلس", en: "Rana Majlis" },
    tagline: { ar: "تحكم كامل بأجواء المجلس.", en: "Complete control of the majlis atmosphere." },
    description: {
      ar: "فواح للمساحات الكبيرة بواجهة زجاجية سوداء وشاشة لبرمجة أوقات التعطير.",
      en: "A large-space diffuser with a black glass face and a display for scheduling.",
    },
    compatibleWith: [],
    spaces: ["majlis", "office", "living"],
    images: photos({ ar: "رنا مجلس", en: "Rana Majlis" }, [PHOTO.majlis]),
    variants: [
      {
        id: "dev-majlis-black",
        sku: "RS-DEV-MAJLIS-BLK",
        label: { ar: "أسود", en: "Black" },
        priceFils: 79000,
        stock: 9,
      },
    ],
    specs: [
      spec({ ar: "النوع", en: "Type" }, { ar: "فواح للمساحات الكبيرة", en: "Large-space diffuser" }),
      spec({ ar: "التغطية", en: "Coverage" }, { ar: "حتى 500 م²", en: "Up to 500 m²" }),
      spec({ ar: "الشاشة", en: "Display" }, { ar: "شاشة LCD ومؤقت قابل للبرمجة", en: "LCD with programmable timer" }),
      spec({ ar: "سعة العبوة", en: "Refill" }, { ar: "500 مل", en: "500 ml" }),
      spec({ ar: "التركيب", en: "Installation" }, { ar: "قائم أو معلّق على الجدار", en: "Freestanding or wall-mounted" }),
      spec({ ar: "اللون", en: "Finish" }, { ar: "زجاج أسود", en: "Black glass" }),
    ],
    featured: true,
    isSample: true,
  },
  {
    id: "dev-aura",
    slug: "rana-aura",
    type: "diffuser",
    name: { ar: "رنا أورا", en: "Rana Aura" },
    tagline: { ar: "ذكاء العطر في كل غرفة.", en: "Smart fragrance, room by room." },
    description: {
      ar: "فواح يُركّب في مقبس الكهرباء بلوحة لمس لضبط شدة العطر وأوضاع النهار والليل.",
      en: "A plug-in diffuser with a touch panel for intensity and day and night modes.",
    },
    compatibleWith: [],
    spaces: ["living", "bedroom", "office"],
    images: photos({ ar: "رنا أورا", en: "Rana Aura" }, [PHOTO.aura, PHOTO.auraSide]),
    variants: [
      {
        id: "dev-aura-champagne",
        sku: "RS-DEV-AURA-CHP",
        label: { ar: "شامبين", en: "Champagne" },
        priceFils: 29000,
        stock: 18,
      },
    ],
    specs: [
      spec({ ar: "النوع", en: "Type" }, { ar: "فواح ذكي يُركّب في المقبس", en: "Smart plug-in diffuser" }),
      spec({ ar: "التغطية", en: "Coverage" }, { ar: "حتى 120 م²", en: "Up to 120 m²" }),
      spec({ ar: "التحكم", en: "Controls" }, { ar: "لوحة لمس وأربع درجات شدة", en: "Touch panel, 4 intensity levels" }),
      spec({ ar: "الأوضاع", en: "Modes" }, { ar: "نهار وليل، وتحكم عبر التطبيق", en: "Day and night, app control" }),
      spec({ ar: "القابس", en: "Plug" }, { ar: "قابس بريطاني ثلاثي", en: "UK 3-pin (Type G)" }),
      spec({ ar: "سعة العبوة", en: "Refill" }, { ar: "150 مل", en: "150 ml" }),
    ],
    featured: true,
    isSample: true,
  },
  {
    id: "dev-mini",
    slug: "rana-mini",
    type: "diffuser",
    name: { ar: "رنا ميني", en: "Rana Mini" },
    tagline: { ar: "عطر هادئ للمساحات الصغيرة.", en: "Quiet fragrance for smaller spaces." },
    description: {
      ar: "فواح أبيض صغير يُركّب مباشرة في مقبس الكهرباء، لغرف النوم والمكاتب.",
      en: "A compact white diffuser that plugs straight into the wall, for bedrooms and studies.",
    },
    compatibleWith: [],
    spaces: ["bedroom", "office"],
    images: photos({ ar: "رنا ميني", en: "Rana Mini" }, [PHOTO.mini]),
    variants: [
      {
        id: "dev-mini-white",
        sku: "RS-DEV-MINI-WHT",
        label: { ar: "أبيض", en: "White" },
        priceFils: 15000,
        stock: 30,
      },
    ],
    specs: [
      spec({ ar: "النوع", en: "Type" }, { ar: "فواح يُركّب في المقبس", en: "Plug-in diffuser" }),
      spec({ ar: "التغطية", en: "Coverage" }, { ar: "حتى 40 م²", en: "Up to 40 m²" }),
      spec({ ar: "الشدة", en: "Intensity" }, { ar: "قابلة للتعديل", en: "Adjustable" }),
      spec({ ar: "القابس", en: "Plug" }, { ar: "قابس بريطاني ثلاثي", en: "UK 3-pin (Type G)" }),
      spec({ ar: "سعة العبوة", en: "Refill" }, { ar: "100 مل", en: "100 ml" }),
      spec({ ar: "اللون", en: "Finish" }, { ar: "أبيض لامع", en: "Gloss white" }),
    ],
    featured: true,
    isNew: true,
    isSample: true,
  },
  {
    id: "dev-drive",
    slug: "rana-drive",
    type: "diffuser",
    name: { ar: "رنا درايف", en: "Rana Drive" },
    tagline: { ar: "عطرك يرافقك في الطريق.", en: "Your signature, on the road." },
    description: {
      ar: "فواح للسيارة بتصميم أنيق. الصور والمواصفات ستُضاف عند اعتمادها.",
      en: "An elegant diffuser for the car. Photos and specifications will be added once confirmed.",
    },
    compatibleWith: ["vent-mount"],
    spaces: ["car"],
    images: [],
    variants: [
      {
        id: "dev-drive-gold",
        sku: "RS-DEV-DRIVE-GLD",
        label: { ar: "ذهبي", en: "Gold" },
        priceFils: 39000,
        stock: 0,
      },
      {
        id: "dev-drive-graphite",
        sku: "RS-DEV-DRIVE-GRP",
        label: { ar: "جرافيت", en: "Graphite" },
        priceFils: 39000,
        stock: 15,
      },
    ],
    isSample: true,
  },
  refill(
    "oud-royale",
    "oud-royale",
    "oud",
    { ar: "عود رويال", en: "Oud Royale" },
    { ar: "دخان العود الدافئ بلمسة زعفران.", en: "Warm oud smoke with a thread of saffron." },
    {
      top: { ar: "زعفران", en: "Saffron" },
      heart: { ar: "ورد طائفي", en: "Taif rose" },
      base: { ar: "عود، عنبر", en: "Oud, amber" },
    },
    14500,
    [40, 12],
    { featured: true },
  ),
  refill(
    "midnight-musk",
    "midnight-musk",
    "musk",
    { ar: "مسك منتصف الليل", en: "Midnight Musk" },
    { ar: "مسك أبيض ناعم كالحرير.", en: "Soft white musk, like silk." },
    {
      top: { ar: "كمثرى", en: "Pear" },
      heart: { ar: "زهر البرتقال", en: "Orange blossom" },
      base: { ar: "مسك أبيض", en: "White musk" },
    },
    11500,
    [32, 4],
    { isNew: true },
  ),
  refill(
    "white-jasmine",
    "white-jasmine",
    "floral",
    { ar: "ياسمين أبيض", en: "White Jasmine" },
    { ar: "ياسمين ليلي مضيء.", en: "Luminous night jasmine." },
    {
      top: { ar: "برغموت", en: "Bergamot" },
      heart: { ar: "ياسمين", en: "Jasmine" },
      base: { ar: "خشب الصندل", en: "Sandalwood" },
    },
    10500,
    [18, 8],
  ),
  refill(
    "damask-rose",
    "damask-rose",
    "floral",
    { ar: "ورد دمشقي", en: "Damask Rose" },
    { ar: "ورد مخملي بعمق الشرق.", en: "Velvet rose with eastern depth." },
    {
      top: { ar: "ليتشي", en: "Lychee" },
      heart: { ar: "ورد دمشقي", en: "Damask rose" },
      base: { ar: "باتشولي", en: "Patchouli" },
    },
    12000,
    [3, 0],
  ),
  refill(
    "sea-salt-vetiver",
    "sea-salt-vetiver",
    "fresh",
    { ar: "ملح البحر والفيتيفر", en: "Sea Salt Vetiver" },
    { ar: "نسيم الخليج المنعش.", en: "A fresh breeze off the Gulf." },
    {
      top: { ar: "ملح البحر", en: "Sea salt" },
      heart: { ar: "مريمية", en: "Sage" },
      base: { ar: "فيتيفر", en: "Vetiver" },
    },
    9500,
    [26, 10],
  ),
  refill(
    "cedar-smoke",
    "cedar-smoke",
    "woody",
    { ar: "دخان الأرز", en: "Cedar Smoke" },
    { ar: "خشب الأرز الجاف ولمسة جلد.", en: "Dry cedar with a trace of leather." },
    {
      top: { ar: "فلفل وردي", en: "Pink pepper" },
      heart: { ar: "أرز", en: "Cedarwood" },
      base: { ar: "جلد، فانيلا", en: "Leather, vanilla" },
    },
    13000,
    [14, 6],
    { featured: true },
  ),
  {
    id: "set-majlis",
    slug: "majlis-signature-set",
    type: "bundle",
    name: { ar: "مجموعة المجلس", en: "Majlis Signature Set" },
    tagline: {
      ar: "جهاز رنا مجلس مع عبوتين من العود والمسك.",
      en: "Rana Majlis with Oud Royale and Midnight Musk.",
    },
    description: {
      ar: "كل ما تحتاجه لمجلس معطر: الجهاز وعبوتان مختارتان.",
      en: "Everything a fragrant majlis needs: the device and two chosen refills.",
    },
    bundleContents: [
      { slug: "rana-majlis", quantity: 1 },
      { slug: "oud-royale", quantity: 1 },
      { slug: "midnight-musk", quantity: 1 },
    ],
    compatibleWith: [],
    spaces: ["majlis", "living"],
    images: [],
    variants: [
      {
        id: "set-majlis-std",
        sku: "RS-SET-MAJLIS",
        label: { ar: "المجموعة", en: "Set" },
        priceFils: 145000,
        compareAtFils: 155000,
        stock: 7,
      },
    ],
    featured: true,
    isSample: true,
  },
  {
    id: "set-discovery",
    slug: "discovery-trio",
    type: "bundle",
    name: { ar: "ثلاثية الاكتشاف", en: "Discovery Trio" },
    tagline: {
      ar: "ثلاث عائلات عطرية لتجد توقيعك.",
      en: "Three fragrance families to find your signature.",
    },
    description: {
      ar: "عود رويال، ياسمين أبيض، ملح البحر والفيتيفر.",
      en: "Oud Royale, White Jasmine and Sea Salt Vetiver.",
    },
    bundleContents: [
      { slug: "oud-royale", quantity: 1 },
      { slug: "white-jasmine", quantity: 1 },
      { slug: "sea-salt-vetiver", quantity: 1 },
    ],
    compatibleWith: ALL_DEVICES,
    spaces: ["majlis", "living", "bedroom", "office", "car"],
    images: [],
    variants: [
      {
        id: "set-discovery-std",
        sku: "RS-SET-TRIO",
        label: { ar: "المجموعة", en: "Set" },
        priceFils: 31000,
        compareAtFils: 34500,
        stock: 20,
      },
    ],
    isNew: true,
    isSample: true,
  },
  {
    id: "acc-vent",
    slug: "vent-mount",
    type: "accessory",
    name: { ar: "حامل فتحة التكييف", en: "Vent Mount" },
    tagline: {
      ar: "تثبيت رنا درايف بثبات وأناقة.",
      en: "Holds Rana Drive securely and neatly.",
    },
    description: {
      ar: "حامل لجهاز رنا درايف يثبت على فتحة تكييف السيارة.",
      en: "A mount that fixes Rana Drive to the car's air vent.",
    },
    compatibleWith: ["rana-drive"],
    spaces: ["car"],
    images: [],
    variants: [
      {
        id: "acc-vent-std",
        sku: "RS-ACC-VENT",
        label: { ar: "قياسي", en: "Standard" },
        priceFils: 6500,
        stock: 30,
      },
    ],
    isSample: true,
  },
  {
    id: "acc-case",
    slug: "travel-case",
    type: "accessory",
    name: { ar: "حقيبة السفر", en: "Travel Case" },
    tagline: {
      ar: "حماية لعبواتك أينما ذهبت.",
      en: "Protects your refills wherever you go.",
    },
    description: {
      ar: "حقيبة مبطنة تحمل العبوات خلال السفر.",
      en: "A padded case that carries refills while travelling.",
    },
    compatibleWith: [],
    spaces: ["car"],
    images: [],
    variants: [
      {
        id: "acc-case-std",
        sku: "RS-ACC-CASE",
        label: { ar: "قياسي", en: "Standard" },
        priceFils: 12000,
        stock: 2,
      },
    ],
    isSample: true,
  },
];

// Device pages list the refills that fit them.
for (const product of products) {
  if (product.type === "diffuser") {
    const fits = products
      .filter((p) => p.type === "refill" && p.compatibleWith.includes(product.slug))
      .map((p) => p.slug);
    product.compatibleWith = [...product.compatibleWith, ...fits];
  }
}

// Sample products belong to the category of their type.
for (const product of products) {
  product.categories = categories.filter((category) => category.type === product.type).map((category) => category.slug);
}
