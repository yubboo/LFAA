/** 功能：共享 Java 执行。作用：控制端与 Daemon 共用同一实现，不持有审批和模型决策。 */
import {createHash,randomUUID} from 'node:crypto';
import {cp,lstat,mkdir,open,opendir,readFile,readdir,realpath,rename,rm,writeFile} from 'node:fs/promises';
import {basename,dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);
export function createJavaRuntimeManager(options) {
const {repositoryRoot,dataDirectory,javaDirectory,downloadDirectory,captureProcess,expandZip,assertSafeFileTarget,fileExists,findExecutable,hashFile,downloadCoreArtifact,requireMajor,assertHttpsHost,safeMessage,activeServers=new Map(),postTaskProgress=async()=>{},fetchResource=globalThis.fetch}=options;
let customJavaPathWarningLogged=false,localDriveRootsCache=[],localDriveRootsCacheExpiresAt=0;
const customJavaPathsPath=resolve(javaDirectory,'custom-paths.json');
const javaDistributions=new Set(["temurin","zulu"]);
async function withMutationLock(name,operation){await assertSafeFileTarget(resolve(javaDirectory,name),true);await mkdir(javaDirectory,{recursive:true});const path=resolve(javaDirectory,name);const lock=await open(path,"wx").catch(error=>{if(error.code==="EEXIST")throw new Error("同一环境已有修改操作或未确认的执行锁，请先核对任务。");throw error;});try{return await operation();}finally{await lock.close();await rm(path,{force:true});}}
function requireJavaDistribution(value="temurin"){if(typeof value!=="string"||!javaDistributions.has(value))throw new Error("Java 发行版未登记；当前支持 Temurin 与 Zulu。");return value;}
function javaRuntimeDirectory(major,distribution){return resolve(javaDirectory,`Java${major}-windows-x64${distribution==="zulu"?"-zulu":""}`);}
function javaRuntimeLockName(major,distribution){return distribution==="temurin"?`.java-${major}.lock`:`.java-${major}-${distribution}.lock`;}
function javaDistributionForManagedEntry(name,vendor=""){return name.endsWith("-zulu")||/azul|zulu/iu.test(vendor)?"zulu":"temurin";}
function javaRuntimeId(distribution,major){return `${distribution}-${major}`;}
function requireRequestedJavaVersion(major,value){if(value===undefined||value===null)return null;if(typeof value!=="string"||value.length>32||!/^\d{1,2}(?:\.\d{1,3}){2,3}$/u.test(value)||Number(value.split(".")[0])!==major)throw new Error(`Java 精确版本必须是与主版本 ${major} 一致的完整版本号。`);return value;}
async function writeCustomJavaPaths(paths){const temporary=resolve(javaDirectory,`.custom-paths-${randomUUID()}.tmp`);await assertSafeFileTarget(customJavaPathsPath,true);await assertSafeFileTarget(temporary,true);try{await writeFile(temporary,JSON.stringify(paths,null,2),{encoding:"utf8",flag:"wx"});await rename(temporary,customJavaPathsPath);}finally{await rm(temporary,{force:true});}}
async function installTemurinRuntime(majorInput, reportProgress, downloadTimeoutSeconds) {
  return installManagedJavaRuntime(majorInput,"temurin",undefined,reportProgress,downloadTimeoutSeconds);
}
async function installZuluRuntime(majorInput, versionInput, reportProgress, downloadTimeoutSeconds) {
  return installManagedJavaRuntime(majorInput,"zulu",versionInput,reportProgress,downloadTimeoutSeconds);
}
async function installManagedJavaRuntime(majorInput,distributionInput="temurin",versionInput,reportProgress,downloadTimeoutSeconds) {
  const major=requireMajor(majorInput),distribution=requireJavaDistribution(distributionInput),requestedVersion=requireRequestedJavaVersion(major,versionInput);
  if(distribution!=="zulu"&&requestedVersion)throw new Error("当前仅支持为 Zulu 安装指定精确版本；Temurin 使用官方兼容目录。 ");
  await mkdir(javaDirectory,{recursive:true});
  const lockName=javaRuntimeLockName(major,distribution),lockPath=resolve(javaDirectory,lockName);
  await assertSafeFileTarget(lockPath,true);
  const lock=await open(lockPath,"wx").catch(error=>{if(error.code==="EEXIST")throw new Error(`Java ${major} ${distribution} 已有准备操作或未确认的执行锁；请先核对任务，不会重复下载或覆盖。`);throw error;});
  try {return await installManagedJavaRuntimeUnlocked(major,distribution,requestedVersion,reportProgress,downloadTimeoutSeconds);}
  finally {await lock.close();await rm(lockPath,{force:true});}
}
async function installManagedJavaRuntimeUnlocked(majorInput,distributionInput,versionInput,reportProgress,downloadTimeoutSeconds) {
  const major=requireMajor(majorInput),distribution=requireJavaDistribution(distributionInput),requestedVersion=requireRequestedJavaVersion(major,versionInput);
  const vendorLabel=distribution==="zulu"?"Azul Zulu":"Temurin";
  const existing=await findJavaRuntime(major,true,distribution);
  if(existing?.managed){if(requestedVersion&&existing.version!==requestedVersion)throw new Error(`已受管安装 ${vendorLabel} Java ${existing.version}；要安装指定的 ${requestedVersion}，请先显式更新该运行时。`);return {javaMajor:major,runtimeVendor:existing.vendor,version:existing.version,distribution,reused:true};}
  const destinationDirectory=javaRuntimeDirectory(major,distribution);
  if (await fileExists(destinationDirectory)) throw new Error(`Java ${major} 的标准安装目录已存在，但其中没有可识别的运行时；为避免覆盖文件，已停止安装。`);
  await reportProgress?.(8, `正在查询 ${vendorLabel} Java ${requestedVersion??major} 的官方安装包。`);
  const archive=await (distribution==="zulu"?findZuluArchive(major,requestedVersion):findTemurinArchive(major)).catch(error=>{
    const source=distribution==="zulu"?"Azul":"Adoptium";
    throw new Error(`准备 ${vendorLabel} Java ${requestedVersion??major} 失败：无法取得 ${source} 官方 Windows x64 工件元数据。${error.message}；尚未安装运行环境。`,{cause:error});
  });
  const { downloadUrl, expectedSha256, archiveName, imageType } = archive;
  assertHttpsHost(downloadUrl, distribution==="zulu"?"cdn.azul.com":"github.com");
  const archivePath = resolve(downloadDirectory, archiveName);
  if (!(await fileExists(archivePath)) || await hashFile(archivePath, "sha256").catch(() => "") !== expectedSha256) {
    await rm(archivePath, { force: true });
    await reportProgress?.(24, `正在下载并校验 ${vendorLabel} Java ${archive.version??requestedVersion??major} ${imageType.toUpperCase()}。`);
    await downloadCoreArtifact({ url: downloadUrl, algorithm: "sha256", digest: expectedSha256 }, archivePath, downloadTimeoutSeconds,
      (bytes, total) => reportProgress?.(24, `正在下载 Java ${major}：${Math.round(bytes / 1024 / 1024)} MiB${total > 0 ? ` / ${Math.round(total / 1024 / 1024)} MiB` : ""}。`));
  }

  const extractionDirectory=resolve(options.temporaryDirectory??javaDirectory,`.install-${major}-${distribution}-${randomUUID()}`);
  await assertSafeFileTarget(extractionDirectory,true);
  await mkdir(extractionDirectory, { recursive: true });
  let finalDirectory = "";
  try {
    await reportProgress?.(72, `正在解压 ${vendorLabel} Java ${archive.version??requestedVersion??major} ${imageType.toUpperCase()} 到目标运行环境目录。`);
    await expandZip(archivePath, extractionDirectory);
    const executable = await findExecutable(extractionDirectory, "java.exe");
    if (!executable) throw new Error(`${vendorLabel} JRE 解压内容中没有 java.exe。`);
    const archiveRuntimeDirectory = dirname(dirname(executable));
    // 永久目录按环境、主版本及平台命名，发行商保留在检测信息中。
    await rename(archiveRuntimeDirectory, destinationDirectory).catch(async error=>{if(error.code!=="EXDEV")throw error;await cp(archiveRuntimeDirectory,destinationDirectory,{recursive:true,errorOnExist:true,force:false,dereference:false});});
    finalDirectory = destinationDirectory;
    const finalExecutable = resolve(finalDirectory, relative(archiveRuntimeDirectory, executable));
    const version = await readJavaVersion(finalExecutable);
    if (version.major !== major) throw new Error(`安装后的 Java 主版本为 ${version.major}，预期为 ${major}。`);
    if(requestedVersion&&version.version!==requestedVersion)throw new Error(`安装后的 Java 精确版本为 ${version.version??"未知"}，预期为 ${requestedVersion}。`);
    await rm(extractionDirectory, { recursive: true, force: true });
    await reportProgress?.(96, `${vendorLabel} Java ${version.version??major} ${imageType.toUpperCase()} 已安装并通过版本核对。`).catch(() => {});
    return { javaMajor: major, runtimeVendor: version.vendor || vendorLabel, version:version.version,distribution,imageType };
  } catch (error) {
    await rm(extractionDirectory, { recursive: true, force: true });
    if (finalDirectory) await rm(finalDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function updateTemurinRuntime(majorInput,reportProgress,downloadTimeoutSeconds) {return updateManagedJavaRuntime(majorInput,"temurin",undefined,reportProgress,downloadTimeoutSeconds);}
async function updateManagedJavaRuntime(majorInput,distributionInput="temurin",versionInput,reportProgress,downloadTimeoutSeconds) {
  const major=requireMajor(majorInput),distribution=requireJavaDistribution(distributionInput),requestedVersion=requireRequestedJavaVersion(major,versionInput),directory=(await findJavaRuntime(major,true,distribution))?.root,lockPath=resolve(javaDirectory,javaRuntimeLockName(major,distribution));
  if(!directory)throw new Error(`没有找到已验证的托管 ${distribution} Java ${major}。`);
  if([...activeServers.values()].some(runtime=>runtime.javaMajor===major&&runtime.child.exitCode===null&&runtime.child.signalCode===null))throw new Error(`Java ${major} 正被运行实例使用，拒绝更新。`);
  await assertSafeFileTarget(resolve(directory,"bin","java.exe"),false);
  const lock=await open(lockPath,"wx");const backup=resolve(javaDirectory,`.previous-${major}-${distribution}-${randomUUID()}`);let moved=false;
  try {await rename(directory,backup);moved=true;const result=await installManagedJavaRuntimeUnlocked(major,distribution,requestedVersion,reportProgress,downloadTimeoutSeconds);await rm(backup,{recursive:true,force:false});moved=false;return {...result,updated:true};}
  catch(error){if(moved){if(await fileExists(directory))await rm(directory,{recursive:true,force:true});await rename(backup,directory);}throw error;}
  finally{await lock.close();await rm(lockPath,{force:true});}
}

async function findTemurinArchive(major) {
  const latestJreUrl = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse`;
  assertHttpsHost(latestJreUrl, "api.adoptium.net");
  const latestResponse = await fetchResource(latestJreUrl, { signal: AbortSignal.timeout(30_000), redirect: "error" });
  if(!latestResponse.ok)await latestResponse.body?.cancel();
  if (!latestResponse.ok && latestResponse.status !== 404) {
    throw new Error(`Adoptium Java ${major} JRE 版本目录查询失败（${latestResponse.status}）。`);
  }
  if (latestResponse.ok) {
    const latestAssets = await latestResponse.json().catch(() => null);
    const latestBinary = Array.isArray(latestAssets)
      ? latestAssets.find((asset) => asset?.binary?.os === "windows" && asset.binary.architecture === "x64" && asset.binary.image_type === "jre" && asset.binary.jvm_impl === "hotspot")?.binary
      : null;
    const latestPackage = latestBinary?.package;
    if (isValidTemurinArchivePackage(latestPackage)) {
      return {
        downloadUrl: latestPackage.link,
        expectedSha256: latestPackage.checksum.toLowerCase(),
        archiveName: latestPackage.name,
        imageType: "jre"
      };
    }
  }

  // 旧主版本可能没有 latest JRE；先查归档 JRE，再回退到包含同一 java.exe 的 JDK ZIP。
  for (const imageType of ["jre", "jdk"]) {
    const versionRange = encodeURIComponent(`[${major},${major + 1})`).replace(/\)/gu, "%29");
    const archiveUrl = new URL(`https://api.adoptium.net/v3/assets/version/${versionRange}`);
    archiveUrl.searchParams.set("architecture", "x64");
    archiveUrl.searchParams.set("heap_size", "normal");
    archiveUrl.searchParams.set("image_type", imageType);
    archiveUrl.searchParams.set("jvm_impl", "hotspot");
    archiveUrl.searchParams.set("os", "windows");
    archiveUrl.searchParams.set("project", "jdk");
    archiveUrl.searchParams.set("release_type", "ga");
    archiveUrl.searchParams.set("sort_method", "DATE");
    archiveUrl.searchParams.set("sort_order", "DESC");
    archiveUrl.searchParams.set("page_size", "1");
    assertHttpsHost(archiveUrl.href, "api.adoptium.net");
    const response = await fetchResource(archiveUrl, { signal: AbortSignal.timeout(30_000), redirect: "error" });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) continue;
      throw new Error(`Adoptium Java ${major} ${imageType.toUpperCase()} 归档查询失败（${response.status}）。`);
    }
    const assets = await response.json().catch(() => null);
    const binary = Array.isArray(assets)
      ? assets.flatMap((asset) => Array.isArray(asset?.binaries) ? asset.binaries : []).find((candidate) => candidate.os === "windows" && candidate.architecture === "x64" && candidate.image_type === imageType && candidate.jvm_impl === "hotspot" && isValidTemurinArchivePackage(candidate.package))
      : null;
    if (!binary) continue;
    return {
      downloadUrl: binary.package.link,
      expectedSha256: binary.package.checksum.toLowerCase(),
      archiveName: binary.package.name,
      imageType
    };
  }
  throw new Error(`Adoptium 没有 Java ${major} 的 Windows x64 JRE/JDK ZIP 工件；请选择有官方工件的版本，或登记本机现有 Java。`);
}

async function findZuluArchive(majorInput,versionInput) {
  const major=requireMajor(majorInput),requestedVersion=requireRequestedJavaVersion(major,versionInput);
  const listUrl=new URL("https://api.azul.com/metadata/v1/zulu/packages/");
  for(const [key,value] of Object.entries({java_version:requestedVersion??String(major),os:"windows",arch:"x64",java_package_type:"jdk",javafx_bundled:"false",release_status:"ga",availability_types:"CA",archive_type:"zip",latest:"true",page:"1",page_size:"100"}))listUrl.searchParams.set(key,value);
  assertHttpsHost(listUrl.href,"api.azul.com");
  const listResponse=await fetchResource(listUrl,{signal:AbortSignal.timeout(30_000),redirect:"error"});
  if(!listResponse.ok){await listResponse.body?.cancel();throw new Error(`Azul Zulu Java ${requestedVersion??major} 版本目录查询失败（${listResponse.status}）。`);}
  const packages=await listResponse.json().catch(()=>null);
  const packageInfo=Array.isArray(packages)?packages.find(item=>{
    const version=Array.isArray(item?.java_version)?item.java_version.join("."):"";
    return item?.product==="zulu"&&item?.availability_type==="CA"&&item?.release_status==="ga"&&item?.os==="windows"&&item?.hw_bitness===64
      &&item?.java_package_type==="jdk"&&item?.archive_type==="zip"&&typeof item?.name==="string"&&/^zulu[0-9.]+-ca-jdk[0-9.]+-win_x64\.zip$/iu.test(item.name)
      &&Number(version.split(".")[0])===major&&(!requestedVersion||version===requestedVersion)&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(item.package_uuid??"");
  }):null;
  if(!packageInfo)throw new Error(`Azul 没有找到 Java ${requestedVersion??major} 的 Windows x64 Zulu JDK ZIP；未安装其他版本。`);

  const detailUrl=`https://api.azul.com/metadata/v1/zulu/packages/${packageInfo.package_uuid}/`;
  assertHttpsHost(detailUrl,"api.azul.com");
  const detailResponse=await fetchResource(detailUrl,{signal:AbortSignal.timeout(30_000),redirect:"error"});
  if(!detailResponse.ok){await detailResponse.body?.cancel();throw new Error(`Azul Zulu 工件详情查询失败（${detailResponse.status}）。`);}
  const detail=await detailResponse.json().catch(()=>null);
  const detailVersion=Array.isArray(detail?.java_version)?detail.java_version.join("."):"";
  if(detail?.product!=="zulu"||detail?.availability_type!=="CA"||detail?.release_status!=="ga"||detail?.os!=="windows"||detail?.hw_bitness!==64||detail?.java_package_type!=="jdk"||detail?.archive_type!=="zip"
    ||detail?.name!==packageInfo.name||detail?.package_uuid!==packageInfo.package_uuid||Number(detailVersion.split(".")[0])!==major||(requestedVersion&&detailVersion!==requestedVersion)
    ||!isZuluArchiveDownloadUrl(detail?.download_url,detail?.name)||!/^[a-f0-9]{64}$/iu.test(detail?.sha256_hash??"")
    ||!/^zulu[0-9.]+-ca-jdk[0-9.]+-win_x64\.zip$/iu.test(detail?.name??"")||!Number.isSafeInteger(detail?.size)||detail.size<=0||detail.size>1_000_000_000) {
    throw new Error("Azul Zulu 官方工件详情缺少匹配的 Windows x64、JDK、版本、大小或 SHA-256 校验信息；已拒绝下载。");
  }
  return {downloadUrl:detail.download_url,expectedSha256:detail.sha256_hash.toLowerCase(),archiveName:detail.name,imageType:"jdk",version:detailVersion};
}

function isZuluArchiveDownloadUrl(value,name) {
  try {
    const url=new URL(value);
    return url.protocol==="https:"&&url.hostname==="cdn.azul.com"&&!url.username&&!url.password&&(!url.port||url.port==="443")
      &&url.pathname===`/zulu/bin/${name}`&&!url.search&&!url.hash;
  } catch { return false; }
}

function isValidTemurinArchivePackage(value) {
  return value && typeof value.link === "string" && /^[a-f0-9]{64}$/iu.test(value.checksum || "")
    && typeof value.name === "string" && /^[A-Za-z0-9._-]+\.zip$/iu.test(value.name)
    && (value.size === undefined || (Number.isSafeInteger(value.size) && value.size > 0 && value.size <= 1_000_000_000));
}

async function executeJavaEnvironmentTask(task) {
  const payload = task.payload ?? {};
  const reportProgress = (progress, message) => postTaskProgress(task.id, progress, message);
  switch (payload.operation ?? "install") {
    case "install": return await installTemurinRuntime(payload.javaMajor, reportProgress, payload.downloadTimeoutSeconds);
    case "uninstall": return await uninstallTemurinRuntime(payload.javaMajor, reportProgress);
    case "register-path": return await registerJavaRuntimePath(payload, reportProgress);
    case "forget-path": return await forgetJavaRuntimePath(payload.runtimeId, reportProgress);
    default: throw new Error("Daemon 拒绝执行未登记的 Java 环境操作。");
  }
}

async function uninstallTemurinRuntime(majorInput, reportProgress) {
  return uninstallManagedJavaRuntime(majorInput,"temurin",reportProgress);
}
async function uninstallManagedJavaRuntime(majorInput,distributionInput="temurin",reportProgress) {
  const major=requireMajor(majorInput),distribution=requireJavaDistribution(distributionInput);
  return withMutationLock(javaRuntimeLockName(major,distribution),()=>uninstallManagedJavaRuntimeUnlocked(major,distribution,reportProgress));
}
async function uninstallManagedJavaRuntimeUnlocked(majorInput, distributionInput, reportProgress) {
  const major=requireMajor(majorInput),distribution=requireJavaDistribution(distributionInput);
  if ([...activeServers.values()].some((runtime) => runtime.javaMajor === major && runtime.child.exitCode === null && runtime.child.signalCode === null)) {
    throw new Error(`Java ${major} 正被运行中的 Minecraft 实例使用，已拒绝卸载。`);
  }
  const runtime=await findJavaRuntime(major,true,distribution),runtimeDirectory=runtime?.root;
  if(!runtimeDirectory)throw new Error(`没有找到已验证的托管 ${distribution} Java ${major}。`);
  await assertSafeFileTarget(resolve(runtimeDirectory,"bin","java.exe"),false);
  const directoryInfo = await lstat(runtimeDirectory).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (!directoryInfo || directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory()) {
    throw new Error(`没有找到 LFAA 管理的 Java ${major} 安装目录。`);
  }
  const executable = await findExecutable(runtimeDirectory, "java.exe");
  if (!executable || (await readJavaVersion(executable)).major !== major) {
    throw new Error(`Java ${major} 安装目录校验失败，已保留现有文件。`);
  }
  await reportProgress(45, `正在安全卸载 LFAA 项目管理的 ${runtime.vendor} Java ${major}。`);
  await rm(runtimeDirectory, { recursive: true, force: false });
  return { javaMajor: major, runtimeVendor: runtime.vendor,distribution };
}

async function registerJavaRuntimePath(payload, reportProgress) {
  return withMutationLock(".custom-paths.lock",()=>registerJavaRuntimePathUnlocked(payload,reportProgress));
}
async function registerJavaRuntimePathUnlocked(payload, reportProgress) {
  // 手动路径只在节点本机验证和持久化，绝不作为 Shell 命令拼接或复制外部文件。
  const executablePath = validateCustomJavaExecutablePath(payload.executablePath);
  const customPaths = await readCustomJavaPaths();
  let existingIndex = -1;
  if (payload.runtimeId !== undefined) {
    if (typeof payload.runtimeId !== "string") throw new Error("手动 Java 路径标识无效。");
    existingIndex = customPaths.findIndex((path) => getCustomJavaRuntimeId(path) === payload.runtimeId);
    if (existingIndex < 0) throw new Error("找不到待修改的手动 Java 路径记录。");
  }
  if (!(await fileExists(executablePath))) throw new Error("指定位置没有找到 java.exe。");
  await reportProgress(35, "正在识别指定 Java 路径并核对主版本。");
  const version = await readJavaVersion(executablePath);
  const normalizedPath = resolve(executablePath);
  const duplicateIndex = customPaths.findIndex((path, index) => index !== existingIndex && sameWindowsPath(path, normalizedPath));
  if (duplicateIndex >= 0) throw new Error("此 Java 路径已经登记，无需重复添加。");
  if (existingIndex >= 0) customPaths.splice(existingIndex, 1, normalizedPath);
  else {
    if (customPaths.length >= 32) throw new Error("手动登记的 Java 路径已达到 32 个上限。");
    customPaths.push(normalizedPath);
  }
  await assertSafeFileTarget(customJavaPathsPath, true);
  await writeCustomJavaPaths(customPaths);
  return { javaMajor: version.major, runtimeVendor: version.vendor };
}

async function forgetJavaRuntimePath(runtimeId, reportProgress) {
  return withMutationLock(".custom-paths.lock",()=>forgetJavaRuntimePathUnlocked(runtimeId,reportProgress));
}
async function forgetJavaRuntimePathUnlocked(runtimeId, reportProgress) {
  if (typeof runtimeId !== "string" || !/^java-[a-f0-9]{24}$/u.test(runtimeId)) throw new Error("手动 Java 路径标识无效。");
  const customPaths = await readCustomJavaPaths();
  const index = customPaths.findIndex((path) => getCustomJavaRuntimeId(path) === runtimeId);
  if (index < 0) throw new Error("找不到待移除的手动 Java 路径记录。");
  customPaths.splice(index, 1);
  await reportProgress(65, "正在移除手动登记的 Java 路径记录。");
  await assertSafeFileTarget(customJavaPathsPath, true);
  await writeCustomJavaPaths(customPaths);
  return {};
}

let cachedJavaRuntimes = [];
async function discoverJavaRuntimes() {
  const runtimes = new Map();
  const managedEntries = await readdir(javaDirectory, { withFileTypes: true }).catch(() => []);
  for (const entry of managedEntries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    const executable = await findExecutable(resolve(javaDirectory, entry.name), "java.exe");
    if (!executable) continue;
    const version = await readJavaVersion(executable).catch(() => null);
    if (!version) continue;
    const distribution=javaDistributionForManagedEntry(entry.name,version.vendor),runtimeId=javaRuntimeId(distribution,version.major);
    runtimes.set(runtimeId, { runtimeId, distribution, major: version.major, version: version.version, architecture:version.architecture,os:version.os,vendor: version.vendor || (distribution==="zulu"?"Azul Zulu":"Eclipse Temurin"), managed: true, source: "managed", executablePath: executable });
  }
  const externalPaths = new Map();
  const addExternalPath = (executablePath, source) => {
    const normalizedPath = resolve(executablePath);
    const managedRelativePath = relative(javaDirectory, normalizedPath);
    if (!managedRelativePath.startsWith(`..${sep}`) && managedRelativePath !== ".." && !isAbsolute(managedRelativePath)) return;
    const key = normalizedPath.toLocaleLowerCase();
    const existing = externalPaths.get(key);
    if (!existing || source === "custom") externalPaths.set(key, { executablePath: normalizedPath, source });
  };
  const pathEntries = (process.env.PATH || "").split(";").filter(Boolean);
  for(const oldRoot of options.previousRuntimeDirectories??[]) {
    const oldJavaRoot=resolve(oldRoot,"java");
    for(const entry of (await readdir(oldJavaRoot,{withFileTypes:true}).catch(()=>[])).slice(0,128)) {
      if(!entry.isDirectory()||entry.isSymbolicLink()||entry.name.startsWith("."))continue;
      const executable=await findExecutable(resolve(oldJavaRoot,entry.name),"java.exe");if(executable)addExternalPath(executable,"system");
    }
    const previous=await readFile(resolve(oldJavaRoot,"custom-paths.json"),"utf8").then(JSON.parse).catch(()=>[]);
    if(Array.isArray(previous))for(const executable of previous.slice(0,32))if(typeof executable==="string"&&isAbsolute(executable)&&basename(executable).toLowerCase()==="java.exe")addExternalPath(executable,"custom");
  }
  for (const pathEntry of pathEntries) {
    addExternalPath(resolve(pathEntry.replace(/^"|"$/gu, ""), "java.exe"), "system");
  }
  const javaHome = process.env.JAVA_HOME?.trim().replace(/^"|"$/gu, "");
  if (javaHome) {
    const resolvedHome = resolve(javaHome);
    const javaExecutable = basename(resolvedHome).toLocaleLowerCase() === "java.exe"
      ? resolvedHome
      : basename(resolvedHome).toLocaleLowerCase() === "bin"
        ? resolve(resolvedHome, "java.exe")
        : resolve(resolvedHome, "bin", "java.exe");
    addExternalPath(javaExecutable, "system");
  }
  const knownJavaRoots = [
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Java"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Eclipse Adoptium"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Microsoft"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Amazon Corretto"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Zulu"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "BellSoft"),
    process.env["ProgramFiles(x86)"] && join(process.env["ProgramFiles(x86)"], "Java"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs", "Eclipse Adoptium"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs", "Microsoft")
  ].filter(Boolean);
  const scannedRoots = new Set();
  for (const root of knownJavaRoots) {
    const normalizedRoot = resolve(root);
    if (scannedRoots.has(normalizedRoot.toLocaleLowerCase())) continue;
    scannedRoots.add(normalizedRoot.toLocaleLowerCase());
    addJavaHomeCandidate(normalizedRoot, addExternalPath);
    const entries = await readdir(normalizedRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const childRoot = resolve(normalizedRoot, entry.name);
      addJavaHomeCandidate(childRoot, addExternalPath);
      if (["latest", "current"].includes(entry.name.toLocaleLowerCase())) {
        const linkedEntries = await readdir(childRoot, { withFileTypes: true }).catch(() => []);
        for (const linkedEntry of linkedEntries) {
          if (linkedEntry.isDirectory() || linkedEntry.isSymbolicLink()) {
            addJavaHomeCandidate(resolve(childRoot, linkedEntry.name), addExternalPath);
          }
        }
      }
    }
  }
  const localDriveRoots = await getLocalDriveRoots();
  await scanJavaPathsAtDriveRoots(localDriveRoots, addExternalPath);  const customPaths = await readCustomJavaPaths().catch((error) => {
    if (!customJavaPathWarningLogged) {
      customJavaPathWarningLogged = true;
      process.stderr.write(`${safeMessage(error)}\n`);
    }
    return [];
  });
  for (const customPath of customPaths) addExternalPath(customPath, "custom");
  for (const { executablePath, source } of externalPaths.values()) {
    if (!(await fileExists(executablePath))) continue;
    const version = await readJavaVersion(executablePath).catch(() => null);
    if (!version) continue;
    const runtimeId = getCustomJavaRuntimeId(executablePath);
    const current = runtimes.get(runtimeId);
    if (!current || source === "custom") {
      runtimes.set(runtimeId, { runtimeId, major: version.major, version: version.version, architecture:version.architecture,os:version.os,vendor: version.vendor || "Java Runtime", managed: false, source, executablePath });
    }
  }
  cachedJavaRuntimes = [...runtimes.values()].slice(0, 128);
  return cachedJavaRuntimes;
}

async function getLocalDriveRoots() {
  if (Date.now() < localDriveRootsCacheExpiresAt) return localDriveRootsCache;
  const fallbackRoots = [process.env.SystemDrive, `${resolve(repositoryRoot).slice(0, 2)}\\`]
    .map(toDriveRoot).filter(Boolean);
  try {
    const query = "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2 OR DriveType=3' | ForEach-Object { $_.DeviceID }";
    const { stdout } = await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", query], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 16 * 1024
    });
    const discoveredRoots = stdout.split(/\r?\n/u).map(toDriveRoot).filter(Boolean);
    localDriveRootsCache = [...new Set([...fallbackRoots, ...discoveredRoots])];
  } catch {
    localDriveRootsCache = [...new Set(fallbackRoots)];
  }
  localDriveRootsCacheExpiresAt = Date.now() + 5 * 60_000;
  return localDriveRootsCache;
}

