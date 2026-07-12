/**
 * 随机文档缓存管理器
 * 用于统一管理随机文档的缓存，提高性能并减少SQL查询
 */

import { sql as executeSql } from "@/api";
import { getCurrentDocId } from "./syUtils";
import { openMobileFileById, openTab, showMessage } from "siyuan";
import { mobileUtils, isMobile, plugin } from "@/utils";
import { navigation } from "@/navigation";
import { getLogger } from "@/libs/logger";
import { settings } from "@/settings";
const log = getLogger("randomDocCache");

/** 从配置中收集所有已启用的随机 SQL 快捷操作 */
export function getRandomBlockSqls(): string[] {
  const actions = settings.getBySpace("nav-helper", "customActions") || [];
  const sqls = actions
    .filter(
      (act: { type?: string; enabled?: boolean; value?: string }) =>
        act.type === "sql" && act.enabled !== false && act.value?.trim()
    )
    .map((act: { value: string }) => act.value.trim());
  return sqls.length > 0 ? sqls : ["SELECT id FROM blocks WHERE type = 'd'"];
}

/** 键盘快捷键使用的随机 SQL（取第一个 sql 类型动作） */
export function getRandomBlockSql(): string {
  return getRandomBlockSqls()[0];
}

/** 预加载所有已配置的随机 SQL 缓存 */
export function preloadAllRandomDocCaches(): void {
  for (const sql of getRandomBlockSqls()) {
    preloadRandomDocCache(sql);
  }
}

/**
 * 优化随机漫游 SQL：去掉 RANDOM() 排序、收紧 LIMIT，避免全表扫描/排序
 */
export function optimizeRandomSql(sql: string, limit: number): string {
  let inner = sql.trim().replace(/;\s*$/, "");
  inner = inner.replace(/select\s+\*/i, "SELECT id");
  // JS 侧已洗牌，SQL 里的 ORDER BY RANDOM() 只会拖慢查询
  inner = inner.replace(/\s+ORDER\s+BY\s+RANDOM\s*\(\s*\)(\s+(ASC|DESC))?/gi, "");
  // 去掉末尾 LIMIT，统一由外层控制采样量
  inner = inner.replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?\s*$/i, "");
  return `SELECT id FROM (${inner}) LIMIT ${limit}`;
}

interface CacheEntry {
  ids: string[];
  currentIndex: number;
  lastUpdated: number;
  sql: string;
  offset: number;
}

interface CacheConfig {
  cacheSize?: number; // 缓存数量，默认20
  maxCacheAge?: number; // 缓存最大年龄（毫秒），默认1小时
  enableAutoCleanup?: boolean; // 是否启用自动清理
}

