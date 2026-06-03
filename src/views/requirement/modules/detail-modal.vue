<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMessage } from 'naive-ui';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getRequirementDetail } from '@/service/api/requirement';

defineOptions({ name: 'RequirementDetailModal' });

const message = useMessage();
const visible = ref(false);
const loading = ref(false);
const detail = ref<Api.Requirement.Detail | null>(null);

function renderMd(content: string | null) {
  if (!content) return '';
  return DOMPurify.sanitize(marked.parse(content) as string);
}

const requirementHtml = computed(() => renderMd(detail.value?.requirementContent ?? null));
const techHtml = computed(() => renderMd(detail.value?.techContent ?? null));

async function open(id: number) {
  visible.value = true;
  loading.value = true;
  detail.value = null;
  const { data, error } = await getRequirementDetail(id);
  loading.value = false;
  if (error) {
    message.error(error.message || '获取详情失败');
    return;
  }
  detail.value = data;
}

defineExpose({ open });
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="detail?.name || '文档内容'" style="width: 860px">
    <NSpin :show="loading">
      <NTabs type="line" animated>
        <NTabPane name="requirement" tab="需求文档">
          <NScrollbar style="max-height: 65vh">
            <NEmpty v-if="!detail?.requirementContent" description="暂无内容" style="padding: 32px 0" />
            <div v-else class="md-body" v-html="requirementHtml" />
          </NScrollbar>
        </NTabPane>
        <NTabPane name="tech" tab="技术方案">
          <NScrollbar style="max-height: 65vh">
            <NEmpty v-if="!detail?.techContent" description="暂无内容" style="padding: 32px 0" />
            <div v-else class="md-body" v-html="techHtml" />
          </NScrollbar>
        </NTabPane>
      </NTabs>
    </NSpin>
  </NModal>
</template>

<style scoped>
.md-body {
  padding: 8px 4px;
  font-size: 14px;
  line-height: 1.7;
  color: inherit;
}

.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4) {
  margin: 16px 0 8px;
  font-weight: 600;
  line-height: 1.4;
}

.md-body :deep(h1) { font-size: 22px; }
.md-body :deep(h2) { font-size: 18px; }
.md-body :deep(h3) { font-size: 16px; }

.md-body :deep(p) {
  margin: 8px 0;
}

.md-body :deep(ul),
.md-body :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.md-body :deep(li) {
  margin: 4px 0;
}

.md-body :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  background-color: rgba(128, 128, 128, 0.15);
}

.md-body :deep(pre) {
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
  background-color: rgba(128, 128, 128, 0.1);
}

.md-body :deep(pre code) {
  padding: 0;
  background: none;
}

.md-body :deep(blockquote) {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 4px solid rgba(128, 128, 128, 0.4);
  color: rgba(128, 128, 128, 0.8);
}

.md-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

.md-body :deep(th),
.md-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid rgba(128, 128, 128, 0.3);
}

.md-body :deep(th) {
  font-weight: 600;
  background-color: rgba(128, 128, 128, 0.1);
}

.md-body :deep(hr) {
  margin: 16px 0;
  border: none;
  border-top: 1px solid rgba(128, 128, 128, 0.3);
}

.md-body :deep(a) {
  color: #18a058;
  text-decoration: none;
}

.md-body :deep(a:hover) {
  text-decoration: underline;
}
</style>