function toDriveRoot(value) {
  const match = /^([a-z]):(?:\\)?$/iu.exec(String(value ?? "").trim());
  return match ? `${match[1].toUpperCase()}:\\` : null;
}

async function scanJavaPathsAtDriveRoots(driveRoots, addExternalPath) {
  const javaFolderPattern = /java|jdk|jre|openjdk|temurin|adoptium|corretto|zulu|bellsoft|oracle/iu;
  const installContainerPattern = /^(?:program files(?: \(x86\))?|apps?|software|tools?|development|dev|sdks?)$/iu;
  for (const driveRoot of driveRoots) {
    addJavaHomeCandidate(driveRoot, addExternalPath);
    const entries = await readdir(driveRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const directory = resolve(driveRoot, entry.name);
      addJavaHomeCandidate(directory, addExternalPath);
      if (!javaFolderPattern.test(entry.name) && !installContainerPattern.test(entry.name)) continue;
      const children = await readdir(directory, { withFileTypes: true }).catch(() => []);
      for (const child of children) {
        if (!child.isDirectory() || child.isSymbolicLink()) continue;
        const childDirectory = resolve(directory, child.name);
        addJavaHomeCandidate(childDirectory, addExternalPath);
        if (!javaFolderPattern.test(child.name)) continue;
        const runtimes = await readdir(childDirectory, { withFileTypes: true }).catch(() => []);
        for (const runtime of runtimes) {
          if (runtime.isDirectory() && !runtime.isSymbolicLink()) {
            addJavaHomeCandidate(resolve(childDirectory, runtime.name), addExternalPath);
          }
        }
      }
    }
  }
}