export class RandomDocCache {
  private cache = new Map<string, CacheEntry>();
  private config: Required<CacheConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: CacheConfig = {}) {
    this.config = {
      cacheSize: config.cacheSize ?? 20,
      maxCacheAge: config.maxCacheAge ?? 60 * 60 * 1000, // 1小时
      enableAutoCleanup: config.enableAutoCleanup ?? true,
    };

    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * 获取随机文档ID
   * @param sql 原始SQL查询语句
   * @returns 随机文档ID，如果缓存为空则返回null
   */
  async getRandomDocId(
    sql: string = "SELECT id FROM blocks WHERE type = 'd'"
  ): Promise<string | null> {
    const cacheKey = this.normalizeSql(sql);
    let cacheEntry = this.cache.get(cacheKey);

    // 如果缓存不存在或已过期，重新加载
    if (!cacheEntry || this.isCacheExpired(cacheEntry)) {
      await this.reloadCache(cacheKey, sql);
      cacheEntry = this.cache.get(cacheKey);
    }

    if (!cacheEntry || cacheEntry.ids.length === 0) {
      return null;
    }

    // 获取当前索引的ID
    const docId = cacheEntry.ids[cacheEntry.currentIndex];
    cacheEntry.currentIndex++;

    // 如果缓存用完了，重新加载 (异步，不阻塞当前返回)
    if (cacheEntry.currentIndex >= cacheEntry.ids.length) {
      this.reloadCache(cacheKey, sql).catch(err => log.error(err));
    }

    return docId;
  }

  /**
   * 预加载缓存
   * @param sql SQL查询语句
   */
  async preloadCache(sql: string): Promise<void> {
    const cacheKey = this.normalizeSql(sql);
    if (!this.cache.has(cacheKey)) {
      await this.reloadCache(cacheKey, sql);
    }
  }

  /**
   * 清理指定SQL的缓存
   * @param sql SQL查询语句
   */
  clearCache(sql: string): void {
    const cacheKey = this.normalizeSql(sql);
    this.cache.delete(cacheKey);
  }

  /**
   * 清理所有缓存
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    totalCaches: number;
    cacheDetails: Array<{
      sql: string;
      cacheSize: number;
      currentIndex: number;
      lastUpdated: number;
      remainingIds: number;
      offset: number;
    }>;
  } {
    const details = Array.from(this.cache.entries()).map(([key, entry]) => ({
      sql: entry.sql,
      cacheSize: entry.ids.length,
      currentIndex: entry.currentIndex,
      lastUpdated: entry.lastUpdated,
      remainingIds: entry.ids.length - entry.currentIndex,
      offset: entry.offset,
    }));

    return {
      totalCaches: this.cache.size,
      cacheDetails: details,
    };
  }

  /**
   * 获取缓存中的剩余ID数量
   * @param sql SQL查询语句
   */
  getRemainingCount(sql: string): number {
    const cacheKey = this.normalizeSql(sql);
    const cacheEntry = this.cache.get(cacheKey);

    if (!cacheEntry) {
      return 0;
    }

    return Math.max(0, cacheEntry.ids.length - cacheEntry.currentIndex);
  }

  /**
   * 检查SQL是否已缓存
   * @param sql SQL查询语句
   */
  hasCache(sql: string): boolean {
    const cacheKey = this.normalizeSql(sql);
    const cacheEntry = this.cache.get(cacheKey);

    return cacheEntry !== undefined && !this.isCacheExpired(cacheEntry);
  }

  /**
   * 销毁缓存管理器，清理资源
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clearAllCache();
  }

  /**
   * 重新加载缓存
   */
  private async reloadCache(cacheKey: string, sql: string): Promise<void> {
    try {
      const existingEntry = this.cache.get(cacheKey);
      let nextOffset = 0;
      
      // 如果存在旧缓存且正常遍历完，则继续往后查
      if (existingEntry && existingEntry.ids.length > 0) {
        nextOffset = existingEntry.offset + existingEntry.ids.length;
      }

      // 优化 SQL，加上 offset
      let optimizedSql = optimizeRandomSql(sql, this.config.cacheSize * 2);
      // optimizeRandomSql 返回的是形如: SELECT id FROM (...) LIMIT 40
      // 我们在末尾拼接 OFFSET
      optimizedSql = `${optimizedSql} OFFSET ${nextOffset}`;

      let result = await executeSql(optimizedSql);
      
      // 如果查询结果为空，说明到底了，重置 offset 为 0 重新循环
      if (!result || result.length === 0) {
        log.info(`SQL 查询到底，重置 offset 为 0: ${sql}`);
        nextOffset = 0;
        optimizedSql = `${optimizeRandomSql(sql, this.config.cacheSize * 2)} OFFSET 0`;
        result = await executeSql(optimizedSql);
      }

      let ids = result?.map((item: any) => item.id).filter(Boolean) || [];

      // Fisher-Yates 洗牌算法
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }

      // 只截取所需缓存大小
      if (ids.length > this.config.cacheSize) {
        ids = ids.slice(0, this.config.cacheSize);
      }

      const cacheEntry: CacheEntry = {
        ids,
        currentIndex: 0,
        lastUpdated: Date.now(),
        sql,
        offset: nextOffset,
      };

      this.cache.set(cacheKey, cacheEntry);

      log.info(`随机文档缓存已更新: ${optimizedSql} -> ${ids.length} 条记录`);
    } catch (error) {
      log.error("重新加载随机文档缓存失败:", error);

      // 如果加载失败，设置为空缓存以避免重复尝试
      const cacheEntry: CacheEntry = {
        ids: [],
        currentIndex: 0,
        lastUpdated: Date.now(),
        sql,
        offset: 0,
      };
      this.cache.set(cacheKey, cacheEntry);
    }
  }

  /**
   * 检查缓存是否过期
   */
  private isCacheExpired(cacheEntry: CacheEntry): boolean {
    // 空缓存（多为 SQL 失败）缩短过期时间，便于重试
    const maxAge =
      cacheEntry.ids.length === 0 ? 30_000 : this.config.maxCacheAge;
    return Date.now() - cacheEntry.lastUpdated > maxAge;
  }

  /**
   * 标准化SQL语句（去除多余空格和换行）
   */
  private normalizeSql(sql: string): string {
    return sql.trim().replace(/\s+/g, " ").toLowerCase();
  }

  /**
   * 启动自动清理定时器
   */
  private startAutoCleanup(): void {
    // 每10分钟清理一次过期缓存
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredCache();
    }, 10 * 60 * 1000);
  }

  /**
   * 清理过期的缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, cacheEntry] of this.cache.entries()) {
      if (this.isCacheExpired(cacheEntry)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log.info(`自动清理完成: 清理了 ${cleanedCount} 个过期缓存`);
    }
  }
}

// 创建全局实例
export const randomDocCache = new RandomDocCache();

// 导出便捷方法
export const getRandomDocId = (sql: string) =>
  randomDocCache.getRandomDocId(sql);
export const preloadRandomDocCache = (sql: string) =>
  randomDocCache.preloadCache(sql);
export const clearRandomDocCache = (sql?: string) => {
  if (sql) {
    randomDocCache.clearCache(sql);
  } else {
    randomDocCache.clearAllCache();
  }
};

/**
 * 跳转到随机文档（不传 action，避免聚焦第一行导致视觉延迟）
 */
export const goToRandomBlock = async (sql: string) => {
  try {
    const randomDocId = await getRandomDocId(sql);

    if (isMobile) {
      openMobileFileById(plugin.app, randomDocId);
    } else {
      openTab({
        app: plugin.app,
        doc: {
          id: randomDocId,
        },
      });
    }
    showMessage(plugin.i18n["lets-nav-helper.jumpedToRandom"]);
    mobileUtils.vibrate(50);
  } catch (error) {
    log.error("跳转到随机文档失败:", error);
    showMessage(plugin.i18n["lets-nav-helper.jumpToRandomFailed"]);
  }
};
