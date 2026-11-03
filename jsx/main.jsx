// ─── Document State ──────────────────────────────────────────────────────────
// Note: Illustrator has no doc.guidesVisible / doc.guidesLocked DOM properties.
// Visibility is toggled via menu command (state tracked in a JSX global).
// Lock state IS readable via pathItem.locked on guide items.

var _gg_guidesVisible = true; // tracks visibility state across calls
var _gg_guidesLocked  = false; // tracks lock state across calls

function toggleGuideVisibility() {
    if (app.documents.length === 0) return "error:No document open.";
    app.executeMenuCommand("showguide"); // View > Guides > Show/Hide Guides (Ctrl+;)
    _gg_guidesVisible = !_gg_guidesVisible;
    return _gg_guidesVisible ? "ok:shown" : "ok:hidden";
}

function setGuideLock(val) {
    if (app.documents.length === 0) return "error:No document open.";
    var wantLocked = (val === "1");
    if (_gg_guidesLocked !== wantLocked) {
        app.executeMenuCommand("lockguide"); // View > Guides > Lock Guides (Alt+Ctrl+;)
        _gg_guidesLocked = wantLocked;
    }
    return wantLocked ? "ok:locked" : "ok:unlocked";
}

function getDocState() {
    if (app.documents.length === 0) return "error:No document open.";
    return "ok:" + (_gg_guidesVisible ? "1" : "0") + "|" + (_gg_guidesLocked ? "1" : "0");
}

function getArtboardSize(idx) {
    if (app.documents.length === 0) return "error:No document open.";
    var doc = app.activeDocument;
    var ab  = (parseInt(idx) === -1)
        ? doc.artboards[doc.artboards.getActiveArtboardIndex()]
        : doc.artboards[parseInt(idx)];
    var r = ab.artboardRect;
    var W = Math.round((r[2] - r[0]) * 100) / 100;
    var H = Math.round((r[1] - r[3]) * 100) / 100;
    return "ok:" + W + "|" + H;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clearGuides(doc) {
    for (var i = doc.pathItems.length - 1; i >= 0; i--) {
        try {
            if (doc.pathItems[i].guides) { doc.pathItems[i].remove(); }
        } catch (e) {}
    }
}

function addVGuide(doc, x, top, bottom) {
    var line = doc.pathItems.add();
    line.setEntirePath([[x, top], [x, bottom]]);
    line.guides  = true;
    line.stroked = false;
    line.filled  = false;
}

function addHGuide(doc, y, left, right) {
    var line = doc.pathItems.add();
    line.setEntirePath([[left, y], [right, y]]);
    line.guides  = true;
    line.stroked = false;
    line.filled  = false;
}

function getArtboard(doc, index) {
    var ab = (index === -1)
        ? doc.artboards[doc.artboards.getActiveArtboardIndex()]
        : doc.artboards[index];
    return ab.artboardRect; // [left, top, right, bottom]
}

// ─── Column Grid ─────────────────────────────────────────────────────────────
// params: "cols|gutter|mTop|mRight|mBottom|mLeft|abIndex"

function createColumnGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";

    var p       = params.split("|");
    var cols    = parseInt(p[0])    || 12;
    var gutter  = parseFloat(p[1]) || 0;
    var mTop    = parseFloat(p[2]) || 0;
    var mRight  = parseFloat(p[3]) || 0;
    var mBottom = parseFloat(p[4]) || 0;
    var mLeft   = parseFloat(p[5]) || 0;
    var abIdx   = parseInt(p[6]);

    var doc = app.activeDocument;

    var artboards = (abIdx === -1)
        ? (function() { var arr = []; for (var i = 0; i < doc.artboards.length; i++) arr.push(i); return arr; })()
        : [abIdx];

    clearGuides(doc);

    for (var a = 0; a < artboards.length; a++) {
        var b      = getArtboard(doc, artboards[a]);
        var left   = b[0] + mLeft;
        var top    = b[1] - mTop;
        var right  = b[2] - mRight;
        var bottom = b[3] + mBottom;
        var W      = right - left;

        var colW = (W - (cols - 1) * gutter) / cols;
        if (colW <= 0) return "error:Gutter/Margin too large for artboard.";

        // Margin guides
        addVGuide(doc, b[0] + mLeft,  b[1], b[3]);
        addVGuide(doc, b[2] - mRight, b[1], b[3]);
        addHGuide(doc, b[1] - mTop,    b[0], b[2]);
        addHGuide(doc, b[3] + mBottom, b[0], b[2]);

        // Column guides
        for (var i = 0; i <= cols; i++) {
            var x = left + i * (colW + gutter) - (i > 0 ? gutter : 0);
            if (i === 0) {
                // already added as margin guide
            } else if (i === cols) {
                // already added as margin guide
            } else {
                // right edge of column i-1
                var xRight = left + i * colW + (i - 1) * gutter;
                addVGuide(doc, xRight,          top, bottom);
                // left edge of column i
                addVGuide(doc, xRight + gutter, top, bottom);
            }
        }
    }

    return "ok:Column grid created.";
}

// ─── Modular Grid ────────────────────────────────────────────────────────────
// params: "cols|rows|gapX|gapY|mTop|mRight|mBottom|mLeft|abIndex"

function createModularGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";

    var p    = params.split("|");
    var cols = parseInt(p[0])    || 6;
    var rows = parseInt(p[1])    || 4;
    var gapX = parseFloat(p[2]) || 0;
    var gapY = parseFloat(p[3]) || 0;
    var mTop = parseFloat(p[4]) || 0;
    var mRight  = parseFloat(p[5]) || 0;
    var mBottom = parseFloat(p[6]) || 0;
    var mLeft   = parseFloat(p[7]) || 0;
    var abIdx   = parseInt(p[8]);

    var doc = app.activeDocument;

    var artboards = (abIdx === -1)
        ? (function() { var arr = []; for (var i = 0; i < doc.artboards.length; i++) arr.push(i); return arr; })()
        : [abIdx];

    clearGuides(doc);

    for (var a = 0; a < artboards.length; a++) {
        var b      = getArtboard(doc, artboards[a]);
        var left   = b[0] + mLeft;
        var top    = b[1] - mTop;
        var right  = b[2] - mRight;
        var bottom = b[3] + mBottom;
        var W      = right - left;
        var H      = top - bottom;

        var colW = (W - (cols - 1) * gapX) / cols;
        var rowH = (H - (rows - 1) * gapY) / rows;

        if (colW <= 0 || rowH <= 0) return "error:Gap/Margin too large for artboard.";

        // Margin guides
        addVGuide(doc, b[0] + mLeft,   b[1], b[3]);
        addVGuide(doc, b[2] - mRight,  b[1], b[3]);
        addHGuide(doc, b[1] - mTop,    b[0], b[2]);
        addHGuide(doc, b[3] + mBottom, b[0], b[2]);

        // Vertical guides (columns)
        for (var i = 1; i < cols; i++) {
            var xR = left + i * colW + (i - 1) * gapX;
            addVGuide(doc, xR,        top, bottom);
            addVGuide(doc, xR + gapX, top, bottom);
        }

        // Horizontal guides (rows)
        for (var j = 1; j < rows; j++) {
            var yB = top - j * rowH - (j - 1) * gapY;
            addHGuide(doc, yB,        left, right);
            addHGuide(doc, yB - gapY, left, right);
        }
    }

    return "ok:Modular grid created.";
}

