# Anywhere 分流规则

## Stripchat / GoondVR

在 Anywhere 的 **Routing（分流）→ Subscribe Rule Set（订阅规则集）** 中添加：

```text
https://raw.githubusercontent.com/Last-Xuan-ai/loon-scripts/main/anywhere/stripchat.arrs
```

也可以下载 [stripchat.arrs](https://raw.githubusercontent.com/Last-Xuan-ai/loon-scripts/main/anywhere/stripchat.arrs)，通过 **Import Rule Set（导入规则集）** 导入。

导入后打开 **Stripchat - GoondVR**，在 **Route To** 中选择一个具体代理节点，并使用 **Rule（规则）模式**。`.arrs` 文件不包含节点配置；默认路由不会替你固定测试节点。

规则覆盖 `stripchat.com`、`doppiocdn.com`、`doppiocdn.net`、`strpst.com` 及其子域名，包括主站 API、播放器、视频 CDN 和预览图片。域名依据 GoondVR 4.0.1 源码整理，不保证覆盖网站未来新增的服务。

切换节点后重启 GoondVR，让新连接使用新出口；需要浏览器 cookies 时，在同一节点下刷新页面并重新复制。通过 Anywhere 连接日志核实实际命中的规则和节点。

GoondVR 4.0.1 的默认配置只向 Chaturbate 域名发送手动填写的 cookies。仅用于 Stripchat 的实例可在启动时添加 `--domain https://stripchat.com/`；此参数是全局配置，不适用于同一实例混用两个站点。分流规则本身不会修复这一配置问题，也不保证解决 Cloudflare 拦截。

Anywhere 的显式内置规则和广告拦截规则优先于自定义规则；存在重叠时，以连接日志显示的实际路由为准。

格式依据：[Anywhere Routing 文档](https://github.com/NodePassProject/Anywhere/blob/124ec879a313fe28cde0976be8810509d59f0918/Documentations/Routing.md)。
