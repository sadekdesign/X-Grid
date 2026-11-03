// ─── Document State ──────────────────────────────────────────────────────────
// Illustrator's own Show/Lock Guides state can't be read from scripts (the
// menu commands only toggle, and the preferences answer true for any key), so
// Show and Lock act on the X-Grid layer: real, per document, and readable.

function setGuideVisibility(val) {
    if (app.documents.length === 0) return "error:No document open.";
    var root = xgRootLayer(app.activeDocument, false);
    if (!root) return "error:No X-Grid guides in this document yet.";
    root.visible = (val === "1");
    return getDocState();
}

function toggleGuideVisibility() {
    if (app.documents.length === 0) return "error:No document open.";
    var root = xgRootLayer(app.activeDocument, false);
    if (!root) return "error:No X-Grid guides in this document yet.";
    return setGuideVisibility(root.visible ? "0" : "1");
}

function setGuideLock(val) {
    if (app.documents.length === 0) return "error:No document open.";
    var root = xgRootLayer(app.activeDocument, false);
    if (!root) return "error:No X-Grid guides in this document yet.";
    root.locked = (val === "1");
    return getDocState();
}

// "ok:<visible>|<locked>|<has X-Grid layer>"
function getDocState() {
    if (app.documents.length === 0) return "error:No document open.";
    var root = xgRootLayer(app.activeDocument, false);
    if (!root) return "ok:1|0|0";
    return "ok:" + (root.visible ? "1" : "0") + "|" + (root.locked ? "1" : "0") + "|1";
}

function getArtboardSize(idx) {
    if (app.documents.length === 0) return "error:No document open.";
    try {
        var r = getArtboard(app.activeDocument, parseInt(idx));
    } catch (e) { return "error:" + e.message; }
    var W = Math.round((r[2] - r[0]) * 100) / 100;
    var H = Math.round((r[1] - r[3]) * 100) / 100;
    return "ok:" + W + "|" + H;
}

// ─── Engine ─────────────────────────────────────────────────────────────────
// Generators never write to the document. addVGuide / addHGuide / draw* only
// queue ops; xgCommit() then writes them in one pass into sublayers of the
// "X-Grid" layer, replacing what X-Grid drew earlier on the same artboards.
// Only X-Grid's own layer is ever scanned (scanning doc.pathItems froze
// Illustrator on large documents), the user's own guides are never touched,
// and a generator that returns an error leaves the document unchanged.

var XG_LAYER      = "X-Grid";
var XG_MAX_GUIDES = 5000;
var XG            = null;   // queue of the call in progress
var XG_DEPTH      = 0;      // createQuadrants calls another generator

function xgRound(v) { return Math.round(v * 100) / 100; }

// Input checks: a bad value stops the generator with a message (the engine
// then leaves the document untouched) instead of silently becoming a default.
function xgCount(v, min, max, label) {
    var n = Number(v);
    if (String(v) === "" || isNaN(n) || n !== Math.floor(n) || n < min || n > max)
        throw new Error(label + " must be a whole number from " + min + " to " + max + ".");
    return n;
}
function xgLen(v, label, positive) {
    if (String(v) === "" || v === undefined) {
        if (positive) throw new Error(label + " must be greater than 0.");
        return 0;
    }
    var n = Number(v);
    if (isNaN(n)) throw new Error(label + " must be a number.");
    if (n < 0) throw new Error(label + " can't be negative.");
    if (positive && n <= 0) throw new Error(label + " must be greater than 0.");
    return n;
}
// Union of the selected objects' bounds, or null. Text being edited and huge
// selections (slow to measure on every poll) give null.
function xgSelectionRect(doc, limit) {
    var sel = doc.selection;
    if (!sel || sel.typename === "TextRange" || !sel.length || (limit && sel.length > limit)) return null;
    var r = null;
    for (var i = 0; i < sel.length; i++) {
        var g = sel[i].geometricBounds;
        if (!r) r = [g[0], g[1], g[2], g[3]];
        else { r[0] = Math.min(r[0], g[0]); r[1] = Math.max(r[1], g[1]); r[2] = Math.max(r[2], g[2]); r[3] = Math.min(r[3], g[3]); }
    }
    return (r && r[2] - r[0] > 0.5 && r[1] - r[3] > 0.5) ? r : null;
}

