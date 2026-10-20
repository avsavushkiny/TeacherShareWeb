(() => {
    const startButton = document.getElementById("startCapture");
    const selectButton = document.getElementById("selectRegion");
    const sendButton = document.getElementById("sendImage");
    const autoButton = document.getElementById("autoUpdate");
    const stopButton = document.getElementById("stopCapture");
    const statusLabel = document.getElementById("status");
    const canvas = document.getElementById("preview");
    const ctx = canvas.getContext("2d");
    const imageFile = document.getElementById("imageFile");
    const sendImageFileButton = document.getElementById("sendImageFile");
    const textContent = document.getElementById("textContent");
    const fontSize = document.getElementById("fontSize");
    const fontSizeValue = document.getElementById("fontSizeValue");
    const textColor = document.getElementById("textColor");
    const backgroundColor = document.getElementById("backgroundColor");
    const showTextButton = document.getElementById("showText");

    let stream = null;
    let video = null;
    let selectedRegion = null;
    let selecting = false;
    let startPoint = null;
    let currentPoint = null;
    let autoTimer = null;
    let animationFrame = null;
    let sendInProgress = false;
    let selectionMode = false;
    let sourceMode = "none"; // capture, image, text, none

    function setStatus(message) { statusLabel.textContent = message; }

    async function postImage(image) {
        const response = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image })
        });
        if (!response.ok) {
            const details = await response.json().catch(() => ({}));
            throw new Error(details.error || `HTTP ${response.status}`);
        }
        stopButton.disabled = false;
    }

    function setStaticMode(mode) {
        stopLocalCapture();
        sourceMode = mode;
        startButton.disabled = false;
        selectButton.disabled = true;
        sendButton.disabled = true;
        autoButton.disabled = true;
        sendImageFileButton.disabled = mode !== "image";
        stopButton.disabled = false;
    }

    async function startCapture() {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            setStatus("Захват экрана не поддерживается этим браузером или контекстом. Откройте страницу через localhost в актуальном Chrome или Edge.");
            return;
        }
        try {
            stopLocalCapture();
            sourceMode = "capture";
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            video = document.createElement("video");
            video.srcObject = stream;
            video.muted = true;
            video.playsInline = true;
            await new Promise((resolve, reject) => {
                video.addEventListener("loadedmetadata", resolve, { once: true });
                video.addEventListener("error", reject, { once: true });
            });
            await video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            selectedRegion = null;
            selectionMode = false;
            canvas.style.cursor = "default";
            selectButton.disabled = false;
            sendButton.disabled = true;
            autoButton.disabled = true;
            stopButton.disabled = false;
            startButton.disabled = true;
            sendImageFileButton.disabled = true;
            stream.getVideoTracks()[0].addEventListener("ended", () => stopCapture(true), { once: true });
            setStatus(`Экран захвачен: ${canvas.width} × ${canvas.height}. Нажмите «Выделить область».`);
            renderPreview();
        } catch (error) {
            stopLocalCapture();
            sourceMode = "none";
            setStatus(`Не удалось захватить экран: ${error.message}`);
        }
    }
    startButton.addEventListener("click", startCapture);

    function renderPreview() {
        if (sourceMode !== "capture" || !video || !stream || stream.getVideoTracks()[0]?.readyState !== "live") {
            animationFrame = null;
            return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (selecting && startPoint && currentPoint) {
            const rect = rectangleFromPoints(startPoint, currentPoint);
            ctx.save();
            ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
            ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
            ctx.strokeStyle = "#00ff66";
            ctx.lineWidth = Math.max(2, canvas.width / 800);
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            ctx.fillStyle = "#00ff66";
            ctx.font = `${Math.max(14, canvas.width / 70)}px Segoe UI, Arial`;
            ctx.fillText(`${rect.width} × ${rect.height}`, rect.x + 6, Math.max(22, rect.y - 8));
            ctx.restore();
        } else if (selectedRegion) {
            ctx.save(); ctx.strokeStyle = "#00ff66"; ctx.lineWidth = Math.max(2, canvas.width / 800);
            ctx.strokeRect(selectedRegion.x, selectedRegion.y, selectedRegion.width, selectedRegion.height); ctx.restore();
        }
        animationFrame = requestAnimationFrame(renderPreview);
    }

    function canvasPoint(event) {
        const bounds = canvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width)),
            y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height))
        };
    }
    function rectangleFromPoints(a, b) {
        return {
            x: Math.round(Math.min(a.x, b.x)), y: Math.round(Math.min(a.y, b.y)),
            width: Math.round(Math.abs(b.x - a.x)), height: Math.round(Math.abs(b.y - a.y))
        };
    }

    selectButton.addEventListener("click", () => {
        if (sourceMode !== "capture" || !video) return;
        selectedRegion = null; selecting = false; selectionMode = true;
        sendButton.disabled = true; autoButton.disabled = true;
        canvas.style.cursor = "crosshair";
        setStatus("Зажмите левую кнопку мыши и выделите область. Esc отменяет выделение.");
    });
    canvas.addEventListener("pointerdown", event => {
        if (!selectionMode || sourceMode !== "capture" || !video || event.button !== 0) return;
        event.preventDefault(); selecting = true; startPoint = canvasPoint(event); currentPoint = startPoint;
        canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointermove", event => { if (selecting) currentPoint = canvasPoint(event); });
    function finishSelection(event) {
        if (!selecting) return;
        selecting = false; currentPoint = canvasPoint(event);
        const rect = rectangleFromPoints(startPoint, currentPoint);
        if (rect.width < 2 || rect.height < 2) { setStatus("Выбранная область слишком маленькая. Попробуйте ещё раз."); return; }
        selectedRegion = rect; selectionMode = false; canvas.style.cursor = "default";
        sendButton.disabled = false; autoButton.disabled = false;
        setStatus(`Область выбрана: ${rect.width} × ${rect.height}. Можно отправить снимок.`);
    }
    canvas.addEventListener("pointerup", finishSelection);
    canvas.addEventListener("pointercancel", () => { selecting = false; });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && selectionMode) {
            selecting = false; selectionMode = false; canvas.style.cursor = "default"; setStatus("Выделение отменено.");
        }
    });

    async function sendImage() {
        if (sourceMode !== "capture" || !video || !selectedRegion || sendInProgress) return;
        sendInProgress = true; sendButton.disabled = true;
        try {
            const r = selectedRegion;
            const imageCanvas = document.createElement("canvas"); imageCanvas.width = r.width; imageCanvas.height = r.height;
            imageCanvas.getContext("2d").drawImage(video, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
            await postImage(imageCanvas.toDataURL("image/png"));
            setStatus(`Снимок отправлен: ${r.width} × ${r.height}.`);
        } catch (error) { setStatus(`Ошибка отправки: ${error.message}`); }
        finally { sendInProgress = false; sendButton.disabled = !selectedRegion; }
    }
    sendButton.addEventListener("click", sendImage);

    imageFile.addEventListener("change", () => {
        const file = imageFile.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { setStatus("Выберите файл изображения."); return; }
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            setStaticMode("image");
            const maxDimension = 2400;
            const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            sendImageFileButton.disabled = false;
            setStatus(`Изображение загружено: ${file.name} (${canvas.width} × ${canvas.height}). Нажмите «Передать изображение».`);
            URL.revokeObjectURL(url);
        };
        image.onerror = () => { URL.revokeObjectURL(url); setStatus("Не удалось открыть этот файл изображения."); };
        image.src = url;
    });

    sendImageFileButton.addEventListener("click", async () => {
        if (sourceMode !== "image" || sendInProgress) return;
        sendInProgress = true; sendImageFileButton.disabled = true;
        try { await postImage(canvas.toDataURL("image/png")); setStatus("Изображение отправлено на проектор."); }
        catch (error) { setStatus(`Ошибка отправки изображения: ${error.message}`); }
        finally { sendInProgress = false; sendImageFileButton.disabled = false; }
    });

    function wrapText(text, maxWidth, font) {
        ctx.font = font;
        const result = [];
        for (const paragraph of text.split("\n")) {
            if (!paragraph.trim()) { result.push(""); continue; }
            let line = "";
            for (const word of paragraph.split(/\s+/)) {
                const candidate = line ? `${line} ${word}` : word;
                if (line && ctx.measureText(candidate).width > maxWidth) { result.push(line); line = word; }
                else line = candidate;
                // Длинные слова без пробелов делим по символам, чтобы не выходить за границы.
                if (!line.includes(" ") && ctx.measureText(line).width > maxWidth) {
                    let piece = "";
                    for (const char of line) {
                        if (piece && ctx.measureText(piece + char).width > maxWidth) { result.push(piece); piece = char; }
                        else piece += char;
                    }
                    line = piece;
                }
            }
            result.push(line);
        }
        return result;
    }

    function drawTextSlide() {
        setStaticMode("text");
        canvas.width = 1920; canvas.height = 1080;
        ctx.fillStyle = backgroundColor.value; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const size = Number(fontSize.value);
        const font = `600 ${size}px "Segoe UI", Arial, sans-serif`;
        const lines = wrapText(textContent.value || " ", canvas.width * 0.84, font);
        const lineHeight = size * 1.35;
        const maxLines = Math.max(1, Math.floor(canvas.height * 0.82 / lineHeight));
        const visibleLines = lines.slice(0, maxLines);
        ctx.font = font; ctx.fillStyle = textColor.value; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const totalHeight = visibleLines.length * lineHeight;
        let y = (canvas.height - totalHeight) / 2 + lineHeight / 2;
        for (const line of visibleLines) { ctx.fillText(line, canvas.width / 2, y); y += lineHeight; }
        setStatus(`Текстовый слайд подготовлен (${size} px). Нажмите «Показать текст на проекторе».`);
    }
    fontSize.addEventListener("input", () => { fontSizeValue.value = fontSize.value; if (sourceMode === "text") drawTextSlide(); });
    [textContent, textColor, backgroundColor].forEach(control => control.addEventListener("input", () => { if (sourceMode === "text") drawTextSlide(); }));
    showTextButton.addEventListener("click", async () => {
        drawTextSlide();
        try { await postImage(canvas.toDataURL("image/png")); setStatus("Текст отправлен на проектор. Измените текст или размер шрифта и нажмите кнопку снова."); }
        catch (error) { setStatus(`Ошибка отправки текста: ${error.message}`); }
    });

    autoButton.addEventListener("click", () => {
        if (autoTimer) {
            clearInterval(autoTimer); autoTimer = null;
            autoButton.textContent = "Автообновление: выкл."; setStatus("Автообновление отключено."); return;
        }
        autoTimer = setInterval(sendImage, 1000);
        autoButton.textContent = "Автообновление: вкл.";
        setStatus("Автообновление включено: снимок отправляется примерно раз в секунду."); sendImage();
    });

    function stopLocalCapture() {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        if (animationFrame !== null) { cancelAnimationFrame(animationFrame); animationFrame = null; }
        if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
        if (video) { video.pause(); video.srcObject = null; video = null; }
        selectedRegion = null; selecting = false; selectionMode = false; sendInProgress = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.cursor = "default";
        selectButton.disabled = true; sendButton.disabled = true; autoButton.disabled = true;
        startButton.disabled = false; autoButton.textContent = "Автообновление: выкл.";
        sendImageFileButton.disabled = true;
    }
    async function stopCapture(fromTrackEnded = false) {
        stopLocalCapture(); sourceMode = "none";
        stopButton.disabled = true;
        try { await fetch("/api/stop", { method: "POST" }); } catch { /* локальная остановка выполнена */ }
        setStatus(fromTrackEnded ? "Захват экрана завершён." : "Передача остановлена.");
    }
    stopButton.addEventListener("click", () => stopCapture(false));
    window.addEventListener("beforeunload", () => {
        if (autoTimer) clearInterval(autoTimer);
        if (stream) stream.getTracks().forEach(track => track.stop());
    });
})();
