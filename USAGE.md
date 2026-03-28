# Reader CLI 使用说明

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译项目

```bash
npm run build
```

### 3. 安装浏览器扩展

**重要：reader-cli 使用独立的浏览器扩展！**

1. 打开 Chrome/Edge 浏览器
2. 访问 `chrome://extensions/`
3. 启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目中的 `extension` 目录

### 4. 登录微信读书

1. 访问 https://weread.qq.com
2. 使用微信扫码或账号密码登录
3. 确保能正常访问书架页面

### 5. 运行命令

**无需手动启动 daemon！reader-cli 会自动处理！**

确保扩展已安装并登录后，直接运行命令即可：
```bash
node dist/main.js shelf 5
```

#### 查看书架（默认 20 本）
```bash
node dist/main.js shelf
```

#### 搜索书籍
```bash
node dist/main.js search "三体"
```

#### 查看排行榜
```bash
node dist/main.js ranking
```

#### 查看书籍详情
```bash
node dist/main.js book <bookId>
```

## 命令列表

| 命令 | 描述 | 示例 |
|------|------|------|
| `shelf [limit]` | 列出书架上的书籍 | `shelf 10` |
| `book [options]` | 查看书籍详情 | `book -i <bookId>` |
| `search [options]` | 搜索书籍 | `search "小说"` |
| `ranking [options]` | 查看排行榜 | `ranking -c novel` |
| `notes [options]` | 查看笔记 | `notes -i <bookId>` |
| `highlights [options]` | 查看划线 | `highlights -i <bookId>` |
| `notebooks` | 查看有笔记的书籍列表 | `notebooks` |

## 注意事项

1. **Cookie 要求**：大部分命令需要先登录微信读书，浏览器扩展会自动处理 Cookie
2. **懒加载**：书架数据是懒加载的，命令会自动滚动加载所有书籍
3. **输出格式**：默认输出 JSON 格式，方便后续处理

## 故障排除

### 错误："Cannot read properties of null"

确保已正确安装并启用浏览器扩展，且已登录微信读书。

### 输出为空

- 检查是否已登录微信读书
- 尝试增加 limit 参数值
- 确认书架上有书籍

## 开发说明

本项目专注于微信读书平台，提供简洁高效的命令行工具。

## License

MIT
