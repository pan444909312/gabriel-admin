⏺ 自动生成测试用例功能实现计划

For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this
plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

Goal: 在 gabriel-ai 后台系统中实现基于 Dify Chat App 的测试用例自动生成功能，支持需求文件上传、功能点拆解、测试用例生成及 Markdown/XMind 下载。

Architecture: 遵循现有四层架构（entity → common → server → web），新增 Requirement 实体、异步 Dify 调用客户端、以及完整的 CRUD + 异步流程控制。Dify  
调用封装在 DifyClient，通过 @Async 线程池异步执行，状态机驱动流程推进。

Tech Stack: Spring Boot 3.1.4, MyBatis Plus 3.5.5, RestTemplate, @Async, org.xmind (XMind 文件生成), Jakarta Validation, Lombok

---

文件清单

┌──────┬───────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────┐
│ 操作 │ 文件路径 │ 说明 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-entity/src/main/java/com/gabriel/entity/Requirement.java │ 实体类 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementCreateDTO.java │ 创建 DTO │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementUploadDTO.java │ 上传 DTO │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementQueryDTO.java │ 分页查询 DTO │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementVO.java │ 响应 VO │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/java/com/gabriel/server/mapper/RequirementMapper.java │ Mapper 接口 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/resources/mapper/RequirementMapper.xml │ Mapper XML │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/java/com/gabriel/server/service/RequirementService.java │ Service 接口 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/java/com/gabriel/server/service/impl/RequirementServiceImpl.java │ Service 实现 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/java/com/gabriel/server/config/DifyConfig.java │ Dify 配置属性 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-server/src/main/java/com/gabriel/server/client/DifyClient.java │ Dify HTTP 客户端 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-web/src/main/java/com/gabriel/web/controller/RequirementController.java │ Controller │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-web/src/main/java/com/gabriel/web/config/AsyncConfig.java │ 异步线程池配置 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 修改 │ gabriel-web/src/main/resources/application.yml │ 新增 dify 和文件上传配置 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 新建 │ gabriel-web/src/main/resources/sql/requirement.sql │ 建表 SQL │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 修改 │ gabriel-web/pom.xml │ 新增 xmind 依赖 │
└──────┴───────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────┘

---

Task 1: 建表 SQL 与实体类

Files:

- Create: gabriel-web/src/main/resources/sql/requirement.sql
- Create: gabriel-entity/src/main/java/com/gabriel/entity/Requirement.java
- Step 1: 编写建表 SQL

