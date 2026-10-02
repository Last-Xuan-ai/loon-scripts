# Anywhere 字母圈播放修复

当前版本：**2026.10.03.1**。已有订阅请在 MITM 中刷新该规则集，再关闭旧播放页并重新打开；只更新旁边的 `.js` 不会改变 `.amrs` 内嵌的脚本。页面或 `[ZMQ]` 日志会显示版本号。无签名自动清单现被服务器拒绝，本版本不能恢复没有播放凭据的视频。

## 安装

1. 在 Anywhere 进入 **MITM**，使用添加菜单中的 **Subscribe Rule Set（订阅规则集）**。
2. 粘贴下方 `.amrs` 地址，确认订阅：

   `https://raw.githubusercontent.com/Last-Xuan-ai/loon-scripts/main/anywhere/zmq.amrs`

3. 规则集应显示“字母圈播放修复 - Anywhere”，包含 **1 条响应脚本规则、22 个域名后缀**。如果没有规则，请先更新 Anywhere，再重新订阅。
4. 打开 **MITM → Root Certificate（根证书）**，按应用提示安装并信任证书，开启 MITM 总开关和本规则集。
5. 关闭原播放页后重新打开。有有效地址时显示视频控件；缺少凭据时保留原登录／授权界面并提示刷新。“重新加载”重试同一地址；“刷新页面获取新地址”重新访问站点页面获取新签名。

也可以下载同一个 `.amrs` 文件，通过 **MITM → Import Rule Set（导入规则集）** 导入。订阅适合获取后续更新；文件导入后需要手工重新导入新版。

这是 MITM 页面改写，需要在 MITM 页面添加。仓库已有的 `stripchat.arrs` 则属于 Routing 分流规则，安装入口不同。当前修复沿用已识别的字母圈模板。

`.amrs` 已用 Base64 内嵌完整脚本，Anywhere 导入时会检查 JavaScript 语法。旁边的 [zmq.js](zmq.js) 是可阅读的原生源码，使用 `function process(ctx)`；它不依赖 Loon 的 `$request`、`$response`、`$done`，也不需要单独订阅。

## 域名范围

域名清单见 [zmq-domains.json](zmq-domains.json)。2026-09-24 从用户提供的 [发布页](https://www.zmqurl3.top) 获取当前地址，并补充此前已知域名，合计 **22 个明确后缀**，覆盖发布页当前全部 21 个播放站点地址。一个后缀会同时覆盖根域名和其子域名，例如 `zimuquan32.uk` 包括 `www.zimuquan32.uk`、`www1.zimuquan32.uk` 等。

**Anywhere 不支持 hostname 通配符。** URL 正则能匹配编号变化，但新域名未列入 hostname 时，请求不会进入 MITM，脚本也不会执行。因此，当前域名的 `www1`／`www6` 等子域名变化可以直接覆盖；新增如 `zimuquan33.uk` 则需要把它加入清单并更新订阅。此配置不拦截整个 `.top`、`.com`、`.uk`。

脚本仅处理匹配播放路径的 **GET、200、HTML 响应**。它不改写视频清单、分片或密钥，也不改写发布页首页。

## 行为和限制

沿用根目录 Loon 脚本的页面解析与播放器实现：兼容普通 HTML 和 `decodeURIComponent(atob(...))` 包裹页；保留完整视频地址及查询参数；只替换播放区域；iPhone 优先原生 HLS，其他浏览器使用 HLS 库。

迁移后的 `poster2.jpg`／`cover.jpg` 无法提供自动清单所需的播放签名，不再据此拼接无签名地址。脚本保留页面现成的播放地址及完整参数；没有地址时保留登录／授权界面，并提示重新获取。旧 `vod.jpg` 的同目录清单兼容保持不变，独立上传图片也不会被用来猜测其他视频。

Anywhere 会先解压普通 `script` 规则的响应 Body，再调用 `process(ctx)`。本脚本通过 `Anywhere.codec.utf8` 读取字节，只在成功改写且 UTF-8 无损时替换 `ctx.body`；不修改状态码或响应头。Anywhere 负责重算长度并处理内容编码。没有匹配区域、解码异常或不支持的响应保持原字节。

根据所依据的官方版本，缓冲式脚本有 **4 MiB** 限制：已知 Content-Length 超限会跳过脚本；chunked 响应缓冲超限可能返回 502。本脚本也会限制输入和输出大小。此规则只作用于播放页 HTML，不会缓冲视频流。

同一请求最多运行一条普通脚本，最后匹配的脚本生效；`stream-script` 优先于普通脚本。同域名的其他 MITM 规则集也可能按更具体后缀或重复后缀优先级覆盖本规则。无播放器时请检查实际生效的规则集及 `[ZMQ]` 日志。

源站删除资源、鉴权变化、网络阻断或新模板不能靠 MITM 改写保证恢复。尚未在用户设备的 Anywhere VPN 中实测；语法／运行时检查与真实联网播放不是同一项验证。

已通过 33 项适配和回归检查，覆盖内嵌源码一致性、域名与 URL 范围、电脑/手机页面、签名保留、缺少凭据处理、旧播放器升级、401/403 提示、UTF-8、异常及大小限制。另使用 Anywhere 官方规则解析器（应用数据容器使用最小替身）和 JavaScriptCore 检查规则及真实页面回放。这没有替代完整应用中的 TLS／HTTP 转发实测。

2026-10-03 复核时，`efv2` 和 `efv3` 的无签名请求均返回 403；过期签名也被拒绝。网站刚发出的免费播放签名地址返回 200，实际读取到 1080p H.264／AAC 流。旧版原示例的无签名播放未恢复，脚本不能补发服务器授权。

## 维护

根目录 `zmq.js` 是共享页面修复逻辑；`scripts/build-anywhere.py` 生成原生入口和内嵌规则集。修改共享逻辑或显式域名清单后运行：

```sh
python3 scripts/build-anywhere.py
python3 scripts/build-anywhere.py --check
node tests/anywhere.test.cjs
```

把生成的 `anywhere/zmq.js` 和 `anywhere/zmq.amrs` 一起提交，然后在 Anywhere 刷新规则集订阅。仅修改 `.js` 不会更新已经内嵌在 `.amrs` 中的代码。

适配依据为 Anywhere 官方提交 `124ec879a313fe28cde0976be8810509d59f0918` 的 [MITM 文档](https://github.com/NodePassProject/Anywhere/blob/124ec879a313fe28cde0976be8810509d59f0918/Documentations/MITM.md)、规则解析器及脚本引擎；没有根据仓库主分支反推 App Store 最低版本号。