function addJavaHomeCandidate(home, addExternalPath) {
  const resolvedHome = resolve(home);
  const executablePath = basename(resolvedHome).toLocaleLowerCase() === "bin"
    ? resolve(resolvedHome, "java.exe")
    : resolve(resolvedHome, "bin", "java.exe");
  addExternalPath(executablePath, "system");
}

async function readCustomJavaPaths() {
  try {
    await assertSafeFileTarget(customJavaPathsPath, false);
    const value = JSON.parse(await readFile(customJavaPathsPath, "utf8"));
    if (!Array.isArray(value)) return [];
    return value.filter((path) => typeof path === "string" && path.length <= 2048 && isAbsolute(path)
      && basename(path).toLocaleLowerCase() === "java.exe").slice(0, 32);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw new Error("手动 Java 路径清单损坏，Daemon 已停止读取该清单。");
  }
}

function validateCustomJavaExecutablePath(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\r\n\u0000]/u.test(value) || !isAbsolute(value)
    || basename(value).toLocaleLowerCase() !== "java.exe") {
    throw new Error("请输入 Windows 上 java.exe 的完整绝对路径。");
  }
  const relativePath = relative(javaDirectory, resolve(value));
  if (!relativePath.startsWith(`..${sep}`) && relativePath !== ".." && !isAbsolute(relativePath)) {
    throw new Error("LFAA 管理目录中的 Java 无法作为外部路径重复登记。");
  }
  return resolve(value);
}