-- gabriel-web/src/main/resources/sql/requirement.sql
CREATE TABLE `requirement` (
`id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
`name` VARCHAR(255) NOT NULL COMMENT '需求名称',
`requirement_file_path` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '需求MD文件路径',
`requirement_content` TEXT NOT NULL COMMENT '需求MD内容',
`tech_file_path` VARCHAR(500) DEFAULT NULL COMMENT '技术方案MD文件路径',
`tech_content` TEXT DEFAULT NULL COMMENT '技术方案MD内容',
`status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态:0待处理,1拆解中,2拆解完成,3生成中,4已完成,5失败',
`features` TEXT DEFAULT NULL COMMENT '功能点列表(Dify App1返回)',
`test_cases` LONGTEXT DEFAULT NULL COMMENT '测试用例Markdown(Dify App2返回)',
`error_message` VARCHAR(1000) DEFAULT NULL COMMENT '失败原因',
`create_time` DATETIME NOT NULL COMMENT '创建时间',
`update_time` DATETIME NOT NULL COMMENT '更新时间',
`deleted` TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除:0正常,1删除',
PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='需求测试用例';

- Step 2: 编写实体类

// gabriel-entity/src/main/java/com/gabriel/entity/Requirement.java
package com.gabriel.entity;

import com.baomidou.mybatisplus.annotation.\*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class Requirement {

      @TableId(type = IdType.AUTO)
      private Long id;

      private String name;

      private String requirementFilePath;

      private String requirementContent;

      private String techFilePath;

      private String techContent;

      private Integer status;

      private String features;

      private String testCases;

      private String errorMessage;

      @TableField(fill = FieldFill.INSERT)
      private LocalDateTime createTime;

      @TableField(fill = FieldFill.INSERT_UPDATE)
      private LocalDateTime updateTime;

      @TableLogic
      private Integer deleted;

}

- Step 3: 在数据库执行建表 SQL

连接数据库后执行 requirement.sql，确认表创建成功：
SHOW TABLES LIKE 'requirement';
-- 应返回一行

- Step 4: Commit

git add gabriel-entity/src/main/java/com/gabriel/entity/Requirement.java \
gabriel-web/src/main/resources/sql/requirement.sql
git commit -m "feat: add Requirement entity and DDL"

---

Task 2: DTOs、VO 与 Mapper

Files:

- Create: gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementCreateDTO.java
- Create: gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementQueryDTO.java
- Create: gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementVO.java
- Create: gabriel-server/src/main/java/com/gabriel/server/mapper/RequirementMapper.java
- Create: gabriel-server/src/main/resources/mapper/RequirementMapper.xml
- Step 1: 编写 RequirementCreateDTO

// gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementCreateDTO.java
package com.gabriel.server.dto.requirement;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RequirementCreateDTO {

      @NotBlank(message = "需求名称不能为空")
      private String name;

}

- Step 2: 编写 RequirementQueryDTO

// gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementQueryDTO.java
package com.gabriel.server.dto.requirement;

import lombok.Data;

@Data
public class RequirementQueryDTO {

      private Integer pageNum = 1;
      private Integer pageSize = 10;
      private String name;

      public int getOffset() {
          return (pageNum - 1) * pageSize;
      }

}

- Step 3: 编写 RequirementVO

// gabriel-server/src/main/java/com/gabriel/server/dto/requirement/RequirementVO.java
package com.gabriel.server.dto.requirement;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class RequirementVO {

      private Long id;
      private String name;
      private Integer status;
      private String features;
      private String testCases;
      private String errorMessage;
      private LocalDateTime createTime;
      private LocalDateTime updateTime;

}

- Step 4: 编写 RequirementMapper 接口

// gabriel-server/src/main/java/com/gabriel/server/mapper/RequirementMapper.java
package com.gabriel.server.mapper;

import com.gabriel.entity.Requirement;
import com.gabriel.server.dto.requirement.RequirementQueryDTO;
import com.gabriel.server.dto.requirement.RequirementVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface RequirementMapper {

      void insert(Requirement requirement);

      Requirement selectById(@Param("id") Long id);

      RequirementVO selectVOById(@Param("id") Long id);

      List<RequirementVO> selectPage(@Param("query") RequirementQueryDTO query);

      Long countPage(@Param("query") RequirementQueryDTO query);

      void updateById(Requirement requirement);

      void deleteById(@Param("id") Long id);

}

- Step 5: 编写 RequirementMapper.xml

  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
          "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
  <mapper namespace="com.gabriel.server.mapper.RequirementMapper">

      <resultMap id="RequirementVOMap" type="com.gabriel.server.dto.requirement.RequirementVO">
          <id     column="id"            property="id"/>
          <result column="name"          property="name"/>
          <result column="status"        property="status"/>
          <result column="features"      property="features"/>
          <result column="test_cases"    property="testCases"/>
          <result column="error_message" property="errorMessage"/>
          <result column="create_time"   property="createTime"/>
          <result column="update_time"   property="updateTime"/>
      </resultMap>

      <sql id="queryWhere">
          WHERE deleted = 0
          <if test="query.name != null and query.name != ''">
              AND name LIKE CONCAT('%', #{query.name}, '%')
          </if>
      </sql>

      <insert id="insert" useGeneratedKeys="true" keyProperty="id">
          INSERT INTO requirement (name, requirement_file_path, requirement_content,
                                   tech_file_path, tech_content, status,
                                   create_time, update_time, deleted)
          VALUES (#{name}, #{requirementFilePath}, #{requirementContent},
                  #{techFilePath}, #{techContent}, #{status},
                  #{createTime}, #{updateTime}, 0)
      </insert>

      <select id="selectById" resultType="com.gabriel.entity.Requirement">
          SELECT * FROM requirement WHERE id = #{id} AND deleted = 0
      </select>

      <select id="selectVOById" resultMap="RequirementVOMap">
          SELECT id, name, status, features, test_cases, error_message, create_time, update_time
          FROM requirement
          WHERE id = #{id} AND deleted = 0
      </select>

      <select id="selectPage" resultMap="RequirementVOMap">
          SELECT id, name, status, features, test_cases, error_message, create_time, update_time
          FROM requirement
          <include refid="queryWhere"/>
          ORDER BY create_time DESC
          LIMIT #{query.pageSize} OFFSET #{query.offset}
      </select>

      <select id="countPage" resultType="java.lang.Long">
          SELECT COUNT(*) FROM requirement
          <include refid="queryWhere"/>
      </select>

      <update id="updateById">
          UPDATE requirement
          <set>
              update_time = #{updateTime},
              <if test="name != null">name = #{name},</if>
              <if test="requirementFilePath != null">requirement_file_path = #{requirementFilePath},</if>
              <if test="requirementContent != null">requirement_content = #{requirementContent},</if>
              <if test="techFilePath != null">tech_file_path = #{techFilePath},</if>
              <if test="techContent != null">tech_content = #{techContent},</if>
              <if test="status != null">status = #{status},</if>
              <if test="features != null">features = #{features},</if>
              <if test="testCases != null">test_cases = #{testCases},</if>
              <if test="errorMessage != null">error_message = #{errorMessage},</if>
          </set>
          WHERE id = #{id} AND deleted = 0
      </update>

      <update id="deleteById">
          UPDATE requirement SET deleted = 1, update_time = NOW() WHERE id = #{id}
      </update>

  </mapper>

- Step 6: Commit

git add gabriel-server/src/main/java/com/gabriel/server/dto/requirement/ \
gabriel-server/src/main/java/com/gabriel/server/mapper/RequirementMapper.java \
gabriel-server/src/main/resources/mapper/RequirementMapper.xml
git commit -m "feat: add Requirement DTOs, VO, Mapper"

---

Task 3: Dify 配置与客户端

Files:

- Create: gabriel-server/src/main/java/com/gabriel/server/config/DifyConfig.java
- Create: gabriel-server/src/main/java/com/gabriel/server/client/DifyClient.java
- Modify: gabriel-web/src/main/resources/application.yml
- Step 1: 编写 DifyConfig

// gabriel-server/src/main/java/com/gabriel/server/config/DifyConfig.java
package com.gabriel.server.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "dify")
public class DifyConfig {

      private String baseUrl;
      private String apiKeyDecompose;
      private String apiKeyGenerate;

}

- Step 2: 编写 DifyClient

// gabriel-server/src/main/java/com/gabriel/server/client/DifyClient.java
package com.gabriel.server.client;

import com.gabriel.common.exception.BusinessException;
import com.gabriel.server.config.DifyConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.\*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class DifyClient {

      private final DifyConfig difyConfig;
      private final RestTemplate restTemplate;

      /**
       * 调用 Dify App1 拆解功能点
       *
       * @param requirementContent 需求MD内容
       * @param techContent        技术方案MD内容（可为null）
       * @return Dify 返回的 answer 文本
       */
      public String decompose(String requirementContent, String techContent) {
          StringBuilder query = new StringBuilder("需求文档：\n").append(requirementContent);
          if (techContent != null && !techContent.isBlank()) {
              query.append("\n\n技术方案：\n").append(techContent);
          }
          return callDify(difyConfig.getApiKeyDecompose(), query.toString());
      }

      /**
       * 调用 Dify App2 生成测试用例
       *
       * @param features 功能点列表文本
       * @return Dify 返回的 answer 文本（Markdown 格式测试用例）
       */
      public String generateCases(String features) {
          return callDify(difyConfig.getApiKeyGenerate(), features);
      }

      private String callDify(String apiKey, String query) {
          String url = difyConfig.getBaseUrl() + "/chat-messages";

          HttpHeaders headers = new HttpHeaders();
          headers.setContentType(MediaType.APPLICATION_JSON);
          headers.setBearerAuth(apiKey);

          Map<String, Object> body = new HashMap<>();
          body.put("inputs", new HashMap<>());
          body.put("query", query);
          body.put("response_mode", "blocking");
          body.put("user", "gabriel-system");

          HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

          try {
              ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, request, Map.class);
              if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                  Object answer = response.getBody().get("answer");
                  if (answer == null) {
                      throw new BusinessException("Dify 返回数据中缺少 answer 字段");
                  }
                  return answer.toString();
              }
              throw new BusinessException("Dify 接口返回异常状态: " + response.getStatusCode());
          } catch (BusinessException e) {
              throw e;
          } catch (Exception e) {
              log.error("Dify 调用失败", e);
              throw new BusinessException("Dify 调用失败: " + e.getMessage());
          }
      }

}

