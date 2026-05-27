# 自动生成测试用例功能设计文档

**日期：** 2026-05-20
**状态：** 已确认

---

## 1. 功能概述

为后台管理系统提供一套基于 Dify Chat App 的测试用例自动生成功能。用户创建需求后上传需求 MD 文件（必填）和技术方案 MD 文件（选填），手动分步触发功能点拆解和测试用例生成，最终支持下载 Markdown 和 XMind 格式的测试用例。

核心链路：

1. 创建需求
2. 上传需求 MD / 技术方案 MD
3. 手动触发：调用 Dify App1 拆解需求功能点
4. 手动触发：调用 Dify App2 生成测试用例
5. 下载测试用例（Markdown / XMind）

---

## 2. 数据模型

### 2.1 requirement 表

| 字段                  | 类型                  | 可空 | 说明                                 |
| --------------------- | --------------------- | ---- | ------------------------------------ |
| id                    | BIGINT AUTO_INCREMENT | 否   | 主键                                 |
| name                  | VARCHAR(255)          | 否   | 需求名称                             |
| requirement_file_path | VARCHAR(500)          | 否   | 需求 MD 文件存储路径                 |
| requirement_content   | TEXT                  | 否   | 需求 MD 文件内容                     |
| tech_file_path        | VARCHAR(500)          | 是   | 技术方案 MD 文件存储路径             |
| tech_content          | TEXT                  | 是   | 技术方案 MD 文件内容                 |
| status                | TINYINT               | 否   | 状态（见下方枚举）                   |
| features              | TEXT                  | 是   | 功能点列表（Dify App1 返回原始文本） |
| test_cases            | LONGTEXT              | 是   | 测试用例 Markdown（Dify App2 返回）  |
| error_message         | VARCHAR(1000)         | 是   | 失败原因                             |
| create_time           | DATETIME              | 否   | 创建时间（自动填充）                 |
| update_time           | DATETIME              | 否   | 更新时间（自动填充）                 |
| deleted               | TINYINT               | 否   | 逻辑删除（0正常/1删除）              |

### 2.2 状态枚举

| 值  | 含义                             |
| --- | -------------------------------- |
| 0   | 待处理（文件已上传，未触发拆解） |
| 1   | 拆解中                           |
| 2   | 拆解完成                         |
| 3   | 生成中                           |
| 4   | 已完成                           |
| 5   | 失败                             |

---

## 3. API 设计

基础路径：`/api/gabriel/requirement`

| 方法 | 路径                 | 说明                                                                |
| ---- | -------------------- | ------------------------------------------------------------------- |
| POST | `/create`            | 创建需求，入参：name                                                |
| POST | `/upload`            | 上传文件，multipart：id + requirementFile（必填）+ techFile（选填） |
| POST | `/decompose`         | 触发拆解功能点，入参：id                                            |
| POST | `/generate`          | 触发生成测试用例，入参：id                                          |
| POST | `/delete`            | 删除需求，入参：id                                                  |
| GET  | `/detail`            | 查询需求详情，参数：id                                              |
| GET  | `/page`              | 分页查询列表，参数：pageNum、pageSize、name（可选）                 |
| GET  | `/download/markdown` | 下载测试用例 Markdown 文件，参数：id                                |
| GET  | `/download/xmind`    | 下载测试用例 XMind 文件，参数：id                                   |

---

## 4. 核心流程

### 4.1 文件上传

- 接收 multipart 文件，读取文件内容存入 `requirement_content` / `tech_content`
- 文件保存到本地磁盘（路径配置在 `application.yml`）
- 上传成功后状态设为 `0`（待处理）

### 4.2 拆解功能点（异步）

- 前置校验：状态必须为 `0`（待处理）
- 立即将状态更新为 `1`（拆解中），返回 200
- `@Async` 线程池中调用 Dify App1：
  - 将 `requirement_content` + `tech_content`（若有）拼成消息体
  - 调用 `/v1/chat-messages`（blocking 模式，新 conversation）
  - 成功：将 `answer` 存入 `features`，状态更新为 `2`
  - 失败：状态更新为 `5`，`error_message` 记录异常信息

### 4.3 生成测试用例（异步）

- 前置校验：状态必须为 `2`（拆解完成）
- 立即将状态更新为 `3`（生成中），返回 200
- `@Async` 线程池中调用 Dify App2：
  - 将 `features` 内容作为消息体
  - 调用 `/v1/chat-messages`（blocking 模式，新 conversation）
  - 成功：将 `answer` 存入 `test_cases`，状态更新为 `4`
  - 失败：状态更新为 `5`，`error_message` 记录异常信息

### 4.4 下载 Markdown

- 查询 `test_cases` 字段，状态必须为 `4`（已完成）
- 设置响应头 `Content-Disposition: attachment; filename=test-cases.md`
- 直接输出 `test_cases` 文本内容

### 4.5 下载 XMind

- 查询 `test_cases` 字段，状态必须为 `4`（已完成）
- 解析 Markdown 表格，构建 XMind 思维导图结构（使用 `org.xmind` 库）
- 设置响应头 `Content-Disposition: attachment; filename=test-cases.xmind`
- 输出 XMind 文件字节流

---

## 5. Dify 集成

### 5.1 配置

```yaml
dify:
  base-url: https://api.dify.ai/v1
  api-key-decompose: your-app1-key # 拆解功能点 App
  api-key-generate: your-app2-key # 生成测试用例 App
```

### 5.2 调用方式

- 接口：`POST /v1/chat-messages`
- 模式：`blocking`（同步等待完整响应，在 @Async 线程中执行）
- 每次调用不传 `conversation_id`（新会话）
- 取响应体中的 `answer` 字段作为结果

### 5.3 DifyClient 封装

`DifyClient` 使用 Spring `RestTemplate` 或 `HttpClient`，封装两个方法：

- `decompose(String requirementContent, String techContent): String`
- `generateCases(String features): String`

---

## 6. 项目结构

### gabriel-entity

```
entity/Requirement.java
```

### gabriel-server

```
dto/requirement/
  RequirementCreateDTO.java
  RequirementUploadDTO.java
  RequirementQueryDTO.java
  RequirementVO.java
mapper/RequirementMapper.java
resources/mapper/RequirementMapper.xml
service/RequirementService.java
service/impl/RequirementServiceImpl.java
config/DifyConfig.java
client/DifyClient.java
```

### gabriel-web

```
controller/RequirementController.java
config/AsyncConfig.java
resources/sql/requirement.sql
```

---

## 7. 依赖新增

| 依赖              | 用途                 |
| ----------------- | -------------------- |
| `org.xmind:xmind` | 生成标准 .xmind 文件 |

---

## 8. 错误处理

- 触发拆解/生成时，若状态不符合前置条件，抛出 `BusinessException` 返回 400
- Dify 调用超时或异常，状态置为 `5`，`error_message` 记录具体原因
- 下载接口若状态不为 `4`，抛出 `BusinessException` 提示用例尚未生成完成
