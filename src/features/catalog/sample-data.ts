import type { Localized } from "@/i18n/config";
import type { ArtKind, Category, Product, ProductImage } from "./types";

// SAMPLE CATALOG — placeholder products for the visual prototype. Names,
// prices and stock are illustrative only. Device specifications are
// deliberately omitted until Rana Scent supplies them. Replaced by Supabase
// data in Phase 3.

function images(art: ArtKind, name: Localized): ProductImage[] {
  return [
    { art, view: "front", alt: { ar: `${name.ar} — صورة توضيحية`, en: `${name.en} — illustration` } },
    { art, view: "detail", alt: { ar: `${name.ar} — تفاصيل`, en: `${name.en} — detail` } },
    { art, view: "context", alt: { ar: `${name.ar} — في المكان`, en: `${name.en} — in a room` } },
  ];
}

const ALL_DEVICES = ["rana-majlis", "rana-aura", "rana-drive"];

export const categories: Category[] = [
  {
    slug: "diffusers",
    type: "diffuser",
    name: { ar: "أجهزة التعطير", en: "Diffusers" },
    description: {
      ar: "أجهزة تنشر العطر بهدوء في المجلس والبيت والسيارة.",
      en: "Devices that carry fragrance quietly through majlis, home and car.",
    },
  },
  {
    slug: "refills",
    type: "refill",
    name: { ar: "عبوات العطور", en: "Fragrance refills" },
    description: {
      ar: "عبوات عطرية مصممة لأجهزة رنا سنت.",
      en: "Fragrance cartridges made for Rana Scent devices.",
    },
  },
  {
    slug: "bundles",
    type: "bundle",
    name: { ar: "المجموعات", en: "Sets" },
    description: {
      ar: "جهاز وعطور مختارة في مجموعة واحدة.",
      en: "A device and chosen fragrances, together.",
    },
  },
  {
    slug: "accessories",
    type: "accessory",
    name: { ar: "الإكسسوارات", en: "Accessories" },
    description: {
      ar: "قطع تكمل تجربة التعطير.",
      en: "Pieces that complete the ritual.",
    },
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
      ar: `${tagline.ar} عبوة مصممة لتعمل مع أجهزة رنا سنت المنزلية وجهاز السيارة.`,
      en: `${tagline.en} A cartridge designed for Rana Scent home and car devices.`,
    },
    scentFamily: family,
    notes,
    compatibleWith: ALL_DEVICES,
    spaces: ["majlis", "living", "bedroom", "office", "car"],
    images: images("cartridge", name),
    variants: [
      {
        id: `${id}-single`,
        sku: `RS-${id.toUpperCase()}-1`,
        label: { ar: "عبوة واحدة", en: "Single" },
        priceFils,
        stock: stock[0],
      },
      {
        id: `${id}-twin`,
        sku: `RS-${id.toUpperCase()}-2`,
        label: { ar: "عبوتان", en: "Twin pack" },
        priceFils: priceFils * 2 - 1500,
        compareAtFils: priceFils * 2,
        stock: stock[1],
      },
    ],
    isSample: true,
    ...extra,
  };
}

export const products: Product[] = [
  {
    id: "dev-majlis",
    slug: "rana-majlis",
    type: "diffuser",
    name: { ar: "رنا مجلس", en: "Rana Majlis" },
    tagline: {
      ar: "حضور عطري يليق بالمجلس.",
      en: "A presence worthy of the majlis.",
    },
    description: {
      ar: "جهاز تعطير بتصميم عمودي للمساحات الواسعة واستقبال الضيوف. المواصفات التقنية ستُضاف عند اعتمادها.",
      en: "A tall diffuser for generous rooms and receiving guests. Technical specifications will be added once confirmed.",
    },
    compatibleWith: [],
    spaces: ["majlis", "living", "office"],
    images: images("diffuser-tower", { ar: "رنا مجلس", en: "Rana Majlis" }),
    variants: [
      {
        id: "dev-majlis-gold",
        sku: "RS-DEV-MAJLIS-GLD",
        label: { ar: "ذهبي", en: "Gold" },
        priceFils: 129000,
        stock: 12,
      },
      {
        id: "dev-majlis-onyx",
        sku: "RS-DEV-MAJLIS-ONX",
        label: { ar: "أسود عقيقي", en: "Onyx" },
        priceFils: 129000,
        stock: 3,
      },
    ],
    featured: true,
    isSample: true,
  },
  {
    id: "dev-aura",
    slug: "rana-aura",
    type: "diffuser",
    name: { ar: "رنا أورا", en: "Rana Aura" },
    tagline: {
      ar: "هدوء العطر في كل غرفة.",
      en: "Quiet fragrance, room by room.",
    },
    description: {
      ar: "جهاز تعطير مدمج لغرف المعيشة والنوم والمكاتب. المواصفات التقنية ستُضاف عند اعتمادها.",
      en: "A compact diffuser for living rooms, bedrooms and studies. Technical specifications will be added once confirmed.",
    },
    compatibleWith: [],
    spaces: ["living", "bedroom", "office"],
    images: images("diffuser-compact", { ar: "رنا أورا", en: "Rana Aura" }),
    variants: [
      {
        id: "dev-aura-pearl",
        sku: "RS-DEV-AURA-PRL",
        label: { ar: "لؤلؤي", en: "Pearl" },
        priceFils: 69000,
        stock: 24,
      },
      {
        id: "dev-aura-navy",
        sku: "RS-DEV-AURA-NVY",
        label: { ar: "كحلي", en: "Navy" },
        priceFils: 69000,
        compareAtFils: 79000,
        stock: 9,
      },
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
    tagline: {
      ar: "عطرك يرافقك في الطريق.",
      en: "Your signature, on the road.",
    },
    description: {
      ar: "جهاز تعطير للسيارة بتصميم أنيق. المواصفات التقنية ستُضاف عند اعتمادها.",
      en: "An elegant diffuser for the car. Technical specifications will be added once confirmed.",
    },
    compatibleWith: ["vent-mount"],
    spaces: ["car"],
    images: images("diffuser-car", { ar: "رنا درايف", en: "Rana Drive" }),
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
    featured: true,
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
    images: images("bundle", { ar: "مجموعة المجلس", en: "Majlis Signature Set" }),
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
    images: images("bundle", { ar: "ثلاثية الاكتشاف", en: "Discovery Trio" }),
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
    images: images("accessory", { ar: "حامل فتحة التكييف", en: "Vent Mount" }),
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
    images: images("accessory", { ar: "حقيبة السفر", en: "Travel Case" }),
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