// index: an artboard index, -2 = the active artboard, -3 = the bounds of the
// selection. Generators expand -1 (all artboards) themselves; here it also
// means the active one.
function getArtboard(doc, index) {
    if (index === -3) {
        var s = xgSelectionRect(doc, 0);
        if (!s) throw new Error("Select one or more objects to build the grid inside.");
        if (XG) { XG.rects.sel = s; XG.cur = "sel"; }
        return s;
    }
    var i = (index === -1 || index === -2) ? doc.artboards.getActiveArtboardIndex() : index;
    if (isNaN(i) || i < 0 || i >= doc.artboards.length)
        throw new Error("That artboard no longer exists. Pick another one.");
    var rect = doc.artboards[i].artboardRect; // [left, top, right, bottom]
    if (XG) { XG.rects[i] = rect; XG.cur = i; }
    return rect;
}

// Items are named after the rect of the artboard they were drawn for, so a
// regenerate finds them even when they reach past the artboard edge.
// Grids built inside a selection carry a "sel" tag, so regenerating the
// artboard around them leaves them alone.
function xgTag(rect, isSel) {
    return XG_LAYER + (isSel ? " sel " : " ") +
           xgRound(rect[0]) + "," + xgRound(rect[1]) + "," + xgRound(rect[2]) + "," + xgRound(rect[3]);
}

// Panel setting: snap guide positions to whole pixels (screen/UI work).
var XG_PIXEL = false;
function setPixelSnap(v) { XG_PIXEL = (v === "1"); return "ok:"; }

function xgQueueGuide(x1, y1, x2, y2) {
    if (XG_PIXEL) { x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2); }
    var key = xgRound(x1) + "," + xgRound(y1) + "," + xgRound(x2) + "," + xgRound(y2);
    if (XG.keys[key]) return; // same guide twice (zero margin / zero gutter)
    XG.keys[key] = true;
    XG.guides++;
    XG.ops.push({ layer: XG.guideLayer, ab: XG.cur, guide: true, pts: [[x1, y1], [x2, y2]] });
}

function addVGuide(doc, x, top, bottom) { xgQueueGuide(x, top, x, bottom); }
function addHGuide(doc, y, left, right) { xgQueueGuide(left, y, right, y); }

function xgFindLayer(layers, name) {
    for (var i = 0; i < layers.length; i++) if (layers[i].name === name) return layers[i];
    return null;
}

function xgRootLayer(doc, create) {
    var root = xgFindLayer(doc.layers, XG_LAYER);
    if (!root && create) {
        var prev = doc.activeLayer;
        root = doc.layers.add();
        root.name = XG_LAYER;
        try { doc.activeLayer = prev; } catch (e) {}
    }
    return root;
}

function xgSublayer(root, name, create) {
    var sub = xgFindLayer(root.layers, name);
    if (!sub && create) { sub = root.layers.add(); sub.name = name; }
    if (sub) { sub.locked = false; sub.visible = true; }
    return sub;
}

// Belongs to one of the artboards: tagged for it, or (artboard moved or
// resized since) its centre lies on it.
// live: tags of every artboard as it is now. An item tagged for another
// existing artboard is never taken by the centre test (overlapping artboards).
function xgOwned(item, rects, live) {
    var g  = item.geometricBounds;
    var cx = (g[0] + g[2]) / 2, cy = (g[1] + g[3]) / 2;
    for (var k in rects) {
        var r = rects[k];
        if (item.name === xgTag(r, k === "sel")) return true;
        // the centre test is for artboards that moved or were resized; it must
        // not pick up selection grids, nor run for a selection target at all
        if (k !== "sel" && item.name.indexOf(XG_LAYER + " sel ") !== 0 && !live[item.name] &&
            cx >= r[0] && cx <= r[2] && cy <= r[1] && cy >= r[3]) return true;
    }
    return false;
}

