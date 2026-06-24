# GitHub Pages Model Lab

一个可以直接部署到 GitHub Pages 的纯前端模型实验台。

## 使用方式

1. 打开 `index.html`。
2. Base URL 默认是 `https://jiuuij.de5.net/`。
3. 在页面里输入 API Key。
4. 点击“获取模型”，选择模型后开始对话。

配置和对话只保存在当前浏览器的 `localStorage`。

## 部署到 GitHub Pages

把本目录里的文件推到 GitHub 仓库根目录，然后在仓库设置里启用 GitHub Pages：

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/root`

也可以把这些文件放进仓库的 `docs/` 目录，然后把 Folder 选成 `/docs`。

## 注意

不要把 API Key 写进源码或提交到 GitHub。这个页面只会在浏览器运行时读取你输入的 Key。

如果页面显示“可能是 CORS 或网络问题”，说明模型网关没有允许浏览器直接跨域调用。那种情况下需要给网关开启 CORS，或改用独立后端代理。