// ─── Baseline Grid ───────────────────────────────────────────────────────────
// params: "direction|spacing|boldEvery|mTop|mRight|mBottom|mLeft|abIndex"

function createBaselineGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";

    var p         = params.split("|");
    var direction = p[0];
    var spacing   = parseFloat(p[1]) || 8;
    var boldEvery = parseInt(p[2])   || 0;
    var mTop      = parseFloat(p[3]) || 0;
    var mRight    = parseFloat(p[4]) || 0;
    var mBottom   = parseFloat(p[5]) || 0;
    var mLeft     = parseFloat(p[6]) || 0;
    var abIdx     = parseInt(p[7]);

    var doc = app.activeDocument;

    var artboards = (abIdx === -1)
        ? (function() { var arr = []; for (var i = 0; i < doc.artboards.length; i++) arr.push(i); return arr; })()
        : [abIdx];

    clearGuides(doc);

    for (var a = 0; a < artboards.length; a++) {
        var b      = getArtboard(doc, artboards[a]);
        var left   = b[0] + mLeft;
        var top    = b[1] - mTop;
        var right  = b[2] - mRight;
        var bottom = b[3] + mBottom;

        var count = 0;

        // Horizontal lines
        if (direction === "horizontal" || direction === "both") {
            var y = top;
            count = 0;
            while (y >= bottom) {
                addHGuide(doc, y, left, right);
                // Bold line: add a second guide offset by 0.5pt to visually thicken it
                if (boldEvery > 0 && count % boldEvery === 0 && count > 0) {
                    addHGuide(doc, y + 0.5, left, right);
                }
                y -= spacing;
                count++;
            }
        }

        // Vertical lines
        if (direction === "vertical" || direction === "both") {
            var x = left;
            count = 0;
            while (x <= right) {
                addVGuide(doc, x, top, bottom);
                if (boldEvery > 0 && count % boldEvery === 0 && count > 0) {
                    addVGuide(doc, x + 0.5, top, bottom);
                }
                x += spacing;
                count++;
            }
        }
    }

    return "ok:Baseline grid created.";
}

// ─── Artboard Names ──────────────────────────────────────────────────────────

function getArtboardNames() {
    if (app.documents.length === 0) return "error:No document open.";
    var doc = app.activeDocument;
    var names = [];
    for (var i = 0; i < doc.artboards.length; i++) {
        names.push(doc.artboards[i].name);
    }
    return names.join("|");
}

// ─── Clear All Guides ────────────────────────────────────────────────────────

function clearAllGuides() {
    if (app.documents.length === 0) return "error:No document open.";
    clearGuides(app.activeDocument);
    return "ok:Guides cleared.";
}

// ─── Comp: helpers ───────────────────────────────────────────────────────────

function compArtboards(abIdx, doc) {
    if (abIdx === -1) {
        var arr = [];
        for (var i = 0; i < doc.artboards.length; i++) arr.push(i);
        return arr;
    }
    return [abIdx];
}

function compMargins(params) {
    var p = params.split("|");
    return {
        mTop:    parseFloat(p[0]) || 0,
        mRight:  parseFloat(p[1]) || 0,
        mBottom: parseFloat(p[2]) || 0,
        mLeft:   parseFloat(p[3]) || 0,
        abIdx:   parseInt(p[4])
    };
}

// ─── Rule of Thirds ──────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"

function createRuleOfThirds(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m   = compMargins(params);
    var doc = app.activeDocument;
    clearGuides(doc);
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b      = getArtboard(doc, abs[a]);
        var left   = b[0] + m.mLeft;
        var top    = b[1] - m.mTop;
        var right  = b[2] - m.mRight;
        var bottom = b[3] + m.mBottom;
        var W = right - left;
        var H = top - bottom;
        addVGuide(doc, left,         b[1], b[3]);
        addVGuide(doc, right,        b[1], b[3]);
        addHGuide(doc, top,          b[0], b[2]);
        addHGuide(doc, bottom,       b[0], b[2]);
        addVGuide(doc, left + W/3,   top, bottom);
        addVGuide(doc, left + 2*W/3, top, bottom);
        addHGuide(doc, top - H/3,    left, right);
        addHGuide(doc, top - 2*H/3,  left, right);
    }
    return "ok:Rule of Thirds created.";
}

// ─── Phi Grid ────────────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"

function createPhiGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m   = compMargins(params);
    var doc = app.activeDocument;
    var phi = 1.6180339887;
    var r   = 1 / (1 + phi); // ≈ 0.382
    clearGuides(doc);
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b      = getArtboard(doc, abs[a]);
        var left   = b[0] + m.mLeft;
        var top    = b[1] - m.mTop;
        var right  = b[2] - m.mRight;
        var bottom = b[3] + m.mBottom;
        var W = right - left;
        var H = top - bottom;
        addVGuide(doc, left,               b[1], b[3]);
        addVGuide(doc, right,              b[1], b[3]);
        addHGuide(doc, top,                b[0], b[2]);
        addHGuide(doc, bottom,             b[0], b[2]);
        addVGuide(doc, left + W * r,       top, bottom);
        addVGuide(doc, left + W * (1 - r), top, bottom);
        addHGuide(doc, top - H * r,        left, right);
        addHGuide(doc, top - H * (1 - r),  left, right);
    }
    return "ok:Phi Grid created.";
}

// ─── Center Cross ─────────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"

function createCenterCross(params) {
    if (app.documents.length === 0) return "error:No document open.";
    // Accept either "abIndex" or "mTop|mRight|mBottom|mLeft|abIndex"
    var m = (params.indexOf("|") !== -1) ? compMargins(params)
          : { mTop:0, mRight:0, mBottom:0, mLeft:0, abIdx: parseInt(params) };
    var doc = app.activeDocument;
    clearGuides(doc);
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b      = getArtboard(doc, abs[a]);
        var left   = b[0] + m.mLeft;
        var top    = b[1] - m.mTop;
        var right  = b[2] - m.mRight;
        var bottom = b[3] + m.mBottom;
        var cx = left + (right - left) / 2;
        var cy = bottom + (top - bottom) / 2;
        addVGuide(doc, cx, b[1], b[3]);
        addHGuide(doc, cy, b[0], b[2]);
    }
    return "ok:Center Cross created.";
}

// ─── Root-2 Rectangle ────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"

