const DEFAULT_BASE_URL = 'https://jiuuij.de5.net/';
const STORAGE_KEY = 'github-pages-model-lab-v1';

const ui = {
  appShell: document.querySelector('#appShell'),
  settingsBackdrop: document.querySelector('#settingsBackdrop'),
  baseUrl: document.querySelector('#baseUrl'),
  apiKey: document.querySelector('#apiKey'),
  saveConfig: document.querySelector('#saveConfig'),
  clearConfig: document.querySelector('#clearConfig'),
  enterChat: document.querySelector('#enterChat'),
  closeSettings: document.querySelector('#closeSettings'),
  fetchModels: document.querySelector('#fetchModels'),
  connectionStatus: document.querySelector('#connectionStatus'),
  manualModel: document.querySelector('#manualModel'),
  modelCount: document.querySelector('#modelCount'),
  modelList: document.querySelector('#modelList'),
  imageBaseUrl: document.querySelector('#imageBaseUrl'),
  temperature: document.querySelector('#temperature'),
  temperatureValue: document.querySelector('#temperatureValue'),
  systemPrompt: document.querySelector('#systemPrompt'),
  activeModel: document.querySelector('#activeModel'),
  messages: document.querySelector('#messages'),
  imageLab: document.querySelector('#imageLab'),
  imageModel: document.querySelector('#imageModel'),
  imageApiKey: document.querySelector('#imageApiKey'),
  imageSize: document.querySelector('#imageSize'),
  imagePrompt: document.querySelector('#imagePrompt'),
  generateImage: document.querySelector('#generateImage'),
  imageStatus: document.querySelector('#imageStatus'),
  imageResults: document.querySelector('#imageResults'),
  composer: document.querySelector('#composer'),
  prompt: document.querySelector('#prompt'),
  chatStatus: document.querySelector('#chatStatus'),
  stop: document.querySelector('#stop'),
  send: document.querySelector('#send'),
  connectionSettings: document.querySelector('#connectionSettings'),
  clearChat: document.querySelector('#clearChat'),
  exportChat: document.querySelector('#exportChat'),
  template: document.querySelector('#messageTemplate'),
  imageTemplate: document.querySelector('#imageResultTemplate'),
  chatMode: document.querySelector('#chatMode'),
  imageMode: document.querySelector('#imageMode'),
};

const state = {
  models: [],
  selectedModel: '',
  messages: [],
  imageResults: [],
  controller: null,
  imageController: null,
  view: 'chat',
};

const RETRY_ATTEMPTS_PER_MODEL = 5;
const FALLBACK_MODEL_LIMIT = 3;
const IMAGE_RETRY_ATTEMPTS = 5;

function normalizeBaseUrl(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  return text.replace(/\/+$/, '');
}

function setStatus(element, text, tone = 'idle') {
  element.textContent = text;
  element.dataset.tone = tone;
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    ui.baseUrl.value = saved.baseUrl || DEFAULT_BASE_URL;
    ui.apiKey.value = saved.apiKey || '';
    ui.imageBaseUrl.value = saved.imageBaseUrl || saved.baseUrl || DEFAULT_BASE_URL;
    ui.manualModel.value = saved.manualModel || '';
    ui.systemPrompt.value = saved.systemPrompt || '';
    ui.temperature.value = saved.temperature || '0.8';
    ui.imageModel.value = saved.imageModel || 'gpt-image-2';
    ui.imageApiKey.value = saved.imageApiKey || '';
    ui.imageSize.value = saved.imageSize || '1024x1024';
    state.selectedModel = saved.selectedModel || saved.manualModel || '';
    state.messages = Array.isArray(saved.messages) ? saved.messages : [];
    state.imageResults = Array.isArray(saved.imageResults) ? saved.imageResults : [];
    state.view = saved.view === 'image' ? 'image' : 'chat';
  } catch {
    ui.baseUrl.value = DEFAULT_BASE_URL;
  }
}

