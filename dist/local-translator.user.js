// ==UserScript==
// @name       local-translator
// @namespace  npm/vite-plugin-monkey
// @version    0.0.0
// @icon       https://vitejs.dev/logo.svg
// @match      *://*/*
// @require    https://unpkg.com/@popperjs/core@2/dist/umd/popper.min.js
// @require    https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js
// @connect    localhost
// @grant      GM_xmlhttpRequest
// ==/UserScript==

(function () {
  'use strict';

  const BATCH_SIZE = 5;
  function getParagraphs() {
    return Array.from(document.querySelectorAll("p, h1, h2, h3, li"));
  }
  function translateBatch(texts) {
    const prompt = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
    const fullPrompt = `将下面的文本逐条翻译成中文，每条翻译保持序号对应，不需要其他说明：
${prompt}`;
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: "http://localhost:1234/v1/chat/completions",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          model: "Qwen3.5-0.8B",
          messages: [{ role: "user", content: fullPrompt }]
        }),
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            const content = data.choices[0].message.content;
            const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
            resolve(lines);
          } catch (e) {
            reject(e);
          }
        },
        onerror: reject
      });
    });
  }
  async function translatePage() {
    const paragraphs = getParagraphs();
    let batch = [];
    for (let i = 0; i < paragraphs.length; i++) {
      batch.push(paragraphs[i]);
      if (batch.length === BATCH_SIZE || i === paragraphs.length - 1) {
        const texts = batch.map((p) => p.innerText.trim()).filter((t) => t !== "");
        if (texts.length > 0) {
          try {
            const translations = await translateBatch(texts);
            translations.forEach((t, idx) => {
              const p = batch[idx];
              if (!p) return;
              const span = document.createElement("span");
              span.textContent = " [" + t + "]";
              span.style.color = "blue";
              span.style.fontStyle = "italic";
              p.appendChild(span);
            });
          } catch (e) {
            console.error("Batch translation failed", e);
          }
        }
        batch = [];
      }
    }
  }
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "w" && e.altKey) {
      e.preventDefault();
      translatePage();
    }
  });
  let translateButton = null;
  let popup = null;
  let popupHeader = null;
  let popupContent = null;
  let popperInstance = null;
  function getSelectionText() {
    return window.getSelection()?.toString().trim() || "";
  }
  function hidePopup() {
    if (popup) popup.style.display = "none";
    if (popperInstance) {
      popperInstance.destroy();
      popperInstance = null;
    }
  }
  function createTranslateButton() {
    if (translateButton) return;
    translateButton = document.createElement("button");
    translateButton.textContent = "翻译";
    Object.assign(translateButton.style, {
      position: "fixed",
      zIndex: "999999",
      padding: "4px 8px",
      fontSize: "12px",
      borderRadius: "6px",
      border: "1px solid #ccc",
      background: "white",
      color: "#000",
      cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      userSelect: "none",
      display: "none"
    });
    translateButton.addEventListener("click", handleTranslateClick);
    document.body.appendChild(translateButton);
  }
  function createPopup() {
    if (popup) return;
    popup = document.createElement("div");
    popupHeader = document.createElement("div");
    popupContent = document.createElement("div");
    Object.assign(popupHeader.style, {
      width: "100%",
      padding: "6px 10px",
      background: "#444",
      cursor: "move",
      userSelect: "none",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      boxSizing: "border-box",
      borderTopLeftRadius: "8px",
      borderTopRightRadius: "8px"
    });
    const title = document.createElement("span");
    title.textContent = "翻译结果";
    title.style.color = "white";
    popupHeader.appendChild(title);
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "复制全文";
    Object.assign(copyBtn.style, {
      padding: "2px 6px",
      fontSize: "12px",
      borderRadius: "4px",
      border: "1px solid #ccc",
      cursor: "pointer",
      background: "white",
      color: "#000",
      marginLeft: "8px"
    });
    copyBtn.addEventListener("click", () => {
      if (popupContent) navigator.clipboard.writeText(popupContent.innerText);
    });
    popupHeader.appendChild(copyBtn);
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    Object.assign(closeBtn.style, {
      padding: "2px 6px",
      fontSize: "14px",
      borderRadius: "4px",
      border: "1px solid #ccc",
      cursor: "pointer",
      background: "white",
      color: "#000",
      marginLeft: "8px"
    });
    closeBtn.addEventListener("click", hidePopup);
    popupHeader.appendChild(closeBtn);
    Object.assign(popupContent.style, {
      padding: "10px",
      maxWidth: "400px",
      maxHeight: "300px",
      overflow: "auto",
      background: "#222",
      color: "white",
      fontSize: "14px",
      lineHeight: "1.5",
      whiteSpace: "pre-wrap",
      userSelect: "text"
    });
    popup.appendChild(popupHeader);
    popup.appendChild(popupContent);
    Object.assign(popup.style, {
      position: "fixed",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      zIndex: "999999",
      display: "none",
      background: "#222"
    });
    document.body.appendChild(popup);
    interact(popup).draggable({
      allowFrom: popupHeader,
      listeners: {
        start: () => {
        },
        move(event) {
          const target = event.target;
          const x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
          const y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;
          target.style.transform = `translate(${x}px, ${y}px)`;
          target.setAttribute("data-x", x.toString());
          target.setAttribute("data-y", y.toString());
        },
        end: () => {
          setTimeout(() => {
          }, 10);
        }
      }
    });
  }
  async function handleTranslateClick() {
    const text = getSelectionText();
    if (!text) return;
    createPopup();
    if (!popup || !popupContent) return;
    popupContent.textContent = "Translating...";
    popup.style.display = "block";
    if (translateButton && popperInstance) popperInstance.destroy();
    popperInstance = Popper.createPopper(translateButton, popup, {
      placement: "bottom",
      modifiers: [
        { name: "offset", options: { offset: [0, 8] } },
        { name: "preventOverflow", options: { padding: 10 } }
      ]
    });
    try {
      const result = await translate(text);
      popupContent.textContent = result;
    } catch (e) {
      popupContent.textContent = "Translation failed";
      console.error(e);
    }
  }
  function translate(text) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: "http://localhost:1234/v1/chat/completions",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          model: "Qwen3.5-0.8B",
          messages: [{ role: "user", content: "将下面文本翻译成中文，只输出翻译结果：" + text }]
        }),
        onload: (response) => {
          try {
            const data = JSON.parse(response.responseText);
            resolve(data.choices[0].message.content);
          } catch (e) {
            reject(e);
          }
        },
        onerror: reject
      });
    });
  }
  document.addEventListener("mouseup", (e) => {
    const text = getSelectionText();
    if (!text) return;
    createTranslateButton();
    if (!translateButton) return;
    const offsetY = -30;
    translateButton.style.left = `${e.clientX}px`;
    translateButton.style.top = `${e.clientY + offsetY}px`;
    translateButton.style.display = "block";
  });
  document.addEventListener("keydown", (e) => {
    console.log(`code: ${e.code}, key: "${e.key}", alt: ${e.altKey}`);
    if (e.code === "KeyW" && e.altKey && !e.shiftKey && !e.metaKey) {
      console.log("✅ Option + W 触发！");
      e.preventDefault();
      translatePage();
    }
  });

})();