# V1-PACKAGES r7 / G：opaque 子资源真实401修复

G r6 seed已完成停写，D真实浏览器发现sandbox opaque iframe workbench.js返回401，脚本未执行/卡Connecting。不是消息重试问题。重新授权原G产品路径+测试修复，D独占环境，勿未经协调重启。

资源票据仅授权静态包字节。iframe脚本子资源不携带SameSite管理Cookie是正常隔离，不能用allow-same-origin、暴露Cookie或扩大API权限。资源路由在有短launchTicket时应通过服务端launch记录绑定的sessionId重新调用真实identity.getSession检查当前未撤销/过期与subject；无需客户端再次发送Session。票据必须绑定app/instance/packageDigest/path集合，逐次校验、仅静态resource，无bridge授权。无票据则保留普通authenticated scope路径。资源票据被窃不授权API，日志/Referer脱敏仍需核对。给registerPackageRoutes注入 `validateLaunchSession({sessionId,subjectId})`，Lead由Identity实现。

同一次修正真实CSP/CORP对子脚本加载影响，但不得通配凭据CORS。session撤销/包更新后旧资源票据立刻拒绝测试；脚本资源可执行且iframe origin=null的真实浏览器测试。D会联调已安装包，不要重新签同版本内容。若仅server路由改无需新包。

报告.herdr/V1-PACKAGES-r7.md、停写；端口测试用G15161–69，D服务需要restart经Lead。这是已冻结资源票据静态权限的工程修复，不改变会话/主体绑定要求。
