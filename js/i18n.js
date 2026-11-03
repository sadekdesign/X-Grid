// X-Grid — Arabic interface.
// English stays the source text in index.html. applyLang("ar") swaps every
// static string it knows (text, titles, option and optgroup labels) and sets
// the panel right-to-left; applyLang("en") puts the originals back. Strings
// built in code go through t(), and messages from Illustrator through trMsg().

var LANG = "en";

var AR = {
  // header + settings
  "Show X-Grid guides": "إظهار أدلة X-Grid",
  "Lock X-Grid guides": "قفل أدلة X-Grid",
  "Live grid (follow artboard)": "شبكة حيّة (تتبع لوح الرسم)",
  "Snap to whole pixels": "محاذاة إلى بكسل صحيح",
  "Input Unit": "وحدة القياس",
  "Language": "اللغة",
  "Clear All": "مسح الكل",
  "Click again to clear all X-Grid guides": "اضغط مرة أخرى لمسح كل أدلة X-Grid",
  // tabs
  "Columns": "أعمدة", "Modular": "وحدات", "Baseline": "خط الأساس", "Layout": "تخطيط", "Comp": "تكوين",
  // artboard target
  "Active artboard": "لوح الرسم الحالي",
  "All artboards": "كل ألواح الرسم",
  "Selection (inside selected objects)": "التحديد (داخل العناصر المحددة)",
  "No document open": "لا يوجد مستند مفتوح",
  "Select objects to build the grid inside them": "حدّد عناصر لبناء الشبكة داخلها",
  // fields
  "Preset": "إعداد جاهز", "— select —": "— اختر —",
  "Gutter X": "الفاصل الأفقي", "Gutter": "الفاصل",
  "Margins": "الهوامش", "Top": "أعلى", "Right": "يمين", "Bottom": "أسفل", "Left": "يسار",
  "Preview": "معاينة", "Live Preview": "معاينة حيّة",
  "Generate Grid": "إنشاء الشبكة", "Shapes": "أشكال", "Clear": "مسح",
  "Cols": "أعمدة", "Rows": "صفوف", "Gap": "الفاصل", "Gap X": "فاصل أفقي", "Gap Y": "فاصل رأسي",
  "Direction": "الاتجاه", "Horizontal lines": "خطوط أفقية", "Vertical lines": "خطوط رأسية", "Both": "الاتجاهان",
  "Match selected text": "مطابقة النص المحدد",
  "Spacing": "المسافة", "Bold Every": "خط عريض كل",
  "Grid Type": "نوع الشبكة", "Zones": "المناطق",
  "Group 1 Cols": "أعمدة المجموعة 1", "Group 2 Cols": "أعمدة المجموعة 2",
  "Include horizontal lines": "إضافة خطوط أفقية", "Lines": "الخطوط", "Steps": "الخطوات", "Count": "العدد",
  // layout types
  "Manuscript Grid": "شبكة المخطوطة", "Hierarchical Grid": "شبكة هرمية", "Compound Grid": "شبكة مركّبة",
  "8pt Grid": "شبكة 8pt", "4pt Grid": "شبكة 4pt", "Pixel Grid": "شبكة البكسل", "Responsive Grid": "شبكة متجاوبة",
  "Instagram Post (profile crop)": "منشور Instagram (قصّ البروفايل)", "Instagram Story": "ستوري Instagram",
  "Instagram Reel": "ريلز Instagram", "YouTube Thumbnail": "صورة YouTube المصغّرة",
  // groups
  "Social Safe Zones": "المناطق الآمنة للسوشيال", "Classic": "كلاسيكي", "Dynamic Symmetry": "التماثل الديناميكي",
  "Root Rectangles": "مستطيلات الجذر", "Geometric": "هندسي", "Historical": "تاريخي", "Letter-Shape": "أشكال الحروف",
  "Geometric Patterns": "أنماط هندسية", "Perspective": "منظور", "Typographic": "طباعي", "Cinematic": "سينمائي",
  // comp types
  "Rule of Thirds": "قاعدة الأثلاث", "Phi Grid (Golden Ratio)": "شبكة فاي (النسبة الذهبية)",
  "Golden Spiral": "الحلزون الذهبي", "Quadrants": "الأرباع", "Center Cross": "تقاطع المنتصف",
  "Fibonacci Sections": "تقسيمات فيبوناتشي", "Triangle Composition": "تكوين مثلثي",
  "Harmonic Armature": "الهيكل التوافقي", "Baroque Diagonal": "القطر الباروكي", "Sinister Diagonal": "القطر المعاكس",
  "14-Line Armature": "هيكل الـ 14 خطًا",
  "Root-2 Rectangle": "مستطيل جذر 2", "Root-3 Rectangle": "مستطيل جذر 3",
  "Root-4 Rectangle": "مستطيل جذر 4", "Root-5 Rectangle": "مستطيل جذر 5",
  "Rabatment": "الطيّ (Rabatment)", "Diagonal Cross": "القطران", "Radial Grid": "شبكة شعاعية",
  "Isometric Grid": "شبكة أيزومترية", "Van de Graaf Canon": "قانون Van de Graaf", "Villard Diagram": "مخطط Villard",
  "Tschichold Canon": "قانون Tschichold", "Le Corbusier Modulor": "موديولور Le Corbusier",
  "Steelyard": "الميزان (Steelyard)", "O / Circle": "دائرة O", "L-Shape": "شكل L", "U-Shape": "شكل U",
  "C-Shape": "شكل C", "T-Shape": "شكل T", "Tunnel": "النفق", "S-Curve": "منحنى S", "Z-Pattern": "نمط Z",
  "F-Pattern": "نمط F", "Flower of Life": "زهرة الحياة",
  "1-Point Perspective": "منظور بنقطة واحدة", "2-Point Perspective": "منظور بنقطتين",
  "3-Point Perspective": "منظور بثلاث نقاط", "Axial System": "النظام المحوري",
  "Dilatational": "التمدد", "Safe Areas": "المناطق الآمنة",
  // tooltips
  "Enable / disable plugin": "تشغيل / إيقاف الإضافة",
  "Toggle guide visibility": "إظهار / إخفاء الأدلة",
  "Settings": "الإعدادات",
  "Shows or hides the X-Grid layer. Ctrl+; still toggles all guides.": "يُظهر أو يُخفي طبقة X-Grid. ‏Ctrl+; ما زال يتحكم في كل الأدلة.",
  "Locks the X-Grid layer so its guides can't be moved.": "يقفل طبقة X-Grid حتى لا تتحرك أدلتها.",
  "When an artboard is resized or moved, its X-Grid grids are rebuilt to fit.": "عند تغيير مقاس لوح الرسم أو تحريكه، يُعاد بناء شبكاته لتناسبه.",
  "Rounds every guide position to a whole pixel — for UI and screen work.": "يقرّب موضع كل دليل إلى بكسل صحيح — لتصميم الواجهات والشاشات.",
  "Where the grid is drawn": "مكان رسم الشبكة",
  "Save current as preset": "حفظ القيم الحالية كإعداد جاهز",
  "Delete this preset": "حذف هذا الإعداد",
  "Draw the grid as rectangles on an 'X-Grid Shapes' layer (for wireframes)": "رسم الشبكة كمستطيلات على طبقة 'X-Grid Shapes' (للـ wireframes)",
  "Clear X-Grid on the selected artboard": "مسح X-Grid من لوح الرسم المحدد",
  "Select a text frame: spacing becomes its leading and the grid runs through its first baseline.": "حدّد إطار نص: تصبح المسافة هي تباعد أسطره وتمر الشبكة بخط أساسه الأول.",
  "Load this grid's settings": "تحميل إعدادات هذه الشبكة"
};

