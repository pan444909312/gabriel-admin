<script setup lang="ts">
import { computed, ref } from 'vue';

defineOptions({ name: 'JsonNode' });

interface Props {
  /** 该节点的键名，根节点为 undefined */
  nodeKey?: string | number;
  /** 节点值 */
  value: unknown;
  /** 是否为数组元素（键名以下标显示时用不同样式） */
  isArrayItem?: boolean;
  /** 该节点后面是否需要逗号 */
  hasComma?: boolean;
  /** 初始是否展开 */
  defaultExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  nodeKey: undefined,
  isArrayItem: false,
  hasComma: false,
  defaultExpanded: true
});

const expanded = ref(props.defaultExpanded);

type ValueKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

const kind = computed<ValueKind>(() => {
  const v = props.value;
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'object') return 'object';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  return 'string';
});

const isContainer = computed(() => kind.value === 'object' || kind.value === 'array');

/** 容器子项：统一成 [key, value] 列表 */
const entries = computed<[string | number, unknown][]>(() => {
  if (kind.value === 'array') {
    return (props.value as unknown[]).map((item, index) => [index, item]);
  }
  if (kind.value === 'object') {
    return Object.entries(props.value as Record<string, unknown>);
  }
  return [];
});

const isEmptyContainer = computed(() => isContainer.value && entries.value.length === 0);

const bracket = computed(() => (kind.value === 'array' ? ['[', ']'] : ['{', '}']));

/** 折叠时的摘要，如 {3 项} / [2 项] */
const summary = computed(() => `${bracket.value[0]}...${bracket.value[1]} ${entries.value.length} 项`);

/** 原始值的显示文本（非容器） */
const primitiveText = computed(() => {
  switch (kind.value) {
    case 'string':
      return JSON.stringify(props.value);
    case 'null':
      return 'null';
    default:
      return String(props.value);
  }
});

const primitiveClass = computed(() => `j-${kind.value}`);

function toggle() {
  if (isContainer.value && !isEmptyContainer.value) {
    expanded.value = !expanded.value;
  }
}
</script>

<template>
  <div class="json-node">
    <!-- 容器节点 -->
    <template v-if="isContainer">
      <div class="node-line" :class="{ clickable: !isEmptyContainer }" @click="toggle">
        <span class="toggle">
          <svg
            v-if="!isEmptyContainer"
            class="arrow"
            :class="{ collapsed: !expanded }"
            viewBox="0 0 1024 1024"
            width="10"
            height="10"
          >
            <path d="M384 192l384 320-384 320z" fill="currentColor" />
          </svg>
        </span>

        <span v-if="nodeKey !== undefined" class="j-key">{{ isArrayItem ? nodeKey : `"${nodeKey}"` }}</span>
        <span v-if="nodeKey !== undefined" class="colon">:&nbsp;</span>

        <span class="bracket">{{ bracket[0] }}</span>
        <template v-if="isEmptyContainer">
          <span class="bracket">{{ bracket[1] }}</span>
          <span v-if="hasComma" class="comma">,</span>
        </template>
        <template v-else-if="!expanded">
          <span class="summary">... {{ entries.length }} 项</span>
          <span class="bracket">{{ bracket[1] }}</span>
          <span v-if="hasComma" class="comma">,</span>
        </template>
      </div>

      <template v-if="!isEmptyContainer && expanded">
        <div class="children">
          <JsonNode
            v-for="([childKey, childValue], idx) in entries"
            :key="childKey"
            :node-key="childKey"
            :value="childValue"
            :is-array-item="kind === 'array'"
            :has-comma="idx < entries.length - 1"
            :default-expanded="defaultExpanded"
          />
        </div>
        <div class="node-line closing">
          <span class="toggle" />
          <span class="bracket">{{ bracket[1] }}</span>
          <span v-if="hasComma" class="comma">,</span>
        </div>
      </template>
    </template>

    <!-- 原始值节点 -->
    <template v-else>
      <div class="node-line">
        <span class="toggle" />
        <span v-if="nodeKey !== undefined" class="j-key">{{ isArrayItem ? nodeKey : `"${nodeKey}"` }}</span>
        <span v-if="nodeKey !== undefined" class="colon">:&nbsp;</span>
        <span :class="primitiveClass">{{ primitiveText }}</span>
        <span v-if="hasComma" class="comma">,</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.json-node {
  font-family: 'Fira Code', Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
}

.node-line {
  display: flex;
  align-items: flex-start;
  white-space: pre;
}

.node-line.clickable {
  cursor: pointer;
}

.node-line.clickable:hover {
  background-color: rgb(0 0 0 / 4%);
  border-radius: 3px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  min-width: 14px;
  height: 22px;
  color: #8c8c8c;
}

.arrow {
  transition: transform 0.15s ease;
}

.arrow.collapsed {
  transform: rotate(0deg);
}

.arrow:not(.collapsed) {
  transform: rotate(90deg);
}

.children {
  padding-left: 16px;
  border-left: 1px dashed rgb(140 140 140 / 25%);
  margin-left: 6px;
}

.j-key {
  color: #c41d7f;
}

.j-string {
  color: #52c41a;
}

.j-number {
  color: #1677ff;
}

.j-boolean {
  color: #fa8c16;
}

.j-null {
  color: #8c8c8c;
}

.bracket {
  color: #8c8c8c;
}

.colon,
.comma {
  color: #8c8c8c;
}

.summary {
  color: #bfbfbf;
  padding: 0 4px;
  font-style: italic;
}
</style>
