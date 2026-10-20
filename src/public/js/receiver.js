(() => {
    const imageElement = document.getElementById("screenImage");
    const statusElement = document.getElementById("status");
    const fullScreenButton = document.getElementById("fullScreen");

    let currentVersion = -1;
    let requestInProgress = false;
    let pollTimer = null;

    async function updateImage() {
        if (requestInProgress) return;
        requestInProgress = true;

        try {
            const response = await fetch("/api/image", { cache: "no-store" });

            if (response.status === 204) {
                imageElement.hidden = true;
                statusElement.hidden = false;
                statusElement.textContent = "Ожидание изображения преподавателя...";
                currentVersion = -1;
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.version !== currentVersion) {
                // Меняем изображение только после загрузки нового data URL.
                imageElement.onload = () => {
                    imageElement.hidden = false;
                    statusElement.hidden = true;
                };
                imageElement.onerror = () => {
                    imageElement.hidden = true;
                    statusElement.hidden = false;
                    statusElement.textContent = "Не удалось отобразить полученное изображение.";
                };
                imageElement.src = data.image;
                currentVersion = data.version;
            }
        } catch (error) {
            statusElement.hidden = false;
            statusElement.textContent = `Нет соединения с сервером: ${error.message}`;
        } finally {
            requestInProgress = false;
        }
    }

    fullScreenButton.addEventListener("click", async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                fullScreenButton.textContent = "Выйти из полного экрана";
            } else {
                await document.exitFullscreen();
                fullScreenButton.textContent = "Полный экран";
            }
        } catch {
            statusElement.hidden = false;
            statusElement.textContent = "Браузер не разрешил полноэкранный режим.";
        }
    });

    document.addEventListener("fullscreenchange", () => {
        fullScreenButton.textContent = document.fullscreenElement
            ? "Выйти из полного экрана"
            : "Полный экран";
    });

    updateImage();
    pollTimer = setInterval(updateImage, 500);

    window.addEventListener("beforeunload", () => {
        if (pollTimer) clearInterval(pollTimer);
    });
})();