function createRootTwo(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m   = compMargins(params);
    var doc = app.activeDocument;
    var r   = 1 / Math.sqrt(2); // ≈ 0.707
    clearGuides(doc);
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b      = getArtboard(doc, abs[a]);
        var left   = b[0] + m.mLeft;
        var top    = b[1] - m.mTop;
        var right  = b[2] - m.mRight;
        var bottom = b[3] + m.mBottom;
        var W = right - left;
        var H = top - bottom;
        addVGuide(doc, left,                 b[1], b[3]);
        addVGuide(doc, right,                b[1], b[3]);
        addHGuide(doc, top,                  b[0], b[2]);
        addHGuide(doc, bottom,               b[0], b[2]);
        addVGuide(doc, left + W * (1 - r),   top, bottom);
        addVGuide(doc, left + W * r,         top, bottom);
        addHGuide(doc, top - H * (1 - r),    left, right);
        addHGuide(doc, top - H * r,          left, right);
    }
    return "ok:Root-2 Rectangle created.";
}

// ─── Van de Graaf Canon ──────────────────────────────────────────────────────
// params: "abIndex"
// Classic manuscript grid: inner=W/9 top=H/9 outer=2W/9 bottom=2H/9

function createVanDeGraaf(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx = parseInt(params);
    var doc   = app.activeDocument;
    clearGuides(doc);
    var abs = compArtboards(abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b = getArtboard(doc, abs[a]);
        var W = b[2] - b[0];
        var H = b[1] - b[3];
        var left   = b[0] + W / 9;
        var top    = b[1] - H / 9;
        var right  = b[2] - 2 * W / 9;
        var bottom = b[3] + 2 * H / 9;
        addVGuide(doc, left,   b[1], b[3]);
        addVGuide(doc, right,  b[1], b[3]);
        addHGuide(doc, top,    b[0], b[2]);
        addHGuide(doc, bottom, b[0], b[2]);
    }
    return "ok:Van de Graaf Canon created.";
}

// ─── Fibonacci Sections ───────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"
// Divides area by Fibonacci ratios: 1/8, 2/8, 3/8, 5/8, 6/8, 7/8

function createFibonacci(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m      = compMargins(params);
    var doc    = app.activeDocument;
    var ratios = [1/8, 2/8, 3/8, 5/8, 6/8, 7/8];
    clearGuides(doc);
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b      = getArtboard(doc, abs[a]);
        var left   = b[0] + m.mLeft;
        var top    = b[1] - m.mTop;
        var right  = b[2] - m.mRight;
        var bottom = b[3] + m.mBottom;
        var W = right - left;
        var H = top - bottom;
        addVGuide(doc, left,   b[1], b[3]);
        addVGuide(doc, right,  b[1], b[3]);
        addHGuide(doc, top,    b[0], b[2]);
        addHGuide(doc, bottom, b[0], b[2]);
        for (var i = 0; i < ratios.length; i++) {
            addVGuide(doc, left + W * ratios[i], top, bottom);
            addHGuide(doc, top - H * ratios[i],  left, right);
        }
    }
    return "ok:Fibonacci Sections created.";
}

// ─── Rabatment ───────────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"

function createRabatment(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m   = compMargins(params);
    var doc = app.activeDocument;
    clearGuides(doc);
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b      = getArtboard(doc, abs[a]);
        var left   = b[0] + m.mLeft;
        var top    = b[1] - m.mTop;
        var right  = b[2] - m.mRight;
        var bottom = b[3] + m.mBottom;
        var W = right - left;
        var H = top - bottom;
        var s = Math.min(W, H); // shorter side = inscribed square
        addVGuide(doc, left,  b[1], b[3]);
        addVGuide(doc, right, b[1], b[3]);
        addHGuide(doc, top,   b[0], b[2]);
        addHGuide(doc, bottom, b[0], b[2]);
        if (W >= H) {
            addVGuide(doc, left + s,  top, bottom);
            addVGuide(doc, right - s, top, bottom);
        } else {
            addHGuide(doc, top - s,    left, right);
            addHGuide(doc, bottom + s, left, right);
        }
    }
    return "ok:Rabatment created.";
}

// ─── Isometric Grid ───────────────────────────────────────────────────────────
// params: "spacing|showH|abIndex"
// Draws colored path items on "Iso Grid" layer (guides can only be H/V)

function clipDiagLine(left, top, right, bottom, m, c) {
    var pts = [];
    var x, y;
    y = m * left + c;   if (y >= bottom - 0.01 && y <= top + 0.01) pts.push([left,  y]);
    y = m * right + c;  if (y >= bottom - 0.01 && y <= top + 0.01) pts.push([right, y]);
    if (m !== 0) {
        x = (top - c) / m;    if (x > left + 0.01 && x < right - 0.01) pts.push([x, top]);
        x = (bottom - c) / m; if (x > left + 0.01 && x < right - 0.01) pts.push([x, bottom]);
    }
    if (pts.length < 2) return null;
    var p1 = pts[0];
    for (var i = 1; i < pts.length; i++) {
        if (Math.abs(pts[i][0]-p1[0]) > 0.1 || Math.abs(pts[i][1]-p1[1]) > 0.1)
            return [p1[0], p1[1], pts[i][0], pts[i][1]];
    }
    return null;
}

function drawIsoPath(layer, x1, y1, x2, y2) {
    var ln = layer.pathItems.add();
    ln.setEntirePath([[x1, y1], [x2, y2]]);
    ln.stroked = true; ln.filled = false; ln.strokeWidth = 0.5;
    var col = new RGBColor(); col.red = 0; col.green = 170; col.blue = 230;
    ln.strokeColor = col;
}

function createIsometricGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p       = params.split("|");
    var spacing = parseFloat(p[0]) || 20;
    var showH   = (p[1] === "1");
    var abIdx   = parseInt(p[2]);
    if (spacing < 4) return "error:Spacing too small (min 4).";
    var doc = app.activeDocument;

    // Find or create Iso Grid layer
    var isoLayer = null;
    for (var li = 0; li < doc.layers.length; li++) {
        if (doc.layers[li].name === "Iso Grid") { isoLayer = doc.layers[li]; break; }
    }
    if (!isoLayer) {
        isoLayer = doc.layers.add();
        isoLayer.name = "Iso Grid";
    } else {
        for (var pi = isoLayer.pathItems.length - 1; pi >= 0; pi--) {
            try { isoLayer.pathItems[pi].remove(); } catch(e) {}
        }
    }

    var slope = Math.tan(30 * Math.PI / 180); // ≈ 0.5774
    var artboards = (abIdx === -1)
        ? (function() { var arr = []; for (var i = 0; i < doc.artboards.length; i++) arr.push(i); return arr; })()
        : [abIdx];

    for (var a = 0; a < artboards.length; a++) {
        var b      = getArtboard(doc, artboards[a]);
        var left   = b[0], top = b[1], right = b[2], bottom = b[3];

        // +30° lines: y = slope*x + c
        var cMin = bottom - slope * right;
        var cMax = top   - slope * left;
        for (var c = cMin - spacing; c <= cMax + spacing; c += spacing) {
            var ln = clipDiagLine(left, top, right, bottom, slope, c);
            if (ln) drawIsoPath(isoLayer, ln[0], ln[1], ln[2], ln[3]);
        }

        // -30° lines: y = -slope*x + c
        var cMin2 = bottom + slope * left;
        var cMax2 = top   + slope * right;
        for (var c2 = cMin2 - spacing; c2 <= cMax2 + spacing; c2 += spacing) {
            var ln2 = clipDiagLine(left, top, right, bottom, -slope, c2);
            if (ln2) drawIsoPath(isoLayer, ln2[0], ln2[1], ln2[2], ln2[3]);
        }

        // Horizontal lines
        if (showH) {
            var rowH = spacing * Math.tan(30 * Math.PI / 180) * 2;
            for (var yh = bottom; yh <= top + rowH; yh += rowH) {
                drawIsoPath(isoLayer, left, yh, right, yh);
            }
        }
    }
    return "ok:Isometric grid on 'Iso Grid' layer.";
}