var AR_INFO = {
  thirds: "تقسيم المساحة إلى أثلاث أفقيًا ورأسيًا — قاعدة التكوين الكلاسيكية.",
  phi: "أدلة عند النسبة الذهبية (≈ 38.2% / 61.8%) — أكثر طبيعية من قاعدة الأثلاث.",
  spiral: "حلزون ذهبي لوغاريتمي مع تقسيمات المستطيل الذهبي — يقود العين داخل الإطار.",
  quadrants: "دليل أفقي ورأسي عبر المنتصف — يقسم المساحة إلى أربعة أرباع متساوية.",
  center: "دليل أفقي ورأسي واحد عبر منتصف المساحة.",
  fibonacci: "تقسيم بنسب فيبوناتشي (1/8، 2/8، 3/8، 5/8…) — نسب توافقية طبيعية.",
  triangle: "مثلث متساوي الأضلاع داخل الإطار — طاقة اتجاهية قوية لأعلى.",
  harmonic: "أقطار من ركن لركن مع الأعمدة المتعامدة عليها — تكشف المستطيلات الفرعية الطبيعية.",
  baroque: "القطر الرئيسي (من أعلى اليسار لأسفل اليمين) مع الخطوط المتعامدة — حركة التكوين الباروكي.",
  sinister: "القطر الرئيسي (من أعلى اليمين لأسفل اليسار) مع الخطوط المتعامدة — عكس الباروكي؛ توتر ودراما.",
  "14line": "القطران وتقاطع المنتصف والخطوط المتعامدة الأربعة — الهيكل الكامل بـ 14 خطًا.",
  roottwo: "أدلة عند 1/√2 (≈ 70.7%) — التقسيم التوافقي لمستطيلات مقاسات A.",
  root3: "أدلة عند 1/√3 (≈ 57.7%) — النسب التوافقية لمستطيل جذر 3.",
  root4: "أدلة عند 1/2 (50%) — مثل مستطيل 2:1؛ تماثل قوي.",
  root5: "أدلة عند 1/√5 (≈ 44.7%) — النسبة التي تقوم عليها النسبة الذهبية.",
  rabatment: "رسم مربع من كل حافة — يكشف مناطق التركيز الطبيعية في أي مستطيل.",
  diagonal: "رسم القطرين من ركن لركن (X) على طبقة 'Diagonal'. الهامش يحرّك الأركان.",
  radial: "خطوط متساوية الزوايا عبر المنتصف على طبقة 'Radial Grid'. حدّد عدد الخطوط.",
  isometric: "خطوط بزاوية ±30° على طبقة 'Iso Grid'. المسافة تتحكم في حجم الخلية.",
  vandegraaf: "قانون المخطوطات الكلاسيكي: الداخل W/9، الأعلى H/9، الخارج 2W/9، الأسفل 2H/9.",
  villard: "مخطط Villard de Honnecourt الوسيط: أقطار وتقاطعات نصف الصفحة وأدلة هوامش W/9.",
  tschichold: "قانون Jan Tschichold: الداخل W/9، الأعلى H/9، الخارج W/4.5، الأسفل H/4.5.",
  modulor: "موديولور Le Corbusier: تتابع النسبة الذهبية (φ⁻¹، φ⁻²، φ⁻³) من الحواف الأربع — قائم على نسب جسم الإنسان.",
  steelyard: "توازن غير متماثل: عنصر كبير وثقل صغير مقابل على جانبي نقطة ارتكاز.",
  ocircle: "دائرة داخل الإطار — تُبرز الكتلة المركزية والتوازن الشعاعي.",
  lshape: "دليل على شكل L — يقود العين على محورين متعامدين.",
  ushape: "دليل على شكل U — يحيط بالأسفل والجانبين ويترك الأعلى مفتوحًا.",
  cshape: "دليل على شكل C — حاوية مفتوحة من جانب؛ توحي بالدخول من اليمين.",
  tshape: "دليل على شكل T — غطاء أفقي قوي مع محور نازل في المنتصف.",
  tunnel: "مستطيلات متداخلة تتجه للمنتصف — تصنع عمقًا وخطوطًا قائدة.",
  scurve: "منحنى S انسيابي عبر المساحة — حركة طبيعية للعين وطاقة ديناميكية.",
  zpattern: "مسار قراءة Z: أعلى يسار ← أعلى يمين ← أسفل يسار ← أسفل يمين — حركة العين في القراءة الغربية.",
  fpattern: "مسار قراءة F: مسح كامل بالأعلى، مسح أقصر بالمنتصف، ثم رأسي على اليسار — سلوك القراءة على الويب.",
  vesica: "دائرتان متداخلتان — Vesica Piscis؛ شكل أساسي في الهندسة المقدسة.",
  flower: "نمط زهرة الحياة بـ 19 دائرة — هندسة سداسية متكررة.",
  safearea: "منطقتا Action Safe (90%) و Title Safe (80%) للبث — تضمن ظهور المحتوى على كل الشاشات.",
  "1point": "كل الخطوط تلتقي في نقطة تلاشي مركزية — منظور أمامي كلاسيكي.",
  "2point": "الخطوط تلتقي في نقطتي تلاشي يمينًا ويسارًا — منظور من الزاوية.",
  "3point": "ثلاث نقاط تلاشي (يسار، يمين، أعلى) — منظور درامي من أعلى أو من أسفل.",
  axial: "محور مركزي وأدلة الأرباع وخطان أفقيان عند الأثلاث — محاذاة محورية طباعية.",
  dilatational: "مستطيلات متدرجة الحجم تنطلق من المنتصف — تمدد إيقاعي.",
  // layout
  manuscript: "عمود نص واحد تحيطه هوامش واسعة — أساس طباعة الكتب.",
  hierarchical: "تقسيم الصفحة إلى مناطق بالنسبة الذهبية حسب الأولوية (عنوان / متن / تذييل).",
  compound: "نظاما أعمدة متداخلان — شبكة غنية للتخطيطات التحريرية المعقدة.",
  spacing8: "شبكة أساس 8pt — كل مسافة ومقاس وموضع على مضاعفات 8pt.",
  spacing4: "شبكة أساس 4pt — مسافات دقيقة للواجهات الكثيفة.",
  spacingpx: "شبكة بكسل 1px — محاذاة دقيقة على مستوى البكسل للشاشات والأيقونات.",
  responsive: "أدلة نقاط التوقف 320 / 480 / 768 / 1024 / 1280 / 1440 — مرجع للتصميم المتجاوب.",
  "social-igpost": "المكان الذي تقصّ فيه شبكة البروفايل 3:4 المنشور. ضع المحتوى المهم بين الأدلة.",
  "social-igstory": "الشريطان العلوي والسفلي اللذان تغطيهما واجهة الستوري (تقريبي). ضع النصوص والشعارات داخلهما.",
  "social-igreel": "المناطق التي تغطيها أزرار الريلز والوصف (تقريبي)، مع قصّ 4:5 الظاهر في الفيد.",
  "social-tiktok": "المناطق التي تغطيها أزرار TikTok والوصف (تقريبي). ضع النصوص والشعارات داخلها.",
  "social-ytthumb": "الركن السفلي الأيمن الذي تغطيه مدة الفيديو (تقريبي)."
};