function xgClearLayer(layer, rects) {
    var live = {};
    if (rects) {
        var abs = app.activeDocument.artboards;
        for (var a = 0; a < abs.length; a++) live[xgTag(abs[a].artboardRect)] = true;
    }
    for (var i = layer.pageItems.length - 1; i >= 0; i--) {
        var it = layer.pageItems[i];
        try { if (!rects || xgOwned(it, rects, live)) it.remove(); } catch (e) {}
    }
}

function xgStyle(item, op) {
    item.filled = false;
    if (op.guide) { item.stroked = false; item.guides = true; return; }
    item.stroked = true;
    item.strokeWidth = op.w;
    item.strokeColor = makeColor(op.rgb[0], op.rgb[1], op.rgb[2]);
}

function xgCommit(msg) {
    if (XG.guides > XG_MAX_GUIDES)
        return "error:Too many guides (" + XG.guides + "). Increase the spacing or pick fewer artboards.";
    var doc  = app.activeDocument;
    var prev = doc.activeLayer;
    var root = xgRootLayer(doc, true);
    var wasLocked = root.locked;
    root.locked = false; root.visible = true;

    var subs = {};
    for (var i = 0; i < XG.ops.length; i++) {
        var name = XG.ops[i].layer;
        if (!subs[name]) { subs[name] = xgSublayer(root, name, true); xgClearLayer(subs[name], XG.rects); }
    }
    var noted = {};
    for (var j = 0; j < XG.ops.length; j++) {
        var op = XG.ops[j], it;
        if (op.ellipse) it = subs[op.layer].pathItems.ellipse(op.e[0], op.e[1], op.e[2], op.e[3]);
        else { it = subs[op.layer].pathItems.add(); it.setEntirePath(op.pts); it.closed = !!op.closed; }
        xgStyle(it, op);
        it.name = xgTag(XG.rects[op.ab], op.ab === "sel");
        // the first item per artboard and sublayer carries the recipe, so the
        // grid can be loaded back into the panel or rebuilt when the artboard
        // is resized
        if (!noted[op.ab + "/" + op.layer]) { noted[op.ab + "/" + op.layer] = true; it.note = XG.recipe; }
    }
    root.locked = wasLocked;
    try { doc.activeLayer = prev; } catch (e) {}
    if (XG.guides) msg += " " + XG.guides + " guide" + (XG.guides === 1 ? "" : "s") + ".";
    return msg;
}

// Wraps a generator: queue → commit on "ok:", discard on error, never throw.
// guides: the sublayer this generator's guides go to, so a column grid and
// safe zones (say) can sit on the same artboard and each regenerates alone.
// name: the generator's name, kept in the recipe ("xg1;<name>;<params>",
// params without the trailing artboard field, which every generator has).
function xgWrap(fn, guides, name) {
    return function (params) {
        if (app.documents.length === 0) return "error:No document open.";
        if (XG_DEPTH > 0) return fn(params);
        XG_DEPTH++;
        var p = String(params).split("|"); p.pop();
        XG = { ops: [], rects: {}, keys: {}, guides: 0, guideLayer: guides,
               recipe: "xg1;" + name + ";" + p.join("|") };
        try {
            var r = fn(params);
            if (typeof r === "string" && r.indexOf("ok:") === 0 && XG.ops.length) r = xgCommit(r);
            return r;
        } catch (e) {
            return "error:" + e.message;
        } finally {
            XG = null; XG_DEPTH--;
        }
    };
}

// ─── Column Grid ─────────────────────────────────────────────────────────────
// params: "cols|gutter|mTop|mRight|mBottom|mLeft|abIndex"

function createColumnGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";

    var p       = params.split("|");
    var cols    = xgCount(p[0], 1, 200, "Columns");
    var gutter  = xgLen(p[1], "Gutter");
    var mTop    = xgLen(p[2], "Top margin");
    var mRight  = xgLen(p[3], "Right margin");
    var mBottom = xgLen(p[4], "Bottom margin");
    var mLeft   = xgLen(p[5], "Left margin");
    var abIdx   = parseInt(p[6]);

    var doc = app.activeDocument;

    var artboards = (abIdx === -1)
        ? (function() { var arr = []; for (var i = 0; i < doc.artboards.length; i++) arr.push(i); return arr; })()
        : [abIdx];


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
    var cols = xgCount(p[0], 1, 200, "Columns");
    var rows = xgCount(p[1], 1, 200, "Rows");
    var gapX = xgLen(p[2], "Column gap");
    var gapY = xgLen(p[3], "Row gap");
    var mTop = xgLen(p[4], "Top margin");
    var mRight  = xgLen(p[5], "Right margin");
    var mBottom = xgLen(p[6], "Bottom margin");
    var mLeft   = xgLen(p[7], "Left margin");
    var abIdx   = parseInt(p[8]);

    var doc = app.activeDocument;

    var artboards = (abIdx === -1)
        ? (function() { var arr = []; for (var i = 0; i < doc.artboards.length; i++) arr.push(i); return arr; })()
        : [abIdx];


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
    var spacing   = xgLen(p[1], "Spacing", true);
    var boldEvery = xgCount(p[2] === "" ? "0" : p[2], 0, 1000, "Bold every");
    var mTop      = xgLen(p[3], "Top margin");
    var mRight    = xgLen(p[4], "Right margin");
    var mBottom   = xgLen(p[5], "Bottom margin");
    var mLeft     = xgLen(p[6], "Left margin");
    var abIdx     = parseInt(p[7]);

    var doc = app.activeDocument;

    var artboards = (abIdx === -1)
        ? (function() { var arr = []; for (var i = 0; i < doc.artboards.length; i++) arr.push(i); return arr; })()
        : [abIdx];


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

// "ok:" + JSON {active, abs:[{n,w,h}]} — the panel polls this, so keep it cheap.
// withSel "1": also report the selection size (only while Selection is the
// target, so the poll doesn't measure big selections for nothing).
function getArtboardInfo(withSel) {
    if (app.documents.length === 0) return "error:No document open.";
    var doc = app.activeDocument, out = [], selJson = "null";
    if (withSel === "1") {
        var s = xgSelectionRect(doc, 500);
        if (s) selJson = "[" + xgRound(s[2] - s[0]) + "," + xgRound(s[1] - s[3]) + "]";
    }
    for (var i = 0; i < doc.artboards.length; i++) {
        var ab = doc.artboards[i], r = ab.artboardRect;
        var n = String(ab.name).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\x00-\x1f]/g, " ");
        out.push('{"n":"' + n + '","w":' + xgRound(r[2] - r[0]) + ',"h":' + xgRound(r[1] - r[3]) +
                 ',"r":"' + xgRound(r[0]) + "," + xgRound(r[1]) + "," + xgRound(r[2]) + "," + xgRound(r[3]) + '"}');
    }
    var st = getDocState().slice(3).split("|");
    return 'ok:{"doc":"' + String(doc.name).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
           '","active":' + doc.artboards.getActiveArtboardIndex() +
           ',"vis":' + st[0] + ',"lock":' + st[1] + ',"has":' + st[2] + ',"sel":' + selJson +
           ',"abs":[' + out.join(",") + ']}';
}

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
    return clearArtboard("-1");
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
        mTop:    xgLen(p[0], "Top margin"),
        mRight:  xgLen(p[1], "Right margin"),
        mBottom: xgLen(p[2], "Bottom margin"),
        mLeft:   xgLen(p[3], "Left margin"),
        abIdx:   parseInt(p[4])
    };
}

// ─── Rule of Thirds ──────────────────────────────────────────────────────────
// params: "mTop|mRight|mBottom|mLeft|abIndex"

function createRuleOfThirds(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var m   = compMargins(params);
    var doc = app.activeDocument;
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
    drawLine(layer, x1, y1, x2, y2);
}