// ─── Shared: get/clear a named path layer ────────────────────────────────────

function getOrCreateLayer(doc, name) {
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name === name) {
            for (var j = doc.layers[i].pathItems.length - 1; j >= 0; j--) {
                try { doc.layers[i].pathItems[j].remove(); } catch(e) {}
            }
            return doc.layers[i];
        }
    }
    var layer = doc.layers.add();
    layer.name = name;
    return layer;
}

function clearPathLayer(name) {
    if (app.documents.length === 0) return "error:No document open.";
    var doc = app.activeDocument;
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name === name) {
            for (var j = doc.layers[i].pathItems.length - 1; j >= 0; j--) {
                try { doc.layers[i].pathItems[j].remove(); } catch(e) {}
            }
            return "ok:Cleared.";
        }
    }
    return "ok:Nothing to clear.";
}

function clearAllPathLayers() {
    if (app.documents.length === 0) return "error:No document open.";
    clearPathLayer("Iso Grid");
    clearPathLayer("Radial Grid");
    clearPathLayer("Diagonal");
    clearGuides(app.activeDocument);
    return "ok:All cleared.";
}

// ─── Diagonal Cross ───────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"

function createDiagonalCross(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m   = compMargins(params);
    var doc = app.activeDocument;
    var layer = getOrCreateLayer(doc, "Diagonal");
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b      = getArtboard(doc, abs[a]);
        var left   = b[0] + m.mLeft;
        var top    = b[1] - m.mTop;
        var right  = b[2] - m.mRight;
        var bottom = b[3] + m.mBottom;
        drawIsoPath(layer, left,  top,    right, bottom); // TL → BR
        drawIsoPath(layer, right, top,    left,  bottom); // TR → BL
    }
    return "ok:Diagonal Cross on 'Diagonal' layer.";
}

// ─── Radial Grid ─────────────────────────────────────────────────────────────
// params: "lines|abIndex"

function createRadialGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p     = params.split("|");
    var count = parseInt(p[0]) || 12;
    var abIdx = parseInt(p[1]);
    var doc   = app.activeDocument;
    var layer = getOrCreateLayer(doc, "Radial Grid");
    var abs   = compArtboards(abIdx, doc);
    var PI    = Math.PI;

    for (var a = 0; a < abs.length; a++) {
        var b      = getArtboard(doc, abs[a]);
        var left   = b[0], top = b[1], right = b[2], bottom = b[3];
        var cx     = left   + (right - left) / 2;
        var cy     = bottom + (top   - bottom) / 2;

        for (var i = 0; i < count; i++) {
            var angle = i * PI / count; // 0..π  → full lines through center
            var cosA  = Math.cos(angle);
            var sinA  = Math.sin(angle);

            var x1, y1, x2, y2;
            if (Math.abs(cosA) < 0.0001) {
                // Vertical
                x1 = cx; y1 = top; x2 = cx; y2 = bottom;
            } else {
                var slope = sinA / cosA;
                var cVal  = cy - slope * cx;
                var pts   = clipDiagLine(left, top, right, bottom, slope, cVal);
                if (!pts) continue;
                x1 = pts[0]; y1 = pts[1]; x2 = pts[2]; y2 = pts[3];
            }
            drawIsoPath(layer, x1, y1, x2, y2);
        }
    }
    return "ok:Radial grid on 'Radial Grid' layer.";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Extended Grid Systems ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Draw Helpers ─────────────────────────────────────────────────────────────

function makeColor(r, g, b) {
    var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c;
}
function drawLine(layer, x1, y1, x2, y2, r, g, b, w) {
    var ln = layer.pathItems.add();
    ln.setEntirePath([[x1,y1],[x2,y2]]);
    ln.stroked = true; ln.filled = false; ln.strokeWidth = w || 0.5;
    ln.strokeColor = makeColor(r||0, g||170, b||230);
}
function drawEllipseItem(layer, cx, cy, rx, ry, r, g, b, w) {
    var el = layer.pathItems.ellipse(cy+ry, cx-rx, 2*rx, 2*ry);
    el.stroked = true; el.filled = false; el.strokeWidth = w || 0.5;
    el.strokeColor = makeColor(r||0, g||170, b||230);
}
function drawPoly(layer, pts, closed, r, g, b, w) {
    if (pts.length < 2) return;
    var p = layer.pathItems.add();
    p.setEntirePath(pts); p.closed = !!closed;
    p.stroked = true; p.filled = false; p.strokeWidth = w || 0.5;
    p.strokeColor = makeColor(r||0, g||170, b||230);
}

// ─── Root-N Rectangle ─────────────────────────────────────────────────────────
// params: "n|mTop|mRight|mBottom|mLeft|abIndex"

function createRootN(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p = params.split("|");
    var n = parseFloat(p[0]); var ratio = 1 / Math.sqrt(n);
    var m = compMargins(p.slice(1).join("|"));
    var doc = app.activeDocument; clearGuides(doc);
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b = getArtboard(doc, abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        var W=right-left, H=top-bottom;
        addVGuide(doc,left,b[1],b[3]); addVGuide(doc,right,b[1],b[3]);
        addHGuide(doc,top,b[0],b[2]); addHGuide(doc,bottom,b[0],b[2]);
        addVGuide(doc,left+W*(1-ratio),top,bottom); addVGuide(doc,left+W*ratio,top,bottom);
        addHGuide(doc,top-H*(1-ratio),left,right); addHGuide(doc,top-H*ratio,left,right);
    }
    return "ok:Root-" + n + " Rectangle created.";
}

// ─── Quadrants ────────────────────────────────────────────────────────────────
function createQuadrants(params) { return createCenterCross(params); }