- Step 3: 在 application.yml 中新增配置

在现有 application.yml 末尾追加：

dify:
base-url: https://api.dify.ai/v1
api-key-decompose: your-app1-key
api-key-generate: your-app2-key

file:
upload-dir: /data/gabriel/uploads

- Step 4: 在 gabriel-web 的 AppConfig 中注册 RestTemplate bean

在 gabriel-web/src/main/java/com/gabriel/web/config/AppConfig.java 中新增：

@Bean
public RestTemplate restTemplate() {
return new RestTemplate();
}

- Step 5: Commit

git add gabriel-server/src/main/java/com/gabriel/server/config/DifyConfig.java \
gabriel-server/src/main/java/com/gabriel/server/client/DifyClient.java \
gabriel-web/src/main/resources/application.yml \
gabriel-web/src/main/java/com/gabriel/web/config/AppConfig.java
git commit -m "feat: add DifyConfig, DifyClient and RestTemplate bean"

---

Task 4: 异步配置

Files:

- Create: gabriel-web/src/main/java/com/gabriel/web/config/AsyncConfig.java
- Step 1: 编写 AsyncConfig

// gabriel-web/src/main/java/com/gabriel/web/config/AsyncConfig.java
package com.gabriel.web.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@EnableAsync
@Configuration
public class AsyncConfig {