function createIsometricGrid(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p       = params.split("|");
    var spacing = parseFloat(p[0]) || 20;
    var showH   = (p[1] === "1");
    var abIdx   = parseInt(p[2]);
    if (spacing < 4) return "error:Spacing too small (min 4).";
    var doc = app.activeDocument;

    var isoLayer = getOrCreateLayer(doc, "Iso Grid");

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

// Returns a handle naming the X-Grid sublayer; draw* queue into it.
function getOrCreateLayer(doc, name) {
    return { xgLayer: name };
}

function clearPathLayer(name) {
    if (app.documents.length === 0) return "error:No document open.";
    try {
        var root = xgRootLayer(app.activeDocument, false);
        var sub  = root && xgFindLayer(root.layers, name);
        if (!sub) return "ok:Nothing to clear.";
        var wasLocked = root.locked;
        root.locked = false; sub.locked = false;
        xgClearLayer(sub, null);
        root.locked = wasLocked;
        return "ok:Cleared.";
    } catch (e) { return "error:" + e.message; }
}

// Removes everything X-Grid drew on the target: an artboard index, -2 = the
// active artboard, -1 = all artboards. Other artboards and user guides stay.
function clearArtboard(idx) {
    if (app.documents.length === 0) return "error:No document open.";
    try {
        var doc  = app.activeDocument;
        var root = xgRootLayer(doc, false);
        if (!root) return "ok:Nothing to clear.";
        var i = parseInt(idx), rects = {}, label;
        if (i === -1) { rects = null; label = "all artboards"; }  // selection grids too
        else if (i === -3) { rects.sel = getArtboard(doc, -3); label = "the selection"; }
        else {
            var n = (i === -2) ? doc.artboards.getActiveArtboardIndex() : i;
            rects[n] = getArtboard(doc, n);
            label = doc.artboards[n].name;
        }
        var wasLocked = root.locked;
        root.locked = false;
        for (var s = 0; s < root.layers.length; s++) {
            root.layers[s].locked = false;
            xgClearLayer(root.layers[s], rects);
        }
        root.locked = wasLocked;
        return "ok:Cleared " + label + ".";
    } catch (e) { return "error:" + e.message; }
}

function clearAllPathLayers() {
    return clearAllCustomLayers();
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
    drawPoly(layer, [[x1,y1],[x2,y2]], false, r, g, b, w);
}
function drawEllipseItem(layer, cx, cy, rx, ry, r, g, b, w) {
    XG.ops.push({ layer: layer.xgLayer, ab: XG.cur, ellipse: true, e: [cy+ry, cx-rx, 2*rx, 2*ry],
                  rgb: [r||0, g||170, b||230], w: w || 0.5 });
}
function drawPoly(layer, pts, closed, r, g, b, w) {
    if (pts.length < 2) return;
    XG.ops.push({ layer: layer.xgLayer, ab: XG.cur, pts: pts, closed: !!closed,
                  rgb: [r||0, g||170, b||230], w: w || 0.5 });
}

// ─── Root-N Rectangle ─────────────────────────────────────────────────────────
// params: "n|mTop|mRight|mBottom|mLeft|abIndex"

function createRootN(params) {
    if (app.documents.length === 0) return "error:No document open.";
    var p = params.split("|");
    var n = parseFloat(p[0]); var ratio = 1 / Math.sqrt(n);
    var m = compMargins(p.slice(1).join("|"));
    var doc = app.activeDocument;    var abs = compArtboards(m.abIdx, doc);
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
    var abIdx=parseInt(params), doc=app.activeDocument;    var abs=compArtboards(abIdx,doc);
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
    var m=compMargins(params), doc=app.activeDocument;    var abs=compArtboards(m.abIdx,doc);
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
    var m=compMargins(p.slice(1).join("|")), doc=app.activeDocument;    var phi=1.6180339887, abs=compArtboards(m.abIdx,doc);
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
    var m=compMargins(p.slice(3).join("|")), doc=app.activeDocument;    var abs=compArtboards(m.abIdx,doc);
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
    var abIdx=parseInt(params), doc=app.activeDocument;    var bps=[320,480,768,1024,1280,1440], abs=compArtboards(abIdx,doc);
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

// ─── Social Safe Zones ───────────────────────────────────────────────────────
// params: "kind|abIndex". Zones are fractions of the artboard, measured on the
// apps' 1080-wide layouts, so they scale to any artboard size. Approximate:
// the apps move their buttons now and then.
var XG_SOCIAL = {
    // [top, right, bottom, left] kept clear of app UI
    igstory: { safe: [250/1920, 0, 250/1920, 0] },
    igreel:  { safe: [220/1920, 120/1080, 420/1920, 0], crop: 4/5 },  // feed shows a 4:5 centre crop
    tiktok:  { safe: [130/1920, 140/1080, 484/1920, 60/1080] },
    igpost:  { crop: 3/4 },                                           // profile grid shows 3:4
    ytthumb: { box: [1 - 200/1280, 1 - 60/720] }                      // timestamp, bottom-right
};

function createSocialSafe(params) {
    var p = params.split("|"), kind = XG_SOCIAL[p[0]], doc = app.activeDocument;
    if (!kind) return "error:Unknown format.";
    var abs = compArtboards(parseInt(p[1]), doc);
    for (var a = 0; a < abs.length; a++) {
        var b = getArtboard(doc, abs[a]), W = b[2] - b[0], H = b[1] - b[3];
        if (kind.safe) {
            var s = kind.safe;
            if (s[0]) addHGuide(doc, b[1] - H * s[0], b[0], b[2]);
            if (s[2]) addHGuide(doc, b[3] + H * s[2], b[0], b[2]);
            if (s[1]) addVGuide(doc, b[2] - W * s[1], b[1], b[3]);
            if (s[3]) addVGuide(doc, b[0] + W * s[3], b[1], b[3]);
        }
        if (kind.crop) {
            // centred crop of ratio w:h — horizontal band if the artboard is taller
            var cropH = W / kind.crop, cropW = H * kind.crop;
            if (cropH < H) {
                addHGuide(doc, b[1] - (H - cropH) / 2, b[0], b[2]);
                addHGuide(doc, b[3] + (H - cropH) / 2, b[0], b[2]);
            } else if (cropW < W) {
                addVGuide(doc, b[0] + (W - cropW) / 2, b[1], b[3]);
                addVGuide(doc, b[2] - (W - cropW) / 2, b[1], b[3]);
            }
        }
        if (kind.box) {
            var x = b[0] + W * kind.box[0], y = b[3] + H * (1 - kind.box[1]);
            addVGuide(doc, x, y, b[3]);
            addHGuide(doc, y, x, b[2]);
        }
    }
    return "ok:Safe zones created.";
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
    var abIdx=parseInt(params), doc=app.activeDocument;    var abs=compArtboards(abIdx,doc);
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
    var abIdx=parseInt(params), doc=app.activeDocument;    var phi=1.6180339887, abs=compArtboards(abIdx,doc);
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
    try {
        var root = xgRootLayer(app.activeDocument, false);
        if (!root) return "ok:Nothing to clear.";
        root.locked = false;
        root.remove();
        return "ok:All X-Grid guides and layers cleared.";
    } catch (e) { return "error:" + e.message; }
}

// ─── Grid to shapes ──────────────────────────────────────────────────────────
// Draws the columns (or modular cells) as real rectangles — for wireframes and
// presentations — grouped per artboard on an "X-Grid Shapes" layer. They are
// artwork, not guides: X-Grid never clears or rebuilds them.
// params: "cols|rows|gapX|gapY|mTop|mRight|mBottom|mLeft|abIndex" (rows 1 = columns)
function createGridShapes(params) {
    if (app.documents.length === 0) return "error:No document open.";
    try {
        var p = params.split("|"), doc = app.activeDocument;
        var cols = xgCount(p[0], 1, 200, "Columns"), rows = xgCount(p[1], 1, 200, "Rows");
        var gapX = xgLen(p[2], "Column gap"), gapY = xgLen(p[3], "Row gap");
        var m = [xgLen(p[4], "Top margin"), xgLen(p[5], "Right margin"), xgLen(p[6], "Bottom margin"), xgLen(p[7], "Left margin")];
        var abIdx = parseInt(p[8]), abs = compArtboards(abIdx, doc), cells = [];

        // measure everything first, so a bad value draws nothing
        for (var a = 0; a < abs.length; a++) {
            var b = getArtboard(doc, abs[a]);
            var left = b[0] + m[3], top = b[1] - m[0], W = b[2] - m[1] - left, H = top - (b[3] + m[2]);
            var cw = (W - (cols - 1) * gapX) / cols, rh = (H - (rows - 1) * gapY) / rows;
            if (cw <= 0 || rh <= 0) return "error:Gap/Margin too large for artboard.";
            cells.push({ left: left, top: top, cw: cw, rh: rh });
        }

        // p[9] "1": Arabic panel — numbered from the right, Arabic names
        // (\u escapes: ExtendScript may not read this file as UTF-8)
        var rtl = p[9] === "1";
        var W_COL = rtl ? "عمود" : "Column", W_CELL = rtl ? "خلية" : "Cell";
        var W_COLS = rtl ? " أعمدة" : " columns", W_CELLS = rtl ? " خلايا" : " cells";

        var prev = doc.activeLayer, layer = xgFindLayer(doc.layers, "X-Grid Shapes");
        if (!layer) { layer = doc.layers.add(); layer.name = "X-Grid Shapes"; }
        layer.locked = false; layer.visible = true;
        var fill = makeColor(37, 90, 176), n = 0;
        for (var c = 0; c < cells.length; c++) {
            var k = cells[c], g = layer.groupItems.add();
            g.name = rows > 1 ? cols + "\xd7" + rows + W_CELLS : cols + W_COLS;
            for (var r = 0; r < rows; r++) for (var i = 0; i < cols; i++) {
                var rect = g.pathItems.rectangle(k.top - r * (k.rh + gapY), k.left + i * (k.cw + gapX), k.cw, k.rh);
                rect.stroked = false; rect.filled = true; rect.fillColor = fill; rect.opacity = 20;
                var num = rtl ? cols - i : i + 1;
                rect.name = rows > 1 ? W_CELL + " " + (r + 1) + "-" + num : W_COL + " " + num;
                n++;
            }
        }
        try { doc.activeLayer = prev; } catch (e) {}
        return "ok:" + n + " shapes on the 'X-Grid Shapes' layer.";
    } catch (e) { return "error:" + e.message; }
}

// ─── Baseline from selected text ─────────────────────────────────────────────
// "ok:<leading>|<top offset>" in pt: a baseline grid with this spacing and top
// margin runs through the first baseline of the selected text frame.
function baselineFromText(idx) {
    if (app.documents.length === 0) return "error:No document open.";
    try {
        var doc = app.activeDocument, sel = doc.selection, tf = null;
        if (sel && sel.typename === "TextRange") tf = sel.story.textFrames[0];
        else if (sel && sel.length) for (var i = 0; i < sel.length && !tf; i++) if (sel[i].typename === "TextFrame") tf = sel[i];
        if (!tf) return "error:Select a text frame first.";
        if (tf.kind === TextType.PATHTEXT) return "error:Use point or area text, not type on a path.";

        var ch = tf.textRange.characters[0], ca = ch.characterAttributes;
        var lead = ca.autoLeading ? ca.size * ch.paragraphAttributes.autoLeadingAmount / 100 : ca.leading;

        // area text has no anchor: a point-text copy of it starts on the same baseline
        var y;
        if (tf.kind === TextType.POINTTEXT) y = tf.anchor[1];
        else {
            var tmp = tf.duplicate(), tag = "xg-baseline-" + new Date().getTime(), pt = null;
            tmp.name = tag; tmp.convertAreaObjectToPointObject();
            var frames = tf.layer.textFrames;
            for (var f = 0; f < frames.length; f++) if (frames[f].name === tag) { pt = frames[f]; break; }
            if (!pt) return "error:Couldn't read the first baseline of this text.";
            y = pt.anchor[1]; pt.remove();
        }
        var top = getArtboard(doc, parseInt(idx) === -1 ? -2 : parseInt(idx))[1];
        var off = (top - y) % lead; if (off < 0) off += lead;
        return "ok:" + Math.round(lead * 1000) / 1000 + "|" + Math.round(off * 1000) / 1000;
    } catch (e) { return "error:" + e.message; }
}

// ─── Recipes: load a grid back, rebuild it when the artboard changes ─────────

// Recipes on items carrying the given tag, deduplicated.
function xgRecipesByTag(root, tag) {
    var out = [], seen = {};
    for (var s = 0; s < root.layers.length; s++) {
        var items = root.layers[s].pageItems;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it.name !== tag || it.note.indexOf("xg1;") !== 0 || seen[it.note]) continue;
            seen[it.note] = true;
            out.push(it.note);
        }
    }
    return out;
}