// labels inside messages from Illustrator
var AR_FIELD = {
  "Columns": "عدد الأعمدة", "Rows": "عدد الصفوف", "Bold every": "خط عريض كل", "Gutter": "الفاصل",
  "Column gap": "الفاصل الأفقي", "Row gap": "الفاصل الرأسي", "Spacing": "المسافة",
  "Top margin": "الهامش العلوي", "Right margin": "الهامش الأيمن",
  "Bottom margin": "الهامش السفلي", "Left margin": "الهامش الأيسر"
};

var AR_MSG = {
  "No document open.": "لا يوجد مستند مفتوح.",
  "That artboard no longer exists. Pick another one.": "لوح الرسم هذا لم يعد موجودًا. اختر لوحًا آخر.",
  "Select one or more objects to build the grid inside.": "حدّد عنصرًا أو أكثر لبناء الشبكة داخله.",
  "Gutter/Margin too large for artboard.": "الفواصل أو الهوامش أكبر من لوح الرسم.",
  "Gap/Margin too large for artboard.": "الفواصل أو الهوامش أكبر من لوح الرسم.",
  "Nothing to clear.": "لا يوجد ما يُمسح.",
  "Cleared.": "تم المسح.",
  "All X-Grid guides and layers cleared.": "تم مسح كل أدلة وطبقات X-Grid.",
  "Select a text frame first.": "حدّد إطار نص أولًا.",
  "Use point or area text, not type on a path.": "استخدم نصًا نقطيًا أو نص مساحة، لا نصًا على مسار.",
  "Couldn't read the first baseline of this text.": "تعذّرت قراءة خط الأساس الأول لهذا النص.",
  "No X-Grid guides in this document yet.": "لا توجد أدلة X-Grid في هذا المستند بعد.",
  "Unknown format.": "صيغة غير معروفة.",
  "Spacing too small (min 4).": "المسافة صغيرة جدًا (الحد الأدنى 4).",
  "Illustrator couldn't run this. Check that a document is open and try again.":
    "تعذّر التنفيذ في Illustrator. تأكد من وجود مستند مفتوح وحاول مرة أخرى."
};

