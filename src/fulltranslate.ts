// @ts-ignore isolatedModules
declare const GM_xmlhttpRequest: any;

const BATCH_SIZE = 5; // 每批处理 5 段文本

// ------------------- 获取页面段落 -------------------
function getParagraphs(): HTMLElement[] {
  return Array.from(document.querySelectorAll("p, h1, h2, h3, li")) as HTMLElement[];
}

// ------------------- 批量翻译函数 -------------------
function translateBatch(texts: string[]): Promise<string[]> {
  // 构建 prompt，把多段文本一次性发给模型
  const prompt = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const fullPrompt = `将下面的文本逐条翻译成中文，每条翻译保持序号对应，不需要其他说明：\n${prompt}`;

  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "POST",
      url: "http://localhost:1234/v1/chat/completions",
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({
        model: "Qwen3.5-0.8B",
        messages: [{ role: "user", content: fullPrompt }],
      }),
      onload: (res: any) => {
        try {
          const data = JSON.parse(res.responseText);
          const content = data.choices[0].message.content as string;
          // 按换行解析，每行对应一条翻译
          const lines = content.split(/\r?\n/).filter(l => l.trim() !== "");
          resolve(lines);
        } catch (e) { reject(e); }
      },
      onerror: reject,
    });
  });
}

// ------------------- 翻译整个网页 -------------------
export async function translatePage() {
  const paragraphs = getParagraphs();
  let batch: HTMLElement[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    batch.push(paragraphs[i]);

    if (batch.length === BATCH_SIZE || i === paragraphs.length - 1) {
      const texts = batch.map(p => p.innerText.trim()).filter(t => t !== "");
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

// ------------------- 快捷键监听 -------------------
document.addEventListener("keydown", (e: KeyboardEvent) => {
  // Option + W
  if (e.key.toLowerCase() === "w" && e.altKey) {
    e.preventDefault();
    translatePage();
  }
});