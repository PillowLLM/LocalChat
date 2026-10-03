# LocalChat 测试说明

## 测试目录

| 文件 | 说明 |
|------|------|
| `tests/dataManager.test.js` | DataManager 配置/好友 CRUD/离线清理/注入测试 |

## 运行方式

```bash
npm test
```

## 覆盖说明

### 单元测试（9 个）
- 配置默认值/持久化
- 好友添加/删除/更新/排序
- 离线清理（5分钟超时/30天清理）
- 用户信息保存

### 注入测试（3 个）
- XSS 昵称作为纯文本存储不执行
- 路径穿越 IP 不崩溃
- 损坏 JSON 文件降级为默认用户
- saveUser null 输入安全返回 false

### 钩子/交互测试（2 个）
- 相同 IP:Port 好友信息更新
- getRecentPeers 按时间排序

## 预期结果：14 个用例全部通过