function getCustomJavaRuntimeId(executablePath) {
  const normalizedPath = resolve(executablePath).toLocaleLowerCase();
  return `java-${createHash("sha256").update(normalizedPath).digest("hex").slice(0, 24)}`;
}

function sameWindowsPath(left, right) {
  return resolve(left).toLocaleLowerCase() === resolve(right).toLocaleLowerCase();
}

async function findJavaRuntime(major, managedOnly = false, distributionInput) {
  const requestedDistribution=distributionInput===undefined?null:requireJavaDistribution(distributionInput);
  const runtimes = [];
  const entries = await readdir(javaDirectory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    const root = resolve(javaDirectory, entry.name);
    const executable = await findExecutable(root, "java.exe");
    if (executable) runtimes.push({ executable, managed: true, root });
  }
  if (!managedOnly) {
    for (const pathEntry of (process.env.PATH || "").split(";").filter(Boolean)) {
      const executable = resolve(pathEntry.replace(/^"|"$/gu, ""), "java.exe");
      if (await fileExists(executable)) runtimes.push({ executable, managed: false, root: null });
    }
  }
  for (const runtime of runtimes) {
    const version = await readJavaVersion(runtime.executable).catch(() => null);
    if(version?.major!==major)continue;
    const distribution=runtime.managed?javaDistributionForManagedEntry(basename(runtime.root),version.vendor):undefined;
    if(requestedDistribution&&distribution!==requestedDistribution)continue;
    return { ...runtime, ...(distribution?{distribution,runtimeId:javaRuntimeId(distribution,major)}:{runtimeId:null}), ...version };
  }
  return null;
}