function saveState({ includeMessages = true } = {}) {
  const payload = {
    baseUrl: ui.baseUrl.value.trim(),
    apiKey: ui.apiKey.value.trim(),
    imageBaseUrl: ui.imageBaseUrl.value.trim(),
    manualModel: ui.manualModel.value.trim(),
    selectedModel: state.selectedModel,
    systemPrompt: ui.systemPrompt.value,
    temperature: ui.temperature.value,
    imageModel: ui.imageModel.value.trim(),
    imageApiKey: ui.imageApiKey.value.trim(),
    imageSize: ui.imageSize.value,
    view: state.view,
    messages: includeMessages ? state.messages : [],
    imageResults: state.imageResults,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY);
  ui.baseUrl.value = DEFAULT_BASE_URL;
  ui.apiKey.value = '';
  ui.imageBaseUrl.value = DEFAULT_BASE_URL;
  ui.imageApiKey.value = '';
  ui.manualModel.value = '';
  ui.systemPrompt.value = '';
  ui.temperature.value = '0.8';
  state.selectedModel = '';
  state.models = [];
  state.messages = [];
  state.imageResults = [];
  renderModels();
  renderMessages({ forceScroll: true });
  renderImageResults();
  renderActiveModel();
  setAppMode('connect');
  setSettingsOpen(false);
  updateControls();
}

function buildUrl(path) {
  return `${normalizeBaseUrl(ui.baseUrl.value)}${path}`;
}

function buildImageUrl(path) {
  return `${normalizeBaseUrl(ui.imageBaseUrl.value)}${path}`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${ui.apiKey.value.trim()}`,
    'Content-Type': 'application/json',
  };
}

function imageAuthHeaders() {
  return {
    Authorization: `Bearer ${ui.imageApiKey.value.trim()}`,
    'Content-Type': 'application/json',
  };
}

function getCurrentModel() {
  return ui.manualModel.value.trim() || state.selectedModel;
}

function hasReadyConnection() {
  return Boolean(normalizeBaseUrl(ui.baseUrl.value) && ui.apiKey.value.trim() && getCurrentModel());
}

function setSettingsOpen(isOpen) {
  ui.appShell.dataset.settingsOpen = isOpen ? 'true' : 'false';
  ui.settingsBackdrop.hidden = !isOpen;
}

function setAppMode(mode) {
  const nextMode = mode === 'chat' ? 'chat' : 'connect';
  ui.appShell.dataset.mode = nextMode;
  if (nextMode === 'connect') {
    setSettingsOpen(false);
  }
}

function setView(view) {
  state.view = view === 'image' ? 'image' : 'chat';
  ui.appShell.dataset.view = state.view;
  ui.messages.hidden = state.view !== 'chat';
  ui.imageLab.hidden = state.view !== 'image';
  ui.chatMode.dataset.active = state.view === 'chat' ? 'true' : 'false';
  ui.imageMode.dataset.active = state.view === 'image' ? 'true' : 'false';
  saveState();
  updateControls();
}

function enterChatMode() {
  if (!hasReadyConnection()) {
    setStatus(ui.connectionStatus, '请先填写 Base URL、API Key，并选择或填写模型。', 'error');
    setAppMode('connect');
    return false;
  }

  saveState();
  setSettingsOpen(false);
  setAppMode('chat');
  setStatus(ui.chatStatus, `已连接：${getCurrentModel()}`, 'success');
  window.setTimeout(() => ui.prompt.focus(), 60);
  return true;
}

function renderActiveModel() {
  const model = getCurrentModel();
  ui.activeModel.textContent = model || '尚未选择';
  for (const button of ui.modelList.querySelectorAll('[data-model-id]')) {
    button.dataset.active = button.dataset.modelId === state.selectedModel ? 'true' : 'false';
  }
}

function renderModels() {
  ui.modelList.innerHTML = '';
  ui.modelCount.textContent = String(state.models.length);

  if (state.models.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'status-text';
    empty.textContent = '还没有模型列表。也可以直接填写手动模型名。';
    ui.modelList.append(empty);
    return;
  }

  for (const model of state.models) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'model-button';
    button.dataset.modelId = model.id;
    button.dataset.active = model.id === state.selectedModel ? 'true' : 'false';

    const title = document.createElement('strong');
    title.textContent = model.id;
    const meta = document.createElement('span');
    meta.textContent = [model.object, model.owned_by || model.ownedBy].filter(Boolean).join(' · ') || 'model';
    button.append(title, meta);

    button.addEventListener('click', () => {
      state.selectedModel = model.id;
      ui.manualModel.value = '';
      renderActiveModel();
      updateControls();
      saveState();
      setStatus(ui.chatStatus, `已选择 ${model.id}。`, 'success');
    });

    ui.modelList.append(button);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderMessageBody(body, content) {
  body.innerHTML = escapeHtml(content)
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n/g, '<br>');
}

function renderImageMessageBody(body, message) {
  body.classList.add('message-body-image');
  const figure = document.createElement('figure');
  figure.className = 'chat-image-figure';

  const img = document.createElement('img');
  img.src = message.src;
  img.alt = message.prompt || '生成图片';
  img.loading = 'lazy';
  figure.append(img);

  const caption = document.createElement('figcaption');
  caption.textContent = message.prompt || '生成图片';
  figure.append(caption);

  const link = document.createElement('a');
  link.href = message.src;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = '打开图片';
  figure.append(link);

  body.replaceChildren(figure);
}

function isImageIntent(text) {
  return /(?:生图|画一张|画个|画一下|生成(?:一张)?(?:图片|图|头像|海报|插画|照片)|做(?:一张|个)?(?:图片|图|头像|海报)|出图|配图|image|draw|generate\s+(?:an?\s+)?image|make\s+(?:an?\s+)?image)/i.test(
    text,
  );
}

function isMessagesNearBottom() {
  const distanceFromBottom =
    ui.messages.scrollHeight - ui.messages.scrollTop - ui.messages.clientHeight;
  return distanceFromBottom < 96;
}

function renderMessages({ forceScroll = false } = {}) {
  const shouldStickToBottom = forceScroll || isMessagesNearBottom();
  const previousScrollTop = ui.messages.scrollTop;
  const previousScrollHeight = ui.messages.scrollHeight;
  ui.messages.innerHTML = '';

  if (state.messages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-state-inner">
        <p class="eyebrow">Continue Conversation</p>
        <h2>把网页放到 GitHub Pages，也能继续对话。</h2>
        <p>输入 Key 后选择模型。消息会存在当前浏览器，下次打开可以接着聊。</p>
      </div>
    `;
    ui.messages.append(empty);
    return;
  }

  state.messages.forEach((message, index) => {
    const fragment = ui.template.content.cloneNode(true);
    const article = fragment.querySelector('.message');
    const role = fragment.querySelector('.message-role');
    const body = fragment.querySelector('.message-body');
    const copy = fragment.querySelector('.copy-button');
    article.dataset.role = message.role;
    role.textContent = message.role === 'assistant' ? '助手' : '你';
    if (message.type === 'image') {
      renderImageMessageBody(body, message);
    } else {
      renderMessageBody(body, message.content);
    }
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(message.type === 'image' ? message.src : message.content);
      copy.textContent = '已复制';
      window.setTimeout(() => {
        copy.textContent = '复制';
      }, 1200);
    });
    copy.hidden = message.type === 'image' ? !message.src : !message.content;
    copy.dataset.index = String(index);
    ui.messages.append(fragment);
  });

  if (shouldStickToBottom) {
    ui.messages.scrollTop = ui.messages.scrollHeight;
  } else {
    const heightDelta = ui.messages.scrollHeight - previousScrollHeight;
    ui.messages.scrollTop = previousScrollTop + Math.max(0, heightDelta);
  }
}

