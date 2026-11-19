# @lfaa/shell-env

负责命令管道的编码。stdout 和 stderr 分别识别 Unicode。Windows 原生命令的遗留字节使用活动控制台代码页或系统 OEM 代码页解码。实时快照保留尚未接收完整的尾部字符。
