# V1-DESKTOP r5 / F：真实本地服务链

r4 fixture已通过停写。继续原desktop/macos域及新增scripts/v1-desktop-real.mjs（若需）/真实证据报告。不能止于--external-api打印prepared。

使用本包15151–59与新独立本地PG子库（父5432/dgos_v1_integrated仅建本次dgos_v1_desktop_<随机>库），不可D15200组。公共buildServer与独立worker、受控Provider fixture、持久本地Secret或测试共享Redis DB可用DB7+v1-desktop前缀（Lead新增分配，不flush）。先公开HTTP初始化测试subject与模型，再通过真实macOS Webview运行Session恢复、一个实际Task查询/提交→事件→Artifact，native bridge检查真实API状态。允许只在debug编译启用测试驱动JS调用既有公开接口，必须记录测试驱动与用户UI输入边界；不将JS注入当手工GUI截图验收。

原生窗口截图/可见性若可通过CoreGraphics/System Events只读查询验证就执行，权限缺失准确报告，不改变系统权限或请求用户批准。正式Developer ID缺失仍不能伪造签名。ad hoc已允许本地构建，测试专属钥匙串唯一service账号，清理仅本轮。

输入边界：原脚本--external-api仍使用fixture token是不完整实现，需要真实本次Session经测试专属受控管道注入不泄日志/命令行，安全回收会话与临时库。private测试bootstrap只debug可用，release禁test env启用。

共享主API不断变化，必要迁移仅冻结<=0044，检查exact checksum；新0045未冻结不用。构建Web dist由D当前build，记录具体hash，不重复改D文件。报告.herdr/V1-DESKTOP-r5.md附成对manifest，失败真实保留。完成停写不提交。
