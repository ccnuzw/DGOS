# V1-PACKAGES r6 / G：真实签名包联调准备

r5已停写，Lead桥model.list已经精确实现并有2项针对测试，不再沿r5旧快照阻断。新任务限定新增 `scripts/v1-package-fixture.mjs`、包集成测试及.herdr/V1-PACKAGES-r6.md。产品G域若发现真实缺陷先报Lead再修，不改D前端/公共server/Compose（Lead）。

生成本轮本地临时Ed25519测试根与官方AI工作台envelope，私钥仅系统临时目录0700/0600，根公钥与envelope可在 `.herdr/state/package-fixture/`（忽略runtime目录）供容器只读挂。fixture源码不得硬编码秘密；生产不自动信任临时root。

脚本支持显式URL/fixture credential，登录既有专属admin；经公开HTTP submit→install→读取deployment，并为7个声明cap显式PATCH permissions（管理员测试授权，记录真实scope，不跳broker）。不能直接改数据库安装/权限。输出仅脱敏app/版本/subjectID、文件路径，凭据不输出。只有D明确暂时归还15200服务时才运行写请求；平时只生成可复现脚本/临时资产。Lead将挂root文件/重建API容器，D做真实iframe浏览器。

安装资源若opaque iframe子资源Cookie SameSite问题，要先复现并给受控修复，禁止allow-same-origin/泄Session/取消scope。任务成功Task必须真实Provider fixture+独立worker，bridge events/Artifact与拒绝分支须可观察。报告受控测试根限制，完整公网上游/正式签名仍不宣称。