function renderImageResults() {
  ui.imageResults.innerHTML = '';
  if (state.imageResults.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state image-empty-state';
    empty.innerHTML = `
      <div class="empty-state-inner">
        <p class="eyebrow">Image Lab</p>
        <h2>输入提示词，生成图片。</h2>
        <p>失败会自动重试 5 次，结果会保存在当前浏览器。</p>
      </div>
    `;
    ui.imageResults.append(empty);
    return;
  }

  for (const item of state.imageResults) {
    const fragment = ui.imageTemplate.content.cloneNode(true);
    const img = fragment.querySelector('img');
    const prompt = fragment.querySelector('.image-result-prompt');
    const link = fragment.querySelector('.image-download-link');
    img.src = item.src;
    img.alt = item.prompt || '生成图片';
    prompt.textContent = item.prompt || '生成图片';
    link.href = item.src;
    ui.imageResults.append(fragment);
  }
}

function updateControls() {
  const hasConnection = Boolean(normalizeBaseUrl(ui.baseUrl.value) && ui.apiKey.value.trim());
  const hasImageConnection = Boolean(
    normalizeBaseUrl(ui.imageBaseUrl.value) && ui.imageApiKey.value.trim(),
  );
  const hasModel = Boolean(getCurrentModel());
  const hasPrompt = Boolean(ui.prompt.value.trim());
  const hasImagePrompt = Boolean(ui.imagePrompt.value.trim());
  const hasImageModel = Boolean(ui.imageModel.value.trim());
  const busy = Boolean(state.controller || state.imageController);
  ui.fetchModels.disabled = busy || !hasConnection;
  ui.enterChat.disabled = busy || !hasConnection || !hasModel;
  ui.send.disabled = busy || !hasConnection || !hasModel || !hasPrompt;
  ui.generateImage.disabled = busy || !hasImageConnection || !hasImageModel || !hasImagePrompt;
  ui.stop.disabled = !busy;
  ui.temperatureValue.textContent = ui.temperature.value;
  renderActiveModel();
}