// ─── Triangle Composition ────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"
function createTriangleComp(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m = compMargins(params); var doc = app.activeDocument;
    var layer = getOrCreateLayer(doc, "Composition");
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b = getArtboard(doc, abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        drawPoly(layer, [[left,bottom],[right,bottom],[(left+right)/2,top]], true, 230,140,0);
    }
    return "ok:Triangle Composition on 'Composition' layer.";
}

// ─── Golden Spiral ────────────────────────────────────────────────────────────
// Logarithmic spiral + golden rectangle dividers
// params: "mTop|mRight|mBottom|mLeft|abIndex"
function createGoldenSpiral(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m = compMargins(params); var doc = app.activeDocument;
    var layer = getOrCreateLayer(doc, "Golden Spiral");
    clearGuides(doc);
    var phi = 1.6180339887; var lnPhi = Math.log(phi);
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b = getArtboard(doc, abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        var W=right-left, H=top-bottom;
        var cx=(left+right)/2, cy=(bottom+top)/2, R=Math.min(W,H)*0.5;
        addVGuide(doc,left,b[1],b[3]); addVGuide(doc,right,b[1],b[3]);
        addHGuide(doc,top,b[0],b[2]); addHGuide(doc,bottom,b[0],b[2]);
        // Golden rectangle divider guides
        var x=left, y=bottom, w=W, h=H;
        for (var i=0; i<6; i++) {
            if (i%4===0) { addVGuide(doc,x+h,top,bottom); x+=h; w-=h; }
            else if (i%4===1) { addHGuide(doc,y+w,left,right); y+=w; h-=w; }
            else if (i%4===2) { addVGuide(doc,x+w-h,top,bottom); w-=h; }
            else { addHGuide(doc,y+h-w,left,right); h-=w; }
        }
        // Logarithmic spiral polyline
        var pts=[]; var steps=180; var maxA=2.5*Math.PI;
        for (var t=0; t<=steps; t++) {
            var theta = t*maxA/steps;
            var r_val = R*Math.exp(-lnPhi*theta/(Math.PI/2));
            var px=cx+r_val*Math.cos(theta), py=cy+r_val*Math.sin(theta);
            if (px>=left-1&&px<=right+1&&py>=bottom-1&&py<=top+1) pts.push([px,py]);
        }
        if (pts.length>1) drawPoly(layer, pts, false, 230,140,0, 0.75);
    }
    return "ok:Golden Spiral on 'Golden Spiral' layer.";
}

// ─── Harmonic Armature ───────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"
function createHarmonicArmature(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m = compMargins(params); var doc = app.activeDocument;
    var layer = getOrCreateLayer(doc, "Dynamic Symmetry");
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b = getArtboard(doc, abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        var W=right-left, H=top-bottom;
        drawLine(layer,left,top,right,bottom);
        drawLine(layer,right,top,left,bottom);
        // Reciprocals for TL→BR
        var s1=-H/W, c1=top-s1*left, sr1=W/H;
        var corners = [[right,top],[left,bottom],[right,bottom],[left,top]];
        for (var ci=0; ci<corners.length; ci++) {
            var cx0=corners[ci][0], cy0=corners[ci][1];
            var crv=cy0-sr1*cx0, denom=sr1-s1;
            if (Math.abs(denom)>0.001) {
                var xi=(c1-crv)/denom, yi=s1*xi+c1;
                if (xi>=left-0.5&&xi<=right+0.5&&yi>=bottom-0.5&&yi<=top+0.5)
                    drawLine(layer,cx0,cy0,xi,yi);
            }
        }
        // Reciprocals for TR→BL
        var s2=H/W, c2=top-s2*right, sr2=-W/H;
        var corners2=[[left,top],[right,bottom],[left,bottom],[right,top]];
        for (var ci2=0; ci2<corners2.length; ci2++) {
            var cx2=corners2[ci2][0], cy2=corners2[ci2][1];
            var crv2=cy2-sr2*cx2, denom2=sr2-s2;
            if (Math.abs(denom2)>0.001) {
                var xi2=(c2-crv2)/denom2, yi2=s2*xi2+c2;
                if (xi2>=left-0.5&&xi2<=right+0.5&&yi2>=bottom-0.5&&yi2<=top+0.5)
                    drawLine(layer,cx2,cy2,xi2,yi2);
            }
        }
    }
    return "ok:Harmonic Armature on 'Dynamic Symmetry' layer.";
}

// ─── Baroque Diagonal ────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"
function createBaroqueDiagonal(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m = compMargins(params); var doc = app.activeDocument;
    var layer = getOrCreateLayer(doc, "Dynamic Symmetry");
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b = getArtboard(doc, abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        var W=right-left, H=top-bottom;
        drawLine(layer,left,top,right,bottom);
        var s=-H/W, c1=top-s*left, sr=W/H;
        var pairs=[[right,top],[left,bottom]];
        for (var i=0; i<pairs.length; i++) {
            var crv=pairs[i][1]-sr*pairs[i][0], xi=(c1-crv)/(sr-s), yi=s*xi+c1;
            if (xi>=left-0.5&&xi<=right+0.5) drawLine(layer,pairs[i][0],pairs[i][1],xi,yi);
        }
    }
    return "ok:Baroque Diagonal on 'Dynamic Symmetry' layer.";
}

// ─── Sinister Diagonal ───────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"
function createSinisterDiagonal(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m = compMargins(params); var doc = app.activeDocument;
    var layer = getOrCreateLayer(doc, "Dynamic Symmetry");
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b = getArtboard(doc, abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        var W=right-left, H=top-bottom;
        drawLine(layer,right,top,left,bottom);
        var s=H/W, c2=top-s*right, sr=-W/H;
        var pairs=[[left,top],[right,bottom]];
        for (var i=0; i<pairs.length; i++) {
            var crv=pairs[i][1]-sr*pairs[i][0], xi=(c2-crv)/(sr-s), yi=s*xi+c2;
            if (xi>=left-0.5&&xi<=right+0.5) drawLine(layer,pairs[i][0],pairs[i][1],xi,yi);
        }
    }
    return "ok:Sinister Diagonal on 'Dynamic Symmetry' layer.";
}