      @Bean(name = "difyTaskExecutor")
      public Executor difyTaskExecutor() {
          ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
          executor.setCorePoolSize(4);
          executor.setMaxPoolSize(10);
          executor.setQueueCapacity(50);
          executor.setThreadNamePrefix("dify-async-");
          executor.initialize();
          return executor;
      }

}

- Step 2: Commit

git add gabriel-web/src/main/java/com/gabriel/web/config/AsyncConfig.java
git commit -m "feat: add async thread pool config for Dify tasks"

---

Task 5: Service 接口与实现（核心业务逻辑）

Files:

- Create: gabriel-server/src/main/java/com/gabriel/server/service/RequirementService.java
- Create: gabriel-server/src/main/java/com/gabriel/server/service/impl/RequirementServiceImpl.java
- Step 1: 编写 Service 接口

// gabriel-server/src/main/java/com/gabriel/server/service/RequirementService.java
package com.gabriel.server.service;

import com.gabriel.common.result.PageResult;
import com.gabriel.server.dto.requirement.RequirementCreateDTO;
import com.gabriel.server.dto.requirement.RequirementQueryDTO;
import com.gabriel.server.dto.requirement.RequirementVO;
import org.springframework.web.multipart.MultipartFile;

public interface RequirementService {

      Long create(RequirementCreateDTO dto);

      void upload(Long id, MultipartFile requirementFile, MultipartFile techFile);

      void decompose(Long id);

      void generate(Long id);

      void delete(Long id);

      RequirementVO detail(Long id);

      PageResult<RequirementVO> page(RequirementQueryDTO query);

      byte[] downloadMarkdown(Long id);

      byte[] downloadXmind(Long id);

}

- Step 2: 编写 Service 实现（create / upload / delete / detail / page）

// gabriel-server/src/main/java/com/gabriel/server/service/impl/RequirementServiceImpl.java
package com.gabriel.server.service.impl;

import com.gabriel.common.exception.BusinessException;
import com.gabriel.common.result.PageResult;
import com.gabriel.entity.Requirement;
import com.gabriel.server.client.DifyClient;
import com.gabriel.server.dto.requirement.RequirementCreateDTO;
import com.gabriel.server.dto.requirement.RequirementQueryDTO;
import com.gabriel.server.dto.requirement.RequirementVO;
import com.gabriel.server.mapper.RequirementMapper;
import com.gabriel.server.service.RequirementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RequirementServiceImpl implements RequirementService {

      private final RequirementMapper requirementMapper;
      private final DifyClient difyClient;

      @Value("${file.upload-dir}")
      private String uploadDir;

      // ---- 状态常量 ----
      private static final int STATUS_PENDING    = 0;
      private static final int STATUS_DECOMPOSING = 1;
      private static final int STATUS_DECOMPOSED  = 2;
      private static final int STATUS_GENERATING  = 3;
      private static final int STATUS_DONE        = 4;
      private static final int STATUS_FAILED      = 5;

      @Override
      @Transactional
      public Long create(RequirementCreateDTO dto) {
          Requirement req = new Requirement();
          req.setName(dto.getName());
          req.setRequirementFilePath("");
          req.setRequirementContent("");
          req.setStatus(STATUS_PENDING);
          requirementMapper.insert(req);
          return req.getId();
      }

      @Override
      @Transactional
      public void upload(Long id, MultipartFile requirementFile, MultipartFile techFile) {
          Requirement req = getOrThrow(id);

          String reqContent = readFileContent(requirementFile);
          String reqPath = saveFile(requirementFile, id, "requirement");

          Requirement update = new Requirement();
          update.setId(id);
          update.setRequirementFilePath(reqPath);
          update.setRequirementContent(reqContent);
          update.setStatus(STATUS_PENDING);
          update.setUpdateTime(LocalDateTime.now());

          if (techFile != null && !techFile.isEmpty()) {
              update.setTechContent(readFileContent(techFile));
              update.setTechFilePath(saveFile(techFile, id, "tech"));
          }

          requirementMapper.updateById(update);
      }

      @Override
      @Transactional
      public void delete(Long id) {
          getOrThrow(id);
          requirementMapper.deleteById(id);
      }

      @Override
      @Transactional(readOnly = true)
      public RequirementVO detail(Long id) {
          RequirementVO vo = requirementMapper.selectVOById(id);
          if (vo == null) {
              throw new BusinessException("需求不存在");
          }
          return vo;
      }

      @Override
      @Transactional(readOnly = true)
      public PageResult<RequirementVO> page(RequirementQueryDTO query) {
          Long total = requirementMapper.countPage(query);
          List<RequirementVO> list = requirementMapper.selectPage(query);
          return PageResult.of(total, list);
      }

      @Override
      @Transactional(readOnly = true)
      public byte[] downloadMarkdown(Long id) {
          Requirement req = getOrThrow(id);
          if (req.getStatus() != STATUS_DONE) {
              throw new BusinessException("测试用例尚未生成完成");
          }
          return req.getTestCases().getBytes(StandardCharsets.UTF_8);
      }

      // ---- 私有工具方法 ----

      private Requirement getOrThrow(Long id) {
          Requirement req = requirementMapper.selectById(id);
          if (req == null) {
              throw new BusinessException("需求不存在");
          }
          return req;
      }

      private String readFileContent(MultipartFile file) {
          try {
              return new String(file.getBytes(), StandardCharsets.UTF_8);
          } catch (IOException e) {
              throw new BusinessException("文件读取失败: " + e.getMessage());
          }
      }

      private String saveFile(MultipartFile file, Long id, String type) {
          try {
              Path dir = Paths.get(uploadDir, String.valueOf(id));
              Files.createDirectories(dir);
              String filename = type + "-" + UUID.randomUUID() + ".md";
              Path target = dir.resolve(filename);
              file.transferTo(target);
              return target.toString();
          } catch (IOException e) {
              throw new BusinessException("文件保存失败: " + e.getMessage());
          }
      }

}