async function resolveMinecraftJavaRuntime(majorInput, runtimeId, reportProgress, downloadTimeoutSeconds) {
  const major = requireMajor(majorInput);
  if (runtimeId !== null) {
    // 显式选择必须再次按运行时 ID 和主版本解析；已失效时不回退到另一套 Java。
    if (typeof runtimeId !== "string" || runtimeId.length > 80) throw new Error("实例选择的 Java 运行环境标识无效。");
    let discovered = (await discoverJavaRuntimes()).find((runtime) => runtime.runtimeId === runtimeId);
    const managedSelection=/^(temurin|zulu)-(\d{1,2})$/u.exec(runtimeId);
    if (!discovered&&managedSelection&&Number(managedSelection[2])===major) {
      const distribution=managedSelection[1];
      await reportProgress?.(20, `实例选择的 LFAA 托管 ${distribution} Java ${major} 已卸载，正在重新准备该发行版。`);
      await installManagedJavaRuntime(major,distribution,undefined,reportProgress,downloadTimeoutSeconds);
      discovered = (await discoverJavaRuntimes()).find((runtime) => runtime.runtimeId === runtimeId);
    }
    if (!discovered) throw new Error("实例选择的 Java 已不在节点扫描结果中；请为实例重新选择运行环境。");
    if (discovered.major !== major) throw new Error(`实例选择的 Java ${discovered.major} 与服务端要求的 Java ${major} 不匹配。`);
    const executable = await realpath(discovered.executablePath).catch(() => "");
    if (!executable || basename(executable).toLocaleLowerCase() !== "java.exe") {
      throw new Error("实例选择的 Java 可执行文件已不存在或路径无效。");
    }
    const binaryDirectory = dirname(executable);
    if (basename(binaryDirectory).toLocaleLowerCase() !== "bin") {
      throw new Error("实例选择的 Java 不在标准 bin\java.exe 目录中，无法确认运行环境边界。");
    }
    const root = await realpath(dirname(binaryDirectory)).catch(() => "");
    if (!root) throw new Error("实例选择的 Java 安装目录无法验证。");
    const version = await readJavaVersion(executable);
    if (version.major !== major) throw new Error(`实例选择的 Java 实际版本为 ${version.major}，与服务端要求的 Java ${major} 不匹配。`);
    return { ...discovered, executable, root, ...version };
  }

  let java = await findJavaRuntime(major, true);
  if (!java) {
    const discovered = cachedJavaRuntimes.find(runtime => runtime.major === major) ?? (await discoverJavaRuntimes()).find(runtime => runtime.major === major);
    if (discovered) {
      await reportProgress?.(20, `已发现 Java ${major}，正在核对并复用节点现有运行环境。`);
      return resolveMinecraftJavaRuntime(major, discovered.runtimeId, reportProgress, downloadTimeoutSeconds);
    }
  }
  if (!java) {
    await reportProgress?.(20, `未找到 LFAA 托管 Java ${major}，正在准备 Temurin JRE。`);
    await installTemurinRuntime(major, reportProgress, downloadTimeoutSeconds);
    java = await findJavaRuntime(major, true);
  }
  if (!java) throw new Error(`没有找到 LFAA 托管 Java ${major}，请检查 Java 管理任务。`);
  const executable = await realpath(java.executable).catch(() => "");
  if (!executable) throw new Error(`LFAA 托管 Java ${major} 的可执行文件无法验证。`);
  const binaryDirectory = dirname(executable);
  if (basename(binaryDirectory).toLocaleLowerCase() !== "bin") throw new Error("LFAA 托管 Java 不在标准 bin\java.exe 目录中。");
  const root = await realpath(dirname(binaryDirectory)).catch(() => "");
  if (!root) throw new Error(`LFAA 托管 Java ${major} 的安装目录无法验证。`);
  return { ...java, executable, root };
}