// ─── 14-Line Armature ────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"
function create14LineArmature(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m = compMargins(params); var doc = app.activeDocument;
    var layer = getOrCreateLayer(doc, "Dynamic Symmetry");
    var abs = compArtboards(m.abIdx, doc);
    for (var a = 0; a < abs.length; a++) {
        var b = getArtboard(doc, abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        var W=right-left, H=top-bottom;
        var cx=(left+right)/2, cy=(bottom+top)/2;
        // Both diagonals + center cross
        drawLine(layer,left,top,right,bottom); drawLine(layer,right,top,left,bottom);
        drawLine(layer,cx,top,cx,bottom); drawLine(layer,left,cy,right,cy);
        // Reciprocals for diagonal 1 (TL→BR)
        var s1=-H/W, c1=top-s1*left, sr1=W/H;
        var cs1=[[right,top],[left,bottom],[right,bottom],[left,top]];
        for (var i=0; i<cs1.length; i++) {
            var crv=cs1[i][1]-sr1*cs1[i][0], xi=(c1-crv)/(sr1-s1), yi=s1*xi+c1;
            if (xi>=left-0.5&&xi<=right+0.5&&yi>=bottom-0.5&&yi<=top+0.5)
                drawLine(layer,cs1[i][0],cs1[i][1],xi,yi);
        }
        // Reciprocals for diagonal 2 (TR→BL)
        var s2=H/W, c2=top-s2*right, sr2=-W/H;
        var cs2=[[left,top],[right,bottom],[left,bottom],[right,top]];
        for (var j=0; j<cs2.length; j++) {
            var crv2=cs2[j][1]-sr2*cs2[j][0], xi2=(c2-crv2)/(sr2-s2), yi2=s2*xi2+c2;
            if (xi2>=left-0.5&&xi2<=right+0.5&&yi2>=bottom-0.5&&yi2<=top+0.5)
                drawLine(layer,cs2[j][0],cs2[j][1],xi2,yi2);
        }
    }
    return "ok:14-Line Armature on 'Dynamic Symmetry' layer.";
}

// ─── Villard Diagram ─────────────────────────────────────────────────────────
// params: "abIndex"
function createVillardDiagram(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Dynamic Symmetry");
    var abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        drawLine(layer,left,top,right,bottom);
        drawLine(layer,right,top,left,bottom);
        drawLine(layer,left,top,right,bottom-H/2,0,170,230,0.35);
        drawLine(layer,right,top,left,bottom-H/2,0,170,230,0.35);
        drawLine(layer,left,bottom+H/2,right,bottom,0,170,230,0.35);
        drawLine(layer,right,bottom+H/2,left,bottom,0,170,230,0.35);
        addVGuide(doc,left+W/9,top,bottom); addVGuide(doc,right-W/9,top,bottom);
        addHGuide(doc,top-H/9,left,right); addHGuide(doc,bottom+H/9,left,right);
    }
    return "ok:Villard Diagram on 'Dynamic Symmetry' layer.";
}

// ─── Tschichold Canon ────────────────────────────────────────────────────────
// params: "abIndex"
function createTschichold(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument; clearGuides(doc);
    var abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]), W=b[2]-b[0], H=b[1]-b[3];
        addVGuide(doc,b[0]+W/9,   b[1],b[3]); addVGuide(doc,b[2]-W/4.5, b[1],b[3]);
        addHGuide(doc,b[1]-H/9,   b[0],b[2]); addHGuide(doc,b[3]+H/4.5, b[0],b[2]);
    }
    return "ok:Tschichold Canon created.";
}

// ─── Manuscript Grid ─────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"
function createManuscriptGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m=compMargins(params), doc=app.activeDocument; clearGuides(doc);
    var abs=compArtboards(m.abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        var H=top-bottom;
        addVGuide(doc,left,b[1],b[3]); addVGuide(doc,right,b[1],b[3]);
        addHGuide(doc,top,b[0],b[2]); addHGuide(doc,bottom,b[0],b[2]);
        addHGuide(doc,top-H/7,left,right);
        addHGuide(doc,bottom+H/7,left,right);
    }
    return "ok:Manuscript Grid created.";
}

// ─── Hierarchical Grid ───────────────────────────────────────────────────────
// params: "zones|mTop|mRight|mBottom|mLeft|abIndex"
function createHierarchicalGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p=params.split("|"), zones=parseInt(p[0])||3;
    var m=compMargins(p.slice(1).join("|")), doc=app.activeDocument; clearGuides(doc);
    var phi=1.6180339887, abs=compArtboards(m.abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        addVGuide(doc,left,b[1],b[3]); addVGuide(doc,right,b[1],b[3]);
        addHGuide(doc,top,b[0],b[2]); addHGuide(doc,bottom,b[0],b[2]);
        var y=top;
        for (var z=0; z<zones-1; z++) {
            var ratio=(z%2===0)?(1/phi):(1-1/phi);
            y=y-(y-bottom)*ratio;
            addHGuide(doc,y,left,right);
        }
    }
    return "ok:Hierarchical Grid created.";
}

// ─── Compound Grid ───────────────────────────────────────────────────────────
// params: "cols1|cols2|gutter|mTop|mRight|mBottom|mLeft|abIndex"
function createCompoundGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p=params.split("|");
    var cols1=parseInt(p[0])||3, cols2=parseInt(p[1])||4, gutter=parseFloat(p[2])||16;
    var m=compMargins(p.slice(3).join("|")), doc=app.activeDocument; clearGuides(doc);
    var abs=compArtboards(m.abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0]+m.mLeft, top=b[1]-m.mTop, right=b[2]-m.mRight, bottom=b[3]+m.mBottom;
        var W=right-left;
        addVGuide(doc,left,b[1],b[3]); addVGuide(doc,right,b[1],b[3]);
        addHGuide(doc,top,b[0],b[2]); addHGuide(doc,bottom,b[0],b[2]);
        var cw1=(W-(cols1-1)*gutter)/cols1;
        for (var i=1; i<cols1; i++) {
            var xr=left+i*cw1+(i-1)*gutter;
            addVGuide(doc,xr,top,bottom); addVGuide(doc,xr+gutter,top,bottom);
        }
        var cw2=(W-(cols2-1)*gutter)/cols2;
        for (var j=1; j<cols2; j++) {
            addVGuide(doc,left+j*cw2+(j-0.5)*gutter,top,bottom);
        }
    }
    return "ok:Compound Grid created.";
}

// ─── Responsive Grid ─────────────────────────────────────────────────────────
// params: "abIndex"
function createResponsiveGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument; clearGuides(doc);
    var bps=[320,480,768,1024,1280,1440], abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]), cx=(b[0]+b[2])/2, abW=b[2]-b[0];
        for (var i=0; i<bps.length; i++) {
            if (bps[i]<abW) {
                addVGuide(doc,cx-bps[i]/2,b[1],b[3]);
                addVGuide(doc,cx+bps[i]/2,b[1],b[3]);
            }
        }
    }
    return "ok:Responsive Grid created.";
}

// ─── Letter-Shape Compositions ───────────────────────────────────────────────

function createSteelyard(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var cy=bottom+H*0.382, px=left+W*0.382;
        drawLine(layer,left,cy,right,cy,220,90,30,1.0);
        drawLine(layer,px,cy-H*0.05,px,cy+H*0.05,220,90,30,1.5);
        var lw=W*0.35,lh=H*0.45;
        drawPoly(layer,[[left+W*0.02,cy],[left+W*0.02+lw,cy],[left+W*0.02+lw,cy+lh],[left+W*0.02,cy+lh]],true,220,90,30,0.5);
        var sw=W*0.12,sh=H*0.18;
        drawPoly(layer,[[right-W*0.02-sw,cy],[right-W*0.02,cy],[right-W*0.02,cy+sh],[right-W*0.02-sw,cy+sh]],true,220,90,30,0.5);
    }
    return "ok:Steelyard on 'Composition' layer.";
}