function xgJsonStr(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }

// "ok:" + JSON [{fn, p}] for the grids on an artboard (-2 = active, -3 = selection).
function getRecipes(idx) {
    if (app.documents.length === 0) return "error:No document open.";
    try {
        var doc = app.activeDocument, root = xgRootLayer(doc, false), i = parseInt(idx);
        if (!root || i === -1) return "ok:[]";
        var tag = (i === -3) ? xgTag(getArtboard(doc, -3), true) : xgTag(getArtboard(doc, i));
        var list = xgRecipesByTag(root, tag), out = [];
        for (var k = 0; k < list.length; k++) {
            var r = list[k].split(";");
            out.push('{"fn":' + xgJsonStr(r[1]) + ',"p":' + xgJsonStr(r.slice(2).join(";")) + '}');
        }
        return "ok:[" + out.join(",") + "]";
    } catch (e) { return "ok:[]"; }
}

// Artboard idx was moved or resized from oldRect ("l,t,r,b"): rebuild every
// X-Grid grid that was drawn for the old rect, on the artboard as it is now.
// One script call, so it is one undo step.
function reflowArtboard(idx, oldRect) {
    if (app.documents.length === 0) return "error:No document open.";
    var doc = app.activeDocument, root = xgRootLayer(doc, false);
    if (!root) return "ok:0";
    var o = String(oldRect).split(","), tag = xgTag([+o[0], +o[1], +o[2], +o[3]]);
    var list = xgRecipesByTag(root, tag);
    if (!list.length) return "ok:0";
    var wasLocked = root.locked;
    root.locked = false;
    for (var s = 0; s < root.layers.length; s++) {
        var items = root.layers[s].pageItems;
        root.layers[s].locked = false;
        for (var i = items.length - 1; i >= 0; i--) if (items[i].name === tag) items[i].remove();
    }
    root.locked = wasLocked;
    var done = 0;
    for (var k = 0; k < list.length; k++) {
        // the note is document content: only ever resolve one of our generator names
        var r = list[k].split(";"), p = r.slice(2).join(";");
        if (!/^create\w+$/.test(r[1])) continue;
        var fn; try { fn = eval(r[1]); } catch (e) { continue; }
        if (typeof fn !== "function") continue;
        if (String(fn(p === "" ? String(idx) : p + "|" + idx)).indexOf("ok:") === 0) done++;
    }
    return "ok:" + done;
}