- Step 3: 在 Service 实现中追加 decompose 方法

在 RequirementServiceImpl 中追加：

@Override
@Transactional
public void decompose(Long id) {
Requirement req = getOrThrow(id);
if (req.getStatus() != STATUS_PENDING) {
throw new BusinessException("当前状态不允许触发拆解，需求状态必须为待处理");
}
Requirement update = new Requirement();
update.setId(id);
update.setStatus(STATUS_DECOMPOSING);
update.setUpdateTime(LocalDateTime.now());
requirementMapper.updateById(update);

      doDecompose(id, req.getRequirementContent(), req.getTechContent());

}

@Async("difyTaskExecutor")
public void doDecompose(Long id, String requirementContent, String techContent) {
try {
String features = difyClient.decompose(requirementContent, techContent);
Requirement update = new Requirement();
update.setId(id);
update.setFeatures(features);
update.setStatus(STATUS_DECOMPOSED);
update.setUpdateTime(LocalDateTime.now());
requirementMapper.updateById(update);
} catch (Exception e) {
log.error("功能点拆解失败, id={}", id, e);
Requirement update = new Requirement();
update.setId(id);
update.setStatus(STATUS_FAILED);
update.setErrorMessage(e.getMessage());
update.setUpdateTime(LocalDateTime.now());
requirementMapper.updateById(update);
}
}

- Step 4: 在 Service 实现中追加 generate 方法

在 RequirementServiceImpl 中追加：

@Override
@Transactional
public void generate(Long id) {
Requirement req = getOrThrow(id);
if (req.getStatus() != STATUS_DECOMPOSED) {
throw new BusinessException("当前状态不允许触发生成，需求状态必须为拆解完成");
}
Requirement update = new Requirement();
update.setId(id);
update.setStatus(STATUS_GENERATING);
update.setUpdateTime(LocalDateTime.now());
requirementMapper.updateById(update);

      doGenerate(id, req.getFeatures());

}

@Async("difyTaskExecutor")
public void doGenerate(Long id, String features) {
try {
String testCases = difyClient.generateCases(features);
Requirement update = new Requirement();
update.setId(id);
update.setTestCases(testCases);
update.setStatus(STATUS_DONE);
update.setUpdateTime(LocalDateTime.now());
requirementMapper.updateById(update);
} catch (Exception e) {
log.error("测试用例生成失败, id={}", id, e);
Requirement update = new Requirement();
update.setId(id);
update.setStatus(STATUS_FAILED);
update.setErrorMessage(e.getMessage());
update.setUpdateTime(LocalDateTime.now());
requirementMapper.updateById(update);
}
}

````

- [ ] **Step 5: Commit**

```bash
git add gabriel-server/src/main/java/com/gabriel/server/service/
git commit -m "feat: add RequirementService with async decompose/generate"
````

---

## Task 6: XMind 下载实现

**Files:**

- Modify: `gabriel-web/pom.xml`
- Modify: `gabriel-server/src/main/java/com/gabriel/server/service/impl/RequirementServiceImpl.java`

- [ ] **Step 1: 在 gabriel-web/pom.xml 中新增 xmind 依赖**

在 `<dependencies>` 块中追加：

```xml
<dependency>
    <groupId>org.xmind</groupId>
    <artifactId>xmind</artifactId>
    <version>3.7.1</version>
