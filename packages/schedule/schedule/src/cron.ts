/**
 * 文件：cron.ts
 * 功能：手写五字段 Vixie cron（分 时 日 月 周）的解析与“下一次触发时刻”计算。
 * 作用：不依赖 node-cron / @js-temporal/polyfill（pnpm store 均无），用 Intl 时区把
 *       目标时区的墙上时间换算回 UTC 毫秒，从而支持 daily/weekly/cron 三类周期任务。
 * 边界：只做时间解析与触发时刻推算，不触发任何业务；触发后由 runtime 负责派发。
 * 关联文件：packages/schedule/schedule/src/store.ts、runtime.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/schedule/schedule/src/domain.ts 的规则语义；本实现为 LFAA 自写简化版。
 */

/** 周期任务最小间隔（秒），与 DSH 的 MIN_EVERY_INTERVAL_SECONDS 对齐，避免过热调度。 */
export const MIN_EVERY_INTERVAL_SECONDS = 60;

/** cron 向前搜索的最大天数上限（400 年）：格里历周期 400 年一循环，超出即永不匹配。 */
const CRON_SEARCH_HORIZON_DAYS = 400 * 366;

/** 非法 cron / 时间规则的稳定错误。 */
export class ScheduleRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleRuleError";
  }
}

interface CronField {
  /** 该字段是否为“全量通配”（决定 dom/dow 的 OR/AND 语义）。 */
  readonly star: boolean;
  values: Set<number>;
}

const WEEKDAY_SHORT: Readonly<Record<string, number>> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

/**
 * 解析单个 cron 字段，支持 `*`、`,` 列表、`-` 区间、`/` 步长及其组合。
 * @param raw 字段原文
 * @param min 取值下界（含）
 * @param max 取值上界（含）
 */
function parseCronField(raw: string, min: number, max: number): CronField {
  const text = raw.trim().toLowerCase();
  if (text.length === 0) throw new ScheduleRuleError(`cron 字段为空：${raw}`);
  const star = text === "*";
  const values = new Set<number>();
  for (const part of text.split(",")) {
    const rangeStep = part.split("/");
    if (rangeStep.length > 2) throw new ScheduleRuleError(`cron 字段步长非法：${part}`);
    const range = rangeStep[0];
    const step = rangeStep[1] === undefined ? 1 : Number(rangeStep[1]);
    if (!Number.isInteger(step) || step <= 0) throw new ScheduleRuleError(`cron 步长必须为正整数：${part}`);
    let lo: number;
    let hi: number;
    if (range === "*" || range === "") {
      lo = min;
      hi = max;
    } else if (range.includes("-")) {
      const bounds = range.split("-");
      if (bounds.length !== 2) throw new ScheduleRuleError(`cron 区间非法：${range}`);
      lo = Number(bounds[0]);
      hi = Number(bounds[1]);
    } else {
      lo = Number(range);
      hi = Number(range);
    }
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < min || hi > max || lo > hi) {
      throw new ScheduleRuleError(`cron 取值越界：${range}（应在 ${min}-${max}）`);
    }
    for (let value = lo; value <= hi; value += step) values.add(value);
  }
  if (values.size === 0) throw new ScheduleRuleError(`cron 字段未产生任何取值：${raw}`);
  return { star, values };
}

/** 把周字段里的 7（周日）归一为 0，并接受 sun/mon 等英文缩写。 */
function normalizeWeekdayField(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(",")
    .map((token) => {
      const body = token.includes("/") ? token.slice(0, token.indexOf("/")) : token;
      const step = token.includes("/") ? token.slice(token.indexOf("/")) : "";
      if (/^[a-z]{3}$/.test(body)) {
        const mapped = WEEKDAY_SHORT[body];
        if (mapped === undefined) throw new ScheduleRuleError(`未知星期缩写：${body}`);
        return `${mapped}${step}`;
      }
      return token;
    })
    .join(",");
}

interface ParsedCron {
  minute: CronField;
  hour: CronField;
  dom: CronField;
  month: CronField;
  dow: CronField;
}

/**
 * 解析五字段 cron 表达式。
 * @param expression `分 时 日 月 周`，周 0=周日，7 也视为周日。
 */
export function parseCronExpression(expression: string): ParsedCron {
  const fields = expression.trim().split(/\s+/u);
  if (fields.length !== 5) {
    throw new ScheduleRuleError(`cron 表达式必须是 5 个字段（分 时 日 月 周），收到：${expression}`);
  }
  const [minute, hour, dom, month, dowRaw] = fields;
  const dow = normalizeWeekdayField(dowRaw);
  const parsed: ParsedCron = {
    minute: parseCronField(minute, 0, 59),
    hour: parseCronField(hour, 0, 23),
    dom: parseCronField(dom, 1, 31),
    month: parseCronField(month, 1, 12),
    dow: parseCronField(dow, 0, 6)
  };
  // 周字段把 7 当作 0（周日）。
  if (parsed.dow.values.has(7)) {
    parsed.dow.values.delete(7);
    parsed.dow.values.add(0);
  }
  return parsed;
}