function extractImageSources(payload) {
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data
    .map(item => {
      if (item?.url) {
        return item.url;
      }
      return item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '';
    })
    .filter(Boolean);
}

function isPromptPolicyError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /(?:content[_\s-]?policy|safety|safe|blocked|moderation|policy|prompt.*(?:reject|violate|block)|forbidden|sensitive|限制词|敏感词|违规|违禁|安全|审核|不合规|被拒绝|无法生成)/i.test(
    message,
  );
}

function cleanRewrittenPrompt(text, fallback) {
  const cleaned = String(text || '')
    .replace(/^```(?:text|markdown)?/i, '')
    .replace(/```$/i, '')
    .replace(/^["“”']|["“”']$/g, '')
    .trim();
  return cleaned || fallback;
}

async function rewriteImagePrompt(originalPrompt, errorMessage, signal) {
  if (!hasReadyConnection()) {
    return originalPrompt;
  }

  const response = await fetch(buildUrl('/v1/chat/completions'), {
    method: 'POST',
    headers: authHeaders(),
    signal,
    body: JSON.stringify({
      model: getCurrentModel(),
      temperature: 0.4,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            '你是图片提示词安全改写助手。把用户的生图提示词改写为安全、合规、可生成的版本，保留主体、构图、风格、情绪和审美。删除或柔化可能触发限制的词。只输出改写后的提示词，不解释。',
        },
        {
          role: 'user',
          content: `原始提示词：${originalPrompt}\n\n生图接口错误：${errorMessage}`,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.error || `提示词改写失败：HTTP ${response.status}`);
  }

  return cleanRewrittenPrompt(extractAssistantText(payload), originalPrompt);
}

async function requestImageGeneration({ signal, prompt = ui.imagePrompt.value.trim() } = {}) {
  const response = await fetch(buildImageUrl('/v1/images/generations'), {
    method: 'POST',
    headers: imageAuthHeaders(),
    signal,
    body: JSON.stringify({
      model: ui.imageModel.value.trim(),
      prompt,
      size: ui.imageSize.value,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.error || `生图失败：HTTP ${response.status}`);
  }

  const sources = extractImageSources(payload);
  if (sources.length === 0) {
    throw new Error('生图接口没有返回图片。');
  }

  return {
    sources,
    revisedPrompt: payload?.data?.[0]?.revised_prompt || prompt,
  };
}

async function generateImageWithRetries() {
  const originalPrompt = ui.imagePrompt.value.trim();
  if (!originalPrompt || state.imageController) {
    return;
  }

  state.imageController = new AbortController();
  updateControls();

  try {
    let lastError = null;
    let currentPrompt = originalPrompt;
    let didRewritePrompt = false;
    for (let attempt = 1; attempt <= IMAGE_RETRY_ATTEMPTS; attempt += 1) {
      setStatus(
        ui.imageStatus,
        `${didRewritePrompt ? '已改写提示词，' : ''}正在生成图片（第 ${attempt}/${IMAGE_RETRY_ATTEMPTS} 次）...`,
        'busy',
      );
      try {
        const result = await requestImageGeneration({
          prompt: currentPrompt,
          signal: state.imageController.signal,
        });
        const created = result.sources.map(src => ({
          src,
          prompt: result.revisedPrompt || currentPrompt,
          createdAt: new Date().toISOString(),
        }));
        state.imageResults = [...created, ...state.imageResults].slice(0, 20);
        renderImageResults();
        saveState();
        setStatus(ui.imageStatus, '图片已生成。', 'success');
        return;
      } catch (error) {
        lastError = error;
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        if (isPromptPolicyError(error)) {
          try {
            setStatus(ui.imageStatus, '提示词可能触发限制，正在用聊天模型改写...', 'busy');
            const rewritten = await rewriteImagePrompt(
              currentPrompt,
              error instanceof Error ? error.message : String(error),
              state.imageController.signal,
            );
            if (rewritten && rewritten !== currentPrompt) {
              currentPrompt = rewritten;
              didRewritePrompt = true;
              ui.imagePrompt.value = rewritten;
              saveState();
            }
          } catch (rewriteError) {
            lastError = rewriteError;
          }
        }
      }
    }

    throw new Error(
      `连续重试 ${IMAGE_RETRY_ATTEMPTS} 次后仍未生成图片。最后错误：${
        lastError instanceof Error ? lastError.message : '未知错误'
      }`,
    );
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    setStatus(
      ui.imageStatus,
      aborted ? '已停止生成。' : error instanceof TypeError ? '请求失败，可能是 CORS 或网络问题。' : error.message,
      aborted ? 'idle' : 'error',
    );
  } finally {
    state.imageController = null;
    updateControls();
  }
}

async function generateImageFromChat({ prompt, assistantIndex }) {
  state.messages[assistantIndex] = {
    role: 'assistant',
    content: '生图中...',
  };
  renderMessages({ forceScroll: true });
  state.imageController = new AbortController();
  updateControls();

  try {
    let lastError = null;
    let currentPrompt = prompt;
    let didRewritePrompt = false;
    for (let attempt = 1; attempt <= IMAGE_RETRY_ATTEMPTS; attempt += 1) {
      setStatus(
        ui.chatStatus,
        `${didRewritePrompt ? '已改写提示词，' : ''}正在为你生成图片（第 ${attempt}/${IMAGE_RETRY_ATTEMPTS} 次）...`,
        'busy',
      );

      try {
        const result = await requestImageGeneration({
          prompt: currentPrompt,
          signal: state.imageController.signal,
        });
        const imageMessage = {
          role: 'assistant',
          type: 'image',
          src: result.sources[0],
          prompt: result.revisedPrompt || currentPrompt,
          content: '',
        };
        state.messages[assistantIndex] = imageMessage;
        state.imageResults = [
          {
            src: imageMessage.src,
            prompt: imageMessage.prompt,
            createdAt: new Date().toISOString(),
          },
          ...state.imageResults,
        ].slice(0, 20);
        renderMessages({ forceScroll: true });
        renderImageResults();
        saveState();
        setStatus(ui.chatStatus, '图片生成好了。', 'success');
        return;
      } catch (error) {
        lastError = error;
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        if (isPromptPolicyError(error)) {
          try {
            state.messages[assistantIndex] = {
              role: 'assistant',
              content: '这个描述可能被拦了，我换个更温和的说法再试试。',
            };
            renderMessages({ forceScroll: true });
            setStatus(ui.chatStatus, '提示词可能触发限制，正在用聊天模型改写...', 'busy');
            const rewritten = await rewriteImagePrompt(
              currentPrompt,
              error instanceof Error ? error.message : String(error),
              state.imageController.signal,
            );
            if (rewritten && rewritten !== currentPrompt) {
              currentPrompt = rewritten;
              didRewritePrompt = true;
            }
          } catch (rewriteError) {
            lastError = rewriteError;
          }
        }
      }
    }

    throw new Error(
      `连续重试 ${IMAGE_RETRY_ATTEMPTS} 次后仍未生成图片。最后错误：${
        lastError instanceof Error ? lastError.message : '未知错误'
      }`,
    );
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    state.messages[assistantIndex] = {
      role: 'assistant',
      content: aborted
        ? '我先停下啦。'
        : `这次图片没生成出来：${
            error instanceof TypeError ? '可能是 CORS 或网络问题。' : error.message
          }`,
    };
    renderMessages({ forceScroll: true });
    setStatus(ui.chatStatus, aborted ? '已停止生成。' : '生图失败。', aborted ? 'idle' : 'error');
  } finally {
    state.imageController = null;
    saveState();
    updateControls();
  }
}

function extractAssistantText(payload) {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  const first = choices[0];
  return (
    first?.message?.content ||
    first?.text ||
    payload?.output_text ||
    ''
  );
}

function extractStreamDelta(payload) {
  const first = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  return (
    first?.delta?.content ||
    first?.message?.content ||
    first?.text ||
    ''
  );
}

function pickFallbackModels(currentModel) {
  const current = String(currentModel || '').trim();
  const candidates = state.models
    .map(model => String(model?.id || '').trim())
    .filter(modelId => modelId && modelId !== current);

  const shuffled = [...new Set(candidates)];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, FALLBACK_MODEL_LIMIT);
}

async function requestAssistantReply({ model, requestHistory, assistantIndex, signal }) {
  const response = await fetch(buildUrl('/v1/chat/completions'), {
    method: 'POST',
    headers: authHeaders(),
    signal,
    body: JSON.stringify({
      model,
      messages: buildRequestMessages(requestHistory),
      temperature: Number(ui.temperature.value),
      stream: true,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || payload?.error || `请求失败：HTTP ${response.status}`);
  }

  if (!response.body) {
    const payload = await response.json().catch(() => null);
    const reply = extractAssistantText(payload);
    if (!reply.trim()) {
      throw new Error('模型没有返回有效内容。');
    }
    state.messages[assistantIndex].content = reply;
    renderMessages();
    return reply;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reply = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      for (const line of block.split(/\r?\n/)) {
        if (!line.startsWith('data:')) {
          continue;
        }
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') {
          continue;
        }
        const payload = JSON.parse(data);
        const delta = extractStreamDelta(payload);
        if (delta) {
          reply += delta;
          state.messages[assistantIndex].content = reply;
          renderMessages();
          setStatus(ui.chatStatus, '正在流式输出...', 'busy');
        }
      }
    }
  }

  if (!reply.trim()) {
    throw new Error('模型没有返回有效内容。');
  }

  return reply;
}

async function requestWithRetries({ requestHistory, assistantIndex, signal }) {
  const primaryModel = getCurrentModel();
  const modelsToTry = [primaryModel, ...pickFallbackModels(primaryModel)];
  let lastError = null;

  for (const [modelIndex, model] of modelsToTry.entries()) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS_PER_MODEL; attempt += 1) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      state.messages[assistantIndex].content = '';
      renderMessages();
      const switchingText = modelIndex === 0 ? '' : `，已切换到 ${model}`;
      setStatus(
        ui.chatStatus,
        `正在请求模型${switchingText}（第 ${attempt}/${RETRY_ATTEMPTS_PER_MODEL} 次）...`,
        'busy',
      );

      try {
        const reply = await requestAssistantReply({
          model,
          requestHistory,
          assistantIndex,
          signal,
        });
        if (model !== primaryModel) {
          state.selectedModel = model;
          ui.manualModel.value = '';
          renderActiveModel();
        }
        return { reply, model, attempts: attempt, switched: model !== primaryModel };
      } catch (error) {
        lastError = error;
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
      }
    }
  }

  const modelCount = modelsToTry.length;
  throw new Error(
    `连续尝试 ${modelCount} 个模型、每个 ${RETRY_ATTEMPTS_PER_MODEL} 次后仍未获得有效回复。最后错误：${
      lastError instanceof Error ? lastError.message : '未知错误'
    }`,
  );
}

async function fetchModels() {
  setStatus(ui.connectionStatus, '正在获取模型...', 'busy');
  try {
    const response = await fetch(buildUrl('/v1/models'), {
      headers: {
        Authorization: `Bearer ${ui.apiKey.value.trim()}`,
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.error || `获取失败：HTTP ${response.status}`);
    }
    state.models = Array.isArray(payload?.data) ? payload.data : [];
    if (!state.selectedModel && state.models[0]?.id) {
      state.selectedModel = state.models[0].id;
    }
    renderModels();
    renderActiveModel();
    saveState();
    setStatus(ui.connectionStatus, `已获取 ${state.models.length} 个模型。`, 'success');
    enterChatMode();
  } catch (error) {
    const message = error instanceof TypeError
      ? '请求失败，可能是网关未允许浏览器跨域访问。'
      : error.message;
    setStatus(ui.connectionStatus, message, 'error');
  } finally {
    updateControls();
  }
}

function buildRequestMessages(messages = state.messages) {
  const systemPrompt = ui.systemPrompt.value.trim();
  return [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...messages.map(message => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

async function sendMessage() {
  const prompt = ui.prompt.value.trim();
  if (!prompt || state.controller) {
    return;
  }

  const requestHistory = [...state.messages, { role: 'user', content: prompt }];
  state.messages.push({ role: 'user', content: prompt });
  state.messages.push({ role: 'assistant', content: '' });
  const assistantIndex = state.messages.length - 1;
  ui.prompt.value = '';
  renderMessages({ forceScroll: true });
  updateControls();

  if (isImageIntent(prompt)) {
    await generateImageFromChat({ prompt, assistantIndex });
    return;
  }

  state.controller = new AbortController();
  setStatus(ui.chatStatus, '正在请求模型...', 'busy');

  try {
    const result = await requestWithRetries({
      requestHistory,
      assistantIndex,
      signal: state.controller.signal,
    });
    saveState();
    setStatus(
      ui.chatStatus,
      result.switched ? `回复完成，已自动切换到 ${result.model}。` : '回复完成。',
      'success',
    );
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    if (!state.messages[assistantIndex].content.trim()) {
      state.messages.splice(assistantIndex, 1);
    }
    renderMessages({ forceScroll: true });
    setStatus(
      ui.chatStatus,
      aborted ? '已停止生成。' : error instanceof TypeError ? '请求失败，可能是 CORS 或网络问题。' : error.message,
      aborted ? 'idle' : 'error',
    );
  } finally {
    state.controller = null;
    saveState();
    updateControls();
  }
}

function exportChat() {
  const text = state.messages
    .map(message => `${message.role === 'assistant' ? '助手' : '你'}:\n${message.content}`)
    .join('\n\n---\n\n');
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `model-lab-chat-${new Date().toISOString().slice(0, 10)}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

ui.saveConfig.addEventListener('click', () => {
  saveState();
  const hasImageConnection = Boolean(normalizeBaseUrl(ui.imageBaseUrl.value) && ui.imageApiKey.value.trim());
  setStatus(
    ui.connectionStatus,
    hasImageConnection ? '聊天和生图连接已保存到当前浏览器。' : '聊天连接已保存；生图连接可稍后补充。',
    'success',
  );
  if (hasReadyConnection()) {
    enterChatMode();
  }
});

ui.clearConfig.addEventListener('click', () => {
  clearSavedState();
  setStatus(ui.connectionStatus, '已清除本机配置。', 'idle');
});

ui.fetchModels.addEventListener('click', fetchModels);

ui.enterChat.addEventListener('click', enterChatMode);

ui.connectionSettings.addEventListener('click', () => setSettingsOpen(true));
ui.closeSettings.addEventListener('click', () => setSettingsOpen(false));
ui.settingsBackdrop.addEventListener('click', () => setSettingsOpen(false));

ui.manualModel.addEventListener('input', () => {
  if (ui.manualModel.value.trim()) {
    state.selectedModel = '';
  }
  saveState();
  updateControls();
});

ui.temperature.addEventListener('input', () => {
  saveState();
  updateControls();
});

ui.imageModel.addEventListener('input', () => {
  saveState();
  updateControls();
});

ui.imageApiKey.addEventListener('input', () => {
  saveState();
  updateControls();
});

ui.imageSize.addEventListener('change', () => {
  saveState();
  updateControls();
});

ui.imagePrompt.addEventListener('input', updateControls);
ui.generateImage.addEventListener('click', generateImageWithRetries);
ui.chatMode.addEventListener('click', () => setView('chat'));
ui.imageMode.addEventListener('click', () => setView('image'));

ui.systemPrompt.addEventListener('input', () => saveState());
ui.baseUrl.addEventListener('input', updateControls);
ui.apiKey.addEventListener('input', updateControls);
ui.imageBaseUrl.addEventListener('input', () => {
  saveState();
  updateControls();
});
ui.prompt.addEventListener('input', updateControls);

ui.prompt.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    void sendMessage();
  }
});

ui.composer.addEventListener('submit', event => {
  event.preventDefault();
  void sendMessage();
});

ui.stop.addEventListener('click', () => {
  state.controller?.abort();
  state.imageController?.abort();
});

ui.clearChat.addEventListener('click', () => {
  state.messages = [];
  saveState();
  renderMessages();
  updateControls();
  setStatus(ui.chatStatus, '对话已清空。', 'idle');
});

ui.exportChat.addEventListener('click', exportChat);

loadSavedState();
renderModels();
renderMessages();
renderImageResults();
updateControls();
setAppMode(hasReadyConnection() ? 'chat' : 'connect');
setView(state.view);
