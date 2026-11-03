var csInterface = new CSInterface();

document.getElementById("btn-create").addEventListener("click", function () {
    var statusEl = document.getElementById("status");
    statusEl.textContent = "Running...";
    statusEl.className = "status";

    csInterface.evalScript("createColumnGuides()", function (result) {
        try {
            var res = JSON.parse(result);
            statusEl.textContent = res.message;
            statusEl.className = res.success ? "status" : "status error";
        } catch (e) {
            statusEl.textContent = "Unexpected error.";
            statusEl.className = "status error";
        }
    });
});