async function readJavaVersion(executable) {
  const output = await captureProcess(executable, ["-XshowSettings:properties","-version"], 10_000);
  const text = `${output.stdout}\n${output.stderr}`;
  const versionMatch = /version\s+"(?:1\.)?(\d+)/iu.exec(text);
  if (!versionMatch) throw new Error("无法识别 Java 版本输出。");
  const vendor = /Temurin/iu.test(text) ? "Eclipse Temurin"
    : /Zulu|Azul/iu.test(text) ? "Azul Zulu"
    : /Java\(TM\)/iu.test(text) ? "Java(TM)"
      : /Oracle/iu.test(text) ? "Oracle"
        : /OpenJDK/iu.test(text) ? "OpenJDK" : "Java Runtime";
  return { major: Number(versionMatch[1]), vendor, version: /version\s+"([^"]+)"/iu.exec(text)?.[1],architecture:/^\s*os\.arch\s*=\s*(\S+)/mu.exec(text)?.[1]??"unknown",os:/^\s*os\.name\s*=\s*(.+)$/mu.exec(text)?.[1]?.trim()??"unknown" };
}


return {installTemurinRuntime,installZuluRuntime,installManagedJavaRuntime,updateTemurinRuntime,updateManagedJavaRuntime,executeJavaEnvironmentTask,uninstallTemurinRuntime,uninstallManagedJavaRuntime,registerJavaRuntimePath,forgetJavaRuntimePath,discoverJavaRuntimes,resolveMinecraftJavaRuntime,readJavaVersion,findJavaRuntime,findTemurinArchive,findZuluArchive};
}
