# Loon Scripts

Loon 脚本与 Anywhere MITM／分流规则仓库。Loon 版字母圈播放修复要求 **Loon 3.5.1（983）或更新版**；Anywhere 版使用原生 `.amrs` 规则集。

## Anywhere：字母圈播放修复

在 Anywhere 的 **MITM → Subscribe Rule Set（订阅规则集）** 中添加：

```text
https://raw.githubusercontent.com/Last-Xuan-ai/loon-scripts/main/anywhere/zmq.amrs
```

开启 MITM 和该规则集，并安装、信任 Anywhere 的根证书。规则集已经内嵌 JavaScript，无需单独导入 `.js`。这是 MITM 响应改写，请在 MITM 页面添加。

Anywhere 的 hostname 只支持明确的域名后缀，不支持 Loon 的通配符。目前覆盖发布页提供的域名和已知旧域名；未来换到新的编号域名，需要更新订阅内容。详细说明见 [Anywhere 播放修复](anywhere/zmq-使用说明.md)。

## Anywhere：Stripchat 分流

覆盖 Stripchat 主站、API、播放器和视频 CDN，适用于浏览器与 GoondVR。将下面的地址添加到 Anywhere 的 **Routing → Subscribe Rule Set**，导入后在 **Route To** 中指定节点，并使用规则模式：

```text
https://raw.githubusercontent.com/Last-Xuan-ai/loon-scripts/main/anywhere/stripchat.arrs
```

详细说明见 [Anywhere 分流规则](anywhere/README.md)。

## 直接订阅

将下面的 URL 添加到 Loon 的插件列表：

```text
https://raw.githubusercontent.com/Last-Xuan-ai/loon-scripts/main/zmq.lpx
```

在 Loon 中进入“插件”，点击添加按钮，粘贴地址并保存。插件会自动下载同仓库的 `zmq.js`，无需手工导入 JS。

停用旧版字母圈脚本，开启本插件、脚本功能与 MitM，确认 MitM 证书已安装并信任，然后刷新播放页。新播放器包含“重新加载”和“打开视频地址”。

更新时在 Loon 更新插件及其脚本缓存。详细说明见 [使用说明.md](使用说明.md)。

## 下载

- [插件配置](https://raw.githubusercontent.com/Last-Xuan-ai/loon-scripts/main/zmq.lpx)
- [JavaScript 脚本](https://raw.githubusercontent.com/Last-Xuan-ai/loon-scripts/main/zmq.js)
- [安装包和版本记录](https://github.com/Last-Xuan-ai/loon-scripts/releases)

仓库公开，以上 Raw 链接无需 GitHub 登录或访问令牌。需要离线安装时，请按使用说明将插件中的远程脚本路径改为本地文件。

## 功能和验证

修复电脑/手机播放页面、保留页面编码和完整视频地址，优先使用 iPhone 原生 HLS。覆盖 `zimuquan`、`zmqurl`、`zmqsite` 系列在 `.top`、`.com`、`.uk` 下的编号域名和子域名。未来更换品牌或顶级域名时仍需更新规则。

通过 21 项自动检查；发布页当前 21 个播放站点地址均通过规则匹配检查。示例视频实际读取到了 720p H.264 和 AAC 流。尚未在用户设备的 Loon 内实测，不能保证源站失效、鉴权变化或网络阻断的视频可播放。

## 官方文档

- [Script v2](https://nsloon.app/docs/Script/script_v2)
- [Rewrite v2](https://nsloon.app/docs/Rewrite/rewrite_v2)
- [MitM](https://nsloon.app/docs/MitM/)
- [Anywhere MITM](https://github.com/NodePassProject/Anywhere/blob/main/Documentations/MITM.md)