</dependency>
```

> 注意：如果 Maven Central 没有该包，可使用 `net.xmind:xmind-sdk:0.0.1` 或手动安装 jar。
> 另一个可靠替代方案是用 zip 格式手动构建 .xmind 文件（.xmind 本质是 zip，内含 content.xml）。
> **推荐使用手动 zip 方案**，无需第三方依赖，见 Step 2。

- [ ] **Step 2: 在 RequirementServiceImpl 中实现 downloadXmind**

在 `RequirementServiceImpl` 中追加 `downloadXmind` 方法（手动构建 zip/xmind，无需第三方库）：

```java
@Override
@Transactional(readOnly = true)
public byte[] downloadXmind(Long id) {
    Requirement req = getOrThrow(id);
    if (req.getStatus() != STATUS_DONE) {
        throw new BusinessException("测试用例尚未生成完成");
    }
    try {
        return buildXmind(req.getName(), req.getTestCases());
    } catch (IOException e) {
        throw new BusinessException("XMind 文件生成失败: " + e.getMessage());
    }
}

/**
 * 将 Markdown 测试用例表格转换为 XMind zip 格式。
 * .xmind 文件本质是 zip，核心文件为 content.xml。
 * 解析规则：以 "## " 开头的行作为一级节点，"| 用例标题 |" 列作为二级节点。
 */
private byte[] buildXmind(String rootTitle, String markdown) throws IOException {
    // 解析 Markdown：收集所有 ## 标题和表格中的用例标题列
    List<String[]> sections = parseMarkdownSections(markdown);

    StringBuilder xml = new StringBuilder();
    xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n");
    xml.append("<xmap-content version=\"2.0\">\n");
    xml.append("  <sheet id=\"1\">\n");
    xml.append("    <topic id=\"root\">\n");
    xml.append("      <title>").append(escapeXml(rootTitle)).append("</title>\n");
    xml.append("      <children>\n");
    xml.append("        <topics type=\"attached\">\n");

    for (String[] section : sections) {
        String sectionTitle = section[0];
        xml.append("          <topic id=\"s").append(sectionTitle.hashCode()).append("\">\n");
        xml.append("            <title>").append(escapeXml(sectionTitle)).append("</title>\n");
        if (section.length > 1) {
            xml.append("            <children><topics type=\"attached\">\n");
            for (int i = 1; i < section.length; i++) {
                xml.append("              <topic id=\"c").append((sectionTitle + section[i]).hashCode()).append("\">");
                xml.append("<title>").append(escapeXml(section[i])).append("</title>");
                xml.append("</topic>\n");
            }
            xml.append("            </topics></children>\n");
        }
        xml.append("          </topic>\n");
    }

    xml.append("        </topics>\n");
    xml.append("      </children>\n");
    xml.append("    </topic>\n");
    xml.append("  </sheet>\n");
    xml.append("</xmap-content>\n");

    // 打包为 zip（.xmind 格式）
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    try (ZipOutputStream zos = new ZipOutputStream(baos)) {
        ZipEntry entry = new ZipEntry("content.xml");
        byte[] xmlBytes = xml.toString().getBytes(StandardCharsets.UTF_8);
        entry.setSize(xmlBytes.length);
        zos.putNextEntry(entry);
        zos.write(xmlBytes);
        zos.closeEntry();
    }
    return baos.toByteArray();
}

/**
 * 解析 Markdown，返回 List<String[]>。
 * 每个 String[] 第 0 位是 ## 标题，后续位是该节下表格第一列（用例标题，跳过表头和分隔行）。
 */
private List<String[]> parseMarkdownSections(String markdown) {
    List<String[]> result = new java.util.ArrayList<>();
    String[] lines = markdown.split("\n");
    String currentSection = null;
    List<String> currentCases = new java.util.ArrayList<>();
    boolean inTable = false;
    boolean headerPassed = false;

    for (String line : lines) {
        String trimmed = line.trim();
        if (trimmed.startsWith("## ")) {
            if (currentSection != null) {
                String[] arr = new String[1 + currentCases.size()];
                arr[0] = currentSection;
                for (int i = 0; i < currentCases.size(); i++) arr[i + 1] = currentCases.get(i);
                result.add(arr);
            }
            currentSection = trimmed.substring(3).trim();
            currentCases = new java.util.ArrayList<>();
            inTable = false;
            headerPassed = false;
        } else if (trimmed.startsWith("|")) {
            if (!inTable) {
                inTable = true;
                headerPassed = false; // 第一行是表头
            } else if (!headerPassed && trimmed.startsWith("|---")) {
                headerPassed = true; // 分隔行
            } else if (headerPassed) {
                // 数据行，取第一列
                String[] cols = trimmed.split("\\|");
                if (cols.length > 1) {
                    String cell = cols[1].trim();
                    if (!cell.isEmpty()) {
                        currentCases.add(cell);
                    }
                }
            } else {
                headerPassed = true; // 跳过表头行后标记
            }
        } else {
            inTable = false;
        }
    }
    if (currentSection != null) {
        String[] arr = new String[1 + currentCases.size()];
        arr[0] = currentSection;
        for (int i = 0; i < currentCases.size(); i++) arr[i + 1] = currentCases.get(i);
        result.add(arr);
    }
    return result;
}

