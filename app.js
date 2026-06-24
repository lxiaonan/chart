const DEFAULT_BASE_URL = 'https://jiuuij.de5.net/';
const STORAGE_KEY = 'github-pages-model-lab-v1';

const ui = {
  baseUrl: document.querySelector('#baseUrl'),
  apiKey: document.querySelector('#apiKey'),
  saveConfig: document.querySelector('#saveConfig'),
  clearConfig: document.querySelector('#clearConfig'),
  fetchModels: document.querySelector('#fetchModels'),
  connectionStatus: document.querySelector('#connectionStatus'),
  manualModel: document.querySelector('#manualModel'),
  modelCount: document.querySelector('#modelCount'),
  modelList: document.querySelector('#modelList'),
  temperature: document.querySelector('#temperature'),
  temperatureValue: document.querySelector('#temperatureValue'),
  systemPrompt: document.querySelector('#systemPrompt'),
  activeModel: document.querySelector('#activeModel'),
  messages: document.querySelector('#messages'),
  composer: document.querySelector('#composer'),
  prompt: document.querySelector('#prompt'),
  chatStatus: document.querySelector('#chatStatus'),
  stop: document.querySelector('#stop'),
  send: document.querySelector('#send'),
  clearChat: document.querySelector('#clearChat'),
  exportChat: document.querySelector('#exportChat'),
  template: document.querySelector('#messageTemplate'),
};

const state = {
  models: [],
  selectedModel: '',
  messages: [],
  controller: null,
};

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
    ui.manualModel.value = saved.manualModel || '';
    ui.systemPrompt.value = saved.systemPrompt || '';
    ui.temperature.value = saved.temperature || '0.7';
    state.selectedModel = saved.selectedModel || saved.manualModel || '';
    state.messages = Array.isArray(saved.messages) ? saved.messages : [];
  } catch {
    ui.baseUrl.value = DEFAULT_BASE_URL;
  }
}

function saveState({ includeMessages = true } = {}) {
  const payload = {
    baseUrl: ui.baseUrl.value.trim(),
    apiKey: ui.apiKey.value.trim(),
    manualModel: ui.manualModel.value.trim(),
    selectedModel: state.selectedModel,
    systemPrompt: ui.systemPrompt.value,
    temperature: ui.temperature.value,
    messages: includeMessages ? state.messages : [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY);
  ui.baseUrl.value = DEFAULT_BASE_URL;
  ui.apiKey.value = '';
  ui.manualModel.value = '';
  ui.systemPrompt.value = '';
  ui.temperature.value = '0.7';
  state.selectedModel = '';
  state.models = [];
  renderModels();
  renderActiveModel();
  updateControls();
}

function buildUrl(path) {
  return `${normalizeBaseUrl(ui.baseUrl.value)}${path}`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${ui.apiKey.value.trim()}`,
    'Content-Type': 'application/json',
  };
}

function getCurrentModel() {
  return ui.manualModel.value.trim() || state.selectedModel;
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

function renderMessages() {
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
    renderMessageBody(body, message.content);
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(message.content);
      copy.textContent = '已复制';
      window.setTimeout(() => {
        copy.textContent = '复制';
      }, 1200);
    });
    copy.hidden = !message.content;
    copy.dataset.index = String(index);
    ui.messages.append(fragment);
  });

  ui.messages.scrollTop = ui.messages.scrollHeight;
}

function updateControls() {
  const hasConnection = Boolean(normalizeBaseUrl(ui.baseUrl.value) && ui.apiKey.value.trim());
  const hasModel = Boolean(getCurrentModel());
  const hasPrompt = Boolean(ui.prompt.value.trim());
  const busy = Boolean(state.controller);
  ui.fetchModels.disabled = busy || !hasConnection;
  ui.send.disabled = busy || !hasConnection || !hasModel || !hasPrompt;
  ui.stop.disabled = !busy;
  ui.temperatureValue.textContent = ui.temperature.value;
  renderActiveModel();
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
  state.controller = new AbortController();
  renderMessages();
  updateControls();
  setStatus(ui.chatStatus, '正在请求模型...', 'busy');

  try {
    const response = await fetch(buildUrl('/v1/chat/completions'), {
      method: 'POST',
      headers: authHeaders(),
      signal: state.controller.signal,
      body: JSON.stringify({
        model: getCurrentModel(),
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
      state.messages[assistantIndex].content = extractAssistantText(payload);
      renderMessages();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
            state.messages[assistantIndex].content += delta;
            renderMessages();
            setStatus(ui.chatStatus, '正在流式输出...', 'busy');
          }
        }
      }
    }

    if (!state.messages[assistantIndex].content.trim()) {
      throw new Error('模型没有返回有效内容。');
    }

    saveState();
    setStatus(ui.chatStatus, '回复完成。', 'success');
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    if (!state.messages[assistantIndex].content.trim()) {
      state.messages.splice(assistantIndex, 1);
    }
    renderMessages();
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
  setStatus(ui.connectionStatus, '已保存到当前浏览器。', 'success');
});

ui.clearConfig.addEventListener('click', () => {
  clearSavedState();
  setStatus(ui.connectionStatus, '已清除本机配置。', 'idle');
});

ui.fetchModels.addEventListener('click', fetchModels);

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

ui.systemPrompt.addEventListener('input', () => saveState());
ui.baseUrl.addEventListener('input', updateControls);
ui.apiKey.addEventListener('input', updateControls);
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
updateControls();
