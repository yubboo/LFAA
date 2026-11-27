// 默认项目目录与「项目外聊天」目录的解析器：装配层在运行期注入，可回滚。
type DirResolver = () => Promise<string | undefined>;

export interface ProjectDirResolverPair {
  defaultProjectsDirResolver?: DirResolver;
  outsideProjectDirResolver?: DirResolver;
}

/** 可替换、可回滚的目录解析器组合。 */
export class ProjectDirResolvers {
  private defaultProjectsDir: DirResolver | undefined;
  private outsideProjectDir: DirResolver | undefined;

  constructor(defaultProjectsDir?: DirResolver, outsideProjectDir?: DirResolver) {
    this.defaultProjectsDir = defaultProjectsDir;
    this.outsideProjectDir = outsideProjectDir;
  }

  get defaultDir(): DirResolver | undefined {
    return this.defaultProjectsDir;
  }

  get outsideDir(): DirResolver | undefined {
    return this.outsideProjectDir;
  }

  set(next: ProjectDirResolverPair): () => void {
    const previous = { defaultDir: this.defaultProjectsDir, outsideDir: this.outsideProjectDir };
    if (next.defaultProjectsDirResolver) this.defaultProjectsDir = next.defaultProjectsDirResolver;
    if (next.outsideProjectDirResolver) this.outsideProjectDir = next.outsideProjectDirResolver;
    return () => {
      this.defaultProjectsDir = previous.defaultDir;
      this.outsideProjectDir = previous.outsideDir;
    };
  }
}