private String escapeXml(String s) {
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
}
```

在 `RequirementServiceImpl` 顶部 import 中追加：

```java
import java.io.ByteArrayOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
```

- [ ] **Step 3: Commit**

```bash
git add gabriel-server/src/main/java/com/gabriel/server/service/impl/RequirementServiceImpl.java \
        gabriel-web/pom.xml
git commit -m "feat: implement XMind download via zip/content.xml"
```

---

## Task 7: Controller

**Files:**

- Create: `gabriel-web/src/main/java/com/gabriel/web/controller/RequirementController.java`

- [ ] **Step 1: 编写 RequirementController**

```java
// gabriel-web/src/main/java/com/gabriel/web/controller/RequirementController.java
package com.gabriel.web.controller;

import com.gabriel.common.result.PageResult;
import com.gabriel.common.result.Result;
import com.gabriel.server.dto.requirement.RequirementCreateDTO;
import com.gabriel.server.dto.requirement.RequirementQueryDTO;
import com.gabriel.server.dto.requirement.RequirementVO;
import com.gabriel.server.service.RequirementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/gabriel/requirement")
@RequiredArgsConstructor
public class RequirementController {

    private final RequirementService requirementService;

    @PostMapping("/create")
    public Result<Long> create(@Valid @RequestBody RequirementCreateDTO dto) {
        return Result.success(requirementService.create(dto));
    }

    @PostMapping("/upload")
    public Result<Void> upload(
            @RequestParam Long id,
            @RequestParam MultipartFile requirementFile,
            @RequestParam(required = false) MultipartFile techFile) {
        requirementService.upload(id, requirementFile, techFile);
        return Result.success();
    }

    @PostMapping("/decompose")
    public Result<Void> decompose(@RequestParam Long id) {
        requirementService.decompose(id);
        return Result.success();
    }

    @PostMapping("/generate")
    public Result<Void> generate(@RequestParam Long id) {
        requirementService.generate(id);
        return Result.success();
    }

    @PostMapping("/delete")
    public Result<Void> delete(@RequestParam Long id) {
        requirementService.delete(id);
        return Result.success();
    }

    @GetMapping("/detail")
    public Result<RequirementVO> detail(@RequestParam Long id) {
        return Result.success(requirementService.detail(id));
    }

    @GetMapping("/page")
    public Result<PageResult<RequirementVO>> page(RequirementQueryDTO query) {
        return Result.success(requirementService.page(query));
    }