function createOCircle(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var cx=(b[0]+b[2])/2, cy=(b[3]+b[1])/2, rx=Math.min(b[2]-b[0],b[1]-b[3])*0.42;
        drawEllipseItem(layer,cx,cy,rx,rx,220,90,30);
        drawLine(layer,cx,cy-rx,cx,cy+rx,220,90,30,0.35);
        drawLine(layer,cx-rx,cy,cx+rx,cy,220,90,30,0.35);
    }
    return "ok:O Circle on 'Composition' layer.";
}

function createLShape(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom, pad=0.08;
        drawLine(layer,left+W*pad,top-H*pad,left+W*pad,bottom+H*pad,220,90,30,2.0);
        drawLine(layer,left+W*pad,bottom+H*pad,right-W*pad,bottom+H*pad,220,90,30,2.0);
    }
    return "ok:L-Shape on 'Composition' layer.";
}

function createUShape(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom, pad=0.08;
        drawLine(layer,left+W*pad,top-H*pad,left+W*pad,bottom+H*pad,220,90,30,2.0);
        drawLine(layer,right-W*pad,top-H*pad,right-W*pad,bottom+H*pad,220,90,30,2.0);
        drawLine(layer,left+W*pad,bottom+H*pad,right-W*pad,bottom+H*pad,220,90,30,2.0);
    }
    return "ok:U-Shape on 'Composition' layer.";
}

function createCShape(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom, pad=0.08;
        drawLine(layer,right-W*pad,top-H*pad,left+W*pad,top-H*pad,220,90,30,2.0);
        drawLine(layer,left+W*pad,top-H*pad,left+W*pad,bottom+H*pad,220,90,30,2.0);
        drawLine(layer,left+W*pad,bottom+H*pad,right-W*pad,bottom+H*pad,220,90,30,2.0);
    }
    return "ok:C-Shape on 'Composition' layer.";
}

function createTShape(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var pad=0.08, cx=(left+right)/2;
        drawLine(layer,left+W*pad,top-H*pad,right-W*pad,top-H*pad,220,90,30,2.0);
        drawLine(layer,cx,top-H*pad,cx,bottom+H*pad,220,90,30,2.0);
    }
    return "ok:T-Shape on 'Composition' layer.";
}

function createTunnel(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var cx=(left+right)/2, cy=(bottom+top)/2;
        for (var i=1; i<=5; i++) {
            var sh=i*0.1, sl=left+W*sh, st=top-H*sh, sr=right-W*sh, sb=bottom+H*sh;
            drawPoly(layer,[[sl,st],[sr,st],[sr,sb],[sl,sb]],true,220,90,30,0.5);
        }
        drawLine(layer,left,top,cx,cy,220,90,30,0.35);
        drawLine(layer,right,top,cx,cy,220,90,30,0.35);
        drawLine(layer,left,bottom,cx,cy,220,90,30,0.35);
        drawLine(layer,right,bottom,cx,cy,220,90,30,0.35);
    }
    return "ok:Tunnel on 'Composition' layer.";
}

// ─── Sacred Geometry ─────────────────────────────────────────────────────────

function createVesicaPiscis(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Sacred Geometry"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var cx=(b[0]+b[2])/2, cy=(b[3]+b[1])/2, r=Math.min(b[2]-b[0],b[1]-b[3])*0.3;
        drawEllipseItem(layer,cx-r*0.5,cy,r,r,180,50,230);
        drawEllipseItem(layer,cx+r*0.5,cy,r,r,180,50,230);
    }
    return "ok:Vesica Piscis on 'Sacred Geometry' layer.";
}

function createFlowerOfLife(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Sacred Geometry"), abs=compArtboards(abIdx,doc);
    var PI=Math.PI;
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var cx=(b[0]+b[2])/2, cy=(b[3]+b[1])/2, r=Math.min(b[2]-b[0],b[1]-b[3])*0.18;
        drawEllipseItem(layer,cx,cy,r,r,180,50,230);
        for (var i=0; i<6; i++) {
            var ang=i*PI/3;
            drawEllipseItem(layer,cx+r*Math.cos(ang),cy+r*Math.sin(ang),r,r,180,50,230);
        }
        for (var i2=0; i2<6; i2++) {
            var ang2=i2*PI/3+PI/6;
            drawEllipseItem(layer,cx+2*r*Math.cos(ang2),cy+2*r*Math.sin(ang2),r,r,180,50,230);
        }
        drawEllipseItem(layer,cx,cy,r*3,r*3,180,50,230,0.35);
    }
    return "ok:Flower of Life on 'Sacred Geometry' layer.";
}


// ─── Perspective Grids ────────────────────────────────────────────────────────

function create1PointPerspective(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p=params.split("|"), lines=parseInt(p[0])||8, abIdx=parseInt(p[1]);
    var doc=app.activeDocument, layer=getOrCreateLayer(doc,"Perspective");
    var abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var vpx=(left+right)/2, vpy=(bottom+top)/2;
        drawLine(layer,left,vpy,right,vpy,0,200,180,0.75);
        drawLine(layer,vpx,top,vpx,bottom,0,200,180,0.5);
        for (var i=0; i<=lines; i++) {
            var t=i/lines;
            drawLine(layer,left+W*t,top,vpx,vpy,0,200,180,0.35);
            drawLine(layer,left+W*t,bottom,vpx,vpy,0,200,180,0.35);
            drawLine(layer,left,bottom+H*t,vpx,vpy,0,200,180,0.35);
            drawLine(layer,right,bottom+H*t,vpx,vpy,0,200,180,0.35);
        }
    }
    return "ok:1-Point Perspective on 'Perspective' layer.";
}

function create2PointPerspective(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p=params.split("|"), lines=parseInt(p[0])||6, abIdx=parseInt(p[1]);
    var doc=app.activeDocument, layer=getOrCreateLayer(doc,"Perspective");
    var abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var vpy=(bottom+top)/2, vp1x=left, vp2x=right, cx=(left+right)/2;
        drawLine(layer,left,vpy,right,vpy,0,200,180,0.75);
        drawLine(layer,cx,top,cx,bottom,0,200,180,0.5);
        for (var i=0; i<=lines; i++) {
            var t=i/lines, y=bottom+H*t;
            drawLine(layer,cx,y,vp1x,vpy,0,200,180,0.35);
            drawLine(layer,cx,y,vp2x,vpy,0,200,180,0.35);
        }
    }
    return "ok:2-Point Perspective on 'Perspective' layer.";
}