function t(s) { return LANG === "ar" && AR[s] ? AR[s] : s; }

// "ok:..." / "error:..." from Illustrator → same prefix, translated text
function trMsg(r) {
  if (LANG !== "ar" || !r) return r;
  var m = /^(ok|error):([\s\S]*)$/.exec(r);
  if (!m) return r;
  var s = m[2], k, x;
  if (AR_MSG[s]) return m[1] + ":" + AR_MSG[s];
  if ((x = /^Too many guides \((\d+)\)\./.exec(s)))
    return m[1] + ":عدد الأدلة كبير جدًا (" + x[1] + "). كبّر المسافة أو اختر ألواحًا أقل.";
  if ((x = /^(.+) must be a whole number from (\d+) to (\d+)\.$/.exec(s)))
    return m[1] + ":" + (AR_FIELD[x[1]] || x[1]) + " يجب أن يكون رقمًا صحيحًا من " + x[2] + " إلى " + x[3] + ".";
  if ((x = /^(.+) can't be negative\.$/.exec(s))) return m[1] + ":" + (AR_FIELD[x[1]] || x[1]) + " لا يمكن أن يكون سالبًا.";
  if ((x = /^(.+) must be greater than 0\.$/.exec(s))) return m[1] + ":" + (AR_FIELD[x[1]] || x[1]) + " يجب أن يكون أكبر من صفر.";
  if ((x = /^(.+) must be a number\.$/.exec(s))) return m[1] + ":" + (AR_FIELD[x[1]] || x[1]) + " يجب أن يكون رقمًا.";
  if ((x = /^Cleared (.+)\.$/.exec(s))) {
    k = x[1] === "all artboards" ? "كل ألواح الرسم" : x[1] === "the selection" ? "التحديد" : x[1];
    return m[1] + ":تم المسح: " + k + ".";
  }
  if ((x = /^(\d+) shapes on the 'X-Grid Shapes' layer\.$/.exec(s)))
    return m[1] + ":" + x[1] + " شكل على طبقة X-Grid Shapes.";
  if (m[1] === "ok" && (x = /(?:created|layer)\.(?: (\d+) guides?\.)?$/.exec(s)))
    return "ok:تم إنشاء الشبكة" + (x[1] ? " · " + x[1] + " دليل." : ".");
  return r;
}

// ── static strings ────────────────────────────────────────────────────────────
var I18N_ORIG = [];   // [node, kind, english]

function i18nCollect() {
  if (I18N_ORIG.length) return;
  (function walk(n) {
    if (n.nodeType === 3) {
      var s = n.textContent.trim();
      if (s && AR[s]) I18N_ORIG.push([n, "text", n.textContent]);
      return;
    }
    if (n.nodeType !== 1 || n.tagName === "SCRIPT" || n.tagName === "STYLE") return;
    if (n.title && AR[n.title]) I18N_ORIG.push([n, "title", n.title]);
    if (n.tagName === "OPTGROUP" && AR[n.label]) I18N_ORIG.push([n, "label", n.label]);
    for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
  })(document.body);
}

function applyLang(lang) {
  i18nCollect();
  LANG = lang === "ar" ? "ar" : "en";
  I18N_ORIG.forEach(function(e) {
    var n = e[0], en = e[2], val;
    if (e[1] === "text") {
      var core = en.trim();
      val = LANG === "ar" ? en.replace(core, AR[core]) : en;
      n.textContent = val;
    } else if (e[1] === "title") n.title = LANG === "ar" ? AR[en] : en;
    else n.label = LANG === "ar" ? AR[en] : en;
  });
  document.documentElement.lang = LANG;
  document.body.dir = LANG === "ar" ? "rtl" : "ltr";
  document.body.classList.toggle("lang-ar", LANG === "ar");
}