    @GetMapping("/download/markdown")
    public ResponseEntity<byte[]> downloadMarkdown(@RequestParam Long id) {
        byte[] content = requirementService.downloadMarkdown(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=test-cases.md")
                .contentType(MediaType.TEXT_PLAIN)
                .body(content);
    }

    @GetMapping("/download/xmind")
    public ResponseEntity<byte[]> downloadXmind(@RequestParam Long id) {
        byte[] content = requirementService.downloadXmind(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=test-cases.xmind")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(content);
    }
}
```

- [ ] **Step 2: 验证 Result.success() 无参方法存在**

检查 `gabriel-common/src/main/java/com/gabriel/common/result/Result.java`，确认有 `public static Result<Void> success()` 方法。若没有，在 Result.java 中追加：

```java
public static Result<Void> success() {
    return new Result<>(200, "success", null);
}
```

- [ ] **Step 3: Commit**

```bash
git add gabriel-web/src/main/java/com/gabriel/web/controller/RequirementController.java
git commit -m "feat: add RequirementController with all endpoints"
```

---

## Task 8: 构建验证

- [ ] **Step 1: 编译整个项目**

在项目根目录执行：

```bash
mvn clean compile -q
```

预期：`BUILD SUCCESS`，无编译错误。

- [ ] **Step 2: 检查常见问题**

若编译失败，按以下顺序排查：

1. `@Async` 方法在同一个 bean 内自调用不会生效 — `doDecompose` / `doGenerate` 必须通过 Spring 代理调用。解决方案：将这两个方法提取到独立的 `@Component` 类 `RequirementAsyncTask` 中，注入到 `RequirementServiceImpl`。

   ```java
   // gabriel-server/src/main/java/com/gabriel/server/service/impl/RequirementAsyncTask.java
   package com.gabriel.server.service.impl;

   import com.gabriel.entity.Requirement;
   import com.gabriel.server.client.DifyClient;
   import com.gabriel.server.mapper.RequirementMapper;
   import lombok.RequiredArgsConstructor;
   import lombok.extern.slf4j.Slf4j;
   import org.springframework.scheduling.annotation.Async;
   import org.springframework.stereotype.Component;
   import java.time.LocalDateTime;

   @Slf4j
   @Component
   @RequiredArgsConstructor
   public class RequirementAsyncTask {

       private final RequirementMapper requirementMapper;
       private final DifyClient difyClient;

       private static final int STATUS_DECOMPOSED = 2;
       private static final int STATUS_DONE       = 4;
       private static final int STATUS_FAILED     = 5;

       @Async("difyTaskExecutor")
       public void doDecompose(Long id, String requirementContent, String techContent) {
           try {
               String features = difyClient.decompose(requirementContent, techContent);
               Requirement update = new Requirement();
               update.setId(id);
               update.setFeatures(features);
               update.setStatus(STATUS_DECOMPOSED);
               update.setUpdateTime(LocalDateTime.now());
               requirementMapper.updateById(update);
           } catch (Exception e) {
               log.error("功能点拆解失败, id={}", id, e);
               Requirement update = new Requirement();
               update.setId(id);
               update.setStatus(STATUS_FAILED);
               update.setErrorMessage(e.getMessage());
               update.setUpdateTime(LocalDateTime.now());
               requirementMapper.updateById(update);
           }
       }

       @Async("difyTaskExecutor")
       public void doGenerate(Long id, String features) {
           try {
               String testCases = difyClient.generateCases(features);
               Requirement update = new Requirement();
               update.setId(id);
               update.setTestCases(testCases);
               update.setStatus(STATUS_DONE);
               update.setUpdateTime(LocalDateTime.now());
               requirementMapper.updateById(update);
           } catch (Exception e) {
               log.error("测试用例生成失败, id={}", id, e);
               Requirement update = new Requirement();
               update.setId(id);
               update.setStatus(STATUS_FAILED);
               update.setErrorMessage(e.getMessage());
               update.setUpdateTime(LocalDateTime.now());
               requirementMapper.updateById(update);
           }
       }
   }
   ```

   然后在 `RequirementServiceImpl` 中：
   - 删除 `doDecompose` 和 `doGenerate` 方法
   - 注入 `RequirementAsyncTask asyncTask`
   - 将调用改为 `asyncTask.doDecompose(...)` 和 `asyncTask.doGenerate(...)`

2. `DifyConfig` 需要 `@EnableConfigurationProperties` — 在 `gabriel-web` 的 `AppConfig.java` 或启动类上加 `@EnableConfigurationProperties(DifyConfig.class)`，或确认 `@Configuration` + `@ConfigurationProperties` 组合已生效。

3. `MultipartFile` 在 `gabriel-server` 模块中需要 `spring-web` 依赖 — 检查 `gabriel-server/pom.xml`，若缺少则追加：
   ```xml
   <dependency>
       <groupId>org.springframework</groupId>
       <artifactId>spring-web</artifactId>
   </dependency>
   ```

- [ ] **Step 3: 启动应用验证**

```bash
mvn spring-boot:run -pl gabriel-web
```

访问 `http://localhost:8080/swagger-ui.html`，确认 `/api/gabriel/requirement` 下的所有接口出现在 Swagger UI 中。

- [ ] **Step 4: 手动冒烟测试**

```bash
# 1. 创建需求
curl -X POST http://localhost:8080/api/gabriel/requirement/create \
  -H "Content-Type: application/json" \
  -d '{"name":"登录功能需求"}'
# 预期: {"code":200,"data":1,...}

# 2. 上传需求文件（替换 /tmp/req.md 为实际文件路径）
echo "# 登录功能\n用户可以用手机号+密码登录" > /tmp/req.md
curl -X POST http://localhost:8080/api/gabriel/requirement/upload \
  -F "id=1" \
  -F "requirementFile=@/tmp/req.md"
# 预期: {"code":200,...}

# 3. 查询详情，确认状态为 0
curl http://localhost:8080/api/gabriel/requirement/detail?id=1
# 预期: status=0

# 4. 触发拆解（需配置真实 Dify key 才能完成异步流程）
curl -X POST "http://localhost:8080/api/gabriel/requirement/decompose?id=1"
# 预期: {"code":200,...}，后台异步执行，稍后查询 status 变为 2
```

- [ ] **Step 5: Commit**

```bash
git add gabriel-server/src/main/java/com/gabriel/server/service/impl/RequirementAsyncTask.java
git commit -m "feat: extract async Dify tasks to RequirementAsyncTask to fix Spring proxy issue"
```
