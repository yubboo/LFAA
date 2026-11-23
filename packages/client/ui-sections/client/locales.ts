// 集中维护工作区自定义分区模块在中英文环境下的创建、重命名与管理文案。
export const sectionsLocales = {
  zh: {
    createSection: "新建分区",
    renameSection: "重命名分区",
    deleteSection: "删除分区",
    sectionName: "分区名称",
    sectionNamePlaceholder: "输入分区名称，如 鱼",
    sectionNameRequired: "请输入分区名称。",
    sectionNameDuplicate: "分区名称已存在，请更换其他名称。",
    sectionStorageError: "无法读取或保存分区，请检查本地服务状态。",
    sectionMoreOptions: "分区操作",
    newChatInSection: "在该分区内新建聊天",
    create: "创建",
    save: "保存",
    cancel: "取消",
    close: "关闭",
  },
  en: {
    createSection: "New section",
    renameSection: "Rename section",
    deleteSection: "Delete section",
    sectionName: "Section name",
    sectionNamePlaceholder: "Enter section name",
    sectionNameRequired: "Enter a section name.",
    sectionNameDuplicate: "A section with this name already exists.",
    sectionStorageError: "Could not read or save sections. Check the local server.",
    sectionMoreOptions: "Section actions",
    newChatInSection: "New chat in section",
    create: "Create",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
  },
} as const;

/** 约定分区菜单与分区编辑表单共用的语言键。 */
export type SectionsLocaleMessages = (typeof sectionsLocales)[keyof typeof sectionsLocales];

/** 按当前语言选择分区操作文案。 */
export function getSectionsLocale(): SectionsLocaleMessages {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")
    ? sectionsLocales.zh
    : sectionsLocales.en;
}
