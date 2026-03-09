// @ts-ignore isolatedModules
import { translatePage } from './fulltranslate';
declare const interact: any;
declare const Popper: any;
declare const GM_xmlhttpRequest: any;

// Type declaration for interact.js
declare namespace interact {
  export interface InteractEvent {
    dx: number;
    dy: number;
    target: HTMLElement;
  }
}

let translateButton: HTMLButtonElement | null = null;
let popup: HTMLDivElement | null = null;
let popupHeader: HTMLDivElement | null = null;
let popupContent: HTMLDivElement | null = null;
// @ts-ignore unused
let isDragging = false;
let popperInstance: any = null;

// ------------------- 工具 -------------------
function getSelectionText(): string {
  return window.getSelection()?.toString().trim() || "";
}

function hidePopup() {
  if (popup) popup.style.display = "none";
  if (popperInstance) {
    popperInstance.destroy();
    popperInstance = null;
  }
}

// ------------------- 创建翻译按钮 -------------------
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
    display: "none",
  });
  translateButton.addEventListener("click", handleTranslateClick);
  document.body.appendChild(translateButton);
}

// ------------------- 创建弹窗 -------------------
function createPopup() {
  if (popup) return;

  popup = document.createElement("div");
  popupHeader = document.createElement("div");
  popupContent = document.createElement("div");

  // 头部
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
    borderTopRightRadius: "8px",
  });

  // 头部文本
  const title = document.createElement("span");
  title.textContent = "翻译结果";
  title.style.color = "white";
  popupHeader.appendChild(title);

  // 复制全文按钮
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
    marginLeft: "8px",
  });
  copyBtn.addEventListener("click", () => {
    if (popupContent) navigator.clipboard.writeText(popupContent.innerText);
  });
  popupHeader.appendChild(copyBtn);

  // 关闭按钮 ×
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
    marginLeft: "8px",
  });
  closeBtn.addEventListener("click", hidePopup);
  popupHeader.appendChild(closeBtn);

  // 内容区
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
    userSelect: "text",
  });

  popup.appendChild(popupHeader);
  popup.appendChild(popupContent);

  Object.assign(popup.style, {
    position: "fixed",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    zIndex: "999999",
    display: "none",
    background: "#222",
  });

  document.body.appendChild(popup);

  // ---------- Interact.js 拖动 ----------
  interact(popup).draggable({
    allowFrom: popupHeader,
    listeners: {
      start: () => { isDragging = true; },
      move(event: interact.InteractEvent) {
        const target = event.target as HTMLElement;
        const x = (parseFloat(target.getAttribute('data-x')!) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')!) || 0) + event.dy;

        target.style.transform = `translate(${x}px, ${y}px)`;
        target.setAttribute('data-x', x.toString());
        target.setAttribute('data-y', y.toString());
      },
      end: () => { setTimeout(() => { isDragging = false; }, 10); },
    }
  });
}

// ------------------- 翻译逻辑 -------------------
async function handleTranslateClick() {
  const text = getSelectionText();
  if (!text) return;

  createPopup();
  if (!popup || !popupContent) return;

  popupContent.textContent = "Translating...";
  popup.style.display = "block";

  // 弹窗初始靠近按钮
  if (translateButton && popperInstance) popperInstance.destroy();
  popperInstance = Popper.createPopper(translateButton, popup, {
    placement: 'bottom',
    modifiers: [
      { name: 'offset', options: { offset: [0, 8] } },
      { name: 'preventOverflow', options: { padding: 10 } },
    ],
  });

  try {
    const result = await translate(text);
    popupContent.textContent = result;
  } catch (e) {
    popupContent.textContent = "Translation failed";
    console.error(e);
  }
}

function translate(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "POST",
      url: "http://localhost:1234/v1/chat/completions",
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({
        model: "Qwen3.5-0.8B",
        messages: [{ role: "user", content: "将下面文本翻译成中文，只输出翻译结果：" + text }],
      }),
      onload: (response: any) => {
        try {
          const data = JSON.parse(response.responseText);
          resolve(data.choices[0].message.content);
        } catch (e) { reject(e); }
      },
      onerror: reject,
    });
  });
}

// ------------------- 页面事件 -------------------

// 鼠标上方显示翻译按钮
document.addEventListener("mouseup", (e: MouseEvent) => {
  const text = getSelectionText();
  if (!text) return;

  createTranslateButton();
  if (!translateButton) return;

  const offsetY = -30;
  translateButton.style.left = `${e.clientX}px`;
  translateButton.style.top = `${e.clientY + offsetY}px`;
  translateButton.style.display = "block";
});

document.addEventListener("keydown", (e: KeyboardEvent) => {
  console.log(`code: ${e.code}, key: "${e.key}", alt: ${e.altKey}`);
  if (e.code === 'KeyW' && e.altKey && !e.shiftKey && !e.metaKey) {
    console.log('✅ Option + W 触发！');
    e.preventDefault();
    translatePage();
  }
});