function create3PointPerspective(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p=params.split("|"), lines=parseInt(p[0])||6, abIdx=parseInt(p[1]);
    var doc=app.activeDocument, layer=getOrCreateLayer(doc,"Perspective");
    var abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var vpTop=(left+right)/2, vpL=left, vpR=right, vpy=top, vpBot=(bottom+top)/2;
        drawLine(layer,vpL,vpBot,vpR,vpBot,0,200,180,0.75);
        for (var i=0; i<=lines; i++) {
            var t=i/lines;
            drawLine(layer,left+W*t,bottom,vpTop,vpy,0,200,180,0.35);
            var y=bottom+H*t;
            drawLine(layer,left,y,vpR,vpBot,0,200,180,0.35);
            drawLine(layer,right,y,vpL,vpBot,0,200,180,0.35);
        }
    }
    return "ok:3-Point Perspective on 'Perspective' layer.";
}

// ─── Typographic Flow ─────────────────────────────────────────────────────────

function createAxialSystem(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument; clearGuides(doc);
    var abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var cx=(left+right)/2;
        addVGuide(doc,cx,b[1],b[3]);
        addVGuide(doc,left+W/4,top,bottom); addVGuide(doc,right-W/4,top,bottom);
        addHGuide(doc,top-H/3,b[0],b[2]);  addHGuide(doc,top-2*H/3,b[0],b[2]);
    }
    return "ok:Axial System created.";
}

function createDilatational(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p=params.split("|"), steps=parseInt(p[0])||5, abIdx=parseInt(p[1]);
    var doc=app.activeDocument, layer=getOrCreateLayer(doc,"Composition");
    var abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var cx=(left+right)/2, cy=(bottom+top)/2;
        for (var i=1; i<=steps; i++) {
            var sc=i/steps, hw=W*sc*0.5, hh=H*sc*0.5;
            drawPoly(layer,[[cx-hw,cy+hh],[cx+hw,cy+hh],[cx+hw,cy-hh],[cx-hw,cy-hh]],true,220,90,30,0.5);
        }
    }
    return "ok:Dilatational on 'Composition' layer.";
}

// ─── S-Curve Composition ─────────────────────────────────────────────────────
// params: "abIndex"
function createSCurve(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    var PI=Math.PI;
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var cx=(left+right)/2, steps=60, pts=[];
        for (var i=0; i<=steps; i++) {
            var t=i/steps;
            pts.push([cx+W*0.22*Math.sin(2*PI*t), bottom+H*t]);
        }
        if (pts.length>1) drawPoly(layer,pts,false,220,90,30,1.5);
    }
    return "ok:S-Curve on 'Composition' layer.";
}

// ─── Z-Pattern Reading Flow ───────────────────────────────────────────────────
// params: "abIndex"
function createZPattern(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var pad=0.08, l=left+W*pad, r=right-W*pad, t=top-H*pad, bt=bottom+H*pad;
        drawPoly(layer,[[l,t],[r,t],[l,bt],[r,bt]],false,220,90,30,1.5);
        var dr=W*0.018;
        drawEllipseItem(layer,l,t,dr,dr,220,90,30,1.0);
        drawEllipseItem(layer,r,t,dr,dr,220,90,30,1.0);
        drawEllipseItem(layer,l,bt,dr,dr,220,90,30,1.0);
        drawEllipseItem(layer,r,bt,dr,dr,220,90,30,1.0);
    }
    return "ok:Z-Pattern on 'Composition' layer.";
}

// ─── F-Pattern Reading Flow ───────────────────────────────────────────────────
// params: "abIndex"
function createFPattern(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Composition"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var pad=0.08, l=left+W*pad, r=right-W*pad, t=top-H*pad, bt=bottom+H*pad;
        var mid=top-H*0.38, midR=l+(r-l)*0.62;
        drawLine(layer,l,t,l,bt,220,90,30,1.5);
        drawLine(layer,l,t,r,t,220,90,30,1.5);
        drawLine(layer,l,mid,midR,mid,220,90,30,1.5);
        var dr=W*0.018;
        drawEllipseItem(layer,l,t,dr,dr,220,90,30,1.0);
        drawEllipseItem(layer,r,t,dr,dr,220,90,30,1.0);
        drawEllipseItem(layer,midR,mid,dr,dr,220,90,30,0.75);
    }
    return "ok:F-Pattern on 'Composition' layer.";
}

// ─── Safe Areas (Broadcast / Cinema) ─────────────────────────────────────────
// params: "abIndex"
// Action Safe: 90% (5% inset), Title Safe: 80% (10% inset)
function createSafeAreas(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument;
    var layer=getOrCreateLayer(doc,"Cinematic"), abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]);
        var left=b[0],top=b[1],right=b[2],bottom=b[3],W=right-left,H=top-bottom;
        var cx=(left+right)/2, cy=(bottom+top)/2;
        drawLine(layer,left,cy,right,cy,0,200,180,0.35);
        drawLine(layer,cx,top,cx,bottom,0,200,180,0.35);
        var a5=0.05;
        drawPoly(layer,[[left+W*a5,top-H*a5],[right-W*a5,top-H*a5],[right-W*a5,bottom+H*a5],[left+W*a5,bottom+H*a5]],true,0,200,180,0.75);
        var t10=0.10;
        drawPoly(layer,[[left+W*t10,top-H*t10],[right-W*t10,top-H*t10],[right-W*t10,bottom+H*t10],[left+W*t10,bottom+H*t10]],true,0,200,180,1.2);
    }
    return "ok:Safe Areas on 'Cinematic' layer.";
}


// ─── Le Corbusier Modulor ─────────────────────────────────────────────────────
// params: "abIndex"
// Golden ratio cascade from all four edges: φ⁻¹, φ⁻², φ⁻³
function createModulor(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var abIdx=parseInt(params), doc=app.activeDocument; clearGuides(doc);
    var phi=1.6180339887, abs=compArtboards(abIdx,doc);
    for (var a=0; a<abs.length; a++) {
        var b=getArtboard(doc,abs[a]), W=b[2]-b[0], H=b[1]-b[3];
        var r1=1/phi, r2=r1/phi, r3=r2/phi;
        var ratios=[r1,r2,r3];
        for (var i=0; i<ratios.length; i++) {
            addHGuide(doc,b[3]+H*ratios[i],b[0],b[2]);
            addHGuide(doc,b[1]-H*ratios[i],b[0],b[2]);
            addVGuide(doc,b[0]+W*ratios[i],b[1],b[3]);
            addVGuide(doc,b[2]-W*ratios[i],b[1],b[3]);
        }
    }
    return "ok:Le Corbusier Modulor created.";
}

// ─── Clear All Custom Layers ─────────────────────────────────────────────────

function clearAllCustomLayers() {
    if (app.documents.length === 0) return "error:No document open.";
    var names=["Iso Grid","Radial Grid","Diagonal","Dynamic Symmetry","Golden Spiral",
               "Composition","Sacred Geometry","Perspective","Cinematic"];
    for (var i=0; i<names.length; i++) clearPathLayer(names[i]);
    clearGuides(app.activeDocument);
    return "ok:All cleared.";
}