// ─── Public generators go through the engine ─────────────────────────────────
(function () {
    var names = ["createColumnGrid","createModularGrid","createBaselineGrid",
        "createRuleOfThirds","createPhiGrid","createCenterCross","createRootTwo",
        "createVanDeGraaf","createFibonacci","createRabatment","createIsometricGrid",
        "createDiagonalCross","createRadialGrid","createRootN","createQuadrants",
        "createTriangleComp","createGoldenSpiral","createHarmonicArmature",
        "createBaroqueDiagonal","createSinisterDiagonal","create14LineArmature",
        "createVillardDiagram","createTschichold","createManuscriptGrid",
        "createHierarchicalGrid","createCompoundGrid","createResponsiveGrid",
        "createSteelyard","createOCircle","createLShape","createUShape","createCShape",
        "createTShape","createTunnel","createVesicaPiscis","createFlowerOfLife",
        "create1PointPerspective","create2PointPerspective","create3PointPerspective",
        "createAxialSystem","createDilatational","createSCurve","createZPattern",
        "createFPattern","createSafeAreas","createModulor","createSocialSafe"];
    var guideLayer = {
        createColumnGrid: "Columns", createModularGrid: "Modular", createBaselineGrid: "Baseline",
        createManuscriptGrid: "Layout", createHierarchicalGrid: "Layout", createCompoundGrid: "Layout",
        createResponsiveGrid: "Layout", createSocialSafe: "Safe Zones"
    };
    // Reassign through the scope chain: $.global misses declarations when the
    // file is loaded with $.evalFile instead of as the panel's ScriptPath.
    for (var i = 0; i < names.length; i++)
        eval(names[i] + " = xgWrap(" + names[i] + ', "' + (guideLayer[names[i]] || "Comp Guides") +
             '", "' + names[i] + '")');
})();