interface WallParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  weekday: number; // 0=周日
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
};

/** 缓存每个时区的 DateTimeFormat，避免重复构造。 */
const formatCache = new Map<string, Intl.DateTimeFormat>();

function wallPartsFormat(timeZone: string): Intl.DateTimeFormat {
  let format = formatCache.get(timeZone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short"
    });
    formatCache.set(timeZone, format);
  }
  return format;
}

/**
 * 把某个 UTC 毫秒换算为指定时区的墙上时间分量。
 * @param ms UTC 毫秒
 * @param timeZone IANA 时区（如 Asia/Shanghai）或 UTC
 */
export function wallParts(ms: number, timeZone: string): WallParts {
  let format: Intl.DateTimeFormat;
  try {
    format = wallPartsFormat(timeZone);
  } catch {
    throw new ScheduleRuleError(`无效的时区：${timeZone}`);
  }
  const map = new Map<string, string>();
  for (const part of format.formatToParts(new Date(ms))) map.set(part.type, part.value);
  const hourRaw = Number(map.get("hour") ?? "0");
  // 某些环境下 hour12:false 会把午夜渲染为 24，归一为 0。
  const hour = hourRaw === 24 ? 0 : hourRaw;
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour,
    minute: Number(map.get("minute")),
    weekday: WEEKDAY_INDEX[map.get("weekday") ?? "Sun"] ?? 0
  };
}

/**
 * 把“目标时区的某墙上时刻”换算回 UTC 毫秒。
 * 采用双向换算（先按 UTC 猜测，再用墙钟差修正），天然处理夏令时。
 */
export function wallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const wall = wallParts(guess, timeZone);
  const guessWall = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
  const offset = guessWall - guess;
  return guess - offset;
}

/**
 * 计算 cron 表达式在指定时区下、严格晚于 afterMs 的下一次触发 UTC 毫秒。
 * @returns 下一次触发时刻；在 400 年视野内永不匹配时返回 undefined。
 */
export function nextCronOccurrence(expression: string, timeZone: string, afterMs: number): number | undefined {
  const cron = parseCronExpression(expression);
  const start = wallParts(afterMs + 1000, timeZone);
  let year = start.year;
  let month = start.month;
  let day = start.day;
  for (let offset = 0; offset <= CRON_SEARCH_HORIZON_DAYS; offset++) {
    // 从起始日期逐日推进。
    const probe = wallTimeToUtc(year, month, day, 0, 0, timeZone);
    const wall = wallParts(probe, timeZone);
    if (!cron.month.values.has(wall.month)) {
      advanceDay();
      continue;
    }
    const domHit = cron.dom.values.has(wall.day);
    const dowHit = cron.dow.values.has(wall.weekday);
    // Vixie 语义：dom 与 dow 都非通配时为 OR，否则为 AND。
    const dayMatch = cron.dom.star || cron.dow.star ? domHit && dowHit : domHit || dowHit;
    if (dayMatch) {
      let best: number | undefined;
      for (const hour of cron.hour.values) {
        for (const minute of cron.minute.values) {
          const candidate = wallTimeToUtc(wall.year, wall.month, wall.day, hour, minute, timeZone);
          if (candidate > afterMs && (best === undefined || candidate < best)) best = candidate;
        }
      }
      if (best !== undefined) return best;
    }
    advanceDay();
  }
  return undefined;

  // 用 Date 工具推进一天，避免手写闰年。
  function advanceDay(): void {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }
}

/**
 * 解析 HH:mm 为当天的 [时, 分]。
 */
export function parseWallClockTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/u.exec(time.trim());
  if (!match) throw new ScheduleRuleError(`时间格式应为 HH:mm：${time}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new ScheduleRuleError(`时间越界：${time}`);
  return { hour, minute };
}

/** 把 ISO 星期（周一=1 … 周日=7）映射为 cron 的周值（0=周日 … 6=周六）。 */
export function isoWeekdayToCron(isoWeekday: number): number {
  if (!Number.isInteger(isoWeekday) || isoWeekday < 1 || isoWeekday > 7) {
    throw new ScheduleRuleError(`星期必须在 1（周一）到 7（周日）之间：${isoWeekday}`);
  }
  return isoWeekday === 7 ? 0 : isoWeekday;
}
